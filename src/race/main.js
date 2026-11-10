import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { createRaceRuntime } from './raceRuntime.js';
import { mountRaceHud } from './presentation.js';
import { raceRoster } from './roster.js';
import { robotCameraPose } from '../scene/robotCamera.js';
import { GAUNTLET_CIRCUIT, circuitPointAt } from '../envs/gauntletCircuit.js';
import { graphicsBackend } from './realtimeHealth.js';
import { drawRaceMinimap } from './recordingMap.js';
import { createRaceMapRecorder } from './mapRecorder.js';
import './race.css';

const pageParameters = new URLSearchParams(location.search);
for (const key of ['browserAgent', 'benchmarkRunner', 'showcase', 'replay', 'run', 'autostart', 'recording', 'record', 'headlessRealtime']) pageParameters.delete(key);
const previewMode = pageParameters.get('preview') === '1';
if (previewMode) {
  // Preview wins over conflicting deep-link flags: no bridge, native launch,
  // autostart/showcase, physics controls, benchmark recorder or replay writes.
  for (const key of ['browserAgent', 'benchmarkRunner', 'showcase', 'replay', 'run', 'autostart', 'recording', 'record', 'headlessRealtime']) pageParameters.delete(key);
  document.body.classList.add('race-preview');
}
const showcaseMode = pageParameters.get('showcase') === '1';
const replayMode = pageParameters.get('replay') === '1';
if (showcaseMode) document.body.classList.add('race-showcase');
if (replayMode) document.body.classList.add('race-replay');
const stage = document.getElementById('race-stage');
const loading = document.getElementById('race-loading');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x173753);
scene.fog = new THREE.Fog(0x345b70, 72, 185);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .02, 250);
camera.position.set(8, 5, 5);
// Layer 2 is reserved for spectator-only identity markers. Agent cameras stay
// on layer 0, so benchmark observations do not gain privileged labels.
camera.layers.enable(2);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
const graphics = graphicsBackend(renderer.getContext());
window.microduckGraphicsBackend = graphics;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);
const spectatorMap = document.createElement('canvas');
spectatorMap.width = 260;
spectatorMap.height = 150;
spectatorMap.style.cssText = 'position:fixed;right:15px;bottom:15px;width:min(260px,40vw);height:auto;z-index:5;pointer-events:none';
spectatorMap.setAttribute('aria-label', '全局赛道小地图');
stage.appendChild(spectatorMap);
const spectatorMapContext = spectatorMap.getContext('2d');
function updateSpectatorMap() {
  if (!race) return;
  drawRaceMinimap(spectatorMapContext, {
    frame: { x: 0, y: 0, width: 260, height: 150 },
    course: GAUNTLET_CIRCUIT.course,
    entrants: race.snapshot().entrants,
    selectedId: view.split(':')[1] ?? null,
    compact: true,
  });
}
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(3, .3, 10);
controls.enableDamping = true;
const generator = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = generator.fromScene(room).texture;
scene.environmentIntensity = 1;
room.dispose();
new RGBELoader().load('/assets/venue/daylight.hdr', (texture) => { scene.environment = generator.fromEquirectangular(texture).texture; texture.dispose(); });
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a8070, 2));
const key = new THREE.DirectionalLight(0xfff2dd, 3.6);
key.position.set(12, 28, 16);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -30, right: 30, top: 28, bottom: -28, near: .5, far: 80 });
key.shadow.bias = -.0002;
scene.add(key);
const fill = new THREE.DirectionalLight(0xcfe0f8, 1.2);
fill.position.set(-18, 16, -12);
scene.add(fill);
let race;
let view = 'start';
let hud;
let lastHud = 0;
let showcaseStartedAt = null;
const benchmarkRunner = pageParameters.get('benchmarkRunner') === '1';
const browserAgentMode = pageParameters.get('browserAgent') === '1';
if (browserAgentMode && pageParameters.get('physicsProbe') === '1') document.body.classList.add('race-physics-probe');
let lastSpectatorFrame = -Infinity;
let lastPresentationReport = performance.now();
let presentationFrames = 0;
let spectatorRenderMs = 0;
let consoleRenderMs = 0;
function focusShowcaseStage(index) {
  const stageInfo = GAUNTLET_CIRCUIT.fullCourse.stages[index];
  if (!stageInfo) return false;
  const [x, y] = stageInfo.center;
  const yaw = stageInfo.yaw;
  const distance = 5.8;
  const side = 2.2;
  view = `showcase-stage:${index}`;
  race?.setView(view);
  controls.enabled = true;
  controls.target.set(x, .28, -y);
  camera.position.set(
    x - Math.cos(yaw) * distance - Math.sin(yaw) * side,
    4.15,
    -y + Math.sin(yaw) * distance - Math.cos(yaw) * side,
  );
  camera.fov = 48;
  camera.updateProjectionMatrix();
  controls.update();
  return true;
}
function chooseView(next) {
  view = next;
  race?.setView(next);
  controls.enabled = ['overview', 'start'].includes(next);
  camera.layers[view.startsWith('fpv:') ? 'disable' : 'enable'](2);
  if (next === 'overview') { camera.position.set(29, 34, 42); controls.target.set(0, 0, 0); camera.fov = 48; }
  if (next === 'start') { camera.position.set(8, 4.5, 5); controls.target.set(3, .3, 10); camera.fov = 48; }
  if (next === 'tour') { tourStart = performance.now(); camera.fov = 55; }
  camera.updateProjectionMatrix();
  controls.update();
}
// Broadcast tour camera: flies one lap along the circuit spline. Presentation
// only — reads geometry, writes no race state, so agents and physics are
// untouched. Two passes: a slow chase behind the start line, then a low
// reverse-flyby past the grandstand.
const TOUR_LAP_SECONDS = 80;
let tourStart = 0;
function updateTourCamera(now) {
  const progress = ((now - tourStart) / 1000 / TOUR_LAP_SECONDS) % 1;
  const distance = progress * GAUNTLET_CIRCUIT.circuit.lapLength;
  const pass = progress < .72;
  const lateral = pass ? 1.9 : -1.9;
  const ahead = pass ? 2.6 : -4.2;
  const height = pass ? 2.05 : 2.6;
  const base = circuitPointAt(distance, lateral);
  const look = circuitPointAt(distance + ahead, 0);
  camera.position.set(base.x, 1.6 + height, base.y);
  camera.up.set(0, 1, 0);
  camera.lookAt(look.x, .55, look.y);
  camera.fov = pass ? 55 : 62;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
renderer.setAnimationLoop((time) => {
  if (replayMode) return;
  // Agent observations render their own sensor frame. In headless benchmark runs,
  // limit only the spectator view; physics and agent observations remain unchanged.
  if (benchmarkRunner && time - lastSpectatorFrame < 200) return;
  // Keep the live spectator view responsive without spending the full 60 Hz
  // rendering budget needed by the three-robot physics loop.
  if (browserAgentMode && time - lastSpectatorFrame < 67) return;
  lastSpectatorFrame = time;
  const spectatorTime = showcaseMode && showcaseStartedAt != null ? (time - showcaseStartedAt) / 1000 : null;
  race?.syncVisuals(spectatorTime);
  if (race && view === 'tour') {
    updateTourCamera(time);
  } else if (race && (view.startsWith('fpv:') || view.startsWith('chase:') || view.startsWith('front:'))) {
    const [mode, id] = view.split(':');
    const pose = robotCameraPose(race.rootQpos(id), mode);
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    camera.fov = mode === 'fpv' ? 40 : pose.fov;
    camera.updateProjectionMatrix();
  } else controls.update();
  const renderStarted = performance.now();
  renderer.render(scene, camera);
  updateSpectatorMap();
  const renderFinished = performance.now();
  const consoleFinished = performance.now();
  if (browserAgentMode && race) {
    presentationFrames++;
    spectatorRenderMs += renderFinished - renderStarted;
    consoleRenderMs += consoleFinished - renderFinished;
    const elapsed = time - lastPresentationReport;
    if (elapsed >= 5000) {
      race.setPresentationHealth({
        graphics: graphics.name,
        spectatorFps: presentationFrames * 1000 / elapsed,
        spectatorMs: spectatorRenderMs / presentationFrames,
        consoleAndRecorderMs: consoleRenderMs / presentationFrames,
      });
      lastPresentationReport = time;
      presentationFrames = 0;
      spectatorRenderMs = 0;
      consoleRenderMs = 0;
    }
  }
  if (race && time - lastHud > 100) { hud?.update(race.snapshot()); lastHud = time; }
});
try {
  const parameters = pageParameters;
  if (replayMode && (browserAgentMode || showcaseMode || benchmarkRunner)) throw new Error('REPLAY_CANNOT_JOIN_LIVE_RACE');
  const harnesses = parameters.get('harnesses')?.split(',').filter(Boolean) ?? parameters.get('harness') ?? 'dsh';
  const profileIds = parameters.get('agents')?.split(',').filter(Boolean) ?? null;
  const entrants = raceRoster(parameters.get('roster') ?? 'deepseek-1', harnesses, profileIds);
  const clockMode = parameters.get('roster')?.startsWith('deepseek-') && parameters.get('clock') === 'decision-paused' ? 'decision-paused' : 'realtime';
  const startStage = Number(parameters.get('stage') ?? 0);
  race = await createRaceRuntime({ scene, renderer, camera, entrants, clockMode, startStage, enforceRealtime: browserAgentMode || parameters.get('headlessRealtime') === '1', onLoad: (message) => { loading.textContent = message; }, testMode: parameters.get('test') === '1', replayMode });
  window.microduckRace = race;
  window.raceView = chooseView;
  if (benchmarkRunner && !replayMode) {
    window.microduckManualPreviewFrame = () => renderer.domElement.toDataURL('image/jpeg', .65);
    let mapRecording = null;
    window.microduckStartMapRecording = () => {
      if (mapRecording) throw new Error('MAP_RECORDER_ALREADY_STARTED');
      mapRecording = createRaceMapRecorder({ race, onChunk: (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => window.microduckWriteMapChunk(String(reader.result).split(',')[1]).then(resolve, reject);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      }) });
    };
    window.microduckStopMapRecording = () => mapRecording?.stop();
  }
  if (!showcaseMode && !replayMode) {
    hud = mountRaceHud(document.getElementById('race-hud'), { entrants, getSnapshot: race.snapshot, onStart: previewMode ? undefined : race.start, preview: previewMode, onView: chooseView, startLabel: previewMode ? 'SAFE PREVIEW · READY · NO RECORDING' : benchmarkRunner ? 'START RACE' : 'START PHYSICS · NO AGENT' });
    hud.update(race.snapshot());
  }
  // Agent races open on a full-track orbit camera. Camera controls stay enabled,
  // so the user can immediately drag/zoom the same local 3D scene the Agent uses.
  if (replayMode) {
    const replayOverlay = document.createElement('div');
    replayOverlay.className = 'race-replay__overlay';
    document.body.append(replayOverlay);
    window.renderReplaySample = (sample, cameraView, caption = '') => {
      race.replay.applySample(sample);
      chooseView(cameraView);
      replayOverlay.textContent = caption;
      const [mode, id] = cameraView.split(':');
      if (['fpv', 'chase', 'front'].includes(mode)) {
        const pose = robotCameraPose(race.rootQpos(id), mode);
        if (!pose) throw new Error(`REPLAY_CAMERA_UNAVAILABLE:${cameraView}`);
        camera.position.set(...pose.position);
        camera.lookAt(...pose.target);
        camera.fov = mode === 'fpv' ? 40 : pose.fov;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
      updateSpectatorMap();
      return { tick: sample.tick, view: cameraView };
    };
    window.renderReplayFrame = (sample, cameraView, caption = '') => {
      window.renderReplaySample(sample, cameraView, caption);
      const composite = document.createElement('canvas');
      composite.width = renderer.domElement.width;
      composite.height = renderer.domElement.height;
      const context = composite.getContext('2d');
      context.drawImage(renderer.domElement, 0, 0, composite.width, composite.height);
      const lines = String(caption).split('\n').slice(0, 5);
      const lineHeight = 18;
      const panelHeight = 18 + lines.length * lineHeight + 12;
      context.fillStyle = 'rgba(4, 18, 27, .78)';
      context.fillRect(18, composite.height - panelHeight - 18, Math.min(composite.width - 36, 620), panelHeight);
      context.fillStyle = '#eafcff';
      context.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace';
      lines.forEach((line, index) => context.fillText(line, 28, composite.height - panelHeight + 8 + index * lineHeight));
      drawRaceMinimap(context, {
        frame: { x: composite.width - 275, y: 18, width: 260, height: 150 },
        course: GAUNTLET_CIRCUIT.course,
        entrants: race.snapshot().entrants,
        selectedId: cameraView.split(':')[1] ?? null,
        compact: true,
      });
      return composite.toDataURL('image/jpeg', .82);
    };
    chooseView('overview');
  } else if (showcaseMode) {
    focusShowcaseStage(startStage);
    race.start();
    showcaseStartedAt = performance.now();
    parent.postMessage({ type: 'microduck-race-showcase-ready', stage: startStage }, location.origin);
  } else {
    const requestedView = parameters.get('view');
    const [requestedMode, requestedId] = (requestedView ?? '').split(':');
    const requestedViewValid = ['overview', 'start', 'tour'].includes(requestedView) || (['fpv', 'chase', 'front'].includes(requestedMode) && entrants.some((entrant) => entrant.id === requestedId));
    chooseView(requestedViewValid ? requestedView : (browserAgentMode || entrants.some((entrant) => entrant.id.startsWith('deepseek-')) ? 'overview' : 'start'));
  }
  if (!previewMode && !browserAgentMode && !benchmarkRunner && !showcaseMode && !replayMode) {
    const panel = document.createElement('section');
    panel.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:30;background:#061b27;color:white;padding:12px;border-radius:8px;max-width:90vw';
    const select = document.createElement('select');
    for (const entrant of entrants) { const option = document.createElement('option'); option.value = entrant.id; option.textContent = `${entrant.number} · ${entrant.label}`; select.append(option); }
    panel.append(select);
    const feedback = document.createElement('span');
    const command = (action) => {
      try {
        if (race.snapshot().status === 'ready') race.start();
        const id = select.value;
        const { observation } = race.observe(id);
        race.act(id, { request_id: `manual-${Date.now()}-${Math.random()}`, reference_frame_id: observation.frame_id, action });
        feedback.textContent = ' Action accepted · no model cost';
      } catch (error) { feedback.textContent = ` ${error.message}`; }
    };
    for (const [label, action] of [
      ['Walk', { kind: 'drive', gait: 'walk', vx: .25, vy: 0, wz: 0, duration_s: 1 }],
      ['Left', { kind: 'drive', gait: 'walk', vx: .25, vy: 0, wz: .6, duration_s: 1 }],
      ['Right', { kind: 'drive', gait: 'walk', vx: .25, vy: 0, wz: -.6, duration_s: 1 }],
      ['Hold', { kind: 'hold', duration_s: 1 }],
      ['Recover', { kind: 'skill', name: 'recover_to_stand', timeout_s: 12 }],
    ]) { const button = document.createElement('button'); button.textContent = label; button.onclick = () => command(action); panel.append(button); }
    const configure = document.createElement('a'); configure.href = '/'; configure.textContent = ' Back to benchmark ↗'; configure.style.color = '#9df8ec';
    panel.append(configure, feedback);
    document.body.append(panel);
  }
  loading.hidden = true;
} catch (error) {
  console.error(error);
  loading.textContent = `Race boot failed: ${error.message}`;
  window.raceBootError = error.message;
}

if (showcaseMode) {
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.data?.type !== 'microduck-showcase-stage') return;
    const index = Number(event.data.stage);
    if (Number.isInteger(index) && focusShowcaseStage(index)) {
      parent.postMessage({ type: 'microduck-race-showcase-focused', stage: index }, location.origin);
    }
  });
}
