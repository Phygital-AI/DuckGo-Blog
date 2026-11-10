// The verified, end-to-end Microduck obstacle course.
//
// This is intentionally a fixed course rather than a loose concatenation of
// modules: every stage has an explicit entry/exit, a checkpoint, a strategy
// hint, and a short connector.  Geometry, the MuJoCo route, the runtime
// checkpoint logic and the current circuit geometry consume this descriptor.

import { getEnvironment } from "./catalog.js";

const STAGE_SPECS = Object.freeze([
  {
    id: "flat-run",
    envId: "route_flat",
    title: "平底高速段",
    shortTitle: "RUN",
    start: [-1.9, 0],
    end: [0.65, 0],
    strategy: "runStraight",
    strategyLabel: "Run V2 · 0.75 直线跑",
    purpose: "建立速度，沿黄色路线稳定赶路",
    color: "#baf26e",
  },
  {
    id: "dynamic-swing",
    envId: "dynamic_swing",
    title: "摆动闸门",
    shortTitle: "GATE",
    start: [1.75, 0.38],
    end: [5.5, 0.38],
    strategy: "walk",
    strategyLabel: "Walk + stand_and_wait",
    purpose: "观察闸门窗口，关闭时等待，打开后通过",
    color: "#62e7f3",
  },
  {
    id: "lowclearance-one-way",
    envId: "lowclearance_one-way",
    title: "单向旋转横杆",
    shortTitle: "DODGE BAR",
    start: [6.75, -0.38],
    end: [10.5, -0.38],
    strategy: "walk",
    strategyLabel: "Walk + lateral dodge",
    purpose: "观察横杆旋转窗口，沿路线横向躲避并继续前进",
    color: "#ffbf69",
  },
  {
    id: "lowclearance-reciprocal",
    envId: "lowclearance_reciprocal",
    title: "往复式低矮滑板",
    shortTitle: "CROUCH 2",
    start: [11.8, 0.38],
    end: [15.55, 0.38],
    strategy: "sitstand",
    strategyLabel: "Sit → Wait → Stand",
    purpose: "判断往复运动相位，在安全窗口中通过",
    color: "#c9a7ff",
  },
  {
    id: "roll-bars",
    envId: "route_roll-bars",
    title: "连续低栏前滚",
    shortTitle: "ROULADE",
    start: [16.85, -0.2],
    end: [23.55, -0.2],
    strategy: "roulade",
    strategyLabel: "Walk → Roulade → Stand",
    purpose: "逐个识别低栏，停下后完整调用官方前滚策略",
    color: "#ff8a76",
  },
]);

const connector = (from, to) => {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  // Three gentle bends make the lane change visible in the scene while
  // keeping x strictly increasing for the checkpoint progress metric.
  return [
    [from[0] + dx * 0.25, from[1] + dy * 0.08],
    [from[0] + dx * 0.5, from[1] + dy * 0.72],
    [from[0] + dx * 0.78, from[1] + dy * 0.96],
    [...to],
  ];
};

const localToWorld = (geometry, stage, stageIndex) => ({
  ...geometry,
  name: `stage${stageIndex}_${geometry.name}`,
  pos: [
    stage.start[0] + (geometry.pos[0] - (-1.9)),
    stage.start[1] + geometry.pos[1],
    geometry.pos[2],
  ],
  size: [...geometry.size],
  motion: geometry.motion ? { ...geometry.motion } : null,
});

const stageGeometry = (stage, stageIndex) => {
  const env = getEnvironment(stage.envId);
  const geometry = env.geometry.map((item) => localToWorld(item, stage, stageIndex));
  const obstacleXs = geometry
    .filter((item) => item.collision && item.pos[0] > stage.start[0] + 0.1)
    .map((item) => item.pos[0])
    .sort((a, b) => a - b);
  // Checkpoint lines are non-colliding but provide a visible stage rhythm.
  geometry.push({
    type: "marker",
    name: `stage${stageIndex}_entry_marker`,
    pos: [stage.start[0], stage.start[1], 0.008],
    size: [0.018, 0.62, 0.008],
    collision: false,
    color: stage.color,
    dynamic: false,
    motion: null,
  });
  return { geometry, obstacleXs };
};

const buildPath = (stageSpecs) => {
  const path = [stageSpecs[0].start];
  for (let i = 0; i < stageSpecs.length; i += 1) {
    const stage = stageSpecs[i];
    if (i > 0) path.push(...connector(stageSpecs[i - 1].end, stage.start));
    path.push([...stage.end]);
  }
  return path;
};

const buildStageData = (stageSpecs) => stageSpecs.map((stage, index) => {
  const built = stageGeometry(stage, index);
  return Object.freeze({
    ...stage,
    index,
    geometryPrefix: `stage${index}_`,
    obstacleXs: Object.freeze(built.obstacleXs),
    checkpoint: Object.freeze({ x: stage.end[0], y: stage.end[1], halfWidth: 0.62, title: stage.title }),
    geometry: built.geometry,
  });
});

const buildCourse = ({ id, title, description, abilities, metrics, name, stageSpecs }) => {
  const stageData = buildStageData(stageSpecs);
  const geometry = stageData.flatMap((stage) => stage.geometry);
  const path = buildPath(stageSpecs);
  const pathLength = path.slice(1).reduce((sum, point, index) => {
    const previous = path[index];
    return sum + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  }, 0);
  const finalStage = stageData[stageData.length - 1];

  return Object.freeze({
    id,
    title,
    category: "完整障碍赛",
    projectIndex: 1,
    description,
    abilities,
    metrics,
    fits: ["microduck"],
    spawn: Object.freeze({ x: stageSpecs[0].start[0], y: stageSpecs[0].start[1], z: 0.12, yaw: 0 }),
    goal: Object.freeze({ x: finalStage.end[0], y: finalStage.end[1], z: 0, radius: 0.32 }),
    geometry,
    checkpoints: Object.freeze(stageData.map((stage) => stage.checkpoint)),
    course: Object.freeze({ halfWidth: 0.62, spawnHeight: 0, goalHeight: 0, path }),
    timeLimitSteps: 60000,
    observation: Object.freeze({ size: 24, fields: ["goal_dx", "goal_dy", "goal_distance", "goal_heading", "base_vx", "base_vy", "base_wz", "roll", "pitch", "yaw", "height", "fall_flag", "progress", "phase", "nearest_obstacle_dx", "nearest_obstacle_dy", "nearest_obstacle_clearance", "nearest_obstacle_height", "command_vx", "command_vy", "command_wz", "collision_flag", "recovery_flag", "time_remaining"] }),
    action: Object.freeze({ size: 3, low: [-0.2, -0.1, -0.3], high: [0.75, 0.1, 0.3], names: ["vx", "vy", "wz"] }),
    reward: Object.freeze({ progress: 1.0, success: 20.0, collision: -1.0, fall: -2.0, energy: -0.002, time: -0.001 }),
    fullCourse: Object.freeze({
      name,
      stageCount: stageData.length,
      routeLength: pathLength,
      stages: Object.freeze(stageData.map(({ geometry: stageGeometryData, ...stage }) => stage)),
    }),
  });
};

export const FULL_OBSTACLE_COURSE = buildCourse({
  id: "full_obstacle_course",
  title: "Microduck 完整障碍赛",
  name: "Microduck 完整障碍赛",
  description: "平底加速 → 摆动闸门 → 间隔旋转横杆躲避 → 往复式低矮滑板 → 连续低栏前滚；每段之间有弯道和缓冲直道。",
  abilities: ["长距离路线保持", "速度与策略切换", "动态窗口判断", "姿态切换", "连续技能调用", "跌倒恢复"],
  metrics: ["是否成功", "完成时间", "路线偏差", "跌倒次数", "策略切换次数", "动态障碍等待时间", "前滚通过率"],
  stageSpecs: STAGE_SPECS,
});
