# JERICHO Cross-Domain Policy Acceptance Test Plan

## Purpose

Turn the cross-domain policy matrix into a concrete test plan before broad
implementation so the standard stays fixed and the code cannot redefine it.

This plan covers the five proving domains:

- podcast / media
- software / product build
- fitness / training
- business launch
- real estate / project

The implementation target is not "does Jericho work in each domain?" The target
is:

- does the same policy architecture survive different goal shapes?
- does the same readiness logic hold across domains?
- does the system preserve draftable vs blocked, required vs recommended, and
  trusted vs provisional distinctions without special pleading?

## Test File Map

### Existing files to extend

- [`src/domain/goal/GoalIntakeContract.test.ts`](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalIntakeContract.test.ts)
- [`src/domain/goal/GoalPolicy.test.ts`](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalPolicy.test.ts)
- [`tests/components/StructurePageConsolidated.admitGoalFlow.test.jsx`](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/components/StructurePageConsolidated.admitGoalFlow.test.jsx)
- [`tests/components/ZionDashboard.pos.afterAdmit.test.jsx`](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/components/ZionDashboard.pos.afterAdmit.test.jsx)
- [`tests/state/schedule.generate.nonSilent.test.js`](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/state/schedule.generate.nonSilent.test.js)

### New file to create

- [`src/domain/goal/GoalPolicy.crossDomain.test.ts`](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalPolicy.crossDomain.test.ts)

This new file should hold the cross-domain parity cases so the shared policy
logic is tested directly rather than inferred through UI-only paths.

## Shared Assertions

Every domain should be checked against the same six policy pillars:

1. endpoint clarity
2. starting-point honesty
3. scope discipline
4. dependency coherence
5. block measurability
6. feasibility honesty

Every domain should also prove the same readiness states:

- `fully_admitted`
- `assumption_marked_draft`
- `intake_blocked`

And the same trust states:

- `trusted`
- `provisional`
- `withheld`

## Concrete Test Cases

### 1. Podcast / Media

Use:

- `Create 6 episodes by deadline`
- `Publish 6 episodes by deadline`
- `Record 6 episodes by deadline`

Cases:

- `create 6 episodes by deadline` resolves to `intake_blocked` when boundary,
  mode, and starting state are all too weak
- `publish 6 episodes by deadline` resolves to `published` boundary and
  `fully_admitted` or `assumption_marked_draft` only if start state still
  requires an explicit assumption
- `record 6 episodes by deadline` resolves to `recorded` and keeps publishing
  tasks recommended unless publication is explicit
- `assumption_marked_draft` still allows a bounded draft but does not silently
  upgrade to published
- `trusted` P.O.S. is withheld until the boundary is explicit and the plan is
  policy-clean

### 2. Software / Product Build

Use:

- `Build the product by deadline`
- `Ship a v1 feature by deadline`
- `Build an internal MVP by deadline`
- `Launch production release by deadline`

Cases:

- `build the product by deadline` is artifact-unclear and must resolve to
  `intake_blocked`
- unclear artifact => `intake_blocked`
- feature defined, release mode unclear => `assumption_marked_draft`
- internal MVP remains schedulable without silently requiring full rollout
- public release requires release workflow and rollout as required scope
- one test must prove the plan is schedulable while P.O.S. remains `provisional`

### 3. Fitness / Training

Use:

- `Prepare for a marathon by deadline`
- `Train for a half marathon by deadline`
- `Get in shape by summer`

Cases:

- no measurable event target => `intake_blocked`
- event target known, baseline assumed => `assumption_marked_draft`
- a bounded draft must keep recovery trackable as measurable support blocks or
  explicit rest structure, not inferred physiological claims
- trust remains `provisional` until baseline and load tolerance are explicit

### 4. Business Launch

Use:

- `Launch a service by deadline`
- `Launch an offer by deadline`
- `Start a business`

Cases:

- no defined offer => `intake_blocked`
- offer defined, launch boundary vague => `assumption_marked_draft`
- launch workflow becomes required only when live launch is explicit
- business ideation must be refused if the offer itself is not known
- `start a business` must not cause the system to invent a business type or
  brainstorming output as a fallback
- at least one schedulable plan must remain `provisional` for trust

### 5. Real Estate / Project

Use:

- `Renovate a rental unit to inspection-ready by deadline`
- `Deliver a tenant-ready office suite by deadline`
- `Complete the project`

Cases:

- permit / approval / ownership ambiguity that changes feasibility =>
  `intake_blocked`
- site and boundary known but some external gate unresolved =>
  `assumption_marked_draft`
- a known project artifact with unresolved permit or ownership state remains
  blocked even if the schedule would otherwise be easy to draft
- optional upgrades remain optional and never become required by default
- at least one plan should be schedulable while trust is `withheld`
- no plan should imply acquisition or permit state that was not confirmed

## Cross-Domain Parity Cases

The same ambiguity class must map to the same policy outcome even when the
domain wording differs.

Required parity pairs:

- endpoint ambiguity in media and business
- artifact ambiguity in software and real estate
- starting-state ambiguity in media and fitness
- deadline ambiguity in business and project
- resource/capacity ambiguity in fitness and software
- delivery-mode ambiguity in media and software
- external-dependency ambiguity in software and real estate

For each pair, the test should confirm:

- the same bucket classification
- the same readiness logic family
- the same trust gating shape
- no special pleading by domain

## Acceptance Rules

The matrix is only implementation-ready if the test suite can prove all of the
following:

- silent scope expansion does not return
- recommended work is not promoted to required by default
- weak input is blocked or downgraded consistently
- a schedulable plan does not automatically become trusted
- intake-blocked goals stay in the intake path instead of entering graph
  generation
- the same ambiguity class is classified consistently across all five domains

## Suggested Implementation Order

1. Extend `GoalIntakeContract.test.ts` with the universal threshold cases.
2. Add `GoalPolicy.crossDomain.test.ts` for parity and trust-gating coverage.
3. Extend `GoalPolicy.test.ts` with domain-specific trust asymmetry checks.
4. Extend the UI tests so admission state and trust state remain visible.
5. Extend the schedule-generation test to prove recommended work does not get
   promoted to required work.

## Review Standard

If a future change helps one domain by weakening the shared policy in another,
it fails this plan.

The proving question is not whether each row can be made to pass by adding more
domain-specific exceptions.

The proving question is whether the same policy architecture still holds when
the domain changes.
