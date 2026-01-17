export function selectTodayTasks(state) {
  if (!state?.tasks) return [];
  return state.tasks.filter((t) => t.due === 'today' && t.status !== 'completed');
}

export function selectTrajectory(state) {
  const history = state?.metrics?.cycleHistory || [];
  const last = history[history.length - 1] ?? 0;
  const projection = Array.from({ length: 3 }, (_, idx) => last + (idx + 1) * 4);
  return [...history, ...projection].slice(-7);
}

export function selectDriftTrend(state) {
  const drift = state?.metrics?.driftIndex ?? 0;
  if (drift > 50) return 'high';
  if (drift > 20) return 'moderate';
  return 'low';
}

export function selectRiskFlags(state) {
  return state?.metrics?.riskFlags || [];
}
