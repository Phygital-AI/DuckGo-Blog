// Environment registry for the obstacle benchmark.
//
// Every entry is deliberately small and single-purpose.  The registry is
// data-first so the same definition can be consumed by the browser loader,
// the visual scene builder, the episode runtime, and a future Python export.

import { correctedGeometry } from './correctedGeometry.js';
import { courseFor } from './course.js';

export const PLATFORM_IDS = Object.freeze([
  "microduck",
  "quadruped",
  "wheel_leg",
  "wheel_biped",
]);

const V = (type, name, pos, size, extra = {}) => ({
  type, name, pos, size, collision: extra.collision ?? true,
  color: extra.color ?? "#29445d", dynamic: extra.dynamic ?? false,
  motion: extra.motion ?? null,
});
const B = (name, pos, size, extra) => V("box", name, pos, size, extra);
const C = (name, pos, radius, height, extra = {}) => V("cylinder", name, pos, [radius, height], extra);
const W = (name, pos, size) => V("water", name, pos, size, { collision: false, color: "#249cc7" });
const M = (name, pos, size, extra) => V("marker", name, pos, size, { collision: false, ...extra });

const G = {
  route: () => [],
  climb: (kind) => kind === "low-wall"
    ? [B("low_wall", [0.15, 0, 0.22], [0.12, 0.55, 0.22], { color: "#c36a4e" })]
    : kind === "slope-wall"
      ? [B("slope_wall", [0.2, 0, 0.25], [0.32, 0.65, 0.25], { color: "#b97858", motion: { kind: "ramp", pitch: -0.48 } })]
      : [B("climb_box", [0.2, 0, 0.28], [0.3, 0.62, 0.28], { color: "#c36a4e" })],
  cross: (kind) => kind === "hurdle"
    ? [B("low_hurdle", [0.15, 0, 0.17], [0.07, 0.58, 0.17], { color: "#d39b50" })]
    : kind === "trench"
      ? [B("trench_left", [0.14, -0.43, 0.04], [0.38, 0.18, 0.04], { color: "#625371" }), B("trench_right", [0.14, 0.43, 0.04], [0.38, 0.18, 0.04], { color: "#625371" })]
      : [C("stepping_1", [-0.25, 0, 0.09], 0.18, 0.18, { color: "#8e8779" }), C("stepping_2", [0.2, 0.28, 0.13], 0.2, 0.26, { color: "#8e8779" }), C("stepping_3", [0.65, -0.22, 0.16], 0.2, 0.32, { color: "#8e8779" }), B("stepping_hurdle", [1.05, 0, 0.14], [0.06, 0.55, 0.14], { color: "#d39b50" })],
  balance: (kind) => kind === "board"
    ? [B("balance_board", [0.25, 0, 0.08], [0.82, 0.38, 0.08], { color: "#8374ad", motion: { kind: "rock", axis: "y", amplitude: 0.12, frequency: 1.1 } })]
    : kind === "tilt"
      ? [B("tilt_platform", [0.25, 0, 0.1], [0.85, 0.52, 0.1], { color: "#8374ad", motion: { kind: "ramp", pitch: -0.2 } })]
      : [C("single_point", [0.25, 0, 0.14], 0.23, 0.28, { color: "#8374ad" })],
  narrow: (kind) => {
    const width = kind === "bridge" ? 0.34 : 0.25;
    const rails = [B("narrow_left", [0.3, -width, 0.11], [0.95, 0.045, 0.11], { color: "#4d7b8c" }), B("narrow_right", [0.3, width, 0.11], [0.95, 0.045, 0.11], { color: "#4d7b8c" })];
    if (kind === "rail") rails.push(B("rail_deck", [0.3, 0, 0.035], [0.95, 0.06, 0.035], { color: "#b89058" }));
    if (kind === "turn") rails.forEach((rail, i) => { rail.pos[0] = 0.35; rail.motion = { kind: "turn-rail", side: i === 0 ? -1 : 1 }; });
    return rails;
  },
  terrain: (kind) => kind === "rubble"
    ? [-0.05, 0.45, 0.95, 1.45].map((x, i) => C(`rubble_${i}`, [x, i % 2 ? 0.22 : -0.18, 0.08 + (i % 2) * 0.04], 0.16, 0.16 + (i % 2) * 0.08, { color: "#716e68" }))
    : kind === "bumps"
      ? [-0.1, 0.45, 1.0, 1.55].map((x, i) => C(`bump_${i}`, [x, 0, 0.07], 0.25, 0.14, { color: "#56755c" }))
      : [B("soft_patch", [0.65, 0, 0.025], [1.05, 0.9, 0.025], { color: "#7f6658" })],
  slope: (kind) => [B(`slope_${kind}`, [0.35, 0, 0.1], [1.05, 0.85, 0.1], { color: "#5c7d6b", motion: { kind: "ramp", pitch: kind === "down" ? 0.2 : -0.2 } })],
  crawl: (kind) => kind === "door"
    ? [B("door_left", [0.28, -0.5, 0.28], [0.08, 0.1, 0.28], { color: "#7e586f" }), B("door_right", [0.28, 0.5, 0.28], [0.08, 0.1, 0.28], { color: "#7e586f" }), B("door_header", [0.28, 0, 0.56], [0.08, 0.6, 0.08], { color: "#7e586f" })]
    : kind === "mesh"
      ? [B("mesh_gate", [0.3, 0, 0.25], [0.07, 0.8, 0.25], { color: "#637b8d" })]
      : [B("pipe_left", [0.3, -0.42, 0.22], [0.75, 0.08, 0.22], { color: "#65768e" }), B("pipe_right", [0.3, 0.42, 0.22], [0.75, 0.08, 0.22], { color: "#65768e" }), B("pipe_top", [0.3, 0, 0.49], [0.75, 0.5, 0.07], { color: "#65768e" })],
  climbHigh: (kind) => kind === "ramp"
    ? [B("climb_ramp", [0.35, 0, 0.18], [1.0, 0.72, 0.18], { color: "#756e5c", motion: { kind: "ramp", pitch: -0.48 } })]
    : kind === "wall"
      ? [B("climb_face", [0.4, 0, 0.36], [0.12, 0.75, 0.36], { color: "#756e5c" })]
      : [C("rock_1", [0.1, -0.23, 0.15], 0.18, 0.3, { color: "#756e5c" }), C("rock_2", [0.45, 0.23, 0.23], 0.18, 0.46, { color: "#756e5c" }), C("rock_3", [0.8, -0.2, 0.31], 0.16, 0.62, { color: "#756e5c" })],
  hang: (kind) => kind === "monkey"
    ? [C("hang_post_l", [0.35, -0.52, 0.5], 0.045, 1.0, { color: "#ba8950" }), C("hang_post_r", [0.35, 0.52, 0.5], 0.045, 1.0, { color: "#ba8950" }), B("hang_bar", [0.35, 0, 0.96], [0.06, 0.56, 0.06], { color: "#ba8950" })]
    : kind === "rings"
      ? [C("ring_frame_l", [0.35, -0.52, 0.55], 0.045, 1.1, { color: "#ba8950" }), C("ring_frame_r", [0.35, 0.52, 0.55], 0.045, 1.1, { color: "#ba8950" }), C("ring_a", [0.05, -0.2, 0.9], 0.13, 0.02, { color: "#62d7dc" }), C("ring_b", [0.55, 0.2, 0.9], 0.13, 0.02, { color: "#62d7dc" })]
      : [C("transfer_post_l", [0.35, -0.5, 0.7], 0.045, 1.4, { color: "#ba8950" }), C("transfer_post_r", [0.35, 0.5, 0.7], 0.045, 1.4, { color: "#ba8950" }), B("transfer_bar", [0.35, 0, 0.9], [0.05, 0.55, 0.05], { color: "#62d7dc" })],
  carry: (kind) => kind === "box"
    ? [B("carry_box", [0.3, 0, 0.22], [0.22, 0.25, 0.22], { color: "#ba7b4d" }), M("carry_target", [1.6, 0, 0.01], [0.32, 0.32, 0.01], { color: "#baf26e" })]
    : kind === "bucket"
      ? [C("carry_bucket", [0.3, 0, 0.16], 0.16, 0.28, { color: "#ba7b4d" }), M("carry_target", [1.6, 0, 0.01], [0.32, 0.32, 0.01], { color: "#baf26e" })]
      : kind === "cart"
        ? [B("cart_body", [0.45, 0, 0.18], [0.42, 0.42, 0.18], { color: "#ba7b4d" }), B("cart_handle", [-0.05, 0, 0.38], [0.05, 0.42, 0.05], { color: "#ba7b4d" }), M("cart_target", [1.7, 0, 0.01], [0.36, 0.36, 0.01], { color: "#baf26e" })]
        : [B("drag_load", [0.4, 0, 0.15], [0.24, 0.32, 0.15], { color: "#84586c" }), M("drag_target", [1.6, 0, 0.01], [0.32, 0.32, 0.01], { color: "#baf26e" })],
  interact: (kind) => kind === "door"
    ? [B("push_door", [0.42, 0, 0.45], [0.06, 0.72, 0.45], { color: "#7e586f", motion: { kind: "swing", axis: "z", amplitude: 0.0 } }), M("push_plate", [0.32, -0.74, 0.48], [0.05, 0.05, 0.08], { color: "#ffbd62" })]
    : kind === "button"
      ? [B("button_panel", [0.42, 0, 0.38], [0.06, 0.5, 0.38], { color: "#526d86" }), C("button", [0.33, -0.06, 0.42], 0.08, 0.05, { color: "#ff5e65" })]
      : [B("knob_panel", [0.42, 0, 0.38], [0.06, 0.5, 0.38], { color: "#526d86" }), C("knob", [0.33, 0, 0.43], 0.11, 0.05, { color: "#62d7dc" })],
  water: (kind) => kind === "shallow"
    ? [W("shallow_water", [0.7, 0, 0.012], [0.95, 0.9, 0.012])]
    : kind === "channel"
      ? [W("water_channel", [0.55, 0, 0.012], [0.5, 0.95, 0.012]), B("channel_bank_l", [0.55, -0.56, 0.08], [0.5, 0.08, 0.08], { color: "#5b7667" }), B("channel_bank_r", [0.55, 0.56, 0.08], [0.5, 0.08, 0.08], { color: "#5b7667" })]
      : [W("water_steps", [0.65, 0, 0.012], [0.62, 0.9, 0.012]), B("water_step_1", [0.35, 0, 0.05], [0.12, 0.65, 0.05], { color: "#72836d" }), B("water_step_2", [0.85, 0, 0.1], [0.12, 0.65, 0.1], { color: "#72836d" })],
  lowFriction: (kind) => [B(`low_friction_${kind}`, [0.65, 0, 0.018], [1.05, 0.9, 0.018], { color: kind === "ice" ? "#69a6c3" : "#765d4f" })],
  dynamic: (kind) => kind === "swing"
    ? [B("swing_gate", [0.62, 0, 0.36], [0.06, 0.78, 0.36], { color: "#d19e4d", dynamic: true, motion: { kind: "swing", axis: "z", amplitude: 0.72, frequency: 0.65 } })]
    : kind === "sweep"
      ? [C("sweep_pivot", [0.62, 0, 0.42], 0.08, 0.84, { color: "#d19e4d" }), B("sweep_bar", [0.62, 0, 0.42], [0.06, 0.82, 0.06], { color: "#d19e4d", dynamic: true, motion: { kind: "rotate", axis: "z", amplitude: 3.14, frequency: 0.55 } })]
      : [B("moving_block", [0.62, 0, 0.22], [0.22, 0.35, 0.22], { color: "#d16a5d", dynamic: true, motion: { kind: "slide", axis: "y", amplitude: 0.52, frequency: 0.22 } })],
  lowClearance: () => [],
};

const categoryDefaults = {
  路线: { key: "route", abilities: ["目标识别与路线保持", "速度控制", "终点判断"], metrics: ["到达率", "路线偏差", "完成时间"], fits: ["microduck"] },
  翻越: { key: "climb", abilities: ["质心抬升与全身协调", "接触点选择与支撑转换", "落地冲击吸收与恢复"], metrics: ["越障成功率", "质心高度裕量", "落地姿态误差"], fits: ["microduck", "quadruped"] },
  跨越: { key: "cross", abilities: ["步态节律与抬脚高度", "离散落脚点规划", "跨步后的速度恢复"], metrics: ["跨越完成率", "足端落点误差", "跨越后速度恢复时间"], fits: ["microduck", "quadruped", "wheel_leg", "wheel_biped"] },
  平衡: { key: "balance", abilities: ["姿态稳定与抗扰", "支撑多边形管理", "速度与身体摆动解耦"], metrics: ["姿态 RMS 误差", "支撑丢失率", "扰动后恢复时间"], fits: ["microduck", "quadruped", "wheel_biped"] },
  窄道: { key: "narrow", abilities: ["横向误差控制", "曲率预瞄与转向", "边界感知与速度调节"], metrics: ["中心线偏差", "越界次数", "转向提前量"], fits: ["microduck", "wheel_leg", "wheel_biped"] },
  地形: { key: "terrain", abilities: ["地形感知与足端选择", "接触顺应与冲击处理", "不确定地面上的步态调整"], metrics: ["地形通过率", "足端滑移量", "能耗与步态变化幅度"], fits: ["quadruped", "wheel_leg", "microduck"] },
  坡度: { key: "slope", abilities: ["重力补偿与牵引控制", "上/下坡速度管理", "横坡转向和制动"], metrics: ["坡面完成率", "速度跟踪误差", "滑移率"], fits: ["quadruped", "wheel_leg", "microduck", "wheel_biped"] },
  钻越: { key: "crawl", abilities: ["身体轮廓与可通行性判断", "下蹲/俯身姿态控制", "受限通道中的方向保持"], metrics: ["通行成功率", "与边界最小间隙", "姿态切换时间"], fits: ["microduck", "quadruped"] },
  攀爬: { key: "climbHigh", abilities: ["多接触点协同", "支撑转换与牵引", "局部落脚点规划"], metrics: ["高度增益率", "接触成功率", "滑落距离"], fits: ["microduck", "quadruped"] },
  悬挂: { key: "hang", abilities: ["上肢抓取与释放时机", "摆动动力学利用", "无地面支撑下的身体协调"], metrics: ["连续转移率", "抓取成功率", "悬挂能耗"], fits: ["microduck"] },
  搬运: { key: "carry", abilities: ["负载状态估计", "接触力与身体平衡", "任务目标与路线联合规划"], metrics: ["任务完成率", "负载偏移量", "接触力峰值", "单位距离能耗"], fits: ["microduck", "wheel_leg"] },
  交互: { key: "interact", abilities: ["目标识别与接触定位", "动作方向和力度控制", "操作结果确认"], metrics: ["交互成功率", "接触定位误差", "无效接触次数", "动作时间"], fits: ["microduck"] },
  涉水: { key: "water", abilities: ["水面/边界识别", "湿滑接触下的步态调整", "入口与出口状态切换"], metrics: ["涉水成功率", "滑移量", "姿态波动", "通过时间"], fits: ["quadruped", "wheel_leg", "microduck"] },
  低摩擦: { key: "lowFriction", abilities: ["摩擦估计与牵引控制", "平滑加减速", "滑移后的姿态恢复"], metrics: ["滑移率", "制动距离", "速度波动", "跌倒率"], fits: ["wheel_leg", "quadruped", "wheel_biped", "microduck"] },
  动态障碍: { key: "dynamic", abilities: ["运动状态估计与时机判断", "等待/通行决策", "动态场景中的路线重规划"], metrics: ["窗口命中率", "碰撞率", "无效等待时间", "重规划次数"], fits: ["microduck", "quadruped", "wheel_leg"] },
  低矮通道: { key: "lowClearance", abilities: ["动态障碍预测", "坐下/站起时机", "姿态切换后快速通过"], metrics: ["低姿态时机误差", "通行成功率", "姿态切换耗时"], fits: ["microduck"] },
};

const defs = [
  ["路线", [["平地路线到终点", "flat"], ["毛巾入框与踢球路线", "skill-carry-kick"], ["连续障碍前滚", "roll-bars"]]],
  ["翻越", [["低墙翻越", "low-wall"], ["斜面墙翻越", "slope-wall"], ["箱体翻越", "box"]]],
  ["跨越", [["低栏跨越", "hurdle"], ["沟槽跨越", "trench"], ["梅花桩跨越", "stepping"]]],
  ["平衡", [["平衡板", "board"], ["倾斜平台", "tilt"], ["单点支撑台", "point"]]],
  ["窄道", [["窄桥", "bridge"], ["窄轨道", "rail"], ["窄弯道", "turn"]]],
  ["地形", [["碎石地", "rubble"], ["凸块地", "bumps"], ["软地面", "soft"]]],
  ["坡度", [["上坡", "up"], ["下坡", "down"], ["斜坡转弯", "turn"]]],
  ["钻越", [["窄门洞通过", "door"], ["网下钻越", "mesh"], ["管道钻越", "pipe"]]],
  ["攀爬", [["攀爬斜坡", "ramp"], ["攀爬墙", "wall"], ["岩点攀爬", "rocks"]]],
  ["悬挂", [["猴架悬挂", "monkey"], ["圆环转移", "rings"], ["横向吊杆转移", "bar"]]],
  ["搬运", [["抱箱搬运", "box"], ["提桶搬运", "bucket"], ["推车运输", "cart"], ["拖拽负载", "drag"]]],
  ["交互", [["推门通过", "door"], ["按钮按压", "button"], ["旋钮旋转", "knob"]]],
  ["涉水", [["浅水直穿", "shallow"], ["水沟通行", "channel"], ["涉水台阶", "steps"]]],
  ["低摩擦", [["泥地通行", "mud"], ["冰面通行", "ice"], ["湿滑斜坡", "wet-slope"]]],
  ["动态障碍", [["摆动闸门", "swing"], ["旋转扫杆", "sweep"], ["移动封路块", "block"]]],
  ["低矮通道", [["单向旋转横杆", "one-way"], ["往复式滑动低矮通道", "reciprocal"]]],
];

const setupText = {
  "低墙翻越": "固定高度墙体，要求前后肢跨过并稳定落地",
  "斜面墙翻越": "带坡度接触面，要求建立支撑并连续上移",
  "箱体翻越": "标准箱体边缘，要求上肢或前肢辅助通过",
  "低栏跨越": "单根低栏，要求保持行进节奏的同时抬腿通过",
  "沟槽跨越": "固定宽度沟槽，要求预测落脚点并完成一次跨步",
  "梅花桩跨越": "错位离散踏板，要求规划连续落脚序列",
  "连续障碍前滚": "直线路线上每隔固定距离设置低障碍条，调用官方 roulade 前滚策略连续越过障碍并到达终点",
  "单向旋转横杆": "路线边缘每隔一段设置一根绕竖直轴连续旋转的低横杆，要求保持前进并选择横向躲避时机",
};

const geometryFor = (category, variant) => {
  const d = categoryDefaults[category];
  const raw = G[d.key](variant);
  return raw.map((g) => ({ ...g, pos: [...g.pos], size: [...g.size] }));
};

const makeEnv = (category, [title, variant], index) => {
  const d = categoryDefaults[category];
  const id = `${d.key.toLowerCase()}_${variant.replace(/[^a-z0-9]+/gi, "-")}`;
  const projectIndex = index + 1;
  const rollBars = id === 'route_roll-bars';
  return Object.freeze({
    id,
    category,
    projectIndex,
    title,
    course: courseFor(id),
    description: setupText[title] ?? `参数化${category}场景，要求机器人完成${title}并到达目标区`,
    abilities: rollBars ? ["障碍间距与路线保持", "前滚策略触发时机", "滚动后的姿态恢复"] : d.abilities,
    metrics: rollBars ? ["连续翻滚成功率", "障碍碰撞次数", "翻滚后恢复时间", "完成时间"] : d.metrics,
    fits: rollBars ? ["microduck"] : d.fits,
    recommendedPolicies: rollBars ? ["walk", "roulade"] : undefined,
    geometry: correctedGeometry(id, geometryFor(category, variant)),
    spawn: Object.freeze({ x: -1.9, y: 0, z: 0.12, yaw: 0 }),
    goal: Object.freeze({ x: id.startsWith('lowclearance_') ? 3.6 : rollBars ? 4.6 : 1.85, y: id === 'narrow_turn' ? .8 : 0, z: 0, radius: 0.28 }),
    // Long routes and dynamic courses allow 10 minutes of simulation at 50 Hz.
    // Paused previews do not advance the episode clock, so this is simulation
    // execution time rather than elapsed wall-clock time.
    timeLimitSteps: id.startsWith('dynamic_') || id.startsWith('lowclearance_') || id.startsWith('route_') || rollBars ? 30000 : 1500,
    taskChecks: id === 'route_skill-carry-kick' ? ['towelDelivered', 'ballCleared'] : undefined,
    observation: Object.freeze({ size: 24, fields: ["goal_dx", "goal_dy", "goal_distance", "goal_heading", "base_vx", "base_vy", "base_wz", "roll", "pitch", "yaw", "height", "fall_flag", "progress", "phase", "nearest_obstacle_dx", "nearest_obstacle_dy", "nearest_obstacle_clearance", "nearest_obstacle_height", "command_vx", "command_vy", "command_wz", "collision_flag", "recovery_flag", "time_remaining"] }),
    action: Object.freeze({ size: 3, low: [-0.2, -0.1, -0.3], high: [0.75, 0.1, 0.3], names: ["vx", "vy", "wz"] }),
    reward: Object.freeze({ progress: 1.0, success: 10.0, collision: -1.0, fall: -2.0, energy: -0.002, time: -0.001 }),
  });
};

export const ENVIRONMENTS = Object.freeze(defs.flatMap(([category, entries]) => entries.map((entry, i) => makeEnv(category, entry, i))));
export const ENV_CATALOG = ENVIRONMENTS;
export const ENVIRONMENTS_BY_ID = Object.freeze(Object.fromEntries(ENVIRONMENTS.map((env) => [env.id, env])));
export const ENVIRONMENTS_BY_CATEGORY = Object.freeze(Object.fromEntries(defs.map(([category]) => [category, ENVIRONMENTS.filter((env) => env.category === category)])));

export function getEnvironment(id) {
  return ENVIRONMENTS_BY_ID[id] ?? ENVIRONMENTS[0];
}

export function getEnvironmentSummary(envOrId) {
  const env = typeof envOrId === "string" ? getEnvironment(envOrId) : envOrId;
  return { id: env.id, category: env.category, title: env.title, projectIndex: env.projectIndex, description: env.description, abilities: env.abilities, metrics: env.metrics, fits: env.fits, recommendedPolicies: env.recommendedPolicies ?? [], spawn: env.spawn, goal: env.goal, checkpoints: env.checkpoints ?? [], timeLimitSteps: env.timeLimitSteps, observationSize: env.observation.size, actionSize: env.action.size, fullCourse: env.fullCourse ?? null, circuit: env.circuit ?? null };
}

export function countEnvironments() {
  return ENVIRONMENTS.length;
}
