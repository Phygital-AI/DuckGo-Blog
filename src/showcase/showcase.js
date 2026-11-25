import './academic.css';
import { GAUNTLET_CIRCUIT } from '../envs/gauntletCircuit.js';
import { renderLeaderboard } from './leaderboard.js';
import { configureNarrative, renderNarrative } from './narrative.js';
import { mountArticleNavigation } from './articleNavigation.js';

const courseStages = GAUNTLET_CIRCUIT.fullCourse.stages;
const stageEnglishTitles = ['Two narrow gates', 'Five-post slalom', 'Two swing gates', 'One swing gate', 'Three rotating sweep bars', 'Three sliding panels', 'Three reciprocating low bars (staggered)', 'Six segmented low rails', 'Four alternating gates', 'Three swing gates', 'Rotating turntable array', 'Reverse conveyor', 'Three lift walls with safe refuges', 'Three reciprocating low bars (synchronized)', 'Three sliding panels', 'Seven full-width ground bars'];
const courseStageTitle = (stage, lang) => {
  if (lang === 'en') return stageEnglishTitles[stage.index] ?? stage.titleEn;
  return stage.index === 8 ? '四道交错窄门' : stage.title;
};
const { lapLength, trackWidth, stageCount } = GAUNTLET_CIRCUIT.circuit;
let currentLanguage = 'zh';

const courseInfo = document.createElement('div');
courseInfo.className = 'course-info';
courseInfo.innerHTML = `
  <p data-i18n="courseLayoutValue"></p>
  <p data-i18n="courseClockValue"></p>
`;
document.querySelector('.stage-layout').before(courseInfo);

const protocolSection = document.createElement('section');
protocolSection.className = 'band band-protocol';
protocolSection.id = 'protocol';
protocolSection.innerHTML = `
  <div class="section-head protocol-head">
    <span class="section-no" data-i18n="protocolKicker"></span>
    <h2 data-i18n="protocolTitle"></h2>
  </div>
  <div class="protocol-grid">
    <article class="protocol-card diagnostic"><p data-i18n="devBody"></p><p data-i18n="devActions"></p></article>
  </div>
`;
document.querySelector('#setting').after(protocolSection);
configureNarrative(protocolSection);

const copy = {
  en: {
    skip: 'Skip to content', navQuestion: 'Question', navChallenge: 'Why hard', navSetting: 'Setting', navModes: 'Results', navEvidence: 'Videos',
    heroAlt: 'A Microduck robot approaching the first slalom obstacle', heroEyebrow: 'MICRODUCK AGENT OBSTACLE RACE',
    heroTitle: 'DuckGo: Can AI Control a Microduck?',
    heroName: 'DuckGo:',
    heroQuestion: 'Can AI Control a Microduck?',
    articleInfoLabel: 'Article information', publishedLabel: 'Published', publishedDate: 'Nov 23, 2026', teamLabel: 'Team', topicsLabel: 'Topics',
    topicRobotics: 'Robotics', topicBenchmarks: 'Benchmarks', topicAgent: 'Agent', metadataMore: 'See more...',
    heroLead: 'General-purpose agents control Microduck through one skill interface, confronting body constraints, moving obstacles and execution errors in a continuously running MuJoCo world.',
    heroExplore: 'Read the study', heroWatch: 'Watch a real trial', heroCaptionLeft: 'A simulated obstacle race for general-purpose agents.', heroCaptionRight: 'Microduck · MuJoCo · 16 stages',
    heroMetaRobot: 'Microduck · MuJoCo', heroMetaCourse: '16 ordered checkpoints', heroMetaSubject: 'General-purpose agents', heroResults: 'View results', heroFigure: 'Figure 1.', contentsLabel: 'ON THIS PAGE',
    questionKicker: 'RESEARCH QUESTION', questionTitle: 'From an image to a decision. From a command to an uncertain outcome.',
    questionStatement: 'When skill outcomes are not guaranteed, and the world keeps changing while an agent thinks, can a general-purpose agent use first-person observation and replanning to bring a simulated robot through an entire obstacle race?',
    subjectLabel: 'WHAT IS EVALUATED', subjectText: 'The complete agent, not a single model response.', subjectNote: 'The model is its reasoning core. The agent must observe, call skills, interpret feedback and remain in control until the referee ends the run.',
    boundaryVln: 'NOT NAVIGATION ALONE', boundaryTorque: 'NOT A JOINT-TORQUE BENCHMARK',
    challengeKicker: 'THE CHALLENGE', challengeTitle: 'The plan is not the trajectory.', challengeIntro: 'The agent chooses a skill and its parameters. A learned policy drives the joints; MuJoCo advances the body, contacts and moving obstacles. The next image reveals what actually happened.', challengePrincipleLabel: 'THE EVALUATION LOOP', challengePrinciple: 'A skill call is a hypothesis. Physics decides the outcome.', challengePrincipleBody: 'The benchmark does not reward a plausible command in isolation. It tests whether an Agent can turn visual evidence into a choice, survive imperfect execution, read the consequence, and continue until the referee declares a real result.', challengeLayerOneTitle: 'Perception under partial view', challengeLayerOneBody: 'The Agent sees the route through the robot camera, with occlusion, perspective and no privileged map.', challengeLayerTwoTitle: 'Skills with physical consequences', challengeLayerTwoBody: 'Walk, run, sit, stand and roulade are useful tools—not guaranteed trajectories.', challengeLayerThreeTitle: 'Closed-loop responsibility', challengeLayerThreeBody: 'A good Agent must notice contact, drift or a fall, then recover and keep control.',
    loopObserve: 'OBSERVE', loopDecide: 'CHOOSE SKILL', loopExecute: 'PHYSICAL EXECUTION', loopReplan: 'VERIFY & REPLAN',
    settingKicker: 'ROBOT, COURSE & SKILLS', settingTitle: 'The physical task behind the comparison.', settingIntro: 'Microduck, the obstacle course and a shared skill interface define the task. A callable skill is not a guarantee of success at every position and moment.',
    arenaAlt: 'Low-angle view of three Microduck robots at the race start', arenaCaption: 'Three-robot arena illustration; the current selected leaderboard contains solo runs.',
    settingRobotLabel: 'ROBOT & WORLD', settingRobotValue: 'Microduck biped · MuJoCo contacts · 16 stages',
    courseVersionLabel: 'COURSE', courseName: 'Obstacle Course', courseLayoutLabel: 'COURSE GEOMETRY', courseLayoutValue: `${lapLength.toFixed(2)} m lap · ${trackWidth} m width · ${stageCount} checkpoints`,
    courseClockLabel: 'RACE CLOCK', courseClockValue: 'Real-time · 1-hour wall / simulation limits',
    settingActionsLabel: 'AVAILABLE SKILLS', settingActionsValue: 'Walk · Straight-line Run · Sit · Stand · Roulade · Recover', settingAgentLabel: 'AGENT CONTROL', settingAgentValue: 'Select skills, parameters and duration; no direct joint torques',
    settingGoalLabel: 'GOAL & REFEREE', settingGoalValue: 'Pass checkpoints in order, remain on track, finish forward',
    strategyKicker: 'AVAILABLE MOTION SKILLS', strategyTitle: 'Strategy library', strategyIntro: 'Select a card to watch the recorded policy run.', strategyPreviewLabel: 'STRATEGY VIDEO', photoPlaceholder: 'PHOTO PLACEHOLDER', videoComing: 'Video coming soon — this image is a temporary placeholder.', previewAction: 'PLAY VIDEO', cardPlayLabel: '▶ PLAY VIDEO',
    assessmentLabel: 'ASSESSES', fullRoute: 'Jump to any of the 16 stages', stageLoading: 'LOADING COURSE VIEW…', livePhysics: 'COURSE PREVIEW · NO ROBOT PHYSICS', viewerControls: 'DRAG TO ORBIT · SCROLL TO ZOOM', liveStageDescription: 'A lightweight spectator view of the same course. Obstacles use the race motion definitions; robot physics runs only in the full simulator.',
    inputNowLabel: 'IMPORTANT / RECORDED RUN INPUT', inputNowText: 'Existing development runs used an expanded diagnostic interface. See the input boundary below; these are provisional core-board results while the final observation contract is being frozen.',
    protocolKicker: 'CURRENT RUN / INPUT BOUNDARY', protocolTitle: 'What does the Agent receive today?', protocolIntro: 'This page records the current development interface. The formal observation protocol will be specified separately when the benchmark track is frozen.',
    visionTag: 'PLANNED · NOT YET RUN', visionTitle: 'Formal vision-only input', visionBody: 'Task text, skill schemas, current and previous first-person RGB frames, own action acceptance/completion status and elapsed time. The referee reveals the terminal outcome after the run.', visionExcludes: 'No ideal pose/odometry, contact oracle, obstacle coordinates, on-track flag or checkpoint progress during the run.',
    devTag: 'CURRENT · DEVELOPMENT RUNS', devTitle: 'Expanded diagnostic input', devBody: 'First-person RGB plus launch-relative odometry, posture/recovery state, recent contacts, action receipts, measured displacement/yaw feedback and limited on-track/checkpoint feedback.', devExcludes: 'Useful for debugging; the final benchmark observation contract will be frozen separately.',
    devActions: 'One action can walk, run or wait for 0.2–8 seconds. An Agent can instead submit a program of 2–8 such segments, executed in sequence for no more than 12 seconds total. It receives no new observation between segments. Posture skills such as sit or roll use a separate timeout of up to 12 seconds; that is a limit on the attempt, not a promised action duration.',
    devRecovery: 'Automatic system assistance: the controller retries stand-up and bounded roll escapes in 24-second cycles, with up to three attempts per cycle. A request timeout settles the receipt; it does not retire the robot or reset its pose. Overall race and boundary rules still apply.',
    qualificationTitle: 'Per-stage qualification evidence', qualificationIntro: 'The source snapshot includes selected-phase scripted CPU crossing records for stages 13 and 15. These are not autonomous or all-phase results. Keep per-stage video evidence separate from the agent leaderboard.', qualificationToggle: '16 per-stage evidence slots', qualificationPending: 'VIDEO TO BE ADDED', qualificationVideo: 'VIDEO TO BE ADDED',
    caseTitle: 'Swing-gate recovery case', caseBody: 'A future annotated clip should pair first-person frames with the gate contact, chosen skill, observed displacement and the agent’s correction. No clip or recovery result is claimed yet.',
    modesKicker: 'REAL-TIME LEADERBOARDS', modesTitle: 'Two race formats. One physical benchmark.', modesIntro: 'Solo runs isolate an Agent; multi-agent runs add simultaneous bodies, visual interference and contact risk.',
    soloRealtimeTag: 'SOLO · REAL-TIME', soloRealtimeTitle: 'Single-agent selected results', soloRealtimeBody: 'Each Agent runs independently. The selected results below show route progress and execution outcomes; the human reference is separate.', coreBoardStatus: 'SELECTED 2026-11-19 · 15 RUNS + 1 UNMEASURED',
    multiRealtimeTag: 'MULTI-AGENT · REAL-TIME', multiRealtimeTitle: 'Multi-agent core leaderboard', multiRealtimeBody: 'Agents start together. The same track now includes visual occlusion, racing lines, interaction and robot–robot contact.', multiBoardStatus: 'CORE BOARD · RESULTS PENDING',
    realtimeTag: 'TRACK B', realtimeTitle: 'Real-time', realtimeDescription: 'The robot and moving hazards continue during inference. A good answer may arrive after its opportunity has passed.', realtimeMeasure: 'ADDS · latency, action freshness and timing',
    modeRule: 'Solo and multi-agent results are reported separately. The world continues to advance while agents think.',
    evidenceKicker: 'VIDEOS', evidenceTitle: 'See the control loop in action.', evidenceIntro: 'Recorded simulation shows what the agent saw and what the robot actually did. Read the selected run results after watching the interaction.',
    trialLabel: 'SOLO · REAL-TIME CORE BOARD', trialTitle: 'Current single-agent rankings', trialCaveat: 'No reviewed valid ranking rows yet. Platform errors, disconnections and missing final reports are excluded. Historical clips remain diagnostic evidence, not ranking evidence.',
    tableAgent: 'AGENT / MODEL', tableStage: 'CHECKPOINTS', tableProgress: 'PROGRESS', tableFalls: 'FALLS', tableCalls: 'REQUESTS', tableOutcome: 'OUTCOME',
    trialFoot: 'Provisional single runs in real-time mode. DNF = did not finish. Precise monetary cost is omitted because account balance differences are not per-run invoices.',
    videoAlt: 'Excerpt from a DSH and DeepSeek development trial',
    videoReport: 'Inspect this historical run', videoNote: 'Earlier course footage; not a full-course demonstration of the current course.',
    nextKicker: 'OPEN PROJECT', nextTitle: 'Inspect the setup. Run your own agent.', nextBody: 'The simulator, course, tools and evaluation code are in the repository. Paid model trials require your own credentials and matching harness configuration. The static site does not run the model backend.',
    repoLink: 'Explore repository', setupLink: 'Installation guide', sourcesTitle: 'Built on & related to', sourcesNote: "Related upstream projects and assets are not all runtime dependencies. See the repository's third-party notices for licenses.",
    footerNote: 'An independent simulation benchmark, not an upstream-endorsed project or a real-robot validation claim.', backTop: 'BACK TO TOP',
    detailLabel: 'ASSESSES', report: 'Run record', dnf: 'DNF', outcomeOne: 'Agent exited while race was RUNNING', outcomeTwo: '3,600 s wall-clock limit',
  },
  zh: {
    skip: '跳到正文', navQuestion: '研究问题', navChallenge: '核心挑战', navSetting: '实验设置', navModes: '榜单', navEvidence: '视频',
    heroAlt: 'Microduck 机器人驶向蛇形桩障碍', heroEyebrow: 'MICRODUCK AGENT 障碍赛',
    heroTitle: 'DuckGo：AI 能控制 Microduck 吗？',
    heroName: 'DuckGo：',
    heroQuestion: 'AI 能控制 Microduck 吗？',
    articleInfoLabel: '文章信息', publishedLabel: '发布日期', publishedDate: '2026年11月23日', teamLabel: '团队', topicsLabel: '主题',
    topicRobotics: '机器人', topicBenchmarks: '评测基准', topicAgent: 'Agent', metadataMore: '了解更多...',
    heroLead: '让通用 Agent 通过统一技能接口控制 Microduck，在持续运行的 MuJoCo 物理世界中，应对身体约束、动态障碍和执行误差。',
    heroExplore: '了解研究问题', heroWatch: '观看真实试跑', heroCaptionLeft: '仿真机器人 · 物理动力学', heroCaptionRight: 'MICRODUCK · 16 关',
    questionKicker: '研究问题', questionTitle: '从影像到决策；从指令到不确定的执行结果。',
    questionStatement: '当技能执行结果不被保证、环境在思考期间仍会变化时，通用 Agent 能否靠第一视角持续观察和重新决策，把一台物理仿真的机器人带过整场障碍赛？',
    subjectLabel: '评测对象', subjectText: '完整的 Agent，而非单次模型回答。', subjectNote: '模型是推理内核；Agent 还需要观察、调用技能、理解反馈，并持续控制，直到裁判真正结束比赛。',
    boundaryVln: '不只是导航', boundaryTorque: '不评测关节力矩输出',
    challengeKicker: '核心挑战', challengeTitle: '计划的动作，不等于实际轨迹。', challengeIntro: 'Agent 选择技能及参数；底层策略驱动关节，MuJoCo 推进身体、接触与动态障碍。下一帧影像才能告诉 Agent 真正发生了什么。', challengePrincipleLabel: '评测闭环', challengePrinciple: '一次技能调用只是一个假设，物理引擎决定结果。', challengePrincipleBody: '评测不奖励孤立的“看起来合理”的指令，而是观察 Agent 能否把视觉证据转成选择，在执行偏差中保持控制，读懂后果，并持续行动到裁判给出真正的终局。', challengeLayerOneTitle: '不完整视野中的感知', challengeLayerOneBody: 'Agent 只能通过机器人相机看路线，面对遮挡、透视和没有特权地图的限制。', challengeLayerTwoTitle: '带来物理后果的技能', challengeLayerTwoBody: '行走、跑步、坐下、起立和前滚翻是工具，不是保证兑现的轨迹。', challengeLayerThreeTitle: '闭环控制责任', challengeLayerThreeBody: '好的 Agent 要发现接触、偏移或跌倒，完成恢复后继续掌控比赛。',
    loopObserve: '观察', loopDecide: '选择技能', loopExecute: '物理执行', loopReplan: '核验并重规划',
    settingKicker: '机器人、赛道与技能', settingTitle: '比较背后的物理任务。', settingIntro: 'Microduck 本体、障碍赛道与共享的技能接口共同定义任务。技能可以调用，但不保证在任何位置和时机都能成功执行。',
    arenaAlt: '三只 Microduck 在障碍赛起点的低机位画面', arenaCaption: '三鸭赛场示意图；当前选用榜单记录为单人赛。',
    settingRobotLabel: '机器人与环境', settingRobotValue: 'Microduck 双足 · MuJoCo 接触动力学 · 16 关',
    courseVersionLabel: '赛道', courseName: '障碍赛道', courseLayoutLabel: '赛道规格', courseLayoutValue: `单圈 ${lapLength.toFixed(2)} 米 · 宽 ${trackWidth} 米 · ${stageCount} 个检查点`,
    courseClockLabel: '比赛时钟', courseClockValue: '实时运行 · 墙钟与仿真各限 1 小时',
    settingActionsLabel: '可用技能', settingActionsValue: '行走 · 直线跑 · 坐下 · 起立 · 前滚翻 · 跌倒恢复', settingAgentLabel: 'Agent 控制', settingAgentValue: '选择技能、参数和时长；不直接输出关节力矩',
    settingGoalLabel: '目标与裁判', settingGoalValue: '按顺序通过检查点，保持在赛道内，正向冲线',
    strategyKicker: '可调用运控技能', strategyTitle: '策略库', strategyIntro: '点击卡片播放对应策略的仿真录制视频。', strategyPreviewLabel: '策略视频', photoPlaceholder: '照片占位', videoComing: '策略视频待补充 · 当前显示临时照片占位。', previewAction: '播放视频', cardPlayLabel: '▶ 播放视频',
    assessmentLabel: '考核点', fullRoute: '跳转到完整 16 关中的任意关卡', stageLoading: '正在加载赛道预览…', livePhysics: '赛道预览 · 不运行机器人物理', viewerControls: '拖动旋转 · 滚轮缩放', liveStageDescription: '轻量观众视图使用与比赛相同的赛道和障碍运动定义；机器人物理仅在完整仿真器中运行。',
    inputNowLabel: '重要说明 / 现有试跑输入', inputNowText: '现有开发试跑使用的是扩展诊断接口。具体输入边界见下方；当前成绩属于正式规则冻结前的暂行核心榜记录。',
    protocolKicker: '当前试跑 / 输入边界', protocolTitle: 'Agent 现在究竟能收到什么？', protocolIntro: '这里记录当前开发接口；正式评测协议将在榜单规则冻结后单独发布。',
    visionTag: '拟定 · 尚未实测', visionTitle: '正式榜：仅第一视角输入', visionBody: '任务文本、技能调用格式、当前与历史第一视角 RGB、自己的动作接受/完成状态及已用时间。裁判只在赛后公布终局结果。', visionExcludes: '比赛中不提供理想位姿/里程计、接触真值、障碍坐标、是否在赛道内或检查点进度。',
    devTag: '当前 · 开发试跑', devTitle: '扩展诊断输入', devBody: '第一视角 RGB，以及起点相对里程计、本体姿态/恢复状态、近期接触、动作回执、实测位移与转向反馈、有限的赛道内状态和检查点反馈。', devExcludes: '便于调试；最终评测的观察协议将另行冻结。',
    devActions: '一次动作可行走、直线跑或等待 0.2–8 秒。Agent 也可以一次提交由 2–8 个此类动作组成的程序，依次执行，总时长最多 12 秒；程序执行中不会获得新观察，无法逐段调整。坐下、前滚翻等姿态技能另设最长 12 秒的超时：这是单次尝试的上限，不代表动作一定执行满 12 秒。',
    devRecovery: '系统自动起身：以 24 秒为一轮，每轮最多三次尝试，组合起立与有界翻滚脱困，并可继续下一轮。请求超时只结束回执，不会因此退赛或重置位姿；比赛总时限和边界规则仍然适用。',
    qualificationTitle: '逐关资格验证', qualificationIntro: '源快照包含第 13、15 关选定相位下的脚本 CPU 穿越记录，不代表 Agent 自主通过或所有相位均可通过。逐关视频证据与 Agent 榜单分别记录。', qualificationToggle: '16 关逐关证据位', qualificationPending: '视频待补充', qualificationVideo: '视频待上传',
    caseTitle: '摆门受推纠偏案例', caseBody: '待补一段注释视频：对齐第一视角画面、摆门接触、所选技能、实际位移与 Agent 的纠偏。当前不声称已有视频或成功恢复案例。',
    modesKicker: '实时评测榜单', modesTitle: '两种比赛形式，同一个物理基准。', modesIntro: '单人赛隔离 Agent 能力，多人赛加入同时出发、视觉干扰、抢线与机器人接触。',
    soloRealtimeTag: '单人赛 · 实时运行', soloRealtimeTitle: '单人赛选定成绩', soloRealtimeBody: '各 Agent 独立跑赛道。下方展示选定试跑的路线进度和执行结果，人类参考单独列示。', coreBoardStatus: '选定于 2026-11-19 · 15 场实测 + 1 项未实测',
    multiRealtimeTag: '多人赛 · 实时运行', multiRealtimeTitle: '多人实时核心榜', multiRealtimeBody: '多个 Agent 同时出发，新增视野遮挡、抢占路线、相互干扰和机器人之间的接触。', multiBoardStatus: '核心榜 · 成绩待补',
    realtimeTag: '赛道 B', realtimeTitle: '实时运行', realtimeDescription: '推理时机器人和动态障碍继续运动；再好的答案，也可能错过执行窗口。', realtimeMeasure: '增加 · 延迟、决策新鲜度与时机',
    modeRule: '单人赛和多人赛分别记录成绩；Agent 思考期间，机器人与动态障碍持续运动。',
    evidenceKicker: '效果视频', evidenceTitle: '看看 Agent 实际如何控制机器人。', evidenceIntro: '用仿真运行录像展示 Agent 看到了什么，以及机器人实际执行了什么。先看交互过程，再对照下方的选用成绩。',
    trialLabel: '单人赛 · 实时核心榜', trialTitle: '当前单人赛排名', trialCaveat: '暂无审核通过的有效排名。平台错误、页面失联、缺失最终报告的局排除；历史录像仅为诊断证据，不代表排名。',
    tableAgent: 'AGENT / 模型', tableStage: '检查点', tableProgress: '进度', tableFalls: '跌倒', tableCalls: '请求', tableOutcome: '结果',
    trialFoot: '实时模式下的单局暂行记录。DNF = 未完赛。账户余额差不是逐局账单，因此暂不列精确费用。',
    videoAlt: 'DSH 与 DeepSeek 开发试跑片段',
    videoReport: '查看这次历史试跑报告', videoNote: '早期赛道录像，不代表当前赛道的全程演示。',
    nextKicker: '开放项目', nextTitle: '检查设置，运行自己的 Agent。', nextBody: '仿真器、赛道、工具与评测代码均在仓库中。复现付费模型试跑还需要自己的凭据及匹配的 Agent 配置；这个静态网页不会运行模型后端。',
    repoLink: '查看代码仓库', setupLink: '查看安装说明', sourcesTitle: '基于及关联项目', sourcesNote: '相关上游项目和资产不全是运行时依赖；许可信息请查看仓库的第三方声明。',
    footerNote: '独立的仿真评测项目，不代表上游官方背书，也不声称已验证真实机器人表现。', backTop: '返回顶部',
    detailLabel: '考核点', report: '试跑记录', dnf: '未完赛', outcomeOne: '比赛仍在进行时 Agent 退出', outcomeTwo: '达到 3600 秒墙钟上限',
  },
};

// The public board is intentionally hierarchical: race format first, clock
// mode second. Keeping these labels in the language table also makes the
// disclosure controls switch cleanly with the rest of the page.
Object.assign(copy.en, {
  challengeIntro: 'The agent selects a skill. The robot and the moving course determine where it actually goes. Each new view can demand a different decision.',
  challengeDiagramLabel: 'ONE SKILL / MANY POSSIBLE OUTCOMES', challengeDiagramTitle: 'The same call can end differently.', challengeDiagramBody: 'A skill specifies what to attempt, not a guaranteed path. Obstacle phase, contact, momentum and balance shape the motion that follows.',
  challengePrincipleMiniLabel: 'WHAT THE AGENT MUST DO', challengePrincipleMini: 'Observe the actual outcome, then decide again.', outcomeSameCall: 'SAME SKILL CALL', factorPhase: 'MOVING BAR PHASE', factorContact: 'CONTACT', factorMomentum: 'MOMENTUM', factorBalance: 'BODY BALANCE', outcomePass: 'PASSES', outcomePassBody: 'The opening arrives in time.', outcomeDrift: 'PUSHED OFF LINE', outcomeDriftBody: 'Contact changes the heading.', outcomeFall: 'FALLS OR STALLS', outcomeFallBody: 'Balance or progress is lost.', challengeDiagramNote: 'ILLUSTRATIVE EXAMPLES · NOT AN EXHAUSTIVE SET', challengeDiagramFollowup: 'Only one outcome occurs in a run → observe and replan',
  challengePointOneLabel: 'SEE', challengePointOneTitle: 'Partial view', challengePointOneBody: "Infer the route and obstacle state from the robot's own camera.",
  challengePointTwoLabel: 'DECIDE', challengePointTwoTitle: 'A changing world', challengePointTwoBody: 'In real time, the opportunity may move while the agent thinks.',
  challengePointThreeLabel: 'ACT', challengePointThreeTitle: 'Uncertain execution', challengePointThreeBody: 'Skills meet contacts, momentum, balance limits and moving obstacles.',
  challengePointFourLabel: 'CONTINUE', challengePointFourTitle: 'Recovery and control', challengePointFourBody: 'Detect stalls, falls and drift; recover and keep going until the referee ends the race.',
  modesKicker: 'RESULTS', modesTitle: 'Results, organized by race format.',
  modesIntro: 'Select solo or multi-agent races to view their real-time results.',
  soloGroupLabel: 'SOLO RACE', soloGroupTitle: 'Single-agent evaluation', soloGroupBody: 'Run each Agent independently to isolate its embodied control ability.',
  multiGroupLabel: 'MULTI-AGENT RACE', multiGroupTitle: 'Simultaneous-agent evaluation', multiGroupBody: 'Agents start together; visual interference, racing lines and contact become part of the task.',
});
Object.assign(copy.zh, {
  challengeIntro: 'Agent 选择技能；机器人的身体与运动中的赛道决定它实际会走到哪里。下一次观察，可能需要作出完全不同的决定。',
  challengeDiagramLabel: '同一技能 / 多种可能结果', challengeDiagramTitle: '同一次调用，结果可能截然不同。', challengeDiagramBody: '技能规定的是尝试做什么，并不保证一条固定轨迹。障碍所处时相、接触、惯性与身体平衡都会改变实际运动。',
  challengePrincipleMiniLabel: 'AGENT 必须做到', challengePrincipleMini: '观察实际发生的结果，再作下一步决策。', outcomeSameCall: '相同的技能调用', factorPhase: '横杆运动时相', factorContact: '接触情况', factorMomentum: '运动惯性', factorBalance: '身体平衡', outcomePass: '顺利通过', outcomePassBody: '恰好赶上开放窗口。', outcomeDrift: '被推离航道', outcomeDriftBody: '碰撞改变了运动方向。', outcomeFall: '跌倒或卡住', outcomeFallBody: '失去平衡或无法前进。', challengeDiagramNote: '仅列举部分可能结果 · 非真实试跑记录', challengeDiagramFollowup: '每局只发生其中一种 → 观察后重新规划',
  challengePointOneLabel: '看见', challengePointOneTitle: '视野不完整', challengePointOneBody: '只凭机器人自身的相机判断路线与障碍状态。',
  challengePointTwoLabel: '决策', challengePointTwoTitle: '环境持续变化', challengePointTwoBody: '实时模式下，推理期间通过窗口可能已经移动。',
  challengePointThreeLabel: '执行', challengePointThreeTitle: '动作结果不确定', challengePointThreeBody: '技能执行会受到碰撞、惯性、平衡极限和动态障碍影响。',
  challengePointFourLabel: '继续', challengePointFourTitle: '恢复并持续控制', challengePointFourBody: '识别卡住、跌倒和偏航；恢复后继续行动到裁判终局。',
  modesKicker: '结果榜单', modesTitle: '按比赛形式查看结果。',
  modesIntro: '区分单人赛和多人赛；点击展开，查看各自的实时评测成绩。',
  soloGroupLabel: '单人赛', soloGroupTitle: '单 Agent 独立评测', soloGroupBody: '每个 Agent 分别完成赛道，用来隔离它自身的具身控制能力。',
  multiGroupLabel: '多人赛', multiGroupTitle: '多 Agent 同场评测', multiGroupBody: '多个 Agent 同时出发；视觉遮挡、抢线和机器人之间的接触都成为任务的一部分。',
});


Object.assign(copy.en, {
  heroTitle: 'DuckGo: Can AI Control a Microduck?',
  heroLead: 'Can a general-purpose agent guide a robot through an obstacle race while the physical world keeps moving?',
  articleSummary: 'We evaluate general-purpose agents controlling Microduck through a shared skill interface in a continuously running MuJoCo obstacle race, observing how they perceive, decide and correct execution errors. The current study covers only Microduck; its results do not establish general embodied competence.',
  heroExplore: 'Explore the benchmark', heroWatch: 'Watch a trial',
  heroCaptionLeft: 'MUJOCO PHYSICS · LEARNED MOTION SKILLS', heroCaptionRight: 'MICRODUCK · 16 STAGES',
  settingKicker: 'EXPERIMENT SETTING', settingTitle: 'Know the conditions.', settingIntro: 'Robot, course, skills and observation channels define the task. The selected records retain their original configuration and course version.',
  settingActionsValue: 'Walk · Straight-line Run · Sit · Stand · Roulade',
  representativeStages: 'Representative Stages',
  strategyTitle: 'See the skills.', strategyIntro: 'Select a skill to watch its recorded motion.',
  livePhysics: 'INTERACTIVE COURSE PREVIEW', viewerControls: 'DRAG TO ORBIT · SCROLL TO ZOOM',
  startPreview: 'Explore the course', previewLoading: 'Loading the course…',
  inputNowLabel: 'OBSERVATION CHANNELS', inputNowText: 'First-person RGB is accompanied by permitted state and action feedback. The current runs are not image-only evaluations.',
  evidenceTitle: 'See what actually happened.', evidenceIntro: 'Recorded footage connects an agent’s choices to the robot’s physical motion. Watch the interaction, then read the results.',
  modesTitle: 'How far did they get?', modesIntro: 'Solo and simultaneous races are reported separately. All displayed boards use real-time execution.',
  nextTitle: 'Explore the project.', nextBody: 'The environment, robot tools and evaluation code are available in the repository. Inspect the setup and the original run records.',
});
Object.assign(copy.zh, {
  heroTitle: 'DuckGo：AI 能控制 Microduck 吗？',
  heroLead: '当物理世界不会等待思考，通用 Agent 能否控制机器人，完成整场障碍赛？',
  articleSummary: '我们让通用 Agent 通过统一技能接口控制 Microduck，在持续运行的 MuJoCo 仿真中参加障碍赛，观察它们如何感知、决策并修正执行偏差。目前仅评测 Microduck 一种机器人形态，不将结果泛化为通用具身能力。',
  heroExplore: '了解评测', heroWatch: '观看试跑',
  heroCaptionLeft: 'MUJOCO 物理仿真 · 已有运控技能', heroCaptionRight: 'MICRODUCK · 16 关',
  settingKicker: '实验设置', settingTitle: '明确测试条件。', settingIntro: '机器人、赛道、技能与观察信息共同定义任务。当前选用记录保留每次试跑的原始配置和赛道版本。',
  settingActionsValue: '行走 · 直线跑 · 坐下 · 起立 · 前滚翻',
  representativeStages: '代表关卡',
  strategyTitle: '看看机器人如何行动。', strategyIntro: '点击技能，播放对应的运控演示。',
  livePhysics: '交互赛道预览', viewerControls: '拖动旋转 · 滚轮缩放',
  startPreview: '探索赛道', previewLoading: '正在加载赛道…',
  inputNowLabel: '观察信息', inputNowText: '第一视角 RGB 配合允许的状态与动作反馈。当前记录不是仅影像输入评测。',
  evidenceTitle: '看看实际发生了什么。', evidenceIntro: '用录像连接 Agent 的选择与机器人的实际运动。先看交互过程，再对照成绩。',
  modesTitle: '它们走到了哪里？', modesIntro: '单人赛与同时出发的多人赛分别记录。当前展示实时运行成绩。',
  nextTitle: '进一步了解项目。', nextBody: '环境、机器人工具与评测代码均在仓库中，可查阅测试设置和原始试跑记录。',
});


Object.assign(copy.en, {
  arenaCaption: 'Microduck obstacle course',
  settingIntro: ' ',
  settingAgentValue: 'Choose motion skills, parameters and duration',
  inputNowLabel: 'INPUT & ASSISTANCE',
  inputNowText: 'First-person RGB, odometry, posture, contact and action feedback. Stand-up after falls is automatic.',
  protocolKicker: 'INTERFACE', protocolTitle: 'Observations and actions',
  devBody: 'First-person RGB, launch-relative odometry, posture, recent contacts, action receipts, measured displacement and heading, plus on-track and checkpoint feedback.',
  devActions: 'One action can walk, run or wait for 0.2–8 seconds. An Agent can instead submit a program of 2–8 such segments, executed in sequence for no more than 12 seconds total. It receives no new observation between segments. Posture skills such as sit or roll use a separate timeout of up to 12 seconds; that is a limit on the attempt, not a promised action duration.',
  strategyIntro: ' ',
  evidenceTitle: 'Watch an agent run.', evidenceIntro: ' ',
  videoReport: 'Run report',
  modesIntro: 'Solo runs isolate each agent. Simultaneous races add occlusion, racing lines and robot contact.', soloGroupBody: 'Each agent runs independently.', multiGroupBody: 'Seven agents started together, adding occlusion and contact.',
  soloGroupStatus: 'REAL-TIME · RESULTS AVAILABLE', multiGroupStatus: 'REAL-TIME · 7 AGENTS',
  nextBody: 'Environment, robot interfaces and evaluation code.',
  liveStageDescription: 'Select a representative stage to see its assessment focus.',
});
Object.assign(copy.zh, {
  arenaCaption: 'Microduck 障碍赛场',
  settingIntro: ' ',
  settingAgentValue: '选择运控技能、参数和时长',
  inputNowLabel: '输入与系统辅助',
  inputNowText: '第一视角 RGB、里程计、姿态、接触与动作反馈；跌倒后由系统自动起身。',
  protocolKicker: '接口', protocolTitle: '观察与动作',
  devBody: '第一视角 RGB、起点相对里程计、本体姿态、近期接触、动作回执、实测位移与转向，以及赛道内状态和检查点反馈。',
  devActions: '一次动作可行走、直线跑或等待 0.2–8 秒。Agent 也可以一次提交由 2–8 个此类动作组成的程序，依次执行，总时长最多 12 秒；程序执行中不会获得新观察，无法逐段调整。坐下、前滚翻等姿态技能另设最长 12 秒的超时：这是单次尝试的上限，不代表动作一定执行满 12 秒。',
  strategyIntro: ' ',
  evidenceTitle: '看看 Agent 如何行动。', evidenceIntro: ' ',
  videoReport: '试跑报告',
  modesIntro: '单人赛分别运行，便于观察每个 Agent 的能力；多人赛同时出发，增加遮挡、抢线和接触。', soloGroupBody: '各 Agent 分别独立运行。', multiGroupBody: '七个 Agent 同时出发，加入遮挡与机器人接触。',
  soloGroupStatus: '实时运行 · 已有成绩', multiGroupStatus: '实时运行 · 7 个 Agent',
  nextBody: '环境、机器人接口与评测代码。',
  liveStageDescription: '选择代表关卡，查看具体考核点。',
});

Object.assign(copy.en, {
  settingRobotLabel: 'Robot & world', settingRobotTitle: 'Microduck × MuJoCo', settingRobotDetail: 'Biped locomotion with contact dynamics.',
  settingStageCount: '16 ordered stages', settingWorldClock: 'Continuously running physics',
  settingActionsLabel: 'Available skills', settingSkillsTitle: 'Learned motion skills',
  settingSkillWalk: 'Walk', settingSkillRun: 'Straight-line Run', settingSkillSit: 'Sit', settingSkillStand: 'Stand', settingSkillRoll: 'Forward Roll',
  settingAgentLabel: 'Agent control', settingControlTitle: 'Skill · Parameters · Duration', settingControlDetail: 'The agent chooses the action; the controller drives the joints.',
  settingGoalLabel: 'Finish rules', settingFinishTitle: 'Pass all 16 checkpoints', settingFinishDetail: 'In order, within the track, then cross the finish forward.',
  settingInputLabel: 'Agent input', settingInputTitle: 'First-person RGB + state feedback', settingInputDetail: 'Odometry, posture, contacts and action receipts.',
  settingAssistanceLabel: 'System assistance', settingAssistanceTitle: 'Automatic stand-up after falls',
});
Object.assign(copy.zh, {
  settingRobotLabel: '机器人与环境', settingRobotTitle: 'Microduck × MuJoCo', settingRobotDetail: '双足机器人，在接触动力学仿真中运动。',
  settingStageCount: '16 段有序关卡', settingWorldClock: '物理世界持续运行',
  settingActionsLabel: '可用技能', settingSkillsTitle: '已训练的运控技能',
  settingSkillWalk: '行走', settingSkillRun: '直线跑', settingSkillSit: '坐下', settingSkillStand: '起立', settingSkillRoll: '前滚翻',
  settingAgentLabel: 'Agent 控制', settingControlTitle: '技能 · 参数 · 持续时间', settingControlDetail: 'Agent 选择动作，底层控制器驱动关节执行。',
  settingGoalLabel: '完赛规则', settingFinishTitle: '通过全部 16 个检查点', settingFinishDetail: '按顺序通过、保持在赛道内，最后正向冲线。',
  settingInputLabel: 'Agent 输入', settingInputTitle: '第一视角 RGB + 状态反馈', settingInputDetail: '里程计、姿态、接触与动作回执。',
  settingAssistanceLabel: '系统辅助', settingAssistanceTitle: '跌倒后自动起身',
});

Object.assign(copy.en, {
  heroExplore: 'Read the article', heroSimulatorTitle: 'Enter the simulator', heroSimulatorNote: 'Run in your browser',
  heroVideoLabel: 'DuckGO film introducing the obstacle course, agent control and selected results.',
  heroVideoPlay: 'Watch the film', heroVideoDownload: 'Open the DuckGO film',
  heroVideoCaption: 'A 70-second introduction to DuckGO’s course, agent control and selected results.', heroVideoNote: '70 seconds · DuckGO overview',
  arenaAlt: 'Overview of the Microduck obstacle course in MuJoCo', arenaCaption: 'The Microduck obstacle course in MuJoCo.',
});
Object.assign(copy.zh, {
  heroSimulatorTitle: '进入仿真', heroSimulatorNote: '在浏览器中体验',
  heroVideoLabel: '介绍 DuckGO 障碍赛道、Agent 控制和选定成绩的影片。',
  heroVideoPlay: '观看影片', heroVideoDownload: '打开 DuckGO 影片',
  heroVideoCaption: '70 秒了解 DuckGO 的赛道、Agent 控制和选定成绩。', heroVideoNote: '70 秒 · DuckGO 项目介绍',
  arenaAlt: 'MuJoCo 中的 Microduck 障碍赛道全景', arenaCaption: 'MuJoCo 中的 Microduck 障碍赛道。',
});

const stages = [
  { no: '02', stageIndex: 1, assessment: { en: 'Read post positions, steer repeatedly, pass the checkpoint with fewer contacts.', zh: '识别交错桩位、连续修正航向；核验过门与接触。' }, description: { en: 'Five staggered posts require successive turns.', zh: '五根交错桩，要求连续转向。' } },
  { no: '03', stageIndex: 2, assessment: { en: 'Time two swing-gate openings; if pushed off the route, recognize the deviation and steer back autonomously.', zh: '判断两道摆门的开放窗口；被摆门推离航道后，自主识别偏移并修正路线。' }, description: { en: 'Two gates swing out of phase, alternating the openings.', zh: '两道摆门错相往复，开放窗口交替出现。' } },
  { no: '06', stageIndex: 5, assessment: { en: 'Predict sliding-panel motion; if pushed aside, locate the route again and correct the trajectory.', zh: '预测挡板横移并选择通过时机；被推偏后重新定位航道、自主调整轨迹。' }, description: { en: 'Three panels slide across the course.', zh: '三道挡板横向移动，反复封闭局部通道。' } },
  { no: '07', stageIndex: 6, assessment: { en: 'Time sit/stand at reciprocating low bars; if pushed back or off course, reorient and try again.', zh: '判断往复低杆前的坐下/起立时机；被推退或推偏后重新定位、自主调整并继续通过。' }, description: { en: 'Three low bars reciprocate out of phase.', zh: '三道低杆错相往复。' } },
  { no: '09', stageIndex: 8, assessment: { en: 'Locate four narrow alternating gaps and adjust heading between gates.', zh: '识别四处交替窄门，逐道修正横向位置与朝向。' }, description: { en: 'Four staggered walls leave alternating 0.90 m openings.', zh: '四道交错挡墙，各留出 0.90 米宽的交替开口。' } },
  { no: '11', stageIndex: 10, assessment: { en: 'Maintain balance on counter-rotating surfaces; detect friction-induced drift and correct heading while making progress.', zh: '在相邻反向转动的接触面上保持平衡；识别脚底摩擦造成的偏转和侧移，持续纠偏前进。' }, description: { en: 'Nine adjacent turntables rotate in opposite directions at 0.324 rad/s.', zh: '九个转盘以 0.324 弧度/秒交替反向转动。' } },
  { no: '12', stageIndex: 11, assessment: { en: 'Detect backward drift and choose a gait with enough forward speed to attempt a crossing.', zh: '识别倒退，选择前进速度足以尝试穿越传送带的步态。' }, description: { en: 'The belt moves backward at 0.45 m/s, above the walking command limit.', zh: '传送带以 0.45 米/秒向后输送，超过行走指令的速度上限。' } },
  { no: '13', stageIndex: 12, assessment: { en: 'Time each lift opening and steer left, right, then left. Use the two refuges to wait between walls.', zh: '判断升降窗口，按左、右、左对准三道开口，并利用两处停靠区等待。' }, description: { en: 'Three staggered lift walls guard 1.00 m openings on alternating sides.', zh: '三道错相升降墙的开口左右交替，每道宽 1.00 米。' } },
  { no: '16', stageIndex: 15, assessment: { en: 'Align with seven ground bars, invoke Roulade, and cross the finish validly.', zh: '对齐七道贴地横杆、调用前滚翻，并有效冲线。' }, description: { en: 'Seven full-width ground bars precede the finish.', zh: '终点前横跨全宽的七道贴地横杆。' } },
];
const stageNotes = {
  7: { assessment: { en: 'Align with segmented low rails and choose when to use the roll skill; reassess the route if contact interrupts progress.', zh: '对齐分段低栏并判断前滚翻时机；接触打断前进后，重新观察并调整路线。' }, description: { en: 'Six rows of low rails replace the former offset dividers. Gaps remain between segments; posture, alignment and repeated skill use determine the crossing.', zh: '本关已由交错挡板改为六道分段低栏，栏段之间保留间隙，考察姿态、对齐和连续技能调用。' } },
  14: { assessment: { en: 'Transfer sliding-panel timing to a new route position; regain the route after being pushed sideways.', zh: '将横移挡板的时序判断应用到新的赛道位置；被侧向推偏后重新找回路线。' }, description: { en: 'This stage reuses the same three single sliding panels as stage 6, with matching dimensions, travel and simulation-time motion. It is not a telescopic closing-door mechanism.', zh: '本关复用第 6 关的三道单体横移挡板，尺寸、行程和仿真运动时序一致，位于另一段赛道。' } },
};
const strategies = [
  { title: { en: 'Walk', zh: '行走' }, detail: { en: 'Steady biped walking and heading control.', zh: '稳定双足行走与方向控制。' }, image: '/showcase/strategy-posters/walk.jpg', video: '/showcase/strategy-videos/walk.mp4' },
  { title: { en: 'Straight-line Run', zh: '直线跑' }, detail: { en: 'Faster forward movement on straight sections.', zh: '用于在直线路段快速向前移动。' }, image: '/showcase/strategy-posters/run-straight.jpg', video: '/showcase/strategy-videos/run-straight.mp4' },
  { title: { en: 'Sit → Stand', zh: '坐下 → 起立' }, detail: { en: 'A continuous sit-then-stand policy demonstration.', zh: '连续展示坐下与起立的姿态切换策略。' }, image: '/showcase/strategy-posters/sit-stand.jpg', video: '/showcase/strategy-videos/sit-stand.mp4' },
  { title: { en: 'Roulade · Forward Roll', zh: '前滚翻' }, detail: { en: 'One-shot forward-roll skill and landing.', zh: '一次性完成前滚翻并重新落地。' }, image: '/showcase/strategy-posters/roulade.jpg', video: '/showcase/strategy-videos/roulade.mp4' },
  { title: { en: 'Automatic Stand-up', zh: '自动起身' }, detail: { en: 'System-assisted stand-up after falls.', zh: '系统辅助完成跌倒起身。' }, image: '/showcase/strategy-posters/recover.jpg', video: '/showcase/strategy-videos/recover.mp4' },
];
const metrics = [
  { en: 'Finish & progress', zh: '完赛与进度', detail: { en: 'Valid finish, ordered checkpoints, route reached', zh: '有效冲线、有序检查点、最远路线进度' } },
  { en: 'Physical failures', zh: '物理执行失败', detail: { en: 'Falls, contacts, stalls and recovery outcomes', zh: '跌倒、碰撞、卡住与恢复结果' } },
  { en: 'Decision process', zh: '决策过程', detail: { en: 'Skill history, action receipts and first-person footage', zh: '技能历史、动作回执与第一视角录像' } },
  { en: 'Time & cost', zh: '时间与成本', detail: { en: 'Simulation/wall time, latency, requests and tokens', zh: '仿真/墙钟用时、延迟、请求与 Token' } },
];

// Start on a moving representative stage so the live preview visibly proves
// that the course preview is running. Static stages remain selectable.
let activeCourseStage = 10;
let simulatorReady = false;
let simulatorStarted = false;
const simulatorFrame = document.querySelector('#course-simulator');
// The embedded page is a spectator view of the same moving course. The full
// MuJoCo/ONNX race remains separate so this preview loads without policy WASM.
function startCoursePreview() {
  if (simulatorStarted) return;
  simulatorStarted = true;
  const loading = document.querySelector('#stage-loading');
  loading.classList.add('is-loading');
  loading.querySelector('button').disabled = true;
  loading.querySelector('button').textContent = copy[currentLanguage].previewLoading;
  simulatorFrame.src = simulatorFrame.dataset.src;
}
document.querySelector('#start-course-preview').addEventListener('click', startCoursePreview);
const focusSimulatorStage = (stageIndex) => {
  activeCourseStage = stageIndex;
  simulatorFrame?.contentWindow?.postMessage({ type: 'microduck-showcase-stage', stage: stageIndex, lang: currentLanguage }, location.origin);
};
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || !String(event.data?.type ?? '').startsWith('microduck-race-showcase-')) return;
  if (event.data.type === 'microduck-race-showcase-error') {
    const loading = document.querySelector('#stage-loading');
    if (loading) loading.textContent = 'Course preview unavailable · ' + (event.data.message ?? 'Unknown error');
    return;
  }
  simulatorReady = true;
  document.querySelector('#stage-loading')?.setAttribute('hidden', '');
  if (event.data.type === 'microduck-race-showcase-ready') focusSimulatorStage(activeCourseStage);
});
function render(lang) {
  currentLanguage = lang;
  const t = copy[lang];
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t.heroTitle;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t[node.dataset.i18n] ?? '';
  for (const node of document.querySelectorAll('[data-alt]')) node.alt = t[node.dataset.alt] ?? '';
  for (const node of document.querySelectorAll('[data-aria]')) node.setAttribute('aria-label', t[node.dataset.aria] ?? '');
  for (const node of document.querySelectorAll('[data-lang]')) node.setAttribute('aria-pressed', String(node.dataset.lang === lang));

  document.querySelector('#strategy-grid').replaceChildren(...strategies.map((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'strategy-card';
    button.innerHTML = '<span class="strategy-cover"><img loading="lazy" decoding="async" alt="" /><video muted loop playsinline preload="none" tabindex="-1" aria-hidden="true"></video><i aria-hidden="true">▶</i></span><strong></strong><span class="strategy-detail"></span>';
    button.querySelector('.strategy-cover img').src = item.image;
    const coverVideo = button.querySelector('video');
    coverVideo.poster = item.image;
    coverVideo.src = item.video;
    coverVideo.addEventListener('playing', () => {
      if (button.matches(':hover')) button.classList.add('is-previewing');
    });
    button.addEventListener('pointerenter', () => {
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) coverVideo.play().catch(() => {});
    });
    button.addEventListener('pointerleave', () => {
      button.classList.remove('is-previewing');
      coverVideo.pause();
    });
    button.querySelector('strong').textContent = item.title[lang];
    button.querySelector('.strategy-detail').textContent = item.detail[lang];
    button.setAttribute('aria-label', t.previewAction + ': ' + item.title[lang]);
    button.addEventListener('click', () => openStrategy(item, lang));
    return button;
  }));
  document.querySelector('#stage-list').replaceChildren(...stages.map((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'stage-button';
    button.setAttribute('aria-pressed', String(item.stageIndex === activeCourseStage));
    button.innerHTML = '<span class="stage-number"></span><strong></strong><small><b></b><span></span></small>';
    button.querySelector('.stage-number').textContent = item.no;
    button.querySelector('strong').textContent = courseStageTitle(courseStages[item.stageIndex], lang);
    button.querySelector('small b').textContent = t.assessmentLabel;
    button.querySelector('small span').textContent = item.assessment[lang];
    button.addEventListener('click', () => {
      activeCourseStage = item.stageIndex;
      startCoursePreview();
      renderStage(lang);
    });
    return button;
  }));
  document.querySelector('#full-route').replaceChildren(...courseStages.map((stage, i) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(i === activeCourseStage));
    button.innerHTML = '<span></span><strong></strong>';
    button.querySelector('span').textContent = String(i + 1).padStart(2, '0');
    button.querySelector('strong').textContent = courseStageTitle(stage, lang);
    button.addEventListener('click', () => {
      activeCourseStage = i;
      startCoursePreview();
      renderStage(lang);
    });
    li.append(button);
    return li;
  }));
  document.querySelector('#metric-row')?.replaceChildren(...metrics.map((item, i) => {
    const card = document.createElement('article');
    card.innerHTML = '<span></span><h3></h3><p></p>';
    card.querySelector('span').textContent = String(i + 1).padStart(2, '0');
    card.querySelector('h3').textContent = item[lang];
    card.querySelector('p').textContent = item.detail[lang];
    return card;
  }));
  renderLeaderboard(lang);
  renderNarrative(lang);
  renderStage(lang);
  try { localStorage.setItem('microduck-showcase-lang', lang); } catch { /* storage disabled */ }
}
function openStrategy(item, lang) {
  const dialog = document.querySelector('#strategy-dialog');
  const image = document.querySelector('#strategy-dialog-image');
  const video = document.querySelector('#strategy-dialog-video');
  const placeholder = document.querySelector('#strategy-dialog-placeholder');
  const note = document.querySelector('#strategy-dialog-note');
  image.src = item.image;
  image.alt = item.title[lang];
  document.querySelector('#strategy-dialog-title').textContent = item.title[lang];
  document.querySelector('#strategy-dialog-description').textContent = item.detail[lang];
  video.pause();
  if (item.video) {
    video.src = item.video;
    video.hidden = false;
    image.hidden = true;
    placeholder.hidden = true;
    note.hidden = true;
  } else {
    video.removeAttribute('src');
    video.load();
    video.hidden = true;
    image.hidden = false;
    placeholder.hidden = false;
    note.hidden = false;
  }
  dialog.showModal();
  if (item.video) video.play().catch(() => {});
}
function renderStage(lang) {
  const item = stages.find((stage) => stage.stageIndex === activeCourseStage) ?? stageNotes[activeCourseStage];
  const routeTitle = courseStageTitle(courseStages[activeCourseStage], lang);
  const number = String(activeCourseStage + 1).padStart(2, '0');
  document.querySelector('#stage-label').textContent = `${lang === 'zh' ? '关卡' : 'Stage'} ${number} / 16 · ${routeTitle}`;
  document.querySelector('#stage-description').textContent = item?.description[lang] ?? copy[lang].liveStageDescription;
  const assessment = document.querySelector('#stage-assessment');
  assessment.textContent = item?.assessment?.[lang] ?? '';
  assessment.hidden = !assessment.textContent;
  document.querySelectorAll('#stage-list button').forEach((button, index) => button.setAttribute('aria-pressed', String(stages[index].stageIndex === activeCourseStage)));
  document.querySelectorAll('#full-route button').forEach((button, index) => button.setAttribute('aria-pressed', String(index === activeCourseStage)));
  focusSimulatorStage(activeCourseStage);
}
Object.assign(copy.zh, {
  heroMetaRobot: 'Microduck · MuJoCo',
  heroMetaCourse: '16 个有序检查点',
  heroMetaSubject: '通用 Agent 的具身能力',
  heroResults: '查看结果',
  heroFigure: '图 1.',
  contentsLabel: '文章目录',
  heroExplore: '阅读文章',
});

const heroVideo = document.querySelector('#hero-video');
const heroPlay = document.querySelector('#hero-play');
heroVideo.controls = false;
heroPlay.hidden = false;
heroPlay.addEventListener('click', async () => {
  heroVideo.controls = true;
  heroPlay.hidden = true;
  try {
    await heroVideo.play();
    heroVideo.focus();
  } catch {
    heroPlay.hidden = false;
  }
});
heroVideo.addEventListener('play', () => { heroPlay.hidden = true; });
heroVideo.addEventListener('ended', () => {
  heroVideo.controls = false;
  heroPlay.hidden = false;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) heroVideo.pause();
});

const url = new URL(location.href);
let saved;
try { saved = localStorage.getItem('microduck-showcase-lang'); } catch { /* storage disabled */ }
const initial = ['en', 'zh'].includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : ['en', 'zh'].includes(saved) ? saved : navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
render(initial);
mountArticleNavigation();
for (const button of document.querySelectorAll('[data-lang]')) button.addEventListener('click', () => {
  const lang = button.dataset.lang;
  render(lang);
  const currentUrl = new URL(location.href);
  currentUrl.searchParams.set('lang', lang);
  history.replaceState(null, '', currentUrl);
});
document.querySelector('#strategy-dialog').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
document.querySelector('#strategy-dialog').addEventListener('close', () => {
  const video = document.querySelector('#strategy-dialog-video');
  video.pause();
  video.removeAttribute('src');
  video.load();
});
