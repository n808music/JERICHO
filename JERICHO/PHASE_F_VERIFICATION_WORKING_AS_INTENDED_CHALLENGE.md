# Phase F Verification: Working As Intended Challenge

This pass verifies the prior audit’s `WORKING AS INTENDED` claims against code
path, targeted tests, and user-surface behavior. No broad rebuild was done.

## 1. Horizon Apply

Verdict: `PROVEN WORKING AS INTENDED`

### Code path

- `src/state/identityCompute.js::generatePlan`
- `src/state/identityCompute.js::applyDraftSchedule`
- `src/state/identityCompute.js::activateSchedule`
- `src/state/identityCompute.js::getAllBlocks`
- `src/components/ZionDashboard.jsx`
- `src/state/structureSchedulingSemantics.js`
- `src/components/zion/StructurePageConsolidated.jsx`

### What the code does

- `generatePlan` computes horizon blocks from the canonical contract horizon,
  not from the visible month slice.
- `applyDraftSchedule` commits the full canonical proposal set into
  `cycle.scheduleReviewBlocks` and `state.scheduleReviewBlocks`.
- `activateSchedule` promotes the applied review set into canonical execution
  events and `blockStore`.
- `ZionDashboard` resolves visibility from `today`, `currentWeek`, `cycle`, and
  `blockStore`, then falls back to canonical execution materialization when
  needed.
- `structureSchedulingSemantics` derives schedule status from canonical
  proposal/review/commit sources rather than month-local view state.

### Proof

- `tests/state/applyDraftSchedule.canonicalSource.test.js`
  - canonical `proposedBlocks` become review blocks
  - activation writes canonical create events
  - the review and committed views rematerialize correctly
- `tests/state/workWindows.acceptedChain.canonical.test.js`
  - one generate pass produces a full canonical proposal set from the admitted
    contract horizon
  - `GENERATE_PLAN` uses canonical windows and does not require month-by-month
    re-application
  - June anchoring rebuilds forward proposals rather than replaying March
- `tests/components/generatePlan.calendarIntegration.test.jsx`
  - one generate + one apply + one activate chain makes April, May, and June
    visible as the same canonical schedule horizon
  - no second apply is required for later-month visibility

### User-surface truth

- The earlier “apply in March, then again in April” impression was a visibility
  mismatch between canonical committed blocks and the rendered slice.
- The current visible path is canonical: one plan, one apply, one activate, many
  month slices.
- The hidden dependence on the current month slice is no longer the operational
  source of truth.

## 2. Score Semantics

Verdict: `PROVEN WORKING AS INTENDED`

### Code path

- `src/state/identityCompute.js::applyCycleScoring`
- `src/domain/scoring/cycleScoring.ts::computeCyclePOS`
- `src/domain/scoring/cycleScoring.ts::computeCycleIntegrityScore`
- `src/state/engine/probabilityScore.ts::scoreGoalSuccessProbability`
- `src/state/engine/probabilityScore.ts::deriveTrustState`
- `src/components/ZionDashboard.jsx`

### What the code does

- Feasibility is the initial contract forecast derived from canonical capacity /
  throughput / work-item inputs.
- `computeCyclePOS` combines feasibility with execution evidence from
  materialized blocks.
- `computeCycleIntegrityScore` is separate from feasibility and measures
  execution-discipline outcomes from completed/planned block history.
- `scoreGoalSuccessProbability` keeps externally mediated goals provisional
  until qualifying external evidence exists, and trusted only after that
  evidence threshold is met.
- `ZionDashboard` states the distinction explicitly in the Stability card:
  - feasibility is the initial contract forecast
  - live P.O.S. updates only after execution evidence exists
  - live P.O.S. can be withheld when evidence is absent

### Truth table

| State                                                | Feasibility                                                                                                                  | Live P.O.S.                                                              | Stability / Integrity                                         | Why                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Admitted goal, no generated schedule                 | Show forecast / initial contract score                                                                                       | Withheld or provisional until evidence exists                            | Baseline integrity / execution-discipline baseline            | No execution evidence exists yet                                            |
| Generated / applied schedule, no completion evidence | Show forecast / initial contract score                                                                                       | Still withheld or provisional until completion evidence exists           | Integrity remains separate and does not pretend to be success | Blocks exist, but no completion evidence has been admitted                  |
| At least one valid block completion                  | Forecast remains initial contract forecast; may be revised by contract math, but not by pretending completion is feasibility | Live P.O.S. updates from execution evidence path                         | Integrity reflects the completion evidence                    | `COMPLETE_BLOCK` writes completion evidence into the canonical event stream |
| Out-of-order completion                              | Forecast remains initial contract forecast                                                                                   | Live P.O.S. still uses evidence truth, not the completion order illusion | Integrity / recovery remain separate                          | Later completion does not erase earlier predecessor truth                   |

### Proof

- `tests/state/pos.trustState.lifecycle.test.js`
  - withheld / provisional / trusted states are explicitly differentiated
  - no-evidence remains provisional, not magically trusted
  - 7 distinct evidence days are required for trusted on internally controlled
    goals
- `tests/state/pos.externalEvidence.trustGate.test.js`
  - externally mediated goals remain provisional without external evidence
  - qualifying external evidence unlocks trusted
  - non-qualifying preparation actions do not unlock trusted
- `tests/components/ZionDashboard.pos.afterAdmit.test.jsx`
  - the UI copy explicitly distinguishes feasibility from live P.O.S.
  - the dashboard shows the forecast/live split to the user

### User-surface truth

- The Stability view is explicit enough that a user should not reasonably
  confuse feasibility with live P.O.S.
- The UI no longer implies that feasibility is the live score.
- Live P.O.S. is honest about evidence gating rather than pretending to be
  always-on.

## 3. Required-Block Transitions

Verdict: `PROVEN WORKING AS INTENDED`

### Code path

- `src/state/identityCompute.js::deleteBlock`
- `src/state/identityCompute.js::rescheduleBlock`
- `src/state/identityCompute.js::updateBlock`
- `src/state/identityCompute.js::COMPLETE_BLOCK`
- `src/components/zion/BlockDetailsPanel.jsx`
- `src/components/zion/PlanningPanel.jsx`

### What the code does

- Required active schedule blocks cannot be casually deleted.
- `rescheduleBlock` is allowed and writes a canonical reschedule event.
- `updateBlock` is allowed as a bounded edit path for active required blocks,
  and it preserves deliverable / criterion lineage.
- `COMPLETE_BLOCK` is allowed and records completion evidence.
- `BlockDetailsPanel` exposes `Complete` on selected blocks across surfaces
  instead of only on Today.
- The previous Mar 31 deadlock was a UI/STATE mismatch, not a reducer
  prohibition.

### Lifecycle matrix

| Required block state                  | Complete                                                                                                 | Reschedule                                                | Bounded edit                                                   | Delete                                     | Why                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| Future scheduled                      | Allowed when logically valid                                                                             | Allowed                                                   | Allowed if identity / intent preserved                         | Governed by policy                         | The block exists canonically and can move or be edited within contract rules |
| Active / today                        | Allowed                                                                                                  | Allowed                                                   | Allowed if identity / intent preserved                         | Blocked if protected active required block | The block is live, not disposable                                            |
| Past due but incomplete               | Allowed if the completion is still logically valid; otherwise surfaced by recovery / missed-state policy | Allowed                                                   | Allowed if identity / intent preserved                         | Governed by policy                         | Recovery and reschedule remain the truthful paths                            |
| Completed                             | Already complete; no destructive mutation needed                                                         | Allowed only if policy permits a repair / correction flow | Allowed only if identity / intent preserved and policy permits | Governed by policy                         | Completion evidence should not be erased casually                            |
| Later dependent block completed first | Allowed for the later block; earlier block remains open / recovery-needed                                | Allowed                                                   | Allowed if identity / intent preserved                         | Governed by policy                         | Out-of-order completion does not deadlock earlier truth                      |

### Proof

- `tests/state/blockLifecycle.contract.test.js`
  - active required blocks cannot be casually deleted
  - reschedule is allowed
  - bounded edit preserves deliverable and criterion lineage
  - completion is recorded as execution evidence
  - later completion does not corrupt earlier predecessor state
- `tests/components/execution.actionFirstRendering.test.jsx`
  - `Complete` remains available on non-today surfaces for valid active blocks
  - deliverable linkage and criterion linkage are visible together
- `tests/components/ZionDashboard.applyDraftSchedule.test.jsx`
  - stale-active states can still recover into visible schedule truth

### User-surface truth

- The earlier “cannot complete/edit on Mar 31” case was a surface gate problem.
- The block details UI now exposes the valid action set instead of hiding it
  behind today-only semantics.
- Delete remains governed; complete/edit/reschedule are not deadlocked in the
  verified path.

## 4. Claim Regrading Summary

| Area                       | Prior Claim         | Verified Verdict           | Why                                                                                                                         |
| -------------------------- | ------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Horizon apply              | WORKING AS INTENDED | PROVEN WORKING AS INTENDED | Canonical horizon is generated once, applied once, and reflected across month slices without a second apply                 |
| Score semantics            | WORKING AS INTENDED | PROVEN WORKING AS INTENDED | Feasibility, live P.O.S., and Stability/Integrity are separately wired and explicitly surfaced                              |
| Required-block transitions | WORKING AS INTENDED | PROVEN WORKING AS INTENDED | Complete, reschedule, bounded edit, and governed delete now behave deterministically on the user surface and in the reducer |

## 5. Validation

Commands run in this verification pass:

- `npm run test -- tests/components/generatePlan.calendarIntegration.test.jsx tests/state/applyDraftSchedule.canonicalSource.test.js tests/state/workWindows.acceptedChain.canonical.test.js tests/state/pos.trustState.lifecycle.test.js tests/state/pos.externalEvidence.trustGate.test.js tests/components/ZionDashboard.pos.afterAdmit.test.jsx tests/state/blockLifecycle.contract.test.js tests/components/execution.actionFirstRendering.test.jsx --reporter=verbose`

Result:

- `8/8` test files passed
- `58/58` tests passed

## 6. Remaining Unproven Areas

- Out-of-order completion policy is deterministic and truth-preserving, but it
  remains a partially separate cycle-dynamics narrative outside this
  verification scope.
- Deliverable-to-block lineage is visible on execution surfaces, but not yet
  universal on every summary surface.
