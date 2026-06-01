# Full-Horizon Schedule Export — Option B Brief

**Date:** 2026-05-31
**Owner:** next implementation session
**Status:** ready to implement

## Problem

`identityCompute` already builds the full 1,072-block horizon schedule on every tick via `expandFullHorizonSchedule()` (`src/domain/masterPlan/fullHorizonScheduleExpansion.js:1005`). The blocks are then passed to `buildFullHorizonAgendaVersion()` (`src/domain/masterPlan/fullHorizonScheduledAgenda.js:126`), which **persists only `blockCount`, `blockIds`, and `summary`** (lines 173–184) — the per-block payloads are discarded.

Result: a snapshot of identity state contains a 1,072-element manifest with no titles, durations, expected outputs, or schedule positions. The active cycle's 24 `MASTER_PLAN_FIRST_CYCLE` blocks are the only payload-bearing schedule records that survive serialization.

Evidence: `tmp-live-jericho-identity.json` — agenda summary reports 1,072 blocks (byPhase P1=319/P2=490/P3=263); each `fh-…` ID appears exactly twice in the file (current + stale agenda). Zero overlap between cycle `suggested:…` IDs and agenda `fh-…` IDs.

## Goal

Produce a programmatic surface that, given an identity-state snapshot, returns the **full 1,072-block horizon schedule with payloads**, suitable for the existing extract/eval pipeline (`tmp-build-eval-doc.py`). No change to persisted state shape, no change to cycle materialization.

Non-goal: persist the payloads. Non-goal: build the "Structure export" UI button (later).

## Design

### New module: `src/domain/masterPlan/exportFullHorizonSchedule.js`

Single pure function:

```js
export function buildFullHorizonScheduleExport(identityState) {
  // → { blocks: Array<Block>, summary: AgendaSummary, range: {startDayKey,endDayKey}, agendaVersionId }
}
```

Implementation contract:

1. Locate the active master plan from `identityState.masterPlansById[identityState.activeGoalId-derived-planId]` (or the single entry if only one).
2. Reconstruct the same inputs `identityCompute` passes to `expandFullHorizonSchedule()`. The currently-passed args are: `{ plan, phaseModel, horizonStartDayKey, horizonEndDayKey, lanes, existingForecastBlocks, committedBlocks, workDays }`. Trace from `identityCompute.js:4272` upstream — `blocks` is already in scope there, so the inputs are constructed nearby. Mirror that construction exactly. Do **not** re-derive these inputs; extract them into a helper that both `identityCompute` and the new module call (DRY the contract, don't fork it).
3. Call `expandFullHorizonSchedule(...)` → array of full block payloads.
4. Call `buildFullHorizonAgendaVersion(...)` with the same blocks to get a parity `summary` (used for round-trip verification — see Tests).
5. Return blocks + summary + range + agendaVersionId.

Block payloads must include the fields the expander already emits via `buildBlock()` (`fullHorizonScheduleExpansion.js:851`): `id`, `dayKey`, `phaseLabel`, `laneId`, `masterPlanLaneId`, `blockType`, `title`, `expectedOutput`, `durationMinutes`, `owner`, `passEvidence`, `producesArtifact`, `consumedBy`, `consumedByRef`, `dependsOn`, `unlocks`. **Do not** synthesize fields not produced by `buildBlock`.

### New CLI runner: `scripts/exportMasterPlanSchedule.mjs`

```bash
node scripts/exportMasterPlanSchedule.mjs <identity-json-path> <output-json-path>
```

Reads the identity JSON, calls `buildFullHorizonScheduleExport`, writes the result. This unblocks `tmp-build-eval-doc.py` (which currently consumes `tmp-schedule-extract.json` with 24 blocks) — point it at the new output and the doc gets 1,072 blocks with payloads.

### Schema for the output JSON

Extend the existing `tmp-schedule-extract.json` shape. Add a top-level key `fullHorizonBlocks: Array<Block>` alongside `blocks` (which keeps the 24 first-cycle `suggested:…` records). Keep both — they're additive, not duplicates, and the eval doc benefits from showing the executable-now schedule next to the strategic forecast.

## Tests

Unit test: `src/domain/masterPlan/exportFullHorizonSchedule.test.js`

Fixture: a frozen identity-state snapshot (start from `tmp-live-jericho-identity.json`; freeze a minimal version under `tests/fixtures/`).

Assertions:

1. `blocks.length === identityState.masterPlanAgendaVersionsById[current].blockCount` (1,072 for the fixture).
2. `new Set(blocks.map(b => b.id))` exactly equals `new Set(identityState.masterPlanAgendaVersionsById[current].blockIds)`.
3. Each block has non-null `id`, `dayKey`, `blockType`, `title`, `durationMinutes`, `phaseLabel`.
4. Recomputed summary (`byPhase`, `byYear`, `byQuarter`, `byLane`, `byBlockType`) deep-equals the persisted agenda summary.
5. Determinism: two consecutive calls with the same input produce identical output (`JSON.stringify` parity).

## Open questions (decide before merge)

1. **startISO synthesis.** `buildBlock` writes `dayKey` but not `startISO`. The eval doc currently renders `startISO`. Either (a) synthesize `startISO` in the export by combining `dayKey` with a default work-window start time, or (b) update the eval doc to fall back to `dayKey` when `startISO` is null. Recommend (b) — keeps the export pure to what the engine actually decides.
2. **Should the export include `executionEvents` or remain forecast-only?** Recommend forecast-only. Execution events stay in the cycle slice.
3. **Where does the helper that constructs `expandFullHorizonSchedule` inputs live after extraction?** Suggest `src/domain/masterPlan/horizonScheduleInputs.js`, imported by both `identityCompute` and the new export module.

## Out of scope

- "Structure export" UI button (separate brief once Option B has been exercised against 2-3 real plans).
- Persisting payloads into `masterPlanAgendaVersionsById` (Option A — revisit after sync/payload-size data exists).
- Multi-cycle lowering (Option C).
- Fixing the milestone date histogram hollow-middle (2027–2030) or the 24-block cycle's `temporalStatus: rebase_required` — both real defects, both separately scoped.
