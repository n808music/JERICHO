# JERICHO Physical Progression Hardening Spec

## Purpose

This spec hardens the `Physical Progression` family under the stabilized
execution-engine contract.

Family scope:

- `PhysicalTraining`

The goal is not to make these lanes merely schedulable. The goal is to keep them
honest, concrete, measurable, lifecycle-correct, and trustworthy under the same
contract already validated across the canonical 45.

## Family Maturity Target

Current family state: `pass`

Desired family state after hardening: `pass`

Why this family matters as a reference family:

- it is the cleanest reference for threshold-based progression
- it separates effort from adaptation proof better than most other families
- it pressure-tests the line between training volume and actual readiness
- it is the strongest reference for preserving recovery, pacing, and benchmark
  evidence through the full schedule lifecycle

## Canonical Lanes

### PhysicalTraining

- `Strength Program`
- `Endurance Performance`
- `Weight Loss / Body Composition`
- `Rehab Return to Training`
- `General Conditioning`

## Stabilized Contract This Family Must Obey

1. Intake honesty
2. Readiness and trust discipline
3. Plan-quality discipline
4. Output and block quality
5. Apply -> Activate lifecycle integrity
6. Measurable execution suitability for trusted live P.O.S.

## Shared Family Grammar

Physical Progression goals are not generic fitness goals. They are bounded
progression goals where the system must preserve the user’s exact training,
recovery, benchmark, or readiness boundary.

Shared grammar:

- define the training target or performance boundary
- establish baseline honestly
- produce concrete training, recovery, and benchmark artifacts
- keep practice separate from readiness
- keep readiness separate from target performance achieved
- schedule measurable training blocks
- activate the schedule only when the plan is authoritative
- trust P.O.S. only when proof-state evidence is real

## Shared Endpoint Taxonomy

This family must distinguish the following completion boundaries:

- `training_started`
- `training_consistent`
- `baseline_established`
- `benchmark_ready`
- `event_ready`
- `target_performance_achieved`
- `completed_event`
- `completed_program`
- `recovery_stable`
- `load_tolerant`

Policy rule:

- baseline is not readiness
- scheduled training is not adaptation proof
- completed sessions are not target performance achieved
- recovery structure is not optional polish
- plan intensity is not automatically feasible
- proximity to deadline is not evidence of preparedness

## Intake Sufficiency

Minimum intake required for a hardening-clean plan:

- target training or performance object
- target boundary or success condition
- deadline or horizon when relevant
- starting state or baseline
- recovery / injury / load context when it materially changes feasibility
- benchmark or proof context when it materially changes readiness

Blocked vs draftable rules:

- `intake_blocked` if the target training boundary is unclear enough that the
  plan would become generic fitness advice
- `intake_blocked` if the boundary would require inventing what counts as proof
  of readiness or performance
- `assumption_marked_draft` only when the target is known and the remaining
  assumptions can be written explicitly
- `fully_admitted` only when the boundary, baseline, and proof target are clear
  enough to plan without silent expansion

## Required vs Recommended Scope

Required scope is the minimum work needed to satisfy the declared boundary.

Recommended scope is useful but not required unless the user explicitly commits
to it.

This family must keep the following distinction sharp:

- required: baseline assessment, core training blocks, recovery blocks,
  benchmark checks, pacing checks, scheduling, readiness review
- recommended: accessory work, mobility extras, nutrition extras, advanced
  testing, optional cross-training, secondary tracking rituals
- optional: bonus sessions, supplemental drills, exploratory conditioning, extra
  tracking rituals

Policy rule:

- accessory work must not be promoted into proof by default
- completed training volume must not be treated as performance evidence too soon
- optional support work must not be treated as target-critical

## Deliverable Grammar

Expected deliverables in this family are concrete and threshold-shaped, such as:

- baseline benchmark
- training block
- recovery block
- deload week
- threshold session
- time trial
- readiness review
- pacing plan
- progression checkpoint
- event taper

Deliverables are invalid if they are only generic labels such as:

- `fitness work`
- `training tasks`
- `get in shape`
- `work out more`

## Block Grammar and Measurability

Blocks in this family must be specific enough to be measured by the stability
modules.

Valid block titles:

- `Establish baseline benchmark`
- `Complete week 1 endurance block`
- `Run threshold session 1`
- `Schedule deload week`
- `Perform recovery review`
- `Run benchmark time trial`
- `Complete taper week`

Invalid or weak titles:

- `Improve fitness`
- `Train more`
- `Do workout tasks`
- `Get stronger`

Measurable block requirement:

- every block should represent a concrete artifact, gate, or state change
- the schedule is not trusted merely because it exists
- recovery blocks must remain distinguishable from performance blocks

## Starting-State Sensitivity

This family must distinguish:

- starting from no baseline
- starting from weak baseline
- starting from some consistency but no benchmark
- starting from benchmark-ready but not event-ready
- starting from event-ready but not yet completed
- starting from injured, returning, or load-constrained

Policy rule:

- the same physical lane must produce materially different plans depending on
  whether the user has baseline evidence, recovery constraints, benchmark data,
  or event readiness
- assuming readiness without evidence is not allowed

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

Physical Progression is a family where trust can rise when proof evidence is
real, but it must never inflate just because training is scheduled.

Trust failure modes:

- schedule exists but benchmark readiness is still unproven
- recovery structure is missing or too weak for the load
- training density looks productive but feasibility is doubtful
- target performance is mistaken for completed adaptation

Trust rules:

- `trusted` only when baseline, recovery, and proof-state evidence are all
  coherent
- `provisional` when the plan is schedulable but benchmark or load evidence is
  still thin
- `withheld` when the boundary or feasibility depends on unresolved recovery or
  performance evidence

## Family Hardening Gaps

Current gaps to watch for:

1. vague fitness language that does not preserve benchmark or recovery truth
2. completed session counts that are mistaken for adaptation proof
3. overpacked schedules that ignore recovery and load tolerance
4. training volume that is treated as readiness without benchmark evidence
5. target performance language that hides an assumed baseline

Recommended next action:

- pressure-test the family acceptance plan against the baseline/proof and
  recovery/load distinctions before any grammar hardening
