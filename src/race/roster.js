import { RACE_ENTRANTS } from './presentation.js';
import { GAUNTLET_CIRCUIT } from '../envs/gauntletCircuit.js';
import { AGENT_PROFILES } from './agentProfiles.js';
import { isSupportedEntrantCount } from './racePresets.js';

export const DEEPSEEK_COLORS = Object.freeze([
  ['#F4FFFF', '#B9CBD6', '#36D9E8'],
  ['#E8302A', '#FF9D8F', '#FFC24D'],
  ['#2E6BFF', '#9CC2FF', '#E9F36A'],
  ['#F1DE32', '#FFF3AD', '#323641'],
  ['#FF668C', '#FFD1DE', '#FFC24D'],
  ['#FFAA32', '#FFE1B3', '#323641'],
  ['#28D6AD', '#B5F5E5', '#323641'],
  ['#A970FF', '#D9C4FF', '#FFC24D'],
  ['#19BDE0', '#C2F5FF', '#323641'],
  ['#DA66DB', '#F5CEF5', '#323641'],
  ['#86C940', '#E0F4C7', '#323641'],
  ['#B77952', '#EBD1BD', '#F4FFFF'],
  ['#7F8FA6', '#CCD5E1', '#FFC24D'],
  ['#FF7654', '#FFD1C5', '#323641'],
].map((colors) => Object.freeze(colors)));
export const DEEPSEEK_COLOR_NAMES = Object.freeze(['白色', '红色', '蓝色', '黄色', '粉色', '橙色', '绿色', '紫色', '青色', '洋红色', '青柠色', '棕色', '灰色', '珊瑚色']);
export const HARNESS_IDENTITY_COLORS = Object.freeze({
  zcode: '#F1DE32',
  'kimi-code': '#FF668C',
  'grok-build': '#FFAA32',
  'gemini-cli': '#28D6AD',
  'qwen-code': '#A970FF',
  dsh: '#F4FFFF',
  'claude-code': '#E8302A',
  'codex-duck': '#2E6BFF',
});
export const HARNESS_IDENTITY_COLOR_NAMES = Object.freeze({
  zcode: '黄色',
  'kimi-code': '粉色',
  'grok-build': '橙色',
  'gemini-cli': '绿色',
  'qwen-code': '紫色',
  dsh: '白色',
  'claude-code': '红色',
  'codex-duck': '蓝色',
});
const HARNESS_LIVERY = Object.freeze({
  zcode: Object.freeze(['#F1DE32', '#F4FFFF', '#323641']),
  'kimi-code': Object.freeze(['#FF668C', '#F4FFFF', '#FFC24D']),
  'grok-build': Object.freeze(['#FFAA32', '#D5DCE5', '#F4FFFF']),
  'gemini-cli': Object.freeze(['#28D6AD', '#B9CBD6', '#36D9E8']),
  'qwen-code': Object.freeze([HARNESS_IDENTITY_COLORS['qwen-code'], '#D9C4FF', '#FFC24D']),
  dsh: Object.freeze([HARNESS_IDENTITY_COLORS.dsh, '#B9CBD6', '#36D9E8']),
  'claude-code': DEEPSEEK_COLORS[1],
  'codex-duck': DEEPSEEK_COLORS[2],
});

export function raceRoster(mode = 'legacy', harness = 'dsh', profileIds = null) {
  if (mode === 'legacy') return RACE_ENTRANTS;
  const match = typeof mode === 'string' && /^deepseek-([1-9]\d*)$/.exec(mode);
  const count = match ? Number(match[1]) : NaN;
  if (!isSupportedEntrantCount(count)) throw new Error('INVALID_RACE_ROSTER');
  const harnesses = Array.isArray(harness) ? harness : String(harness).split(',');
  if (harnesses.length !== 1 && harnesses.length !== count) throw new Error('INVALID_RACE_HARNESSES');
  if (profileIds != null && (!Array.isArray(profileIds) || profileIds.length !== count || Array.from(profileIds).some((id) => !Object.hasOwn(AGENT_PROFILES, id)))) throw new Error('INVALID_RACE_AGENT_PROFILES');
  const entrantHarnesses = Array.from({ length: count }, (_, index) => harnesses.length === 1 ? harnesses[0] : harnesses[index]);
  const useHarnessLivery = new Set(entrantHarnesses).size === count;
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const entrantHarness = entrantHarnesses[index];
    if (!Object.hasOwn(HARNESS_LIVERY, entrantHarness)) throw new Error('INVALID_RACE_HARNESS');
    const [primary, secondary, accent] = useHarnessLivery ? HARNESS_LIVERY[entrantHarness] : DEEPSEEK_COLORS[index];
    const colorName = useHarnessLivery ? HARNESS_IDENTITY_COLOR_NAMES[entrantHarness] : DEEPSEEK_COLOR_NAMES[index];
    const profile = profileIds ? AGENT_PROFILES[profileIds[index]] : null;
    if (profile && profile.harness !== entrantHarness) throw new Error('RACE_PROFILE_HARNESS_MISMATCH');
    const harnessLabel = entrantHarness === 'zcode' ? 'ZCode' : entrantHarness === 'kimi-code' ? 'Kimi Code' : entrantHarness === 'grok-build' ? 'Grok Build' : entrantHarness === 'qwen-code' ? 'Qwen Code' : entrantHarness === 'gemini-cli' ? 'Gemini CLI' : entrantHarness === 'claude-code' ? 'Claude Code' : entrantHarness === 'codex-duck' ? 'Codex' : 'DSH';
    return Object.freeze({
      id: `deepseek-${index + 1}`,
      number: String(index + 1).padStart(2, '0'),
      label: `${harnessLabel} · ${profile?.model ?? 'DeepSeek V4.1 Flash'} #${index + 1}`,
      harness: entrantHarness,
      identityColor: primary,
      identityColorName: colorName,
      model: profile?.model ?? 'deepseek-flash',
      colorName,
      gridSlot: null,
      ...(count === 1 ? { spawn: GAUNTLET_CIRCUIT.spawn } : {}),
      primary, secondary, accent,
      pattern: 'chevron',
      liveryId: `${entrantHarness === 'dsh' ? '' : `${entrantHarness}-`}deepseek-v4.1-${index + 1}`,
      baseVariant: 'charcoal',
    });
  }));
}
