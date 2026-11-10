import { GAITS, validateRaceAction } from './rules.js';

export const HUMAN_MAPPING = Object.freeze({ version: 2, camera: 'default first-person; freeview toggle orbits current actual root; presentation only; human test and local replay; horizon-stabilized first-person is not a calibrated head camera', keyboard: 'P pause/resume; W/S forward/back; A/D yaw; Q/E run lateral; Shift run (held); R roll; C sit; V stand; F physical recovery; Space zero', gamepad: 'Start/Menu[9] pause/resume; standard only: left Y forward/back; left X yaw; right X run lateral; RB run (held); Y[3] roll; X[2] sit/stand (runtime mode); A[0] physical recovery; B[1] unbound; LB zero', deadzone: .15, arbitration: 'keyboard activity wins; otherwise active standard gamepad; never combine sources; neutral on blur/hidden/disconnect' });
export function deadzone(value, zone = .15) {
  if (!Number.isFinite(value)) return 0;
  const x = Math.max(-1, Math.min(1, value));
  return Math.abs(x) <= zone ? 0 : Math.sign(x) * (Math.abs(x) - zone) / (1 - zone);
}
const pressed = (pad, index) => !!pad?.buttons?.[index]?.pressed;
export function createHumanInput() {
  const keys = new Set();
  let focused = true, previousButtons = [], previousPad = null, keyboardSkill = null;
  let paused = false, interacting = false, padBlocked = false, pausePad = null, startHeld = true;
  const blockedKeys = new Set();
  const skills = { KeyR: 'roulade', KeyC: 'sit', KeyV: 'stand', KeyF: 'recover_to_stand' };
  const relevant = new Set(['KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','Space', ...Object.keys(skills)]);
  return {
    key(code, down, repeat = false) {
      if (!relevant.has(code)) return false;
      if (!down) blockedKeys.delete(code);
      if (down && (!focused || paused || interacting || blockedKeys.has(code))) { blockedKeys.add(code); return true; }
      if (down) { if (!keys.has(code) && !repeat && skills[code]) keyboardSkill = skills[code]; keys.add(code); }
      else keys.delete(code);
      return true;
    },
    focus(value) {
      if (focused !== value) { pausePad = null; startHeld = true; }
      focused = value; keys.clear(); keyboardSkill = null; previousButtons = []; previousPad = null;
    },
    setPaused(value) {
      paused = !!value;
      for (const code of keys) blockedKeys.add(code);
      keys.clear(); keyboardSkill = null; padBlocked = true;
    },
    setInteracting(value) {
      interacting = !!value;
      for (const code of keys) blockedKeys.add(code);
      keys.clear(); keyboardSkill = null; padBlocked = true;
    },
    // Polled by the UI even while the native physics loop is frozen.
    pauseEdge(pads = []) {
      const pad = Array.from(pads ?? []).find(p => p?.connected !== false && p?.mapping === 'standard');
      const id = pad ? `${pad.index}:${pad.id}` : null;
      const held = pressed(pad,9);
      const edge = focused && id === pausePad && held && !startHeld;
      // Background polls cannot arm Start; foreground must observe release.
      pausePad = focused ? id : null; startHeld = !focused || held;
      return edge;
    },
    frame(pads = []) {
      const pad = Array.from(pads ?? []).find(p => p?.connected !== false && p?.mapping === 'standard');
      const padId = pad ? `${pad.index}:${pad.id}` : null;
      const disconnected = previousPad !== null && padId !== previousPad;
      // A newly connected controller must release held skill buttons before edges count.
      const fresh = padId !== previousPad;
      const buttons = [0,1,2,3].map(i => pressed(pad,i));
      const edge = buttons.findIndex((value, i) => i !== 1 && value && !fresh && !previousButtons[i]);
      previousButtons = buttons; previousPad = padId;
      const skill = keyboardSkill; keyboardSkill = null;
      if (paused || interacting || padBlocked) {
        // All controls must return to neutral; skills require a later fresh edge.
        const neutral = !pad || (![0,2,3,4,5].some(i => pressed(pad,i)) && ![0,1,2].some(i => deadzone(pad.axes?.[i]) !== 0));
        if (!paused && !interacting && neutral) padBlocked = false;
        return { source: 'safety', gait: 'walk', command: [0,0,0], skill: null };
      }
      if (!focused || disconnected) return { source: 'safety', gait: 'walk', command: [0,0,0], skill: null, diagnostic: !focused ? 'UNFOCUSED_ZERO' : 'GAMEPAD_DISCONNECTED_ZERO' };
      const keyboard = keys.size > 0 || !!skill;
      const source = keyboard ? 'keyboard' : pad ? 'gamepad' : 'keyboard';
      const gait = (keyboard ? keys.has('ShiftLeft') || keys.has('ShiftRight') : pressed(pad,5)) ? 'run' : 'walk';
      const range = GAITS[gait];
      const forward = keyboard ? Number(keys.has('KeyW')) - Number(keys.has('KeyS')) : -deadzone(pad?.axes?.[1]);
      const yaw = keyboard ? Number(keys.has('KeyA')) - Number(keys.has('KeyD')) : -deadzone(pad?.axes?.[0]);
      const lateral = keyboard ? Number(keys.has('KeyQ')) - Number(keys.has('KeyE')) : -deadzone(pad?.axes?.[2]);
      const zero = keyboard ? keys.has('Space') : pressed(pad,4);
      const scale = (v, limits) => v === 0 ? 0 : v >= 0 ? v * limits[1] : -v * limits[0];
      return { source, gait, command: zero ? [0,0,0] : [scale(forward,range.vx),scale(lateral,range.vy),scale(yaw,range.wz)], skill: zero ? null : keyboard ? skill : ['recover_to_stand',null,'sit_toggle','roulade'][edge] ?? null };
    },
  };
}

// Deliberately does not create observations, images or agent receipts.
export function validateHumanFrame(frame, { status, robot }) {
  let neutralInput = false;
  try {
    if (status !== 'running' || robot.raceStatus !== 'running') throw new Error('HUMAN_NOT_RUNNING');
    if (!frame || !['keyboard','gamepad','safety'].includes(frame.source)) throw new Error('INVALID_INPUT_SOURCE');
    if (!Array.isArray(frame.command) || frame.command.length !== 3) throw new Error('INVALID_COMMAND');
    const drive = validateRaceAction({ kind: 'drive', gait: frame.gait, vx: frame.command[0], vy: frame.command[1], wz: frame.command[2], duration_s: .2 });
    // Resolve at the native control tick from actual mode, never a UI-side toggle bit.
    // The existing active-skill/recovery/mode guards still apply to the resolved skill.
    const skillName = frame.skill === 'sit_toggle' ? (robot.mode === 'sitstand' ? 'stand' : 'sit') : frame.skill;
    const skill = skillName == null ? null : validateRaceAction({ kind: 'skill', name: skillName, timeout_s: 12 });
    // Input validity is independent of controller ownership. A genuine release
    // may rearm movement/escape even when this zero locomotion frame is rejected.
    neutralInput = ['keyboard','gamepad'].includes(frame.source) && skillName == null && drive.command.every(value => value === 0);
    if (robot.active?.spec.kind === 'skill' && !(robot.recovery && skill?.name === 'recover_to_stand' && robot.active.spec.name === 'recover_to_stand')) throw new Error('SKILL_NON_INTERRUPTIBLE');
    const recoveryRoll = !!robot.recovery && skill?.name === 'roulade';
    if (robot.recovery && skill?.name !== 'recover_to_stand' && !recoveryRoll) throw new Error(robot.recovery.phase === 'blocked' ? 'RECOVERY_BLOCKED' : 'BODY_RECOVERING');
    if (!skill && robot.mode !== 'walk') throw new Error('LOCOMOTION_UNAVAILABLE');
    if (skill?.name === 'stand' && robot.mode !== 'sitstand') throw new Error('STAND_REQUIRES_SITTING');
    if (['sit','roulade'].includes(skill?.name) && robot.mode !== 'walk' && !recoveryRoll) throw new Error('SKILL_REQUIRES_WALK_MODE');
    return { accepted: true, reason: 'ACCEPTED', drive, skill, neutralInput };
  } catch (error) { return { accepted: false, reason: error.message, neutralInput }; }
}

export function assertHumanConfiguration({ humanMode, replayMode, testMode, entrants, clockMode, startStage }) {
  if (humanMode && (replayMode || testMode || entrants.length !== 1 || entrants[0]?.id !== 'human' || clockMode !== 'realtime' || startStage !== 0)) throw new Error('INVALID_HUMAN_CONFIGURATION');
}
