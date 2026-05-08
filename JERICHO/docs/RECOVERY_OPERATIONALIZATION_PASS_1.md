# Recovery Operationalization Pass 1

## Scope

Operationalized deterministic recovery behavior for the bounded 45-lane Jericho
1.0 surface.

## Modules Added

- `src/state/engine/recoveryTypes.ts`
- `src/state/engine/driftSignalDetector.ts`
- `src/state/engine/failureClassMapper.ts`
- `src/state/engine/recoveryConfirmationPolicy.ts`
- `src/state/engine/recoveryRecommendationEngine.ts`
- `src/state/engine/stabilityRecoveryPayload.ts`

## Model Summary

### Drift signals

Deterministic detection for:

- missed sessions
- output delay
- low readiness
- low throughput
- quality failure
- dependency block
- capacity overrun
- low adherence
- resource gap
- external timing disruption

### Failure class mapping

Deterministic lane-aware mapping from signal bundles to failure classes, with
ordered confidence ranking. Examples:

- `OUTPUT_DELAY + CAPACITY_OVERRUN -> SCOPE_OVERLOAD`
- `LOW_THROUGHPUT` in pipeline families -> `CONVERSION_FAILURE`
- PhysicalTraining readiness + safety risk -> `RECOVERY_SAFETY_FAILURE`

### Recommendation engine

Lane-aware recommendations with bounded lever taxonomy and explicit tradeoff
text. Representative lane-specific adjustments include:

- Podcast Production: trailer + first episode fallback
- Certification Exam: weak-domain remediation cadence
- Job Search: fit/material tightening before volume increase
- Rehab Return: regression to prior milestone with symptom checkpoints
- Fundraising: narrative/deck + target-fit tightening

### Confirmation policy

Deterministic confirmation requirement based on:

- success-definition change
- deadline change
- target-threshold change
- insufficient context escalation

## Stability Payload Wiring

- Added recovery payload per lane in `buildStabilityEndToEndSummary`.
- Stability now exposes:
  - drift signal counts
  - primary failure class
  - proposed recovery adjustment
  - confirmation-required flag
  - no-recovery-needed state

## Tests Added/Updated

- `tests/state/driftSignalDetector.baseline.test.ts`
- `tests/state/failureClassMapper.baseline.test.ts`
- `tests/state/recoveryRecommendationEngine.baseline.test.ts`
- `tests/state/recoveryConfirmationPolicy.test.ts`
- `tests/state/stabilityRecoveryPayload.summary.test.ts`
- `tests/state/recoveryRepresentativeLanes.test.ts`
- `tests/state/recoveryMatrixContractCoverage.test.ts`
- `tests/state/recoveryEndToEndSmoke.test.ts`
- Updated `tests/state/stabilityEndToEndVerification.summary.test.ts`

## Known Limits

- Pass 1 uses deterministic heuristic thresholds and lane-family mappings, not
  full historical trend modeling.
- Recovery recommendations are bounded textual templates and not direct schedule
  mutation commands.
- Context insufficiency escalation is surfaced, but interactive follow-up
  collection flow is not implemented in this pass.

## Next Refinement Targets

1. Add trend-window drift detection using cycle history and POS deltas.
2. Add subtype-specific threshold calibration where signal density differs
   materially.
3. Add optional auto-apply path for low-risk lever combinations with audit
   trail.
4. Extend Stability to show before/after projected impact from selected recovery
   levers.
