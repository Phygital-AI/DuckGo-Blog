import { CTRL_DT as CONTROL_DT_S } from '../game/constants.js';
import { OUT_OF_BOUNDS_GRACE_SECONDS } from '../envs/circuitRuntime.js';

export const RACE_SECONDS = 3600;
export const DECISION_WALL_SECONDS = 3600;
export const RECOVERY_TIMEOUT_SECONDS = 24;
export const FRAME_MAX_AGE_SECONDS = 90;
// READY has no physical evolution. Only a frame from this episode and the
// unchanged READY tick may ignore wall age; RUNNING retains the 90 s bound.
export function isActionFrameValid(observation, { episode, status, tick, nowMs }) {
  if (!observation || observation.episode_id !== episode) return false;
  if (status === 'ready' && observation.race_status === 'ready' && observation.tick === tick) return true;
  return nowMs - observation.createdAt <= FRAME_MAX_AGE_SECONDS * 1000;
}
// Both clock tracks use the same moving-obstacle trajectory in simulation time.
export const OBSTACLE_SPEED_SCALE = .5;
export const GAITS = Object.freeze({
  walk: Object.freeze({ policy: 'walk', vx: [-.2, .25], vy: [0, 0], wz: [-1, 1] }),
  run: Object.freeze({ policy: 'runStraight', vx: [0, .75], vy: [-.1, .1], wz: [-.2, .2] }),
});
export const SKILLS = Object.freeze(['sit', 'stand', 'roulade', 'recover_to_stand']);

export function backwardDisplacementFromContact(contactPose, currentPose) {
  const forwardDelta = (currentPose.x - contactPose.x) * Math.cos(contactPose.yaw)
    + (currentPose.y - contactPose.y) * Math.sin(contactPose.yaw);
  return Math.max(0, -forwardDelta);
}

export function exactFields(value, keys, name = 'object') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name}: object required`);
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new Error(`${name}: unknown or missing fields`);
}

export function secondsToTicks(seconds, max = 8) {
  if (!Number.isFinite(seconds) || seconds < .2 || seconds > max || Math.abs(seconds / CONTROL_DT_S - Math.round(seconds / CONTROL_DT_S)) > 1e-7) throw new Error(`duration must be 0.2..${max}s in 0.02s increments`);
  return Math.round(seconds / CONTROL_DT_S);
}

export function validateRaceAction(action, observation, actualPose) {
  if (action?.kind === 'program') {
    exactFields(action, ['kind', 'segments'], 'program');
    if (!Array.isArray(action.segments) || action.segments.length < 2 || action.segments.length > 8) throw new Error('program requires 2..8 drive/hold segments');
    const segments = action.segments.map((segment) => {
      if (!['drive', 'hold'].includes(segment?.kind)) throw new Error('program supports drive and hold only');
      return validateRaceAction(segment, observation, actualPose);
    });
    const ticks = segments.reduce((total, segment) => total + segment.ticks, 0);
    if (ticks > 600) throw new Error('program total duration must be <=12s');
    return { kind: 'program', segments, ticks };
  }
  if (action?.kind === 'drive') {
    exactFields(action, ['kind', 'gait', 'vx', 'vy', 'wz', 'duration_s'], 'drive');
    const gait = GAITS[action.gait];
    if (!gait) throw new Error('UNSUPPORTED_GAIT');
    for (const axis of ['vx', 'vy', 'wz']) {
      if (!Number.isFinite(action[axis]) || action[axis] < gait[axis][0] || action[axis] > gait[axis][1]) throw new Error(`${axis} outside ${action.gait} range ${gait[axis].join('..')}`);
    }
    return { ...action, ticks: secondsToTicks(action.duration_s), command: [action.vx, action.vy, action.wz] };
  }
  if (action?.kind === 'hold') {
    exactFields(action, ['kind', 'duration_s'], 'hold');
    return { ...action, ticks: secondsToTicks(action.duration_s), command: [0, 0, 0] };
  }
  if (action?.kind === 'skill') {
    exactFields(action, ['kind', 'name', 'timeout_s'], 'skill');
    if (!SKILLS.includes(action.name)) throw new Error('UNSUPPORTED_SKILL');
    return { ...action, ticks: secondsToTicks(action.timeout_s, 12) };
  }
  throw new Error('UNSUPPORTED_ACTION_KIND');
}

export function programCommand(spec, elapsedTicks) {
  if (spec?.kind !== 'program' || !Number.isInteger(elapsedTicks) || elapsedTicks < 0) throw new Error('INVALID_PROGRAM_TICK');
  let start = 0;
  for (const [index, segment] of spec.segments.entries()) {
    if (elapsedTicks < start + segment.ticks) return { index, command: segment.command, gait: segment.kind === 'drive' ? segment.gait : null };
    start += segment.ticks;
  }
  return null;
}

export function raceClock({ startedAt, now, simTicks, limitSeconds = RACE_SECONDS, wallLimitSeconds = limitSeconds }) {
  const wallSeconds = startedAt == null ? 0 : Math.max(0, (now - startedAt) / 1000);
  const simSeconds = simTicks * CONTROL_DT_S;
  return { wallSeconds, simSeconds, timeLimitSeconds: wallLimitSeconds, simulationLimitSeconds: limitSeconds, remainingSeconds: Math.max(0, wallLimitSeconds - wallSeconds), remainingSimulationSeconds: Math.max(0, limitSeconds - simSeconds), realTimeFactor: wallSeconds > 0 ? simSeconds / wallSeconds : 0, expired: startedAt != null && (wallSeconds >= wallLimitSeconds || simSeconds >= limitSeconds) };
}

export function shouldPauseRace(clockMode, entrants) {
  return clockMode === 'decision-paused' && entrants.some((entrant) => entrant.raceStatus === 'running')
    && entrants.every((entrant) => entrant.raceStatus !== 'running' || (!entrant.active && !entrant.recovery && !entrant.fallenTicks));
}

export function capabilities({ clockMode = 'realtime', wallLimitSeconds = RACE_SECONDS, simulationLimitSeconds = RACE_SECONDS } = {}) {
  return {
    contract: 'microduck.native-contact.v1', body: 'Microduck biped; NOT a drone', control_dt_s: CONTROL_DT_S,
    clock_mode: clockMode, time_limit_wall_s: wallLimitSeconds, time_limit_sim_s: simulationLimitSeconds, obstacle_speed_scale: OBSTACLE_SPEED_SCALE, gait_commands_are_not_guaranteed_body_velocities: true,
    automatic_recovery: { takeover_after_s: .2, cycle_budget_s: RECOVERY_TIMEOUT_SECONDS, max_attempts_per_cycle: 3, on_timeout: 'automatic_roll_escape_then_stand_new_cycle', stagnation_window_s: 4, on_stall: 'automatic_roll_escape_then_stand', roll_escape_durations_s: [2, 4], controller_history_reset_on_transition: true, manual_request_starts_fresh_cycle: true, manual_escape_skills: ['recover_to_stand', 'roulade'], no_manual_input_required: true, never_retires_for_recovery: true, pose_reset: false, guarantee: 'Automatic physical attempts continue; trapped contacts or policy limits may still prevent standing. Race boundaries and deadlines remain enforced.' },
    gait_limits: GAITS, skills: SKILLS, skill_qualification: 'experimental; failures and stalls are valid development outcomes',
    actions: ['drive', 'hold', 'skill', 'program'],
    drive: { coordinate_frame: 'body', duration_s: [.2, 8], sample: { kind: 'drive', gait: 'walk', vx: .25, vy: 0, wz: 0, duration_s: 2 }, walk_forward_calibration: 'Positive walk vx below 0.25 usually produces negligible forward translation on this policy. When forward displacement is intended, use vx=0.25. Stationary turning with vx=0 and nonzero wz is unreliable: actual yaw may change very little. Where the visible route is clear, consider a short walking arc with vx=0.25 and nonzero wz; then compare last_motion_feedback.yaw_change_rad with the intended turn. Contacts and boundaries can still prevent the commanded motion.' },
    skill: { timeout_s: [.2, 12], non_interruptible: true, recovery_request_timeout: 'receipt_only_SKILL_TIMEOUT; bounded physical episode continues independently', recovery_timing: 'recovery_request_remaining_s is the active recover_to_stand receipt deadline (0 when absent/expired); recovery_budget_remaining_s is the remaining 24s automatic cycle budget; exhaustion schedules another physical roll/stand cycle, never a permanent hold; recovery_timeout_remaining_s is a compatibility alias for the policy budget, not the request deadline', sample: { kind: 'skill', name: 'roulade', timeout_s: 6 } },
    program: { segments: [2, 8], total_duration_s_max: 12, segment_kinds: ['drive', 'hold'], sample: { kind: 'program', segments: [{ kind: 'drive', gait: 'walk', vx: .25, vy: 0, wz: .4, duration_s: 1 }, { kind: 'drive', gait: 'run', vx: .5, vy: 0, wz: 0, duration_s: 3 }] }, caution: 'Open-loop: no new observation between segments. Each segment obeys the same gait limits as a standalone drive; collision, fall and boundary checks continue every tick.' },
    observation: `FPV + ideal launch-relative simulated odometry + own posture + recent_contacts (up to 5 contact-begin events from the last 3 simulation seconds, with contact type, obstacle/other agent, age and penetration estimate; contact with reciprocal_low_gate also reports backward_displacement_m and factual physical_feedback from the contact pose). This feedback reports physical state only and does not recommend an action. Public referee feedback reports only on_track, the ${OUT_OF_BOUNDS_GRACE_SECONDS}s outside grace remaining, and ordered checkpoint count, not boundary distance, target bearing, map or opponents; opponents only through RGB`,
    act_request: '{request_id,reference_frame_id,action}; unique request_id per intent; repeat identical request is idempotent',
    waiting: clockMode === 'decision-paused'
      ? 'World freezes only while every running entrant has no active action or recovery. It advances if any entrant acts, even while you think. Wall time still counts. Action expiry holds zero command; no route planner, teleport or automatic navigation.'
      : 'World continues while you think. Action expiry holds zero command; no route planner, teleport or automatic navigation. Call md_observe again after execution.',
    unavailable: ['jump', 'crouch_walk', 'flight', 'roller_switch', 'kick_opponent', 'reset', 'privileged_world_map'],
  };
}

// Invalid infrastructure runs retain diagnostic entrants but never yield rankings.
export function evaluationValidity({ report, failure = null, preflight = false } = {}) {
  const reason = !report || report.status !== 'finished' ? 'MISSING_FINAL_REPORT'
    : failure || (/PLATFORM_INVALID|INFRASTRUCTURE|DISCONNECT|BROWSER_HIDDEN|REALTIME_FACTOR/.test(report.finishReason ?? '') ? report.finishReason : null)
      || (report.events?.some((event) => event.type === 'infrastructure_error') ? 'PLATFORM_INVALID' : null)
      || (preflight ? 'PREFLIGHT_NOT_EVALUATION' : null);
  return { valid_for_ranking: !reason, validity_status: reason ? 'invalid' : 'valid', invalid_reason: reason };
}

export function rankEntrants(entrants) {
  return entrants.filter((entrant) => entrant.valid_for_ranking !== false).sort((left, right) => {
    if (left.finishTime != null || right.finishTime != null) return (left.finishTime ?? Infinity) - (right.finishTime ?? Infinity);
    return (right.checkpointIndex ?? 0) - (left.checkpointIndex ?? 0) || (right.progress ?? 0) - (left.progress ?? 0) || left.id.localeCompare(right.id);
  });
}
