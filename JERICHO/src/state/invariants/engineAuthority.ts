export function assertEngineAuthority(state: any) {
  if (!state) {
    throw new Error('Engine authority invariant failed: missing state.');
  }
  if (!('goalDirective' in state)) {
    throw new Error('Engine authority invariant failed: missing goalDirective.');
  }
  if (!state.directiveEligibilityByGoal || typeof state.directiveEligibilityByGoal !== 'object') {
    throw new Error('Engine authority invariant failed: missing directiveEligibilityByGoal.');
  }
  if (state.goalDirective && state.goalDirective.goalId) {
    const goalId = state.goalDirective.goalId;
    if (!state.directiveEligibilityByGoal[goalId]) {
      throw new Error(`Engine authority invariant failed: missing directiveEligibilityByGoal for goalId "${goalId}".`);
    }
  }
}
