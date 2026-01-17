export function getActiveGoalOutcomes(cyclesById = {}) {
  const outcomes = [];
  if (!cyclesById || typeof cyclesById !== 'object') return outcomes;
  Object.values(cyclesById).forEach((cycle) => {
    if (!cycle || cycle.status !== 'active') return;
    const contract = cycle.goalContract || {};
    const outcomeText =
      (contract.terminalOutcome?.text || contract.goalText || contract.goalLabel || '').toString().trim();
    if (outcomeText) {
      outcomes.push(outcomeText);
    }
  });
  return outcomes;
}
