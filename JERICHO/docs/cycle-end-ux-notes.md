# Cycle End UX Notes

## Selectors / Signals
- `activeCycleId`, `cyclesById`, `goalExecutionContract` (source: `useIdentityStore` / `ZionDashboard`) drive the UI banner, summary, and read-only flags.
- `projectCyclesIndex` provides a canonical list of cycles (Active first, then Ended) and supplies `goalTitle`, calendar range, and derived completion stats used in the feature banner.
- `cycle.summary` (populated by `summarizeCycle` in `identityCompute`) and `profileLearning` describe completion counts + learning provenance for ended cycles.
- `appTime.activeDayKey` + `today.date` continue to anchor the displayed calendar even when cycles are read-only.

## Components & Behavior
| Component | Role | Read-only gating |
| --- | --- | --- |
| `ZionDashboard` | Main shell; now renders the top banner, summary panel, and propagates `isReadOnlyCycle` down to the Today planner + planning controls. | `isReadOnlyCycle = cycleMode !== 'active'` disables add/edit buttons and shows the banner/panel when a cycle is ended/reviewing.
| `PlanningPanel` / `AddBlockBar` | Day planning canvas; respect `readOnly` prop to disable the Add Block controls and block details actions. | receives `readOnly={isReadOnlyCycle}`.
| `Workspace` | Structure lens for goal editing; now accepts `isReadOnly` (prop) and only enables strategy controls in active mode. | `readOnly` prop overlays existing `isReviewMode` logic.
| `StructurePageConsolidated` | Archive/hard-delete anchor for goals; unaffected but shields mutating controls by gating in the component itself.

## Action Types Triggered
- `startNewCycle` → kicks off the existing `START_NEW_CYCLE` reducer path. Always visible in the read-only banner to encourage progression.
- `setActiveCycle` → invoked via “Back to active cycle” when an Active cycle exists alongside the reviewed one.
- Existing mutation handlers (`createBlock`, `updateBlock`, `deleteBlock`, `rescheduleBlock`, `acceptSuggestedBlock`, etc.) are short-circuited when `isReadOnlyCycle` is true, preventing dispatch while still showing the controls (disabled state + tooltip text).

## UX Notes
- Banner message: `Review Mode — Read only` (for `cycleMode === 'review'`) or `Cycle ended — Read only` (when no active cycle remains) with goal text and start/end labels.
- Summary panel: surfaces completion rate/count, endedAt (when available), and learning updates count (`profileLearning.cycleCount`) so users understand historical performance.
- Controls remain visible but disabled (with `disabled` and helper text) so experience feels consistent between active and archived cycles.
