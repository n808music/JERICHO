# JERICHO V1 Gum Loop Baseline Freeze

## Purpose

This document freezes the first complete Jericho v1 end-to-end loop proven on the gum / commercial product launch lane.

The purpose of this freeze is:

- preserve the first full canonical loop that now works from admitted goal through execution evidence
- define the owner surfaces and test files that make this loop authoritative
- prevent future lane work from weakening or silently bypassing the baseline

This freeze is about the `BrandLaunch` / commercial launch lane represented by the gum goal, not about every lane in the system.

## Baseline Statement

The gum / commercial launch lane now proves the first complete Jericho v1 loop:

- Plan Quality passes
- Initial Feasibility emits a hard pre-execution score
- Live P.O.S. stays withheld before execution evidence
- Today blocks appear from applied schedule truth
- `COMPLETE_BLOCK` / `MISS_BLOCK` / `SKIP_BLOCK` create canonical execution events
- execution events preserve `temporalRelation`, `reasonCode`, `dependencyRelation`, `source`, and `requiresReview`
- deletion/removal creates `planMutationEvents` and does not fabricate execution truth
- external evidence events exist separately from execution events
- Shot Clock derives time pressure and timed deadline state
- Course Correction classifies consequence
- Live P.O.S. consumes execution evidence, correction, shot clock, and external evidence
- the full gum loop is locked by `tests/state/jerichoLoop.gum.e2e.test.ts`

## Canonical Loop Components

1. Goal admission and planning substrate
   - admitted goal contract
   - canonical deliverables and action graph
   - applied schedule / review schedule truth

2. Plan-quality and forecast layer
   - plan-quality gate evaluates schedule and endpoint substrate
   - Initial Feasibility produces a hard point estimate, range, confidence, and summary when substrate is valid

3. Today execution layer
   - Today renders scheduled work from canonical applied block truth
   - execution actions create durable top-level canonical events

4. Truth-classified execution layer
   - execution events preserve timing truth
   - dependency-sensitive early completion is classified, not silently trusted

5. Plan mutation layer
   - deletion/removal is audited separately from execution evidence
   - required-work removal creates correction risk, not fake completion

6. External-world evidence layer
   - external response/outcome evidence is stored separately from execution actions
   - external evidence can influence correction severity and Live P.O.S.

7. Time and correction layer
   - Shot Clock computes horizon/time/deadline state
   - Course Correction classifies consequence without mutating the plan

8. Live probability layer
   - Live P.O.S. remains distinct from Initial Feasibility
   - Live P.O.S. unlocks only from canonical evidence

## Closed Doctrines

The following doctrinal separations are considered closed for this baseline:

- bad substrate withholds Initial Feasibility
- bad odds produce a low Initial Feasibility score rather than withholding
- hard feasibility score is primary; range is uncertainty context and cannot substitute for score
- Plan Quality and Initial Feasibility are separate but coupled by substrate eligibility
- Initial Feasibility and Live P.O.S. are separate canonical paths
- execution events own execution outcome status
- deletion is plan mutation, not execution evidence
- external-world evidence is separate from execution evidence
- user controls input; system controls truth classification

## Owner Files

- Goal policy / Initial Feasibility / Live P.O.S.
  - `src/domain/goal/GoalPolicy.ts`
- Plan-quality gate
  - `src/domain/planQuality/evaluatePlanQualityGate.ts`
- Execution event shape / plan mutation events / external evidence events
  - `src/state/engine/todayAuthority.ts`
- Reducer action path
  - `src/state/identityStore.js`
- Canonical derivation / state wiring
  - `src/state/identityCompute.js`
- Shot Clock
  - `src/state/engine/shotClock.ts`
- Course Correction
  - `src/state/engine/executionCorrectionEvaluator.ts`
- Stability / Today UI surface
  - `src/components/ZionDashboard.jsx`

## Baseline Tests

The following tests define the baseline and should be treated as regression locks:

- `tests/state/jerichoLoop.gum.e2e.test.ts`
- `tests/state/gumGoal.liveParity.test.ts`
- `tests/state/livePOS.gumSchedule.test.ts`
- `tests/state/todayExecution.gumSchedule.test.ts`
- `tests/state/executionCorrection.gumSchedule.test.ts`
- `tests/state/executionCorrection.authority.test.ts`
- `tests/state/shotClock.derivation.test.ts`
- `tests/state/blockDeletion.mutation.test.js`
- `tests/state/externalEvidence.events.test.ts`
- `tests/components/ZionDashboard.pos.afterAdmit.test.jsx`

## Remaining Known Limitations

- no real integration producer exists yet for `integration_verified` external evidence
- external evidence scoring is bounded but still lane-agnostic
- timed deadline misses can be surfaced diagnostically before they become richer canonical outcome evidence
- dependency validity for early completion is action-graph based plus heuristics, not full external-world verification
- deletion can preserve audit truth but cannot prove real-world completion/failure on its own

## Non-Regression Requirement

Future lane work must not weaken this baseline.

Specifically:

- do not collapse Initial Feasibility back into withheld for difficult-but-assessable commercial goals
- do not let blockStore status bypass canonical execution events
- do not let deletion/removal fabricate success or improve Live P.O.S.
- do not merge external evidence into execution events
- do not let UI convenience bypass canonical truth owners

Any new lane implementation that changes shared policy, correction, event, shot-clock, or Live P.O.S. paths must preserve the gum baseline tests above.
