# Block Title Persistence Audit

## Reproduction

Route:

- `http://localhost:5184/#/structure`

Workflow:

1. Admit the podcast goal.
2. Generate the plan.
3. Apply the plan.
4. Inspect the month calendar and committed-horizon surface.

Observed defect before fix:

- upstream work item/title: `Record episode 1`
- live calendar could still render legacy wording such as
  `Create production outline and scene/content map`

## Title Path

### 1. Source / planning

- Canonical podcast titles are carried on the scheduled action or deliverable
  object as `title`.
- The scheduler now prefers `deliverableTitle` when available and falls back to
  the action/session title.

### 2. Execution event write

- Shared builder: `buildExecutionEventFromBlock(...)`
- Canonical title field added: `canonicalTitle`
- Legacy/debug label field retained: `rawLabel`

### 3. Materialization

- `materializeBlocksFromEvents(...)` now prefers `canonicalTitle` over
  `rawLabel`.
- This is the first drift point that previously caused the legacy label to
  overwrite the approved title.

### 4. UI render

- Dashboard and block rendering consume the materialized block title.
- No presentation-only workaround was needed once the event materialization was
  corrected.

## Exact Drift Point

The first overwrite occurred in `src/state/engine/todayAuthority.ts`:

- `materializeBlocksFromEvents(...)` used `event.rawLabel` to set `block.title`
  and `block.label`
- this let a generic legacy label replace the canonical episodic title

## Minimal Fix

Files changed:

- `src/state/engine/todayAuthority.ts`
- `src/state/identityCompute.js`
- `tests/state/executionEvents.materialization.test.js`
- `tests/components/ZionDashboard.applyDraftSchedule.test.jsx`

What changed:

- added `canonicalTitle` to execution events
- populated `canonicalTitle` at event-write sites
- made materialization prefer `canonicalTitle` over `rawLabel`
- preserved canonical `title` on reducer-side block updates

Why this is minimal:

- scheduling behavior is unchanged
- apply behavior is unchanged
- the fix only changes which title wins when canonical and legacy labels both
  exist
- no broader planner refactor was introduced

## Evidence

Focused verification:

- `npx vitest run tests/state/executionEvents.materialization.test.js --reporter=verbose`
- `npx vitest run tests/components/ZionDashboard.applyDraftSchedule.test.jsx --reporter=verbose`
- `npm run check-all`

Result:

- canonical title survives event materialization
- live dashboard render shows `Record episode 1`
- generic raw labels no longer leak into the calendar surface when a canonical
  title exists
- full suite passed with `889` tests

## Current Status

The podcast calendar path now preserves episodic titles cleanly through the
source-to-committed-render pipeline for the tested canonical path.
