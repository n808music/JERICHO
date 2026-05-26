# JERICHO Employment Pipeline Acceptance Plan

## Purpose

Turn the Employment Pipeline hardening spec into a concrete acceptance surface
before implementation.

This plan covers:

- `JobSearchPipeline`

The proving question is not whether these lanes can produce schedules. The
proving question is whether they can do so honestly, concretely, and without
employment-pipeline inflation.

## Test File Map

### Existing files to extend

- `src/domain/goal/GoalIntakeContract.test.ts`
- `src/domain/goal/GoalPolicy.test.ts`
- `src/domain/goal/GoalPolicy.crossDomain.test.ts`
- `src/domain/goal/GoalPolicy.planQuality.crossDomain.test.ts`
- `src/domain/goal/GoalPolicy.outputQuality.crossDomain.test.ts`
- `tests/state/jobSearchPipeline.contract.test.js`
- `tests/state/jobSearchPipeline.nonVagueOutputs.test.js`
- `tests/state/jobSearchPipeline.schedulerCompatibility.test.js`
- `tests/state/mockLLMActionGraph.compileCoverage.test.ts`
- `tests/state/singlePipeline.postFix.integration.test.ts`

### New file to create

- `src/domain/goal/EmploymentPipelinePolicy.crossDomain.test.ts`

This file should hold the family-specific parity and trust-gating cases for
`JobSearchPipeline`.

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

## Corporate Role Search Cases

Canonical goal examples:

- `Apply for corporate roles by deadline`
- `Land interviews for a corporate role by deadline`
- `Get a corporate job`

Expected behaviors:

- explicit target role family + explicit boundary -> `fully_admitted`
- target family known, response boundary still ambiguous ->
  `assumption_marked_draft`
- no target role family -> `intake_blocked`
- schedulable application prep should still be `provisional` until actual
  employer response evidence exists
- resume / outreach support tasks remain required only when the boundary demands
  them
- `Get a corporate job` must not produce invented employer response or career
  advice fallback

## Remote Knowledge Work Search Cases

Canonical goal examples:

- `Land a remote knowledge role by deadline`
- `Build a remote job search pipeline by deadline`
- `Get a remote role`

Expected behaviors:

- explicit remote target + boundary -> admitted or draftable depending on
  starting state
- target clear, response boundary unclear -> `assumption_marked_draft`
- no target role family -> `intake_blocked`
- internal prep remains schedulable without turning into trusted outcome
- schedulable plans stay `provisional` until interview / offer evidence exists

## Creative Role Search Cases

Canonical goal examples:

- `Apply for creative roles by deadline`
- `Land interviews for a creative role by deadline`
- `Break into creative work`

Expected behaviors:

- explicit creative target + explicit boundary -> admitted
- target clear, response boundary vague -> draftable if assumptions are explicit
- vague aspiration language -> blocked or heavily degraded
- no silent promotion of portfolio curation into employer interest

## Skilled Trade Role Search Cases

Canonical goal examples:

- `Apply for skilled trade roles by deadline`
- `Land a trade role by deadline`
- `Get work in a trade`

Expected behaviors:

- explicit trade target + boundary -> admitted
- credential baseline known, response boundary still ambiguous -> draftable
- no clear target role family -> blocked
- proof of qualification does not become job acceptance without employer
  evidence

## Career Transition Search Cases

Canonical goal examples:

- `Transition into a new role family by deadline`
- `Shift careers by deadline`
- `Change careers`

Expected behaviors:

- explicit transition direction + target family -> admitted
- transition direction known, role family still vague -> draftable only if the
  assumptions are visible
- vague reinvention language -> blocked or heavily degraded
- no fallback invention of a new career identity or hidden target market

## Cross-Domain Parity Cases

The same ambiguity class must map to the same readiness logic family even when
the lane wording differs.

Required parity pairs:

- target-role ambiguity in corporate role search and career transition search
- artifact ambiguity in remote knowledge work search and creative role search
- starting-state ambiguity in skilled trade role search and corporate role
  search
- deadline ambiguity in creative role search and career transition search
- external-response ambiguity in remote knowledge work search and trade search

For each pair, the test should confirm:

- same bucket classification
- same readiness logic family
- same trust gating shape
- no special pleading by lane

## Required Scope vs Recommended Scope Assertions

The acceptance plan must include at least one case where:

- role targeting, applications, outreach, and interview prep are required
- networking polish is recommended
- extra collateral is optional

And at least one case where:

- a similar-looking support task becomes required because the boundary is
  stronger

This is the core anti-inflation check for the family.

## P.O.S. Trust Assertions

The family must prove that:

- a schedulable job-search plan can remain `provisional`
- `trusted` requires real employer-side evidence and stage honesty
- `withheld` is acceptable when the target role or transition direction is too
  weak
- interview prep does not become trust by default

## Lifecycle Assertions

The family must also preserve the stabilized schedule lifecycle:

- `Generate Schedule` creates draft proposed blocks
- `Apply` places them on-calendar for review
- `Activate` / `Commit` makes the schedule authoritative
- required active blocks are reschedulable, not casually deletable
- repeated generate/apply on the same draft must not duplicate active work

## Suggested Implementation Order

1. Extend `GoalIntakeContract.test.ts` with Employment Pipeline threshold cases.
2. Add `EmploymentPipelinePolicy.crossDomain.test.ts` for parity and
   trust-gating coverage.
3. Extend `GoalPolicy.test.ts` with lane-specific trust asymmetry checks.
4. Extend the deliverable compiler tests so job-search deliverables stay
   concrete and non-generic.
5. Extend the scheduler compatibility tests if needed to prove active job-search
   blocks remain authoritative after apply/activate.

## Review Standard

If implementation passes one employment lane by silently inflating scope, it
fails this plan.

If implementation makes the schedule look good but leaves trust provisional or
withheld, it passes policy but not the family hardening spec.

The proving question is whether the Employment Pipeline family can harden
without becoming a generic career prompt that merely happens to schedule well.
