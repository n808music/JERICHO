# PQ3_SQL_UI_TRUTH_SURFACE_FREEZE_PACKAGE.md

## Status

Closed.

Canonical verification is clean on the current tree.

### Final verification

- `npm run check-all`
- Result: pass
- `322` files passed
- `1330` tests passed

---

## Scope of this slice

This slice fixed the two remaining SQL-lane frontend truth-surface problems
without changing builder doctrine, evaluator logic, or admission rules:

1. Structure formal plan chart reconciliation with actual scheduled execution
   state
2. Month/calendar block title fidelity so object/method/output meaning survives
   on the rendered surface

This was a UI truth-presentation pass only.

---

## Root causes and fixes

### 1. Structure formal plan chart mismatch

#### Root cause

Structure view was reading only:

- `activeCycle.scheduleReviewBlocks`

while Today/Month already had a canonical fallback path from:

- `activeCycle.executionEvents`

This created a visible truth mismatch:

- Structure chart could show `0 scheduled blocks`
- Today/Month could simultaneously show many scheduled blocks for the same cycle

#### Fix

[StructurePageConsolidated.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/components/zion/StructurePageConsolidated.jsx)
now uses the same canonical schedule class as the execution surfaces:

- prefer `scheduleReviewBlocks` when present
- otherwise materialize blocks from canonical `executionEvents` via
  [`materializeBlocksFromEvents`](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/state/engine/todayAuthority.ts)

This keeps Structure aligned with the same underlying schedule truth already
used by Today/Month.

### 2. Month-card title fidelity loss

#### Root cause

The month view was already choosing the strongest available surfaced title:

- `displayTitle || title || label`

So the loss was not in title selection.

The loss was in rendering:

- titles were rendered in a one-line `truncate` container

That clipped stronger SQL titles into fragments like:

- `Write SELECT, ...`
- `Define schema...`
- `Import CSV da...`

#### Fix

[ZionMonthView.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/components/zion/views/ZionMonthView.jsx)
now renders block titles with a two-line clamp instead of one-line truncation.

This preserves more visible:

- object
- method
- output

without changing generation logic or widening the overall layout into a
redesign.

---

## Canonical source reconciliation

The Structure chart now reconciles against the same canonical schedule class
used by Today/Month:

- primary source: `activeCycle.scheduleReviewBlocks`
- canonical fallback: blocks materialized from `activeCycle.executionEvents`

This was chosen specifically to avoid creating a separate UI-only count path.

No fake backfill was added.

---

## Files changed

### UI truth-surface slice

- [StructurePageConsolidated.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/components/zion/StructurePageConsolidated.jsx)
- [ZionMonthView.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/components/zion/views/ZionMonthView.jsx)
- [structure.deliverableTerminology.contract.test.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/components/structure.deliverableTerminology.contract.test.jsx)
- [blockLineage.visibility.test.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/components/blockLineage.visibility.test.jsx)

### Verification-harness correction that unblocked canonical verification

- [runPerfScenario.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/tests/perf/runPerfScenario.ts)

### Incidental style cleanup required for full verification

- [identityCompute.js](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/state/identityCompute.js)

---

## Focused tests added / updated

### Structure chart reconciliation

[structure.deliverableTerminology.contract.test.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/components/structure.deliverableTerminology.contract.test.jsx)

What it proves:

- formal plan chart shows scheduled counts from canonical execution events when
  review blocks are empty
- deliverable rows reconcile scheduled block count
- block title and action lineage both appear correctly on the Structure surface

### Month-card title fidelity

[blockLineage.visibility.test.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/components/blockLineage.visibility.test.jsx)

What it proves:

- month summary cell still renders lineage
- long surfaced titles no longer rely on one-line `truncate`
- rendered title uses two-line clamped presentation

---

## Perf harness blocker and resolution

The UI slice itself was not the last repo-wide blocker.

An unrelated perf-harness test remained red:

- [perf.revalidation.lock.test.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/system/perf.revalidation.lock.test.ts)

### Root cause

In
[runPerfScenario.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/tests/perf/runPerfScenario.ts),
`scheduleParity` was defined as:

```ts
appliedState.lastPlanError == null && placedDelta <= previewBlocks;
```

That stale rule misclassified downstream feasibility/scoring unavailability
(`FEASIBILITY_MISSING_FOR_PLAN`) as schedule parity failure, even when:

- apply succeeded
- placed schedule output was consistent with preview

### Correction

The perf harness now distinguishes:

- `scheduleParity`
- `feasibilityCleanliness`

So schedule parity measures schedule/apply behavior only, while downstream
feasibility/scoring cleanliness is tracked separately.

This change did not modify UI logic or product scheduling logic.

---

## Before / after examples

### Before

- Structure chart could show `0 scheduled blocks` while Today/Month showed real
  scheduled execution
- month cards clipped meaningful SQL titles into one-line fragments such as:
  - `Write SELECT, ...`
  - `Define schema...`
  - `Import CSV da...`

### After

- Structure chart reconciles against canonical execution state when review
  blocks are stale or empty
- month cards preserve more visible title substance by allowing two lines from
  the same canonical surfaced title

---

## Deferred

Still intentionally deferred from this slice:

- builder changes
- evaluator changes
- admission/policy changes
- broader Zion visual redesign
- tooltip-heavy title rescue patterns
- any separate UI-only schedule truth path

---

## Milestone conclusion

The SQL UI truth-surface slice is closed.

Structure now reconciles scheduled block counts against the same canonical
schedule class used by Today/Month, and month cards preserve more visible title
substance without changing generation logic.

Canonical verification is green after separately correcting a stale perf harness
parity rule that had been misclassifying downstream feasibility/scoring
unavailability as schedule failure.
