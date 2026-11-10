import data from './leaderboard-data.json';

const text = {
  zh: {
    navProblems: '动机', navApproach: '环境', navGoals: '目标', navParticipants: '评测对象', navConclusions: '结论',
    problemsKicker: '面临的问题', problemsTitle: '物理世界，不会等待思考。',
    problem1Title: '指令不保证结果。', problem1Body: '碰撞、摩擦、惯性与身体平衡，都会改变运动。调用一次技能，不代表机器人一定到达预期位置。',
    problem2Title: '环境不会暂停。', problem2Body: 'Agent 思考时，障碍继续运动，机器人也可能被推移。依据上一帧作出的判断，执行时可能已经过期。',
    problem3Title: '决策需要持续。', problem3Body: '整场比赛需要反复观察、行动和修正。一次合理的选择，无法替代对实际执行结果的持续判断。',
    physicalRationale: '物理仿真降低了真实机器人测试的硬件、维护与安全成本。',
    approachKicker: '我们做了什么', approachTitle: '一台机器人。\n一整场障碍赛。',
    approachBody: '在 MuJoCo 中，Agent 通过统一接口选择技能、参数和持续时间，控制 Microduck 双足机器人通过连续障碍。底层控制器驱动关节，物理仿真决定实际运动。',
    loop1: '第一视角与状态反馈', loop2: 'Agent 选择技能', loop3: '物理执行', loop4: '观察结果，再次决策',
    goalsKicker: '评测目标', goalsTitle: '完成全程。\n用时更短，摔倒更少。',
    goalsIntro: '按顺序通过全部检查点，保持在赛道内并正向冲线。在完成任务的基础上，比较用时、跌倒和碰撞。',
    goal1Title: '能否完成任务？', goal1Body: '通过有序检查点并有效冲线；未完赛时记录路线进度。',
    goal2Title: '决策是否仍然有效？', goal2Body: '障碍在推理期间持续运动，下一步动作是否仍适合当前场景？',
    goal3Title: '能否调整后续动作？', goal3Body: '被推偏或受阻后，重新观察并修正路线与动作。',
    participantsKicker: '评测对象', participantsTitle: '模型负责推理。\nAgent 组织行动。',
    participantsIntro: '比较完整的 Agent＋LLM 配置，记录模型、Harness 版本与推理强度。',
    models: '项配置', humanFamily: 'Human · 手柄操控', humanDesc: '手柄操作参考。',
    compatibilityNote: '工具兼容失败，未开展正式比赛。', inputDetails: '查看观察信息与动作接口',
    conclusionsKicker: '结论', conclusionsTitle: '整场完成，仍是挑战。',
    conclusionsIntro: '现有 AI 试跑尚未完成全程。后续将通过重复实验与统一条件对照，分析实时决策与物理执行中的主要瓶颈。',
  },
  en: {
    navProblems: 'Motivation', navApproach: 'Environment', navGoals: 'Goals', navParticipants: 'Agents', navConclusions: 'Findings',
    problemsKicker: 'THE PROBLEM', problemsTitle: 'The world does not\nwait for thought.',
    problem1Title: 'Commands are uncertain.', problem1Body: 'Contact, friction, inertia and balance change the motion. Calling a skill does not guarantee the intended position.',
    problem2Title: 'The scene keeps moving.', problem2Body: 'Obstacles move and robots can be displaced during inference. A decision based on the last frame may already be out of date.',
    problem3Title: 'One decision is not enough.', problem3Body: 'A full race needs repeated observation, action and correction. A plausible choice must be checked against its physical outcome.',
    physicalRationale: 'Physics simulation reduces the hardware, maintenance and safety costs of physical robot trials.',
    approachKicker: 'WHAT WE BUILT', approachTitle: 'One robot.\nAn entire obstacle race.',
    approachBody: 'Agents select motion skills, parameters and durations through a shared interface to guide a Microduck biped through a MuJoCo obstacle course. Controllers drive the joints; physics determines the motion.',
    loop1: 'FIRST-PERSON & STATE', loop2: 'AGENT CHOOSES SKILL', loop3: 'PHYSICAL EXECUTION', loop4: 'OBSERVE & DECIDE AGAIN',
    goalsKicker: 'EVALUATION GOALS', goalsTitle: 'Finish the course.\nFaster. With fewer falls.',
    goalsIntro: 'Pass every checkpoint in order, stay on the course and cross the finish in the right direction. Compare time, falls and collisions alongside completion.',
    goal1Title: 'Can it finish?', goal1Body: 'Verify ordered checkpoints and a valid finish; record route progress for unfinished runs.',
    goal2Title: 'Does the decision still fit?', goal2Body: 'Obstacles keep moving during inference. Does the next action still fit the scene?',
    goal3Title: 'Can it adjust?', goal3Body: 'After drift or a stalled action, inspect the result and revise the route and next action.',
    participantsKicker: 'WHO WE EVALUATE', participantsTitle: 'Models reason.\nAgents make it happen.',
    participantsIntro: 'Compare complete Agent + LLM configurations, including model, harness version and reasoning setting.',
    models: 'configurations', humanFamily: 'Human · Gamepad', humanDesc: 'A gamepad-operated reference run.',
    compatibilityNote: 'Tool compatibility failed; no formal race was run.', inputDetails: 'Observation channels & action interface',
    conclusionsKicker: 'FINDINGS', conclusionsTitle: 'Finishing remains\nthe challenge.',
    conclusionsIntro: 'No AI run has completed the course yet. Repeated trials under matched conditions will help identify the main bottlenecks in real-time decisions and physical execution.',
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
const head = (number, kicker, title, intro) => `<div class="section-head"><span class="section-no">${number} / <span data-story="${kicker}"></span></span><h2 data-story="${title}"></h2>${intro ? `<p class="story-intro" data-story="${intro}"></p>` : ''}</div>`;
const cards = (prefix, count) => Array.from({length: count}, (_, i) => `<article class="story-card"><span class="story-card-number">${String(i + 1).padStart(2, '0')}</span><h3 data-story="${prefix}${i + 1}Title"></h3><p data-story="${prefix}${i + 1}Body"></p></article>`).join('');

export function configureNarrative(protocolSection) {
  const main = document.querySelector('#main');
  const problems = node('section', 'band band-problems');
  problems.id = 'question';
  problems.innerHTML = head('01', 'problemsKicker', 'problemsTitle') + `<div class="problem-grid">${cards('problem', 3)}</div><p class="physical-rationale" data-story="physicalRationale"></p>`;

  const approach = node('section', 'band story-approach');
  approach.id = 'approach';
  approach.innerHTML = head('02', 'approachKicker', 'approachTitle', 'approachBody');
  const arena = document.querySelector('.setting-photo');
  approach.append(arena);
  const loop = node('div', 'approach-loop');
  loop.innerHTML = '<ol class="story-loop">' + [1,2,3,4].map(i => `<li><span>0${i}</span><strong data-story="loop${i}"></strong></li>`).join('') + '</ol>';
  approach.append(loop);
  for (const selector of ['.strategy-head', '#strategy-grid', '.course-info', '.course-head', '.stage-layout', '.full-route']) approach.append(document.querySelector(selector));
  approach.querySelector('.full-route').removeAttribute('open');

  const goals = node('section', 'band story-goals');
  goals.id = 'goals';
  goals.innerHTML = head('03', 'goalsKicker', 'goalsTitle', 'goalsIntro') + `<div class="goals-grid">${cards('goal', 3)}</div>`;

  const participants = node('section', 'band story-participants');
  participants.id = 'participants';
  participants.innerHTML = head('04', 'participantsKicker', 'participantsTitle', 'participantsIntro') + '<div class="participant-grid" id="participant-grid"></div>';

  const setting = document.querySelector('#setting');
  const inputDetails = node('details', 'input-details');
  inputDetails.innerHTML = '<summary data-story="inputDetails"></summary>';
  inputDetails.append(protocolSection);
  setting.append(inputDetails);

  const conclusions = node('section', 'band story-conclusions');
  conclusions.id = 'conclusions';
  conclusions.innerHTML = head('07', 'conclusionsKicker', 'conclusionsTitle', 'conclusionsIntro');

  main.replaceChildren(document.querySelector('#top'), problems, approach, goals, participants, setting, document.querySelector('#evidence'), document.querySelector('#modes'), conclusions, document.querySelector('#reproduce'));
  const layout = node('div', 'article-layout');
  const contents = node('aside', 'article-contents');
  contents.innerHTML = '<p data-i18n="contentsLabel"></p><nav class="contents-nav" aria-label="Article contents"><a href="#question" data-story="navProblems"></a><a href="#approach" data-story="navApproach"></a><a href="#goals" data-story="navGoals"></a><a href="#participants" data-story="navParticipants"></a><a href="#setting" data-i18n="navSetting"></a><a href="#evidence" data-i18n="navEvidence"></a><a href="#results" data-i18n="navModes"></a><a href="#conclusions" data-story="navConclusions"></a><a href="#reproduce" data-i18n="nextKicker"></a></nav><a class="contents-code" href="https://github.com/HandsomeWuuu/Microduck-Agent-Race" target="_blank" rel="noopener noreferrer">GitHub ↗</a>';
  const article = node('article', 'article-body');
  const summary = node('section', 'article-summary');
  summary.setAttribute('aria-labelledby', 'article-summary-title');
  summary.innerHTML = '<h2 id="article-summary-title">TL;DR</h2><p data-i18n="articleSummary"></p>';
  article.append(summary);
  for (const section of [...main.children]) if (section.id !== 'top') article.append(section);
  const resultsAnchor = node('span', 'section-anchor');
  resultsAnchor.id = 'results';
  article.querySelector('#modes').prepend(resultsAnchor);
  layout.append(contents, article);
  main.append(layout);
  document.querySelector('#metric-row')?.remove();
  for (const [selector, number] of [['#setting', '04B'], ['#evidence', '05'], ['#modes', '06'], ['#reproduce', '08']]) {
    const label = document.querySelector(`${selector} > .section-head .section-no`) ?? document.querySelector(`${selector} .section-no`);
    if (label?.firstChild?.nodeType === Node.TEXT_NODE) label.firstChild.textContent = `${number} / `;
  }
  document.querySelector('.nav').innerHTML = '<a href="#question" data-story="navProblems"></a><a href="#approach" data-story="navApproach"></a><a href="#participants" data-story="navParticipants"></a><a href="#evidence" data-i18n="navEvidence"></a><a href="#modes" data-i18n="navModes"></a>';
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
      item.append(node('strong', '', row.model), node('small', '', `${row.harness} · ${row.effort.toUpperCase()}`));
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
