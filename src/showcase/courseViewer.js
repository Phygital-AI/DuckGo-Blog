// Spectator-only course viewer. It shares the exact venue and moving-obstacle
// descriptors with the MuJoCo race, but does not load MuJoCo or policy weights.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GAUNTLET_CIRCUIT } from '../envs/gauntletCircuit.js';
import { createEnvironmentVisual } from '../envs/visuals.js';
import { createGauntletVenue } from '../scene/gauntletVenue.js';
import { advancePreviewClock } from '../envs/geometryPose.js';
import { OBSTACLE_SPEED_SCALE } from '../race/rules.js';
import snapshot from './course-provenance.json';

const stages = GAUNTLET_CIRCUIT.fullCourse.stages;
const announce = (type, detail = {}) => parent.postMessage({ type, ...detail }, location.origin);
let language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh';
document.documentElement.dataset.environment = GAUNTLET_CIRCUIT.id;
document.documentElement.dataset.visualRevision = snapshot.visualRevision;

try {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x4b7792);
  scene.fog = new THREE.Fog(0x7c9eac, 75, 185);
  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .02, 250);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  const toolbar = document.createElement('div');
  toolbar.id = 'preview-controls';
  toolbar.style.cssText = 'position:fixed;right:12px;top:62px;z-index:2;display:flex;align-items:center;gap:10px;padding:9px 11px;background:#102b34ed;border:1px solid #739a94;color:#cce9df;font:11px monospace';
  const speed = document.createElement('select');
  speed.id = 'preview-speed';
  speed.style.cssText = 'color:#e9f5ee;background:#203f43;border:1px solid #70958c;padding:5px;font:inherit';
  for (const value of [1, 4]) {
    const option = document.createElement('option');
    option.value = String(value);
    speed.append(option);
  }
  const clockLabel = document.createElement('span');
  clockLabel.id = 'preview-clock';
  toolbar.append(speed, clockLabel);
  document.body.append(toolbar);
  function updateLanguage(lang) {
    language = lang === 'en' ? 'en' : 'zh';
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    speed.setAttribute('aria-label', language === 'zh' ? '赛道预览播放速度' : 'Course preview playback speed');
    speed.options[0].textContent = language === 'zh' ? '1× 原速' : '1× Original speed';
    speed.options[1].textContent = language === 'zh' ? '4× 仅预览' : '4× Preview only';
  }
  updateLanguage(language);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.8;
  controls.maxDistance = 100;
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x48605d, 2.1));
  const key = new THREE.DirectionalLight(0xffedd2, 3.2);
  key.position.set(12, 28, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -30, right: 30, top: 28, bottom: -28, near: .5, far: 80 });
  key.shadow.bias = -.0002;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa7ceff, 1.4);
  fill.position.set(-18, 16, -12);
  scene.add(fill);

  const venue = createGauntletVenue(THREE, GAUNTLET_CIRCUIT);
  const obstacles = createEnvironmentVisual(THREE, GAUNTLET_CIRCUIT, { championship: true });
  scene.add(venue, obstacles);

  function focusStage(index) {
    const stage = stages[index];
    if (!stage) return false;
    const [x, y] = stage.center;
    const { yaw } = stage;
    controls.target.set(x, .28, -y);
    camera.position.set(x - Math.cos(yaw) * 5.8 - Math.sin(yaw) * 2.2, 4.15, -y + Math.sin(yaw) * 5.8 - Math.cos(yaw) * 2.2);
    camera.fov = 48;
    camera.updateProjectionMatrix();
    controls.update();
    document.documentElement.dataset.focusedStage = String(index);
    return true;
  }

  const initialStage = Number(new URLSearchParams(location.search).get('stage') ?? 10);
  focusStage(Number.isInteger(initialStage) ? initialStage : 10);
  addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'microduck-showcase-stage') return;
    updateLanguage(event.data.lang ?? language);
    const index = Number(event.data.stage);
    if (Number.isInteger(index) && focusStage(index)) announce('microduck-race-showcase-focused', { stage: index });
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  let clock = { frameTime: null, simulationTime: 0 };
  let announced = false;
  renderer.setAnimationLoop((time) => {
    clock = advancePreviewClock(clock, time, Number(speed.value));
    const simulationTime = clock.simulationTime;
    obstacles.userData.update?.(simulationTime * OBSTACLE_SPEED_SCALE, { simulationTime, legacyScale: OBSTACLE_SPEED_SCALE });
    venue.userData.update?.(simulationTime);
    clockLabel.textContent = `SIM ${simulationTime.toFixed(1)}s`;
    clockLabel.dataset.simulationTime = String(simulationTime);
    controls.update();
    renderer.render(scene, camera);
    if (!announced) {
      announced = true;
      announce('microduck-race-showcase-ready', { stage: initialStage });
    }
  });
} catch (error) {
  console.error('Course preview failed', error);
  announce('microduck-race-showcase-error', { message: error.message });
}
