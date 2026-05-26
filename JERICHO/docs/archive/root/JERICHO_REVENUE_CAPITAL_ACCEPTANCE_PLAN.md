# JERICHO Revenue / Capital Acceptance Plan

## Purpose

Turn the Revenue / Capital hardening spec into a concrete acceptance surface
before implementation.

This plan covers:

- `SalesPipeline`
- `Fundraising`

The proving question is not whether these lanes can produce schedules. The
proving question is whether they can do so honestly, concretely, and without
pipeline inflation.

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
- `tests/state/recoveryEndToEndSmoke.test.ts`
- `tests/state/failureClassMapper.baseline.test.ts`

### New file to create

- `src/domain/goal/RevenueCapitalPolicy.crossDomain.test.ts`

This file should hold the family-specific parity and trust-gating cases for
`SalesPipeline` and `Fundraising`.

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

## SalesPipeline Cases

### `SalesPipeline::B2B Service Sales`

Canonical goal examples:

- `Build a B2B service sales pipeline by deadline`
- `Close 10 qualified service deals by deadline`
- `Launch a sales pipeline for consulting offers`

Expected behaviors:

- target list + offer + boundary explicit -> `fully_admitted`
- offer known, but conversion boundary still vague -> `assumption_marked_draft`
- no target list or no offer -> `intake_blocked`
- schedulable prospecting work should still be `provisional` until responses and
  qualification evidence exist
- CRM polish, extra analytics, and broader follow-up tooling remain recommended
  unless the endpoint requires them
- `Close 10 qualified service deals` must not be inferred from outreach alone

### `SalesPipeline::Subscription / Recurring Revenue Sales`

Canonical goal examples:

- `Grow recurring revenue pipeline by deadline`
- `Build a subscription sales pipeline`
- `Increase recurring sales by quarter end`

Expected behaviors:

- explicit acquisition + retention boundary -> admitted or draftable depending
  on starting state
- pipeline-only language (`Grow recurring revenue pipeline`) is not enough to
  imply retained revenue
- active outreach can be schedulable while P.O.S. remains provisional
- onboarding handoff and retention follow-up become required only when the
  declared boundary demands them
- support collateral stays recommended unless the endpoint explicitly requires
  it

## Fundraising Cases

### `Fundraising::Angel Raise`

Canonical goal examples:

- `Raise an angel round by deadline`
- `Secure angel commitments by deadline`
- `Build an investor pipeline for angel funding`

Expected behaviors:

- clear thesis + target list + boundary -> `fully_admitted`
- thesis known, but commitment boundary vague -> `assumption_marked_draft`
- no target investors or no funding narrative -> `intake_blocked`
- schedulable outreach can remain `provisional` until investor response or
  diligence evidence exists
- deck polish, extra collateral, and advanced analytics remain recommended
  unless the declared boundary requires them
- `Build an investor pipeline` must not become committed funding by default

### `Fundraising::Grant / Non-Dilutive Funding`

Canonical goal examples:

- `Win a grant by deadline`
- `Submit a non-dilutive funding application by deadline`
- `Build a grant pipeline`

Expected behaviors:

- eligibility + materials + deadline explicit -> admitted or draftable
- unclear eligibility or unclear submission boundary -> `intake_blocked`
- application activity can be schedulable while P.O.S. remains withheld until
  external evidence exists
- secondary collateral, extra reporting, and analytics remain recommended unless
  explicitly required by the submission boundary
- `Build a grant pipeline` must not imply a funded award

## Cross-Domain Parity Cases

The same ambiguity class must map to the same readiness logic family even when
the lane wording differs.

Required parity pairs:

- pipeline boundary ambiguity in sales and fundraising
- target-list ambiguity in B2B sales and angel raise
- starting-state ambiguity in subscription sales and grant funding
- external-response ambiguity in consultative sales and sponsorship-adjacent
  fundraising
- deadline ambiguity in recurring revenue and non-dilutive funding

For each pair, the test should confirm:

- same bucket classification
- same readiness logic family
- same trust gating shape
- no special pleading by lane

## Required Scope vs Recommended Scope Assertions

The acceptance plan must include at least one case where:

- offer / narrative work is required
- support collateral is recommended
- extra analytics or follow-up tooling is optional

And at least one case where:

- a similar-looking pipeline task becomes required because the endpoint boundary
  is stronger

This is the core anti-inflation check for the family.

## P.O.S. Trust Assertions

The family must prove that:

- a schedulable pipeline plan can remain `provisional`
- `trusted` requires real stage evidence, not just internal activity
- `withheld` is acceptable when the boundary or external evidence is too weak
- internal progress does not become trust by default

## Lifecycle Assertions

The family must also preserve the stabilized schedule lifecycle:

- `Generate Schedule` creates draft proposed blocks
- `Apply` places them on-calendar for review
- `Activate` / `Commit` makes the schedule authoritative
- required active blocks are reschedulable, not casually deletable
- repeated generate/apply on the same draft must not duplicate active work

## Suggested Implementation Order

1. Extend `GoalIntakeContract.test.ts` with Revenue / Capital threshold cases.
2. Add `RevenueCapitalPolicy.crossDomain.test.ts` for parity and trust-gating
   coverage.
3. Extend `GoalPolicy.test.ts` with lane-specific trust asymmetry checks.
4. Extend the deliverable compiler tests so pipeline deliverables stay concrete
   and non-generic.
5. Extend the UI lifecycle tests if needed to prove pipeline-state labels remain
   compact and accurate.

## Review Standard

If implementation passes one pipeline lane by silently inflating scope, it fails
this plan.

If implementation makes the schedule look good but leaves trust provisional or
withheld, it passes policy but not the family hardening spec.

The proving question is whether the Revenue / Capital family can harden without
becoming a generic pipeline prompt that merely happens to schedule well.
