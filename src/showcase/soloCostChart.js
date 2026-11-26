// Published solo-run estimates, rounded to cents and hundredths of a percent.
const runs = [
  {"name": "GPT-6 Astra", "cost": 41.9, "progress": 50.85, "partial": false},
  {"name": "DeepSeek V4.1 Flash", "cost": 1.02, "progress": 49.94, "partial": false},
  {"name": "GPT-6 Sol", "cost": 13.88, "progress": 40.7, "partial": true},
  {"name": "GPT-6.1 Sol", "cost": 3.33, "progress": 40.12, "partial": false},
  {"name": "Claude Fable 5.1", "cost": 13.69, "progress": 37.43, "partial": false},
  {"name": "Qwen3.8 Flash", "cost": 0.72, "progress": 31.85, "partial": false},
  {"name": "GLM-5.3 Flash", "cost": 1.14, "progress": 31.17, "partial": false},
  {"name": "Claude Haiku 5.5", "cost": 0.92, "progress": 31.17, "partial": true},
  {"name": "Qwen3.8 27B", "cost": 7.85, "progress": 30.01, "partial": false},
  {"name": "Kimi K3", "cost": 14.62, "progress": 23.28, "partial": false},
  {"name": "Claude Sonnet 5.5", "cost": 4.24, "progress": 18.66, "partial": true},
  {"name": "Qwen3.8 Max", "cost": 10.8, "progress": 18.66, "partial": false},
  {"name": "Claude Opus 5.5", "cost": 5.78, "progress": 15.96, "partial": true},
  {"name": "GPT-6 Luna", "cost": 0.23, "progress": 13.61, "partial": false},
  {"name": "Gemini 3.8 Flash", "cost": 17.13, "progress": 3.41, "partial": true},
];

const highlights = new Map([
  ['DeepSeek V4.1 Flash', '#1755ae'],
  ['GPT-6 Astra', '#17624f'],
]);

const families = {
  GPT: '#17624f', DeepSeek: '#1755ae', Claude: '#a45631', Qwen: '#79539a',
  GLM: '#367782', Kimi: '#506084', Gemini: '#69747b',
};

// Stagger labels where several runs have nearly identical progress.
const offsets = {
  'GPT-6 Sol': [6, -9], 'GPT-6.1 Sol': [6, -7], 'Claude Fable 5.1': [6, 10],
  'Qwen3.8 Flash': [-5, -10], 'Claude Haiku 5.5': [-5, 18], 'GLM-5.3 Flash': [7, -4],
  'Qwen3.8 27B': [8, 11], 'Claude Sonnet 5.5': [-6, -8], 'Qwen3.8 Max': [7, -5],
  'Claude Opus 5.5': [6, 12], 'Gemini 3.8 Flash': [-7, -6],
};

class SoloCostChart extends HTMLElement {
  connectedCallback() {
    this.innerHTML = '<svg role="img"></svg><select></select><output aria-live="polite"></output><table hidden><thead><tr></tr></thead><tbody></tbody></table>';
    this.svg = this.querySelector('svg');
    this.select = this.querySelector('select');
    this.select.add(new Option('', ''));
    for (const run of runs) this.select.add(new Option(run.name, run.name));
    this.select.onchange = () => this.draw();
    this.resize = new ResizeObserver(() => {
      if (this.clientWidth !== this.width) this.draw();
    });
    this.resize.observe(this);
    this.language = new MutationObserver(() => this.draw());
    this.language.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    this.draw();
  }

  disconnectedCallback() {
    this.resize.disconnect();
    this.language.disconnect();
  }

  draw() {
    const width = this.width = this.clientWidth;
    if (!width) return;
    const zh = document.documentElement.lang.startsWith('zh');
    const small = width < 580;
    const height = small ? 300 : 406;
    const left = 38, right = width - 18, top = small ? 65 : 33, bottom = height - 54;
    const x = cost => left + Math.log(cost / 0.2) / Math.log(50 / 0.2) * (right - left);
    const y = progress => bottom - progress / 60 * (bottom - top);
    const chooser = zh ? '查看模型' : 'Inspect a model';
    this.select.options[0].text = chooser;
    this.select.setAttribute('aria-label', chooser);
    const money = zh ? '整场估算成本（美元，对数刻度）' : 'Estimated full-run cost (USD, log scale)';
    const metric = zh ? '最终路线进度' : 'Final route progress';
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.setAttribute('aria-label', `${metric} / ${money}`);
    this.svg.replaceChildren();
    const add = (tag, attrs, text) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
      if (text !== undefined) el.textContent = text;
      this.svg.append(el);
      return el;
    };
    const label = (xx, yy, str, attrs = {}) => add('text', { x: xx, y: yy, fill: '#465964', 'font-size': 13, ...attrs }, str);
    label(left, 18, metric);
    for (const tick of [0, 10, 20, 30, 40, 50]) {
      add('line', { x1: left, x2: right, y1: y(tick), y2: y(tick), stroke: tick ? '#e3e8eb' : '#aabac2' });
      label(left - 6, y(tick) + 4, tick + '%', { 'text-anchor': 'end' });
    }
    for (const tick of (small ? [0.2, 1, 5, 10, 50] : [0.2, 0.5, 1, 2, 5, 10, 20, 50])) {
      label(x(tick), bottom + 19, '$' + tick, { 'text-anchor': 'middle' });
    }
    label(width / 2, height - 7, money, { 'text-anchor': 'middle' });
    const selection = runs.find(r => r.name === this.select.value);
    for (const run of runs) {
      const active = run === selection;
      const color = families[run.name.match(/^[A-Za-z]+/)[0]];
      const xx = x(run.cost), yy = y(run.progress);
      const dot = add('circle', { cx: xx, cy: yy, r: highlights.has(run.name) || active ? 5 : 3.4,
        fill: run.partial ? 'white' : color, stroke: color, 'stroke-width': 1.5 });
      const title = document.createElementNS(dot.namespaceURI, 'title');
      title.textContent = `${run.name} · $${run.cost.toFixed(2)} · ${run.progress.toFixed(2)}%`;
      dot.append(title);
      dot.style.cursor = 'pointer';
      dot.onclick = () => { this.select.value = run.name; this.draw(); };
      if (highlights.has(run.name)) {
        const isLeft = run.cost < 10;
        const style = { fill: color, 'font-weight': 650, 'text-anchor': isLeft ? 'start' : 'end' };
        const labelY = small && !isLeft ? yy - 61 : yy - 27;
        label(xx, labelY, small && isLeft ? 'DeepSeek Flash' : run.name, style);
        label(xx, labelY + 17, `$${run.cost.toFixed(2)} · ${run.progress.toFixed(2)}%`, style);
      } else if (!small) {
        const [dx, dy] = offsets[run.name] ?? [7, -5];
        label(xx + dx, yy + dy, run.name, {
          fill: color, 'font-size': 12, 'text-anchor': dx < 0 ? 'end' : 'start', 'pointer-events': 'none',
        });
      }
    }
    const table = this.querySelector('table');
    table.hidden = !small;
    if (small) {
      const header = table.tHead.rows[0];
      header.replaceChildren();
      for (const name of (zh ? ['模型', '整场成本', '进度'] : ['Model', 'Run cost', 'Progress'])) {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = name;
        header.append(th);
      }
      const body = table.tBodies[0];
      body.replaceChildren();
      for (const run of runs) {
        const row = body.insertRow();
        for (const value of [run.name, '$' + run.cost.toFixed(2), run.progress.toFixed(2) + '%']) {
          row.insertCell().textContent = value;
        }
      }
    }
    this.querySelector('output').textContent = selection ? `$${selection.cost.toFixed(2)} · ${selection.progress.toFixed(2)}%` : '';
  }
}

customElements.define('solo-cost-chart', SoloCostChart);
