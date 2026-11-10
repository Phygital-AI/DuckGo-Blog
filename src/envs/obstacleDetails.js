const assetCache = new WeakMap();

function championshipAssets(THREE) {
  if (assetCache.has(THREE)) return assetCache.get(THREE);
  const assets = {
    materials: {
      forest: new THREE.MeshStandardMaterial({ color: 0x173d2a, roughness: 0.58, metalness: 0.26 }),
      copper: new THREE.MeshStandardMaterial({ color: 0xa66a35, roughness: 0.32, metalness: 0.82 }),
      ivory: new THREE.MeshStandardMaterial({ color: 0xeadfc4, roughness: 0.68, metalness: 0.08 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x202822, roughness: 0.78, metalness: 0.12 }),
      circuitShell: new THREE.MeshStandardMaterial({ color: 0x394651, roughness: .46, metalness: .5 }),
      circuitMoving: new THREE.MeshStandardMaterial({ color: 0xd36a35, roughness: .44, metalness: .38 }),
    },
    geometries: {
      bolt: new THREE.SphereGeometry(0.012, 8, 6),
      bearing: new THREE.TorusGeometry(0.035, 0.006, 6, 12),
      boxEdge: new THREE.BoxGeometry(0.018, 0.018, 0.018),
      controller: new THREE.BoxGeometry(0.05, 0.032, 0.07),
      cylinderCollar: new THREE.CylinderGeometry(0.04, 0.04, 0.018, 12),
    },
  };
  assetCache.set(THREE, assets);
  return assets;
}

export function championshipMaterial(THREE, geometry) {
  const assets = championshipAssets(THREE);
  if (geometry.name.startsWith("circuit")) return geometry.dynamic || /rail|divider|pylon/.test(geometry.name) ? assets.materials.circuitMoving : assets.materials.circuitShell;
  if (geometry.type === "water") return assets.materials.forest;
  if (geometry.type === "marker") return assets.materials.ivory;
  if (geometry.name.includes("bar") || geometry.name.includes("hurdle") || geometry.name.includes("rail")) return assets.materials.copper;
  return assets.materials.forest;
}

function addBolt(THREE, mesh, geometry, material, position) {
  const bolt = new THREE.Mesh(geometry, material);
  bolt.name = "championship_bolt";
  bolt.position.copy(position);
  mesh.add(bolt);
}

export function addChampionshipObstacleDetails(THREE, mesh, geometry) {
  if (!geometry.collision || geometry.type === "water" || geometry.type === "marker") return;
  const assets = championshipAssets(THREE);
  const { bolt, bearing, boxEdge, controller, cylinderCollar } = assets.geometries;
  const { copper, ivory, rubber } = assets.materials;
  if (geometry.type === "cylinder") {
    const [radius, height] = geometry.size;
    const collar = new THREE.Mesh(cylinderCollar, copper);
    collar.name = "championship_collar";
    collar.scale.set(Math.max(0.55, radius / 0.04), 1, Math.max(0.55, radius / 0.04));
    collar.position.y = height * 0.5 + 0.004;
    mesh.add(collar);
    const hub = new THREE.Mesh(bearing, rubber);
    hub.name = "championship_bearing";
    hub.rotation.x = Math.PI / 2;
    hub.position.set(radius + 0.006, 0, 0);
    mesh.add(hub);
    return;
  }
  const [halfLength, halfWidth, halfHeight] = geometry.size;
  const surfaceHeight = halfHeight;
  const surfaceDepth = halfWidth;
  const edgeLocations = [
    [-halfLength * 0.82, surfaceHeight + 0.006, -surfaceDepth * 0.82],
    [halfLength * 0.82, surfaceHeight + 0.006, -surfaceDepth * 0.82],
    [-halfLength * 0.82, surfaceHeight + 0.006, surfaceDepth * 0.82],
    [halfLength * 0.82, surfaceHeight + 0.006, surfaceDepth * 0.82],
  ];
  for (const location of edgeLocations) {
    const edge = new THREE.Mesh(boxEdge, copper);
    edge.name = "championship_edge_cap";
    edge.position.set(...location);
    mesh.add(edge);
  }
  addBolt(THREE, mesh, bolt, ivory, new THREE.Vector3(halfLength * 0.72, surfaceHeight * 0.72, surfaceDepth + 0.008));
  addBolt(THREE, mesh, bolt, ivory, new THREE.Vector3(-halfLength * 0.72, surfaceHeight * 0.72, surfaceDepth + 0.008));
  if (geometry.dynamic) {
    const controlUnit = new THREE.Mesh(controller, rubber);
    controlUnit.name = "championship_controller";
    controlUnit.position.set(0, Math.min(surfaceHeight * 0.72, 0.13), surfaceDepth + 0.018);
    mesh.add(controlUnit);
  }
}
