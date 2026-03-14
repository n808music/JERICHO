# MODULE: Calendar Rendering

> **Source**: `src/state/identityCompute.js`
> **Audited**: Phase 2 pre-refactor / Bucket 3 canonical block store boundary
> **Related**: `docs/modules/MODULE_scheduleCommitPersistence.md`
> **Phase 2 target**: Canonical block store — this module is the primary downstream
> consumer. Refactor design must satisfy the render dependency surface documented here
> before any write-side changes are made.

---

## 1. Exported / public contract surface

| Function | Exported | Caller |
|---|---|---|
| `getAllBlocks(state)` | ✅ Yes | External — tests, components, any code needing a full block union |
| `recomputeSummaries(state)` | ❌ Internal | Called inside reducer after any state-mutating action |
| `buildMonthCycle(state, dateString)` | ❌ Internal | Called by `recomputeSummaries` only |
| `buildWeekFromCycle(cycle, date)` | ❌ Internal | Called by `recomputeSummaries` only |

`getAllBlocks` is the only exported function in this path. It is the canonical read
interface as it exists today — a post-hoc union across three independently maintained
slices, not a read from a single source of truth.

---

## 2. Field-level read inventory

This is the dependency surface the canonical block store replacement must satisfy.
Every field listed here is a live read dependency. If any field stops being written
correctly after a refactor, the corresponding render path silently receives stale or
empty data.

### `getAllBlocks`

| Field read | Purpose |
|---|---|
| `state.today.blocks` | Primary block source, added first — first-seen wins on dedup |
| `state.currentWeek.days[*].blocks` | Week-level block source |
| `state.cycle[*].blocks` | Month-cycle block source |

Deduplication: by `b.id`. First occurrence wins. Status divergence across slices is
warned in non-production environments but the first-seen version is kept — no
resolution, no error.

### `recomputeSummaries`

| Field read | Purpose |
|---|---|
| `state.viewDate` | Determines which month to render |
| `state.today.date` | Fallback if `viewDate` absent |
| `state.cycle` | Source passed to `buildMonthCycle` |
| `getPatternConfig(state)` | Target minutes for completion rate computation |

| Field written | Purpose |
|---|---|
| `state.cycle` | Rebuilt month slice, then re-mapped with `summaryLine` |
| `state.today` | Set to the day matching `viewDate` from recomputed cycle |
| `state.currentWeek` | Built from first 7 days of recomputed cycle |

### `buildMonthCycle`

| Field read | Purpose |
|---|---|
| `state.cycle` | Existing day entries, keyed by `date` string |

Output: array of day objects covering every calendar day in the viewed month. Days
with existing entries in `state.cycle` are carried forward. Days without entries get
an empty scaffold (`blocks: []`).

### `buildWeekFromCycle`

| Field read | Purpose |
|---|---|
| `cycle` argument (first 7 items) | The current week's days |
| `date` argument | Sets `weekStart` on the returned week object |

No state reads. Purely derived from the `cycle` argument passed by `recomputeSummaries`.

---

## 3. Deterministic rules

**`getAllBlocks` union rules**:
1. Blocks are added in source priority order: `today` → `week` → `cycle`
2. First occurrence of a given `id` wins — later occurrences are silently skipped
3. Status divergence between slices is warned (non-production only) — not resolved
4. Blocks with no `id` are skipped entirely

**`buildMonthCycle` day construction rules**:
1. Month is computed from `dateString` — defaults to current date if absent
2. Only days within the calendar month of `dateString` are included
3. Days already in `state.cycle` are carried forward by `date` key match
4. Days not in `state.cycle` are scaffolded with empty blocks — prior month data
   for those dates is not preserved
5. No cross-month carry — a block committed on a date outside the viewed month
   is not visible in the month cycle render

**`buildWeekFromCycle` week construction rules**:
1. Takes the first 7 items from the provided `cycle` array unconditionally
2. Does not compute which 7 days belong to the ISO week of `date`
3. `weekStart` is set to `date` argument or first day's `date` — not to the
   Monday of the ISO week
4. If `cycle` has fewer than 7 items, the week will have fewer than 7 days —
   no error, no padding

**`recomputeSummaries` rebuild rules**:
1. Calls `buildTodayFromPattern` first — this may modify block state before the
   month cycle is rebuilt
2. Rebuilds entire `state.cycle` from scratch via `buildMonthCycle` → `summarizeDay`
3. Sets `state.today` to the first matching day in the recomputed cycle — if no
   day matches `viewDate`, falls back to `recomputedCycle[0]`
4. Sets `state.currentWeek` from the first 7 days of the recomputed cycle
5. Re-maps `state.cycle` a second time to add `summaryLine` — two full cycle
   traversals per `recomputeSummaries` call

---

## 4. Known failure modes

### F1 — `buildMonthCycle` truncates blocks outside the viewed month
**Severity**: High — primary Bucket 3 render failure

`buildMonthCycle` constructs the render source by iterating every calendar day in
the month of `dateString`. Days already in `state.cycle` are carried forward by
date key. Days not in `state.cycle` get an empty scaffold.

This means any block committed to a date outside the currently viewed month is
invisible to the render path. If a user views March, blocks committed in April are
not in the render source. When the user navigates to April, `buildMonthCycle`
rebuilds from `state.cycle` — and those blocks are present only if they survived
in `state.cycle` from the original `createBlock` write.

The failure mode is: `state.cycle` gets rebuilt by `recomputeSummaries` on every
relevant dispatch. If a rebuild fires while the viewed month does not contain a
committed block's date, and `state.cycle` is replaced with the rebuilt output, that
block's date entry gets an empty scaffold and the block vanishes from `state.cycle`.
Next time `getAllBlocks` runs, the block is absent from the cycle source. If it also
aged out of `state.today.blocks` and `state.currentWeek.days`, it is unrecoverable
from the render layer without re-reading from execution events.

**The canonical block store refactor must solve this.** Blocks must be queryable
across any date range without depending on whether the viewed month's `state.cycle`
happens to contain them.

---

### F2 — `buildWeekFromCycle` assumes first 7 items are the current week
**Severity**: Medium — date boundary correctness risk

`buildWeekFromCycle` takes `cycle.slice(0, 7)` regardless of `date`. It does not
compute ISO week membership. If `recomputeSummaries` is called with a `viewDate`
that is not the first day of the month (which is the normal case), the first 7 days
of the month cycle are the first 7 days of the month — not the 7 days of the week
containing `viewDate`.

This means `state.currentWeek` may not contain the blocks for the actual current
week if the month starts mid-week or if the user is viewing a date late in the month.
The week rendered in the UI may silently be the wrong week.

**Required action**: `buildWeekFromCycle` should compute which 7 days belong to the
ISO week of `date`, then select those from `cycle`. The current implementation is
correct only when `viewDate` falls within the first 7 days of the month.

---

### F3 — `getAllBlocks` first-seen-wins on diverged slices masks real state corruption
**Severity**: Medium — silent correctness risk

When `state.today.blocks`, `state.currentWeek.days[*].blocks`, and
`state.cycle[*].blocks` contain different versions of the same block (different
`status`, different `title`, different `durationMinutes`), `getAllBlocks` keeps the
first-seen version and warns. The warning is non-production only.

In production, a diverged block is silently resolved to whichever slice wrote it
first. The divergence that triggered the warning is invisible. This is not a
deduplication behavior — it is a data consistency failure masked by a union function.

The scatter-write architecture in `createBlock` (documented in
`MODULE_scheduleCommitPersistence.md` F1) is the upstream cause. Three independent
writes that can diverge produce three versions of the same block. `getAllBlocks` was
written to handle this — but handling it at read time is the wrong layer. The fix
belongs at the write layer (canonical store), not the read layer.

**Required action**: once a canonical store exists, `getAllBlocks` should read from it
directly. The union-with-dedup logic becomes unnecessary and should be removed, not
maintained alongside the new read path.

---

### F4 — `recomputeSummaries` traverses `state.cycle` twice per call
**Severity**: Low — performance note for large cycle arrays

`recomputeSummaries` maps `state.cycle` twice:
1. `cycle.map((day) => summarizeDay(day, targetMap, state))` — builds recomputed cycle
2. `state.cycle.map((day) => ({ ...day, summaryLine: buildDaySummary(...) }))` — adds
   summary lines

For a 31-day month this is negligible. For any future expansion to multi-month ranges
or longer planning horizons, this doubles the traversal cost. Noted here as a
pre-refactor baseline — if the canonical store serves blocks for multi-month ranges,
the traversal pattern needs to be reviewed.

---

### F5 — `recomputeSummaries` fallback sets `state.today` to first cycle day on miss
**Severity**: Low-medium — date navigation edge case

If no day in the recomputed cycle matches `viewDate`, `state.today` is set to
`recomputedCycle[0]` — the first day of the viewed month. This is a silent fallback
with no error set. A user navigating to a date outside the current month's cycle
(e.g. a future month with no cycle data yet) will have `state.today` silently reset
to the first day of whatever month was most recently rendered.

---

## 5. The canonical block store dependency surface

This is the precise contract the Phase 2 canonical store replacement must satisfy.
Any design that does not cover all of these read patterns will break calendar rendering.

| Consumer | Currently reads from | Must read from after refactor |
|---|---|---|
| `getAllBlocks` | `today.blocks` + `week.days[*].blocks` + `cycle[*].blocks` union | Single canonical store, keyed by block id |
| `buildMonthCycle` | `state.cycle` (month-keyed day entries) | Canonical store query by date range (month) |
| `buildWeekFromCycle` | First 7 items of the provided cycle array | Canonical store query by ISO week of `date` |
| `recomputeSummaries` | `state.cycle` as rebuild source | Canonical store as rebuild source, with day-grouped projection |
| Calendar components | `state.today.blocks`, `state.currentWeek.days`, `state.cycle` | Derived projections from canonical store, computed by `recomputeSummaries` equivalent |

**The refactor shape this implies**:

The canonical store is a flat map of blocks keyed by id. Derived views
(`state.today`, `state.currentWeek`, `state.cycle`) are computed projections from
that store, not independently maintained arrays. `recomputeSummaries` becomes a
pure projection function: read from canonical store → group by date → build month
cycle → build week → build today. No scatter writes. No three-slice divergence.

`getAllBlocks` becomes a direct read of the canonical store's values — the union
and dedup logic is retired because there is only one source.

---

## 6. Grade and required actions

| Concern | Grade | Reason |
|---|---|---|
| Block read correctness (`getAllBlocks`) | 🟡 YELLOW | Union logic is correct; first-seen-wins on divergence masks upstream write failures |
| Month render completeness (`buildMonthCycle`) | 🔴 RED | Cross-month blocks silently truncated when viewed month changes |
| Week render correctness (`buildWeekFromCycle`) | 🔴 RED | First-7-items assumption is wrong for any `viewDate` not in the first week of the month |
| Slice divergence handling | 🔴 RED | Warned non-production only; silently corrupted in production |
| Canonical read abstraction | 🔴 RED | No single read source exists; three slices maintained independently |
| `recomputeSummaries` rebuild safety | 🟡 YELLOW | Correct for single-month views; rebuild from `state.cycle` means stale writes survive until next rebuild |

**Overall grade: 🔴 RED**
The render layer is structurally dependent on three independently maintained view
slices with no canonical source. Two of the four core functions have correctness
failures (month truncation, wrong-week selection) that are not edge cases — they fire
on normal navigation. The canonical block store refactor is not an optimization; it
is a correctness fix.

---

## 7. Required actions — sequenced with Module 8 (Schedule Commit / Persistence)

These actions are coupled to the Module 8 (`MODULE_scheduleCommitPersistence.md`)
required actions. They cannot be executed independently.

**Sequence:**

1. **Fix `buildWeekFromCycle` before any store refactor** — this is an isolated
   correctness fix. Replace `cycle.slice(0, 7)` with ISO week computation from
   `date`. Does not require a canonical store. Can ship independently and should —
   it fixes a live rendering bug.

2. **Design canonical store interface** (coupled with Module 8 action 5) — the store
   must support: read all blocks, read by id, read by date range, read by cycleId.
   The interface defines both the `createBlock` write target (Module 8) and the
   `buildMonthCycle` / `getAllBlocks` read target (this module).

3. **Replace `createBlock` scatter-write with canonical store write** (Module 8) —
   once the interface is defined, `createBlock` writes to the store. The three
   scatter-write targets (`today.blocks`, `cycle[*].blocks`, `currentWeek.days[*].blocks`)
   become derived projections computed by `recomputeSummaries`, not write targets.

4. **Refactor `recomputeSummaries` to project from canonical store** — replace
   `buildMonthCycle(state, viewDate)` with a canonical store query for the viewed
   month's date range. The rebuild logic stays; the source changes from
   `state.cycle` to the store.

5. **Retire `getAllBlocks` union logic** — once all reads go through the canonical
   store, the union-with-dedup is unnecessary. Replace with a direct store read.
   The divergence warning path is removed when the upstream cause (scatter-write)
   is removed.

6. **Add cross-month navigation tests** — add tests that commit blocks in month N,
   navigate to month N+1, then return to month N and assert blocks are still present.
   This is the exact failure mode of F1 and there is currently no test covering it.
