# Authority Maps

## UI Authority

Classifies every UI panel and control by write authority. A component must not write to store state above its authority level.

**Legend:**
- `AUTHORITATIVE` — writes to source-of-truth (state/events)
- `ADVISORY` — configures suggestions/behavior, does not write unless explicitly applied
- `REFLECTIVE` — read-only derived display; never writes

| ID | Label | Authority | Unit | Scope | Writes | Enforced By |
|---|---|---|---|---|---|---|
| goal.intake.family | Goal family selector | AUTHORITATIVE | goal.family | cycle | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan |
| goal.intake.target | Goal target value | AUTHORITATIVE | goal.target | cycle | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan |
| goal.intake.deadline | Goal deadline | AUTHORITATIVE | dayKey | cycle | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan |
| goal.intake.constraints | Goal constraints + non-negotiables | AUTHORITATIVE | constraint flags | cycle | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan |
| goal.intake.submit | Compile goal equation | AUTHORITATIVE | plan proof | cycle | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan |
| tabs.structure | Structure tab | AUTHORITATIVE | — | ui | ZionDashboard:setZionView | — |
| today.block.complete | Block complete button | AUTHORITATIVE | execution event | day | identityStore:appendExecutionEvent | executionContract:canEmitExecutionEvent |
| today.block.create | Add block (Today) | AUTHORITATIVE | execution event | day | identityStore:appendExecutionEvent | executionContract:canEmitExecutionEvent |
| today.block.reschedule | Reschedule block | AUTHORITATIVE | execution event | day | identityStore:appendExecutionEvent | executionContract:canEmitExecutionEvent |
| schedule.apply | Apply draft schedule | AUTHORITATIVE | committed blocks | cycle | identityStore:APPLY_DRAFT_SCHEDULE | — |
| deliverable.edit | Edit deliverable | AUTHORITATIVE | deliverable | cycle | identityStore:UPDATE_DELIVERABLE | — |
| pos.display | POS score panel | REFLECTIVE | score display | cycle | — | probabilityScore:derivePosDisplayPolicy |
| feasibility.display | Feasibility indicator | REFLECTIVE | feasibility | cycle | — | feasibility:computeFeasibility |
| plan.quality.gate | Plan quality gate indicator | REFLECTIVE | gate status | cycle | — | evaluatePlanQualityGate |
| suggestion.stream | Suggestion cards | ADVISORY | suggestions | day | identityStore:acceptSuggestion (if applied) | suggestionFilters |

The full canonical list is in `src/contracts/uiAuthorityMap.ts`. This table covers the primary write surfaces.

## Probability Authority

The POS score is the single authoritative probability signal per goal. It is computed deterministically in `src/state/engine/probabilityScore.ts` and must not be overridden by UI inputs.

**Unit of prediction:** per goal

**Horizon:** rolling 7-day window (`src/state/engine/probabilityWindow.ts`)

**Output shape:**
- `value`: number `[0, 1]` or `null`
- `status`: `'INFEASIBLE' | 'UNSCHEDULABLE' | 'ELIGIBLE' | 'INELIGIBLE' | 'NO_EVIDENCE'`
- `trustState`: `'withheld' | 'provisional' | 'trusted'` (see `docs/reference/pos-trust-state.md`)
- `reasons`: reason codes
- `evidenceSummary`: event counts only (never raw events)

**Hard invariants:**
- Deterministic given the same input state + `nowISO`
- `cycle.metrics.posScore` is the canonical field; `state.planPreview.feasibilityConfidence` is a legacy read-only adapter
- The score is computed by `applyCycleScoring` in `src/state/identityCompute.js`; never mutated by UI
- Evidence summary exposes counts only — raw execution events are never passed to display components
