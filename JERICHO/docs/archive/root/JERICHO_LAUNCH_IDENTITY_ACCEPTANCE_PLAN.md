# JERICHO Launch / Identity Acceptance Plan

## Purpose

Turn the Launch / Identity hardening spec into a concrete acceptance surface
before implementation.

This plan covers:

- `VentureLaunch`
- `BrandLaunch`

The proving question is not whether these lanes can produce schedules. The
proving question is whether they can do so honestly, concretely, and without
launch inflation.

## Test File Map

### Existing files to extend

- `src/domain/goal/GoalIntakeContract.test.ts`
- `src/domain/goal/GoalPolicy.test.ts`
- `src/domain/goal/GoalPolicy.crossDomain.test.ts`
- `src/domain/goal/GoalPolicy.planQuality.crossDomain.test.ts`
- `src/domain/goal/GoalPolicy.outputQuality.crossDomain.test.ts`
- `tests/components/StructurePageConsolidated.admitGoalFlow.test.jsx`
- `tests/components/ZionDashboard.pos.afterAdmit.test.jsx`
- `tests/state/goalToDeliverables.contract.test.ts`
- `tests/state/goalToDeliverables.actionDerivation.test.ts`
- `tests/state/goalToDeliverables.summary.test.ts`
- `tests/state/goalToDeliverables.schedulerCompatibility.test.js`
- `tests/state/singlePipeline.postFix.integration.test.ts`

### New file to create

- `src/domain/goal/LaunchIdentityPolicy.crossDomain.test.ts`

This file should hold the family-specific parity and trust-gating cases for
`VentureLaunch` and `BrandLaunch`.

## Shared Assertions

Every lane in this family must prove the same policy spine:

1. endpoint clarity
2. starting-point honesty
3. scope discipline
4. dependency coherence
5. block measurability
6. feasibility honesty

And the same readiness and trust states:

- `fully_admitted`
- `assumption_marked_draft`
- `intake_blocked`

- `trusted`
- `provisional`
- `withheld`

## Required Case Types

For each archetype in this family, the test surface should include:

1. one `fully_admitted` case
2. one `assumption_marked_draft` case
3. one `intake_blocked` case
4. one schedulable-but-`provisional` or `withheld` P.O.S. case
5. one required-vs-recommended scope case
6. one refusal / no-silent-expansion case

## VentureLaunch Cases

### `VentureLaunch::Service Business Launch`

Canonical goal examples:

- `Launch a consulting service by deadline`
- `Launch a service offer by deadline`
- `Start a business`

Expected behaviors:

- explicit offer + explicit launch boundary -> `fully_admitted`
- offer known, launch boundary still ambiguous -> `assumption_marked_draft`
- no defined offer -> `intake_blocked`
- schedulable launch prep should still be `provisional` until live launch
  evidence exists
- outreach/process assets remain required only when launch boundary demands them
- `Start a business` must not produce an invented business type or brainstorm
  fallback

### `VentureLaunch::SaaS Product Launch`

Canonical goal examples:

- `Ship a SaaS MVP by deadline`
- `Build a product by deadline`
- `Launch a beta by deadline`

Expected behaviors:

- explicit MVP boundary -> admitted or draftable depending on starting state
- artifact unclear (`Build a product`) -> `intake_blocked`
- internal MVP remains schedulable without full production hardening becoming
  required by default
- public launch boundary forces launch-ready scope, not generic build scope
- schedulable plans stay `provisional` until the release boundary is explicit
  and policy-clean

## BrandLaunch Cases

### `BrandLaunch::Business Brand Launch`

Canonical goal examples:

- `Launch a business brand by deadline`
- `Create a brand for a business by deadline`
- `Launch a service business`

Expected behaviors:

- clear brand object + clear channel boundary -> `fully_admitted`
- brand object known, launch boundary vague -> `assumption_marked_draft`
- no brand object -> `intake_blocked`
- required scope must stay limited to core strategy, messaging, and essential
  identity assets
- additional polish, secondary channels, or optional creative variations remain
  recommended
- schedulable work should remain `provisional` until the identity/launch
  boundary is honest

### `BrandLaunch::Personal Brand Launch`

Canonical goal examples:

- `Launch a personal brand by deadline`
- `Build a creator identity by deadline`
- `Grow a brand`

Expected behaviors:

- explicit identity + channel boundary -> admitted
- identity clear, channel unclear -> draftable if assumptions are explicit
- vague growth language -> blocked or heavily degraded
- no silent promotion of content volume into required launch scope

## Cross-Domain Parity Cases

The same ambiguity class must map to the same readiness logic family even when
the lane wording differs.

Required parity pairs:

- launch boundary ambiguity in service launch and business brand launch
- artifact ambiguity in SaaS launch and personal brand launch
- starting-state ambiguity in SaaS launch and service launch
- deadline ambiguity in business launch and brand launch
- external-readiness ambiguity in marketplace-adjacent VentureLaunch cases and
  business brand launch

For each pair, the test should confirm:

- same bucket classification
- same readiness logic family
- same trust gating shape
- no special pleading by lane

## Required Scope vs Recommended Scope Assertions

The acceptance plan must include at least one case where:

- offer / identity work is required
- launch polish is recommended
- extra channel work is optional

And at least one case where:

- a similar-looking launch task becomes required because the endpoint boundary
  is stronger

This is the core anti-inflation check for the family.

## P.O.S. Trust Assertions

The family must prove that:

- a schedulable launch plan can remain `provisional`
- `trusted` requires real boundary clarity and evidence
- `withheld` is acceptable when the launch boundary or starting state is too
  weak
- launch prep does not become trust by default

## Lifecycle Assertions

The family must also preserve the stabilized schedule lifecycle:

- `Generate Schedule` creates draft proposed blocks
- `Apply` places them on-calendar for review
- `Activate` / `Commit` makes the schedule authoritative
- required active blocks are reschedulable, not casually deletable
- repeated generate/apply on the same draft must not duplicate active work

## Suggested Implementation Order

1. Extend `GoalIntakeContract.test.ts` with Launch / Identity threshold cases.
2. Add `LaunchIdentityPolicy.crossDomain.test.ts` for parity and trust-gating
   coverage.
3. Extend `GoalPolicy.test.ts` with lane-specific trust asymmetry checks.
4. Extend the deliverable compiler tests so launch deliverables stay concrete
   and non-generic.
5. Extend the UI lifecycle tests if needed to prove launch-state labels remain
   compact and accurate.

## Review Standard

If implementation passes one launch lane by silently inflating scope, it fails
this plan.

If implementation makes the schedule look good but leaves trust provisional or
withheld, it passes policy but not the family hardening spec.

The proving question is whether the Launch / Identity family can harden without
becoming a generic planning prompt that merely happens to schedule well.
