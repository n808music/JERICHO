# Open question brief: `forecast_and_commit_do_not_mix.test.js`

> **Status**: Held. Requires explicit team decision before any rewrite.
> **Source confirmed**: full file read. Brief is anchored to real assertions, not audit abstractions.
> **Authority**: `docs/scheduling_generate_plan_contract.md`

---

## What this test actually asserts

Three sequential invariants, in order:

```js
// 1. GENERATE_PLAN does not write execution events
expect(planned.executionEvents.length).toBe(beforeEvents);

// 2. Suggested blocks are available for manual acceptance after generation
expect((planned.suggestedBlocks || []).some((s) => s.status === 'suggested')).toBe(true);

// 3. No committed blocks written to today
expect((planned.today?.blocks || []).length).toBe(0);

// 4. Explicit ACCEPT_SUGGESTED_BLOCK is what triggers execution event creation
const accepted = computeDerivedState(planned, { type: 'ACCEPT_SUGGESTED_BLOCK', proposalId: first.id });
const created = (accepted.executionEvents || []).find((e) => e.kind === 'create' && e.blockId === `blk-${first.id}`);
expect(Boolean(created)).toBe(true);
```

This is not a stale status filter. It is an explicit contract test for a specific UX
boundary: **generate is non-destructive, accept is the commit gate.**

Under the current auto-commit contract, all four assertions are violated:
- Assertion 1 fails: `GENERATE_PLAN` now writes execution events during auto-apply
- Assertion 2 fails: `suggestedBlocks` are not populated by the auto-commit pipeline
  (or are cleared before the test can observe them)
- Assertion 3 may fail depending on whether `today.blocks` is written during commit
- Assertion 4 is untestable: `first` is `undefined` because assertion 2 found nothing

---

## Why this was held

This test cannot be fixed by a status flip. The contract it describes —
forecast-without-commit — no longer exists in the normal `GENERATE_PLAN` path.
Rewriting it requires deciding whether that contract should exist at all.

---

## The decision

### Option 1 — retire this boundary, replace with explicit preview-source test

Accept that normal-flow `GENERATE_PLAN` is auto-commit. The forecast-without-commit
boundary is preserved only through named preview sources (`RENEGOTIATION_APPLY`,
`RECOVERY`). Replace this test with one that explicitly routes through a preview source
and asserts the same four invariants against that path.

```js
it('RENEGOTIATION_APPLY generates suggestions without committing', () => {
  // ...same fixture...
  const planned = computeDerivedState(onboarded, {
    type: 'GENERATE_PLAN',
    payload: { source: 'RENEGOTIATION_APPLY' }
  });

  expect(planned.executionEvents.length).toBe(beforeEvents);         // no commit
  expect((planned.proposedBlocks || []).some((s) => s.status === 'suggested')).toBe(true); // preview available
  expect((planned.today?.blocks || []).length).toBe(0);              // nothing written to today

  const first = (planned.proposedBlocks || []).find((s) => s.status === 'suggested');
  const accepted = computeDerivedState(planned, {
    type: 'APPLY_DRAFT_SCHEDULE',
    payload: { cycleId: planned.activeCycleId }
  });
  expect((accepted.executionEvents || []).length).toBeGreaterThan(beforeEvents); // commit on explicit apply
});
```

**What this preserves**: the boundary invariant that forecast-without-commit is possible
in the system. It moves that invariant to the explicit preview path where it now lives.

**What this retires**: the claim that *normal-flow* `GENERATE_PLAN` is non-destructive.
The new normal-flow contract is commit-on-generate. That is now documented in
`scheduling_generate_plan_contract.md`.

**Tradeoff**: Any UI surface that currently calls `GENERATE_PLAN` expecting preview-only
behavior without passing a preview source is now auto-committing silently. This option
is only safe if the product decision is confirmed: normal-flow generation always commits.

---

### Option 2 — restore preview-only as the default, make auto-commit explicit

Revert the normal-flow `GENERATE_PLAN` to preview-only. Introduce a separate action or
payload flag (e.g. `autoApply: true` or a new `GENERATE_AND_APPLY_PLAN` action) to
trigger the auto-commit pipeline explicitly.

This test then passes as written with no changes.

**What this costs**: the `autoAsanaPlan` boundary work that shipped becomes a named
explicit action rather than the default. All current callers of `GENERATE_PLAN` that
expect auto-commit behavior would need to update to the new explicit action.

**What this gains**: the forecast-without-commit boundary is restored as the default.
The system is non-destructive by default, destructive by explicit choice.

**Tradeoff**: This is a larger scope change than the test rewrite. It touches callers,
not just tests. It may also conflict with agent design that assumes `GENERATE_PLAN`
produces committed output.

---

## What the test file name signals

`forecast_and_commit_do_not_mix` is not an implementation test. It is a **product
boundary test**. The name encodes the intended UX contract: the user can see a forecast
without triggering a commit. That boundary existed before `autoAsanaPlan`. The question
is whether it should continue to exist, and if so, where.

---

## Inputs needed for the decision

Before the team resolves this, confirm:

- [ ] **Is any current UI surface calling `GENERATE_PLAN` without expecting auto-commit?**
  If yes, those surfaces are already silently committing. Option 1 requires auditing and
  updating them or protecting them with a preview source.

- [ ] **Does the agent design require `GENERATE_PLAN` to produce committed output?**
  If agents downstream of `GENERATE_PLAN` consume committed blocks (Asana sync, calendar
  writes, execution event handlers), Option 2 breaks that pipeline unless the agents are
  updated to call the new explicit action.

- [ ] **Is `ACCEPT_SUGGESTED_BLOCK` still a live action in the current system?**
  The test dispatches it. If it has been deprecated or renamed, Option 1's replacement
  test needs to use the current explicit-accept mechanism instead.

- [ ] **Is `suggestedBlocks` still written by any current pipeline path?**
  The test reads `suggestedBlocks`, not `proposedBlocks`. If `GENERATE_PLAN` no longer
  writes to `suggestedBlocks` under any path, the test's second assertion is permanently
  broken regardless of which option is chosen, and the replacement test must use
  `proposedBlocks` instead.

---

## Recommended path

Option 1, conditional on the UI surface audit.

The auto-commit contract is already in production via `autoAsanaPlan`. The
`scheduling_generate_plan_contract.md` documents it as authoritative. Reversing that
for Option 2 is a product decision, not a test decision, and would require broader
coordination than this batch rewrite.

Option 1 preserves the forecast-without-commit *capability* by routing it through the
named preview sources that already exist for exactly this purpose. The boundary doesn't
disappear — it moves to where it currently lives in the system.

The replacement test should be written in a new file,
`forecast.previewSource.doesNotCommit.test.js`, rather than rewriting this file in
place. That keeps the original test's git history intact and makes the migration
explicit: the old boundary file is deleted intentionally, the new boundary file is
added intentionally, and the commit message explains why.

---

## Current holding state

- File is **not skipped** — it currently fails but is not masked
- Do not add `it.skip` until the decision is made — the failure is a live signal that
  the contract gap exists
- Do not rewrite until Option 1 or Option 2 is confirmed by the team
- All other Phase 1 files are complete and committed
