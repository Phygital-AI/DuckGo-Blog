import data from './leaderboard-data.json';
import { modelName } from './modelNames.js';
import bibtexText from './duckgo.bib?raw';
import bibtexUrl from './duckgo.bib?url&no-inline';
import { HUMAN_PLAY_SPACE } from './links.js';

const text = {
  zh: {
    navProblems: '动机', navApproach: '环境', navGoals: '目标', navParticipants: '评测对象', navConclusions: '结论',
    problemsKicker: '面临的问题', problemsTitle: '从推理到物理行动',
    problemsBody: '碰撞、摩擦、惯性与身体平衡共同影响机器人的实际运动，因此调用一次技能并不保证到达预期位置。同时，Agent 推理期间障碍仍在运动，依据上一帧作出的判断，到执行时可能已经过期。',
    problemsContext: '一场连续障碍赛，考察的是 Agent 能否持续观察、行动并修正，用实际执行结果检验自己的选择。物理仿真让我们能以较低的硬件、维护与安全成本研究这一过程。',
    approachKicker: '我们做了什么', approachTitle: 'Microduck 障碍赛',
    approachBody: '在 MuJoCo 中，Agent 通过统一接口选择技能、参数和持续时间，控制 Microduck 双足机器人通过连续障碍。底层控制器驱动关节，物理仿真决定实际运动。',
    playLabel: '手动体验', playTitle: '亲自驾驶 Microduck',
    playBody: '用键盘或 Xbox 手柄，在浏览器里驾驶机器人穿过障碍赛道。',
    playAction: '进入游戏环境 ↗',
    loopEyebrow: '闭环控制', loopTitle: 'Agent 如何驾驭 Microduck',
    loopIntro: '每次动作都会改变机器人的实际状态。Agent 根据新观察继续调整，直到比赛结束。',
    loop1: '观察场景', loop1Detail: '获取第一视角影像与允许的本体状态',
    loop2: '选择动作', loop2Detail: 'Agent 决定技能、参数和持续时间',
    loop3: '物理执行', loop3Detail: '机器人与障碍接触，动作结果并不保证',
    loop4: '核对结果', loop4Detail: '查看实际位移、碰撞与姿态，再作决策',
    loop1Phase: '输入', loop2Phase: 'Agent', loop3Phase: '物理环境', loop4Phase: '反馈',
    loopRepeat: '执行结果成为下一次观察的起点',
    goalsKicker: '评测目标', goalsTitle: '完成全程。\n用时更短，摔倒更少。',
    goalsIntro: '按顺序通过全部检查点，保持在赛道内并正向冲线。在完成任务的基础上，比较用时、跌倒和碰撞。',
    goal1Title: '能否完成任务？', goal1Body: '通过有序检查点并有效冲线；未完赛时记录路线进度。',
    goal2Title: '决策是否仍然有效？', goal2Body: '障碍在推理期间持续运动，下一步动作是否仍适合当前场景？',
    goal3Title: '能否调整后续动作？', goal3Body: '被推偏或受阻后，重新观察并修正路线与动作。',
    participantsKicker: '评测对象', participantsTitle: '参赛 Agent',
    participantsIntro: '比较完整的 Agent＋LLM 配置，记录模型、Harness 版本与推理强度。',
    models: '项配置', humanFamily: 'Human · 手柄操控', humanDesc: '手柄操作参考。',
    compatibilityNote: '工具兼容失败，未开展正式比赛。', inputDetails: '查看观察信息与动作接口',
    conclusionsKicker: '结论', conclusionsTitle: '初步观察',
    conclusionsIntro: '现有 AI 试跑尚未完成全程。后续将通过重复实验与统一条件对照，分析实时决策与物理执行中的主要瓶颈。',
    citationTitle: '引用本工作', citationIntro: '如在研究中使用 DuckGo、仿真环境或评测协议，请引用这篇交互式文章。', citationDownload: '下载 BibTeX',
  },
  en: {
    navProblems: 'Motivation', navApproach: 'Environment', navGoals: 'Goals', navParticipants: 'Agents', navConclusions: 'Findings',
    problemsKicker: 'THE PROBLEM', problemsTitle: 'From reasoning to physical action',
    problemsBody: 'Contact, friction, inertia and balance shape a robot’s motion, so a skill call does not guarantee the intended position. Obstacles also keep moving during inference: by the time an agent acts, its last observation may already be out of date.',
    problemsContext: 'An obstacle race tests whether an agent can sustain a loop of observation, action and correction, checking its choices against physical outcomes. Simulation lets us study this process with lower hardware, maintenance and safety costs than physical robot trials.',
    approachKicker: 'WHAT WE BUILT', approachTitle: 'The Microduck obstacle course',
    approachBody: 'Agents select motion skills, parameters and durations through a shared interface to guide a Microduck biped through a MuJoCo obstacle course. Controllers drive the joints; physics determines the motion.',
    playLabel: 'HANDS-ON PLAY', playTitle: 'Take the controls yourself',
    playBody: 'Drive Microduck through the obstacle course in your browser with a keyboard or Xbox controller.',
    playAction: 'Open the game environment ↗',
    loopEyebrow: 'CLOSED-LOOP CONTROL', loopTitle: 'How an agent drives Microduck',
    loopIntro: 'Every action changes the robot’s actual state. The agent uses each new observation to adjust its next decision until the run ends.',
    loop1: 'Observe the scene', loop1Detail: 'First-person view and permitted robot state',
    loop2: 'Choose an action', loop2Detail: 'The agent selects a skill, parameters and duration',
    loop3: 'Execute in physics', loop3Detail: 'Contact and balance shape what actually happens',
    loop4: 'Check the outcome', loop4Detail: 'Inspect motion, contacts and posture before deciding again',
    loop1Phase: 'INPUT', loop2Phase: 'AGENT', loop3Phase: 'PHYSICAL WORLD', loop4Phase: 'FEEDBACK',
    loopRepeat: 'The outcome becomes the next observation',
    goalsKicker: 'EVALUATION GOALS', goalsTitle: 'Finish the course.\nFaster. With fewer falls.',
    goalsIntro: 'Pass every checkpoint in order, stay on the course and cross the finish in the right direction. Compare time, falls and collisions alongside completion.',
    goal1Title: 'Can it finish?', goal1Body: 'Verify ordered checkpoints and a valid finish; record route progress for unfinished runs.',
    goal2Title: 'Does the decision still fit?', goal2Body: 'Obstacles keep moving during inference. Does the next action still fit the scene?',
    goal3Title: 'Can it adjust?', goal3Body: 'After drift or a stalled action, inspect the result and revise the route and next action.',
    participantsKicker: 'WHO WE EVALUATE', participantsTitle: 'Participating agents',
    participantsIntro: 'Compare complete Agent + LLM configurations, including model, harness version and reasoning setting.',
    models: 'configurations', humanFamily: 'Human · Gamepad', humanDesc: 'A gamepad-operated reference run.',
    compatibilityNote: 'Tool compatibility failed; no formal race was run.', inputDetails: 'Observation channels & action interface',
    conclusionsKicker: 'FINDINGS', conclusionsTitle: 'Early observations',
    conclusionsIntro: 'No AI run has completed the course yet. Repeated trials under matched conditions will help identify the main bottlenecks in real-time decisions and physical execution.',
    citationTitle: 'Cite this work', citationIntro: 'If you use DuckGo, its simulation environment, or its evaluation protocol in your work, please cite this interactive article.', citationDownload: 'Download BibTeX',
  },
};

const families = [
  ['Codex', r => r.harness.startsWith('Codex CLI')],
  ['Claude Code', r => r.harness.startsWith('Claude Code')],
  ['DSH', r => r.harness.includes('/dsh@')],
  ['Qwen Code', r => r.harness.startsWith('Qwen Code')],
  ['ZCode', r => r.harness.startsWith('ZCode')],
  ['Kimi Code', r => r.harness.startsWith('Kimi Code')],
  ['Gemini CLI', r => r.harness.startsWith('Gemini CLI')],
  ['Grok', () => false],
];
const node = (tag, className, content) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content != null) el.textContent = content;
  return el;
};
const head = (title, intro) => `<div class="section-head"><h2 data-story="${title}"></h2>${intro ? `<p class="story-intro" data-story="${intro}"></p>` : ''}</div>`;

export function configureNarrative(protocolSection) {
  const main = document.querySelector('#main');
  const problems = node('section', 'band band-problems');
  problems.id = 'question';
  problems.innerHTML = head('problemsTitle') + '<p data-story="problemsBody"></p><p data-story="problemsContext"></p>';

  const approach = node('section', 'band story-approach');
  approach.id = 'approach';
  approach.innerHTML = head('approachTitle', 'approachBody');
  const goals = node('div', 'course-goals');
  goals.id = 'goals';
  goals.innerHTML = '<p data-story="goalsIntro"></p>';
  const stageLayout = document.querySelector('.stage-layout');
  stageLayout.append(stageLayout.querySelector('.stage-panel'));
  const fullRoute = document.querySelector('.full-route');
  fullRoute.removeAttribute('open');
  const playCard = node('aside', 'manual-play');
  const playCopy = node('div', 'manual-play-copy');
  playCopy.innerHTML = '<span data-story="playLabel"></span><h3 data-story="playTitle"></h3><p data-story="playBody"></p>';
  const playLink = node('a', 'manual-play-link');
  playLink.href = HUMAN_PLAY_SPACE;
  playLink.target = '_blank';
  playLink.rel = 'noopener noreferrer';
  playLink.dataset.story = 'playAction';
  playCard.append(playCopy, playLink);
  approach.append(document.querySelector('.setting-photo'), goals,
    document.querySelector('.course-info'), stageLayout, playCard, fullRoute);

  const loop = node('section', 'approach-loop');
  loop.setAttribute('aria-labelledby', 'control-loop-title');
  loop.innerHTML = '<div class="loop-heading"><span data-story="loopEyebrow"></span><h3 id="control-loop-title" data-story="loopTitle"></h3><p data-story="loopIntro"></p></div><ol class="story-loop">' + [1,2,3,4].map(index => `<li><div class="loop-topline"><span class="loop-number">0${index}</span><span data-story="loop${index}Phase"></span></div><strong data-story="loop${index}"></strong><p data-story="loop${index}Detail"></p></li>`).join('') + '</ol><p class="loop-repeat" data-story="loopRepeat"></p>';
  approach.append(loop,
    document.querySelector('.strategy-head'), document.querySelector('#strategy-grid'));

  const participants = node('section', 'band story-participants');
  participants.id = 'participants';
  participants.innerHTML = head('participantsTitle', 'participantsIntro') + '<div class="participant-grid" id="participant-grid"></div>';

  const setting = document.querySelector('#setting');
  const inputDetails = node('details', 'input-details');
  inputDetails.innerHTML = '<summary data-story="inputDetails"></summary>';
  inputDetails.append(protocolSection);
  setting.append(inputDetails);

  const conclusions = node('section', 'band story-conclusions');
  conclusions.id = 'conclusions';
  conclusions.innerHTML = head('conclusionsTitle', 'conclusionsIntro');

  const citation = node('section', 'band article-citation');
  citation.id = 'citation';
  citation.setAttribute('aria-labelledby', 'citation-title');
  citation.innerHTML = head('citationTitle', 'citationIntro');
  citation.querySelector('h2').id = 'citation-title';
  const bibliography = node('pre');
  bibliography.tabIndex = 0;
  bibliography.setAttribute('aria-label', 'BibTeX');
  bibliography.append(node('code', 'language-bibtex', bibtexText));
  const download = node('a', 'citation-download');
  download.href = bibtexUrl;
  download.download = 'duckgo.bib';
  download.dataset.story = 'citationDownload';
  citation.append(bibliography, download);

  main.replaceChildren(document.querySelector('#top'), problems, approach, participants, setting, document.querySelector('#modes'), conclusions, document.querySelector('#reproduce'), citation);
  const layout = node('div', 'article-layout');
  const contents = node('aside', 'article-contents');
  contents.innerHTML = '<nav class="contents-nav" aria-label="Article contents"><a href="#question" data-story="navProblems"></a><a href="#approach" data-story="navApproach"></a><a href="#participants" data-story="navParticipants"></a><a href="#setting" data-i18n="navSetting"></a><a href="#results" data-i18n="navModes"></a><a href="#conclusions" data-story="navConclusions"></a><a href="#citation" data-story="citationTitle"></a></nav>';
  const article = node('article', 'article-body');
  const summary = node('section', 'article-summary');
  summary.id = 'summary';
  summary.setAttribute('aria-labelledby', 'summary-title');
  summary.innerHTML = '<h2 id="summary-title">TL;DR</h2><p data-i18n="articleSummary"></p>';
  article.append(summary);
  for (const section of [...main.children]) if (section.id !== 'top') article.append(section);
  const resultsAnchor = node('span', 'section-anchor');
  resultsAnchor.id = 'results';
  article.querySelector('#modes').prepend(resultsAnchor);
  const hero = document.querySelector('#top');
  const feature = hero.querySelector('.hero-feature');
  const metadata = feature.querySelector('.hero-metadata');
  layout.append(feature, metadata, contents, article);
  main.append(layout);
  document.querySelector('#metric-row')?.remove();
  article.querySelectorAll('.section-no, .story-card-number, .condition-label, .stage-list-heading, .video-copy > span, .setting-feedback h3, .assistance-mark').forEach(label => label.remove());
  const stageList = document.querySelector('#stage-list');
  stageList.removeAttribute('aria-labelledby');
  stageList.setAttribute('aria-label', 'Representative stages');
  document.querySelector('.nav').innerHTML = '<a href="#approach" data-story="navApproach"></a><a href="#results" data-i18n="navModes"></a>';
}

export function renderNarrative(lang) {
  const t = text[lang];
  const measured = data.rows.filter(r => !r.human);
  const counts = { best: Math.max(...measured.map(r => r.progressPercent)).toFixed(2), measured: measured.length, finishers: measured.filter(r => r.finish != null).length, early: measured.filter(r => r.ending.includes('提前') || ['gpt-6-astra', 'deepseek-flash'].includes(r.model)).length };
  document.querySelectorAll('[data-story]').forEach(el => { el.textContent = t[el.dataset.story].replace(/\{(\w+)\}/g, (_, key) => String(counts[key])); });
  const familyCards = families.map(([name, match]) => {
    const rows = name === 'Grok' ? data.unranked : measured.filter(match);
    const card = node('details', 'participant-family');
    const summary = node('summary');
    const countLabel = lang === 'en' && rows.length === 1 ? 'configuration' : t.models;
    summary.append(node('strong', '', name), node('span', '', `${rows.length} ${countLabel}`));
    const list = node('ul');
    rows.forEach(row => {
      const item = node('li');
      item.append(node('strong', '', modelName(row.model)), node('small', '', `${row.harness} · ${row.effort.toUpperCase()}`));
      if (name === 'Grok') item.append(node('small', 'participant-status', t.compatibilityNote));
      list.append(item);
    });
    card.append(summary, list);
    return card;
  });
  const humanCard = node('article', 'participant-family participant-human');
  humanCard.append(node('strong', '', t.humanFamily), node('p', '', t.humanDesc));
  document.querySelector('#participant-grid').replaceChildren(...familyCards, humanCard);

}
