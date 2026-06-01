# Full Matrix Execution Pass 1

## Scope

Expanded compiler-to-scorecard execution from bounded 9-lane rollout to full
canonical 1.0 matrix:

- 9 archetypes
- 5 subtype lanes each
- 45 representative goals executed

## Fixture Expansion

Canonical fixture source:

- `src/state/contracts/archetypeRepresentativeGoals1_0.ts`

Coverage guarantees:

- 45 fixture entries
- each `(archetype, subtype)` lane covered exactly once
- all lanes validated against canonical matrix (`archetypeMatrix1_0.ts`)

## Runner Surface

Updated runner:

- `src/state/contracts/compilerScorecardRunner.ts`

Now supports:

- `runCompilerScorecardFullMatrix()` for 45-lane execution
- `runCompilerScorecardBoundedRollout()` for 9-lane smoke path
- lane-level summaries for all executed lanes
- aggregate summaries:
  - total/pass/warn/fail
  - byArchetype
  - byLane
  - weakestDimensions

## Initial Aggregate Result (Pass 1)

From deterministic local run of `runCompilerScorecardFullMatrix()`:

- total: 45
- pass: 24
- warn: 0
- fail: 21

## Archetype Distribution

Each archetype executed exactly 5 lanes.

## Warning/Failure Pattern

Weakest dimensions currently cluster in:

- `outputQuality`
- `actionQuality`
- `scheduleQuality`

No current weakness in:

- `correctionQuality`
- `progressTrackingQuality`

Most failures are concentrated in non-canonical compiler-path archetypes
(current architecture reality), which produce deterministic
`COMPILER_NOT_ON_CANONICAL_PATH` lane issues during full-matrix execution.

## Immediate Follow-up Recommendation

Next pass should migrate remaining failing archetypes to canonical deliverable
compiler path in grouped tranches, then re-run the same 45-lane matrix to
convert fail clusters into pass without weakening scorecard thresholds.
