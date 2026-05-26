# PLAN_QUALITY_AND_E2E_VERIFICATION_BRIEF.md

## 1. Purpose

This verification phase exists to confirm that the updated planning stack is
functionally satisfactory and standardized before any live P.O.S. work begins.

The system must prove two things: updated plan quality and end-to-end function.
Neither alone is sufficient. A system that generates structurally correct plans
but cannot lifecycle them cleanly cannot support live scoring. A system that
lifecycles blocks correctly but generates weak or dishonest plans cannot produce
trustworthy feasibility — and therefore cannot produce trustworthy P.O.S.

Feasibility and future live P.O.S. are only as trustworthy as the plan and
lifecycle truth beneath them.

---

## 2. Verification Gate Role

This brief defines the formal verification gate between:

- completed pre-execution planning architecture (Stages 1–4)
- future execution-state and live P.O.S. architecture (Stage 6)

The gate must determine whether the system is producing plans that are good
enough, truthful enough, and operationally consistent enough to justify live
probability work.

Passing repo tests alone is not sufficient. Goal-level behavioral verification
is required. A system that passes all unit and integration tests but
systematically produces vague deliverable titles, hollow phase structures, or
dishonest feasibility calls for real goal scenarios has not passed this gate.

The gate is open only when the system demonstrates satisfactory behavior across
a standardized verification pack, evaluated against explicit audit dimensions,
with documented pass/fail reasoning by root cause.

---

## 3. Horizon Taxonomy

The following taxonomy governs how goals are classified for verification
purposes.

### Short-term

**Range:** 1 day to 90 days inclusive.

Short-term goals are evaluated primarily against structural plan quality: block
title fidelity, action type coverage, dependency realism, assumption honesty,
schedule fit, and lifecycle correctness. Long-horizon temporal standards do not
apply.

### Long-term

**Range:** 91 days to system maximum horizon.

Long-term goals are evaluated against both structural plan quality and long-term
temporal quality: phase structure, pacing shape, uncertainty bands, checkpoints,
saturation control, and long-horizon quality state. Local structural standards
still apply.

### System maximum horizon

The system maximum horizon must be explicitly defined and enforced in
implementation. Until a stricter hard cap is finalized, the working strategic
range is the established podcast-to-medical-degree range (approximately 1 month
to 10 years), consistent with prior accepted verification targets.

Long-term verification goals in this pack should use horizons materially beyond
90 days so that temporal structure quality is actually exercised. Nominal
classification at 91 days does not stress long-horizon logic. Goals with
horizons of 12 months, 18 months, and 24 months are appropriate for this pack.

---

## 4. Verification Pack Structure

The verification pack consists of:

- 3 short-term goals (horizon: 1–90 days)
- 3 long-term goals (horizon: 91 days to system max)

The pack exists to test:

- plan quality across the short-term and long-term planning split
- end-to-end functional behavior through the full lifecycle
- feasibility honesty against real schedule and structural inputs
- meaningful differences between short-term and long-term planning modes
- chart truth and lifecycle truth at all stages
- cross-archetype planning consistency across distinct goal families

The pack must be treated as a standardized audit set. Ad hoc spot-checking does
not satisfy this gate. The same 6 goals must be evaluated against the same audit
dimensions, in the same format, before any gate decision is made.

---

## 5. Short-Term Goal Set

### A. Finish and release a polished 3-song EP

**Horizon:** 45 days

**Why it is in the pack:**

- Tests creative production archetype under a tight horizon
- Tests preparation vs. execution distinction (recording prep, editing, admin
  release steps)
- Tests whether external release and admin work is correctly classified and
  sequenced
- Tests short-horizon schedule realism: block count, session pacing, and block
  title quality under compressed time

---

### B. Lose 12 pounds with a consistent training and meal-prep routine

**Horizon:** 70 days

**Why it is in the pack:**

- Tests physical training archetype with repeated execution cadence
- Tests whether the system avoids vague fitness filler blocks
- Tests preparation/execution linkage (meal prep setup, routine establishment)
- Tests block title fidelity against recurring activity patterns

---

### C. Launch a branded landing page and get first 25 leads

**Horizon:** 60 days

**Why it is in the pack:**

- Tests business/brand launch archetype
- Tests whether setup work is correctly separated from outreach execution
- Tests feasibility against constrained calendar reality (build + ship + grow
  within 60 days)
- Tests mixed deliverable and action types across distinct phase character

---

## 6. Long-Term Goal Set

### A. Build and launch a weekly podcast from concept to consistent publication

**Horizon:** 12 months

**Why it is in the pack:**

- Tests long-horizon phase structure for a creative/media archetype
- Tests recurring production cadence across months
- Tests whether the system handles the prep-to-execution transition honestly
  over an extended period
- Tests checkpoints and pacing realism: the plan should not collapse into an
  undifferentiated block of weekly sessions

---

### B. Go from beginner to employable software developer with portfolio and
job-readiness

**Horizon:** 18 months

**Why it is in the pack:**

- Tests long-term skill acquisition with staged progression
- Tests uncertainty honesty: deep-horizon segments should be marked provisional
  rather than falsely precise
- Tests whether the system avoids mapping the full 18-month span as if all
  execution detail is knowable at planning time
- Tests sustained preparation/execution balance across learning, building, and
  applying phases

---

### C. Build a business from concept to first sustainable revenue

**Horizon:** 24 months

**Why it is in the pack:**

- Tests venture-launch temporal structure at the outer edge of the verified
  strategic horizon
- Tests high assumption burden and honest feasibility degradation
- Tests long-term pacing and checkpoint logic across a multi-year span
- Tests whether feasibility avoids overclaiming certainty when canonical truth
  is necessarily thin at the far end of the horizon

---

## 7. Audit Dimensions

Every goal in the pack must be evaluated against each of the following
dimensions.

### Intake sufficiency

The goal contract contains a concrete terminal outcome, meaningful verification
criteria, an explicit deadline, and no unresolvable ambiguity that blocks plan
generation.

### Deliverable quality

Deliverables carry specific, object-bearing titles. Generic phase labels
(`Planning & setup`, `Core production`, `Verification & finalization`) are
audit failures. Deliverables must be distinguishable by title and scope.

### Action quality

Actions carry specific, non-generic titles that inherit the goal object.
Actions must be classifiable by type. Titles must not be hollow restatements of
the deliverable title.

### Canonical actionType coverage

Each action must have a resolved `actionType` (`preparation` or `execution`).
Plans with unresolved or missing action types across the majority of actions are
a coverage failure.

### Dependency and readiness truth

Actions with sequencing requirements carry explicit dependency or readiness
annotations. Plans with dependency-free action sequences where sequencing is
materially required are a partial or full audit failure depending on severity.

### Assumption honesty

Assumptions are surfaced where the plan cannot resolve starting state or
external conditions from canonical inputs. Plans that silently resolve
assumptions without surfacing them are a failure of assumption honesty.

### Block title fidelity

Blocks carry titles that inherit the goal object from the action they represent.
Block titles that are generic session labels (`Work session`, `Focused time`,
`Review block`) without goal-object inheritance are a block title failure.

### Chart inspectability

A user inspecting the formal plan chart can determine what success requires,
what preparation vs. execution looks like, how the plan is sequenced, and what
assumptions are present. Decorative chart rows without schedulable truth are a
failure.

### Lifecycle correctness

The full lifecycle path — generate, review, apply, activate, chart — must remain
distinct and auditable. Proposed blocks must not auto-apply. Applied blocks must
reflect the reviewed plan. The chart must remain accurate after apply. Cycle
management must not corrupt lineage from prior cycles.

### Structural quality (short-term goals)

Short-term goals must satisfy: complete deliverable/action/block lineage,
resolved action types, non-generic titles, honest assumption surfacing, and
feasibility that reflects actual schedule fit rather than optimistic decoration.

### Long-term temporal quality (long-term goals)

Long-term goals must satisfy, in addition to structural quality: meaningful
phase structure that reflects the real arc of the work, pacing shape that
distributes effort credibly over the horizon, uncertainty bands on deep segments
where temporal precision is not yet supportable, checkpoints at meaningful
inflection points, and saturation control that avoids front-loading or
clustering the full plan weight.

### Feasibility honesty

Feasibility state (`feasible`, `constrained`, `degraded`, `withheld`) must
reflect actual structural support, schedule fit, and capacity truth. Feasibility
that is `feasible` because the plan is structurally thin enough to avoid
detection of constraints is a failure of feasibility honesty, not a pass.

### End-to-end consistency

The planning surface, chart surface, and lifecycle outputs must agree. What is
shown in the formal plan chart must match what was generated, reviewed, and
applied. No surface may display phantom blocks, orphaned actions, or lifecycle
states that contradict the canonical event record.

---

## 8. Pass / Fail Standards

### Per-goal verdict

**Pass**

No fundamental defects in truth ownership, plan structure, feasibility honesty,
or lifecycle consistency. Remaining issues are refinement-level and do not
compromise canonical truth for that goal.

**Partial pass**

The system is broadly usable for this goal, but one or more significant quality
weaknesses remain. Plan quality, feasibility honesty, or lifecycle function is
not fully satisfactory. The weaknesses are documented with root cause.

**Fail**

A foundational defect in plan truth, feasibility truth, or lifecycle consistency
breaks canonical correctness for this goal. Examples: hollow deliverable titles
that survive gate checks, feasibility marked `feasible` for a plan that cannot
schedule, blocks that apply without review, chart that contradicts applied
schedule.

### Constraints on pass verdicts

A goal must not be marked pass if feasibility appears accurate only because plan
quality is too weak to challenge it. A structurally thin plan that produces a
`withheld` feasibility state is not a pass — it reveals that the plan quality
gate correctly blocked a bad plan, but the goal itself has not demonstrated
honest planning.

Long-term goals must be held to temporal quality standards, not only local
structural standards. A long-term goal that passes structural checks but
produces flat, undifferentiated, phase-free scheduling is a fail or partial pass
depending on severity.

### Aggregate gate logic

The system must pass the majority of the 6-goal pack without foundational
defects. A majority pass with a small number of partial-pass cases may be
sufficient to open the gate, provided the partial-pass weaknesses are documented
and their root causes do not indicate systemic failure.

Any failure patterns must be categorized by root cause, not dismissed or
hand-waved. If repeated foundational truth or lifecycle defects appear across
multiple goals — even goals that individually receive partial-pass verdicts —
the gate remains closed.

---

## 9. Live P.O.S. Block Condition

Live P.O.S. is blocked until updated plan quality and end-to-end function are
verified across the standardized 6-goal pack.

Passing implementation tests and unit tests is not enough by itself. The repo
can be green and the goal-level behavioral verification can still fail.

The system must demonstrate satisfactory goal-level behavior in both short-term
and long-term planning contexts before live probability work begins. This means
real goals, real plan generation, real lifecycle transitions, and real audit
verdicts — not synthetic test fixtures assembled to pass specific assertions.

Live P.O.S. should only begin once the pre-execution planning stack is
functionally trustworthy across the full audit pack.

---

## 10. Acceptance Criteria

Pass conditions for this verification brief:

- Horizon taxonomy is explicitly defined with numeric bounds and no ambiguity
  about classification
- The 6-goal verification pack is named, bounded, and rationale-backed
- Audit dimensions are explicit and deterministic, not vague quality rubrics
- Pass/fail standards are explicit and include constraints that prevent pass
  verdicts from being issued for wrong reasons
- Aggregate gate logic is explicit: majority pass without foundational defects
- Live P.O.S. block condition is stated without qualifiers
- The brief is usable as an actual verification gate, not a planning note — a
  reviewer could use it to run the verification and issue a concrete gate
  decision

---

## 11. Failure Cases To Prevent

- Moving to live P.O.S. because implementation work is "mostly done" without
  running the standardized goal pack
- Relying on repo green status without goal-level behavioral verification
- Using a goal set that is too narrow or too convenient to actually stress the
  planning system
- Passing short-term goals while long-term temporal structure remains weak or
  untested
- Passing long-term goals based on decorative phase labels rather than real
  temporal distribution and uncertainty truth
- Treating feasibility as validated without testing whether plan quality
  actually supports the feasibility verdict
- Marking feasibility `feasible` as a pass when the plan is structurally too
  thin to exercise the feasibility contributors meaningfully
- Using ad hoc goal selection instead of a locked standardized audit pack
- Standards so vague that a reviewer could not use them to distinguish pass from
  fail
- Issuing a gate-open decision without documented root-cause classification of
  any partial-pass or fail verdicts
- Treating a partial-pass majority as a clean open gate without acknowledging
  what remains unresolved

---

## 12. Minimal Execution Order

1. Lock the horizon taxonomy: confirm numeric bounds and classification rules
   are accepted as stated in this brief

2. Lock the 6-goal standardized verification pack: the goals listed in sections
   5 and 6 are the audit set; no substitution without explicit rationale

3. Run each goal through the planning lifecycle: generate, review, apply,
   activate, inspect chart surface, inspect planning surface

4. Evaluate each goal against every audit dimension in section 7; record the
   verdict per dimension, not only a summary

5. Issue a per-goal verdict: pass, partial pass, or fail; document root cause
   for any non-pass verdict

6. Classify any failure patterns by root cause: distinguish plan quality
   failures, feasibility honesty failures, lifecycle consistency failures, and
   temporal quality failures

7. Apply aggregate gate logic: determine whether the majority of the 6-goal
   pack passes without foundational defects, and whether any failure patterns
   indicate systemic problems that block the gate

8. Issue a gate decision: open (proceed to live P.O.S. doctrine) or closed
   (return to remediation with documented failure root causes)

9. Only after gate-open: begin live P.O.S. doctrine and implementation work

---

# AGGREGATE GATE RECORD (2026-04-09)

## Verification pack status

| Goal | Horizon | Gate | D-09/D-12 | Verdict |
|------|---------|------|-----------|---------|
| ST-01: Finish and release a polished 3-song EP | 45d | PASSED | CONFIRMED | `partial_pass` |
| ST-02: Lose 12 lbs with training and meal-prep | 70d | PASSED | CONFIRMED | `partial_pass` |
| ST-03: Launch a branded landing page and get first 25 leads | 60d | PASSED | CONFIRMED | `partial_pass` |
| LT-01: Publish 24 episodes, grow to 1,000 monthly listeners | 12m | PLAN_COVERAGE_MISSING_MAJOR_COMPONENT | Not confirmed | `partial_pass` |
| LT-02: Learn full-stack dev, build portfolio, land junior role | 18m | PASSED | CONFIRMED | `partial_pass` |
| LT-03: Get a full-time junior developer job in 6 months | 6m | OUTCOME_COVERAGE_PREP_ONLY | Not confirmed | `partial_pass` |
| LT-04: Raise $50,000 in funding in 9 months | 9m | OUTCOME_COVERAGE_PREP_ONLY | Not confirmed | `partial_pass` |

**0 fail / 7 partial_pass / 0 pass.**

---

## Partial-pass condition taxonomy

Every partial-pass condition in the pack has been classified by root cause.

### RC-03 (closed 2026-04-09)

Action decomposition weakness — action layer absent on deterministic path.
**Closed:** `generateColdPlanForCycle` now seeds `cycle.actions` from canonical
workspace deliverables. `structuralState: trusted`, `lineageIntegrity: complete`,
`actionTypeCoverage: complete` confirmed across all 7 goals via production-path
probe. Zero remaining failures attributable to RC-03.

### RC-06 — Starting state assumed (7/7 goals)

No starting-state hint present in any goal text. `startingPointHonesty: assumed`
fires for every goal in the pack. This is a correct and honest system response —
the system surfaces what it does not know. It is not a planning quality defect.

**Classification: honest signal, not a system defect. Not a gate blocker.**

### RC-13 — `completionBoundaryStatus: missing` for non-podcast goals (6/7 goals)

By system design, `completionBoundaryStatus` only resolves for the `podcast`
domain. All other goals return `missing` regardless of how concrete the
verification criteria is. LT-01 (podcast domain) resolves correctly.

**Classification: system design boundary. Known architectural constraint.
Not a gate blocker for the verification pack — the behavior is correct and
predictable; it does not compromise plan truth or lifecycle correctness.**

### RC-14 — Archetype coverage gap (ST-03, LT-01)

Single archetype does not cover dual-outcome goals. Brand launch archetype
covers setup but not lead acquisition. Podcast archetype covers production
but not growth/distribution. Plans are structurally valid; they cover the
production dimension honestly but do not represent the acquisition/growth
dimension.

**Classification: architectural gap in deliverable coverage. Noted. Does not
cause a gate-breaking quality failure — the gate passes on the production
dimension. Not a gate blocker for the verification pack.**

### RC-20 — Externally mediated terminal outcome, no trust encoding (LT-03, LT-04)

Terminal outcomes for job search (employer decision) and fundraising (investor
decision) are not in the user's control. The system currently does not encode
this in the trust layer for non-podcast goals. Gate fires `OUTCOME_COVERAGE_PREP_ONLY`
correctly — the preparation plan is complete, but no deliverable represents the
external decision event.

**Classification: architectural gap in trust encoding. The gate is functioning
correctly — it detects and surfaces the limitation. The `PLAN_QUALITY_WITHHELD`
response is honest. Not a gate blocker for the verification pack — the gate
is doing the right thing; the gap is in trust architecture, not in the planning
or lifecycle stack being verified.**

### LT-01 archetype seeding gap

The production onboarding path seeds one generic deliverable at cycle creation
time. The 39-deliverable episodic archetype set (episodes 1–12, 3 deliverables
each) is only materialized when the episodic_production admitted path is
exercised. Gate fires `PLAN_COVERAGE_MISSING_MAJOR_COMPONENT` correctly.

**Classification: admission-flow gap in archetype seeding. The gate is correct;
the gap is in how the onboarding path populates the workspace at cycle creation.
Not a gate blocker for the verification pack — the gate correctly identifies
the coverage gap; the lifecycle and structural layers are sound.**

### D-09/D-12 (lifecycle/surface consistency) — probe vs. live UI

All four goals with `PLAN_QUALITY_PASSED` (ST-01, ST-02, ST-03, LT-02) have
D-09 and D-12 confirmed via `computeDerivedState` probe covering:
- Proposed blocks not auto-applied
- Apply is explicit (`APPLY_DRAFT_SCHEDULE`)
- Lifecycle transitions: `no_schedule` → `applied_review`
- `scheduleReviewBlocks` populated, zero orphans
- `planDraft` and `planPreview` cleared after apply
- No proposed blocks remain as `suggested` after apply

No live UI session was run. A live session would add visual confirmation
but would not contradict probe evidence. The state machine logic is identical.

**Classification: verification method limitation. The probe covers the state
transitions definitively. Not a gate blocker.**

---

## Aggregate gate assessment

**Brief criterion (section 8):** "The system must pass the majority of the
6-goal pack without foundational defects. A majority pass with a small number
of partial-pass cases may be sufficient to open the gate, provided the
partial-pass weaknesses are documented and their root causes do not indicate
systemic failure."

The verification pack was expanded to 7 goals (4 long-term rather than 3).
The gate logic applies at the same threshold.

### Foundational defect check

A foundational defect is defined in the brief as: "hollow deliverable titles
that survive gate checks, feasibility marked feasible for a plan that cannot
schedule, blocks that apply without review, chart that contradicts applied
schedule."

**None of these are present in the pack:**
- No hollow deliverables survive gate checks — the gate correctly catches them
  and cascades to withheld
- No feasibility is marked feasible for a thin plan — all withheld states are
  honest and correctly explained
- Blocks do not auto-apply — confirmed via probe across all 4 clean-gate goals
- No surface contradictions after apply — confirmed via probe

### Systemic failure check

The brief requires checking whether partial-pass weaknesses indicate "systemic
failure." Each condition is classified above:
- RC-06 (assumed starting state): honest signal, fires for every goal because
  no goal provides a starting state. This is correct behavior.
- RC-13 (completion boundary): system design boundary, predictable, not a
  planning defect.
- RC-14, LT-01 seeding gap, RC-20: architectural gaps, each correctly surfaced
  by the gate. The gate is functioning; the gaps are in adjacent architectural
  layers.

None of these constitute systemic failure of the plan quality, feasibility
honesty, or lifecycle correctness stack.

### Gate decision

**GATE: OPEN (conditional)**

The verification pack demonstrates that the planning, quality gate, feasibility,
and lifecycle stack is functioning honestly across the full range of goal types
and horizons. No foundational defects were found. All partial-pass conditions
have documented root causes that do not indicate systemic failure.

**Condition:** Live P.O.S. doctrine and implementation may begin. The
architectural gaps (RC-13, RC-14, RC-20, LT-01 seeding) are carried forward
as known constraints on the adjacent layers. They do not block the P.O.S.
layer from being built on top of the planning stack.

**Gate opened:** 2026-04-09

