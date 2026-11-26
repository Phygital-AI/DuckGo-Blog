import data from './leaderboard-data.json';
import selected from './selected-standings.json';
import multi from './multi-standings.json';
import { modelName } from './modelNames.js';
import { HUMAN_PLAY_SPACE } from './links.js';

const copy = {
  zh: {
    label: '单人赛 · 实时运行',
    configurations: 'AI 配置', measured: '项实测', compatibility: '项工具兼容失败',
    best: '最高路线进度', finishers: 'AI 完赛',
    rank: '名次', agent: 'Agent / 模型', progress: '路线进度', time: '仿真用时',
    falls: '跌倒', recovery: '恢复时长', pauses: '暂停次数', api: '模型请求', response: '平均响应', actions: '接受动作', ending: '结束原因',
    checkpoints: 'CP', finishRule: '完赛标准：通过 16 个检查点', audited: '审计修订', human: '人类参考',
    limit: '达到 1 小时时限', early: '提前结束',
    infrastructure: '客户端退出 · 基础设施中断', retired: '规则退役 · 检查点顺序错误', finished: '已完赛',
    failed: '无法正确调用工具', unmeasured: '非实测', humanHarness: '浏览器手柄',
    provisional: 'Grok 的 0% 沿用来源展示约定，未开展正式比赛，其他指标保留未知。',
    humanNote: '连续手柄控制；显示有效墙钟用时，不参与 AI 排名。',
    humanPlay: '亲自体验赛道 ↗',
    aiRunsLabel: 'AI 试跑', aiRunsCount: '15 场实测 · 1 项未实测',
    multiParticipants: '同场 Agent', multiBest: '最高路线进度', multiFinishers: '完赛', multiClock: '实时系数',
    multiCompleted: '已完成动作', multiOutcome: '退赛',
    multiCaption: '同一场七鸭实时比赛 · 2026-11-09',
    multiNote: '单场试跑，尚待物理有效性验证，不作为正式同条件排名。第 5 名并列。来源对所有鸭子的终止原因统一记为「越界或超时」，无法再细分。',
    foot: '成绩来自不同时期的选定试跑，未统一重测；不作为同条件正式排名。平均响应仅统计比赛期间的成功请求；接受动作含开赛准备，不含程序内部片段。Gemini 场次有 64 次请求 ID 冲突、7 次过期画面错误，原生历史恢复风险尚未排除。— 表示未记录。',
    source: '选用来源', low: 'LOW 推理档位',
    tokens: 'Token（输入 / 输出）', noTokens: 'Token 未报告', seconds: '秒',
  },
  en: {
    label: 'SOLO · REAL-TIME',
    configurations: 'AI CONFIGURATIONS', measured: 'measured', compatibility: 'tool incompatibility',
    best: 'BEST ROUTE PROGRESS', finishers: 'AI FINISHERS',
    rank: 'Rank', agent: 'Agent / model', progress: 'Progress', time: 'Sim time',
    falls: 'Falls', recovery: 'Recovery', pauses: 'PAUSES', api: 'Model\nrequests', response: 'Mean\nresponse', actions: 'Accepted\nactions', ending: 'End reason',
    checkpoints: 'CP', finishRule: 'FINISH REQUIRES ALL 16 CHECKPOINTS', audited: 'AUDITED', human: 'HUMAN REFERENCE',
    limit: 'One-hour limit', early: 'Ended early',
    infrastructure: 'Client exited · infrastructure failure', retired: 'Rule retirement · out-of-order checkpoint', finished: 'Finished',
    failed: 'Unable to call tools correctly', unmeasured: 'NOT MEASURED', humanHarness: 'Browser Gamepad',
    provisional: 'Grok’s 0% follows the source display convention: no formal race was run, and all other metrics remain unknown.',
    humanNote: 'Continuous gamepad control; elapsed active wall time, excluded from AI ranks.',
    humanPlay: 'Try the course yourself ↗',
    aiRunsLabel: 'AI AGENT RUNS', aiRunsCount: '15 measured · 1 unmeasured',
    multiParticipants: 'AGENTS IN ONE RACE', multiBest: 'BEST ROUTE PROGRESS', multiFinishers: 'FINISHERS', multiClock: 'REAL-TIME FACTOR',
    multiCompleted: 'Completed\nactions', multiOutcome: 'Retired',
    multiCaption: 'One simultaneous seven-agent real-time race · 2026-11-09',
    multiNote: 'One observed race; physical validation is pending, so this is not an official same-condition ranking. Fifth place is tied. The source uses “boundary or timeout” for every entrant and does not separate the two causes.',
    foot: 'Selected trials span different dates and conditions; they were not rerun uniformly and are not an official same-condition ranking. Mean response counts successful requests during the race; accepted actions include READY arming but not program segments. Gemini had 64 request-ID conflicts and 7 expired-frame errors; native history restoration risk remains unresolved. — means unrecorded.',
    source: 'SELECTED SOURCE', low: 'LOW REASONING EFFORT',
    tokens: 'Tokens (input / output)', noTokens: 'Token usage not reported', seconds: 's',
  },
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
const providers = [
  ['gpt', 'openai', '#242424'], ['deepseek', 'deepseek', '#315fed'],
  ['claude', 'anthropic', '#b65b3e'], ['qwen', 'qwen-symbol', '#694abb'],
  ['glm', 'zai-symbol', '#252525'], ['kimi', 'moonshot', '#343434'],
  ['gemini', 'google', null],
];

function entrantName(model, harness) {
  const identity = element('div', 'entrant-identity');
  const provider = providers.find(([prefix]) => model.startsWith(prefix));
  const mark = element('span', 'entrant-mark');
  mark.setAttribute('aria-hidden', 'true');
  if (provider) {
    const [, brand, color] = provider;
    const src = new URL(`./showcase/brands/${brand}.svg`, document.baseURI).href;
    if (color) {
      mark.classList.add('entrant-symbol');
      mark.style.setProperty('--mark-image', `url("${src}")`);
      mark.style.color = color;
    } else {
      const logo = element('img');
      logo.src = src;
      logo.alt = '';
      mark.append(logo);
    }
  } else {
    mark.textContent = model.charAt(0).toUpperCase();
  }
  const text = element('span', 'entrant-text');
  text.append(element('strong', '', modelName(model)), element('small', '', harness));
  identity.append(mark, text);
  return identity;
}

function mountStandings(scroll, table, thead, tbody, lang, caption) {
  if (caption) table.append(caption);
  table.append(thead, tbody);
  const compact = element('div', 'compact-standings');
  if (caption) compact.append(element('div', 'compact-caption', caption.textContent));
  const heading = element('div', 'compact-heading');
  const headers = thead.rows[0].cells;
  heading.append(element('span', '', headers[0].textContent), element('span', '', headers[1].textContent),
    element('span', '', lang === 'zh' ? '路线进度' : 'Progress'));
  compact.append(heading);
  for (const row of tbody.rows) {
    const [rank, name, progress, ...metrics] = row.cells;
    const entry = element('details', 'compact-entrant');
    const summary = element('summary');
    const score = element('span', 'compact-score');
    score.append(progress.querySelector('strong').cloneNode(true), progress.querySelector('small').cloneNode(true));
    const identity = name.querySelector('.entrant-identity').cloneNode(true);
    const harness = identity.querySelector('small');
    harness.remove();
    summary.append(element('span', 'compact-rank', rank.textContent), identity, score);
    const fields = element('dl', 'compact-fields');
    fields.append(element('dt', '', 'Harness'), element('dd', '', harness.textContent));
    for (const metric of metrics) {
      fields.append(element('dt', '', headers[metric.cellIndex].textContent.replace(/\s+/g, ' ')), element('dd', '', metric.textContent));
    }
    entry.append(summary, fields);
    compact.append(entry);
  }
  scroll.append(table, compact);
}

function progressBar(percent) {
  const bar = element('div', 'board-bar');
  const fill = element('span');
  fill.style.width = `${percent}%`;
  bar.setAttribute('aria-hidden', 'true');
  bar.append(fill);
  return bar;
}

function rankCell(rank, lang, className) {
  const cell = element('td', className);
  if (rank > 3) {
    cell.textContent = String(rank).padStart(2, '0');
    return cell;
  }
  const colors = ['gold', 'silver', 'bronze'];
  const names = lang === 'zh' ? ['金牌', '银牌', '铜牌'] : ['gold medal', 'silver medal', 'bronze medal'];
  const badge = element('span', `rank-medal rank-medal-${colors[rank - 1]}`, String(rank));
  cell.setAttribute('aria-label', lang === 'zh' ? `第 ${rank} 名 · ${names[rank - 1]}` : `Rank ${rank} · ${names[rank - 1]}`);
  cell.append(badge);
  return cell;
}
function duration(value, precise = false) {
  if (!Number.isFinite(value)) return '—';
  if (precise) return `${Math.floor(value / 60)}:${(value % 60).toFixed(3).padStart(6, '0')}`;
  const seconds = Math.round(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function ending(row, t) {
  if (row.human) return t.finished;
  if (row.version === 'V3' && row.ending === 'COURSE_BOUNDARY_OR_TIMEOUT') return t.limit;
  if (['gpt-6-astra', 'deepseek-flash'].includes(row.model)) return t.early;
  if (row.ending?.includes('NATIVE_CLIENT_EXITED')) return t.infrastructure;
  if (row.ending?.includes('outOfOrderGate')) return t.retired;
  if (row.ending?.includes('时限')) return t.limit;
  return t.early;
}

export function renderLeaderboard(lang) {
  const t = copy[lang];
  const number = (value, digits = 0) => Number.isFinite(value)
    ? value.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
  let root = document.querySelector('#solo-results');
  if (!root) {
    root = element('section', 'solo-results');
    root.id = 'solo-results';
    document.querySelector('.leaderboard-group.solo .leaderboard-group-body').prepend(root);
  }
  root.setAttribute('aria-label', t.label);
  const measured = selected.rows.map(source => ({ ...data.rows.find(row => row.model === source.model), ...source }));
  const human = { ...data.rows.find(row => row.human), ...selected.human };
  const summary = element('div', 'board-summary');
  const stats = [
    [String(data.displayCounts.ai_configurations_displayed), t.configurations, `${measured.length} ${t.measured} · ${data.unranked.length} ${t.compatibility}`],
    [`${number(Math.max(...measured.map(row => row.progressPercent)), 2)}%`, t.best, modelName(measured[0].model)],
    [`${measured.filter(row => row.finish != null).length} / ${measured.length}`, t.finishers, t.finishRule],
  ];
  for (const [value, label, detail] of stats) {
    const card = element('div');
    card.append(element('span', '', label), element('strong', '', value), element('small', '', detail));
    summary.append(card);
  }

  const scroll = element('div', 'board-scroll');
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', t.label);
  const table = element('table', 'results-table');
  const thead = element('thead');
  const header = element('tr');
  for (const label of [t.rank, t.agent, t.progress, t.time, t.falls, t.recovery, t.api, t.response, t.actions, t.ending]) {
    const cell = element('th', '', label);
    cell.scope = 'col';
    header.append(cell);
  }
  thead.append(header);
  const tbody = element('tbody');
  scroll.id = 'runs';
  for (const row of measured) {
    const tr = element('tr');
    tr.dataset.runId = row.id;
    if (row.rank === 1) tr.className = 'board-leader';
    tr.append(rankCell(row.rank, lang, 'board-rank'));
    const name = element('th', 'board-agent');
    name.scope = 'row';
    name.append(entrantName(row.model, `${row.harness} · ${row.effort.toUpperCase()}`));
    tr.append(name);
    const progress = element('td', 'board-progress');
    progress.append(element('strong', '', `${number(row.progressPercent, 2)}%`), element('small', '', `${t.checkpoints} ${String(row.cp).padStart(2, '0')} / 16`));
    progress.append(progressBar(row.progressPercent));
    tr.append(progress);
    for (const value of [duration(row.sim), number(row.falls), `${number(row.recovery, 2)} ${t.seconds}`, number(row.api), `${number(row.responseMeanSeconds, 2)} ${t.seconds}`, number(row.acceptedActions)]) tr.append(element('td', 'board-number', value));
    const outcome = element('td', 'board-ending', ending(row, t));
    tr.append(outcome);
    tbody.append(tr);
  }
  for (const row of data.unranked) {
    const tr = element('tr', 'board-unmeasured');
    tr.dataset.runId = row.id;
    tr.append(element('td', 'board-rank', '—'));
    const name = element('th', 'board-agent');
    name.scope = 'row';
    name.append(entrantName(row.model, row.harness));
    tr.append(name);
    const progress = element('td', 'board-progress');
    progress.append(element('strong', '', '—'), element('small', '', t.unmeasured));
    tr.append(progress);
    for (let i = 0; i < 6; i++) tr.append(element('td', 'board-number', '—'));
    tr.append(element('td', 'board-ending', t.failed));
    tbody.append(tr);
  }
  mountStandings(scroll, table, thead, tbody, lang);
  const humanCard = element('aside', 'board-human');
  const humanScore = element('div');
  humanScore.append(element('small', '', t.human), element('strong', '', duration(human.finish, true)), element('span', '', 'CP 16 / 16 · 100%'));
  const humanCopy = element('div');
  const humanPlayLink = element('a', 'board-human-play', t.humanPlay);
  humanPlayLink.href = HUMAN_PLAY_SPACE;
  humanPlayLink.target = '_blank';
  humanPlayLink.rel = 'noopener noreferrer';
  humanCopy.append(element('strong', '', t.humanHarness), element('p', '', t.humanNote), humanPlayLink);
  const humanMetrics = element('dl', 'board-human-metrics');
  for (const [label, value] of [[t.falls, number(human.falls)], [t.pauses, number(human.pauseCount)]]) {
    const metric = element('div');
    metric.append(element('dt', '', label), element('dd', '', value));
    humanMetrics.append(metric);
  }
  humanCard.append(humanScore, humanCopy, humanMetrics);
  const aiDivider = element('div', 'board-ai-divider');
  aiDivider.append(element('strong', '', t.aiRunsLabel), element('span', '', t.aiRunsCount));
  root.replaceChildren(humanCard, aiDivider, summary, scroll, element('p', 'board-foot', t.foot));
  renderMultiLeaderboard(lang, number);
}

function renderMultiLeaderboard(lang, number) {
  const t = copy[lang];
  const body = document.querySelector('.leaderboard-group.multi .leaderboard-group-body');
  const root = element('section', 'multi-results');
  root.setAttribute('aria-label', lang === 'zh' ? '多人赛实时成绩' : 'Multi-agent real-time results');

  const facts = element('div', 'multi-race-facts');
  const factValues = [
    [t.multiParticipants, String(multi.rows.length)],
    [t.multiBest, `${number(Math.max(...multi.rows.map(row => row.progressPercent)), 2)}%`],
    [t.multiFinishers, `0 / ${multi.rows.length}`],
    [t.multiClock, `${number(multi.realTimeFactor, 2)}×`],
  ];
  for (const [label, value] of factValues) {
    const fact = element('div');
    fact.append(element('span', '', label), element('strong', '', value));
    facts.append(fact);
  }

  const scroll = element('div', 'board-scroll multi-scroll');
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', lang === 'zh' ? '七鸭同场成绩表' : 'Seven-agent race standings');
  const table = element('table', 'multi-results-table');
  const caption = element('caption', '', t.multiCaption);
  const thead = element('thead');
  const header = element('tr');
  for (const label of [t.rank, t.agent, t.progress, t.falls, t.recovery, t.api, t.multiCompleted, t.ending]) {
    const cell = element('th', '', label);
    cell.scope = 'col';
    header.append(cell);
  }
  thead.append(header);
  const tbody = element('tbody');
  for (const row of multi.rows) {
    const tr = element('tr');
    tr.dataset.entrantId = row.entrantId;
    const rank = rankCell(row.rank, lang, 'multi-rank');
    const name = element('th', 'multi-agent');
    name.scope = 'row';
    name.append(entrantName(row.model, row.harness));
    const progress = element('td', 'multi-progress');
    progress.append(element('strong', '', `${number(row.progressPercent, 2)}%`), element('small', '', `CP ${String(row.checkpoints).padStart(2, '0')} / 16`));
    progress.append(progressBar(row.progressPercent));
    tr.append(rank, name, progress,
      element('td', 'multi-number', number(row.falls)),
      element('td', 'multi-number', `${number(row.recoverySeconds, 2)} ${t.seconds}`),
      element('td', 'multi-number', number(row.modelRequests)),
      element('td', 'multi-number', number(row.completedActions)),
      element('td', 'multi-outcome', t.multiOutcome));
    tbody.append(tr);
  }
  mountStandings(scroll, table, thead, tbody, lang, caption);

  const note = element('p', 'multi-note', t.multiNote);
  root.replaceChildren(facts, scroll, note);
  body.replaceChildren(root);
}
