// Procedural coastal backdrop for the Gauntlet GP circuit.
//
// Everything here is decorative and must stay that way: it is never added to
// env.geometry, never enters MuJoCo, and never receives or casts a shadow that
// the referee could observe. The one hard constraint is that the sky reads as
// a continuous daylight gradient rather than a handful of bands — the previous
// 4x128 DataTexture stretched over a 180 m sphere produced visible horizontal
// stepping, so the gradient is now evaluated per canvas row at full height.

export function createGauntletBackdrop(THREE, materials) {
  const group = new THREE.Group();
  group.name = "coastal_twilight_backdrop";
  group.userData.visualOnly = true;
  group.userData.procedural = true;
  group.userData.decorationDoesNotChangePhysics = true;

  const sky = buildSkyDome(THREE);
  group.add(sky);
  group.add(buildSunGlow(THREE));
  // Daytime sky: no starfield, so the dome reads as clear daylight.
  group.add(buildCloudBands(THREE));
  const puffs = buildCloudPuffs(THREE);
  if (puffs) group.add(puffs);

  group.add(buildWater(THREE));
  group.add(buildRipples(THREE));

  const ridges = buildMountainRidges(THREE);
  for (const ridge of ridges) group.add(ridge);

  group.add(buildShoreline(THREE, materials));
  group.add(buildHazeBands(THREE));
  return group;
}

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------

// Vertical gradient: saturated blue at the zenith fading through pale blue to
// a near-white horizon, with the light band continuing below the waterline so
// the water plane meets a bright edge instead of a hard line. Drawn 2048 px
// tall so no banding is visible even with ACES tone mapping.
function buildSkyDome(THREE) {
  const material = new THREE.MeshBasicMaterial({ map: createSkyTexture(THREE), side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 48, 32), material);
  sky.name = "twilight_sky_dome";
  sky.position.y = 10;
  sky.userData.visualOnly = true;
  sky.userData.gradientStops = { zenith: 0, horizon: .5, horizonWarmth: .52, nadir: 1 };
  return sky;
}

function createSkyTexture(THREE) {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return createSkyFallbackTexture(THREE);
  }
  const width = 16;
  const height = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext?.("2d");
  if (!context) return createSkyFallbackTexture(THREE);
  const gradient = context.createLinearGradient(0, 0, 0, height);
  // Canvas row 0 is the top of the texture. On a sphere that is the zenith,
  // so the stops below run from zenith (0) to nadir (1).
  gradient.addColorStop(0, "#2f6fd4");
  gradient.addColorStop(.22, "#4a86dd");
  gradient.addColorStop(.38, "#6fa0e6");
  gradient.addColorStop(.46, "#a8c6f0");
  gradient.addColorStop(.494, "#d8e8f8");
  gradient.addColorStop(.5, "#eef4fb");
  gradient.addColorStop(.505, "#e4eef8");
  gradient.addColorStop(.512, "#cfe0f4");
  gradient.addColorStop(.53, "#b4d0ee");
  gradient.addColorStop(.6, "#9cc0ea");
  gradient.addColorStop(.78, "#84aede");
  gradient.addColorStop(1, "#74a0d4");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

// Node-side fallback: the venue test builds the whole scene without a DOM, so
// the gradient is evaluated from the same stops by hand. Width stays tiny
// because the result is only inspected for existence and colour range.
function createSkyFallbackTexture(THREE) {
  const stops = [
    [0, [47, 111, 212]], [.22, [74, 134, 221]], [.38, [111, 160, 230]], [.46, [168, 198, 240]],
    [.494, [216, 232, 248]], [.5, [238, 244, 251]], [.505, [228, 238, 248]], [.512, [207, 224, 244]],
    [.53, [180, 208, 238]], [.6, [156, 192, 234]], [.78, [132, 174, 222]], [1, [116, 160, 212]],
  ];
  const width = 16;
  const height = 2048;
  const pixels = new Uint8Array(width * height * 4);
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const amount = y / (height - 1);
    while (cursor < stops.length - 2 && amount > stops[cursor + 1][0]) cursor += 1;
    const [aAt, aColor] = stops[cursor];
    const [bAt, bColor] = stops[cursor + 1];
    const span = bAt - aAt || 1;
    const mix = Math.max(0, Math.min(1, (amount - aAt) / span));
    const color = aColor.map((channel, index) => Math.round(channel + (bColor[index] - channel) * mix));
    for (let x = 0; x < width; x += 1) pixels.set([color[0], color[1], color[2], 255], (y * width + x) * 4);
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// A bright high sun standing in for daylight. It gives the sky a focal point
// and justifies the warm-white key light the venue already uses.
function buildSunGlow(THREE) {
  const group = new THREE.Group();
  group.name = "twilight_sun_glow";
  group.userData.visualOnly = true;
  const core = new THREE.Mesh(
    new THREE.CircleGeometry(9, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: .9, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide }),
  );
  core.name = "twilight_sun_core";
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(42, 32),
    new THREE.MeshBasicMaterial({ color: 0xffeebb, transparent: true, opacity: .3, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide }),
  );
  halo.name = "twilight_sun_halo";
  group.add(core, halo);
  group.position.set(-96, 95, -142);
  group.lookAt(0, 6, 0);
  return group;
}

// Sparse, small and unlit: a starfield that only shows in the upper dome.
function buildStarField(THREE) {
  const count = 220;
  const positions = new Float32Array(count * 3);
  let seed = 90210;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let index = 0; index < count; index += 1) {
    const azimuth = random() * Math.PI * 2;
    const elevation = .34 + random() * .58;
    const radius = 168;
    positions[index * 3] = Math.cos(azimuth) * Math.cos(elevation) * radius;
    positions[index * 3 + 1] = Math.sin(elevation) * radius;
    positions[index * 3 + 2] = Math.sin(azimuth) * Math.cos(elevation) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xcfe4ff, size: .85, sizeAttenuation: true, transparent: true, opacity: .32, depthWrite: false, fog: false, toneMapped: false }));
  stars.name = "twilight_star_field";
  stars.userData.visualOnly = true;
  return stars;
}

// Two thin cirrus sheets catching the daylight. Flat planes would show
// their corners against the dome, so each band is a ring segment hugging the
// sky sphere at a fixed elevation.
function buildCloudBands(THREE) {
  const group = new THREE.Group();
  group.name = "twilight_cloud_bands";
  group.userData.visualOnly = true;
  const bands = [
    { elevation: .105, spread: .028, radius: 172, opacity: .5, color: 0xffffff },
    { elevation: .185, spread: .04, radius: 174, opacity: .34, color: 0xf4f8ff },
  ];
  for (const [index, band] of bands.entries()) {
    const geometry = new THREE.SphereGeometry(band.radius, 48, 32, 0, Math.PI * 2, Math.PI / 2 - band.elevation - band.spread, band.spread * 2);
    const cloud = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: band.color, transparent: true, opacity: band.opacity, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }));
    cloud.name = `twilight_cirrus_band_${index + 1}`;
    cloud.position.y = 10;
    cloud.userData.visualOnly = true;
    group.add(cloud);
  }
  return group;
}

// Puffy cumulus: billboard sprites with a procedural soft-blob texture,
// clustered into a handful of clouds riding high above the horizon. Sprites
// always face the camera, so no lighting or normal work is involved and the
// decoration stays invisible to the referee.
function buildCloudPuffs(THREE) {
  const texture = createCloudTexture(THREE);
  if (!texture) return null;
  const group = new THREE.Group();
  group.name = "daylight_cloud_puffs";
  group.userData.visualOnly = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: .88, depthWrite: false, fog: false, toneMapped: false });
  let seed = 20261014;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let cloud = 0; cloud < 11; cloud += 1) {
    const azimuth = (cloud / 11 + random() * .16) * Math.PI * 2;
    const elevation = .2 + random() * .34;
    const radius = 154 + random() * 12;
    const base = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth)).multiplyScalar(Math.cos(elevation) * radius);
    base.y = 8 + Math.sin(elevation) * radius;
    const puffs = 6 + Math.floor(random() * 4);
    for (let puff = 0; puff < puffs; puff += 1) {
      const sprite = new THREE.Sprite(material);
      sprite.position.set(base.x + (random() - .5) * 34, base.y + (random() - .5) * 7, base.z + (random() - .5) * 34);
      const width = 16 + random() * 20;
      sprite.scale.set(width * 1.45, width * .62, 1);
      sprite.userData.visualOnly = true;
      group.add(sprite);
    }
  }
  return group;
}

// Soft multi-blob alpha map so each sprite reads as a cloud puff instead of a
// plain quad. Drawn from a fixed seed so every run builds identical clouds.
function createCloudTexture(THREE) {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext?.("2d");
  if (!context) return null;
  let seed = 777001;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let puff = 0; puff < 30; puff += 1) {
    const x = 48 + random() * 160;
    const y = 42 + random() * 44;
    const r = 16 + random() * 30;
    const gradient = context.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, "rgba(255,255,255,.5)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

function buildWater(THREE) {
  const group = new THREE.Group();
  group.name = "coastal_water";
  group.userData.visualOnly = true;
  const material = new THREE.MeshStandardMaterial({ color: 0x2f6ea8, roughness: .16, metalness: .72, side: THREE.DoubleSide });
  for (const z of [-70, 70]) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(340, 140), material);
    water.name = z < 0 ? "water_horizon_north" : "water_horizon_south";
    water.position.set(0, -.24, z);
    water.rotation.x = -Math.PI / 2;
    water.userData.visualOnly = true;
    group.add(water);
  }
  return group;
}

function buildRipples(THREE) {
  const count = 260;
  const ripples = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xdff0fa, transparent: true, opacity: .18, depthWrite: false, fog: false, toneMapped: false }),
    count,
  );
  ripples.name = "coastal_water_ripples";
  ripples.userData.visualOnly = true;
  const transform = new THREE.Object3D();
  for (let index = 0; index < count; index += 1) {
    const column = index % 26;
    const row = Math.floor(index / 26);
    transform.position.set(-83 + column * 6.7 + Math.sin(index * 7) * 2, -.225, (row % 2 ? -1 : 1) * (30 + Math.floor(row / 2) * 8.3));
    transform.rotation.x = -Math.PI / 2;
    transform.scale.set(1.7 + (index % 5) * .75, .06, 1);
    transform.updateMatrix();
    ripples.setMatrixAt(index, transform.matrix);
  }
  return ripples;
}

// ---------------------------------------------------------------------------
// Land
// ---------------------------------------------------------------------------

// Four ridges at two depths. The near pair is darker and taller so the coast
// reads as layered headlands rather than one flat silhouette, and every ridge
// is drawn with its own profile so the skyline never repeats.
function buildMountainRidges(THREE) {
  const ridges = [];
  const layers = [
    { z: -96, offset: 0, color: 0x5c7dab, scale: 1.28, seed: 3 },
    { z: -78, offset: 11, color: 0x7397c4, scale: .92, seed: 17 },
    { z: 96, offset: 5, color: 0x5c7dab, scale: 1.22, seed: 29 },
    { z: 78, offset: -10, color: 0x7397c4, scale: .88, seed: 41 },
  ];
  for (const [index, layer] of layers.entries()) {
    const material = new THREE.MeshStandardMaterial({ color: layer.color, roughness: 1, metalness: .04, side: THREE.DoubleSide, flatShading: true });
    const mountains = new THREE.Mesh(createMountainGeometry(THREE, layer.offset, layer.scale, layer.seed), material);
    mountains.name = "distant_mountain_coast";
    mountains.userData.visualOnly = true;
    mountains.userData.ridgeLayer = index;
    mountains.userData.depth = Math.abs(layer.z);
    mountains.position.set(0, -.2, layer.z);
    if (layer.z > 0) mountains.rotation.y = Math.PI;
    mountains.receiveShadow = true;
    ridges.push(mountains);
  }
  return ridges;
}

// A ridge profile built from summed sines at incommensurate frequencies plus a
// little per-vertex jitter. The previous version used `sin(x)^2`, which is
// always positive and produced a flat-topped slab. Ridges here taper to the
// waterline at both ends so the coast does not end in a vertical cliff.
function createMountainGeometry(THREE, offset, scale = 1, seed = 0) {
  const geometry = new THREE.PlaneGeometry(220, 35, 132, 18);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  let randomSeed = (seed * 2654435761) >>> 0;
  const random = () => { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0; return randomSeed / 4294967296; };
  for (let index = 0; index < positions.count; index += 1) {
    const horizontal = positions.getX(index);
    const depth = positions.getZ(index);
    // 0 at the outer edge, 1 at the crest line facing the track.
    const ridge = Math.pow(Math.max(0, Math.sin((depth + 17.5) / 35 * Math.PI)), 1.35);
    const crest = 6.4
      + 5.2 * Math.sin(horizontal * .041 + offset)
      + 3.1 * Math.sin(horizontal * .097 + offset * 2.3)
      + 1.6 * Math.sin(horizontal * .223 + offset * 5.1);
    const taper = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(horizontal) / 110, 3.2)), .8);
    const detail = (random() - .5) * 1.15;
    positions.setY(index, Math.max(0, (crest + detail) * taper) * ridge * scale);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function buildShoreline(THREE, materials) {
  const group = new THREE.Group();
  group.name = "coastal_shoreline";
  group.userData.visualOnly = true;
  const shoreMaterial = materials?.cyanDark
    ? materials.cyanDark.clone()
    : new THREE.MeshBasicMaterial({ color: 0x2a8797 });
  shoreMaterial.emissiveIntensity = 1.35;
  for (const z of [-27, 27]) {
    const shore = new THREE.Mesh(new THREE.PlaneGeometry(68, .18), shoreMaterial);
    shore.name = "coastal_luminous_shoreline";
    shore.position.set(0, -.01, z);
    shore.rotation.x = -Math.PI / 2;
    shore.userData.visualOnly = true;
    group.add(shore);
  }
  return group;
}

// Two translucent sheets sitting just above the water on the horizon, so the
// ridge bases dissolve into haze instead of cutting a hard line.
function buildHazeBands(THREE) {
  const group = new THREE.Group();
  group.name = "coastal_haze_bands";
  group.userData.visualOnly = true;
  for (const z of [-60, 60]) {
    const haze = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 7),
      new THREE.MeshBasicMaterial({ color: 0xe8f0f8, transparent: true, opacity: .25, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide }),
    );
    haze.name = "coastal_horizon_haze";
    haze.position.set(0, 1.4, z);
    haze.userData.visualOnly = true;
    group.add(haze);
  }
  return group;
}
