import { outsideCourse } from './course.js';
import { driveDynamicGeometryPhysics } from './geometryPose.js';

const EPSILON = 1e-6;
export const OUT_OF_BOUNDS_GRACE_SECONDS = 10;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const length2 = (x, y) => Math.hypot(x, y);

function makeSeeded(seed = 0) {
  let state = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildRoute(course, lapLength) {
  const path = course?.path ?? [];
  const segments = [];
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const [ax, ay] = path[index - 1];
    const [bx, by] = path[index];
    const length = length2(bx - ax, by - ay);
    if (length <= EPSILON) continue;
    segments.push({ a: [ax, ay], b: [bx, by], startS: total, length });
    total += length;
  }
  const declaredLength = Number.isFinite(lapLength) ? lapLength : total;
  return { path, segments, totalLength: total, lapLength: declaredLength, arcTolerance: Math.max(0.01, Math.abs(declaredLength - total) + 0.005) };
}

function projectPoint(route, pose) {
  let nearest = null;
  for (const segment of route.segments) {
    const [ax, ay] = segment.a;
    const [bx, by] = segment.b;
    const dx = bx - ax;
    const dy = by - ay;
    const t = clamp(((pose.x - ax) * dx + (pose.y - ay) * dy) / (segment.length ** 2), 0, 1);
    const x = ax + t * dx;
    const y = ay + t * dy;
    const distance = length2(pose.x - x, pose.y - y);
    if (!nearest || distance < nearest.distance) {
      nearest = { x, y, distance, s: segment.startS + t * segment.length, segment };
    }
  }
  return nearest ?? { x: pose.x, y: pose.y, distance: Infinity, s: 0, segment: null };
}

function checkpointList(env) {
  if (Array.isArray(env.checkpoints) && env.checkpoints.length) return env.checkpoints;
  return (env.fullCourse?.stages ?? []).map((stage) => stage.checkpoint).filter(Boolean);
}

function normalizedGate(gate, lapLength, index) {
  const tangentLength = length2(gate.tangent?.[0] ?? 1, gate.tangent?.[1] ?? 0) || 1;
  const tangent = [
    (gate.tangent?.[0] ?? 1) / tangentLength,
    (gate.tangent?.[1] ?? 0) / tangentLength,
  ];
  const s = Number.isFinite(gate.s) ? gate.s : 0;
  return {
    ...gate,
    index,
    x: gate.x,
    y: gate.y,
    s: s <= EPSILON ? lapLength : s,
    tangent,
    halfWidth: gate.halfWidth ?? 0.85,
  };
}

function gateCrossing(previousPose, pose, gate) {
  const tangent = gate.tangent;
  const normal = [-tangent[1], tangent[0]];
  const previousAlong = (previousPose.x - gate.x) * tangent[0] + (previousPose.y - gate.y) * tangent[1];
  const currentAlong = (pose.x - gate.x) * tangent[0] + (pose.y - gate.y) * tangent[1];
  if (previousAlong > EPSILON || currentAlong < -EPSILON || currentAlong - previousAlong <= EPSILON) return null;
  const alpha = clamp(-previousAlong / (currentAlong - previousAlong || 1), 0, 1);
  const crossingX = previousPose.x + alpha * (pose.x - previousPose.x);
  const crossingY = previousPose.y + alpha * (pose.y - previousPose.y);
  const lateral = (crossingX - gate.x) * normal[0] + (crossingY - gate.y) * normal[1];
  return Math.abs(lateral) <= gate.halfWidth + EPSILON ? alpha : null;
}

function stageInfo(env, checkpointIndex, pose) {
  const stage = env.fullCourse?.stages?.[checkpointIndex] ?? null;
  const nextObstacleX = stage?.obstacleXs?.find((x) => x >= pose.x - 0.45) ?? null;
  return {
    stageIndex: checkpointIndex,
    stageId: stage?.id ?? env.id,
    stageTitle: stage?.title ?? env.title,
    nextObstacleX,
  };
}

export function createCircuitRuntime(env, options = {}) {
  const circuit = env.circuit;
  const gates = checkpointList(env).map((gate, index) => normalizedGate(gate, circuit.lapLength, index));
  const route = buildRoute(env.course, circuit.lapLength);
  const requiredLaps = Math.max(1, Math.floor(circuit.requiredLaps ?? 1));
  const maxStepDistance = circuit.maxStepDistance ?? 0.5;
  let spawnS = projectPoint(route, env.spawn).s;
  const initialCheckpointIndex = options.initialCheckpointIndex ?? 0;
  if (!Number.isInteger(initialCheckpointIndex) || initialCheckpointIndex < 0 || initialCheckpointIndex >= gates.length) throw new Error('INVALID_INITIAL_CHECKPOINT');
  let physics = { mujoco: options.mujoco, model: options.model, data: options.data };
  let rng = makeSeeded(options.seed ?? 0);
  let stepCount = 0;
  let simTime = 0;
  let lastPose = { x: env.spawn.x, y: env.spawn.y, z: env.spawn.z, yaw: env.spawn.yaw ?? 0, vx: 0, vy: 0, wz: 0 };
  let lastProjection = projectPoint(route, lastPose);
  let checkpointIndex = 0;
  let lapCount = 0;
  let outOfBoundsElapsed = 0;
  let state = null;

  function currentStageInfo() {
    return stageInfo(env, checkpointIndex, lastPose);
  }

  function progressAt(projection) {
    if (lapCount >= requiredLaps) return 1;
    const total = route.lapLength * requiredLaps - spawnS;
    const stageStart = checkpointIndex > 0 ? gates[checkpointIndex - 1].s : 0;
    const stageEnd = gates[checkpointIndex]?.s ?? route.lapLength;
    const arc = checkpointIndex === 0 && projection.s > route.lapLength / 2 ? 0 : projection.s;
    const creditedArc = clamp(arc, stageStart, stageEnd);
    return clamp((lapCount * route.lapLength + creditedArc - spawnS) / Math.max(EPSILON, total), 0, 1);
  }

  function dynamicWindowAt() {
    return null;
  }

  function makeObservation(pose = lastPose, command = [0, 0, 0], events = {}) {
    const goal = gates[checkpointIndex] ?? env.goal;
    const dx = goal.x - pose.x;
    const dy = goal.y - pose.y;
    const goalDistance = Math.hypot(dx, dy);
    const goalHeading = wrapAngle(Math.atan2(dy, dx) - (pose.yaw ?? 0));
    const projection = projectPoint(route, pose);
    const stageObstacles = env.geometry.filter((geometry) => geometry.collision && geometry.name.startsWith(env.fullCourse?.stages?.[checkpointIndex]?.geometryPrefix ?? "circuit"));
    const obstacle = stageObstacles.find((geometry) => geometry.circuitS >= projection.s - .2) ?? stageObstacles.at(-1);
    const ox = obstacle?.pos?.[0] ?? goal.x;
    const oy = obstacle?.pos?.[1] ?? goal.y;
    const clearance = Math.hypot(pose.x - ox, pose.y - oy);
    const remaining = clamp(1 - stepCount / (env.timeLimitSteps ?? 30000), 0, 1);
    return new Float32Array([
      dx, dy, goalDistance, goalHeading,
      pose.vx ?? 0, pose.vy ?? 0, pose.wz ?? 0,
      pose.roll ?? 0, pose.pitch ?? 0, pose.yaw ?? 0, pose.z ?? 0, events.fallen ? 1 : 0,
      progressAt(projection), state?.dynamicPhase ?? 0, ox - pose.x, oy - pose.y, clearance, obstacle?.size?.[2] ?? 0,
      command[0] ?? 0, command[1] ?? 0, command[2] ?? 0,
      events.collision ? 1 : 0, events.recovering ? 1 : 0, remaining,
    ]);
  }

  function reset(seed = options.seed ?? 0, pose = null) {
    rng = makeSeeded(seed);
    stepCount = 0;
    simTime = 0;
    checkpointIndex = initialCheckpointIndex;
    lapCount = 0;
    outOfBoundsElapsed = 0;
    lastPose = pose ? { ...pose } : { x: env.spawn.x, y: env.spawn.y, z: env.spawn.z, yaw: env.spawn.yaw ?? 0, vx: 0, vy: 0, wz: 0 };
    lastProjection = projectPoint(route, lastPose);
    spawnS = lastProjection.s;
    state = { dynamicPhase: rng(), dynamicWindow: dynamicWindowAt(), reward: 0, success: false, terminated: false, truncated: false, collision: false, fallen: false, recovering: false, fallCount: 0, invalidTransition: null, ...currentStageInfo() };
    driveDynamicGeometryPhysics(env, physics, simTime);
    return { observation: makeObservation(lastPose), info: { envId: env.id, seed, step: 0, resetPose: { ...lastPose }, progress: progressAt(lastProjection), lap: 0, checkpointIndex, checkpointCount: gates.length, ...currentStageInfo() } };
  }

  function invalidResult(reason, pose, command, events, dt) {
    const reward = env.reward?.collision ?? -1;
    state = { ...state, reward, success: false, terminated: false, truncated: true, invalidTransition: reason, collision: !!events.collision, fallen: !!events.fallen, recovering: !!events.recovering, ...currentStageInfo() };
    return {
      observation: makeObservation(lastPose, command, events), reward, terminated: false, truncated: true,
      info: {
        envId: env.id, category: env.category, step: stepCount, progress: progressAt(lastProjection), success: false,
        lap: lapCount, checkpointIndex, checkpointCount: gates.length, elapsedTime: simTime,
        invalidTransition: reason, transitionValid: false, outOfBounds: outsideCourse(env.course, pose),
        ...currentStageInfo(),
      },
    };
  }

  function step(input = {}, dt = 0.02) {
    if (!state) reset();
    if (state.terminated || state.truncated) {
      return { observation: makeObservation(), reward: 0, terminated: state.terminated, truncated: state.truncated, info: {
        envId: env.id, step: stepCount, progress: progressAt(lastProjection), success: state.success, lap: lapCount,
        checkpointIndex, checkpointCount: gates.length, elapsedTime: simTime, invalidTransition: state.invalidTransition,
        ...currentStageInfo(),
      } };
    }
    const pose = input.pose ? { ...lastPose, ...input.pose } : { ...lastPose };
    const command = input.command ?? [0, 0, 0];
    const events = input.events ?? {};
    const elapsed = Math.max(0, dt);
    stepCount += 1;
    simTime += elapsed;
    driveDynamicGeometryPhysics(env, physics, simTime);
    const previousPose = lastPose;
    const previousProjection = lastProjection;
    const previousProgress = progressAt(previousProjection);
    const finitePose = ['x', 'y', 'z', 'yaw', 'vx', 'vy', 'wz', 'roll', 'pitch'].every((key) => pose[key] === undefined || Number.isFinite(pose[key]));
    if (!finitePose) return invalidResult('nonFinitePose', pose, command, events, elapsed);
    const projection = projectPoint(route, pose);
    const movement = Math.hypot(pose.x - previousPose.x, pose.y - previousPose.y, (pose.z ?? 0) - (previousPose.z ?? 0));
    const previousInBounds = !outsideCourse(env.course, previousPose);
    const outOfBounds = outsideCourse(env.course, pose);
    const rawDelta = projection.s - previousProjection.s;
    const forwardDelta = rawDelta < -route.totalLength / 2 ? rawDelta + route.totalLength : rawDelta > route.totalLength / 2 ? rawDelta - route.totalLength : rawDelta;
    if (movement > maxStepDistance + EPSILON) return invalidResult('stepDistanceExceeded', pose, command, events, elapsed);
    const movingBackward = forwardDelta < -EPSILON;
    if (events.fallen || events.recovering || !outOfBounds) outOfBoundsElapsed = 0;
    else outOfBoundsElapsed += elapsed;
    const outOfBoundsExpired = outOfBounds && !events.fallen && !events.recovering && outOfBoundsElapsed >= OUT_OF_BOUNDS_GRACE_SECONDS;
    if (outOfBoundsExpired) {
      lastPose = pose;
      lastProjection = projection;
      state = { ...state, outOfBounds, terminated: true, truncated: false, success: false, reward: env.reward?.collision ?? -1, ...currentStageInfo() };
      return { observation: makeObservation(pose, command, events), reward: state.reward, terminated: true, truncated: false, info: {
        envId: env.id, category: env.category, step: stepCount, progress: progressAt(projection), success: false,
        lap: lapCount, checkpointIndex, checkpointCount: gates.length, elapsedTime: simTime, outOfBounds,
        outOfBoundsGraceRemaining: 0, invalidTransition: null, transitionValid: true, ...currentStageInfo(),
      } };
    }
    if (!movingBackward && !outOfBounds && previousInBounds && !events.fallen && !events.recovering) {
      const crossed = [];
      const cycle = lapCount;
      for (const gate of gates) {
        const target = cycle * route.lapLength + gate.s;
        const previousUnwrapped = cycle * route.lapLength + previousProjection.s;
        const currentUnwrapped = previousUnwrapped + forwardDelta;
        const projectionTolerance = route.arcTolerance + env.course.halfWidth * .06;
        if (target >= previousUnwrapped - projectionTolerance && target <= currentUnwrapped + projectionTolerance && gateCrossing(previousPose, pose, gate) !== null) crossed.push(gate.index);
      }
      const expected = gates[checkpointIndex];
      const expectedCrossed = expected && crossed.includes(expected.index);
      if (crossed.some((index) => index > checkpointIndex && !(checkpointIndex === 0 && index === gates.length - 1))) return invalidResult('outOfOrderGate', pose, command, events, elapsed);
      if (expectedCrossed) {
        checkpointIndex += 1;
        if (checkpointIndex === gates.length) {
          lapCount += 1;
          if (lapCount < requiredLaps) checkpointIndex = 0;
        }
      }
    }
    lastPose = pose;
    lastProjection = projection;
    const taskComplete = !env.taskChecks || env.taskChecks.every((check) => events[check]);
    const success = lapCount >= requiredLaps && checkpointIndex === gates.length && taskComplete && !events.fallen && !events.recovering && !events.collision && !outOfBounds;
    const terminated = success || events.fatal === true;
    const truncated = !terminated && stepCount >= (env.timeLimitSteps ?? 30000);
    const fallCount = state.fallCount + (events.fallen && !state.fallen ? 1 : 0);
    const deltaProgress = progressAt(projection) - previousProgress;
    const energy = Math.abs(command[0] ?? 0) + Math.abs(command[1] ?? 0) + 0.4 * Math.abs(command[2] ?? 0);
    const reward = (env.reward?.progress ?? 1) * deltaProgress + (success ? (env.reward?.success ?? 10) : 0) + (events.collision ? (env.reward?.collision ?? -1) : 0) + (events.fallen ? (env.reward?.fall ?? -2) : 0) + (env.reward?.energy ?? -0.002) * energy + (env.reward?.time ?? -0.001);
    state = { ...state, outOfBounds, outOfBoundsGraceRemaining: outOfBounds && !events.fallen && !events.recovering ? Math.max(0, OUT_OF_BOUNDS_GRACE_SECONDS - outOfBoundsElapsed) : OUT_OF_BOUNDS_GRACE_SECONDS, dynamicPhase: (state.dynamicPhase + elapsed) % 1, dynamicWindow: dynamicWindowAt(), reward, success, terminated, truncated, collision: !!events.collision, fallen: !!events.fallen, recovering: !!events.recovering, fallCount, taskComplete, towelPicked: !!events.towelPicked, towelDelivered: !!events.towelDelivered, ballCleared: !!events.ballCleared, invalidTransition: null, ...currentStageInfo() };
    return {
      observation: makeObservation(pose, command, events), reward, terminated, truncated,
      info: {
        envId: env.id, category: env.category, step: stepCount, progress: progressAt(projection), success, taskComplete,
        taskChecks: env.taskChecks ?? [], lap: lapCount, requiredLaps, checkpointIndex, checkpointCount: gates.length,
        outOfBounds, outOfBoundsGraceRemaining: state.outOfBoundsGraceRemaining, collision: !!events.collision,
        fallen: !!events.fallen, recovering: !!events.recovering, fallCount, elapsedTime: simTime,
        dynamicPhase: state.dynamicPhase, dynamicWindow: state.dynamicWindow, invalidTransition: null, transitionValid: true,
        ...currentStageInfo(),
      },
    };
  }

  return {
    env,
    bindPhysics(nextPhysics = {}) { physics = { ...physics, ...nextPhysics }; driveDynamicGeometryPhysics(env, physics, simTime); },
    reset,
    driveDynamicPhysics(time = simTime) { driveDynamicGeometryPhysics(env, physics, time); },
    get simTime() { return simTime; },
    step,
    observation: () => makeObservation(),
    get state() { return state; },
    get stepCount() { return stepCount; },
  };
}
