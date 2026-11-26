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

class SoloCostChart extends HTMLElement {
  connectedCallback() {
    this.innerHTML = '<svg role="img"></svg><select></select><output aria-live="polite"></output>';
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
    const small = width < 460;
    const height = small ? 274 : 318;
    const left = 38, right = width - 12, top = 33, bottom = height - 54;
    const x = cost => left + cost / 45 * (right - left);
    const y = progress => bottom - progress / 60 * (bottom - top);
    const chooser = zh ? '查看模型' : 'Inspect a model';
    this.select.options[0].text = chooser;
    this.select.setAttribute('aria-label', chooser);
    const money = zh ? '整场估算 API 成本（美元）' : 'Estimated API cost per full run (USD)';
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
    for (let tick = 0; tick <= 45; tick += small ? 10 : 5) {
      label(x(tick), bottom + 19, '$' + tick, { 'text-anchor': 'middle' });
    }
    label(width / 2, height - 7, money, { 'text-anchor': 'middle' });
    const selection = runs.find(r => r.name === this.select.value);
    for (const run of runs) {
      const active = run === selection;
      const color = highlights.get(run.name) ?? (active ? '#385c76' : '#8a9aa4');
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
        const labelY = width < 305 && !isLeft ? yy + 22 : yy - 27;
        label(xx, labelY, run.name, style);
        label(xx, labelY + 17, `$${run.cost.toFixed(2)} · ${run.progress.toFixed(2)}%`, style);
      }
    }
    this.querySelector('output').textContent = selection ? `$${selection.cost.toFixed(2)} · ${selection.progress.toFixed(2)}%` : '';
  }
}

customElements.define('solo-cost-chart', SoloCostChart);
