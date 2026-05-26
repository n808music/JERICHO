# JERICHO Capability / Credential Hardening Spec

## Purpose

This spec hardens the `Capability / Credential` family under the stabilized
execution-engine contract.

Family scope:

- `SkillAcquisition`
- `ProfessionalQualification`

The goal is not to make these lanes merely schedulable. The goal is to keep them
honest, concrete, measurable, lifecycle-correct, and trustworthy under the same
contract already validated across the canonical 45.

## Family Maturity Target

Current family state: `pass`

Desired family state after hardening: `pass`

Why this family matters as a reference family:

- it is the strongest baseline for threshold-based measurability
- it separates effort from proof better than most other families
- it pressure-tests the line between practice and verified competence
- it is the cleanest reference for preserving proof artifacts through the full
  schedule lifecycle

## Canonical Lanes

### SkillAcquisition

- `Software Skill Acquisition`
- `Design Skill Acquisition`
- `Communication Skill Acquisition`
- `Technical Trade Skill Acquisition`
- `Creative Skill Acquisition`

### ProfessionalQualification

- `Certification Exam`
- `Licensure Exam`
- `Compliance Training Completion`
- `Portfolio-Based Qualification`
- `Interview-Based Qualification`

## Stabilized Contract This Family Must Obey

1. Intake honesty
2. Readiness and trust discipline
3. Plan-quality discipline
4. Output and block quality
5. Apply -> Activate lifecycle integrity
6. Measurable execution suitability for trusted live P.O.S.

## Shared Family Grammar

Capability / Credential goals are not open-ended self-improvement goals. They
are bounded competence goals where the system must preserve the user’s exact
skill, proof, or qualification boundary.

Shared grammar:

- define the target skill or credential
- establish the baseline honestly
- produce practice, proof, or assessment artifacts
- keep practice separate from proof
- keep proof separate from awarded qualification
- schedule concrete blocks
- activate the schedule only when the plan is authoritative
- trust P.O.S. only when the threshold evidence is real

## Shared Endpoint Taxonomy

This family must distinguish the following completion boundaries:

- `baseline_established`
- `study_ready`
- `practice_ready`
- `practice_complete`
- `proof_ready`
- `assessment_ready`
- `assessment_passed`
- `qualification_verified`
- `credential_awarded`
- `portfolio_accepted`
- `competence_verified`

Policy rule:

- study readiness is not proof readiness
- practice completion is not assessment pass
- proof readiness is not qualification verified
- assessment pass is not credential awarded unless the credential boundary is
  explicit
- practice artifacts are not proof artifacts unless the acceptance criteria say
  so

## Intake Sufficiency

Minimum intake required for a hardening-clean plan:

- target skill, credential, or assessment object
- target boundary or success condition
- deadline or horizon when relevant
- starting state or baseline
- assessment / evidence context when it materially changes feasibility

Blocked vs draftable rules:

- `intake_blocked` if the target skill or credential is unclear enough that the
  plan would become generic self-improvement
- `intake_blocked` if the boundary would require inventing what counts as proof
  or qualification
- `assumption_marked_draft` only when the target is known and the remaining
  assumptions can be written explicitly
- `fully_admitted` only when the boundary, baseline, and evidence target are
  clear enough to plan without silent expansion

## Required vs Recommended Scope

Required scope is the minimum work needed to satisfy the declared boundary.

Recommended scope is useful but not required unless the user explicitly commits
to it.

This family must keep the following distinction sharp:

- required: study roadmap, practice sets, proof artifacts, assessment prep,
  scheduling, readiness checks
- recommended: extra drills, supplemental practice, optional portfolio polish,
  secondary examples, broader review blocks
- optional: bonus practice, extra samples, enrichment, exploratory learning

Policy rule:

- study volume must not be promoted into proof by default
- practice artifacts must not be treated as qualification evidence too early
- optional learning work must not be treated as credential-critical

## Deliverable Grammar

Expected deliverables in this family are concrete and threshold-shaped, such as:

- study roadmap
- practice log
- proof artifact set
- exam prep pack
- readiness evaluation
- portfolio set
- submission packet
- assessment review pack
- credential checklist

Deliverables are invalid if they are only generic labels such as:

- `study work`
- `skill tasks`
- `qualification prep`
- `practice`

## Block Grammar and Measurability

Blocks in this family must be specific enough to be measured by the stability
modules.

Valid block titles:

- `Complete baseline assessment`
- `Review core concepts`
- `Run practice set 1`
- `Build proof artifact`
- `Complete remediation block`
- `Schedule assessment`
- `Submit qualification packet`
- `Run final readiness review`

Invalid or weak titles:

- `Work on skill`
- `Study more`
- `Do qualification tasks`
- `Improve readiness`

Measurable block requirement:

- every block should represent a concrete artifact, gate, or state change
- the schedule is not trusted merely because it exists
- proof blocks must remain distinguishable from practice blocks

## Starting-State Sensitivity

This family must distinguish:

- starting from no baseline
- starting from a weak baseline
- starting from some practice but no proof
- starting from proof-ready but not assessed
- starting from assessed but not yet awarded
- starting from credential-in-flight

Policy rule:

- the same lane must produce materially different plans depending on whether the
  learner has baseline evidence, practice history, proof artifacts, or an active
  assessment path
- assuming proof readiness without evidence is not allowed

## Schedule Lifecycle Compatibility

This family must remain compatible with the stabilized lifecycle:

- `Generate Schedule` creates draft proposed blocks
- `Apply` places proposed blocks on-calendar for review
- `Activate` / `Commit` makes the schedule authoritative
- active required blocks are reschedulable, not casually deletable

Post-activation policy:

- required system-created blocks must not be casually deleted
- regenerate must not behave like a random schedule reroll over an active plan
- major changes must use controlled reschedule/rebuild flow

## P.O.S. Trust Readiness

Capability / Credential is the family most likely to confuse effort with
verified competence.

Trust failure modes:

- practice volume is mistaken for real competence
- proof artifacts are mistaken for awarded qualification
- study readiness is mistaken for assessment pass
- portfolio polish is mistaken for acceptance

P.O.S. states:

- `withheld` when the target boundary or assessment object is unresolved
- `provisional` when the plan is draftable but still assumption-marked
- `trusted` only when the evidence target, baseline, and threshold are
  policy-clean

## Lane Hardening Table

| Lane                                | Current state | Primary gaps                                                                                 | Recommended next hardening action                                               |
| ----------------------------------- | ------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `Software Skill Acquisition`        | pass          | Study volume can still be mistaken for usable competence if proof artifacts are not explicit | Keep learn -> practice -> build -> demonstrate strict                           |
| `Design Skill Acquisition`          | pass          | Critique output can still be mistaken for portfolio-ready output                             | Keep drills, artifact creation, critique, and portfolio packaging distinct      |
| `Communication Skill Acquisition`   | pass          | Rehearsal can still be over-counted as performance readiness                                 | Keep draft -> rehearse -> feedback -> perform strict                            |
| `Technical Trade Skill Acquisition` | pass          | Supervised execution can still be overpromoted to independent competence                     | Keep procedure learning, guided reps, independent reps, and validation separate |
| `Creative Skill Acquisition`        | pass          | Technique drills can still hide the difference between practice and publishable output       | Keep technique -> experimentation -> refinement -> finished output explicit     |
| `Certification Exam`                | pass          | Practice exams can be misread as passing readiness                                           | Keep coverage -> practice -> remediation -> final readiness -> exam explicit    |
| `Licensure Exam`                    | pass          | Compliance docs can lag behind study readiness and still look "close enough"                 | Keep requirements, study, compliance, scheduling, and exam separate             |
| `Compliance Training Completion`    | pass          | Mandatory modules can be mistaken for full standing if verification lags                     | Keep module completion, assessment, and verification submission separate        |
| `Portfolio-Based Qualification`     | pass          | Portfolio curation can hide weak samples unless criteria alignment stays explicit            | Keep artifact creation, curation, narrative alignment, and submission distinct  |
| `Interview-Based Qualification`     | pass          | Rehearsal can be inflated into interview readiness without response-quality evidence         | Keep materials prep, rehearsal, feedback, and interview execution separate      |

## Family Success Criteria

This family is preserved as a hardened reference family when all of the
following are true:

1. The user’s skill or qualification boundary is explicit or honestly drafted
   with visible assumptions.
2. Required scope stays separate from recommended scope.
3. Practice remains distinct from proof.
4. Proof remains distinct from awarded qualification.
5. Blocks are measurable and survive calendar rendering without title drift.
6. Apply -> Activate authority remains intact.
7. Trusted P.O.S. is withheld until the evidence target supports it.

## Prioritized Hardening Order Within Family

1. `Certification Exam`
2. `Portfolio-Based Qualification`
3. `Interview-Based Qualification`
4. `Licensure Exam`
5. `Technical Trade Skill Acquisition`
