# Phase F Follow-Up Audit: Execution Contract

Purpose: verify the canonical execution contract after plan success and apply
the smallest truthful corrections needed to keep the schedule pipeline
authoritative, visible, and semantically clear.

## A. Horizon Apply

Relevant paths:

- `src/state/identityCompute.js::generatePlan`
- `src/state/identityCompute.js::applyDraftSchedule`
- `src/state/identityCompute.js::activateSchedule`
- `src/state/identityCompute.js::getAllBlocks`
- `src/components/ZionDashboard.jsx`
- `src/state/storeLLMActions.ts::createGeneratePlanWithLLM`
- `src/state/mockLLMActionGraph.ts::callClaudeForActionGraph`
- `src/state/mockLLMActionGraph.ts::callClaudeForSessionPlan`

Findings:

- `generatePlan` computes the full scheduling horizon from the canonical
  contract end date and action sequence, not from the visible month slice.
- `applyDraftSchedule` commits the full proposed set into
  `cycle.scheduleReviewBlocks` and `state.scheduleReviewBlocks`; it does not
  perform a second month-by-month scheduling pass.
- `activateSchedule` promotes the applied review set into canonical execution
  events and `blockStore`.
- `ZionDashboard` now resolves schedule visibility from `blockStore` +
  `executionEvents` canonical materialization, so month/week/day views read the
  same committed horizon as slices.

Classification: `WORKING AS INTENDED`

Earlier symptom:

- The “second apply in April” behavior was a visibility mismatch between
  canonical committed blocks and the rendered slice, not a second authoritative
  apply pass.
- The stale-active empty-state branch now recovers by regenerating instead of
  dead-ending.
- The dev-mode “Generate schedule is not responding” observation was amplified
  by mock LLM latency plus the stale-active empty visible store. Reducing the
  mock sleeps let the canonical generate path materialize inside the UI/window.

## B. Score Semantics

Relevant paths:

- `src/state/identityCompute.js::deriveCanonicalFeasibilityScore`
- `src/state/identityCompute.js::computeCyclePOS` in
  `src/domain/scoring/cycleScoring.ts`
- `src/state/identityCompute.js::computeCycleIntegrityScore` in
  `src/domain/scoring/cycleScoring.ts`
- `src/state/identityCompute.js::applyCycleScoring`
- `src/components/ZionDashboard.jsx`

Findings:

- Feasibility is the initial contract forecast derived from throughput/capacity
  inputs and canonical work items.
- Live P.O.S. is computed from feasibility + execution evidence; it updates from
  `computeCyclePOS` / `applyCycleScoring` rather than from feasibility alone.
- Stability / integrity is the execution-discipline metric and is computed
  separately from both feasibility and P.O.S.
- The Stability view no longer reuses feasibility as the P.O.S. headline when
  live P.O.S. is absent.
- The UI now says feasibility is the initial contract forecast and live P.O.S.
  is withheld until execution evidence exists.

Classification: `WORKING AS INTENDED`

Correction applied in this pass:

- Removed the fallback that displayed feasibility as if it were the live P.O.S.
  headline.
- Added explicit copy so the user sees the forecast/live distinction.
- Kept live P.O.S. withheld unless execution evidence actually exists.

## C. Required-Block Transitions

Relevant paths:

- `src/state/identityCompute.js::deleteBlock`
- `src/state/identityCompute.js::rescheduleBlock`
- `src/state/identityCompute.js::updateBlock`
- `src/state/identityCompute.js::applyDraftSchedule`
- `src/state/identityCompute.js::activateSchedule`
- `src/components/zion/BlockDetailsPanel.jsx`

Findings:

- Active required system blocks cannot be casually deleted. `deleteBlock`
  returns `REQUIRED_BLOCK_DELETE_DISALLOWED` for active required schedule
  blocks.
- Reschedule is allowed through `rescheduleBlock`.
- Bounded edits are allowed through `updateBlock` when identity/intent is
  preserved.
- Completion is allowed through the reducer path, but the old UI surface gate
  only exposed `Complete` on the today surface.
- The Mar 31 deadlock was a UI/STATE mismatch, not a reducer prohibition.

Classification: `WORKING AS INTENDED`

Correction applied in this pass:

- The `Complete` action is now visible for a selected block on any surface,
  while read-only and locked/block-protection rules remain intact.

## D. Out-of-Order Completion

Relevant paths:

- `src/state/identityCompute.js::COMPLETE_BLOCK` reducer branch
- `src/state/identityCompute.js::applyCycleDynamics`
- `src/state/identityCompute.js::enforceCycleDynamicsTransitions`
- `src/state/engine/cycleDynamics.ts`
- `tests/state/cycleDynamics.enforcement.test.js`

Findings:

- The system does not deadlock when a later block is completed before an earlier
  block.
- `COMPLETE_BLOCK` writes a completion event, and the cycle-dynamics pass
  remains responsible for surfacing any overdue predecessor recovery
  recommendations.
- Later completion preserves truth; earlier blocks remain open/planned or become
  missed/recovery-recommended based on time state.
- There is not yet a separate predecessor-state marker beyond the cycle-dynamics
  recommendation stream.

Classification: `PARTIALLY WIRED`

Interpretation:

- The behavior is deterministic and truth-preserving.
- The explicit predecessor/recovery narrative is surfaced through cycle dynamics
  rather than through a dedicated predecessor UI state.

## E. Deliverable-to-Block Lineage

Relevant paths:

- `src/state/identityCompute.js::appendSuggestedApplyBlocks`
- `src/state/identityCompute.js::applyDraftSchedule`
- `src/state/identityCompute.js::activateSchedule`
- `src/state/identityCompute.js::buildExecutionEventFromBlock` in
  `src/state/engine/todayAuthority.ts`
- `src/components/zion/BlockDetailsPanel.jsx`
- `src/components/zion/PlanningPanel.jsx`
- `src/components/ZionDashboard.jsx`

Findings:

- Canonical blocks preserve `deliverableId`, `criterionId`, `actionId`,
  `identityKey`, and `canonicalTitle` through the scheduling pipeline.
- `BlockDetailsPanel` now renders linked deliverable and linked criterion when
  present.
- `PlanningPanel` and the day/detail surfaces expose the same lineage fields
  without changing the canonical title.
- Structure/Stability still summarize the plan and score; the lineage is now
  visible on execution-facing block surfaces, which is the smallest viable
  continuity fix.

Classification: `PARTIALLY WIRED`

Remaining gap:

- The canonical chain is preserved and visible on selected execution surfaces,
  but not every summary surface traces goal → deliverable → criterion/action
  inline.

## Validation

Focused tests run in this pass:

- `npm run test -- tests/components/ZionDashboard.pos.afterAdmit.test.jsx tests/components/execution.actionFirstRendering.test.jsx tests/state/blockLifecycle.contract.test.js tests/components/ZionDashboard.applyDraftSchedule.test.jsx tests/components/generatePlan.calendarIntegration.test.jsx tests/state/blockStore.shadowWrite.parity.test.js`

Expected outcomes checked:

- full-horizon apply still commits canonically
- feasibility and live P.O.S. stay semantically distinct
- required active blocks cannot be casually deleted
- reschedule and bounded edit remain available
- later completion does not corrupt earlier blocks
- deliverable lineage is visible on execution surfaces
- stale-active empty schedules regenerate into visible proposals within the
  interaction window

## Minimal Corrections Applied

- Removed feasibility fallback from the live P.O.S. headline.
- Added explicit P.O.S. vs feasibility copy in Stability.
- Exposed deliverable lineage in block details.
- Exposed `Complete` on selected blocks across surfaces, while keeping
  lock/read-only protection.
- Reduced mock generation latency so accepted-goal scheduling remains visibly
  responsive in dev/test mode.
