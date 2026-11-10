// Convert one registry entry into MuJoCo world geometry.
// The robot MJCF remains the source of truth for the body and actuators.  An
// environment only contributes static/dynamic obstacle geoms and never
// changes the robot's joint order or the 61D locomotion policy contract.

import {sampleGeometryPose} from './geometryPose.js';

const fmt = (values) => values.map((v) => Number(v).toFixed(5)).join(" ");

function appendGeom(doc, worldbody, el, geometry, index) {
  const name = `env_${geometry.name}_${index}`;
  const dynamic = geometry.dynamic && geometry.motion?.kind;
  const pose = sampleGeometryPose(geometry, 0);
  const collisionAttrs = {
    contype: geometry.collision ? "1" : "0", conaffinity: geometry.collision ? "1" : "0",
  };
  if (geometry.type === "water" || geometry.type === "marker") {
    worldbody.appendChild(el("geom", {
      name, type: "box", pos: fmt(geometry.pos), size: fmt(geometry.size),
      contype: "0", conaffinity: "0", rgba: geometry.type === "water" ? "0.08 0.55 0.78 0.55" : "0.55 0.95 0.35 0.35",
    }));
    return;
  }
  if (geometry.type === 'terrainPrism') {
    let asset = doc.querySelector('asset');
    if (!asset) { asset = el('asset', {}); doc.querySelector('mujoco').appendChild(asset); }
    asset.appendChild(el('mesh', { name: `${name}_mesh`, vertex: fmt(geometry.vertices.flat()), face: geometry.faces.join(' ') }));
    const parent = dynamic ? el('body', { name: `env_motion_${geometry.name}_${index}`, pos: fmt(pose.position), quat: fmt(pose.quaternion), mocap: 'true' }) : worldbody;
    parent.appendChild(el('geom', { name: dynamic ? `${name}_geom` : name, type: 'mesh', mesh: `${name}_mesh`, pos: dynamic ? '0 0 0' : fmt(geometry.pos), ...(dynamic ? {} : {quat:fmt(pose.quaternion)}), ...collisionAttrs, rgba: '0.32 0.48 0.62 1' }));
    if (dynamic) worldbody.appendChild(parent);
    return;
  }
  const shapeAttrs = geometry.type === "cylinder"
    ? { name, type: "cylinder", size: `${Number(geometry.size[0]).toFixed(5)} ${(Number(geometry.size[1]) / 2).toFixed(5)}` }
    : { name, type: "box", size: fmt(geometry.size) };
  if (geometry.friction) {
    shapeAttrs.friction = fmt(geometry.friction);
    shapeAttrs.priority = '1';
  }
  if (geometry.nativeSurface) {
    const body=el('body',{name:`env_motion_${geometry.name}_${index}`,pos:fmt(geometry.pos),euler:`0 0 ${geometry.yaw??0}`});
    const kind=geometry.motion.kind;
    const axes=kind==='belt'?['1 0 0','0 0 1']:kind==='seesaw-access'?['0 0 1','0 1 0']:kind==='rock'?['0 1 0']:['0 0 1'];
    axes.forEach((axis,k)=>body.appendChild(el('joint',{name:`env_surface_${geometry.name}_${index}_${k}`,type:kind==='belt'||(kind==='seesaw-access'&&k===0)?'slide':'hinge',axis,damping:'0',armature:'0',limited:'false'})));
    body.appendChild(el('geom',{...shapeAttrs,name:`${name}_geom`,pos:'0 0 0',mass:'100',...collisionAttrs,contype:'3',conaffinity:'0',rgba:'0.32 0.48 0.62 1'}));
    worldbody.appendChild(body);return;
  }
  if (dynamic) {
    const body = el("body", { name: `env_motion_${geometry.name}_${index}`, pos: fmt(pose.position), quat: fmt(pose.quaternion), mocap: 'true' });
    body.appendChild(el("geom", {
      ...shapeAttrs, name: `${name}_geom`, pos: fmt(geometry.localPos ?? [0, 0, 0]), ...collisionAttrs, rgba: "0.32 0.48 0.62 1",
    }));
    worldbody.appendChild(body);
    return;
  }
  const attrs = { ...shapeAttrs, pos: fmt(geometry.pos), ...collisionAttrs, rgba: "0.32 0.48 0.62 1" };
  // Pitched solids use the same Rz(yaw)*Ry(pitch) quaternion as mocap.
  // Euler xyz would compose yaw/tilt differently at a nonzero circuit yaw.
  if (geometry.pitch != null || geometry.motion?.pitch != null) attrs.quat = fmt(pose.quaternion);
  else if (geometry.yaw) attrs.euler = `0 0 ${geometry.yaw}`;
  worldbody.appendChild(el("geom", attrs));
}

export function appendEnvironmentToMjcf(doc, env, el) {
  const worldbody = doc.querySelector("worldbody");
  if (!worldbody) throw new Error("Environment MJCF requires a <worldbody>");
  for (const [index, geometry] of env.geometry.entries()) appendGeom(doc, worldbody, el, geometry, index);
  // Non-colliding target marker.  The runtime uses env.goal for the precise
  // success test; this geom is only a stable, inspectable scene anchor.
  appendGeom(doc, worldbody, el, {
    type: "marker", name: "goal_marker", pos: [env.goal.x, env.goal.y, (env.course?.goalHeight ?? 0)+0.006], size: [env.goal.radius, env.goal.radius, 0.006],
  }, "goal");
  return { geometryCount: env.geometry.length + 1 };
}

export function validateEnvironmentMjcf(doc, env) {
  if (!env?.id || !Array.isArray(env.geometry)) throw new Error("Invalid environment descriptor");
  if (!doc.querySelector("worldbody")) throw new Error(`${env.id}: missing worldbody`);
  for (const geometry of env.geometry) {
    if (!Array.isArray(geometry.pos) || geometry.pos.length !== 3) throw new Error(`${env.id}: ${geometry.name} needs a 3D position`);
    if (!Array.isArray(geometry.size) || geometry.size.length < 2) throw new Error(`${env.id}: ${geometry.name} needs a size`);
  }
  return true;
}
