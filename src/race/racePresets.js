// Shared by the browser roster and offline/CLI race validation.
export const MAX_ENTRANTS = 14;
export const SUPPORTED_COUNTS = Object.freeze(Array.from({ length: MAX_ENTRANTS }, (_, index) => index + 1));
export const GRAND_PRIX_PROFILE_IDS = Object.freeze([
  'codex-astra',
  'dsh-official-1017',
  'codex-sol',
  'codex-sol-6-1',
  'claude-fable-5-1',
  'zcode-glm-flash',
  'claude-haiku-5-5',
  'kimi-k3',
  'claude-sonnet-5-5',
  'qwen-max',
  'claude-opus-5-5',
  'codex-luna',
  'qwen-flash',
  'native-gemini',
]);

// Deliberately do not coerce: callers must parse textual inputs explicitly.
export function isSupportedEntrantCount(count) {
  return Number.isInteger(count) && count >= 1 && count <= MAX_ENTRANTS;
}
