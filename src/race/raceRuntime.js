import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import * as ort from 'onnxruntime-web/wasm';
import mujocoWasmUrl from '@mujoco/mujoco/mujoco.wasm?url';
import ortWasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { buildRig, cloneRig, loadKinematics, setJoint, MODEL_DIR, loadGlbGeometries, geometryToBinaryStl } from '../game/duck.js';
import { POLICIES, JOINT_NAMES, DEFAULT_POSE, NUM_JOINTS, CTRL_DT, TIMESTEP, DECIMATION } from '../game/constants.js';
import { GAUNTLET_CIRCUIT } from '../envs/gauntletCircuit.js';
import { createCircuitRuntime } from '../envs/circuitRuntime.js';
import { applyGeometryPoseToMocap, geometryObstacleTime, driveNativeSurface } from '../envs/geometryPose.js';
import { createEnvironmentVisual } from '../envs/visuals.js';
import { createGauntletVenue } from '../scene/gauntletVenue.js';
import { createAgentCamera } from '../scene/robotCamera.js';
import { relativePose } from './relativePose.js';
import { createRecovery, restartRecovery, advanceRecovery, recoveryPolicy, recoveryProgress } from './recoveryController.js';
import { WALL_MILESTONES_SECONDS, captureWallMilestones, progressState } from './progressMetrics.js';
import { buildRaceDefinitions, buildRaceWorldXml, resolveRaceRobotAddresses } from './worldBuilder.js';
import { RACE_ENTRANTS, applyRaceLivery, spectatorIdentityLabel } from './presentation.js';
import { createRealtimeWatchdog, MIN_REALTIME_FACTOR } from './realtimeHealth.js';
import { capabilities, validateRaceAction, programCommand, raceClock, shouldPauseRace, backwardDisplacementFromContact, GAITS, RACE_SECONDS, DECISION_WALL_SECONDS, isActionFrameValid, OBSTACLE_SPEED_SCALE, rankEntrants, evaluationValidity } from './rules.js';

import { assertHumanConfiguration, validateHumanFrame } from './humanControl.js';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const yawOf = (quaternion) => Math.atan2(2 * (quaternion[0] * quaternion[3] + quaternion[1] * quaternion[2]), 1 - 2 * (quaternion[2] ** 2 + quaternion[3] ** 2));
// crypto.randomUUID() is unavailable on plain HTTP in some browsers. The
// public showcase is intentionally deployable without TLS, so keep episode
// identity generation compatible with both secure and insecure contexts.
const makeId = (prefix) => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* fall through to the non-cryptographic browser fallback */ }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

function createSpectatorAgentTag(definition) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const identityColor = definition.identityColor ?? definition.primary;
  // Sleek dark tag with an identity left bar and border: reads well over both
  // the bright sky and the dark grandstand without turning into a billboard.
  context.fillStyle = 'rgba(4, 15, 23, .9)';
  context.fillRect(4, 4, 504, 120);
  context.fillStyle = identityColor;
  context.fillRect(4, 4, 18, 120);
  context.strokeStyle = identityColor;
  context.lineWidth = 7;
  context.strokeRect(4, 4, 504, 120);
  context.fillStyle = '#f4ffff';
  context.font = '900 46px ui-monospace, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(spectatorIdentityLabel(definition), 267, 64, 445);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  tag.name = `spectator_agent_tag_${definition.id}`;
  tag.scale.set(1.16, .29, 1);
  tag.layers.set(2);
  tag.userData.texture = texture;
  return tag;
}

export async function createRaceRuntime({ scene, renderer, camera, entrants = RACE_ENTRANTS, onLoad = () => {}, testMode = false, replayMode = false, clockMode = 'realtime', enforceRealtime = false, startStage = 0, humanMode = false }) {
  assertHumanConfiguration({ humanMode, replayMode, testMode, entrants, clockMode, startStage });
  if (!['realtime', 'decision-paused'].includes(clockMode)) throw new Error('INVALID_RACE_CLOCK_MODE');
  const environment = GAUNTLET_CIRCUIT;
  const obstacleTime = (simulationTime) => simulationTime * OBSTACLE_SPEED_SCALE;
  const definitions = buildRaceDefinitions(entrants, startStage);
  onLoad('Loading MuJoCo, robot and policies');
  ort.env.wasm.wasmPaths = { wasm: ortWasmUrl };
  ort.env.wasm.numThreads = 1;
  const [mujoco, robotXml, kinematics, geometries] = await Promise.all([
    loadMujoco({ locateFile: (file) => file.endsWith('.wasm') ? mujocoWasmUrl : file }),
    fetch(`${MODEL_DIR}/robot_allcollisions.xml`).then((response) => response.text()),
    loadKinematics(`${MODEL_DIR}/kinematics.json`), loadGlbGeometries(),
  ]);
  const xml = buildRaceWorldXml({ robotXml, env: environment, entrants: definitions, DOMParser, XMLSerializer });
  const xmlDocument = new DOMParser().parseFromString(xml, 'text/xml');
  const vfs = new mujoco.MjVFS();
  await Promise.all([...xmlDocument.querySelectorAll('asset > mesh[file]')].map(async (mesh) => {
    const filename = mesh.getAttribute('file');
    const cached = geometries.get(filename);
    const buffer = cached ? geometryToBinaryStl(cached.welded) : await fetch(`${MODEL_DIR}/meshes/${filename}`).then((response) => response.arrayBuffer());
    vfs.addBuffer(`assets/${filename}`, new Uint8Array(buffer));
  }));
  const model = mujoco.MjModel.from_xml_string(xml, vfs);
  const data = new mujoco.MjData(model);
  const policyNames = ['walk', 'runStraight', 'sitstand', 'roll', 'stand'];
  const sessions = replayMode ? {} : Object.fromEntries(await Promise.all(policyNames.map(async (name) => [name, await ort.InferenceSession.create(POLICIES[name], { executionProviders: ['wasm'] })])));
  const baseRig = await buildRig(kinematics);
  const venue = createGauntletVenue(THREE, environment);
  const obstacles = createEnvironmentVisual(THREE, environment, { championship: true });
  scene.add(venue, obstacles);
  const events = [];
  const samples = [];
  const subscribers = new Set();
  let humanInput = () => ({ source: 'safety', gait: 'walk', command: [0, 0, 0], skill: null });
  let lastHumanDecision = null;
  let lastHumanState = null;
  let lastSampleTick = -1;
  const notify = (kind, value) => { for (const listener of subscribers) { try { listener(kind, value); } catch (error) { console.error('HUMAN_SUBSCRIBER_ERROR', error); } } };
  function captureSample(final = false) {
    if (lastSampleTick === tick && !final) return;
    const sample = { tick, sim_time_s: tick * CTRL_DT, wall_seconds: startedAt == null ? 0 : (activeNow(finishedAt ?? performance.now()) - startedAt) / 1000, final, robots: robots.map(robot => ({ id: robot.id, root: rootQpos(robot), joints: robot.addresses.jointQposAdrs.map(address => data.qpos[address]), mode: robot.mode, gait: robot.gait, ...recoveryProgress(robot.recovery, tick), recovery_request_remaining_s: recoveryRequestRemaining(robot), command: [...robot.command], progress: robot.progress, checkpoint: robot.checkpointIndex, status: robot.raceStatus })) };
    lastSampleTick = tick;
    if (humanMode) notify('sample', sample);
  }
  function applyHumanInput() {
    const robot = robots[0];
    const frame = humanInput();
    let decision = validateHumanFrame(frame, { status, robot });
    // Valid release input rearms independently of action/body eligibility.
    // In particular, falling again before release must not latch escape skills.
    if (decision.neutralInput) robot.humanNeedsNeutral = false;
    if (decision.accepted && robot.humanNeedsNeutral && (frame.skill || frame.command.some(value => value !== 0))) {
      decision = { accepted: false, reason: 'INPUT_NEUTRAL_REQUIRED' };
    }
    robot.humanCommand = [0, 0, 0];
    if (decision.accepted) {
      const { drive, skill } = decision;
      if (skill) {
        if (skill.name === 'sit') { robot.mode = 'sitstand'; robot.sitFlag = 0; robot.lastAction.fill(0); }
        if (skill.name === 'stand') { robot.sitFlag = 0; robot.lastAction.fill(0); }
        if (skill.name === 'roulade') startRoll(robot);
        if (robot.active && skill.name === 'recover_to_stand') settleAction(robot, 'MANUAL_RECOVERY_RESTART');
        // Shared skill timing/completion/recovery logic; no image/frame/receipt map.
        robot.active = { requestId: 'human-skill', signature: '', receipt: { source: frame.source }, spec: skill, startTick: tick, stableTicks: 0, tipped: false, human: true };
        if (skill.name === 'recover_to_stand') beginRecovery(robot, 'HUMAN_REQUESTED');
      } else {
        if (robot.gait !== drive.gait) robot.lastAction.fill(0);
        robot.gait = drive.gait;
        robot.humanCommand = [...drive.command];
      }
    }
    const applied = decision.accepted && !decision.skill ? [...robot.humanCommand] : [0, 0, 0];
    const row = { source: frame.source, requested: frame, accepted: decision.accepted, reason: decision.reason, applied_skill: decision.accepted ? decision.skill?.name ?? null : null, applied_command: applied, mode: robot.mode, gait: robot.gait };
    const signature = JSON.stringify(row);
    if (signature !== lastHumanDecision || frame.skill) { emit('human_input', row); lastHumanDecision = signature; }
  }
  const wallMilestones = [];
  let progressBaseline = null;
  function captureProgressMilestones() {
    const wall = (activeNow(finishedAt ?? performance.now()) - startedAt) / 1000;
    if (startedAt != null && WALL_MILESTONES_SECONDS.some((target) => wall >= target && !wallMilestones.some((row) => row.target_wall_seconds === target))) {
      captureWallMilestones(wallMilestones, snapshot());
    }
  }
  const stepDurations = [];
  let status = 'ready';
  let startedAt = null;
  let finishedAt = null;
  let finishReason = null;
  let tick = 0;
  let episode = makeId('episode');
  let stepPending = null;
  let runningLoop = null;
  let wallTimer = null;
  let limitSeconds = RACE_SECONDS;
  const wallLimitSeconds = clockMode === 'decision-paused' ? DECISION_WALL_SECONDS : RACE_SECONDS;
  let pausedWallMs = 0;
  let pauseStartedAt = null;
  let pauseCount = 0;
  // Only human live tests subtract explicit comfort breaks. Agent clocks are identical.
  let lastHumanActiveAt = -Infinity;
  const activeNow = now => {
    if (!humanMode) return now;
    // Clamp subtraction roundoff at resume so saved clocks never go backwards.
    lastHumanActiveAt = Math.max(lastHumanActiveAt, (pauseStartedAt ?? now) - pausedWallMs);
    return lastHumanActiveAt;
  };
  function humanDeadlineExpired(now = performance.now()) {
    return humanMode && startedAt != null && raceClock({ startedAt, now: activeNow(now), simTicks: tick, limitSeconds, wallLimitSeconds }).expired;
  }
  function scheduleHumanDeadline() {
    clearTimeout(wallTimer);
    if (status !== 'running' || pauseStartedAt != null) return;
    const remainingMs = wallLimitSeconds * 1000 - (activeNow(performance.now()) - startedAt);
    wallTimer = setTimeout(() => {
      if (status !== 'running' || pauseStartedAt != null) return;
      if (humanDeadlineExpired()) finish('WALL_TIME_LIMIT');
      else scheduleHumanDeadline();
    }, Math.max(1, Math.ceil(remainingMs)));
  }
  function setHumanPaused(value) {
    if (status !== 'running' || value === (pauseStartedAt != null)) return false;
    const now = performance.now();
    if (humanDeadlineExpired(now)) { finish('WALL_TIME_LIMIT'); return false; }
    humanPauseGeneration++;
    if (value) { pauseStartedAt = now; pauseCount++; }
    else { pausedWallMs += now - pauseStartedAt; pauseStartedAt = null; }
    for (const robot of robots) { robot.command = [0, 0, 0]; robot.humanCommand = [0, 0, 0]; }
    emit(value ? 'human_pause' : 'human_resume', { real_timestamp: new Date().toISOString(), real_elapsed_s: (now - startedAt) / 1000, pause_duration_s: value ? 0 : (now - lastHumanPauseAt) / 1000, paused_total_s: (now - activeNow(now)) / 1000 });
    if (value) lastHumanPauseAt = now;
    scheduleHumanDeadline();
    return true;
  }
  let lastHumanPauseAt = null;
  let humanPauseGeneration = 0;
  let sequence = 0;
  let viewId = 'start';
  let executionPhase = 'ready';
  let realtimeHealth = null;
  let presentationHealth = null;
  let watchdog = null;
  const activeContacts = new Map();
  let contactCount = 0;
  let interRobotContactCount = 0;
  const bodyOwners = new Map();
  const poseQuaternion = new THREE.Quaternion();
  const gravity = new THREE.Vector3();
  const motionBodies = environment.geometry.flatMap((geometry, index) => {
    if (!geometry.dynamic || !geometry.motion) return [];
    const bodyId = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY.value, `env_motion_${geometry.name}_${index}`);
    return bodyId < 0 ? [] : [{ geometry, index, mocapId: model.body_mocapid[bodyId] }];
  });
  function emit(type, detail = {}) {
    const event = { seq: ++sequence, type, tick, sim_time_s: tick * CTRL_DT, wall_time_s: startedAt == null ? 0 : (activeNow((humanMode ? finishedAt : null) ?? performance.now()) - startedAt) / 1000, ...detail };
    if (!humanMode) events.push(event);
    notify('event', event);
    return event;
  }
  const robots = definitions.map((definition, index) => {
    const addresses = resolveRaceRobotAddresses(mujoco, model, definition.prefix);
    const rig = index === 0 ? baseRig : cloneRig(baseRig);
    applyRaceLivery(THREE, rig, definition);
    const spectatorTag = definitions.length > 1 ? createSpectatorAgentTag(definition) : null;
    scene.add(rig.placer);
    if (spectatorTag) scene.add(spectatorTag);
    for (const geomId of addresses.geomIds) bodyOwners.set(geomId, definition.id);
    const scorer = createCircuitRuntime({ ...environment, spawn: definition.spawn, timeLimitSteps: RACE_SECONDS / CTRL_DT }, { dt: CTRL_DT, seed: 1, initialCheckpointIndex: startStage });
    return { ...definition, addresses, rig, spectatorTag, scorer, lastAction: new Float32Array(NUM_JOINTS), obs: new Float32Array(61), command: [0, 0, 0], gait: 'walk', mode: 'walk', sitFlag: 0, active: null, lastReceipt: null, receipts: new Map(), frames: new Map(), recovery: null, recoveryTicks: 0, recoveryRetryCount: 0, effectiveActionTicks: 0, falls: 0, contacts: 0, lastContactTick: null, progress: 0, checkpointIndex: startStage, finishTime: null, raceStatus: 'ready', terminalReason: null, stability: 0, fallenTicks: 0, actionSerial: 0 };
  });
  const robotById = new Map(robots.map((robot) => [robot.id, robot]));
  function robotFor(id) {
    const robot = robotById.get(id);
    if (!robot) throw new Error('UNKNOWN_ENTRANT');
    return robot;
  }
  function rootQpos(robot) {
    return Array.from(data.qpos.slice(robot.addresses.rootQposAdr, robot.addresses.rootQposAdr + 7));
  }
  function bodyState(robot) {
    const root = rootQpos(robot);
    const velocity = Array.from(data.qvel.slice(robot.addresses.rootDofAdr, robot.addresses.rootDofAdr + 6));
    const quaternion = root.slice(3);
    return { pose: { x: root[0], y: root[1], z: root[2], yaw: yawOf(quaternion), vx: velocity[0], vy: velocity[1], wz: velocity[5] }, upright: 1 - 2 * (quaternion[1] ** 2 + quaternion[2] ** 2), speed: Math.hypot(...velocity.slice(0, 3)), root, velocity };
  }
  function localPose(robot) {
    const pose = bodyState(robot).pose;
    const origin = { x: robot.spawn.x, y: robot.spawn.y, yaw: robot.spawn.yaw };
    return relativePose({ x: pose.x, y: pose.y, yaw: pose.yaw }, origin);
  }
  function driveGeometry(simulationTime) {
    const motionTime = obstacleTime(simulationTime);
    for (const { geometry, index, mocapId } of motionBodies) {
      if(geometry.nativeSurface)driveNativeSurface(mujoco,model,data,geometry,index,simulationTime,OBSTACLE_SPEED_SCALE);
      else applyGeometryPoseToMocap(data, mocapId, geometry, geometryObstacleTime(geometry, simulationTime, OBSTACLE_SPEED_SCALE));
    }
  }
  // The spectator preview can provide its own wall-clock time. The actual
  // MuJoCo bodies continue to use tick-based simulation time in driveGeometry;
  // this optional value only keeps the public showcase moving while a browser
  // is waiting on policy loading/inference.
  function syncVisuals(spectatorTime = null) {
    for (const robot of robots) {
      const root = rootQpos(robot);
      const trunk = robot.rig.bodies.get('trunk_base');
      trunk.position.set(root[0], root[1], root[2]);
      trunk.quaternion.set(root[4], root[5], root[6], root[3]);
      JOINT_NAMES.forEach((name, index) => setJoint(robot.rig, name, data.qpos[robot.addresses.jointQposAdrs[index]]));
      trunk.updateWorldMatrix(true, false);
      if (robot.spectatorTag) {
        trunk.getWorldPosition(robot.spectatorTag.position);
        robot.spectatorTag.position.y += .66;
      }
    }
    const visualTime = Number.isFinite(spectatorTime) ? spectatorTime : tick * CTRL_DT;
    obstacles.userData.update?.(obstacleTime(visualTime), {simulationTime:visualTime, legacyScale:OBSTACLE_SPEED_SCALE});
    venue.userData.update?.(visualTime);
  }
  for (const robot of robots) robot.sensor = createAgentCamera(THREE, { scene, renderer, spectatorCamera: camera, getQpos: () => rootQpos(robot), beforeRender: syncVisuals });

  function initialize() {
    mujoco.mj_resetData(model, data);
    for (const robot of robots) {
      const { rootQposAdr, jointQposAdrs, actuatorIds } = robot.addresses;
      data.qpos.set([robot.spawn.x, robot.spawn.y, .12, Math.cos(robot.spawn.yaw / 2), 0, 0, Math.sin(robot.spawn.yaw / 2)], rootQposAdr);
      JOINT_NAMES.forEach((name, index) => {
        data.qpos[jointQposAdrs[index]] = DEFAULT_POSE[index];
        data.ctrl[actuatorIds[index]] = DEFAULT_POSE[index];
      });
      robot.scorer.reset(1, bodyState(robot).pose);
    }
    driveGeometry(0);
    mujoco.mj_forward(model, data);
    syncVisuals();
  }
  initialize();

  function settleAction(robot, reason, completed = false) {
    if (!robot.active) return;
    const action = robot.active;
    const receipt = { ...action.receipt, state: completed ? 'completed' : 'failed', reason, completed, completed_tick: tick, executed_ticks: tick - action.startTick, final_pose: localPose(robot) };
    if (!action.human) robot.receipts.set(action.requestId, { signature: action.signature, receipt });
    robot.lastReceipt = receipt;
    robot.active = null;
    robot.command = [0, 0, 0];
    emit('action_result', { agent_id: robot.id, receipt });
  }

  function recoveryRequestRemaining(robot) {
    const active = robot.active;
    return active?.spec.name === 'recover_to_stand' ? Math.max(0, active.spec.ticks - (tick - active.startTick)) * CTRL_DT : 0;
  }

  function recoveryState(robot) {
    return { ...bodyState(robot), joints: robot.addresses.jointQposAdrs.map(address => data.qpos[address]) };
  }

  function retryRecovery(robot, reason, diagnostics = {}) {
    robot.recoveryRetryCount++;
    settleAction(robot, 'PHYSICAL_RECOVERY_RETRY');
    robot.recovery = restartRecovery(robot.recovery, tick, recoveryState(robot), reason);
    robot.controlWindow = null;
    robot.lastAction.fill(0);
    robot.command = [0, 0, 0];
    robot.sitFlag = 0;
    const progress = recoveryProgress(robot.recovery, tick);
    emit('recovery_retry', { agent_id: robot.id, retry_count: robot.recoveryRetryCount, recovery_total_s: robot.recoveryTicks * CTRL_DT, reason, ...diagnostics, ...progress, controller_history_reset: true, pose_reset: false });
    emit('recovery_started', { agent_id: robot.id, reason: `RECOVERY_${reason}_RETRY`, ...progress });
  }

  function startRoll(robot) {
    // Automatic recovery relinquishes ownership before the explicit roll skill.
    robot.recovery = null;
    robot.controlWindow = null;
    robot.mode = 'roll'; robot.gait = 'walk'; robot.sitFlag = 0;
    robot.fallenTicks = 0; robot.lastAction.fill(0);
  }

  function beginRecovery(robot, reason) {
    if (robot.raceStatus === 'retired') return;
    if (robot.recovery) {
      if (!['AGENT_REQUESTED', 'HUMAN_REQUESTED'].includes(reason)) return;
      robot.recoveryRetryCount++;
      robot.recovery = null; // Deliberate fresh finite budget, without touching physics.
    }
    if (robot.active?.spec.name !== 'recover_to_stand') settleAction(robot, reason);
    robot.recovery = createRecovery(tick, recoveryState(robot));
    robot.controlWindow = null;
    robot.mode = 'recover';
    robot.lastAction.fill(0);
    robot.sitFlag = 0;
    robot.command = [0, 0, 0];
    emit('recovery_started', { agent_id: robot.id, reason, ...recoveryProgress(robot.recovery, tick) });
  }

  function prepareCommand(robot) {
    robot.command = [0, 0, 0];
    if (robot.raceStatus === 'retired' || robot.raceStatus === 'finished') return;
    const active = robot.active;
    if (humanMode && !active && !robot.recovery && robot.mode === 'walk') robot.command = [...(robot.humanCommand ?? [0, 0, 0])];
    if (!active || robot.recovery) return;
    const elapsedTicks = tick - active.startTick;
    if (active.spec.kind !== 'skill' && elapsedTicks >= active.spec.ticks) {
      settleAction(robot, 'DURATION_COMPLETE', true);
      return;
    }
    if (active.spec.kind === 'drive') robot.command = [...active.spec.command];
    if (active.spec.kind === 'program') {
      const segment = programCommand(active.spec, elapsedTicks);
      if (segment?.gait && robot.gait !== segment.gait) { robot.gait = segment.gait; robot.lastAction.fill(0); }
      if (segment) robot.command = [...segment.command];
    }
    if (active.spec.kind === 'skill' && active.spec.name === 'sit') robot.sitFlag = elapsedTicks >= 40 ? 1 : 0;
  }

  function buildObservation(robot) {
    const { jointQposAdrs, jointDofAdrs, gyroAdr, trunkId } = robot.addresses;
    const quaternion = data.xquat.subarray(trunkId * 4, trunkId * 4 + 4);
    poseQuaternion.set(quaternion[1], quaternion[2], quaternion[3], quaternion[0]).conjugate();
    gravity.set(0, 0, -1).applyQuaternion(poseQuaternion);
    let offset = 0;
    for (let axis = 0; axis < 3; axis++) robot.obs[offset++] = data.sensordata[gyroAdr + axis];
    for (const value of gravity.toArray()) robot.obs[offset++] = value;
    for (let joint = 0; joint < NUM_JOINTS; joint++) robot.obs[offset++] = data.qpos[jointQposAdrs[joint]] - DEFAULT_POSE[joint];
    for (let joint = 0; joint < NUM_JOINTS; joint++) robot.obs[offset++] = data.qvel[jointDofAdrs[joint]];
    for (const value of robot.lastAction) robot.obs[offset++] = value;
    const command = new Float32Array(13);
    if (robot.mode === 'sitstand') command[0] = robot.sitFlag;
    else if (!robot.recovery && robot.mode === 'walk') command.set(robot.command);
    robot.obs.set(command, offset);
    return robot.obs;
  }

  function selectedPolicy(robot) {
    if (robot.recovery) return recoveryPolicy(robot.recovery);
    if (robot.raceStatus === 'retired') return 'stand';
    if (robot.mode === 'roll') return 'roll';
    if (robot.mode === 'sitstand') return 'sitstand';
    return GAITS[robot.gait].policy;
  }

  function collectContacts(substep) {
    const found = new Map();
    const contactVector = data.contact;
    try {
    for (let index = 0; index < data.ncon; index++) {
      const contact = contactVector.get(index);
      let geomIds;
      let distance;
      try {
        geomIds = [contact.geom1, contact.geom2];
        distance = Number(contact.dist);
      } finally { contact.delete(); }
      const owners = geomIds.map((geomId) => bodyOwners.get(geomId) ?? null);
      if ((!owners[0] && !owners[1]) || (owners[0] && owners[0] === owners[1])) continue;
      const externalGeom = owners[0] ? geomIds[1] : geomIds[0];
      if ((!owners[0] || !owners[1]) && model.geom_type[externalGeom] === 0) continue;
      const agentIds = [...new Set(owners.filter(Boolean))].sort();
      const other = agentIds.length === 2 ? null : mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_GEOM.value, externalGeom);
      const key = agentIds.length === 2 ? `robots:${agentIds.join(':')}` : `obstacle:${agentIds[0]}:${other}`;
      const previous = found.get(key);
      const movingLowBar = typeof other === 'string' && other.includes('reciprocal_low_gate');
      const contactPose = movingLowBar && agentIds.length === 1 ? bodyState(robotFor(agentIds[0])).pose : null;
      found.set(key, {
        agent_ids: agentIds, obstacle: other,
        kind: agentIds.length === 2 ? 'robot_robot' : 'robot_obstacle',
        penetration_m: Math.max(previous?.penetration_m ?? 0, -distance, 0), substep,
        ...(contactPose ? { contact_pose: { x: contactPose.x, y: contactPose.y, yaw: contactPose.yaw } } : {}),
      });
    }
    } finally { contactVector.delete(); }
    for (const [key, value] of found) {
      for (const id of value.agent_ids) robotFor(id).lastContactTick = tick;
      const previous = activeContacts.get(key);
      if (!previous) {
        contactCount++;
        if (value.kind === 'robot_robot') interRobotContactCount++;
        value.agent_ids.forEach((id) => robotFor(id).contacts++);
        emit('contact_begin', { contact_key: key, ...value });
      }
      activeContacts.set(key, { ...value, started_tick: previous?.started_tick ?? tick, peak_penetration_m: Math.max(previous?.peak_penetration_m ?? 0, value.penetration_m), last_seen_tick: tick });
    }
    for (const [key, value] of activeContacts) {
      if (!found.has(key) && tick - value.last_seen_tick > 2) {
        emit('contact_end', { contact_key: key, ...value });
        activeContacts.delete(key);
      }
    }
  }

  function updateRobot(robot) {
    const state = bodyState(robot);
    if (![...state.root, ...state.velocity].every(Number.isFinite)) throw new Error(`NONFINITE_PHYSICS:${robot.id}`);
    const rollActive = robot.mode === 'roll';
    const fallen = state.upright < .55 || (state.pose.z < .035 && robot.mode !== 'sitstand');
    robot.fallenTicks = fallen && !rollActive ? robot.fallenTicks + 1 : 0;
    if (robot.fallenTicks === 10 && !robot.recovery && robot.raceStatus !== 'retired' && robot.raceStatus !== 'finished') {
      robot.falls++;
      emit('fall', { agent_id: robot.id });
      beginRecovery(robot, 'FALL_RECOVERY_TAKEOVER');
    }
    if (robot.active && !robot.recovery && robot.active.spec.kind !== 'hold') robot.effectiveActionTicks++;
    if (robot.recovery && ['ready', 'running'].includes(robot.raceStatus)) {
      robot.recoveryTicks++;
      const recoveryEvent = advanceRecovery(robot.recovery, tick, recoveryState(robot));
      if (recoveryEvent?.type === 'completed') {
        robot.recovery = null;
        robot.controlWindow = null;
        robot.command = [0, 0, 0];
        robot.humanCommand = [0, 0, 0];
        if (humanMode) robot.humanNeedsNeutral = true;
        robot.mode = 'walk';
        robot.gait = 'walk';
        robot.lastAction.fill(0);
        if (robot.active?.spec.name === 'recover_to_stand') settleAction(robot, 'PHYSICAL_RECOVERY_COMPLETED', true);
        emit('recovery_completed', { agent_id: robot.id });
      } else if (recoveryEvent?.type === 'retry') {
        const { type, reason, ...diagnostics } = recoveryEvent;
        retryRecovery(robot, reason, diagnostics);
      } else if (recoveryEvent?.type === 'phase') {
        robot.lastAction.fill(0);
        emit('recovery_phase_changed', { agent_id: robot.id, ...recoveryEvent, type: 'recovery_phase_changed', ...recoveryProgress(robot.recovery, tick), recovery_request_remaining_s: recoveryRequestRemaining(robot), controller_history_reset: true, pose_reset: false });
      }
    }
    const active = robot.active;
    if (active && active.spec.kind !== 'skill' && tick - active.startTick >= active.spec.ticks) settleAction(robot, 'DURATION_COMPLETE', true);
    if (active?.spec.kind === 'skill') {
      const elapsed = tick - active.startTick;
      const name = active.spec.name;
      if (name === 'roulade' && state.upright < .3) active.tipped = true;
      if (name === 'roulade' && elapsed >= 50 && active.tipped && state.upright > .9 && robot.mode === 'roll') { robot.mode = 'walk'; robot.lastAction.fill(0); }
      if (name === 'stand' && elapsed >= 100 && robot.mode === 'sitstand') { robot.mode = 'walk'; robot.lastAction.fill(0); }
      const settled = name === 'sit' ? robot.sitFlag === 1 && state.pose.z < .085 && state.upright > .7 && state.speed < .1
        : name === 'stand' ? elapsed >= 100 && robot.mode === 'walk' && !robot.recovery && state.pose.z > .085 && state.upright > .9 && state.speed < .12
          : name === 'roulade' ? active.tipped && elapsed >= 50 && robot.mode === 'walk' && state.upright > .9 && state.speed < .15 : false;
      active.stableTicks = settled ? active.stableTicks + 1 : 0;
      if (active.stableTicks >= 25) settleAction(robot, 'SKILL_COMPLETED', true);
      else if (elapsed >= active.spec.ticks) {
        // Request timeout settles only the receipt; the physical episode has
        // its own finite budget and may still achieve stable recovery.
        settleAction(robot, 'SKILL_TIMEOUT');
        if (name === 'roulade') { robot.mode = 'walk'; robot.lastAction.fill(0); if (state.upright < .85) beginRecovery(robot, 'ROLL_TIMEOUT'); }
      }
    }
    if (robot.raceStatus === 'running') {
      const result = robot.scorer.step({ pose: state.pose, command: robot.command, events: { fallen: robot.fallenTicks > 0, recovering: !!robot.recovery, recoverable: true, collision: false } }, CTRL_DT);
      robot.progress = result.info.progress;
      const previousCheckpoint = robot.checkpointIndex;
      robot.checkpointIndex = result.info.checkpointIndex;
      for (let checkpoint = previousCheckpoint + 1; checkpoint <= robot.checkpointIndex; checkpoint++) {
        emit('checkpoint_passed', { agent_id: robot.id, checkpoint_index: checkpoint, progress: robot.progress });
      }
      if (result.info.success) {
        robot.finishTime = tick * CTRL_DT;
        robot.raceStatus = 'finished';
        robot.terminalReason = 'COURSE_COMPLETED';
        settleAction(robot, 'RACE_FINISHED', true);
        venue.userData.celebrate?.({ x: state.pose.x, y: state.pose.y, z: state.pose.z });
        emit('entrant_finished', { agent_id: robot.id });
      } else if (result.terminated || result.truncated) {
        robot.raceStatus = 'retired';
        robot.terminalReason = result.info.invalidTransition ?? 'COURSE_BOUNDARY_OR_TIMEOUT';
        settleAction(robot, robot.terminalReason);
        emit('retired', { agent_id: robot.id, reason: robot.terminalReason, pose_reset: false });
      }
    }
  }

  // Observability must never own policy/physics liveness. No WASM bool-view
  // getter is accessed: actuator_ctrllimited is unsupported by this binding.
  function recordControlDiagnostic(robot, policy) {
    try {
      if (robot.diagnosticDisabled) return;
      if (!robot.recovery && robot.mode !== 'roll') { robot.controlWindow = null; return; }
      const targets = robot.addresses.actuatorIds.map(address => data.ctrl[address]);
      const actual = robot.addresses.jointQposAdrs.map(address => data.qpos[address]);
      const state = bodyState(robot);
      let window = robot.controlWindow;
      if (!window || window.policy !== policy) window = robot.controlWindow = { policy, tick, root: [...state.root], joints: actual, targets, maxTargetDelta: 0, maxJointDelta: 0, maxTrackingError: 0 };
      window.maxTargetDelta = Math.max(window.maxTargetDelta, ...targets.map((v,i) => Math.abs(v-window.targets[i])));
      window.maxJointDelta = Math.max(window.maxJointDelta, ...actual.map((v,i) => Math.abs(v-window.joints[i])));
      window.maxTrackingError = Math.max(window.maxTrackingError, ...actual.map((v,i) => Math.abs(v-targets[i])));
      if (tick - window.tick < 50) return;
      let forces = null;
      try { const view = data.actuator_force; forces = robot.addresses.actuatorIds.map(address => Number.isFinite(view?.[address]) ? view[address] : null); } catch { /* optional WASM view unavailable */ }
      const detail = { agent_id: robot.id, policy, window_ticks: tick-window.tick, target_rad: targets, effective_target_rad: null, effective_target_status: 'unavailable_wasm_bool_view', actuator_force: forces, actual_joint_rad: actual, max_target_delta_rad: window.maxTargetDelta, max_joint_delta_rad: window.maxJointDelta, max_requested_target_tracking_error_rad: window.maxTrackingError, root_translation_m: Math.hypot(...state.root.slice(0,3).map((v,i)=>v-window.root[i])), upright: state.upright, height_m: state.pose.z, command: [...robot.command], pose_reset: false };
      JSON.stringify(detail); // Keep even optional serialization inside the isolation boundary.
      emit('recovery_control_diagnostic', detail);
      robot.controlWindow = null;
    } catch {
      // Disable at most once per entrant, avoiding error/log loops or throwing
      // from the reporting fallback. Actual control and deadlines continue.
      robot.diagnosticDisabled = true;
      robot.controlWindow = null;
    }
  }

  async function executeTick() {
    if (stepPending) throw new Error('WORLD_STEP_BUSY');
    stepPending = (async () => {
      const began = performance.now();
      const pauseGeneration = humanPauseGeneration;
      if (humanMode) applyHumanInput();
      for (const robot of robots) {
        prepareCommand(robot);
        executionPhase = `policy:${robot.id}:${selectedPolicy(robot)}`;
        const policy = selectedPolicy(robot);
        const session = sessions[policy];
        const output = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', buildObservation(robot), [1, 61]) });
        if (humanMode && (pauseStartedAt != null || status !== 'running' || pauseGeneration !== humanPauseGeneration)) return;
        if (humanDeadlineExpired()) { finish('WALL_TIME_LIMIT'); return; }
        const targets = output[session.outputNames[0]].data;
        if (targets.length !== NUM_JOINTS || !Array.from(targets).every(Number.isFinite)) throw new Error('INVALID_POLICY_OUTPUT');
        robot.lastAction.set(targets);
        targets.forEach((target, index) => { data.ctrl[robot.addresses.actuatorIds[index]] = DEFAULT_POSE[index] + target; });
        recordControlDiagnostic(robot, policy);
      }
      if (status === 'finished') return;
      if (humanDeadlineExpired()) { finish('WALL_TIME_LIMIT'); return; }
      for (let substep = 0; substep < DECIMATION; substep++) {
        executionPhase = `physics:${substep}`;
        driveGeometry(tick * CTRL_DT + substep * TIMESTEP);
        mujoco.mj_step(model, data);
        executionPhase = `contacts:${substep}`;
        collectContacts(substep);
      }
      tick++;
      executionPhase = 'referee';
      for (const robot of robots) updateRobot(robot);
      if (humanMode) {
        const state = JSON.stringify(robots.map(robot => [robot.mode, robot.gait, !!robot.recovery, robot.raceStatus]));
        if (state !== lastHumanState) { emit('human_state_transition', { previous: lastHumanState, current: state, reason: 'POST_PHYSICS_STATE' }); lastHumanState = state; }
      }
      if (humanMode) { if (tick % 5 === 0) captureSample(); }
      else if (tick % 5 === 0) samples.push({ tick, wall_seconds: startedAt == null ? 0 : (performance.now() - startedAt) / 1000, robots: robots.map((robot) => ({ id: robot.id, root: rootQpos(robot), joints: robot.addresses.jointQposAdrs.map((address) => data.qpos[address]), mode: robot.mode, gait: robot.gait, ...recoveryProgress(robot.recovery, tick), recovery_request_remaining_s: recoveryRequestRemaining(robot), command: [...robot.command], progress: robot.progress, checkpoint: robot.checkpointIndex, status: robot.raceStatus })) });
      if (!humanMode || stepDurations.length < 4096) stepDurations.push(performance.now() - began);
    })();
    try { await stepPending; } finally { stepPending = null; }
  }

  function finish(reason = 'WALL_TIME_LIMIT') {
    if (status === 'finished') return;
    const wasHumanPaused = humanMode && pauseStartedAt != null;
    status = 'finished';
    finishedAt = performance.now();
    captureProgressMilestones();
    if (pauseStartedAt != null) { pausedWallMs += finishedAt - pauseStartedAt; pauseStartedAt = null; }
    finishReason = reason;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    clearTimeout(wallTimer);
    for (const robot of robots) {
      settleAction(robot, reason);
      if (robot.raceStatus === 'running' || robot.raceStatus === 'ready') {
        robot.raceStatus = 'dnf';
        robot.terminalReason = reason;
      }
      robot.command = [0, 0, 0];
    }
    emit('race_finished', { reason, ...(humanMode ? { real_timestamp: new Date().toISOString(), real_elapsed_s: startedAt == null ? 0 : (finishedAt - startedAt) / 1000, paused_total_s: pausedWallMs / 1000, ended_while_paused: wasHumanPaused } : {}) });
    if (humanMode) captureSample(true);
  }

  function onVisibilityChange() {
    if (status === 'running' && clockMode === 'realtime' && document.hidden) finish('BROWSER_HIDDEN_REALTIME_INVALID');
  }

  function start() {
    if (replayMode) throw new Error('REPLAY_CANNOT_START_PHYSICS');
    if (status !== 'ready') throw new Error('RACE_ALREADY_STARTED');
    status = 'running';
    startedAt = performance.now();
    watchdog = clockMode === 'realtime' && enforceRealtime ? createRealtimeWatchdog({ startedAt, startedTick: tick, controlDt: CTRL_DT }) : null;
    if (watchdog) document.addEventListener('visibilitychange', onVisibilityChange);
    robots.forEach((robot) => { if (robot.raceStatus === 'ready') robot.raceStatus = 'running'; });
    emit('lights_out', { agent_ids: robots.map((robot) => robot.id), clock_mode: clockMode, time_limit_wall_seconds: wallLimitSeconds, time_limit_sim_seconds: limitSeconds });
    if (humanMode) captureSample();
    progressBaseline = progressState(snapshot());
    if (humanMode) scheduleHumanDeadline();
    else wallTimer = setTimeout(() => finish('WALL_TIME_LIMIT'), wallLimitSeconds * 1000);
    let resumeAnchorAt = startedAt;
    let resumeAnchorTick = tick;
    runningLoop = (async () => {
      try {
        while (status === 'running') {
          const now = performance.now();
          captureProgressMilestones();
          if (watchdog) {
            const sample = watchdog.sample(now, tick);
            if (sample) {
              realtimeHealth = { ...sample, minimumFactor: MIN_REALTIME_FACTOR };
              emit('realtime_health', realtimeHealth);
              if (sample.invalid) { finish('REALTIME_FACTOR_BELOW_MINIMUM'); break; }
            }
            if (document.hidden) { finish('BROWSER_HIDDEN_REALTIME_INVALID'); break; }
          }
          if (humanMode && pauseStartedAt != null) { await sleep(20); continue; }
          if (raceClock({ startedAt, now: activeNow(now), simTicks: tick, limitSeconds, wallLimitSeconds }).expired) { finish('TIME_LIMIT'); break; }
          if (shouldPauseRace(clockMode, robots)) {
            if (pauseStartedAt == null) { pauseStartedAt = now; pauseCount++; }
            await sleep(20);
            continue;
          }
          if (pauseStartedAt != null) {
            pausedWallMs += now - pauseStartedAt;
            pauseStartedAt = null;
            resumeAnchorAt = now;
            resumeAnchorTick = tick;
          }
          const nextTime = (clockMode === 'decision-paused' ? resumeAnchorAt + (tick - resumeAnchorTick) * CTRL_DT * 1000 : startedAt + (humanMode ? pausedWallMs : 0) + tick * CTRL_DT * 1000);
          if (performance.now() < nextTime) await sleep(Math.min(20, nextTime - performance.now()));
          if (status !== 'running') break;
          if (humanMode && pauseStartedAt != null) continue;
          await executeTick();
          if (robots.every((robot) => robot.raceStatus !== 'running')) finish('ALL_ENTRANTS_TERMINAL');
          await sleep(0);
        }
      } catch (error) { emit('infrastructure_error', { message: error.message, stack: error.stack, phase: executionPhase }); finish('PLATFORM_INVALID'); }
    })();
    return snapshot();
  }

  function snapshot() {
    const now = finishedAt ?? performance.now();
    const clock = raceClock({ startedAt, now: activeNow(now), simTicks: tick, limitSeconds, wallLimitSeconds });
    const validity = status === 'finished' ? evaluationValidity({ report: { status, finishReason, events } }) : { valid_for_ranking: null, validity_status: 'pending', invalid_reason: null };
    return { ...validity, valid_for_ranking: false, validity_status: humanMode ? 'PHYSICAL_PENDING' : 'unvalidated-v2-practice', ...(humanMode ? { controller: 'HUMAN_CONTROLLED', clockSemantics: 'pausable-human-active-realtime', realElapsedSeconds: startedAt == null ? 0 : (now - startedAt) / 1000 } : {}), invalid_reason: 'V2_PHYSICAL_VALIDATION_PENDING', course_id: GAUNTLET_CIRCUIT.id, layout_revision: GAUNTLET_CIRCUIT.circuit.layoutRevision, result_namespace: GAUNTLET_CIRCUIT.circuit.resultNamespace, schema: 'microduck.contact-race.v1', episode_id: episode, status, tick, ...clock, clockMode, realtimeHealth, presentationHealth, worldPaused: pauseStartedAt != null, pausedWallSeconds: (pausedWallMs + (pauseStartedAt == null ? 0 : now - pauseStartedAt)) / 1000, pauseCount, finishReason, contacts: contactCount, interRobotContacts: interRobotContactCount, physics: { worlds: 1, robots: robots.length, nq: model.nq, nu: model.nu, timestep: TIMESTEP }, view: viewId,
      entrants: rankEntrants(robots.map((robot) => ({ id: robot.id, label: robot.label, model: robot.model, number: robot.number, colorName: robot.colorName, primary: robot.primary, identityColor: robot.identityColor, progress: robot.progress, checkpointIndex: robot.checkpointIndex, checkpointCount: 16, mode: robot.mode, gait: robot.gait, actionStatus: robot.active ? `${robot.active.spec.kind}:${robot.active.spec.name ?? robot.active.spec.gait ?? 'tracking'}` : 'HOLD', finishTime: robot.finishTime, recovery_total_s: robot.recoveryTicks * CTRL_DT, recovery_retry_count: robot.recoveryRetryCount, ...recoveryProgress(robot.recovery, tick), recovery_request_remaining_s: recoveryRequestRemaining(robot), effective_action_s: robot.effectiveActionTicks * CTRL_DT, falls: robot.falls, contacts: robot.contacts, status: robot.raceStatus, terminalReason: robot.terminalReason, pose: bodyState(robot).pose, activeAction: robot.active?.receipt ?? null, lastReceipt: robot.lastReceipt }))) };
  }

  function observe(id) {
    const robot = robotFor(id);
    const frameId = `${episode}:${id}:${tick}:${robot.frames.size}`;
    const state = bodyState(robot);
    const clock = snapshot();
    const recentContacts = events
      .filter((event) => event.type === 'contact_begin' && event.agent_ids?.includes(id) && tick - event.tick <= 150)
      .slice(-5)
      .map((event) => {
        const contact = {
          tick: event.tick,
          age_s: Number(((tick - event.tick) * CTRL_DT).toFixed(2)),
          kind: event.kind,
          obstacle: event.obstacle,
          other_agents: event.agent_ids.filter((agentId) => agentId !== id),
          penetration_m: event.penetration_m,
        };
        if (event.contact_pose && typeof event.obstacle === 'string' && event.obstacle.includes('reciprocal_low_gate')) {
          const current = bodyState(robot).pose;
          const backwardM = backwardDisplacementFromContact(event.contact_pose, current);
          contact.backward_displacement_m = Number(backwardM.toFixed(2));
          contact.physical_feedback = backwardM > 0.03
            ? `After contact with moving low bar, robot is ${backwardM.toFixed(2)} m behind its contact position along its heading.`
            : 'Contact with moving low bar; no measurable backward displacement from the contact point.';
        }
        return contact;
      });
    const recoveryElapsed = robot.recovery ? (tick - robot.recovery.startTick) * CTRL_DT : 0;
    const completed = robot.lastReceipt;
    const lastMotion = completed?.start_pose && completed?.final_pose ? (() => {
      const translationM = Math.hypot(completed.final_pose.x - completed.start_pose.x, completed.final_pose.y - completed.start_pose.y);
      const yawRad = Math.atan2(Math.sin(completed.final_pose.yaw - completed.start_pose.yaw), Math.cos(completed.final_pose.yaw - completed.start_pose.yaw));
      const expectedTranslation = completed.action?.kind === 'drive' && Math.abs(completed.action.vx ?? 0) > .01;
      return {
        translation_m: Number(translationM.toFixed(3)),
        yaw_change_rad: Number(yawRad.toFixed(3)),
        stalled: expectedTranslation && translationM < .03,
        feedback: expectedTranslation && translationM < .03
          ? 'The last locomotion action completed but produced less than 0.03 m translation; treat it as a stall/ineffective command and change the next decision.'
          : 'Measured displacement from the completed action receipt.',
      };
    })() : null;
    const observation = { frame_id: frameId, episode_id: episode, agent_id: id, tick, simulation_time_s: tick * CTRL_DT, clock_mode: clockMode, race_status: status, entrant_status: robot.raceStatus, remaining_wall_s: clock.remainingSeconds, remaining_sim_s: clock.remainingSimulationSeconds, pose: localPose(robot), body: { height: state.pose.z, upright: state.upright, mode: robot.mode, gait: robot.gait, recovery: !!robot.recovery, recovery_total_s: robot.recoveryTicks * CTRL_DT, recovery_retry_count: robot.recoveryRetryCount, ...recoveryProgress(robot.recovery, tick), recovery_request_remaining_s: recoveryRequestRemaining(robot), recovery_elapsed_s: robot.recovery ? recoveryElapsed : 0, recovery_timeout_remaining_s: robot.recovery ? recoveryProgress(robot.recovery, tick).recovery_budget_remaining_s : 0, external_contact_recent: robot.lastContactTick != null && tick - robot.lastContactTick <= 50 }, recent_contacts: recentContacts, course_safety: { on_track: robot.scorer.state?.outOfBounds !== true, outside_grace_remaining_s: robot.scorer.state?.outOfBoundsGraceRemaining ?? null, passed_checkpoints: robot.checkpointIndex, total_checkpoints: 16 }, active_action: robot.active?.receipt ?? null, last_receipt: robot.lastReceipt, last_motion_feedback: lastMotion, odometry_source: 'ideal simulated launch-relative SE2', camera: robot.sensor.contract };
    robot.frames.set(frameId, { ...observation, createdAt: performance.now() });
    if (robot.frames.size > 64) robot.frames.delete(robot.frames.keys().next().value);
    const image = robot.sensor.capture();
    return { observation, image };
  }

  function act(id, request) {
    if (humanMode || replayMode) throw new Error('AGENT_ACT_DISABLED');
    const robot = robotFor(id);
    const requestId = request?.request_id;
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(requestId)) throw new Error('INVALID_REQUEST_ID');
    const signature = JSON.stringify({ frame: request.reference_frame_id, action: request.action });
    const previous = robot.receipts.get(requestId);
    if (previous) {
      if (previous.signature !== signature) throw new Error('REQUEST_ID_CONFLICT');
      return previous.receipt;
    }
    if (status !== 'ready' && status !== 'running') throw new Error('RACE_TERMINAL');
    if (!['ready', 'running'].includes(robot.raceStatus)) throw new Error('ENTRANT_TERMINAL');
    const observation = robot.frames.get(request.reference_frame_id);
    if (!isActionFrameValid(observation, { episode, status, tick, nowMs: performance.now() })) throw new Error('FRAME_EXPIRED_OR_FOREIGN');
    const spec = validateRaceAction(request.action, observation, localPose(robot));
    if (robot.active && robot.recovery && spec.kind === 'skill' && spec.name === 'recover_to_stand' && robot.active.spec.name === 'recover_to_stand') settleAction(robot, 'MANUAL_RECOVERY_RESTART');
    if (robot.active) throw new Error('ACTION_BUSY: query status or explicitly cancel native drive first');
    const recoveryRoll = !!robot.recovery && spec.kind === 'skill' && spec.name === 'roulade';
    if (robot.recovery && !(spec.kind === 'skill' && spec.name === 'recover_to_stand') && !recoveryRoll) throw new Error(robot.recovery.phase === 'blocked' ? 'RECOVERY_BLOCKED' : 'BODY_RECOVERING');
    if (spec.kind === 'drive' || spec.kind === 'program') {
      if (robot.mode !== 'walk' || robot.recovery) throw new Error('LOCOMOTION_UNAVAILABLE');
      const nextGait = spec.kind === 'program' ? (programCommand(spec, 0)?.gait ?? robot.gait) : spec.gait ?? 'walk';
      if (robot.gait !== nextGait) robot.lastAction.fill(0);
      robot.gait = nextGait;
    }
    if (spec.kind === 'skill') {
      if (spec.name === 'stand' && robot.mode !== 'sitstand') throw new Error('STAND_REQUIRES_SITTING');
      if (['sit', 'roulade'].includes(spec.name) && robot.mode !== 'walk' && !recoveryRoll) throw new Error('SKILL_REQUIRES_WALK_MODE');
      if (spec.name === 'sit') { robot.mode = 'sitstand'; robot.sitFlag = 0; robot.lastAction.fill(0); }
      if (spec.name === 'stand') { robot.sitFlag = 0; robot.lastAction.fill(0); }
      if (spec.name === 'roulade') startRoll(robot);
    }
    const receipt = { accepted: true, state: 'running', request_id: requestId, action_id: `${id}:${++robot.actionSerial}`, accepted_tick: tick, observation_tick: observation.tick, start_pose: localPose(robot), action: request.action, duration_ticks: spec.ticks };
    robot.active = { requestId, signature, receipt, spec, startTick: tick, stableTicks: 0, tipped: false };
    robot.receipts.set(requestId, { signature, receipt });
    if (spec.kind === 'skill' && spec.name === 'recover_to_stand') beginRecovery(robot, 'AGENT_REQUESTED');
    emit('action_accepted', { agent_id: id, receipt });
    return receipt;
  }

  function cancel(id) {
    const robot = robotFor(id);
    if (robot.active?.spec.kind === 'skill') return { accepted: false, reason: 'SKILL_NON_INTERRUPTIBLE', active: robot.active.receipt };
    settleAction(robot, 'AGENT_CANCELLED');
    return { accepted: true, tick };
  }
  function submit(id) {
    const robot = robotFor(id);
    settleAction(robot, 'AGENT_SUBMITTED');
    robot.raceStatus = robot.finishTime == null ? 'retired' : 'finished';
    robot.terminalReason = robot.finishTime == null ? 'AGENT_SUBMITTED' : 'COURSE_COMPLETED';
    emit('agent_submit', { agent_id: id, status: robot.raceStatus });
    if (status === 'running' && robots.every((entrant) => entrant.raceStatus !== 'running')) finish('ALL_ENTRANTS_TERMINAL');
    return { status: robot.raceStatus, finished: robot.finishTime != null };
  }
  function retire(id, reason) {
    const robot = robotFor(id);
    if (!['ready', 'running'].includes(status) || !['ready', 'running'].includes(robot.raceStatus)) return { status: robot.raceStatus, retired: false };
    if (status === 'ready' && reason !== 'PROVIDER_EXPLICIT_REFUSAL') return { status: robot.raceStatus, retired: false };
    if (typeof reason !== 'string' || !/^[A-Z_]{3,64}$/.test(reason)) throw new Error('INVALID_RETIREMENT_REASON');
    settleAction(robot, reason);
    robot.raceStatus = 'retired';
    robot.terminalReason = reason;
    robot.command = [0, 0, 0];
    emit('retired', { agent_id: id, reason, pose_reset: false });
    if (robots.every((entrant) => !['ready', 'running'].includes(entrant.raceStatus))) finish('ALL_ENTRANTS_TERMINAL');
    return { status: robot.raceStatus, retired: true, reason };
  }
  function report() {
    const times = [...stepDurations].sort((left, right) => left - right);
    const state = snapshot();
    return { ...state, progress_metrics: { baseline: progressBaseline, wall_milestones: wallMilestones, final: progressState(state) }, created_at: new Date().toISOString(), mode: 'three-body-contact-development', formal_benchmark: false, source_contract: raceCapabilities(), step_ms: { median: times[Math.floor(times.length * .5)] ?? null, p95: times[Math.floor(times.length * .95)] ?? null }, events, samples, collision_measurement: 'MuJoCo geom-pair contact episodes and penetration; impulse not yet reported', automatic_pose_resets: 0 };
  }
  const raceCapabilities = () => capabilities({ clockMode, wallLimitSeconds, simulationLimitSeconds: limitSeconds });
  // Event sequence numbers start at 1 and match array positions, so incremental
  // readers need only copy new events instead of rescanning the full race log.
  const eventsSince = (after = 0) => events.slice(Math.max(0, Math.floor(Number(after))));
  const api = { start, finish, snapshot, observe, act, cancel, submit, retire, report, capabilities: raceCapabilities, syncVisuals, rootQpos: (id) => rootQpos(robotFor(id)), setView: (value) => { viewId = value; }, setPresentationHealth: (value) => { presentationHealth = value; }, eventsSince, samplesSince: (afterTick = 0) => samples.slice(Math.max(0, Math.floor(Number(afterTick) / 5))), actionStatus: (id) => ({ active: robotFor(id).active?.receipt ?? null, last_receipt: robotFor(id).lastReceipt, entrant_status: robotFor(id).raceStatus, ...recoveryProgress(robotFor(id).recovery, tick), recovery_request_remaining_s: recoveryRequestRemaining(robotFor(id)), race_status: status }), ready: true };
  if (humanMode) api.human = {
    setPaused(value) { return setHumanPaused(!!value); },
    setInputProvider(provider) { if (typeof provider !== 'function') throw new Error('INVALID_INPUT_PROVIDER'); humanInput = provider; },
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
    diagnostic(type, detail = {}) { emit('human_diagnostic', { diagnostic: type, ...detail }); },
    mapping() { return { joint_names: [...JOINT_NAMES], joint_qpos_addresses: [...robots[0].addresses.jointQposAdrs], root_qpos_address: robots[0].addresses.rootQposAdr, quaternion_order: 'wxyz', control_dt_s: CTRL_DT, sample_interval_ticks: 5, seed: 1 }; },
  };
  // Replay is available only on the dedicated offline page. Never expose pose
  // injection to a live Agent race or its MCP tools.
  if (replayMode) api.replay = {
    applySample(sample) {
      if (status !== 'ready') throw new Error('REPLAY_REQUIRES_IDLE_RACE');
      if (!Number.isInteger(sample?.tick) || sample.tick < 0 || !Array.isArray(sample.robots) || sample.robots.length !== robots.length) throw new Error('INVALID_REPLAY_SAMPLE');
      const byId = new Map(sample.robots.map((item) => [item.id, item]));
      for (const robot of robots) {
        const item = byId.get(robot.id);
        if (!item || item.root?.length !== 7 || item.joints?.length !== NUM_JOINTS || ![...item.root, ...item.joints].every(Number.isFinite)) throw new Error(`INVALID_REPLAY_ROBOT:${robot.id}`);
        data.qpos.set(item.root, robot.addresses.rootQposAdr);
        item.joints.forEach((value, index) => { data.qpos[robot.addresses.jointQposAdrs[index]] = value; });
        // Replay HUD/minimap reads these saved values; no referee is run offline.
        robot.progress = item.progress ?? robot.progress;
        robot.checkpointIndex = item.checkpoint ?? robot.checkpointIndex;
        robot.raceStatus = item.status ?? robot.raceStatus;
        robot.mode = item.mode ?? robot.mode;
        robot.gait = item.gait ?? robot.gait;
        if (Array.isArray(item.command)) robot.command = [...item.command];
      }
      tick = sample.tick;
      data.qvel.fill(0);
      driveGeometry(tick * CTRL_DT);
      mujoco.mj_forward(model, data);
      syncVisuals();
    },
  };
  if (testMode) api.debug = {
    model, data, mujoco, robots, xml,
    async step(count) { if (status !== 'ready') throw new Error('TEST_ONLY_BEFORE_RACE'); for (let index = 0; index < count; index++) await executeTick(); syncVisuals(); },
    setLimit(seconds) { if (status !== 'ready' || seconds <= 0 || seconds > RACE_SECONDS) throw new Error('TEST_LIMIT_INVALID'); limitSeconds = seconds; },
    setPose(id, root) { if (status !== 'ready') throw new Error('TEST_ONLY_BEFORE_RACE'); const robot = robotFor(id); data.qpos.set(root, robot.addresses.rootQposAdr); mujoco.mj_forward(model, data); syncVisuals(); },
  };
  emit('ready', { worlds: 1, agent_ids: robots.map((robot) => robot.id), policies: policyNames, grid_slots: robots.map((robot) => robot.gridSlot) });
  onLoad(`${robots.length} Microduck${robots.length === 1 ? '' : 's'} ready · one shared physics world`);
  return api;
}
