# PLAN_TRUTH_TO_LIVE_POS_PHASE_BRIEF

## Phase Objective

This phase is about turning Jericho from a system that can generate promising
plans into a system that can present, inspect, apply, execute, and score plans
with stable truth across the canonical 45.

The governing idea is:

**Make the plan legible before making it predictive.**

That means the path should run from: **formal plan chart -> plan quality
standard -> long-horizon quality -> initial feasibility -> end-to-end runtime
integrity -> live P.O.S.**

Not the other way around.

---

## Core Doctrine

There are four rules that should govern every decision in this phase.

### 1. Visible truth before optimization

If the system cannot show the plan clearly, it cannot improve the plan reliably.

### 2. Canonical lineage before scoring

Scores must be derived from: goal -> deliverables -> actions -> blocks ->
execution evidence

### 3. Lifecycle discipline before polish

Generate, review, apply, activate, execute, reschedule, delete-cycle must remain
distinct and auditable.

### 4. Preparation is not execution

The system must reliably distinguish readiness work from substantive output
work.

---

## Stage Sequence

### Stage 1: Formal Plan Chart

#### Purpose

Create the canonical visible inspection surface for the entire planning system.

#### What it must do

The chart should expose:

- goal
- deliverables
- actions under each deliverable
- action type: preparation vs execution
- dependencies/readiness conditions
- scheduled blocks generated from those actions
- assumptions attached to those actions or blocks
- lifecycle state where relevant

#### Why it comes first

Because once the chart is correct, you can inspect:

- decomposition quality
- sequencing quality
- block-title fidelity
- readiness vs execution balance
- assumption burden
- chart/apply/render mismatches

Without this surface, all later improvements are harder to debug.

#### Main deliverables of this stage

- canonical chart schema
- canonical render surface
- deliverable -> action -> block lineage visibility
- action typing model
- block title inheritance rules
- chart truth after apply

#### Exit condition

A user can inspect a plan and understand exactly:

- what success requires
- what work is preparation
- what work is execution
- what each block actually means
- what assumptions exist
- how the plan is sequenced

---

### Stage 2: Standardized Plan Quality

#### Purpose

Turn plan review from intuition into a formal standard.

#### What this stage should define

A good plan should have:

- valid deliverables
- non-generic actions
- meaningful action titles
- preparation/execution distinction
- dependency coherence
- no orphan blocks
- no empty or misleading chart rows
- surfaced assumptions
- sufficient granularity without fragmentation

#### Quality dimensions

Explicit plan quality pillars should include:

- completeness
- specificity
- lineage integrity
- sequencing integrity
- execution readiness
- assumption honesty
- temporal realism
- readability

#### What this enables

Once standardized, the planner can be improved against a known target instead of
vague “better planning.”

#### Exit condition

A formal plan-quality rubric exists and can be applied across all 45 lanes.

---

### Stage 3: Standardized Long-Term Plan Quality

#### Purpose

Prevent long-horizon plans from collapsing into either vague abstraction or
false precision.

#### What this stage should address

Long-term goals introduce additional planning requirements:

- phase segmentation
- pacing across weeks/months
- realistic dependency spacing
- review checkpoints
- changing uncertainty over horizon
- saturation control
- phase-specific preparation vs execution ratios

#### Key idea

A 7-day goal and a 120-day goal should not be judged by identical structural
standards.

#### Main outputs

- long-horizon planning rules
- phase decomposition standard
- uncertainty marking rules
- long-range chart readability rules
- long-title handling rules where needed

#### Exit condition

A long-term plan remains legible, realistic, and inspectable across the chart
without losing structural truth.

---

### Stage 4: Initial Feasibility Score

#### Purpose

Provide an honest pre-execution forecast of schedulability and plausibility.

#### What feasibility should mean

Feasibility is not success prediction. It is the system’s estimate of whether
the goal can be reasonably scheduled and structurally supported within the
stated constraints.

#### Feasibility should be derived from

- plan completeness
- calendar capacity
- dependency structure
- time demand
- horizon length
- preparation burden
- external dependency load
- assumption burden
- pacing realism

#### Important boundary

Feasibility should remain a pre-execution score. It should not pretend to know
whether the user will actually follow through.

#### Exit condition

The system can generate an initial feasibility score with explanation grounded
in chart-visible plan structure.

---

### Stage 5: End-to-End Function

#### Purpose

Ensure the canonical plan survives actual product lifecycle transitions.

#### What must be proven here

- generation does not auto-apply
- review shows canonical proposed plan
- apply commits the right blocks
- activate initiates the right execution state
- chart remains accurate after apply
- day/week/month/chart surfaces agree
- delete-cycle removes cycle-owned artifacts correctly
- reschedules preserve lineage
- preparation/execution tagging survives through runtime

#### This stage closes defects like

- prior cycle blocks lingering after delete
- “no scheduled blocks” after blocks exist
- surfaces reading different truths
- silent lifecycle leakage

#### Exit condition

All major runtime surfaces reflect the same canonical planning and scheduling
truth.

---

### Stage 6: End-to-End Function with Live P.O.S.

#### Purpose

Update confidence dynamically based on actual execution evidence.

#### What live P.O.S. should mean

Given:

- the canonical accepted goal
- the canonical plan
- the applied schedule
- execution evidence
- integrity over time

what is the current probability of successful completion?

#### What live P.O.S. depends on

- stable feasibility baseline
- stable plan lineage
- reliable block completion evidence
- truthful reschedule semantics
- preparation vs execution weighting
- trusted evidence thresholds

#### Important distinction

Feasibility asks: “Can this plan fit and make sense initially?”

P.O.S. asks: “Given what is now actually happening, how likely is success?”

#### Expected output states

- trusted
- provisional
- withheld

#### Exit condition

The live P.O.S. score updates honestly from execution evidence without becoming
detached from canonical plan truth.

---

### Stage 7: UI/UX Tightening

#### Purpose

Make the system easier to read and trust without distorting the underlying
model.

#### What this should refine

- chart layout clarity
- long block title presentation
- hierarchy between deliverables/actions/blocks
- assumption visibility
- feasibility explanation readability
- P.O.S. explanation readability
- state clarity across generate/review/apply/activate
- reduced ambiguity between plan, action, and execution

#### Important constraint

No UI change should invent meaning that the model does not already contain
canonically.

#### Exit condition

The system is not only structurally correct, but operationally clear.

---

## Workstreams

### Workstream A: Planning truth surface

This workstream owns:

- formal plan chart
- lineage visibility
- action typing
- title fidelity
- assumption display

This should start first.

### Workstream B: Planning standards

This workstream owns:

- standardized plan quality
- standardized long-term plan quality
- lane-agnostic planning rules
- acceptance criteria across the canonical 45

This should begin immediately after the chart schema is stable.

### Workstream C: Scoring

This workstream owns:

- initial feasibility
- score explanation model
- live P.O.S. inputs
- trust gating logic

This should only become active after Workstreams A and B are stable enough.

### Workstream D: Runtime integrity

This workstream owns:

- generate/review/apply/activate discipline
- delete-cycle correctness
- chart/apply/render consistency
- cross-surface truth integrity

This must run in parallel with scoring preparation because scoring depends on
it.

### Workstream E: UX tightening

This workstream owns:

- readability
- density control
- long title handling
- score presentation
- semantic clarity

This comes last.

---

## Phase Gates

### Gate 1: Formal Plan Chart Gate

Pass criteria:

- chart is canonical
- every block maps to an action
- every action maps to a deliverable
- preparation vs execution is visible
- chart stays correct after apply

### Gate 2: Standardized Plan Quality Gate

Pass criteria:

- formal quality rubric exists
- plans can be audited against it
- major decomposition defects are visible and classifiable

### Gate 3: Standardized Long-Term Plan Quality Gate

Pass criteria:

- long-horizon plans obey phase, pacing, and uncertainty rules
- chart remains readable for longer goals

### Gate 4: Initial Feasibility Gate

Pass criteria:

- feasibility is generated from canonical inputs
- explanation is tied to visible plan/chart truth
- no execution evidence is improperly baked in

### Gate 5: End-to-End Function Gate

Pass criteria:

- lifecycle states remain distinct
- cross-surface truth is stable
- delete-cycle and apply semantics are reliable

### Gate 6: Live P.O.S. Gate

Pass criteria:

- execution evidence updates score
- trusted/provisional/withheld states behave honestly
- score reflects real behavior rather than static plan optimism

### Gate 7: UX Tightening Gate

Pass criteria:

- clarity improves without weakening truth discipline
- core inspection and trust tasks become easier

---

## Dependencies

The phase will progress smoothly only if these dependencies are respected.

### Dependency 1

Formal plan chart must precede plan-quality refinement.

### Dependency 2

Plan-quality standard must precede feasibility.

### Dependency 3

Lifecycle integrity must precede live P.O.S.

### Dependency 4

Canonical model stability must precede UI polishing.

If these are violated, you will keep getting local improvements that do not hold
together.

---

## Failure Modes

These are the main traps to avoid.

### 1. Decorative chart instead of canonical chart

If the chart is just a visual summary, it will not solve the real problem.

### 2. Scoring before structural truth

If feasibility or P.O.S. arrives before lineage and lifecycle are hardened, the
score will feel arbitrary.

### 3. Treating preparation as progress equal to execution

This will distort both user trust and probability logic.

### 4. Long-horizon quality treated as just “more blocks”

Long-term planning needs separate doctrine, not just extended duration.

### 5. UX tightening that masks structural defects

Readable wrongness is still wrongness.

---

## Implementation Order

The development posture for this phase should be:

- chart-first
- standards-second
- scoring-third
- runtime proof-fourth
- live trust layer fifth
- polish last

### Phase development spine

1. Formal Plan Chart
2. Standardized Plan Quality
3. Standardized Long-Term Plan Quality
4. Initial Feasibility Score
5. End-to-End Function
6. End-to-End Function with Live P.O.S.
7. UI/UX Tightening

### One-sentence framing for the whole phase

**This phase is about making Jericho’s plan truth visible, auditable,
schedulable, executable, and finally scoreable in a way that holds across the
canonical 45.**
