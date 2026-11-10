import { appendEnvironmentToMjcf } from "../envs/mjcf.js";
import { DEFAULT_POSE, JOINT_NAMES, TIMESTEP } from "../game/constants.js";
import { GAUNTLET_CIRCUIT, circuitPointAt } from "../envs/gauntletCircuit.js";
import { isSupportedEntrantCount } from "./racePresets.js";

// Pure spawn planning is shared with offline tests; no physics or model startup.
export function buildRaceDefinitions(entrants, startStage = 0) {
  if (!Array.isArray(entrants) || !isSupportedEntrantCount(entrants.length)) throw new Error('INVALID_RACE_ENTRANT_COUNT');
  if (!Number.isInteger(startStage) || startStage < 0 || startStage >= GAUNTLET_CIRCUIT.fullCourse.stages.length) throw new Error('INVALID_START_STAGE');
  // The existing 20-slot grid is validated only in the launch area's clear apron.
  // Translating it into another stage can intersect obstacles or skip a gate.
  if (entrants.length > 3 && startStage !== 0) throw new Error('MULTI_ENTRANT_GRID_REQUIRES_START_STAGE_ZERO');
  return entrants.map((entrant, index) => {
    let point;
    let gridSlot = null;
    if (entrants.length > 3) {
      point = GAUNTLET_CIRCUIT.circuit.grid.slots[index];
      gridSlot = point.id;
    } else {
      const stage = GAUNTLET_CIRCUIT.fullCourse.stages[startStage];
      const distance = startStage === 0 ? .12 : stage.startS + .55;
      const lateral = entrants.length === 1 ? 0 : (index - (entrants.length - 1) / 2) * 1.05;
      point = circuitPointAt(distance, lateral);
    }
    return { ...entrant, prefix: `duck${String(index + 1).padStart(2, '0')}_`, gridSlot, spawn: { x: point.x, y: point.y, z: .12, yaw: point.yaw } };
  });
}

const PREFIXED_TAGS = new Set([
  "body", "joint", "freejoint", "geom", "site", "camera", "light",
  "actuator", "sensor", "tendon", "equality", "fixed", "spatial", "joint",
  "pair", "exclude",
]);

const REFERENCE_ATTRIBUTES = new Set([
  "joint", "joint1", "joint2", "site", "site1", "site2", "body", "body1",
  "body2", "geom", "geom1", "geom2", "tendon", "actuator", "objname",
  "refsite", "cranksite", "slidersite",
]);

const ROBOT_SECTIONS = ["sensor", "actuator", "tendon", "equality", "contact"];
const JOINT_SET = new Set(JOINT_NAMES);

function tagName(node) {
  return String(node?.localName || node?.nodeName || "").toLowerCase();
}

function elementChildren(node) {
  if (!node) return [];
  if (node.children) return Array.from(node.children);
  return Array.from(node.childNodes || []).filter((child) => child.nodeType === 1);
}

function descendants(node) {
  const result = [];
  for (const child of elementChildren(node)) {
    result.push(child, ...descendants(child));
  }
  return result;
}

function allElements(doc, tag) {
  return Array.from(doc.getElementsByTagName(tag));
}

function directChildrenByTag(node, tag) {
  return elementChildren(node).filter((child) => tagName(child) === tag);
}

function getAttribute(node, name, fallback = null) {
  const value = node?.getAttribute?.(name);
  return value == null ? fallback : value;
}

function setAttributes(doc, tag, attributes) {
  const element = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value != null) element.setAttribute(name, String(value));
  }
  return element;
}

function removeNode(node) {
  node?.parentNode?.removeChild(node);
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseVector(value, length, fallback) {
  const values = String(value || "").trim().split(/\s+/).map(Number);
  if (values.length !== length || values.some((value) => !Number.isFinite(value))) return fallback.slice();
  return values;
}

function vectorText(values) {
  return values.map((value) => String(value)).join(" ");
}

function isVisualGeom(geom) {
  return String(getAttribute(geom, "class", "")).split(/\s+/).includes("visual");
}

function sourceNamedElements(nodes) {
  const names = new Set();
  for (const node of nodes) {
    for (const element of [node, ...descendants(node)]) {
      const name = getAttribute(element, "name");
      if (name && (PREFIXED_TAGS.has(tagName(element)) || !tagName(element).includes("mesh"))) {
        names.add(name);
      }
    }
  }
  return names;
}

function prefixClone(node, prefix, names) {
  const clone = node.cloneNode(true);
  for (const element of [clone, ...descendants(clone)]) {
    const name = getAttribute(element, "name");
    if (name && names.has(name)) element.setAttribute("name", `${prefix}${name}`);
    for (const attribute of Array.from(element.attributes || [])) {
      if (REFERENCE_ATTRIBUTES.has(attribute.name) && names.has(attribute.value)) {
        element.setAttribute(attribute.name, `${prefix}${attribute.value}`);
      }
    }
  }
  return clone;
}

function baseName(value, prefix) {
  return value?.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function normalizeActuators(children, prefix) {
  const normalized = [];
  const seenPositionJoints = new Set();
  const usedNames = new Set();

  for (const [index, actuator] of children.entries()) {
    const type = tagName(actuator);
    const joint = getAttribute(actuator, "joint");
    if (type === "position" && joint) {
      if (seenPositionJoints.has(joint)) continue;
      seenPositionJoints.add(joint);
      actuator.setAttribute("name", `${prefix}${baseName(joint, prefix)}`);
    }

    let name = getAttribute(actuator, "name");
    if (!name) name = `${prefix}${type || "actuator"}_${index}`;
    if (usedNames.has(name)) name = `${name}_${index}`;
    actuator.setAttribute("name", name);
    usedNames.add(name);
    normalized.push(actuator);
  }
  return normalized;
}

function appendSection(doc, root, tag, children) {
  const section = doc.createElement(tag);
  for (const child of children) section.appendChild(child);
  root.appendChild(section);
  return section;
}

function spawnRoot(root, spawn) {
  const oldPos = parseVector(getAttribute(root, "pos"), 3, [0, 0, 0.12]);
  const x = numberOr(spawn?.x, oldPos[0]);
  const y = numberOr(spawn?.y, oldPos[1]);
  const z = numberOr(spawn?.z, 0.12);
  const yaw = numberOr(spawn?.yaw, 0);
  root.setAttribute("pos", vectorText([x, y, z]));
  root.removeAttribute("euler");
  root.setAttribute("quat", vectorText([Math.cos(yaw / 2), 0, 0, Math.sin(yaw / 2)]));
  return { x, y, z, yaw };
}

function qposForJoint(joint, prefix, body) {
  const type = getAttribute(joint, "type", "hinge");
  const name = baseName(getAttribute(joint, "name", ""), prefix);
  if (type === "ball") return [1, 0, 0, 0];
  if (type === "free") {
    const pos = parseVector(getAttribute(body, "pos"), 3, [0, 0, 0]);
    const quat = parseVector(getAttribute(body, "quat"), 4, [1, 0, 0, 0]);
    return [...pos, ...quat];
  }
  const poseIndex = JOINT_NAMES.indexOf(name);
  return [poseIndex >= 0 ? DEFAULT_POSE[poseIndex] : 0];
}

function robotQpos(root, pose, prefix) {
  const values = [];
  const walk = (body, isRoot = false) => {
    for (const child of elementChildren(body)) {
      const childTag = tagName(child);
      if (childTag === "freejoint") {
        values.push(...(isRoot ? [pose.x, pose.y, pose.z, Math.cos(pose.yaw / 2), 0, 0, Math.sin(pose.yaw / 2)] : [
          ...parseVector(getAttribute(body, "pos"), 3, [0, 0, 0]),
          ...parseVector(getAttribute(body, "quat"), 4, [1, 0, 0, 0]),
        ]));
      } else if (childTag === "joint") {
        values.push(...qposForJoint(child, prefix, body));
      }
    }
    for (const child of directChildrenByTag(body, "body")) walk(child, false);
  };
  walk(root, true);
  return values;
}

function actuatorCtrlValue(actuator, prefix) {
  if (tagName(actuator) !== "position") return 0;
  const joint = baseName(getAttribute(actuator, "joint", ""), prefix);
  const poseIndex = JOINT_NAMES.indexOf(joint);
  return poseIndex >= 0 ? DEFAULT_POSE[poseIndex] : 0;
}

function parseDocument(DOMParser, robotXml) {
  const parser = typeof DOMParser === "function" ? new DOMParser() : DOMParser;
  if (!parser?.parseFromString) throw new TypeError("buildRaceWorldXml requires DOMParser");
  const doc = parser.parseFromString(robotXml, "text/xml");
  const parserErrors = doc.getElementsByTagName?.("parsererror");
  if (!doc?.documentElement || parserErrors?.length) throw new Error("Invalid robot MJCF XML");
  return doc;
}

function validateEntrants(entrants) {
  if (!Array.isArray(entrants) || entrants.length === 0) throw new TypeError("entrants must be a non-empty array");
  const prefixes = new Set();
  for (const entrant of entrants) {
    if (!entrant?.id || !entrant.prefix) throw new TypeError("Each entrant needs id and prefix");
    if (prefixes.has(entrant.prefix)) throw new Error(`Duplicate robot prefix: ${entrant.prefix}`);
    prefixes.add(entrant.prefix);
  }
}

export function buildRaceWorldXml({ robotXml, env, entrants, DOMParser, XMLSerializer }) {
  validateEntrants(entrants);
  if (typeof robotXml !== "string" || !robotXml.trim()) throw new TypeError("robotXml must be XML text");
  const doc = parseDocument(DOMParser, robotXml);
  const root = doc.documentElement;
  const worldbody = Array.from(doc.getElementsByTagName("worldbody"))[0];
  if (!worldbody) throw new Error("Robot MJCF requires a <worldbody>");
  const robotRoots = directChildrenByTag(worldbody, "body");
  if (!robotRoots.length) throw new Error("Robot MJCF requires a root body");
  const robotGeoms = robotRoots.flatMap((robotRoot) => [robotRoot, ...descendants(robotRoot)])
    .filter((element) => tagName(element) === "geom");

  for (const geom of robotGeoms) if (isVisualGeom(geom)) removeNode(geom);
  const remainingRobotGeoms = robotRoots.flatMap((robotRoot) => [robotRoot, ...descendants(robotRoot)])
    .filter((element) => tagName(element) === "geom");
  const usedElementNames = new Set(allElements(doc, "*").map((element) => getAttribute(element, "name")).filter(Boolean));
  let unnamedGeomIndex = 0;
  for (const geom of remainingRobotGeoms) {
    if (getAttribute(geom, "name")) continue;
    let name;
    do name = "collision_geom_" + unnamedGeomIndex++; while (usedElementNames.has(name));
    geom.setAttribute("name", name);
    usedElementNames.add(name);
  }
  const asset = Array.from(doc.getElementsByTagName("asset"))[0];
  const usedMeshes = new Set(remainingRobotGeoms.map((geom) => getAttribute(geom, "mesh")).filter(Boolean));
  if (asset) {
    for (const mesh of directChildrenByTag(asset, "mesh")) {
      const meshName = getAttribute(mesh, "name") || getAttribute(mesh, "file", "").replace(/\.stl$/i, "");
      if (!usedMeshes.has(meshName)) removeNode(mesh);
    }
  }

  const sourceSections = Object.fromEntries(
    ROBOT_SECTIONS.map((tag) => [tag, directChildrenByTag(root, tag)]),
  );
  const prefixableSource = [
    ...robotRoots,
    ...ROBOT_SECTIONS.flatMap((tag) => sourceSections[tag]),
  ];
  const sourceNames = sourceNamedElements(prefixableSource);

  for (const body of robotRoots) removeNode(body);
  for (const tag of [...ROBOT_SECTIONS, "keyframe"]) {
    for (const section of directChildrenByTag(root, tag)) removeNode(section);
  }

  const el = (tag, attrs) => setAttributes(doc, tag, attrs);
  const option = directChildrenByTag(root, "option")[0];
  if (option) {
    if (!getAttribute(option, "timestep")) option.setAttribute("timestep", String(TIMESTEP));
  } else {
    root.appendChild(el("option", { timestep: TIMESTEP }));
  }

  const robots = [];
  const actuatorRecords = [];
  const sectionChildren = Object.fromEntries(ROBOT_SECTIONS.map((tag) => [tag, []]));
  for (const entrant of entrants) {
    const roots = robotRoots.map((sourceRoot) => prefixClone(sourceRoot, entrant.prefix, sourceNames));
    const pose = spawnRoot(roots[0], entrant.spawn || {});
    for (const robotRoot of roots) worldbody.appendChild(robotRoot);
    robots.push({ entrant, roots, pose });

    for (const sourceRoot of sourceSections.sensor) {
      for (const child of elementChildren(sourceRoot)) sectionChildren.sensor.push(prefixClone(child, entrant.prefix, sourceNames));
    }
    const entrantActuators = [];
    for (const sourceRoot of sourceSections.actuator) {
      for (const child of elementChildren(sourceRoot)) entrantActuators.push(prefixClone(child, entrant.prefix, sourceNames));
    }
    const normalizedActuators = normalizeActuators(entrantActuators, entrant.prefix);
    for (const actuator of normalizedActuators) {
      actuatorRecords.push({ actuator, prefix: entrant.prefix });
      sectionChildren.actuator.push(actuator);
    }
    for (const tag of ["tendon", "equality", "contact"]) {
      for (const sourceRoot of sourceSections[tag]) {
        for (const child of elementChildren(sourceRoot)) sectionChildren[tag].push(prefixClone(child, entrant.prefix, sourceNames));
      }
    }
  }

  if (sourceSections.actuator.length) appendSection(doc, root, "actuator", sectionChildren.actuator);
  if (sourceSections.sensor.length) appendSection(doc, root, "sensor", sectionChildren.sensor);
  if (sourceSections.tendon.length) appendSection(doc, root, "tendon", sectionChildren.tendon);
  if (sourceSections.equality.length) appendSection(doc, root, "equality", sectionChildren.equality);
  appendSection(doc, root, "contact", sectionChildren.contact);

  for (const child of elementChildren(worldbody)) {
    if (tagName(child) === "geom" && getAttribute(child, "name") === "floor") removeNode(child);
  }
  worldbody.appendChild(el("geom", { name: "floor", type: "plane", size: "0 0 0.05", pos: "0 0 0" }));
  appendEnvironmentToMjcf(doc, env, el);

  const qpos = robots.flatMap(({ roots, pose, entrant }) => roots.flatMap((robotRoot) => robotQpos(robotRoot, pose, entrant.prefix)));
  const ctrl = actuatorRecords.map(({ actuator, prefix }) => actuatorCtrlValue(actuator, prefix));
  const keyframe = doc.createElement("keyframe");
  keyframe.appendChild(el("key", { name: "STAND", qpos: vectorText(qpos), ctrl: vectorText(ctrl) }));
  root.appendChild(keyframe);

  const serializer = typeof XMLSerializer === "function" ? new XMLSerializer() : XMLSerializer;
  if (!serializer?.serializeToString) throw new TypeError("buildRaceWorldXml requires XMLSerializer");
  return serializer.serializeToString(doc);
}

function enumValue(mujoco, name) {
  const value = mujoco?.mjtObj?.[name];
  return value?.value ?? value;
}

function objectId(mujoco, model, objectType, name) {
  if (typeof mujoco?.mj_name2id !== "function") throw new TypeError("MuJoCo mj_name2id is required");
  return Number(mujoco.mj_name2id(model, enumValue(mujoco, objectType), name));
}

function requireRecord(record, name, kind) {
  if (!record || !Number.isFinite(Number(record.qposadr ?? record.dofadr ?? record.adr))) {
    throw new Error(`Missing ${kind}: ${name}`);
  }
  return record;
}

function geomIdsForPrefix(mujoco, model, prefix) {
  const names = model.geomNames || model.geom_names;
  const count = Number(model.ngeom ?? names?.length ?? model.geom_contype?.length ?? 0);
  const ids = [];
  for (let id = 0; id < count; id += 1) {
    let name = names?.[id];
    if (typeof mujoco?.mj_id2name === "function") {
      name = mujoco.mj_id2name(model, enumValue(mujoco, "mjOBJ_GEOM"), id) || name;
    }
    if (typeof name === "string" && name.startsWith(prefix)) ids.push(id);
  }
  return ids;
}

export function resolveRaceRobotAddresses(mujoco, model, prefix) {
  if (!prefix) throw new TypeError("resolveRaceRobotAddresses requires prefix");
  const rootJointName = `${prefix}trunk_base_freejoint`;
  const rootJoint = requireRecord(model.jnt(rootJointName), rootJointName, "joint");
  const joints = JOINT_NAMES.map((name) => {
    const qualifiedName = `${prefix}${name}`;
    return { name: qualifiedName, record: requireRecord(model.jnt(qualifiedName), qualifiedName, "joint") };
  });
  const gyroName = `${prefix}imu_ang_vel`;
  const gyro = typeof model.sensor === "function"
    ? model.sensor(gyroName)
    : model.sensor_adr?.[objectId(mujoco, model, "mjOBJ_SENSOR", gyroName)];
  if (gyro == null) throw new Error(`Missing sensor: ${gyroName}`);

  return {
    rootQposAdr: Number(rootJoint.qposadr),
    rootDofAdr: Number(rootJoint.dofadr),
    trunkId: objectId(mujoco, model, "mjOBJ_BODY", `${prefix}trunk_base`),
    jointQposAdrs: joints.map(({ record }) => Number(record.qposadr)),
    jointDofAdrs: joints.map(({ record }) => Number(record.dofadr)),
    actuatorIds: JOINT_NAMES.map((name) => objectId(mujoco, model, "mjOBJ_ACTUATOR", `${prefix}${name}`)),
    gyroAdr: Number(gyro.adr ?? gyro),
    geomIds: geomIdsForPrefix(mujoco, model, prefix),
  };
}
