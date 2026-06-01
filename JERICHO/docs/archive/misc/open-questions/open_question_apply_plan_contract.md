# Blocker: `APPLY_PLAN` contract decision

> **Status**: Active blocker. Discovered during
> `generateApply.integration.test.js` triage. **Blocks**:
> `generateApply.integration.test.js` rewrite. **Does not block**: remaining
> failing tests — triage continues independently.

## What was found

`APPLY_PLAN` is a distinct reducer case with its own function
`applyGeneratedPlan`. It is not an alias for `APPLY_DRAFT_SCHEDULE`.

```js
case 'APPLY_PLAN':
  applyGeneratedPlan(next);
  break;
```

`applyGeneratedPlan` reads directly from `cycle.autoAsanaPlan.horizonBlocks` and
calls `createBlock` per block.

It guards on:

- `cycle.autoAsanaPlan` present
- admission status
- conflicts
- per-block deduplication via `existingCreates`

It does not go through `applyDraftSchedule`. It does not touch `proposedBlocks`.
It emits `origin: 'auto_asana'`, distinct from `applyDraftSchedule`'s
`origin: 'suggested_apply'`.

## The conflict

Normal-flow `GENERATE_PLAN` now auto-commits through `applyDraftSchedule`, which
clears `cycle.autoAsanaPlan = null` at the end of its run.

This means:

- `GENERATE_PLAN` (normal flow) -> `cycle.autoAsanaPlan` is null after dispatch
- `APPLY_PLAN` -> guards on `cycle.autoAsanaPlan` present -> returns silently

The two actions are mutually exclusive in normal flow.

## Dispatch-site audit

`APPLY_PLAN` is still reachable from production code:

```txt
src/state/identityStore.js:673:  const applyPlan = useCallback(() => dispatch({ type: 'APPLY_PLAN' }), []);
src/state/tests/certification_runner.artifacts.test.js:118:    state = computeDerivedState(state, { type: 'APPLY_PLAN' });
src/state/__tests__/generateApply.gating.test.js:104:    const applied = computeDerivedState(blocked, { type: 'APPLY_PLAN' });
src/state/__tests__/generateApply.integration.test.js:101:    const applied = computeDerivedState(planned, { type: 'APPLY_PLAN' });
```

So Option 2 ("retire `APPLY_PLAN` immediately") is off the table until callers
are migrated.

## Preferred decision

**Option 3** is preferred:

- keep `APPLY_PLAN`
- make its contract explicit
- emit a deterministic error when `cycle.autoAsanaPlan` is absent instead of
  silently returning

Suggested guard:

```js
if (!cycle?.autoAsanaPlan) {
  state.lastPlanError = {
    code: 'NO_AUTO_ASANA_PLAN',
    reason:
      'APPLY_PLAN requires cycle.autoAsanaPlan to be present. Use a preview-only GENERATE_PLAN source.',
    cycleId: cycle?.id || null,
  };
  return;
}
```

## Remaining input needed

- [ ] Confirm whether preview-only `GENERATE_PLAN` sources such as
      `RENEGOTIATION_APPLY` preserve `cycle.autoAsanaPlan` by skipping
      `applyDraftSchedule`

That answer determines whether `APPLY_PLAN` still has a reachable preview-source
path in the current system.
