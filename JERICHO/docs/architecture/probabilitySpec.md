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
