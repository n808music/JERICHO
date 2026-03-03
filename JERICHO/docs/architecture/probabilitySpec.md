# Probability Contract Spec (v1)

## Unit of prediction
Per goal.

## Horizon
Next 7 days (rolling window).

## Output shape
- value: number in [0,1] or null
- status: disabled | insufficient_evidence | computed
- reasons: reason codes (governance contract)
- evidenceSummary: counts only (eventCount, windowDays)

## Hard invariants
- Deterministic given the same input state + nowISO.
- Never computed when governance denies.
- Never computed when evidence threshold is unmet.
- Never computed for inactive contracts.
- Contract resolution is the single source of truth.

## Jericho 1.0 POS Explanation Rules
Scope:
- cycle-specific, cycle-to-date, no LLM/coaching interpretation

Fixed allowlist:
- `POS_NO_PLAN`
- `POS_UNSCHEDULABLE`
- `POS_DOWN_MISSED_WORK`
- `POS_DOWN_LATE_COMPLETION`
- `POS_UP_ON_TIME_COMPLETION`
- `POS_UP_EARLY_RESCHEDULE`
- `POS_DOWN_LATE_RESCHEDULE`
- `POS_NEUTRAL_CANCELLATION`
- `POS_DOWN_FEASIBILITY_DECREASE`
- `POS_UP_FEASIBILITY_INCREASE`

Dominance rules:
- if feasibility missing => `POS_NO_PLAN` only
- if feasibility `0` + unschedulable conflict => `POS_UNSCHEDULABLE` only

Top-factor rule:
- deterministic sort by magnitude desc, tie-break by code, keep top 3
