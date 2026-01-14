# MVP 3.0 Authority Map

**Purpose**: Document the authoritative state mutations for goal admission, plan generation, execution, and cycle closure.

---

## Entry Points: Authoritative State Mutations

### 1. Goal Admission & Plan Generation

| Function | File | Scope | Mutates | Authority | Notes |
|----------|------|-------|---------|-----------|-------|
| `compileGoalEquation` | `identityCompute.js` | Cycle | `cycle.goalEquation`, `cycle.goalAdmission`, `state.goalAdmissionByGoal`, `state.aspirationsByCycleId` | AUTHORITATIVE | Admission gate. If `status !== 'ADMITTED'`, plan generation is blocked (PHASE 3 will enforce hard block). |
| `admitGoal` | `goalAdmission.ts` | Goal | Returns `AdmissionResult` (status, reasonCodes, planProof, coldPlan) | AUTHORITATIVE | Pure function. Checks feasibility, deliverables, schedulability. |
| `generatePlan` | `identityCompute.js` | Cycle | `cycle.autoAsanaPlan`, `state.suggestedBlocks`, `state.suggestionEvents` | AUTHORITATIVE | Gated by `goalAdmission.status === 'ADMITTED'`. Produces schedule + suggestions. |
| `applyGeneratedPlan` | `identityCompute.js` | Cycle | Executes `createBlock` via materialize for each autoAsanaPlan block | AUTHORITATIVE | Gated by `goalAdmission` and plan feasibility. Commits suggested blocks as execution events. |

### 2. Manual Block Creation

| Function | File | Scope | Mutates | Authority | Notes |
|----------|------|-------|---------|-----------|-------|
| `createBlock` | `identityCompute.js` | Day | `state.executionEvents`, `state.today.blocks`, `state.cycle.blocks` | AUTHORITATIVE (for execution event emission) | **VIOLATION (PHASE 3)**: No check for cold plan or linkage. Manual blocks with no admission/plan still emit execution events that count toward progress. |
| `buildExecutionEventFromBlock` | `todayAuthority.ts` | Event | Returns immutable event | AUTHORITATIVE | Pure builder. Includes `deliverableId`, `criterionId`, `goalId` (if linked). |

### 3. Suggested Block Acceptance

| Function | File | Scope | Mutates | Authority | Notes |
|----------|------|-------|---------|-----------|-------|
| `acceptSuggestedBlock` | `identityCompute.js` | Cycle | `state.suggestedBlocks[id].status`, calls `createBlock` | AUTHORITATIVE | **VIOLATION (PHASE 3)**: No check for deliverable/criterion linkage or cold-plan-first. Unlinked suggestions can be accepted. |

### 4. Execution & Completion

| Function | File | Scope | Mutates | Authority | Notes |
|----------|------|-------|---------|-----------|-------|
| `completeBlock` | `identityCompute.js` | Day | `state.executionEvents` (emit 'complete' event) | AUTHORITATIVE | Emits event. Linked or unlinked completions both emit events. |
| `rescheduleBlock` | `identityCompute.js` | Day | `state.executionEvents` (emit 'reschedule' event) | AUTHORITATIVE | Emits event. No gate on linkage. |
| `deleteBlock` | `identityCompute.js` | Day | `state.executionEvents` (emit 'delete' event) | AUTHORITATIVE | Emits event. Removes from progress. |
| `materializeBlocksFromEvents` | `todayAuthority.ts` | Materialization | Returns materialized blocks array | REFLECTIVE | Pure. Replays all events to current state. Used for display. |

### 5. Cycle Closure & Convergence

| Function | File | Scope | Mutates | Authority | Notes |
|----------|------|-------|---------|-----------|-------|
| `endCycle` | `identityCompute.js` | Cycle | `cycle.status = 'ended'`, `cycle.summary = summarizeCycle(cycle)` | AUTHORITATIVE | **MISSING (PHASE 4)**: No call to `computeTerminalConvergence`. Does not store convergence verdict. |
| `summarizeCycle` | `cycleSummary.ts` | Cycle | Returns `{ completionCount, completionRate }` | REFLECTIVE | Counts all events with `kind === 'complete'`. **VIOLATION**: Does not filter by linkage. |

### 6. Learning Update

| Function | File | Scope | Mutates | Authority | Notes |
|----------|------|-------|---------|-----------|-------|
| `computeProfileLearning` | `learning.ts` | Profile | Returns `ProfileLearning` | REFLECTIVE | Only processes `cycle.status === 'ended'`. **MISSING (PHASE 5)**: Does not check for convergence verdict. |

---

## Known Violations Summary

### Violation A: Cold Plan Not a Hard Prerequisite
- `createBlock` has no gate for `goalAdmission.status === 'ADMITTED'` or cold plan existence.
- Manual blocks can be created and counted without any goal linkage.
- **Impact**: Unlinked execution activity inflates completion metrics.
- **Fix (PHASE 3)**: Add linkage status metadata; mark unlinked blocks; exclude from progress/convergence.

### Violation B: Terminal Convergence Logic Missing
- `endCycle` does not call `computeTerminalConvergence`.
- No P_end vs E_end comparison.
- No convergence verdict (CONVERGED/INCOMPLETE/FAILED).
- `summarizeCycle` returns raw counts, not verdict.
- **Impact**: No definitive proof of success or failure at cycle end.
- **Fix (PHASE 2, 4)**: Implement `computeTerminalConvergence`, call at `endCycle`, store in `cycleSummary`.

### Violation C: Accepted Suggestions Don't Require Linkage
- `acceptSuggestedBlock` has no check for deliverable/criterion linkage.
- Unlinked suggestions can be materialized as committed blocks.
- **Impact**: Schedule acceptance doesn't enforce criterion coverage.
- **Fix (PHASE 3)**: Tag unlinked suggestions; exclude from convergence.

### Violation D: Learning Ignores Convergence Verdict
- `computeProfileLearning` only checks `cycle.status === 'ended'`.
- No requirement for `convergenceReport.verdict` to be present.
- Bad cycles (INCOMPLETE/FAILED) still contribute to profile learning.
- **Impact**: Learning polluted by failed attempts.
- **Fix (PHASE 5)**: Add gate for `cycle.convergenceReport?.verdict === 'CONVERGED'`.

---

## MVP 3.0 Required Additions

### New Types (PHASE 1)

```typescript
// Convergence computation result
ConvergenceVerdict = 'CONVERGED' | 'INCOMPLETE' | 'FAILED'

ConvergenceReport {
  verdict: ConvergenceVerdict
  reasons: string[]        // proof-grade deficits
  P_end: TerminalState     // planned requirements
  E_end: TerminalState     // executed/linked results
  tolerance: number        // default 0 (strict)
  computedAtISO: string
}

// On cycle
cycle.convergenceReport?: ConvergenceReport
```

### New Functions (PHASE 2)

```typescript
computeTerminalConvergence({
  cycle,
  planProof,
  events,
  nowISO,
  timezone
}): ConvergenceReport
```

### New Enforcement (PHASE 3)

- Add `linkageStatus` field to execution events: 'LINKED' | 'UNLINKED_ACTIVITY'
- Progress selectors: ignore UNLINKED_ACTIVITY
- Convergence E_end: ignore UNLINKED_ACTIVITY

### Integration Points (PHASE 4-5)

1. `endCycle`: call `computeTerminalConvergence`, store in `cycle.convergenceReport`
2. `computeProfileLearning`: filter by `cycle.convergenceReport?.verdict === 'CONVERGED'`

---

## Determinism Notes

- All computations must use frozen `nowISO` (not `Date.now()`).
- Event replay via `materializeBlocksFromEvents` is idempotent.
- `derivePlanProof` is deterministic given equation + constraints.
- Convergence computation must be pure: `(cycle, planProof, events, nowISO, timezone) → ConvergenceReport`.

