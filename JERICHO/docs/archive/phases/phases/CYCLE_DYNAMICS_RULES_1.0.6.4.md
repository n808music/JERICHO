# Cycle Dynamics Rules (Gate 3)

## Scope

Define universal, goal-agnostic cycle-dynamics laws as a deterministic profile
on the active cycle. This pass is read-only: no automatic state mutation of
block statuses.

## Canonical Rule Set

1. `completed` blocks are terminal for deadline pressure.
2. `planned` / `in_progress` blocks with `end < now` are `overdueUnfinished` and
   produce a recommended transition to `MISSED`.
3. `missed` blocks that exceed grace window produce a recommended transition to
   `EXPIRED`.
4. Profile is scoped by canonical `activeCycleId -> goalId` and written to:
   - `state.cycleDynamicsByCycleId[activeCycleId]`
   - `state.cyclesById[activeCycleId].cycleDynamics`
5. Output is deterministic for the same inputs (`nowISO`, block set, grace
   config).

## Data Contract

`CycleDynamicsProfile`:

- `generatedAtISO`
- `cycleId`
- `goalId`
- `totals`:
  - `totalBlocks`, `completed`, `inProgress`, `planned`, `missed`, `expired`,
    `dueToday`, `overdueUnfinished`
- `recommendedTransitions[]`:
  - `blockId`, `fromStatus`, `toStatus`, `reasonCode`, `effectiveAtISO`

## Why This Is Universal

Rules are independent of goal category and independent of deprecated
body/resources/creation/focus taxonomy. They operate on canonical
schedule/execution state only.

## Follow-on (Step 4)

Use `recommendedTransitions` as the single mutation input for explicit
missed/rescheduled/expired state transitions.
