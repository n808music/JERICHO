# Deterministic Distribution Rules Audit

## Current Behavior

The scheduler in `src/state/engine/autoAsanaPlan.ts` no longer uses a pure
earliest-valid-slot greedy policy only. It now chooses among legal candidate
days by current scheduled load first, then packs within the chosen day.

## What Changed

### Previous rule

- Scan candidate days chronologically.
- On the first legal slot found, place the draft there.
- This could front-load work onto Monday/Tuesday even when later weekdays were
  equally legal.

### New rule

- Gather legal candidate slots across all valid days.
- Prefer the valid day with the lowest current scheduled load.
- Break ties by earliest calendar day.
- Within the chosen day, choose the earliest legal window and earliest minute.

## Load Metric

The load metric is deterministic and local to the active planning run:

- accepted block count already committed on that day
- plus blocks already placed during the current scheduling pass on that day

In code, this is the per-day count derived from `acceptedBlocks` and
`placedBusyByDay`.

## Exact Functions Changed

- `src/state/engine/autoAsanaPlan.ts`
  - `findSlotForDraft(...)` now compares candidate days by load before choosing
    the slot.
  - Slot legality checks, max-per-day, and max-per-week checks remain unchanged.
- `tests/state/autoAsanaPlan.distribution.spread.test.ts`
  - Added coverage for balanced spread, tie-breaking, and single-valid-day
    clustering.
- `tests/state/autoAsanaPlan.actionTitleFidelity.test.js`
  - Added coverage proving dependency order is preserved while slot selection
    changes.

## Tie-Break Order

1. Lowest current load
2. Earliest calendar day
3. Earliest valid window
4. Earliest minute inside that window

## Evidence

Focused verification after the change:

- `tests/state/autoAsanaPlan.distribution.spread.test.ts`
- `tests/state/autoAsanaPlan.actionTitleFidelity.test.js`
- `src/state/__tests__/autoAsana.scheduler.v1_1.test.js`

Observed behavior:

- equally valid weekdays now distribute deterministically instead of stacking on
  the first legal day
- single-valid-day scenarios still cluster on the only legal day
- dependency order is preserved
- title persistence behavior is unchanged

## Why This Is Minimal

The change is localized to slot selection only. It does not alter:

- dependency ordering
- window legality
- explicit per-day or per-week caps
- title persistence
- apply/commit behavior

## Remaining Risks

- This is still a deterministic heuristic, not a full fairness optimizer.
- Packed session-plan inputs can still cluster if their legal windows or caps
  leave few alternatives.
- The distribution rule is intentionally bounded and does not change the
  planner’s legality model.
