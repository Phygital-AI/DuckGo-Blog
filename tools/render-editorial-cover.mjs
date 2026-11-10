import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const playwrightModule = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(playwrightModule ? pathToFileURL(resolve(playwrightModule)).href : 'playwright');
const output = resolve(project, 'public/showcase/broadcast-poster-v2.jpg');
const assets = new Map([
  ['/robot/mjlab/microduck.glb', resolve(project, 'public/robot/mjlab/microduck.glb')],
  ['/robot/mjlab/kinematics.json', resolve(project, 'public/robot/mjlab/kinematics.json')],
  ['/showcase/article-hero.jpg', resolve(project, 'public/showcase/article-hero.jpg')],
  ['/src/game/duck.js', resolve(project, 'src/game/duck.js')],
  ['/src/game/signed.js', resolve(project, 'src/game/signed.js')],
  ['/node_modules/three/build/three.module.js', resolve(project, 'node_modules/three/build/three.module.js')],
  ['/node_modules/three/examples/jsm/loaders/GLTFLoader.js', resolve(project, 'node_modules/three/examples/jsm/loaders/GLTFLoader.js')],
  ['/node_modules/three/examples/jsm/loaders/STLLoader.js', resolve(project, 'node_modules/three/examples/jsm/loaders/STLLoader.js')],
  ['/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js', resolve(project, 'node_modules/three/examples/jsm/utils/BufferGeometryUtils.js')],
  ['/showcase/brands/openai.svg', resolve(project, 'public/showcase/brands/openai.svg')],
  ['/showcase/brands/anthropic.svg', resolve(project, 'public/showcase/brands/anthropic.svg')],
  ['/showcase/brands/deepseek.svg', resolve(project, 'public/showcase/brands/deepseek.svg')],
  ['/showcase/brands/qwen.svg', resolve(project, 'public/showcase/brands/qwen.svg')],
  ['/showcase/brands/zai.svg', resolve(project, 'public/showcase/brands/zai.svg')],
  ['/showcase/brands/moonshot.svg', resolve(project, 'public/showcase/brands/moonshot.svg')],
  ['/showcase/brands/google.svg', resolve(project, 'public/showcase/brands/google.svg')],
]);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    html, body { width: 1440px; height: 810px; margin: 0; overflow: hidden; }
    body { position: relative; background: #efefeb; }
    #circuit {
      position: absolute;
      left: -260px;
      top: -55px;
      width: 1710px;
      height: 933px;
      object-fit: cover;
      filter: saturate(.9) brightness(1.02) contrast(.98);
      -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 63%, rgba(0,0,0,.84) 70%, transparent 79%);
      mask-image: linear-gradient(90deg, #000 0%, #000 63%, rgba(0,0,0,.84) 70%, transparent 79%);
    }
    #robot { position: absolute; inset: 0; width: 1440px; height: 810px; }
    #brand-wash {
      position: absolute;
      inset: auto 0 0;
      height: 104px;
      background: linear-gradient(0deg, rgba(239,239,235,.97), rgba(239,239,235,.84) 62%, transparent);
      pointer-events: none;
    }
    #brand-row {
      position: absolute;
      left: 50%;
      bottom: 24px;
      width: 1080px;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #brand-row img { display: block; width: auto; height: 44px; max-width: 132px; object-fit: contain; }
    #status { position: absolute; left: 16px; bottom: 16px; color: #5f6260; font: 12px/1.4 sans-serif; }
  </style>
  <script type="importmap">
    {"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}
  </script>
</head>
<body>
  <img id="circuit" src="/showcase/article-hero.jpg" alt="">
  <canvas id="robot" width="1440" height="810"></canvas>
  <div id="brand-wash" aria-hidden="true"></div>
  <div id="brand-row" aria-label="Model providers">
    <img src="/showcase/brands/openai.svg" alt="OpenAI">
    <img src="/showcase/brands/anthropic.svg" alt="Anthropic">
    <img src="/showcase/brands/deepseek.svg" alt="DeepSeek">
    <img src="/showcase/brands/qwen.svg" alt="Qwen">
    <img src="/showcase/brands/zai.svg" alt="Z.ai">
    <img src="/showcase/brands/moonshot.svg" alt="Moonshot AI">
    <img src="/showcase/brands/google.svg" alt="Google Gemini">
  </div>
  <div id="status">Preparing model…</div>
  <script type="module">
    import * as THREE from 'three';
    import { buildRig, groundFullBody } from '/src/game/duck.js';

    const status = document.querySelector('#status');
    const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#robot'), alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(1440, 810, false);
    renderer.setClearColor(0xefefeb, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfffcf3, 0x737779, 1.35));
    const key = new THREE.DirectionalLight(0xfff1d9, 2.5);
    key.position.set(-1.7, 3.8, 2.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -1.2;
    key.shadow.camera.right = 1.2;
    key.shadow.camera.top = 1.2;
    key.shadow.camera.bottom = -1.2;
    key.shadow.bias = -0.00015;
    key.shadow.normalBias = 0.018;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd9e9ff, 0.85);
    fill.position.set(2.4, 2.2, -2.5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe9ce, 0.55);
    rim.position.set(-2.5, 1.8, -1.6);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4),
      new THREE.ShadowMaterial({ color: 0x343a3d, opacity: 0.18 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.001;
    floor.receiveShadow = true;
    scene.add(floor);

    const kinematics = await fetch('/robot/mjlab/kinematics.json').then(response => {
      if (!response.ok) throw new Error('Kinematics request failed: ' + response.status);
      return response.json();
    });
    const rig = await buildRig(kinematics);
    groundFullBody(rig, 0);
    rig.placer.rotation.y = -0.72;
    rig.placer.traverse(object => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.material) object.material.roughness = Math.max(object.material.roughness ?? 0.5, 0.36);
      }
    });
    scene.add(rig.placer);

    const bounds = new THREE.Box3().setFromObject(rig.placer);
    const center = bounds.getCenter(new THREE.Vector3());
    const height = bounds.max.y - bounds.min.y;
    const cameraHeight = height / 0.78;
    const camera = new THREE.OrthographicCamera(-cameraHeight * 500 / 810 / 2, cameraHeight * 500 / 810 / 2, cameraHeight / 2, -cameraHeight / 2, 0.01, 20);
    const target = center.clone();
    camera.position.copy(target).add(new THREE.Vector3(2.35, 1.35, 3.1));
    camera.lookAt(target);
    camera.updateProjectionMatrix();

    renderer.setScissorTest(true);
    renderer.setViewport(960, 0, 480, 810);
    renderer.setScissor(960, 0, 480, 810);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    status.remove();
    window.__coverReady = { width: 1440, height: 810, modelHeight: height, meshCount: [...rig.bodies.values()].length };
  </script>
</body>
</html>`;

const contentTypes = {
  '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
    return;
  }
  const file = assets.get(pathname);
  if (!file) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': contentTypes[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch (error) {
    if (!response.headersSent && !response.destroyed) {
      response.writeHead(500);
      response.end(error.message);
    }
  }
});

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-software-rasterizer', '--enable-features=Vulkan', '--use-gl=angle', '--use-angle=vulkan'],
});

try {
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__coverReady, { timeout: 60000 });
  } catch (error) {
    throw new Error([...errors, error.message].join('\n'));
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await page.screenshot({ path: output, type: 'jpeg', quality: 96 });
  const result = await page.evaluate(() => window.__coverReady);
  console.log(`Wrote ${output} (${result.width}×${result.height}); assembled ${result.meshCount} articulated body groups, ${result.modelHeight.toFixed(3)} m high.`);
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
