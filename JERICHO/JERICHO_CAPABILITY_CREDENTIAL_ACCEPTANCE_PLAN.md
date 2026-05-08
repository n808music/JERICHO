# JERICHO Capability / Credential Acceptance Plan

## Purpose

Turn the Capability / Credential hardening spec into a concrete acceptance
surface before implementation.

This plan covers:

- `SkillAcquisition`
- `ProfessionalQualification`

The proving question is not whether these lanes can produce schedules. The
proving question is whether they can do so honestly, concretely, and without
practice-vs-proof collapse.

## Test File Map

### Existing files to extend

- `src/domain/goal/GoalIntakeContract.test.ts`
- `src/domain/goal/GoalPolicy.test.ts`
- `src/domain/goal/GoalPolicy.crossDomain.test.ts`
- `src/domain/goal/GoalPolicy.planQuality.crossDomain.test.ts`
- `src/domain/goal/GoalPolicy.outputQuality.crossDomain.test.ts`
- `tests/state/goalToDeliverables.contract.test.ts`
- `tests/state/goalToDeliverables.actionDerivation.test.ts`
- `tests/state/goalToDeliverables.summary.test.ts`
- `tests/state/goalToDeliverables.schedulerCompatibility.test.js`
- `tests/state/mockLLMActionGraph.compileCoverage.test.ts`
- `tests/state/singlePipeline.postFix.integration.test.ts`

### New file to create

- `src/domain/goal/CapabilityCredentialPolicy.crossDomain.test.ts`

This file should hold the family-specific parity and trust-gating cases for
`SkillAcquisition` and `ProfessionalQualification`.

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

## SkillAcquisition Cases

### `Software Skill Acquisition`

Canonical goal examples:

- `Learn React well enough in 45 days to build and publish two working portfolio projects`
- `Learn a new framework well enough to ship a usable demo`
- `Improve coding skill`

Expected behaviors:

- explicit baseline + explicit proof target -> `fully_admitted`
- target known, proof boundary still ambiguous -> `assumption_marked_draft`
- vague improvement language with no measurable proof target -> `intake_blocked`
- practice blocks can be schedulable while P.O.S. remains provisional
- review / drills / build support remain required only when the boundary demands
  them
- `Improve coding skill` must not become invented mastery or hidden proof

### `Design Skill Acquisition`

Canonical goal examples:

- `Learn Figma in 30 days to create three polished mobile app mockup sets`
- `Build a design portfolio set`
- `Improve design ability`

Expected behaviors:

- explicit tool + explicit output target -> admitted or draftable depending on
  starting state
- tool known, proof boundary vague -> `assumption_marked_draft`
- no concrete output target -> `intake_blocked`
- critique and practice remain schedulable without becoming proof of readiness
- portfolio packaging becomes required only when the proof boundary demands it

### `Communication Skill Acquisition`

Canonical goal examples:

- `Improve public speaking in 21 days with daily drills and three recorded talks`
- `Prepare for a presentation`
- `Get better at communication`

Expected behaviors:

- explicit drill target + explicit performance boundary -> admitted
- boundary known, assessment criteria still vague -> draftable if assumptions
  are explicit
- vague self-improvement language -> blocked or heavily degraded
- rehearsal does not become performance evidence without the relevant proof
  state

### `Technical Trade Skill Acquisition`

Canonical goal examples:

- `Learn HVAC maintenance fundamentals in 60 days to complete five procedures independently`
- `Build trade competence`
- `Become more capable at the trade`

Expected behaviors:

- explicit procedure target + explicit independence boundary -> admitted
- baseline known, independence proof still ambiguous -> draftable
- no concrete procedure or proof target -> blocked
- guided practice does not become independent competence without verification

### `Creative Skill Acquisition`

Canonical goal examples:

- `Improve songwriting in 45 days by completing exercises and three song drafts`
- `Build a creative portfolio`
- `Improve creative skill`

Expected behaviors:

- explicit technique target + explicit output target -> admitted
- technique known, finished-output boundary vague -> draftable if assumptions
  are explicit
- vague creative growth language -> blocked or heavily degraded
- drills and drafts remain practice, not proof, until acceptance criteria say so

## ProfessionalQualification Cases

### `Certification Exam`

Canonical goal examples:

- `Pass the AWS Certified Cloud Practitioner exam by May 15`
- `Pass a certification exam`
- `Get certified`

Expected behaviors:

- clear exam target + clear readiness boundary -> `fully_admitted`
- exam target known, readiness threshold vague -> `assumption_marked_draft`
- no exam target or no threshold -> `intake_blocked`
- practice exams remain schedulable while P.O.S. stays provisional
- study coverage is not the same as passing readiness

### `Licensure Exam`

Canonical goal examples:

- `Prepare for and pass the real estate licensing exam within 90 days`
- `Get licensed`
- `Finish licensing`

Expected behaviors:

- requirements + exam boundary explicit -> admitted
- licensing path known, compliance boundary still vague -> draftable
- no licensing target -> blocked
- compliance/admin blocks remain required only when the credential boundary
  demands them
- studying is not licensure

### `Compliance Training Completion`

Canonical goal examples:

- `Complete mandatory compliance training and verification`
- `Finish training`
- `Get compliant`

Expected behaviors:

- explicit module set + verification boundary -> admitted
- module set known, verification state vague -> draftable
- no module set or no verification boundary -> blocked
- completion does not equal verified standing until the verification state is
  explicit

### `Portfolio-Based Qualification`

Canonical goal examples:

- `Get a portfolio accepted by deadline`
- `Qualify with a portfolio`
- `Show my work`

Expected behaviors:

- explicit artifact target + acceptance boundary -> admitted
- artifact known, acceptance criteria vague -> draftable
- no concrete artifact target -> blocked
- curation is not acceptance

### `Interview-Based Qualification`

Canonical goal examples:

- `Pass an interview-based qualification process`
- `Qualify through interviews`
- `Do better in interviews`

Expected behaviors:

- explicit interview boundary + explicit qualification target -> admitted
- interview target known, proof boundary still ambiguous -> draftable
- no target role or no qualification boundary -> blocked
- rehearsal does not become qualification evidence without response-quality
  evidence

## Cross-Domain Parity Cases

The same ambiguity class must map to the same readiness logic family even when
the lane wording differs.

Required parity pairs:

- baseline ambiguity in software skill acquisition and technical trade skill
  acquisition
- proof-boundary ambiguity in design skill acquisition and portfolio-based
  qualification
- assessment ambiguity in communication skill acquisition and certification exam
- independence ambiguity in technical trade skill acquisition and licensure exam
- acceptance ambiguity in creative skill acquisition and interview-based
  qualification

For each pair, the test should confirm:

- same bucket classification
- same readiness logic family
- same trust gating shape
- no special pleading by lane

## Required Scope vs Recommended Scope Assertions

The acceptance plan must include at least one case where:

- study roadmap / practice / proof prep is required
- extra drills or optional portfolio polish is recommended
- bonus practice or enrichment is optional

And at least one case where:

- a similar-looking support task becomes required because the proof boundary is
  stronger

This is the core anti-inflation check for the family.

## P.O.S. Trust Assertions

The family must prove that:

- schedulable practice can remain `provisional`
- `trusted` requires real threshold evidence, not just preparation volume
- `withheld` is acceptable when the proof boundary or baseline is too weak
- practice does not become trust by default

## Lifecycle Assertions

The family must also preserve the stabilized schedule lifecycle:

- `Generate Schedule` creates draft proposed blocks
- `Apply` places them on-calendar for review
- `Activate` / `Commit` makes the schedule authoritative
- required active blocks are reschedulable, not casually deletable
- repeated generate/apply on the same draft must not duplicate active work

## Suggested Implementation Order

1. Extend `GoalIntakeContract.test.ts` with Capability / Credential threshold
   cases.
2. Add `CapabilityCredentialPolicy.crossDomain.test.ts` for parity and
   trust-gating coverage.
3. Extend `GoalPolicy.test.ts` with lane-specific trust asymmetry checks.
4. Extend the deliverable compiler tests so practice, proof, and qualification
   deliverables stay concrete and non-generic.
5. Extend the scheduler compatibility tests if needed to prove block titles and
   proof artifacts remain distinct through apply/activate.

## Review Standard

If implementation passes one capability lane by silently inflating practice into
proof, it fails this plan.

If implementation makes the schedule look good but leaves trust provisional or
withheld, it passes policy but not the family hardening spec.

The proving question is whether the Capability / Credential family can stay a
reference family without letting practice collapse into proof or proof collapse
into qualification.
