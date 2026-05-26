# JERICHO Physical Progression Acceptance Plan

## Purpose

Turn the Physical Progression hardening spec into a concrete test plan before
any grammar hardening so the standard stays fixed and the code cannot redefine
it.

This plan covers the family:

- `PhysicalTraining`

The implementation target is not "does Jericho work for fitness goals?" The
target is:

- does the same policy architecture survive physical progression goals?
- does the same readiness logic hold when recovery and load are central?
- does the system preserve draftable vs blocked, required vs recommended, and
  trusted vs provisional distinctions without special pleading?

## Test File Map

### Existing files to extend

- [`tests/state/physicalTraining.contract.test.ts`](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/state/physicalTraining.contract.test.ts)
- [`tests/state/physicalTraining.milestoneDiscrimination.test.ts`](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/state/physicalTraining.milestoneDiscrimination.test.ts)
- [`tests/state/physicalTraining.schedulerCompatibility.test.js`](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/state/physicalTraining.schedulerCompatibility.test.js)
- [`src/domain/goal/GoalPolicy.test.ts`](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalPolicy.test.ts)
- [`src/core/__tests__/autoDeliverables.test.ts`](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/core/__tests__/autoDeliverables.test.ts)
- [`src/domain/autoStrategy.test.ts`](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/autoStrategy.test.ts)

### New file to create

- [`src/domain/goal/PhysicalProgressionPolicy.crossDomain.test.ts`](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/PhysicalProgressionPolicy.crossDomain.test.ts)

This new file should hold the cross-domain parity cases so the shared policy
logic is tested directly rather than inferred through UI-only paths.

## Shared Assertions

Every lane should be checked against the same six policy pillars:

1. endpoint clarity
2. starting-point honesty
3. scope discipline
4. dependency coherence
5. block measurability
6. feasibility honesty

Every lane should also prove the same readiness states:

- `fully_admitted`
- `assumption_marked_draft`
- `intake_blocked`

And the same trust states:

- `trusted`
- `provisional`
- `withheld`

## Concrete Test Cases

### 1. Strength Program

Use:

- `Start a 12-week strength cycle`
- `Build a squat benchmark`
- `Return to lifting after a break`

Cases:

- clear baseline and benchmark target resolves to `fully_admitted`
- benchmark target known but load tolerance unclear resolves to
  `assumption_marked_draft`
- unclear readiness target or invented proof boundary resolves to
  `intake_blocked`
- schedulable training can remain `provisional` when recovery evidence is thin
- required vs recommended scope stays separated

### 2. Endurance Performance

Use:

- `Train for a 5k in 8 weeks`
- `Prepare for a half marathon`
- `Complete a race-ready training block`

Cases:

- known event target and horizon with baseline evidence resolves cleanly
- event target known but benchmark readiness is still provisional
- no measurable event boundary resolves to `intake_blocked`
- a schedulable plan remains `provisional` if the load progression is too thin
  or recovery data is absent

### 3. Weight Loss / Body Composition

Use:

- `Lose 10 pounds by summer`
- `Reduce body fat for a deadline`
- `Improve body composition`

Cases:

- measurable target with baseline data resolves to `fully_admitted`
- target known but current baseline is only assumed resolves to
  `assumption_marked_draft`
- vague improvement language without target evidence resolves to
  `intake_blocked`
- support work like tracking extras remains recommended unless explicitly
  required

### 4. Rehab Return to Training

Use:

- `Return to training after rehab`
- `Rebuild load tolerance after injury`
- `Get back to running`

Cases:

- recovery context and return target are explicit enough for admission
- rehab target known but readiness depends on unresolved recovery evidence stays
  `provisional`
- unclear injury / recovery boundary resolves to `intake_blocked`
- recovery blocks remain required when load feasibility depends on them

### 5. General Conditioning

Use:

- `Build a general conditioning base`
- `Improve work capacity over 6 weeks`
- `Prepare for a broader training block`

Cases:

- baseline and capacity target are explicit enough for a bounded draft
- conditioning goal without a measurable boundary resolves to `intake_blocked`
- a plan can be schedulable while `trusted` remains withheld until baseline and
  load evidence are stronger

## Cross-Domain Parity Cases

The same ambiguity class must map to the same policy outcome even when the
domain wording differs.

Required parity pairs:

- baseline ambiguity in strength and endurance
- recovery / load ambiguity in rehab and endurance
- target ambiguity in body composition and general conditioning
- proof-state ambiguity in strength and rehab
- deadline / horizon ambiguity in endurance and body composition

For each pair, the test should confirm:

- the same bucket classification
- the same readiness logic family
- the same trust gating shape
- no special pleading by lane wording

## Acceptance Rules

The matrix is only implementation-ready if the test suite can prove all of the
following:

- weak fitness language does not collapse into generic training advice
- completed sessions are not treated as adaptation proof by default
- recovery is not treated as optional polish when load depends on it
- recommended support work is not promoted to required by default
- a schedulable plan does not automatically become trusted
- intake-blocked goals stay in the intake path instead of entering graph
  generation
- the same ambiguity class is classified consistently across all lanes

## Suggested Implementation Order

1. Extend `physicalTraining.contract.test.ts` with universal threshold cases.
2. Extend `physicalTraining.milestoneDiscrimination.test.ts` with
   benchmark-vs-proof cases.
3. Add `PhysicalProgressionPolicy.crossDomain.test.ts` for parity and trust
   gating coverage.
4. Extend `GoalPolicy.test.ts` with family-specific trust asymmetry checks.
5. Extend the core deliverable/strategy tests only if the current grammar is
   still generic after the policy assertions exist.

## Review Standard

If a future change helps one lane by weakening the shared policy in another, it
fails this plan.

The proving question is not whether each row can be made to pass by adding more
lane-specific exceptions.

The proving question is whether the same policy architecture still holds when
the progression target changes.
