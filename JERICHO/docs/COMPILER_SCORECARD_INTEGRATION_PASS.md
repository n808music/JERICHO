# Compiler-to-Scorecard Integration (Bounded Rollout)

This pass introduces a runner that executes representative lane goals through
the real compiler path and scores resulting outputs against canonical 1.0 lane
specs.

## Runner

- `src/state/contracts/compilerScorecardRunner.ts`

### Runner outputs

- lane-level result
  - compiler path usage (`usesCanonicalDeliverablePath`)
  - compiled deliverable/action/session counts
  - scorecard dimensions:
    - outputQuality
    - actionQuality
    - scheduleQuality
    - correctionQuality
    - progressTrackingQuality
  - overall lane rating (`pass|warn|fail`)
  - lane issue flags
- aggregate summary
  - total/pass/warn/fail
  - by-archetype counts

## Scope

Bounded rollout currently executes one representative lane goal per archetype (9
goals total) while preserving extension path to all 45 lanes.

## Test

- `tests/state/compilerScorecardRunner.boundedRollout.test.ts`

This is the first integration layer from canonical lane spec -> compiler output
-> scorecard summary.
