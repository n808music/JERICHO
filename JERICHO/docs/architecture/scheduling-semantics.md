# Scheduling Semantics

This document defines the canonical `Generate -> Propose -> Apply -> Render`
contract used for deterministic debugging and validation.

## Canonical Inputs (active cycle scoped)

- `cycle.id`
- `cycle.goal` / `cycle.goalContract`
- `cycle.deliverables[]` (workspace:
  `state.deliverablesByCycleId[cycleId].deliverables`)
- `cycle.actions[]` / `cycle.llmActionGraph.actions[]` when present
- `cycle.workWindows[]` (goal contract shape), normalized to scheduler
  `weeklyWindows`
- `cycle.capacityRules` (constraints and pacing in plan proof/scheduler
  constraints)
- `cycle.dateRange` (`startDayKey/startDateISO`, `endDayKey/endDateISO`)

## Canonical Generator Output

- Primary: `state.proposedBlocks[]`
- Error: `state.lastPlanError`
- Per-cycle mirror: `state.proposedBlocksByCycleId[cycleId]`
- Temporary compatibility mirror: `state.suggestedBlocks`

## Apply Output (committed)

- Apply consumes proposed blocks and writes committed blocks through the
  canonical execution-event/createBlock pipeline.
- Renderable committed blocks are materialized into:
  - `state.today.blocks`
  - `state.currentWeek.days[].blocks`
  - `state.cycle[].blocks`

## Renderer Sources

- Draft panel (Today): `state.proposedBlocks` (with temporary fallback to
  `state.suggestedBlocks`)
- Day/Week/Month committed views: `getAllBlocks({ today, currentWeek, cycle })`

## Invariants

1. Exactly one canonical source-of-truth for proposed blocks:
   `state.proposedBlocks`.
2. Exactly one canonical committed render source:
   `getAllBlocks({ today, currentWeek, cycle })`.
3. Any compatibility mirror (`state.suggestedBlocks`) is temporary and
   non-authoritative.
4. Generate must end with one deterministic outcome:
   - `proposedBlocks.length > 0`, or
   - `lastPlanError.code` set with stable reason codes.

## Deterministic Trace Contract

Each `GENERATE_PLAN` attempt emits one `JERICHO_GENERATE_TRACE` group
containing:

- `cycleId`
- `deliverableCount`
- `actionCount`
- `rawWorkWindowsCount`
- `normalizedCandidateWindowCount`
- `proposedBlocksCount`
- `lastPlanErrorCode`
- `firstThreeProposedBlocks` (id/day/start/end/status)
