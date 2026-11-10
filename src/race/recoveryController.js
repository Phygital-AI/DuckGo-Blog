// Controller-only retries. Never changes qpos/qvel, actuator gains or force limits.
import { CTRL_DT } from '../game/constants.js';
// Bounded automatic cycles continue until physically stable or the race ends.
export const RECOVERY_BUDGET_SECONDS = 24;
export const RECOVERY_MAX_ATTEMPTS = 3;

export const RECOVERY_STALL_SECONDS = 4;
export const RECOVERY_ROLL_SECONDS = 2;
export const RECOVERY_STABLE_TICKS = 30;

const vector = state => [state.pose.z, state.upright, ...state.joints];
function windowAt(tick, state) {
  const values = vector(state);
  return { tick, min: [...values], max: [...values], maxSpeed: state.speed };
}
export function createRecovery(tick, state, attempt = 1, escapes = 0) {
  return { budgetStartTick: tick, startTick: tick, phaseStartTick: tick, phase: 'stand', attempt, escapes, cycle: 1, stableTicks: 0, window: windowAt(tick, state), lastReason: 'START' };
}
export function restartRecovery(recovery, tick, state, reason) {
  const newCycle = reason === 'BUDGET_EXHAUSTED' || recovery.attempt >= RECOVERY_MAX_ATTEMPTS;
  const next = createRecovery(tick, state, newCycle ? 1 : recovery.attempt + 1, recovery.escapes + 1);
  next.budgetStartTick = newCycle ? tick : recovery.budgetStartTick;
  next.cycle = recovery.cycle + (newCycle ? 1 : 0);
  next.phase = 'roll_escape';
  next.rollSeconds = next.escapes % 2 === 1 ? 2 : 4;
  next.lastReason = reason;
  return next;
}

export const recoveryPolicy = recovery => recovery?.phase === 'roll_escape' ? 'roll' : 'stand';

// Returns an event; the caller clears actual previous-action history on every
// retry/phase transition, and applies the selected ONNX policy normally.
export function advanceRecovery(recovery, tick, state) {
  recovery.stableTicks = state.upright > .9 && state.pose.z > .085 && state.speed < .12 ? recovery.stableTicks + 1 : 0;
  if (recovery.stableTicks >= RECOVERY_STABLE_TICKS) return { type: 'completed' };
  if ((tick - recovery.budgetStartTick) * CTRL_DT >= RECOVERY_BUDGET_SECONDS) return { type: 'retry', reason: 'BUDGET_EXHAUSTED' };
  if (recovery.phase === 'roll_escape') {
    if ((tick - recovery.phaseStartTick) * CTRL_DT >= (recovery.rollSeconds ?? RECOVERY_ROLL_SECONDS)) {
      recovery.phase = 'stand';
      recovery.phaseStartTick = tick;
      recovery.window = windowAt(tick, state);
      return { type: 'phase', phase: 'stand', reason: 'BOUNDED_ROLL_COMPLETE' };
    }
    return null;
  }
  const window = recovery.window;
  vector(state).forEach((value, i) => {
    window.min[i] = Math.min(window.min[i], value);
    window.max[i] = Math.max(window.max[i], value);
  });
  window.maxSpeed = Math.max(window.maxSpeed, state.speed);
  if ((tick - window.tick) * CTRL_DT >= RECOVERY_STALL_SECONDS) {
    const ranges = window.max.map((value, i) => value - window.min[i]);
    const stalled = recovery.stableTicks === 0 && window.maxSpeed < .02 && ranges[0] < .003 && ranges[1] < .02 && ranges.slice(2).every(range => range < .03);
    recovery.window = windowAt(tick, state);
    if (stalled) return { type: 'retry', reason: 'STALLED', window_s: RECOVERY_STALL_SECONDS, height_range_m: ranges[0], upright_range: ranges[1], max_joint_range_rad: Math.max(...ranges.slice(2)), max_speed_m_s: window.maxSpeed };
  }
  return null;
}

export function recoveryProgress(recovery, tick) {
  return recovery ? { recovery_attempt: recovery.attempt, recovery_phase: recovery.phase, recovery_policy: recoveryPolicy(recovery), recovery_blocked: false, recovery_automatic: true, recovery_cycle: recovery.cycle, recovery_budget_remaining_s: Math.max(0, RECOVERY_BUDGET_SECONDS - (tick - recovery.budgetStartTick) * CTRL_DT), recovery_phase_elapsed_s: (tick - recovery.phaseStartTick) * CTRL_DT, recovery_last_restart_reason: recovery.lastReason } : { recovery_blocked: false, recovery_automatic: false, recovery_cycle: null, recovery_budget_remaining_s: 0, recovery_attempt: null, recovery_phase: null, recovery_policy: null, recovery_phase_elapsed_s: 0, recovery_last_restart_reason: null };
}
