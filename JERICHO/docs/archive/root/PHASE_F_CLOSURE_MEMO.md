# Phase F Closure Memo

## Scope

This pass was intentionally bounded to two truth-surface gaps:

1. out-of-order completion policy visibility
2. deliverable-to-block lineage universality

Verified core contract paths were not reopened:

- horizon-wide apply
- score semantics
- required-block transitions

## Verified Core Behaviors

These behaviors remain established and were not changed by this pass:

- `generatePlan -> applyDraftSchedule -> activateSchedule` remains the canonical
  horizon-wide flow.
- Feasibility remains the initial contract forecast.
- Live P.O.S. remains gated by execution evidence.
- Required blocks remain protected from casual deletion while still supporting
  valid complete/reschedule/edit transitions.

## Newly Closed Truth-Surface Gaps

### 1. Out-of-order completion policy visibility

The deterministic contract for completion was already present, but the
user-facing surfaces did not make predecessor / dependency state visible enough.

This pass closed that gap by rendering lineage meaning on the primary execution
surfaces:

- day block cards
- week blocks
- month summary cells
- block details
- planning details

The shared lineage helper now surfaces:

- `Serves: <deliverable>`
- `Why: <criterion>`
- dependency status when explicit dependency ids exist
- `Earlier open: <predecessor>` when a later block is inspected before an
  earlier open predecessor

This makes out-of-order completion truth-preserving and visible instead of only
inferable from cycle-dynamics behavior.

### 2. Deliverable-to-block lineage universality

The main execution and planning surfaces now render canonical block meaning
using the same shared lineage helper.

The user can now see, on the surfaced block itself:

- what deliverable it serves
- why it exists
- what open predecessor or dependency state it relates to

This restores continuity from goal -> deliverable -> block meaning across the
visible execution surfaces that matter for day-to-day operation.

## Implementation Summary

The pass was implemented with a shared helper and narrow render updates:

- `src/components/zion/blockMeaning.js`
- `src/components/zion/BlockColumn.jsx`
- `src/components/zion/views/ZionWeekView.jsx`
- `src/components/zion/views/ZionMonthView.jsx`
- `src/components/zion/DaySchedulePanel.jsx`
- `src/components/zion/BlockDetailsPanel.jsx`
- `src/components/zion/PlanningPanel.jsx`
- `src/components/ZionDashboard.jsx`

The helper computes:

- deliverable linkage
- criterion linkage
- explicit dependency state
- open predecessor state

The card surfaces now render enough of that meaning to keep the lineage visible
without changing the scheduling contract itself.

## Deferred Non-Blocking Items

This pass did not change:

- dependency-class policy
- completion authority
- schedule generation
- apply/activate semantics
- score semantics

Any deeper dependency semantics remain a separate concern only if future
evidence shows a missing policy class. No blocking gap remains in the current
bounded scope.

## Validation

Focused tests passed for the touched surfaces:

- block lineage visibility
- execution surface action-first rendering
- schedule apply/rebuild integration

The direct verification pass for the underlying core contract remains valid.

## Conclusion

Phase F is closed for the bounded truth-surface scope.

The remaining work is presentation completeness only, not a blocker to
deterministic behavioral execution.
