// Wall milestones are observed states, not interpolated checkpoint crossings.
export const WALL_MILESTONES_SECONDS = Object.freeze([600, 1200, 1800, 3600]);

export function progressState(snapshot) {
  return {
    wall_seconds: snapshot.wallSeconds, sim_seconds: snapshot.simSeconds,
    entrants: snapshot.entrants.map((row) => ({
      id: row.id, checkpoint_index: row.checkpointIndex, progress: row.progress,
      status: row.status, recovery_seconds: row.recovery_total_s ?? null,
      effective_action_seconds: row.effective_action_s ?? null,
    })),
  };
}

export function captureWallMilestones(milestones, snapshot) {
  for (const target of WALL_MILESTONES_SECONDS) {
    if (snapshot.wallSeconds < target || milestones.some((row) => row.target_wall_seconds === target)) continue;
    milestones.push({ target_wall_seconds: target, ...progressState(snapshot), observation_delay_seconds: snapshot.wallSeconds - target });
  }
}

export function entrantProgressMetrics(report, id) {
  const passes = (report?.events ?? []).filter((event) => event.type === 'checkpoint_passed' && event.agent_id === id).map((event) => ({
    checkpoint_index: event.checkpoint_index, tick: event.tick,
    wall_seconds: event.wall_time_s ?? null, sim_seconds: event.sim_time_s ?? null,
  }));
  const states = report?.progress_metrics;
  const milestones = WALL_MILESTONES_SECONDS.map((target) => {
    const state = states?.wall_milestones?.find((row) => row.target_wall_seconds === target);
    const entrant = state?.entrants?.find((row) => row.id === id);
    return { target_wall_seconds: target, available: !!entrant,
      unavailable_reason: entrant ? null : states ? 'WALL_MILESTONE_NOT_REACHED' : 'NOT_RECORDED',
      wall_seconds: state?.wall_seconds ?? null, sim_seconds: state?.sim_seconds ?? null,
      observation_delay_seconds: state?.observation_delay_seconds ?? null,
      checkpoint_index: entrant?.checkpoint_index ?? null, progress: entrant?.progress ?? null,
      status: entrant?.status ?? null };
  });
  function interval(start, end) {
    const left = start?.entrants?.find((row) => row.id === id);
    const right = end?.entrants?.find((row) => row.id === id);
    if (!left || !right || !(end.wall_seconds > start.wall_seconds)) return null;
    const wall = end.wall_seconds - start.wall_seconds;
    const progress = right.progress - left.progress;
    return {
      start_wall_seconds: start.wall_seconds, end_wall_seconds: end.wall_seconds,
      wall_seconds: wall, sim_seconds: end.sim_seconds - start.sim_seconds,
      checkpoint_delta: right.checkpoint_index - left.checkpoint_index,
      progress_delta: progress, progress_per_wall_minute: progress * 60 / wall,
      recovery_seconds: left.recovery_seconds == null || right.recovery_seconds == null ? null : right.recovery_seconds - left.recovery_seconds,
      effective_action_seconds: left.effective_action_seconds == null || right.effective_action_seconds == null ? null : right.effective_action_seconds - left.effective_action_seconds,
    };
  }
  const midpoint = states?.wall_milestones?.find((row) => row.target_wall_seconds === 1800);
  const first = interval(states?.baseline, midpoint);
  const latter = interval(midpoint, states?.final);
  return {
    checkpoint_pass_times: passes,
    checkpoint_timing_available: states?.baseline != null || passes.length > 0,
    checkpoint_timing_note: 'Only referee checkpoint_passed events are pass times; skipped starting checkpoints and historical sampled index changes are not passes.',
    wall_milestones: milestones,
    latter_half: {
      definition: 'First 30 wall minutes versus minute 30 to actual end (maximum 60 wall minutes); rates use observed durations, including decision pauses.',
      available: !!first && !!latter, first_30_minutes: first, after_30_minutes: latter,
      continued_progress: latter ? latter.checkpoint_delta > 0 || latter.progress_delta > 0 : null,
      progress_rate_ratio: first?.progress_per_wall_minute > 0 && latter ? latter.progress_per_wall_minute / first.progress_per_wall_minute : null,
    },
  };
}
