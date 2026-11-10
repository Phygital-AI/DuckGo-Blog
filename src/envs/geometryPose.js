import { motionValue, cycleState } from './course.js';

const TRANSLATION_KINDS = new Set(['slide', 'translate', 'linear']);

const axisVector = (axis) => axis === 'z' ? [0, 0, 1] : axis === 'y' ? [0, 1, 0] : [1, 0, 0];

const normalize = (vector) => {
  const length = Math.hypot(...vector);
  return length > 1e-12 ? vector.map((value) => value / length) : [0, 0, 0];
};

export function rotateWorldXY(vector, yaw) {
  const [x, y, z = 0] = vector;
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return [cosine * x - sine * y, sine * x + cosine * y, z];
}

function multiplyQuaternion(left, right) {
  const [aw, ax, ay, az] = left;
  const [bw, bx, by, bz] = right;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

function quaternionFromPose(yaw, pitch = 0) {
  const halfYaw = yaw / 2;
  const halfPitch = pitch / 2;
  return multiplyQuaternion(
    [Math.cos(halfYaw), 0, 0, Math.sin(halfYaw)],
    [Math.cos(halfPitch), 0, Math.sin(halfPitch), 0],
  );
}

function motionTranslation(geometry, motion, value, worldYaw) {
  if (!TRANSLATION_KINDS.has(motion?.kind)) return [0, 0, 0];
  if (Array.isArray(motion.direction)) return rotateWorldXY(normalize(motion.direction), worldYaw).map((component) => component * value);
  return axisVector(motion.axis).map((component) => component * value);
}

// New mechanisms own an explicit simulation clock. Legacy descriptors retain
// each caller's historical scale (practice=1, race/preview=.5).
export function geometryObstacleTime(geometry, simulationTime, legacyScale = 1) {
  return simulationTime * (geometry.obstacleClock?.simulationScale ?? legacyScale);
}

// Shared preview contract: countdown is to an actual dwell/transition boundary
// or sinusoid reversal, never an invented traversability deadline.
export function geometryMotionState(geometry, simulationTime, legacyScale = 1) {
  const m = geometry.motion, scale = geometry.obstacleClock?.simulationScale ?? legacyScale;
  const time = geometryObstacleTime(geometry, simulationTime, legacyScale);
  if (!m) return null;
  if (m.cycle) {
    const state = cycleState(m.cycle, time);
    return {...state, velocity:state.velocity*(m.amplitude??0)*scale, nextIn:state.nextIn/scale, boundary:'phase change'};
  }
  if (!m.frequency) return {phase:m.kind==='belt'?'upstream / returning underneath':'continuous rotation', nextIn:null, velocity:(m.kind==='belt'?-1:1)*(m.speed??0)*scale};
  const angle = 2*Math.PI*m.frequency*time+(m.phase??0);
  const phase = ((angle-Math.PI/2) % Math.PI + Math.PI) % Math.PI;
  const nextIn = (Math.PI-phase)/(2*Math.PI*m.frequency*scale);
  return {phase:'moving', velocity:(m.amplitude??0)*2*Math.PI*m.frequency*Math.cos(angle)*scale, nextIn, boundary:'direction reversal'};
}

// Integrate actual RAF timestamps once; changing preview speed never jumps phase.
export function advancePreviewClock(clock, frameTime, speed = 1) {
  const delta = clock.frameTime == null ? 0 : Math.max(0, (frameTime-clock.frameTime)/1000);
  return {frameTime, simulationTime:clock.simulationTime+delta*speed};
}

export function sampleGeometryPose(geometry, time = 0) {
  const motion = geometry.motion ?? null;
  if (motion?.kind === 'belt') {
    const length=motion.to-motion.from, height=motion.top-motion.bottom, loop=2*(length+height);
    const u=((motion.phase+motion.speed*time)%loop+loop)%loop;
    let x,z,vx,vz;
    if(u<length){x=length-u;z=motion.top;vx=-motion.speed;vz=0;}
    else if(u<length+height){x=0;z=motion.top-(u-length);vx=0;vz=-motion.speed;}
    else if(u<2*length+height){x=u-length-height;z=motion.bottom;vx=motion.speed;vz=0;}
    else{x=length;z=motion.bottom+u-2*length-height;vx=0;vz=motion.speed;}
    const delta=rotateWorldXY([x,0,0],geometry.yaw??0), position=[geometry.pos[0]+delta[0],geometry.pos[1]+delta[1],z];
    return {pos:position,position,quaternion:quaternionFromPose(geometry.yaw??0),value:u,worldYaw:geometry.yaw??0,yaw:geometry.yaw??0,pitch:0,localPos:[0,0,0],surfaceQpos:[x,z-geometry.pos[2]],surfaceQvel:[vx,vz]};
  }
  const value = motion ? motionValue(motion, time) : 0;
  const baseYaw = geometry.yaw ?? 0;
  const worldYaw = baseYaw + (motion && !TRANSLATION_KINDS.has(motion.kind) && motion.kind !== 'rock' && motion.kind !== 'seesaw-access' ? value : 0);
  const translation = motionTranslation(geometry, motion, value, worldYaw);
  const position = geometry.pos.map((component, index) => component + translation[index]);
  let pitch = geometry.pitch ?? motion?.pitch ?? 0;
  const angularSpeed = m => (m.amplitude??0)*2*Math.PI*(m.frequency??0)*Math.cos(2*Math.PI*(m.frequency??0)*time+(m.phase??0));
  let surfaceQpos, surfaceQvel;
  if (motion?.kind === 'rock') {pitch += value;surfaceQpos=[value];surfaceQvel=[angularSpeed(motion)];}
  if (motion?.kind === 'seesaw-access') {
    const height = end => end ? end.z - Math.sin(motionValue(end.motion, time)) * end.x + end.thickness * Math.cos(motionValue(end.motion, time)) : (motion.floorHeight??.004);
    const velocity = end => {if(!end)return 0;const theta=motionValue(end.motion,time);return (-end.x*Math.cos(theta)-end.thickness*Math.sin(theta))*angularSpeed(end.motion);};
    const a = height(motion.ends[0]), b = height(motion.ends[1]);
    // Fixed-length hinged bridge: its projected reach shortens slightly as it
    // tilts; descriptor end overlaps cover that travel without stretching geoms.
    pitch = -Math.asin(Math.max(-1,Math.min(1,(b-a)/motion.length)));
    position[2] = (a+b)/2 - geometry.size[2]*Math.cos(pitch);
    const va=velocity(motion.ends[0]),vb=velocity(motion.ends[1]);
    const vp=-(vb-va)/(motion.length*Math.cos(pitch));
    surfaceQpos=[position[2]-geometry.pos[2],pitch];
    surfaceQvel=[(va+vb)/2+geometry.size[2]*Math.sin(pitch)*vp,vp];
  }
  const quaternion = quaternionFromPose(worldYaw, pitch);
  return {
    pos: position,
    position,
    quaternion,
    value,
    worldYaw,
    yaw: worldYaw,
    pitch,
    localPos: [...(geometry.localPos ?? [0, 0, 0])],
    ...(surfaceQpos ? {surfaceQpos,surfaceQvel} : {}),
  };
}

export function applyGeometryPoseToMocap(data, mocapId, geometry, time = 0) {
  const pose = sampleGeometryPose(geometry, time);
  data.mocap_pos.set(pose.position, mocapId * 3);
  data.mocap_quat.set(pose.quaternion, mocapId * 4);
  return pose;
}

// Only environment joint coordinates are prescribed. Their nonzero qvel is
// essential: pose-only mocap has zero tangential contact velocity in MuJoCo.
export function driveNativeSurface(mujoco,model,data,geometry,index,simulationTime,legacyScale=1,phase=0){
  const t=phase+geometryObstacleTime(geometry,simulationTime,legacyScale),p=sampleGeometryPose(geometry,t);
  const values=p.surfaceQpos??[p.value];
  const scale=geometry.obstacleClock?.simulationScale??legacyScale;
  const velocities=p.surfaceQvel??[geometry.motion.speed];
  for(let k=0;k<values.length;k++){
    const id=mujoco.mj_name2id(model,mujoco.mjtObj.mjOBJ_JOINT.value,`env_surface_${geometry.name}_${index}_${k}`);
    if(id<0)throw Error(`Missing native surface joint: ${geometry.name}`);
    data.qpos[model.jnt_qposadr[id]]=values[k];data.qvel[model.jnt_dofadr[id]]=velocities[k]*scale;
  }
}

export function driveDynamicGeometryPhysics(env, physics, time = 0) {
  const { mujoco, model, data } = physics ?? {};
  if (!mujoco || !model || !data) return;
  for (const [index, geometry] of env.geometry.entries()) {
    if (!geometry.dynamic || !geometry.motion) continue;
    if(geometry.nativeSurface){driveNativeSurface(mujoco,model,data,geometry,index,time);continue;}
    const bodyId = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY.value, `env_motion_${geometry.name}_${index}`);
    if (bodyId < 0) continue;
    const mocapId = model.body_mocapid[bodyId];
    if (mocapId < 0) continue;
    applyGeometryPoseToMocap(data, mocapId, geometry, geometryObstacleTime(geometry, time));
  }
  mujoco.mj_forward(model, data);
}

export const geometryPoseAt = sampleGeometryPose;
