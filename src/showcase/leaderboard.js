import data from './leaderboard-data.json';
import './leaderboard.css';

const copy = {
  zh: {
    label: '单人赛 · 实时运行', title: '历史单人赛成绩',
    intro: '这些成绩来自早期赛道的单次试跑，渠道与赛道版本见详细结果。',
    snapshot: '数据快照', configurations: 'AI 配置', measured: '项实测', compatibility: '项工具兼容失败',
    best: '最高路线进度', finishers: 'AI 完赛',
    rank: '名次', agent: 'Agent / 模型', progress: '路线进度 / 检查点', time: '仿真用时',
    falls: '跌倒', recovery: '恢复时长', api: '模型请求', actions: '动作提交', ending: '结束原因',
    checkpoints: 'CP', finishRule: '完赛标准：通过 16 个检查点', audited: '审计修订', human: '人类参考',
    limit: '达到 1 小时时限', early: '提前结束',
    infrastructure: '客户端退出 · 基础设施中断', retired: '规则退役 · 检查点顺序错误', finished: '已完赛',
    failed: '无法正确调用工具', unmeasured: '非实测', humanHarness: '浏览器手柄',
    provisional: 'Grok 的 0% 沿用来源展示约定，未开展正式比赛，其他指标保留未知。',
    humanNote: '独立参考，不参与 AI 排名；视角与控制条件不同，赛道版本为 V2 / V20。',
    foot: '用时为结束时的仿真时间；— 表示未记录。',
    details: '详细结果 ↗', source: '选用来源', low: 'LOW 推理档位',
    tokens: 'Token（输入 / 输出）', noTokens: 'Token 未报告', seconds: '秒', scroll: '可横向滚动查看全部指标',
  },
  en: {
    label: 'SOLO · REAL-TIME', title: 'Historical solo results',
    intro: 'Single trials on earlier course revisions. See the full results for course and provider details.',
    snapshot: 'SNAPSHOT', configurations: 'AI CONFIGURATIONS', measured: 'measured', compatibility: 'tool incompatibility',
    best: 'BEST ROUTE PROGRESS', finishers: 'AI FINISHERS',
    rank: 'RANK', agent: 'AGENT / MODEL', progress: 'PROGRESS / CHECKPOINTS', time: 'SIM TIME',
    falls: 'FALLS', recovery: 'RECOVERY', api: 'MODEL REQUESTS', actions: 'ACTION CALLS', ending: 'ENDING',
    checkpoints: 'CP', finishRule: 'FINISH REQUIRES ALL 16 CHECKPOINTS', audited: 'AUDITED', human: 'HUMAN REFERENCE',
    limit: 'One-hour limit', early: 'Ended early',
    infrastructure: 'Client exited · infrastructure failure', retired: 'Rule retirement · out-of-order checkpoint', finished: 'Finished',
    failed: 'Unable to call tools correctly', unmeasured: 'NOT MEASURED', humanHarness: 'Browser Gamepad',
    provisional: 'Grok’s 0% follows the source display convention: no formal race was run, and all other metrics remain unknown.',
    humanNote: 'Separate reference, excluded from AI ranks. Views and controls differ; course version V2 / V20.',
    foot: 'Sim time is elapsed time at termination. — indicates an unrecorded value.',
    details: 'Full results ↗', source: 'SELECTED SOURCE', low: 'LOW REASONING EFFORT',
    tokens: 'Tokens (input / output)', noTokens: 'Token usage not reported', seconds: 's', scroll: 'Scroll horizontally to view all metrics',
  },
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function duration(value, precise = false) {
  if (!Number.isFinite(value)) return '—';
  if (precise) return `${Math.floor(value / 60)}:${(value % 60).toFixed(2).padStart(5, '0')}`;
  const seconds = Math.round(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function ending(row, t) {
  if (row.human) return t.finished;
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
    root.setAttribute('aria-labelledby', 'solo-results-title');
    document.querySelector('.leaderboard-group.solo .leaderboard-group-body').append(root);
  }
  const head = element('div', 'board-heading');
  const heading = element('div');
  heading.append(element('small', 'board-eyebrow', t.label));
  const title = element('h3', '', t.title);
  title.id = 'solo-results-title';
  heading.append(title);
  const link = element('a', 'board-details-link', t.details);
  link.href = `/race-results.html?lang=${lang}`;
  head.append(heading, link);
  const measured = data.rows.filter(row => !row.human);
  const human = data.rows.find(row => row.human);
  const summary = element('div', 'board-summary');
  const stats = [
    [String(data.displayCounts.ai_configurations_displayed), t.configurations, `${measured.length} ${t.measured} · ${data.unranked.length} ${t.compatibility}`],
    [`${number(Math.max(...measured.map(row => row.progressPercent)), 2)}%`, t.best, measured[0].model],
    [`${measured.filter(row => row.finish != null).length} / ${measured.length}`, t.finishers, t.finishRule],
  ];
  for (const [value, label, detail] of stats) {
    const card = element('div');
    card.append(element('span', '', label), element('strong', '', value), element('small', '', detail));
    summary.append(card);
  }

  const scroll = element('div', 'board-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', t.title);
  const table = element('table', 'results-table');
  const caption = element('caption', '', `${t.snapshot} · ${data.snapshotDate}`);
  const thead = element('thead');
  const header = element('tr');
  for (const label of [t.rank, t.agent, t.progress, t.time, t.falls, t.recovery, t.api, t.actions, t.ending]) {
    const cell = element('th', '', label);
    cell.scope = 'col';
    header.append(cell);
  }
  thead.append(header);
  const tbody = element('tbody');
  tbody.id = 'runs';
  for (const row of measured) {
    const tr = element('tr');
    tr.dataset.runId = row.id;
    if (row.rank === 1) tr.className = 'board-leader';
    tr.append(element('td', 'board-rank', String(row.rank).padStart(2, '0')));
    const name = element('th', 'board-agent');
    name.scope = 'row';
    name.append(element('strong', '', row.model), element('small', '', `${row.harness} · ${row.effort.toUpperCase()}`));
    tr.append(name);
    const progress = element('td', 'board-progress');
    progress.append(element('strong', '', `${number(row.progressPercent, 2)}%`), element('small', '', `${t.checkpoints} ${String(row.cp).padStart(2, '0')} / 16`));
    const bar = element('div', 'board-bar');
    const fill = element('span');
    fill.style.width = `${row.progressPercent}%`;
    bar.append(fill);
    progress.append(bar);
    tr.append(progress);
    for (const value of [duration(row.sim), number(row.falls), `${number(row.recovery, 2)} ${t.seconds}`, number(row.api), number(row.act)]) tr.append(element('td', 'board-number', value));
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
    name.append(element('strong', '', row.model), element('small', '', row.harness));
    tr.append(name);
    const progress = element('td', 'board-progress');
    progress.append(element('strong', '', '—'), element('small', '', t.unmeasured));
    tr.append(progress);
    for (let i = 0; i < 5; i++) tr.append(element('td', 'board-number', '—'));
    tr.append(element('td', 'board-ending', t.failed));
    tbody.append(tr);
  }
  table.append(caption, thead, tbody);
  scroll.append(table);
  const humanCard = element('aside', 'board-human');
  const humanScore = element('div');
  humanScore.append(element('small', '', t.human), element('strong', '', duration(human.finish, true)), element('span', '', 'CP 16 / 16 · 100%'));
  const humanCopy = element('div');
  humanCopy.append(element('strong', '', t.humanHarness), element('p', '', t.humanNote));
  const humanMetrics = element('dl', 'board-human-metrics');
  for (const [label, value] of [[t.falls, number(human.falls)], [t.recovery, `${number(human.recovery, 2)} ${t.seconds}`]]) {
    const metric = element('div');
    metric.append(element('dt', '', label), element('dd', '', value));
    humanMetrics.append(metric);
  }
  humanCard.append(humanScore, humanCopy, humanMetrics);
  root.replaceChildren(head, element('p', 'board-intro', t.intro), summary, humanCard, scroll, element('p', 'board-foot', t.foot));
}
