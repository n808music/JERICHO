export function normalizeStateForPipeline(raw = {}) {
  const state = { ...(raw || {}) };
  state.history = Array.isArray(state.history) ? state.history : [];
  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  state.integrity =
    state.integrity && typeof state.integrity === 'object'
      ? { ...state.integrity }
      : {
          score: 0,
          completedCount: 0,
          pendingCount: 0,
          missedCount: 0,
          breakdown: {
            completedOnTime: 0,
            completedLate: 0,
            missed: 0,
            totalTasks: 0,
            completionRate: 0,
            onTimeRate: 0
          }
        };
  const defaultBreakdown = {
    completedOnTime: 0,
    completedLate: 0,
    missed: 0,
    totalTasks: 0,
    completionRate: 0,
    onTimeRate: 0
  };
  if (
    !state.integrity.breakdown ||
    typeof state.integrity.breakdown !== 'object' ||
    Array.isArray(state.integrity.breakdown)
  ) {
    state.integrity.breakdown = { ...defaultBreakdown };
  } else {
    state.integrity.breakdown = { ...defaultBreakdown, ...state.integrity.breakdown };
  }
  return state;
}
