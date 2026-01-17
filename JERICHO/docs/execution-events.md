# Execution Event Schema & Invariants

## Scope
Execution events are the single source of truth for every change to the identity execution log. They capture what blocks were created, rescheduled, completed, deleted, missed, or when system-level ticks occurred. These events are **not** UI telemetry, suggestion analytics, or draft-only signals; those may live elsewhere but must never mutate the execution log directly.

## Source of Truth
- `executionEvents` is authoritative. No derived projection (`today`, `currentWeek`, summaries) may be mutated and then replayed into `executionEvents`. The log drives every projection; everything else is rebuilt from it via `materializeBlocksFromEvents` and related helpers.
- Any projection should be treated as ephemeral. Rehydration of `executionEvents` from `today.blocks` or other slices is forbidden because it loses ordering, deduplication, and idempotence guarantees.

## Canonical Event Kinds
The materializer recognizes a fixed set of kinds:
1. `create` — produces a brand-new block in the projection.
2. `reschedule` — adjusts an existing block's `startISO`/`endISO`.
3. `complete` — marks blocks as done, carrying completion flags.
4. `delete` — removes a block from play.
5. `missed` — records the moment a committed block rolled over into overdue state.
6. `tick_now` (optional) — used for system ticks or rollovers that do not map to a block. Its usage is limited to time progression metadata.

Only these kinds materialize actual blocks. `kind` values added for telemetry (e.g., `DRAFT_BLOCK_CREATE`) must either wrap one of the canonical kinds or populate a separate log that the materializer ignores.

## ExecutionEvent Shape
Each kind carries specific required fields:

### create
```
{
  kind: 'create',
  blockId: string,            // unique identifier
  startISO: ISOString,
  endISO: ISOString,
  minutes: number,
  cycleId: string,            // required for isolation
  domain: string,
  status: string,             // usually 'in_progress' or 'committed'
  placementState: string,     // e.g., 'COMMITTED', 'DRAFT'
  label?: string,
  deliverableId?: string,
  criterionId?: string,
  origin?: string,
  metadata?: Record<string, any>
}
```

### reschedule
Requires `blockId`, new `startISO`, new `endISO`, `minutes`, possibly updated `placementState`.

### complete
Includes `blockId`, `status` set to `'completed'`, `completed: true`, and optional `completedAtISO`.

### delete
Carries `blockId` and any `reason` metadata needed by the UI.

### missed
Pairs with every overdue carryover to show what block moved forward. Contains `blockId`, `startISO`, `dayKey`, and `placementState` (usually `'MISSED'`).

### Shared optional fields
`label`, `deliverableId`, `criterionId`, `origin`, `goalId`, `lockedUntilDayKey`, `cycleId` (always required for create), `metadata`.

## Block Identity & Idempotence
- `blockId` must be unique per block. The materializer keys by this value, so overwriting it collapses state.
- Draft IDs are deterministic but never reused: `draft:${cycleId}:${timestampOrSeq}` ensures multiple drafts coexist without collisions.
- Rollover-created overdue IDs follow `overdue:${originalBlockId}:${nextDayKey}` so each shift is traceable and immutably unique.
- Idempotence is preserved by checking whether a `create` with the same `blockId` already exists before appending a new event.

## Cycle Invariants
- Every `create` event must include a valid `cycleId`. Without it the block becomes global and may surface in unrelated cycles.
- `today.blocks` is filtered to the active cycle right before `computeDerivedState` returns (see `enforceActiveCycleTodayBlocks`).
- Cycle transitions (`new`, `end`, `delete`, `archive`) must never leak blocks into another active cycle.

## Determinism Invariants
- `computeDerivedState(state, action)` is pure: identical inputs always produce identical outputs.
- Events are appended in deterministic order so the materializer yields consistent projections across runs.

## Examples
**Minimal create event**
```
{
  kind: 'create',
  blockId: 'blk-123',
  startISO: '2026-01-13T09:00:00.000Z',
  endISO: '2026-01-13T11:00:00.000Z',
  minutes: 120,
  cycleId: 'cycle-1',
  domain: 'CREATION',
  status: 'in_progress',
  placementState: 'COMMITTED'
}
```

**Draft create event** (keeps canonical shape but origin/tagged)
```
{
  ...
  placementState: 'DRAFT',
  origin: 'draft',
  blockId: 'draft:cycle-1:1'
}
```

**Rollover missed/create pair**
```
{ kind: 'missed', blockId: 'blk-1', placementState: 'MISSED', dayKey: '2026-01-13' }
{ kind: 'create', blockId: 'overdue:blk-1:2026-01-14', startISO: '2026-01-14T09:00:00.000Z', placementState: 'COMMITTED', cycleId: 'cycle-1' }
```
