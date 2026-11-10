// Shared by the browser launcher and the local supervisor. Never put credentials here.
export const AGENT_PROFILES = Object.freeze({
  'codex-astra-openlux-independent': Object.freeze({ id: 'codex-astra-openlux-independent', name: 'Codex', detail: 'OpenLux independent account · GPT-6 Astra', harness: 'codex-duck', entrant: 'codex', provider: 'openluxIndependent', model: 'gpt-6-astra', efforts: ['low'], defaultEffort: 'low' }),
  'zcode-glm-flash': Object.freeze({ id: 'zcode-glm-flash', name: 'ZCode', detail: 'OpenLux · GLM 5.3 Flash', harness: 'zcode', entrant: 'zcode', provider: 'openlux', model: 'glm-5.3-flash', efforts: ['low'], defaultEffort: 'low' }),
  // Separate provider route so the historical OpenLux GLM profile stays reproducible.
  'zcode-glm-gateway': Object.freeze({ id: 'zcode-glm-gateway', name: 'ZCode', detail: 'GLM Gateway · GLM-5.3-Flash', harness: 'zcode', entrant: 'zcode', provider: 'glmgateway', model: 'GLM-5.3-Flash', efforts: ['low'], defaultEffort: 'low' }),
  'kimi-k3': Object.freeze({ id: 'kimi-k3', name: 'Kimi Code', detail: 'OpenLux · Kimi K3', harness: 'kimi-code', entrant: 'kimi', provider: 'openlux', model: 'kimi-k3', efforts: ['low'], defaultEffort: 'low' }),
  'grok-4-7': Object.freeze({ id: 'grok-4-7', name: 'Grok Build', detail: 'OpenLux · Grok 4.7', harness: 'grok-build', entrant: 'grok', provider: 'openlux', model: 'grok-4.7', efforts: ['low'], defaultEffort: 'low' }),
  'native-gemini': Object.freeze({ id: 'native-gemini', name: 'Gemini CLI', detail: 'OpenLux · Gemini 3.8 Flash', harness: 'gemini-cli', entrant: 'gemini', provider: 'openlux', model: 'gemini-3.8-flash', efforts: ['low'], defaultEffort: 'low' }),
  'qwen-max': Object.freeze({ id: 'qwen-max', name: 'Qwen Code', detail: 'Qianwen · Qwen3.8 Max', harness: 'qwen-code', entrant: 'qwen', provider: 'qianwen', model: 'qwen3.8-max', efforts: ['low', 'none'], defaultEffort: 'low' }),
  'qwen-max-openlux': Object.freeze({ id: 'qwen-max-openlux', name: 'Qwen Code', detail: 'OpenLux · Qwen3.8 Max', harness: 'qwen-code', entrant: 'qwen', provider: 'openlux', model: 'qwen3.8-max', efforts: ['low', 'none'], defaultEffort: 'low' }),
  'qwen-flash': Object.freeze({ id: 'qwen-flash', name: 'Qwen Code', detail: 'Qianwen · Qwen3.8 Flash', harness: 'qwen-code', entrant: 'qwen', provider: 'qianwen', model: 'qwen3.8-flash', efforts: ['low', 'none'], defaultEffort: 'low' }),
  'qwen-flash-openlux': Object.freeze({ id: 'qwen-flash-openlux', name: 'Qwen Code', detail: 'OpenLux · Qwen3.8 Flash', harness: 'qwen-code', entrant: 'qwen', provider: 'openlux', model: 'qwen3.8-flash', efforts: ['low', 'none'], defaultEffort: 'low' }),
  'qwen-27b': Object.freeze({ id: 'qwen-27b', name: 'Qwen Code', detail: 'Qianwen · Qwen3.8 27B', harness: 'qwen-code', entrant: 'qwen', provider: 'qianwen', model: 'qwen3.8-27b', efforts: ['low', 'none'], defaultEffort: 'low' }),
  deepseek: Object.freeze({ id: 'deepseek', name: 'DSH', detail: 'OpenLux · DeepSeek V4.1 Flash', harness: 'dsh', entrant: 'deepseek', provider: 'openlux', model: 'deepseek-v4.1-flash', efforts: ['low', 'high', 'max'], defaultEffort: 'low' }),
  'dsh-deepseek-official': Object.freeze({ id: 'dsh-deepseek-official', name: 'DSH', detail: 'DeepSeek 官方 · V4.1 Flash', harness: 'dsh', entrant: 'deepseek', provider: 'deepseek', model: 'deepseek-flash', efforts: ['low', 'high', 'max'], defaultEffort: 'low' }),
  'dsh-official-1017': Object.freeze({ id: 'dsh-official-1017', name: 'DSH', detail: 'DeepSeek V4.1 Flash 1017 (official)', harness: 'dsh', entrant: 'deepseek', provider: 'deepseek', model: 'deepseek-flash', efforts: ['low', 'high', 'max'], defaultEffort: 'low' }),
  'claude-code-deepseek': Object.freeze({ id: 'claude-code-deepseek', name: 'Claude Code', detail: 'DeepSeek V4.1 Flash', harness: 'claude-code', entrant: 'claude-deepseek', provider: 'deepseek', model: 'deepseek-flash', efforts: ['low', 'high', 'max'], defaultEffort: 'low' }),
  'codex-duck-deepseek': Object.freeze({ id: 'codex-duck-deepseek', name: 'Codex', detail: 'DeepSeek V4.1 Flash', harness: 'codex-duck', entrant: 'codex-deepseek', provider: 'deepseek', model: 'deepseek-flash', efforts: ['low', 'high', 'max'], defaultEffort: 'low' }),
  'codex-astra': Object.freeze({ id: 'codex-astra', name: 'Codex', detail: 'OpenLux · GPT-6 Astra', harness: 'codex-duck', entrant: 'codex', provider: 'openlux', model: 'gpt-6-astra', efforts: ['low', 'medium', 'high', 'xhigh', 'max'], defaultEffort: 'low' }),
  // Exact authenticated OpenLux identity; only requested low exposed, no inferred higher levels.
  'codex-sol-6-1': Object.freeze({ id: 'codex-sol-6-1', name: 'Codex', detail: 'OpenLux · GPT-6.1 Sol', harness: 'codex-duck', entrant: 'codex', provider: 'openlux', model: 'gpt-6.1-sol', efforts: ['low'], defaultEffort: 'low' }),
  'codex-sol': Object.freeze({ id: 'codex-sol', name: 'Codex', detail: 'OpenLux · GPT-6 Sol', harness: 'codex-duck', entrant: 'codex', provider: 'openlux', model: 'gpt-6-sol', efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], defaultEffort: 'none' }),
  'codex-luna': Object.freeze({ id: 'codex-luna', name: 'Codex', detail: 'OpenLux · GPT-6 Luna', harness: 'codex-duck', entrant: 'codex', provider: 'openlux', model: 'gpt-6-luna', efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'], defaultEffort: 'none' }),
  // Authenticated catalog IDs; low is requested via the native Claude schema,
  // not a claim that this gateway enumerates per-model effort support.
  'claude-fable-5-1': Object.freeze({ id: 'claude-fable-5-1', name: 'Claude Code', detail: 'OpenLux · Claude Fable 5.1', harness: 'claude-code', entrant: 'claude', provider: 'openlux', model: 'claude-fable-5-1', efforts: ['low'], defaultEffort: 'low' }),
  'claude-sonnet-5-5': Object.freeze({ id: 'claude-sonnet-5-5', name: 'Claude Code', detail: 'OpenLux · Claude Sonnet 5.5', harness: 'claude-code', entrant: 'claude', provider: 'openlux', model: 'claude-sonnet-5-5', efforts: ['low'], defaultEffort: 'low' }),
  'claude-haiku-5-5': Object.freeze({ id: 'claude-haiku-5-5', name: 'Claude Code', detail: 'OpenLux · Claude Haiku 5.5', harness: 'claude-code', entrant: 'claude', provider: 'openlux', model: 'claude-haiku-5-5', efforts: ['low'], defaultEffort: 'low' }),
  'claude-opus-5-5': Object.freeze({ id: 'claude-opus-5-5', name: 'Claude Code', detail: 'OpenLux · Claude Opus 5.5', harness: 'claude-code', entrant: 'claude', provider: 'openlux', model: 'claude-opus-5-5', efforts: ['low', 'medium', 'high', 'xhigh', 'max'], defaultEffort: 'low' }),
});

export function sharedEfforts(ids) {
  const profiles = ids.map((id) => AGENT_PROFILES[id]);
  if (profiles.some((profile) => !profile)) return [];
  const mixedMinimum = new Set(profiles.map((profile) => profile.defaultEffort)).size > 1;
  const common = profiles.reduce((levels, profile) => levels.filter((level) => profile.efforts.includes(level)), ['none', 'low', 'medium', 'high', 'xhigh', 'max']);
  return mixedMinimum ? ['lowest', ...common] : profiles.length ? [profiles[0].defaultEffort, ...common.filter(level => level !== profiles[0].defaultEffort)] : common;
}
