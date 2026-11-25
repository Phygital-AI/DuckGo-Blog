const modelNames = {
  'gpt-6-astra': 'GPT-6 Astra',
  'gpt-6-sol': 'GPT-6 Sol',
  'gpt-6.1-sol': 'GPT-6.1 Sol',
  'gpt-6-luna': 'GPT-6 Luna',
  'claude-fable-5-1': 'Fable 5.1',
  'claude-sonnet-5-5': 'Sonnet 5.5',
  'claude-haiku-5-5': 'Haiku 5.5',
  'claude-opus-5-5': 'Opus 5.5',
  'deepseek-flash': 'DeepSeek V4.1 Flash 1017',
  'glm-5.3-flash': 'GLM-5.3-Flash',
  'kimi-k3': 'Kimi K3',
  'qwen3.8-max': 'Qwen3.8 Max',
  'qwen3.8-flash': 'Qwen3.8 Flash',
  'qwen3.8-27b': 'Qwen3.8 27B',
  'gemini-3.8-flash': 'Gemini 3.8 Flash',
  'grok-4.7': 'Grok 4.7',
};

export function modelName(model) {
  return modelNames[model] ?? model;
}
