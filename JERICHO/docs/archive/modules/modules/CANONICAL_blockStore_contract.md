# CANONICAL_blockStore_contract.md

> **Status**: Pre-implementation contract. No code exists yet. **Authority**:
> Derived from `MODULE_scheduleCommitPersistence.md` and
> `MODULE_calendarRendering.md`. Both module sheets are the binding specs this
> contract must satisfy. **Scope**: Defines the interface — writes, reads,
> stored schema, projection boundary, and migration constraints. Does not define
> the data structure or implementation.

---

## 1. Why this exists

The current system maintains block state across three independently written view
slices: `state.today.blocks`, `state.cycle[*].blocks`, and
`state.currentWeek.days[*].blocks`. These slices are written independently by at
least eight distinct mutation paths and are read through `getAllBlocks` — a
union function that deduplicates by id and warns on status divergence.

This architecture has two live correctness failures (documented in
`MODULE_calendarRendering.md` F1 and F2, F2 now fixed) and one structural
failure: there is no single source of truth for block state. Any mutation that
misses one slice produces a diverged view with no error signal in production.

The canonical block store replaces the three scatter-write targets with a single
authoritative source. Derived views (`state.today`, `state.currentWeek`,
`state.cycle`) become computed projections from that source, not independently
maintained arrays.

`getAllBlocks` is a repair layer, not an abstraction. It retires when the store
lands.

---

## 2. Stored block schema

The canonical store persists exactly the fields written by `createBlock`. No
projection or derived fields are stored. All summary, metric, and day-wrapper
fields are computed at projection time from the stored blocks.

### Persisted fields

```ts
type CanonicalBlock = {
  // Identity
  id: string;
  cycleId: string | null;
  goalId: string | null;

  // Scheduling
  start: string; // ISO datetime — canonical time anchor
  end: string; // ISO datetime — derived from start + durationMinutes at write time
  date: string; // ISO day key — derived from start + timezone at write time, stored for query efficiency

  // Classification
  domain: string;
  practice: string;
  origin: string;
  status: string;

  // Linkage
  suggestionId: string | null;
  deliverableId: string | null;
  criterionId: string | null;
  objectiveId: string | null;
  lockedUntilDayKey: string | null;

  // Display
  title: string;
  label: string;

  // Behavioral flags
  optional: boolean;
  isDraft?: boolean;
  linkedAimId?: string | null;
  placementState?: unknown; // opaque — preserved as-is, not read by store
};
```

### Fields explicitly excluded from the store

These are projection-only. They must not be written to the canonical store:

| Field                                                        | Computed by                              |
| ------------------------------------------------------------ | ---------------------------------------- |
| `completionRate`                                             | `summarizeDay`                           |
| `plannedMinutes`                                             | `summarizeDay`                           |
| `completedMinutes`                                           | `summarizeDay`                           |
| `integrityStatus`                                            | `summarizeDay`                           |
| `loadByPractice`                                             | `summarizeDay`                           |
| `driftSignal`                                                | `summarizeDay` / day scaffold            |
| `dominantPractice`                                           | `summarizeDay`                           |
| `driftLabel`                                                 | projection                               |
| `overloadLabel`                                              | projection                               |
| `streakState`                                                | projection                               |
| `summaryLine`                                                | `buildDaySummary`                        |
| `practices`                                                  | projection                               |
| Day wrapper fields (`{ date, blocks, completionRate, ... }`) | `buildMonthCycle` / `recomputeSummaries` |

---

## 3. Write interface

The store exposes exactly the operations needed to cover every current mutation
path. Each operation maps to one or more of the eight known writers identified
in the Q1 audit.

### `upsertBlock(block: CanonicalBlock): void`

Replaces the stored block with the given id, or inserts it if it does not exist.
Replaces `createBlock`'s scatter-write as the canonical single-block write.

- **Deduplication**: `canEmitExecutionEvent` logic stays in `createBlock` as a
  pre-write check. The store does not enforce deduplication — callers are
  responsible for not calling `upsertBlock` on a block that should not be
  created.
- **Replaces**: `createBlock` scatter-write to `today.blocks`, `cycle`,
  `currentWeek`

### `upsertBlocks(blocks: CanonicalBlock[]): void`

Batch version of `upsertBlock`. Replaces all blocks in the array by id. Used by
rematerialization paths that rebuild blocks from execution events.

- **Replaces**: rematerialization path writing
  `state.today.blocks = rematerialized.todayBlocks` and
  `state.cycle = rematerialized.days`

### `updateBlock(id: string, patch: Partial<CanonicalBlock>): void`

Merges the patch into the stored block with the given id. No-ops if id does not
exist.

- **Replaces**: `updateBlock` mutation writer
- **Note**: patch fields must be restricted to persisted fields only. Callers
  must not pass projection fields in the patch.

### `updateBlockStatus(id: string, status: string, atISO: string): void`

Specialized status update. Separate from `updateBlock` because status changes
trigger execution event emission — keeping this as a named operation makes the
event emission boundary explicit.

- **Replaces**: `updateBlockStatus` mutation writer

### `deleteBlock(id: string): void`

Removes the block with the given id. No-ops if id does not exist.

- **Replaces**: `deleteBlock` mutation writer

### `rescheduleBlock(id: string, newStart: string, newEnd: string, newDate: string): void`

Updates the time fields of a stored block. Separate from `updateBlock` because
rescheduling also requires updating the `date` index used by range queries.

- **Replaces**: `rescheduleBlock` mutation writer

### `replaceBlocksForDateRange(startDayKey: string, endDayKey: string, blocks: CanonicalBlock[]): void`

Removes all stored blocks whose `date` falls within `[startDayKey, endDayKey]`
and inserts the provided replacement set. Used by rematerialization and
rebalance paths that rebuild a date window from scratch.

- **Replaces**: `rebalanceTodayPlan`, `mergePriorTodayBlocks`,
  `syncPlacementStateFromEvents` bulk mutation paths
- **Caution**: the date range must be computed correctly before calling this.
  Over-broad ranges will delete blocks outside the intended window.

### `clearBlocksForCycle(cycleId: string): void`

Removes all stored blocks belonging to the given cycle. Used by active-cycle
switching, archive, and delete paths.

- **Replaces**: filter/clear paths in cycle switch and archive code

---

## 4. Read interface

Three read patterns are required, derived from the `MODULE_calendarRendering.md`
dependency surface.

### `getBlockById(id: string): CanonicalBlock | null`

Returns the stored block with the given id, or null if not found.

### `getBlocks(filters?: BlockFilters): CanonicalBlock[]`

Returns all stored blocks, optionally filtered. Replaces `getAllBlocks` union.
The union and dedup logic in `getAllBlocks` is retired — there is only one
source, so union is unnecessary.

```ts
type BlockFilters = {
  cycleId?: string;
  goalId?: string;
  status?: string;
  origin?: string;
};
```

### `getBlocksInRange(startDayKey: string, endDayKey: string, filters?: BlockFilters): CanonicalBlock[]`

Returns all stored blocks whose `date` falls within `[startDayKey, endDayKey]`
inclusive. Replaces `buildMonthCycle`'s scan of `state.cycle` and eliminates the
cross-month truncation failure (`MODULE_calendarRendering.md` F1).

This is the critical read operation. Without it, month navigation still requires
`state.cycle` to contain the right entries, which means the truncation bug is
only partially fixed.

### `getBlocksForWeek(anchorDayKey: string, filters?: BlockFilters): CanonicalBlock[]`

Returns all stored blocks whose `date` falls within the ISO week (Monday–Sunday)
containing `anchorDayKey`. Implemented as `getBlocksInRange` with week boundary
computation via `normalizeWeekStart`. May be a thin wrapper rather than a
distinct store operation.

---

## 5. Projection boundary

The canonical store holds blocks. Derived state is computed from blocks by the
existing projection layer. This boundary must not be crossed in either
direction.

**Store → projection** (correct):

```
getBlocksInRange(month) → buildMonthCycle equivalent → summarizeDay → state.cycle
getBlocksForWeek(anchor) → buildWeekFromCycle → state.currentWeek
getBlocksInRange(today, today) → today.blocks → state.today
```

**Projection → store** (forbidden):

- `summarizeDay` output fields must never be written back to the store
- `recomputeSummaries` must read from the store, not from `state.cycle`, as its
  rebuild source — otherwise `state.cycle` is still a de facto canonical source

**The most dangerous migration risk**: if `recomputeSummaries` is migrated to
read from the store but any mutation path still writes to `state.cycle` directly
(e.g. a missed mutation site), `state.cycle` will silently diverge from the
store. The migration must audit every write to `state.cycle`,
`state.today.blocks`, and `state.currentWeek.days` and ensure each one routes
through the store before `recomputeSummaries` is cut over.

---

## 6. Known mutation paths to absorb

Every path below must be migrated to the store write interface before the
scatter-write targets are retired. This is the migration checklist — not a
design input, but a completeness gate.

| Current writer                               | Store operation                    | Risk                                 |
| -------------------------------------------- | ---------------------------------- | ------------------------------------ |
| `createBlock` scatter-write                  | `upsertBlock`                      | Medium — dedup guard stays in caller |
| `updateBlock`                                | `updateBlock`                      | Low                                  |
| `deleteBlock`                                | `deleteBlock`                      | Low                                  |
| `updateBlockStatus`                          | `updateBlockStatus`                | Low — event emission boundary        |
| `rescheduleBlock`                            | `rescheduleBlock`                  | Medium — date index update           |
| `recomputeSummaries` cycle rebuild           | Read from store, not `state.cycle` | High — cutover gate                  |
| Rematerialization path (line 2823)           | `upsertBlocks`                     | Medium — bulk replace                |
| `rebalanceTodayPlan`                         | `replaceBlocksForDateRange`        | Medium — range boundary              |
| `mergePriorTodayBlocks`                      | `replaceBlocksForDateRange`        | Medium                               |
| `syncPlacementStateFromEvents`               | `replaceBlocksForDateRange`        | Medium                               |
| Recurring pattern application (line 6851)    | `upsertBlocks`                     | Low                                  |
| Cycle archive / delete / switch filter paths | `clearBlocksForCycle`              | Low                                  |

---

## 7. What `getAllBlocks` becomes

After migration, `getAllBlocks` is a direct read from the canonical store:

```js
export function getAllBlocks(state) {
  return state.blockStore.getBlocks();
}
```

The union logic, `seen` set, `divergeWarned` set, and status divergence warning
are all retired. There is nothing to union. The function signature is preserved
for backward compatibility with existing callers — the implementation changes,
the interface does not.

---

## 8. What must not be designed yet

The following are implementation decisions that should not be made in this
contract:

- **Data structure** — whether the store is a `Map`, a normalized object, an
  array with an index, or a separate class. That is an implementation detail.
- **State location** — whether the store lives at `state.blockStore`, as a
  separate Redux/Immer slice, or as a module-level singleton. That depends on
  the broader state architecture decision.
- **Indexing strategy** — whether date-range queries scan or use a pre-built
  index. For the current block volumes (tens to low hundreds per cycle), a scan
  is acceptable. Pre-building an index is premature until profiling says
  otherwise.
- **Persistence / serialization** — whether the store is serialized to
  localStorage, IndexedDB, or the existing state serialization path. Out of
  scope for this contract.

These decisions follow from the contract, not the other way around.

---

## 9. Migration sequence

The migration cannot be done as a single atomic change. The scatter-write
targets are load-bearing for current rendering. The sequence must keep the
system functional at every commit.

**Recommended sequence**:

1. **Introduce the store alongside existing slices** — add the store to state,
   wire `createBlock` to write to both the store and the existing scatter
   targets. No reads from the store yet. System behavior unchanged. Confirms
   store write path is correct by comparing store contents against existing
   slice contents.

2. **Migrate reads one consumer at a time** — starting with `getAllBlocks`
   (lowest risk, most isolated), migrate each read consumer to the store. Run
   existing tests after each consumer migration. If a test fails, the store
   write is missing a block that the old scatter-write was producing.

3. **Migrate mutation writers** — migrate `updateBlock`, `deleteBlock`,
   `updateBlockStatus`, `rescheduleBlock` to write to the store. Keep scatter
   writes alive during this phase.

4. **Cut over `recomputeSummaries`** — this is the highest-risk step. Change
   `buildMonthCycle` to call `getBlocksInRange` instead of reading
   `state.cycle`. At this point the projection rebuild reads from the store. Run
   cross-month navigation tests (added in `MODULE_calendarRendering.md` required
   action 6).

5. **Retire scatter writes** — remove direct writes to `state.today.blocks`,
   `state.cycle[*].blocks`, and `state.currentWeek.days[*].blocks` from all
   mutation paths. Remove the union logic from `getAllBlocks`. Remove the
   `divergeWarned` warning path.

6. **Retire compatibility fields** — remove `state.suggestedBlocks` mirror from
   `setCycleProposedBlocks` (per `MODULE_scheduleCommitPersistence.md` required
   action 1). At this point the state model is clean.

**Do not skip step 1.** Running the store in shadow-write mode before any reads
are migrated is the lowest-risk way to validate correctness. Any block that
exists in the scatter slices but not in the store is a missed write — detectable
by diffing `getAllBlocks` output against `state.blockStore.getBlocks()` output
in the test suite before any read migration begins.
