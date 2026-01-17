// Navigation policy helpers for initial tab selection.
// Deterministic, no side effects.

export function getInitialViewKey(activeCycle, fallback = 'today') {
  const outcome = activeCycle?.definiteGoal?.outcome?.trim();
  const deadline = activeCycle?.definiteGoal?.deadlineDayKey?.slice(0, 10);

  if (!outcome || !deadline) return 'lenses';
  return fallback || 'today';
}

