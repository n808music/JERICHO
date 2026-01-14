# Probability Authority Map

## Inputs
- `state.executionEvents` (active cycle only)
- `state.goalExecutionContract` (active cycle)
- `state.cyclesById[activeCycleId]` (goal/deadline)
- `state.constraints` (workable day policy, max/day/week, forbidden windows)
- `state.planDraft` / `state.planProof` (feasibility + structural margin)

## Core Functions
- `src/state/engine/feasibility.ts` → feasibility gate (INFEASIBLE / FEASIBLE)
- `src/state/engine/probabilityScore.ts` → probability scoring
- `src/state/contracts/probabilityEligibility.ts` → eligibility gating

## Outputs
- `state.probabilityByGoal[goalId]`
- `state.probabilityStatusByGoal[goalId]`
- UI: `src/components/ZionDashboard.jsx` Probability of Success card

## Dead UI paths
- Generate Plan currently dispatches `GENERATE_PLAN` and updates suggestions; no Apply action exists (Apply path to be added).

## Notes
- Evidence is currently completed execution events only (no planning churn).
- Feasibility gate runs in probability scorer; eligible/non-eligible computed separately.
