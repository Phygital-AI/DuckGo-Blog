import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createGauntletBackdrop } from "./gauntletBackdrop.js";
import { excludeSurfaceStagePaint, surfaceStageRegions } from "../envs/circuitHardware.js";

export function createGauntletVenue(THREE, env) {
  const group = new THREE.Group();
  group.name = "gauntlet_gp_venue";
  group.userData.visualOnly = true;
  group.userData.version = "gauntlet-gp-continuous-inner-outer-guardrails";
  group.userData.decorationDoesNotChangePhysics = true;
  group.userData.obstacleGeometrySource = "env.geometry";
  group.userData.environmentAsset = null;
  group.userData.proceduralBackdrop = true;
  group.userData.routeSignage = {
    ground: { shape: "clipped-badge-with-triple-chevrons", color: "cyan", rows: [-1.42, 1.42], bendInnerOffsetFromEdge: .72 },
    rails: { arrow: "continuous-counterclockwise-course-tangent", cameraCue: "wall-arrows-indicate-forward-view", sideLabels: false, visibility: "painted-on-both-faces-of-both-walls" },
  };

  const materials = createMaterials(THREE);
  const basePath = normalizePath(env?.course?.path);
  const pathData = makePathData(basePath);
  const surfaceTexture = createAggregateTexture(THREE);
  materials.road.map = surfaceTexture.clone();
  materials.road.map.repeat.set(pathData.length / 1.7, 1);
  materials.road.map.needsUpdate = true;
  materials.road.bumpMap = materials.road.map;
  materials.road.bumpScale = .008;
  materials.rubber.map = materials.road.map;
  materials.rubber.bumpMap = materials.road.map;
  materials.rubber.bumpScale = .005;
  materials.ground.map = surfaceTexture.clone();
  materials.ground.map.repeat.set(34, 27);
  materials.ground.map.needsUpdate = true;
  applyApronConcrete(THREE, materials.ground);
  materials.shoulder.map = surfaceTexture.clone();
  materials.shoulder.map.repeat.set(18, 18);
  materials.shoulder.map.needsUpdate = true;
  const halfWidth = Number.isFinite(env?.course?.halfWidth) ? env.course.halfWidth : 3.2;
  const bounds = env?.circuit?.bounds ?? { minX: -18, maxX: 18, minY: -10, maxY: 10 };
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const batches = new Map();
  const instances = new Map();
  const paintRegions = surfaceStageRegions(env);
  const excludeGroundPaint = vertices => excludeSurfaceStagePaint(vertices, paintRegions);
  // V22: extend only floor wayfinding badges/chevrons into the immediate
  // approach/exit. Do not extend the general paint mask (labels, gates, edge
  // bands), and never apply this floor mask to the elevated rail arrows.
  const discStage = env?.fullCourse?.stages?.find(stage => stage.index === 10 && env.geometry?.some(g => g.ownerStage === 11 && g.turntable));
  const nearbyArrowRegions = discStage ? surfaceStageRegions({
    ...env, fullCourse: { ...env.fullCourse, stages: [{ ...discStage, startS: discStage.startS - .75, endS: discStage.endS + .75 }] },
  }) : [];
  const excludeNearbyFloorArrows = vertices => excludeSurfaceStagePaint(excludeGroundPaint(vertices), nearbyArrowRegions);

  function addSemanticGroup(name, userData = {}) {
    const semanticGroup = new THREE.Group();
    semanticGroup.name = name;
    semanticGroup.userData.visualOnly = true;
    Object.assign(semanticGroup.userData, userData);
    group.add(semanticGroup);
    return semanticGroup;
  }

  function addMesh(name, geometry, material, position, rotation = [0, 0, 0], castShadow = true) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.userData.visualOnly = true;
    group.add(mesh);
    return mesh;
  }

  function addBox(name, size, position, material, rotation = [0, 0, 0], castShadow = true) {
    if (['stage_gate_line', 'finish_gate_line', 'stage_direction_tick', 'painted_edge', 'route_edge_kerb_mark'].includes(name)) {
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...size));
      const a = boxGeometry.attributes.position, vertices = [];
      for (const index of boxGeometry.index.array) vertices.push(...new THREE.Vector3().fromBufferAttribute(a,index).applyMatrix4(matrix).toArray());
      const clipped = excludeGroundPaint(vertices);
      if (clipped.length !== vertices.length || clipped.some((v,i)=>v!==vertices[i])) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(clipped,3));
        geometry.computeVertexNormals();
        if (!clipped.length) return;
        const paint = addMesh(`${name}_stage_clipped`,geometry,material,[0,0,0],[0,0,0],false);
        paint.userData.surfaceStageExclusion = true;
        return;
      }
    }
    const key = `${material.uuid}:${castShadow}`;
    if (!batches.has(key)) batches.set(key, { material, castShadow, items: [] });
    batches.get(key).items.push({ name, size, position, rotation });
  }

  function addInstance(name, geometry, material, position, rotation = [0, 0, 0], scale = [1, 1, 1], castShadow = true, tint = null) {
    const key = `${name}:${material.uuid}:${castShadow}`;
    if (!instances.has(key)) instances.set(key, { name, geometry, material, castShadow, items: [] });
    instances.get(key).items.push({ position, rotation, scale, tint });
  }

  function addCheckedBox(name, size, position, material, rotation = [0, 0, 0], castShadow = true) {
    if (!footprintClear(pathData, position[0], -position[2], size, halfWidth + .06)) return false;
    addBox(name, size, position, material, rotation, castShadow);
    return true;
  }

  function makeRibbon(name, width, height, material) {
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let index = 0; index < pathData.points.length; index += 1) {
      const point = pathData.points[index];
      const previous = pathData.points[(index + pathData.points.length - 1) % pathData.points.length];
      const next = pathData.points[(index + 1) % pathData.points.length];
      const normal = miterNormal(previous, point, next);
      positions.push(point[0] + normal[0] * width, height, -(point[1] + normal[1] * width));
      positions.push(point[0] - normal[0] * width, height, -(point[1] - normal[1] * width));
      uvs.push(pathData.s[index] / pathData.length, 0, pathData.s[index] / pathData.length, 1);
      const nextIndex = (index + 1) % pathData.points.length;
      indices.push(index * 2, nextIndex * 2, index * 2 + 1, index * 2 + 1, nextIndex * 2, nextIndex * 2 + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return addMesh(name, geometry, material, [0, 0, 0], [0, 0, 0], false);
  }

  function makeBoundaryBand(name, side) {
    const positions = [];
    const indices = [];
    for (let index = 0; index < pathData.points.length; index += 1) {
      const point = pathData.points[index];
      const previous = pathData.points[(index + pathData.points.length - 1) % pathData.points.length];
      const next = pathData.points[(index + 1) % pathData.points.length];
      const normal = miterNormal(previous, point, next);
      for (const offset of [halfWidth - .12, halfWidth - .035]) {
        positions.push(point[0] + normal[0] * offset * side, .017, -(point[1] + normal[1] * offset * side));
      }
      const following = (index + 1) % pathData.points.length;
      indices.push(index * 2, following * 2, index * 2 + 1, index * 2 + 1, following * 2, following * 2 + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(excludeGroundPaint(indices.flatMap(i => positions.slice(i*3,i*3+3))), 3));
    geometry.computeVertexNormals();
    const band = addMesh(name, geometry, materials.boundary, [0, 0, 0], [0, 0, 0], false);
    band.userData.surfaceStageExclusion = true;
    return band;
  }

  function makeRouteArrows(name, spacing = 3.0) {
    const basePositions = [];
    const iconPositions = [];
    const bendInnerSamples = [];
    const worldPoint = (pose, laneOffset, along, across, height) => [
      pose.point[0] + pose.tangent[0] * along + pose.normal[0] * (laneOffset + across),
      height,
      -(pose.point[1] + pose.tangent[1] * along + pose.normal[1] * (laneOffset + across)),
    ];
    const addPolygon = (target, pose, laneOffset, vertices, height) => {
      const points = vertices.map(([along, across]) => worldPoint(pose, laneOffset, along, across, height));
      const center = points.reduce((sum, point) => sum.map((value, axis) => value + point[axis] / points.length), [0, 0, 0]);
      for (let index = 0; index < points.length; index += 1) target.push(...center, ...points[index], ...points[(index + 1) % points.length]);
    };
    const addStroke = (target, pose, laneOffset, from, to, width, height) => {
      const dx = to[0] - from[0];
      const dy = to[1] - from[1];
      const length = Math.hypot(dx, dy) || 1;
      const ox = -dy / length * width / 2;
      const oy = dx / length * width / 2;
      addPolygon(target, pose, laneOffset, [
        [from[0] + ox, from[1] + oy], [to[0] + ox, to[1] + oy],
        [to[0] - ox, to[1] - oy], [from[0] - ox, from[1] - oy],
      ], height);
    };
    const plaque = [[-.88, -.36], [.36, -.36], [.74, 0], [.36, .36], [-.88, .36], [-1, 0]];
    // The plaque runs from -1 to +.74 along the course at scale 1, which is
    // what the badge-overlap guards below measure against.
    const badgeLength = .74 - -1;
    const addBadge = (pose, laneOffset, scale = 1) => {
      const scaled = ([along, across]) => [along * scale, across * scale];
      addPolygon(basePositions, pose, laneOffset, plaque.map(scaled), .024);
      for (let edge = 0; edge < plaque.length; edge += 1) {
        addStroke(iconPositions, pose, laneOffset, scaled(plaque[edge]), scaled(plaque[(edge + 1) % plaque.length]), .022, .031);
      }
      addStroke(iconPositions, pose, laneOffset, scaled([-.72, 0]), scaled([-.49, 0]), .07 * scale, .032);
      for (const head of [-.31, -.02, .27]) {
        addStroke(iconPositions, pose, laneOffset, scaled([head - .16, .19]), scaled([head + .10, 0]), .072 * scale, .032);
        addStroke(iconPositions, pose, laneOffset, scaled([head + .10, 0]), scaled([head - .16, -.19]), .072 * scale, .032);
      }
    };
    // The loop is divided into a whole number of badges rather than stepped by
    // a fixed spacing until the length runs out. Stepping left the centreline's
    // remainder stranded between the last badge and the first: 103.41 m over a
    // 3 m pitch leaves 1.41 m, which is shorter than the 1.74 m badge, so the
    // two collided across the start/finish line — the one place on the circuit
    // where a gap shorter than the pitch is guaranteed, and it sits on the
    // starting grid. Dividing the loop evenly makes every gap the same and
    // keeps it above the badge length.
    const laneCount = Math.max(1, Math.round(pathData.length / spacing));
    const laneStep = pathData.length / laneCount;
    for (let index = 0; index < laneCount; index += 1) {
      const pose = coursePointAtS(1.2 + index * laneStep);
      // Two low-profile wayfinding decals sit well inside the white edge
      // lines: a clipped dark badge, fine cyan perimeter and three forward
      // chevrons. This reads as a designed route marker, not a loose triangle.
      for (const laneOffset of [-1.42, 1.42]) {
        addBadge(pose, laneOffset);
      }
    }
    // CCW bends have the infield on the left. Put a separate, tighter row
    // near that inner edge, but keep the entire badge inside the white line.
    //
    // This row is laid out by arc length along the inner edge rather than by a
    // fixed pitch along the centreline. On a bend the inner edge is shorter by
    // (R - innerOffset)/R, so a 1.5 m centreline pitch became roughly 0.76 m
    // there against a 0.96 m badge and consecutive corner badges overlapped by
    // about a quarter of their length. Scanning finely and placing each badge a
    // full badge length past the previous one keeps the row dense and evenly
    // spaced at every radius, and the sample list stays monotonic along the
    // course, which is what the venue contract reads it for.
    const innerOffset = halfWidth - .72;
    const bendBadgeScale = .55;
    const bendBadgeLength = badgeLength * bendBadgeScale;
    let lastBendPoint = null;
    for (let distance = .45; distance < pathData.length; distance += .05) {
      const pose = coursePointAtS(distance);
      const before = coursePointAtS(distance - .35);
      const after = coursePointAtS(distance + .35);
      const turn = Math.atan2(before.tangent[0] * after.tangent[1] - before.tangent[1] * after.tangent[0],
        before.tangent[0] * after.tangent[0] + before.tangent[1] * after.tangent[1]);
      // Leaving a bend resets the run, so one corner's last badge cannot
      // suppress the next corner's first.
      if (turn < .055) { lastBendPoint = null; continue; }
      const painted = worldPoint(pose, innerOffset, 0, 0, 0);
      if (lastBendPoint && Math.hypot(painted[0] - lastBendPoint[0], painted[2] - lastBendPoint[2]) < bendBadgeLength) continue;
      addBadge(pose, innerOffset, bendBadgeScale);
      lastBendPoint = painted;
      bendInnerSamples.push({ distance, point: worldPoint(pose, innerOffset, 0, 0, .032), tangent: [...pose.tangent] });
    }
    const markingGroup = new THREE.Group();
    markingGroup.name = name;
    const baseGeometry = new THREE.BufferGeometry();
    baseGeometry.setAttribute("position", new THREE.Float32BufferAttribute(excludeNearbyFloorArrows(basePositions), 3));
    baseGeometry.computeVertexNormals();
    const base = new THREE.Mesh(baseGeometry, materials.routeMarkerBase);
    base.name = `${name}_badge`; base.userData.visualOnly = true; base.castShadow = false;
    const iconGeometry = new THREE.BufferGeometry();
    iconGeometry.setAttribute("position", new THREE.Float32BufferAttribute(excludeNearbyFloorArrows(iconPositions), 3));
    iconGeometry.computeVertexNormals();
    const icon = new THREE.Mesh(iconGeometry, materials.routeGuide);
    icon.name = `${name}_chevrons`; icon.userData.visualOnly = true; icon.castShadow = false;
    markingGroup.add(base, icon);
    group.add(markingGroup);
    const arrows = markingGroup;
    arrows.userData.marking = "clipped-badge-with-forward-chevrons";
    arrows.userData.lateralRows = [-1.42, 1.42];
    arrows.userData.bendInnerRow = { offset: innerOffset, spacing: 1.5, samples: bendInnerSamples };
    return arrows;
  }

  function makeCanvasLabelMaterial(text, detail, color = "#e8fbff", detailColor = "#ff713b") {
    const material = materials.label.clone();
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const canvas = document.createElement("canvas");
      canvas.width = 768;
      canvas.height = 256;
      const context = canvas.getContext?.("2d");
      if (context) {
        context.fillStyle = "#071525";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = color;
        context.textBaseline = "middle";
        context.font = "700 112px Arial, sans-serif";
        context.fillText(text, 38, 100, canvas.width - 76);
        context.fillStyle = detailColor;
        context.font = "600 32px Arial, sans-serif";
        context.fillText(detail, 42, 190, canvas.width - 84);
        const texture = new THREE.CanvasTexture(canvas);
        if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        material.map = texture;
        material.color.set(0xffffff);
      }
    }
    return material;
  }

  function addCanvasLabel(name, text, detail, width, height, position, rotation = [-Math.PI / 2, 0, 0], color = "#e8fbff", detailColor = "#ff713b") {
    const material = makeCanvasLabelMaterial(text, detail, color, detailColor);
    return addMesh(name, new THREE.PlaneGeometry(width, height), material, position, rotation, false);
  }

  function coursePointAtS(value) {
    const target = ((value % pathData.length) + pathData.length) % pathData.length;
    let segment = pathData.segments.length - 1;
    for (let index = 0; index < pathData.segments.length; index += 1) {
      if (target <= pathData.segments[index].endS) {
        segment = index;
        break;
      }
    }
    const edge = pathData.segments[segment];
    const span = edge.length || 1;
    const amount = Math.max(0, Math.min(1, (target - edge.startS) / span));
    const x = edge.a[0] + (edge.b[0] - edge.a[0]) * amount;
    const y = edge.a[1] + (edge.b[1] - edge.a[1]) * amount;
    const tangent = normalize([edge.b[0] - edge.a[0], edge.b[1] - edge.a[1]]);
    return { point: [x, y], tangent, normal: [-tangent[1], tangent[0]], yaw: Math.atan2(tangent[1], tangent[0]) };
  }

  function addGate(name, atS, label, detail, index, finish = false) {
    const pose = coursePointAtS(atS);
    const lateral = halfWidth + .34;
    const pylonHeight = finish ? 1.08 : .84;
    const stageGate = addSemanticGroup(name, { stageIndex: index, atS, gate: true });
    const sidePositions = [];
    for (const side of [-1, 1]) {
      const x = pose.point[0] + pose.normal[0] * lateral * side;
      const y = pose.point[1] + pose.normal[1] * lateral * side;
      sidePositions.push([x, y]);
      addBox("gate_pylon", [.16, pylonHeight, .16], [x, pylonHeight / 2, -y], materials.navy);
      addBox("gate_pylon_light", [.18, .07, .18], [x, .62, -y], finish ? materials.orange : materials.cyan, [0, 0, 0], false);
    }
    addBox("gate_header_side", [.08, .1, .42], [sidePositions[0][0], pylonHeight + .05, -sidePositions[0][1]], materials.cyan, [0, 0, 0], false);
    addBox("gate_header_side", [.08, .1, .42], [sidePositions[1][0], pylonHeight + .05, -sidePositions[1][1]], materials.cyan, [0, 0, 0], false);
    addBox(finish ? "finish_gate_line" : "stage_gate_line", [.06, .014, halfWidth * 2], [pose.point[0], .014, -pose.point[1]], finish ? materials.orange : materials.cyan, [0, pose.yaw, 0], false);
    addCanvasLabel(`${name}_label`, label, detail, .86, .3, [pose.point[0] + pose.normal[0] * (halfWidth + .12), .026, -(pose.point[1] + pose.normal[1] * (halfWidth + .12))]);
    return stageGate;
  }

  function addPaintedRailDirections(spacing = .44) {
    let arrowCountPerWall = 0;
    const collisionWallHalfDepth = env?.geometry?.find((item) => item.boundaryRail)?.size?.[1] ?? .10;
    const wallFaceClearance = .025;
    const wallSegments = (env?.geometry ?? []).filter((item) => item.boundaryRail).map((item) => {
      const yaw = item.yaw ?? 0;
      return {
        x: item.pos[0], y: item.pos[1], tangent: [Math.cos(yaw), Math.sin(yaw)], normal: [-Math.sin(yaw), Math.cos(yaw)],
        halfLength: item.size[0], halfDepth: item.size[1], side: item.name.includes("_left_") ? 1 : -1,
        distance: item.circuitS,
      };
    });
    // A bend is built from overlapping collision boxes, not a smooth cylinder.
    // Raycast in the road plane to their nearest exposed face; a decal placed
    // at a fixed radius disappears behind the overlapping boxes in the infield.
    const laneWallDistance = (pose, side, distance) => {
      const direction = pose.normal.map((component) => component * side);
      const wrappedDistance = ((distance % pathData.length) + pathData.length) % pathData.length;
      let nearest = Infinity;
      for (const wall of wallSegments) {
        if (wall.side !== side) continue;
        const gap = Math.abs(wall.distance - wrappedDistance);
        if (Math.min(gap, pathData.length - gap) > 2.4) continue;
        const delta = [pose.point[0] - wall.x, pose.point[1] - wall.y];
        const local = [delta[0] * wall.tangent[0] + delta[1] * wall.tangent[1], delta[0] * wall.normal[0] + delta[1] * wall.normal[1]];
        const ray = [direction[0] * wall.tangent[0] + direction[1] * wall.tangent[1], direction[0] * wall.normal[0] + direction[1] * wall.normal[1]];
        let entry = 0;
        let exit = Infinity;
        for (let axis = 0; axis < 2; axis += 1) {
          const bound = axis === 0 ? wall.halfLength : wall.halfDepth;
          if (Math.abs(ray[axis]) < 1e-8) {
            if (Math.abs(local[axis]) > bound) { exit = -1; break; }
          } else {
            const near = (-bound - local[axis]) / ray[axis];
            const far = (bound - local[axis]) / ray[axis];
            entry = Math.max(entry, Math.min(near, far));
            exit = Math.min(exit, Math.max(near, far));
          }
        }
        if (exit >= entry && entry > 0) nearest = Math.min(nearest, entry);
      }
      return Number.isFinite(nearest) ? nearest : halfWidth - .04 - collisionWallHalfDepth;
    };
    for (const [side, face] of [[-1, "lane"], [-1, "outside"], [1, "lane"], [1, "outside"]]) {
      const vertices = [];
      // Tone-mapped on purpose. These chevrons previously bypassed ACES with
      // toneMapped:false, so 200+ arrows per wall rendered as full-brightness
      // neon and read as a debug overlay rather than paint on a barrier. The
      // count and clearance are fixed by the venue contract; only the way they
      // sit in the exposure changes.
      const material = new THREE.MeshBasicMaterial({
        color: side > 0 ? 0x3fbfd0 : 0xd08a4a,
        side: THREE.DoubleSide,
        toneMapped: true,
      });
      // Paint the actual collision wall faces, including the outward face
      // visible to the spectator camera. Both sets follow the same course.
      const lateral = Math.max(.1, halfWidth - .04 + (face === "lane" ? -1 : 1) * (collisionWallHalfDepth + wallFaceClearance));
      const addChevronStroke = (worldPoint, from, to, thickness = .09) => {
        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        const length = Math.hypot(dx, dy) || 1;
        const ox = -dy / length * thickness / 2;
        const oy = dx / length * thickness / 2;
        const points = [
          worldPoint(from[0] + ox, .45 + from[1] + oy),
          worldPoint(to[0] + ox, .45 + to[1] + oy),
          worldPoint(to[0] - ox, .45 + to[1] - oy),
          worldPoint(from[0] - ox, .45 + from[1] - oy),
        ];
        const center = points.reduce((sum, point) => sum.map((value, axis) => value + point[axis] / points.length), [0, 0, 0]);
        for (let index = 0; index < points.length; index += 1) vertices.push(...center, ...points[index], ...points[(index + 1) % points.length]);
      };

      let firstWitness = null;
      let bendWitness = null;
      let arrowCount = 0;
      // Repeating chevrons are painted directly on the lane-facing rail face.
      // Their tips are constructed along the path tangent, so both walls turn
      // with the track and keep pointing counterclockwise through every bend.
      for (let distance = .35; distance < pathData.length;) {
        const pose = coursePointAtS(distance);
        const before = coursePointAtS(distance - .35);
        const after = coursePointAtS(distance + .35);
        const bend = before.tangent[0] * after.tangent[1] - before.tangent[1] * after.tangent[0] > .055;
        // Keep each chevron planar. Sampling a separate wall box at every
        // vertex pinches the symbol wherever two bend segments overlap.
        const across = face === "lane"
          ? Math.min(...[-.27, 0, .27].map((along) => laneWallDistance(coursePointAtS(distance + along), side, distance + along))) - wallFaceClearance
          : lateral;
        const worldPoint = (along, height) => [
          pose.point[0] + pose.tangent[0] * along + pose.normal[0] * across * side,
          height,
          -(pose.point[1] + pose.tangent[1] * along + pose.normal[1] * across * side),
        ];
        const tip = [.21, 0];
        const upper = [-.21, .20];
        const lower = [-.21, -.20];
        addChevronStroke(worldPoint, upper, tip);
        addChevronStroke(worldPoint, tip, lower);
        if (!firstWitness) {
          firstWitness = { tail: worldPoint(-.21, .45), tip: worldPoint(tip[0], .45) };
        }
        if (!bendWitness && face === "lane" && distance > 14 && distance < 19) {
          bendWitness = { tail: worldPoint(-.21, .45), tip: worldPoint(tip[0], .45), distance };
        }
        arrowCount += 1;
        distance += bend ? .75 : spacing;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geometry.computeVertexNormals();
      const arrows = new THREE.Mesh(geometry, material);
      arrows.name = `painted_rail_forward_${face === "lane" ? "inside" : "outside"}-${side > 0 ? "a" : "b"}`;
      arrows.userData.visualOnly = true;
      arrows.userData.routeDirection = "counterclockwise-course-tangent";
      arrows.userData.paintMethod = "direct-wall-chevron-mesh";
      arrows.userData.wallFace = face;
      arrows.userData.arrowSpacing = spacing;
      arrows.userData.bendArrowSpacing = .75;
      arrows.userData.chevronThickness = .09;
      arrows.userData.chevronHeight = .40;
      arrows.userData.arrowCount = arrowCount;
      arrows.userData.wallHeight = .45;
      arrows.userData.wallFaceClearance = wallFaceClearance;
      arrows.userData.firstArrowWitness = firstWitness;
      arrows.userData.bendArrowWitness = bendWitness;
      group.add(arrows);
      arrowCountPerWall = arrowCount;
    }
    group.userData.routeSignage.rails.arrowCountPerWall = arrowCountPerWall;
  }

  function addCourseGuardrails() {
    const sampleSpacing = .62;
    const lateral = halfWidth - .04;
    for (let distance = 0; distance < pathData.length; distance += sampleSpacing) {
      const nextDistance = Math.min(distance + sampleSpacing, pathData.length);
      const a = coursePointAtS(distance);
      const b = coursePointAtS(nextDistance);
      const dx = b.point[0] - a.point[0];
      const dy = b.point[1] - a.point[1];
      const length = Math.hypot(dx, dy);
      if (length < .02) continue;
      const yaw = Math.atan2(dy, dx);
      const middle = [(a.point[0] + b.point[0]) / 2, (a.point[1] + b.point[1]) / 2];
      for (const side of [-1, 1]) {
        const x = middle[0] + a.normal[0] * lateral * side;
        const y = middle[1] + a.normal[1] * lateral * side;
        addBox("course_guardrail_lower", [length + .08, .12, .12], [x, .20, -y], materials.steel, [0, yaw, 0]);
        addBox("course_guardrail_upper", [length + .08, .10, .10], [x, .57, -y], side > 0 ? materials.cyan : materials.orange, [0, yaw, 0], false);
      }
    }
    for (let distance = 0; distance < pathData.length; distance += 1.45) {
      const pose = coursePointAtS(distance);
      for (const side of [-1, 1]) {
        const x = pose.point[0] + pose.normal[0] * lateral * side;
        const y = pose.point[1] + pose.normal[1] * lateral * side;
        addBox("course_guardrail_post", [.11, .72, .11], [x, .36, -y], materials.navy);
        addBox("course_guardrail_post_cap", [.14, .05, .14], [x, .74, -y], side > 0 ? materials.cyan : materials.orange, [0, 0, 0], false);
      }
    }
  }

  group.add(createGauntletBackdrop(THREE, materials));
  addMesh("venue_ground", new THREE.BoxGeometry(68, .16, 54), materials.ground, [0, -.13, 0], [0, 0, 0], false);
  const shoulder = makeRibbon("gauntlet_wide_shoulders", halfWidth + .38, -.006, materials.shoulder);
  shoulder.userData.width = halfWidth + .38;
  const ribbon = makeRibbon("gauntlet_course_ribbon", halfWidth, 0, materials.road);
  ribbon.userData.width = halfWidth;
  ribbon.userData.topY = 0;
  makeRibbon("gauntlet_racing_rubber", Math.max(.58, halfWidth - .16), .005, materials.rubber);
  // The first bend was visually ambiguous in agent RGB: track and off-track
  // concrete had nearly identical luminance. These continuous, visual-only
  // bands follow the exact public road edge without moving any collision body.
  makeBoundaryBand("gauntlet_left_boundary_band", 1);
  makeBoundaryBand("gauntlet_right_boundary_band", -1);
  addCourseGuardrails();
  addPaintedRailDirections();
  makeRouteArrows("gauntlet_forward_route_arrows");

  const curbGeometry = new THREE.BoxGeometry(.54, .06, .24);
  const grateGeometry = new THREE.BoxGeometry(.44, .014, .15);
  for (let index = 0; index < pathData.points.length; index += 2) {
    const point = pathData.points[index];
    const next = pathData.points[(index + 1) % pathData.points.length];
    const tangent = normalize([next[0] - point[0], next[1] - point[1]]);
    const normal = [-tangent[1], tangent[0]];
    const yaw = Math.atan2(tangent[1], tangent[0]);
    const distance = pathData.s[index];
    const curbMaterial = Math.floor(distance / .54) % 2 === 0 ? materials.white : materials.orange;
    for (const side of [-1, 1]) {
      const curbX = point[0] + normal[0] * (halfWidth + .12) * side;
      const curbY = point[1] + normal[1] * (halfWidth + .12) * side;
      addInstance("kerb", curbGeometry, curbMaterial, [curbX, .035, -curbY], [0, yaw, 0]);
      addBox("painted_edge", [.6, .005, .026], [point[0] + normal[0] * (halfWidth - .055) * side, .009, -(point[1] + normal[1] * (halfWidth - .055) * side)], materials.white, [0, yaw, 0], false);
      if (index % 6 === 0) {
        const grateX = point[0] + normal[0] * (halfWidth + .31) * side;
        const grateY = point[1] + normal[1] * (halfWidth + .31) * side;
        addInstance("drainage_grate", grateGeometry, materials.grate, [grateX, .01, -grateY], [0, yaw, 0], [1, 1, 1], false);
      }
    }
  }

  // High-contrast alternating kerb marks sit just inside the legal track edge.
  // They are visual-only; the referee boundary and MuJoCo collision geometry
  // remain unchanged. This gives a first-person observer a continuous cue at turns.
  for (let sample = 0, distance = .22; distance < pathData.length; sample += 1, distance += .46) {
    const pose = coursePointAtS(distance);
    const material = sample % 2 === 0 ? materials.routeEdge : materials.white;
    for (const side of [-1, 1]) {
      const offset = halfWidth - .18;
      const x = pose.point[0] + pose.normal[0] * offset * side;
      const y = pose.point[1] + pose.normal[1] * offset * side;
      addBox("route_edge_kerb_mark", [.42, .014, .15], [x, .024, -y], material, [0, pose.yaw, 0], false);
    }
  }

  const startS = Number.isFinite(env?.fullCourse?.stages?.[0]?.startS) ? env.fullCourse.stages[0].startS : 0;
  const stageEntries = env?.fullCourse?.stages?.length ? env.fullCourse.stages : Array.from({ length: 16 }, (_, index) => ({
    index,
    id: `stage-${String(index + 1).padStart(2, "0")}`,
    title: `GAUNTLET ${String(index + 1).padStart(2, "0")}`,
    shortTitle: `G${String(index + 1).padStart(2, "0")}`,
    startS: pathData.length * index / 16,
    endS: pathData.length * (index + 1) / 16,
  }));
  for (const [index, stage] of stageEntries.entries()) {
    const stageStart = Number.isFinite(stage.startS) ? stage.startS : pathData.length * index / stageEntries.length;
    const stageEnd = Number.isFinite(stage.endS) ? stage.endS : pathData.length * (index + 1) / stageEntries.length;
    const startPose = coursePointAtS(stageStart);
    const endPose = coursePointAtS(stageEnd);
    const stageName = `stage_gate_${String(index + 1).padStart(2, "0")}`;
    addGate(stageName, stageStart, String(index + 1).padStart(2, "0"), stage.shortTitle ?? stage.title ?? `GAUNTLET ${index + 1}`, index);
    addSemanticGroup(`${stageName}_finish`, { stageIndex: index, atS: stageEnd, checkpoint: stage.checkpoint });
    addCanvasLabel(`stage_${String(index + 1).padStart(2, "0")}_marker`, String(index + 1).padStart(2, "0"), stage.shortTitle ?? stage.title ?? "GAUNTLET", .54, .27, [startPose.point[0] + startPose.normal[0] * (halfWidth + .23), .025, -(startPose.point[1] + startPose.normal[1] * (halfWidth + .23))]);
    addBox("stage_direction_tick", [.03, .01, .52], [endPose.point[0], .016, -endPose.point[1]], materials.orange, [0, endPose.yaw, 0], false);
  }

  const startPoint = env?.spawn ? [env.spawn.x, env.spawn.y] : coursePointAtS(startS).point;
  const goalPoint = env?.goal ? [env.goal.x, env.goal.y] : coursePointAtS(0).point;
  const startPose = nearestPose(pathData, startPoint);
  const goalPose = nearestPose(pathData, goalPoint);
  const startCoursePose = coursePointAtS(pathData.s[startPose.index] ?? startS);
  addSemanticGroup("race_start_gate", { atS: pathData.s[startPose.index] ?? 0 });
  addGate("race_finish_gate", pathData.s[goalPose.index] ?? pathData.length, "START / FINISH", "GAUNTLET GP  /  LAP 01", -1, true);
  buildStartingGrid(env?.circuit?.grid?.slots, startCoursePose, halfWidth, addBox, addCanvasLabel, materials);
  buildStartGantry(startCoursePose, halfWidth, addBox, addCanvasLabel, materials);
  addCanvasLabel("course_identity", "GAUNTLET GP", "MICRODUCK  /  16 STAGE COASTAL CIRCUIT", 5.2, .8, [-14.8, .026, 20.7], [-Math.PI / 2, 0, 0], "#e8fbff", "#ff713b");

  for (const zone of ["central_mechanical_paddock", "north_pit_building", "south_grandstand", "east_timing_tower"]) addSemanticGroup(zone);
  addSemanticGroup("landscaped_infield", { visualOnly: true });
  addSemanticGroup("pit_screen_line", { visualOnly: true });
  addSemanticGroup("flag_line", { visualOnly: true });
  buildSafetyBarriers(addCheckedBox, addBox, materials, bounds, halfWidth);
  buildGrandstand(addCheckedBox, addBox, materials);
  buildTimingTower(addCheckedBox, addBox, materials);
  buildPitBuilding(addCheckedBox, addBox, materials);
  buildPaddock(addCheckedBox, addBox, addInstance, materials, THREE);
  const treeTrunk = new THREE.CylinderGeometry(.07, .105, 1.65, 7);
  const treeCrown = createCanopyGeometry(THREE, .64);
  const canopyCap = createCanopyGeometry(THREE, .34);
  const landscapePositions = [];
  for (const side of [-1, 1]) {
    addBox("infield_garden_bed", [16, .13, .92], [0, .065, side * 4.9], materials.concrete);
    addBox("infield_garden_soil", [15.8, .04, .75], [0, .15, side * 4.9], materials.green, [0, 0, 0], false);
    for (let index = 0; index < 9; index++) landscapePositions.push([-7.2 + index * 1.8, side * 4.9]);
    for (let index = 0; index < 10; index++) landscapePositions.push([side * 29.5, -20 + index * 4.3]);
  }
  landscapePositions.forEach(([horizontal, depth], index) => {
    const scale = .85 + (index % 4) * .08;
    addInstance("landscape_trunks", treeTrunk, materials.bark, [horizontal, .825, depth]);
    // Three canopy tones cycling down each row. One flat teal made the rows
    // read as cloned sprites; the variation costs no extra draw call because
    // it rides on the existing instance colour buffer.
    const tone = index % 3 === 0 ? CANOPY_DARK : index % 3 === 1 ? CANOPY_MID : CANOPY_LIGHT;
    addInstance("landscape_crowns", treeCrown, materials.foliage, [horizontal, 1.72, depth], [0, index * .6, 0], [scale, scale * 1.25, scale], true, tone);
    addInstance("landscape_canopy_caps", canopyCap, materials.foliage, [horizontal + .12, 2.12, depth - .1], [0, index * 1.3, .2], [scale, scale * .9, scale], true, tone);
    addBox("landscape_uplight", [.12, .07, .12], [horizontal + .25, .035, depth + .23], materials.cyan, [0, 0, 0], false);
  });
  buildFlags(addBox, materials);
  for (let bay = 0; bay < 4; bay++) {
    const centerX = -4.5 + bay * 3;
    addCanvasLabel(`paddock_bay_${bay}`, `BAY 0${bay + 1}`, "SERVICE / NOT A LIVE RANKING", 2, .4, [centerX, .33, 2.25]);
    for (const side of [-1, 1]) addBox("service_bay_line", [.026, .006, 2.2], [centerX + side * 1.22, .29, 1.2], materials.cyan, [0, 0, 0], false);
  }
  addCanvasLabel("pit_building_identity", "MICRODUCK", "GAUNTLET GP  /  ENGINEERING PADDOCK", 7.8, .65, [2, 3.1, -14.82], [0, 0, 0]);
  addCanvasLabel("timing_tower_identity", "CIRCUIT 01", "16 STAGES  /  103.4 M", 2.2, .68, [25.1, 3.8, 4.65], [0, 0, 0]);
  const grandstandSeatRows = 4;
  const grandstandSeatCount = 48;
  const grandstandSeatPositions = [];
  for (let seat = 0; seat < grandstandSeatCount; seat++) for (let tier = 0; tier < grandstandSeatRows; tier++) {
    const seatY = .82 + tier * .34;
    const seatZ = 15.42 + tier * .78;
    const seatX = -13.2 + seat * .56;
    grandstandSeatPositions.push([seatX, seatY, seatZ]);
    const material = (Math.floor(seat / 8) + tier) % 2 ? materials.orange : materials.navy;
    addBox("grandstand_seat", [.46, .07, .26], [seatX, seatY, seatZ], material, [0, 0, 0], false);
    addBox("grandstand_backrest", [.46, .32, .06], [seatX, seatY + .2, seatZ + .18], materials.seatback, [0, 0, 0], false);
  }
  const grandstandLife = createGrandstandLife(THREE, group, grandstandSeatPositions, materials);
  group.userData.grandstand = {
    seatRows: grandstandSeatRows,
    seatsPerRow: grandstandSeatCount,
    nearTrackZ: 15.42,
    rowDepthStep: .78,
    rowHeightStep: .34,
    backrestSide: "away-from-track",
  };

  for (const [key, batch] of batches) {
    const instanced = new THREE.InstancedMesh(boxGeometry, batch.material, batch.items.length);
    instanced.name = `gauntlet_box_batch_${key.slice(0, 8)}`;
    instanced.userData.visualOnly = true;
    instanced.userData.elements = batch.items.map((item) => item.name);
    const matrix = new THREE.Object3D();
    for (const [index, item] of batch.items.entries()) {
      matrix.position.set(...item.position);
      matrix.rotation.set(...item.rotation);
      matrix.scale.set(...item.size);
      matrix.updateMatrix();
      instanced.setMatrixAt(index, matrix.matrix);
    }
    instanced.castShadow = batch.castShadow;
    instanced.receiveShadow = true;
    group.add(instanced);
  }
  for (const batch of instances.values()) {
    const instanced = new THREE.InstancedMesh(batch.geometry, batch.material, batch.items.length);
    instanced.name = `gauntlet_${batch.name}_instances`;
    instanced.userData.visualOnly = true;
    const matrix = new THREE.Object3D();
    const tintColor = new THREE.Color();
    let tinted = false;
    for (const [index, item] of batch.items.entries()) {
      matrix.position.set(...item.position);
      matrix.rotation.set(...item.rotation);
      matrix.scale.set(...item.scale);
      matrix.updateMatrix();
      instanced.setMatrixAt(index, matrix.matrix);
      if (item.tint != null) {
        instanced.setColorAt(index, tintColor.set(item.tint));
        tinted = true;
      }
    }
    if (tinted) instanced.instanceColor.needsUpdate = true;
    instanced.castShadow = batch.castShadow;
    instanced.receiveShadow = true;
    group.add(instanced);
  }

  group.userData.bounds = { ...bounds, minX: bounds.minX, maxX: bounds.maxX, minY: bounds.minY, maxY: bounds.maxY };
  group.userData.course = { length: pathData.length, halfWidth, pointCount: pathData.points.length, topY: 0 };
  group.userData.architectureZones = ["central_mechanical_paddock", "north_pit_building", "south_grandstand", "east_timing_tower"];
  group.userData.gridSlotIds = Array.isArray(env?.circuit?.grid?.slots) ? env.circuit.grid.slots.map((slot) => slot.id) : [];
  group.userData.update = grandstandLife.update;
  group.userData.celebrate = grandstandLife.celebrate;
  return group;
}

// Relief for the apron, borrowed from the CC0 Poly Haven set the championship
// arena already ships (see app/public/assets/venue/source-manifest.json).
//
// Only the normal and roughness maps are applied — never the diffuse. The
// venue test pins the apron's lightness against the track via material.color,
// so the surface gets its poured-concrete character from lighting response
// rather than from a colour the test would then have to track. Skipped when
// there is no DOM, which is how the venue test builds the scene.
function applyApronConcrete(THREE, material) {
  if (typeof document === "undefined" || typeof THREE.TextureLoader !== "function") return;
  const loader = new THREE.TextureLoader();
  const load = (filename, repeats) => {
    const texture = loader.load(`./assets/venue/${filename}`, undefined, undefined, () => {});
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeats);
    texture.anisotropy = 4;
    return texture;
  };
  material.normalMap = load("concrete-normal.jpg", [34, 27]);
  material.normalScale.set(.28, .28);
  material.roughnessMap = load("concrete-roughness.jpg", [34, 27]);
}

function createMaterials(THREE) {
  return {
    // Deliberately darker than the old slab: at 0x8799a3 the apron was the
    // brightest surface in frame and the track read as a trench cut into it.
    // This keeps the test's ground-vs-ribbon lightness gap above .2 while
    // letting the kerbs, paint and guardrails carry the contrast instead.
    ground: new THREE.MeshStandardMaterial({ color: 0x8296a1, roughness: .98, metalness: .02 }),
    shoulder: new THREE.MeshStandardMaterial({ color: 0x1d3046, roughness: .9, metalness: .06, side: THREE.DoubleSide }),
    road: new THREE.MeshStandardMaterial({ color: 0x24303b, roughness: .8, metalness: .12, side: THREE.DoubleSide }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1c2731, roughness: .9, metalness: .08, side: THREE.DoubleSide }),
    routeMarkerBase: new THREE.MeshBasicMaterial({ color: 0x203742, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide }),
    boundary: new THREE.MeshStandardMaterial({ color: 0xf2f5ef, roughness: .65, metalness: 0, emissive: 0x52666d, emissiveIntensity: .35, side: THREE.DoubleSide }),
    routeGuide: new THREE.MeshStandardMaterial({ color: 0x38d7e8, roughness: .48, metalness: .02, emissive: 0x087687, emissiveIntensity: .62, side: THREE.DoubleSide }),
    routeEdge: new THREE.MeshStandardMaterial({ color: 0xffa34e, roughness: .55, metalness: .02, emissive: 0x8f3511, emissiveIntensity: .65 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x26384d, roughness: .82, metalness: .18 }),
    basalt: new THREE.MeshStandardMaterial({ color: 0x2b3949, roughness: .74, metalness: .22 }),
    navy: new THREE.MeshStandardMaterial({ color: 0x263b50, roughness: .58, metalness: .35 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x49627a, roughness: .4, metalness: .8 }),
    icegray: new THREE.MeshStandardMaterial({ color: 0x6e8496, roughness: .7, metalness: .14 }),
    // Standing-seam roofing for the two big roofs. They used icegray, which is
    // right for the grandstand backrests but wrong for a 140 m² horizontal
    // plate — facing straight up into the sky light it clipped to near white
    // and read as a hole in the frame. Dark slate keeps the roofs reading as
    // roofs, and lets the steel ribs above them carry the highlight.
    roof: new THREE.MeshStandardMaterial({ color: 0x33465c, roughness: .56, metalness: .34 }),
    // Seat backs were icegray alongside the roof, and 192 of them formed the
    // brightest mass in the near-track views. A muted slate keeps the rows
    // legible as seating while the orange seats carry the accent.
    seatback: new THREE.MeshStandardMaterial({ color: 0x4a5f75, roughness: .78, metalness: .1 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f5ef, roughness: .58, metalness: .08 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xff7238, roughness: .48, metalness: .2, emissive: 0x3f1005, emissiveIntensity: .55 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x9ff9ff, roughness: .28, metalness: .28, emissive: 0x19dce9, emissiveIntensity: 2.2 }),
    cyanDark: new THREE.MeshStandardMaterial({ color: 0x245d72, roughness: .38, metalness: .48, emissive: 0x0b7188, emissiveIntensity: .8 }),
    green: new THREE.MeshStandardMaterial({ color: 0x1c4b45, roughness: .96, metalness: .02 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x2f6b4a, roughness: .94, metalness: .01 }),
    // Canopy tint variation rides on per-instance colours (CANOPY_DARK/MID/
    // LIGHT), not on a second material: addInstance keys its batch by name and
    // material, so a second foliage material would have split the crowns into
    // two InstancedMeshes and halved the count the venue test pins.
    bark: new THREE.MeshStandardMaterial({ color: 0x4d3f34, roughness: .96, metalness: .02 }),
    grate: new THREE.MeshStandardMaterial({ color: 0x050b12, roughness: .64, metalness: .86 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x071926, roughness: .38, metalness: .52, emissive: 0x0a4859, emissiveIntensity: .8 }),
    label: new THREE.MeshStandardMaterial({ color: 0xe8fbff, roughness: .7, metalness: .04, side: THREE.DoubleSide }),
  };
}

function buildStartingGrid(slots, startPose, halfWidth, addBox, addCanvasLabel, materials) {
  if (!Array.isArray(slots)) return;
  for (const slot of slots) {
    if (!Number.isFinite(slot?.x) || !Number.isFinite(slot?.y)) continue;
    const length = Number.isFinite(slot.boxLength) ? slot.boxLength : .48;
    const width = Number.isFinite(slot.boxWidth) ? slot.boxWidth : .48;
    const yaw = Number.isFinite(slot.yaw) ? slot.yaw : startPose.yaw;
    const normal = [-Math.sin(yaw), Math.cos(yaw)];
    addBox("starting_grid_box", [length, .009, .035], [slot.x + normal[0] * width / 2, .019, -(slot.y + normal[1] * width / 2)], materials.white, [0, yaw, 0], false);
    addBox("starting_grid_box", [.035, .009, width], [slot.x - Math.cos(yaw) * length / 2, .019, -(slot.y - Math.sin(yaw) * length / 2)], materials.white, [0, yaw, 0], false);
    addBox("starting_grid_light", [length * .62, .012, .025], [slot.x, .026, -slot.y], materials.cyan, [0, yaw, 0], false);
    addCanvasLabel(`grid_slot_number_${slot.id}`, String(slot.id).padStart(2, "0"), `R${Number(slot.row) + 1} / C${Number(slot.column) + 1}`, .25, .19, [slot.x, .034, -slot.y], [-Math.PI / 2, 0, 0], "#e8fbff", "#9ff9ff");
  }
  const gridWidth = Math.max(halfWidth * 2 + .34, 6.7);
  const tileWidth = gridWidth / 16;
  for (let row = 0; row < 2; row++) for (let column = 0; column < 16; column++) {
    const across = -gridWidth / 2 + tileWidth / 2 + column * tileWidth;
    const x = startPose.point[0] + startPose.tangent[0] * ((row - .5) * .34) + startPose.normal[0] * across;
    const y = startPose.point[1] + startPose.tangent[1] * ((row - .5) * .34) + startPose.normal[1] * across;
    addBox("finish_checker", [.17, .008, tileWidth], [x, .014, -y], (row + column) % 2 ? materials.navy : materials.white, [0, startPose.yaw, 0], false);
  }
}

function buildStartGantry(startPose, halfWidth, addBox, addCanvasLabel, materials) {
  const width = halfWidth * 2 + .9;
  const x = startPose.point[0];
  const z = -startPose.point[1];
  for (const side of [-1, 1]) {
    const px = startPose.point[0] + startPose.normal[0] * (halfWidth + .45) * side;
    const py = startPose.point[1] + startPose.normal[1] * (halfWidth + .45) * side;
    addBox("start_gantry_column", [.2, 3.2, .2], [px, 1.6, -py], materials.navy);
    addBox("start_gantry_column_light", [.23, .08, .23], [px, 2.5, -py], materials.cyan, [0, 0, 0], false);
  }
  addBox("start_gantry_header", [.22, .28, width], [x, 3.02, z], materials.navy, [0, startPose.yaw, 0]);
  addBox("start_gantry_header_light", [.24, .08, width - .16], [x, 2.82, z], materials.cyan, [0, startPose.yaw, 0], false);
  addCanvasLabel("start_gantry_identity", "MICRODUCK RACE", "START / FINISH     103.4 M     16 STAGES", 2.8, .25, [x - .13, 3.02, z], [0, -Math.PI / 2, 0]);
}

function buildSafetyBarriers(addCheckedBox, addBox, materials, bounds, halfWidth) {
  const railY = Math.max(Math.abs(bounds.minY), Math.abs(bounds.maxY)) + halfWidth + 1.55;
  const railX = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)) + halfWidth + 1.55;
  for (let x = bounds.minX; x <= bounds.maxX; x += 1.8) {
    addCheckedBox("safety_barrier_post", [.1, .88, .1], [x, .44, -railY], materials.steel, [0, 0, 0]);
    addCheckedBox("safety_barrier_post", [.1, .88, .1], [x, .44, railY], materials.steel, [0, 0, 0]);
  }
  addCheckedBox("safety_barrier_top", [bounds.maxX - bounds.minX + 1.8, .08, .08], [0, .87, -railY], materials.cyanDark, [0, 0, 0]);
  addCheckedBox("safety_barrier_top", [bounds.maxX - bounds.minX + 1.8, .08, .08], [0, .87, railY], materials.cyanDark, [0, 0, 0]);
  for (let y = bounds.minY; y <= bounds.maxY; y += 1.8) {
    addCheckedBox("safety_barrier_post", [.1, .88, .1], [-railX, .44, -y], materials.steel, [0, 0, 0]);
    addCheckedBox("safety_barrier_post", [.1, .88, .1], [railX, .44, -y], materials.steel, [0, 0, 0]);
  }
  addBox("safety_barrier_top", [.08, .08, bounds.maxY - bounds.minY + 1.8], [-railX, .87, 0], materials.cyanDark);
  addBox("safety_barrier_top", [.08, .08, bounds.maxY - bounds.minY + 1.8], [railX, .87, 0], materials.cyanDark);
}

function buildGrandstand(addCheckedBox, addBox, materials) {
  const standZ = 17.05;
  addSemanticBox(addCheckedBox, "south_grandstand", [31, .5, 4.3], [0, .25, standZ], materials.basalt);
  for (let tier = 0; tier < 4; tier += 1) {
    const rowZ = 15.42 + tier * .78;
    const rowY = .65 + tier * .34;
    addSemanticBox(addCheckedBox, "grandstand_tier", [29 - tier * 1.8, .25, .72], [0, rowY, rowZ + .12], materials.concrete);
    addBox("grandstand_seat_line", [27.8 - tier * 1.8, .06, .08], [0, rowY + .16, rowZ - .17], materials.cyanDark, [0, 0, 0], false);
  }
  for (let x = -13.5; x <= 13.5; x += 2.7) addBox("grandstand_frame", [.11, 2.2, .11], [x, 1.1, 15.15], materials.steel);
  addBox("grandstand_roof_beam", [31.5, .18, .18], [0, 4.12, 14.88], materials.steel);
  addBox("grandstand_roof_edge", [31.8, .12, 4.4], [0, 4.04, 16.25], materials.roof);
  addBox("grandstand_roof_light", [31.8, .075, .085], [0, 4.05, 14.01], materials.cyan, [0, 0, 0], false);
  for (let segment = 0; segment < 16; segment++) addBox("grandstand_roof_rib", [.035, .1, 4.45], [-15 + segment * 2, 4.14, 16.25], materials.steel);
  for (const x of [-14.7, 14.7]) addBox("grandstand_roof_pillar", [.16, 4.1, .16], [x, 2.05, 15.05], materials.steel);
}

function buildTimingTower(addCheckedBox, addBox, materials) {
  addSemanticBox(addCheckedBox, "east_timing_tower", [2.7, 6.8, 2.3], [25.5, 3.4, 4.7], materials.navy);
  addBox("timing_tower_window_band", [2.82, 1.2, 2.46], [25.5, 4.7, 4.7], materials.screen, [0, 0, 0], false);
  addBox("timing_tower_cap", [3.2, .22, 2.8], [25.5, 6.9, 4.7], materials.cyanDark);
  for (const x of [24.45, 26.55]) for (const z of [3.82, 5.58]) addBox("timing_tower_leg", [.18, 2.4, .18], [x, 1.2, z], materials.steel);
}

function buildPitBuilding(addCheckedBox, addBox, materials) {
  addSemanticBox(addCheckedBox, "north_pit_building", [31, 2.8, 4.5], [2, 1.4, -17.1], materials.basalt);
  addBox("pit_building_back_wall", [31, 2.4, .2], [2, 1.3, -19.2], materials.navy);
  addBox("pit_building_roof", [32.2, .22, 5.1], [2, 2.86, -17.1], materials.roof);
  for (let x = -12.5; x <= 16.5; x += 3.6) {
    addBox("pit_bay_column", [.15, 2.55, .15], [x, 1.27, -14.72], materials.steel);
    addBox("pit_bay_header", [3.35, .14, .18], [x + 1.65, 2.48, -14.72], materials.cyanDark);
  }
  for (let x = -11; x <= 15; x += 2.6) {
    addBox("pit_canopy_column", [.1, 3.9, .1], [x, 1.95, -14.35], materials.steel);
    addBox("pit_canopy_rafter", [.11, .11, 4.7], [x, 3.84, -16.65], materials.steel);
  }
  addBox("pit_canopy_front_beam", [31, .14, .14], [2, 3.84, -14.35], materials.cyan);
  addBox("pit_canopy_rear_beam", [31, .14, .14], [2, 3.84, -18.8], materials.steel);
  for (let index = 0; index < 5; index += 1) {
    const x = -9.5 + index * 5.3;
    addBox("pit_screen", [3.8, 1.12, .08], [x, 1.65, -14.58], materials.screen, [0, 0, 0], false);
    addBox("pit_screen_edge", [3.95, .05, .1], [x, 2.25, -14.6], materials.cyan, [0, 0, 0], false);
    addBox("pit_screen_edge", [3.95, .05, .1], [x, 1.05, -14.6], materials.orange, [0, 0, 0], false);
  }
}

function buildPaddock(addCheckedBox, addBox, addInstance, materials, THREE) {
  addSemanticBox(addCheckedBox, "central_mechanical_paddock", [11.8, .3, 5.2], [0, .15, 0], materials.basalt);
  addBox("paddock_service_spine", [9.8, .6, .7], [0, .48, -1.25], materials.navy);
  addBox("paddock_service_spine_accent", [10, .05, .1], [0, .82, -1.25], materials.cyan, [0, 0, 0], false);
  for (let x = -4.4; x <= 4.4; x += 2.2) {
    addBox("paddock_workbench", [1.45, .7, .62], [x, .5, 1.18], materials.concrete);
    addBox("paddock_workbench_accent", [1.48, .045, .07], [x, .88, 1.18], materials.orange, [0, 0, 0], false);
  }
  for (const x of [-5.55, 5.55]) {
    addBox("paddock_gantry_post", [.15, 2.5, .15], [x, 1.25, 0], materials.steel);
    addBox("paddock_gantry_beam", [.17, .17, 5.3], [x, 2.48, 0], materials.steel);
  }
  addBox("paddock_identity_bar", [7.2, .14, .14], [0, 2.48, 0], materials.cyan);
  const shrubGeometry = new THREE.ConeGeometry(.32, .68, 7);
  for (const position of [[-4.8, -.55], [-3.8, -.55], [3.8, -.55], [4.8, -.55], [-4.7, 2.1], [4.7, 2.1], [-2.2, 2.1], [2.2, 2.1]]) addInstance("infield_shrub", shrubGeometry, materials.foliage, [position[0], .42, position[1]]);
  const planterGeometry = new THREE.CylinderGeometry(.42, .5, .18, 8);
  for (const position of [[-5.1, -.55], [5.1, -.55], [-5.1, 2.1], [5.1, 2.1]]) addInstance("infield_planter", planterGeometry, materials.green, [position[0], .09, position[1]]);
}

function buildFlags(addBox, materials) {
  for (const x of [-13.5, -5.5, 3.5, 12.5]) {
    addBox("flag_pole", [.045, 3.2, .045], [x, 1.6, 14.75], materials.steel);
    addBox("flag_panel", [.72, .34, .025], [x + .35, 2.8, 14.75], x % 2 ? materials.cyan : materials.orange, [0, 0, 0], false);
  }
  for (const x of [-12, -4, 4, 12]) {
    addBox("pit_flag_pole", [.045, 3.2, .045], [x, 1.6, -14.15], materials.steel);
    addBox("pit_flag_panel", [.72, .34, .025], [x + .35, 2.8, -14.15], x % 2 ? materials.orange : materials.cyan, [0, 0, 0], false);
  }
}

function addSemanticBox(addCheckedBox, name, size, position, material) {
  return addCheckedBox(name, size, position, material);
}

// Grandstand life: robot-duck and puppy spectators on the existing seat grid,
// flags pivoting around their poles, and a confetti burst when a duck
// finishes. Draw-call budget: two crowd InstancedMeshes (each species is one
// merged geometry; baked vertex colors keep eyes dark under any instance
// tint), one pole batch, one flag batch whose eight matrices retrace each
// frame, and one confetti batch that stays invisible until a finish. No
// shadow casting, so the venue render cost barely moves.
const DUCK_COLORS = [0xd8442e, 0xe08f2e, 0xe5c23a, 0x3f9440, 0x2f7fd0, 0x5a4fd0, 0xb04ac0, 0xd8498f, 0x2fb3c4, 0xe8e6df];
const PUP_COLORS = [0xc98d63, 0xe0b36a, 0xd8d4c8, 0x6b4a33, 0x8d8d92, 0x35353a];
const CONFETTI_PALETTE = [0xff5a4e, 0xffb23e, 0xffe23e, 0x4ec461, 0x3e9dff, 0xb44ee0, 0xff4e9b, 0xffffff];

function bakeVertexColor(THREE, geometry, color) {
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const value = new THREE.Color(color);
  for (let index = 0; index < count; index += 1) {
    colors[index * 3] = value.r;
    colors[index * 3 + 1] = value.g;
    colors[index * 3 + 2] = value.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Both spectators face -z (toward the track from the south grandstand).
// Body/head stay white so the per-instance tint paints the whole robot; eyes
// bake near-black so they read the same under any tint.
function createDuckSpectator(THREE) {
  const body = bakeVertexColor(THREE, new THREE.SphereGeometry(.16, 9, 7).scale(1.1, .85, .95), 0xffffff);
  const head = bakeVertexColor(THREE, new THREE.SphereGeometry(.105, 9, 7).translate(0, .155, -.055), 0xffffff);
  const beak = bakeVertexColor(THREE, new THREE.BoxGeometry(.085, .035, .075).translate(0, .15, -.15), 0xf2efe4);
  const eyeL = bakeVertexColor(THREE, new THREE.SphereGeometry(.017, 6, 5).translate(.052, .185, -.125), 0x14161a);
  const eyeR = bakeVertexColor(THREE, eyeL.clone().translate(-.104, 0, 0), 0x14161a);
  const antenna = bakeVertexColor(THREE, new THREE.CylinderGeometry(.005, .005, .055, 5).translate(0, .28, -.055), 0xf2efe4);
  return mergeGeometries([body, head, beak, eyeL, eyeR, antenna]);
}

function createPupSpectator(THREE) {
  const body = bakeVertexColor(THREE, new THREE.SphereGeometry(.15, 9, 7).scale(1.05, .82, 1.25), 0xffffff);
  const head = bakeVertexColor(THREE, new THREE.SphereGeometry(.095, 9, 7).translate(0, .15, -.11), 0xffffff);
  const snout = bakeVertexColor(THREE, new THREE.BoxGeometry(.07, .05, .06).translate(0, .125, -.19), 0xf2efe4);
  const earL = bakeVertexColor(THREE, new THREE.BoxGeometry(.03, .075, .018).rotateZ(-.22).translate(.062, .2, -.09), 0x3a3a40);
  const earR = bakeVertexColor(THREE, new THREE.BoxGeometry(.03, .075, .018).rotateZ(.22).translate(-.062, .2, -.09), 0x3a3a40);
  const eyeL = bakeVertexColor(THREE, new THREE.SphereGeometry(.015, 6, 5).translate(.045, .17, -.16), 0x14161a);
  const eyeR = bakeVertexColor(THREE, eyeL.clone().translate(-.09, 0, 0), 0x14161a);
  const tail = bakeVertexColor(THREE, new THREE.ConeGeometry(.02, .07, 6).rotateX(.6).translate(0, .1, .2), 0xffffff);
  return mergeGeometries([body, head, snout, earL, earR, eyeL, eyeR, tail]);
}

function createGrandstandLife(THREE, group, seats, materials) {
  let seed = 4127;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const matrix = new THREE.Object3D();
  const tint = new THREE.Color();

  // --- crowd: ~2/3 seat occupancy, robot ducks and pups, one tint each ----
  const occupied = seats.filter(() => random() < .68);
  const duckSeats = [];
  const pupSeats = [];
  for (const seat of occupied) (random() < .6 ? duckSeats : pupSeats).push(seat);
  const crowdMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, metalness: .05 });
  const ducks = new THREE.InstancedMesh(createDuckSpectator(THREE), crowdMaterial, duckSeats.length);
  const pups = new THREE.InstancedMesh(createPupSpectator(THREE), crowdMaterial, pupSeats.length);
  ducks.name = "gauntlet_crowd_ducks";
  pups.name = "gauntlet_crowd_pups";
  const sitCrowd = (mesh, seatsList, palette) => {
    seatsList.forEach(([seatX, seatY, seatZ], index) => {
      const lean = (random() - .5) * .14;
      matrix.position.set(seatX, seatY + .28, seatZ - .02);
      matrix.rotation.set(lean * .3, (random() - .5) * .5, 0);
      matrix.scale.set(.9 + random() * .25, .92 + random() * .22, 1);
      matrix.updateMatrix();
      mesh.setMatrixAt(index, matrix.matrix);
      mesh.setColorAt(index, tint.set(palette[Math.floor(random() * palette.length)]));
    });
    mesh.instanceColor.needsUpdate = true;
    mesh.userData.visualOnly = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  };
  sitCrowd(ducks, duckSeats, DUCK_COLORS);
  sitCrowd(pups, pupSeats, PUP_COLORS);

  // --- waving flags: hinge at the pole, yaw oscillation driven per frame --
  const FLAG_COUNT = 8;
  const flagGeometry = new THREE.BoxGeometry(.8, .38, .024);
  flagGeometry.translate(.4, 0, 0);
  const flags = new THREE.InstancedMesh(
    flagGeometry,
    new THREE.MeshStandardMaterial({ roughness: .6, metalness: .05, side: THREE.DoubleSide }),
    FLAG_COUNT,
  );
  flags.name = "gauntlet_wave_flags";
  const flagBase = [];
  for (let index = 0; index < FLAG_COUNT; index++) {
    flagBase.push({ x: -12.6 + index * 3.6, y: 2.36 + (index % 3) * .11, z: 14.6, phase: random() * Math.PI * 2, speed: 1.6 + random() * .9, amp: .3 + random() * .16 });
    flags.setColorAt(index, tint.set(index % 2 ? 0x38d7e8 : 0xff713b));
  }
  flags.instanceColor.needsUpdate = true;
  flags.userData.visualOnly = true;
  group.add(flags);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.028, .028, 2.7, 8), materials.steel, FLAG_COUNT);
  poles.name = "gauntlet_wave_flag_poles";
  for (let index = 0; index < FLAG_COUNT; index++) {
    matrix.position.set(-12.6 + index * 3.6, 1.35, 14.6);
    matrix.rotation.set(0, 0, 0);
    matrix.scale.set(1, 1, 1);
    matrix.updateMatrix();
    poles.setMatrixAt(index, matrix.matrix);
  }
  poles.userData.visualOnly = true;
  group.add(poles);

  // --- finish confetti: one batch, hidden until celebrate() ---------------
  const CONFETTI_COUNT = 180;
  const confettiMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(.11, .016, .07),
    new THREE.MeshStandardMaterial({ roughness: .65, metalness: .12, side: THREE.DoubleSide }),
    CONFETTI_COUNT,
  );
  confettiMesh.name = "gauntlet_finish_confetti";
  confettiMesh.visible = false;
  confettiMesh.frustumCulled = false;
  confettiMesh.userData.visualOnly = true;
  group.add(confettiMesh);
  const confettiPositions = new Float32Array(CONFETTI_COUNT * 3);
  const confettiVelocities = new Float32Array(CONFETTI_COUNT * 3);
  const confettiSpin = new Float32Array(CONFETTI_COUNT * 3);
  let confettiUntil = -1;
  let lastTime = 0;

  // pose uses the venue convention: x/y planar, z up.
  function celebrate(pose) {
    if (!pose || typeof pose.x !== "number" || typeof pose.z !== "number") return;
    for (let index = 0; index < CONFETTI_COUNT; index++) {
      const angle = random() * Math.PI * 2;
      const out = .5 + random() * 1.5;
      confettiPositions[index * 3] = pose.x + Math.cos(angle) * random() * .4;
      confettiPositions[index * 3 + 1] = pose.z + .6 + random() * .4;
      confettiPositions[index * 3 + 2] = pose.y + Math.sin(angle) * random() * .4;
      confettiVelocities[index * 3] = Math.cos(angle) * out;
      confettiVelocities[index * 3 + 1] = 2.4 + random() * 2.2;
      confettiVelocities[index * 3 + 2] = Math.sin(angle) * out;
      confettiSpin[index * 3] = (random() - .5) * 9;
      confettiSpin[index * 3 + 1] = (random() - .5) * 9;
      confettiSpin[index * 3 + 2] = (random() - .5) * 6;
      confettiMesh.setColorAt(index, tint.set(CONFETTI_PALETTE[Math.floor(random() * CONFETTI_PALETTE.length)]));
    }
    confettiMesh.instanceColor.needsUpdate = true;
    confettiUntil = lastTime + 7;
    confettiMesh.visible = true;
  }

  function update(timeSeconds) {
    const dt = Math.min(.05, Math.max(0, timeSeconds - lastTime));
    lastTime = timeSeconds;
    for (let index = 0; index < FLAG_COUNT; index++) {
      const flag = flagBase[index];
      matrix.position.set(flag.x, flag.y, flag.z);
      matrix.rotation.set(0, Math.sin(timeSeconds * flag.speed + flag.phase) * flag.amp, 0);
      matrix.scale.set(1, 1, 1);
      matrix.updateMatrix();
      flags.setMatrixAt(index, matrix.matrix);
    }
    flags.instanceMatrix.needsUpdate = true;
    if (!confettiMesh.visible) return;
    if (timeSeconds > confettiUntil) {
      confettiMesh.visible = false;
      return;
    }
    for (let index = 0; index < CONFETTI_COUNT; index++) {
      confettiVelocities[index * 3] *= 1 - .55 * dt;
      confettiVelocities[index * 3 + 2] *= 1 - .55 * dt;
      confettiVelocities[index * 3 + 1] = Math.max(confettiVelocities[index * 3 + 1] - 4.1 * dt, -1.35);
      confettiPositions[index * 3] += confettiVelocities[index * 3] * dt;
      confettiPositions[index * 3 + 1] += confettiVelocities[index * 3 + 1] * dt;
      confettiPositions[index * 3 + 2] += confettiVelocities[index * 3 + 2] * dt;
      if (confettiPositions[index * 3 + 1] < .02) confettiPositions[index * 3 + 1] = .02;
      matrix.position.set(confettiPositions[index * 3], confettiPositions[index * 3 + 1], confettiPositions[index * 3 + 2]);
      matrix.rotation.set(
        confettiPositions[index * 3 + 1] * confettiSpin[index * 3] + timeSeconds * confettiSpin[index * 3],
        timeSeconds * confettiSpin[index * 3 + 1],
        timeSeconds * confettiSpin[index * 3 + 2],
      );
      matrix.scale.set(1, 1, 1);
      matrix.updateMatrix();
      confettiMesh.setMatrixAt(index, matrix.matrix);
    }
    confettiMesh.instanceMatrix.needsUpdate = true;
  }

  return { update, celebrate };
}

// Canopy tones, applied per instance so a row of trees varies without adding
// a second batch (the venue test pins the crowns instance count by name).
const CANOPY_DARK = 0x1d4a38;
const CANOPY_MID = 0x2f6b4a;
const CANOPY_LIGHT = 0x3d7a52;

// A sphere displaced along its own normals by a smooth low-frequency field.
// It reads as a leafy mass instead of the faceted icosahedron it replaces,
// and because the displacement is a pure function of the vertex direction,
// coincident vertices on the non-indexed geometry stay welded — no visible
// cracks between faces.
function createCanopyGeometry(THREE, radius, detail = 3) {
  const seeds = [1.7, 4.3, 8.9, 2.6, 6.1, 11.4];
  const wobble = (x, y, z) => {
    let sum = 0;
    for (let index = 0; index < seeds.length; index += 2) {
      const frequency = seeds[index];
      const phase = seeds[index + 1];
      sum += Math.sin(x * frequency + phase) * Math.cos(y * frequency * .8 + phase) * Math.sin(z * frequency * 1.2 + phase);
    }
    return sum / (seeds.length / 2);
  };
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const scale = 1 + wobble(x, y, z) * .16;
    positions.setXYZ(index, x * scale, y * scale, z * scale);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function normalizePath(path) {
  if (!Array.isArray(path) || path.length < 3) return roundedRectanglePath(.3);
  const points = path.filter((point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])).map((point) => [point[0], point[1]]);
  if (points.length < 3) return roundedRectanglePath(.3);
  if (distance(points[0], points.at(-1)) < 1e-6) points.pop();
  return points;
}

function roundedRectanglePath(step) {
  const points = [];
  const addLine = (from, to) => {
    const count = Math.max(1, Math.ceil(distance(from, to) / step));
    for (let index = 0; index < count; index += 1) {
      const amount = index / count;
      points.push([from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount]);
    }
  };
  const addArc = (center, startAngle, endAngle) => {
    const count = Math.max(2, Math.ceil(Math.abs(endAngle - startAngle) * 5 / step));
    for (let index = 0; index < count; index += 1) {
      const amount = index / count;
      const angle = startAngle + (endAngle - startAngle) * amount;
      points.push([center[0] + Math.cos(angle) * 5, center[1] + Math.sin(angle) * 5]);
    }
  };
  addLine([0, -10], [13, -10]);
  addArc([13, -5], -Math.PI / 2, 0);
  addLine([18, -5], [18, 5]);
  addArc([13, 5], 0, Math.PI / 2);
  addLine([13, 10], [-13, 10]);
  addArc([-13, 5], Math.PI / 2, Math.PI);
  addLine([-18, 5], [-18, -5]);
  addArc([-13, -5], Math.PI, Math.PI * 1.5);
  return points;
}

function makePathData(points) {
  const segments = [];
  const s = [];
  let length = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const edgeLength = distance(a, b);
    s.push(length);
    segments.push({ a, b, length: edgeLength, startS: length, endS: length + edgeLength });
    length += edgeLength;
  }
  return { points, segments, s, length };
}

function miterNormal(previous, point, next) {
  const incoming = normalize([point[0] - previous[0], point[1] - previous[1]]);
  const outgoing = normalize([next[0] - point[0], next[1] - point[1]]);
  let x = -incoming[1] - outgoing[1];
  let y = incoming[0] + outgoing[0];
  const magnitude = Math.hypot(x, y);
  if (magnitude < 1e-5) return [-incoming[1], incoming[0]];
  x /= magnitude;
  y /= magnitude;
  const scale = 1 / Math.max(.42, Math.abs(x * -outgoing[1] + y * outgoing[0]));
  return [x * Math.min(2.4, scale), y * Math.min(2.4, scale)];
}

function nearestPose(pathData, point) {
  let best = { index: 0, distance: Infinity };
  for (let index = 0; index < pathData.points.length; index += 1) {
    const currentDistance = distance(pathData.points[index], point);
    if (currentDistance < best.distance) best = { index, distance: currentDistance };
  }
  return best;
}

function footprintClear(pathData, x, y, size, clearance) {
  const halfX = Math.abs(size[0]) / 2;
  const halfY = Math.abs(size[2]) / 2;
  for (const dx of [-halfX, halfX]) for (const dy of [-halfY, halfY]) if (distanceToPath(pathData, x + dx, y + dy) <= clearance) return false;
  return true;
}

function distanceToPath(pathData, x, y) {
  let best = Infinity;
  for (const segment of pathData.segments) {
    const ax = segment.a[0];
    const ay = segment.a[1];
    const bx = segment.b[0];
    const by = segment.b[1];
    const dx = bx - ax;
    const dy = by - ay;
    const amount = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * amount, y - ay - dy * amount));
  }
  return best;
}

function createAggregateTexture(THREE) {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 143721;
  for (let index = 0; index < size * size; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 190 + (seed >>> 25) * .22;
    pixels.set([value, value + 2, value + 5, 255], index * 4);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1]) || 1;
  return [vector[0] / length, vector[1] / length];
}

function distance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}
