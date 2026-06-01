# PLAN_QUALITY_AND_E2E_VERIFICATION_RUNBOOK.md

## 1. Purpose

This runbook operationalizes the verification brief
(`PLAN_QUALITY_AND_E2E_VERIFICATION_BRIEF.md`) into a repeatable goal-by-goal
audit process.

The runbook exists to determine whether the system is functionally satisfactory
and standardized enough to open the gate to live P.O.S. work. It does not
introduce new doctrine. Every rule in this document is derived from the locked
verification brief and the source doctrine listed above.

This artifact is for execution discipline, not new doctrine.

---

## 2. Verification Scope

This runbook covers the standardized 6-goal verification pack only.

Each goal must be run through the same audit process with the same audit
dimensions and the same evidence recording rules. Variation in procedure across
goals invalidates the audit.

The runbook must capture both updated plan quality and end-to-end functional
behavior for each goal. A goal that passes plan quality checks but fails
lifecycle checks is not a pass. A goal that passes lifecycle checks but produces
structurally weak or dishonest plans is not a pass.

Repo green status alone is insufficient and must not substitute for this
runbook. A system can pass all implementation tests and still fail goal-level
behavioral verification.

---

## 3. Locked Horizon Taxonomy

The following taxonomy applies to this runbook and must not be modified without
a formal brief update.

**`short_term`:** 1 day to 90 days inclusive.

Short-term goals are evaluated primarily against structural plan quality: block
title fidelity, action type coverage, dependency realism, assumption honesty,
schedule fit, and lifecycle correctness.

**`long_term`:** 91 days to system maximum horizon.

Long-term goals are evaluated against both structural plan quality and long-term
temporal quality: phase structure, pacing shape, uncertainty bands, checkpoints,
saturation control, and long-horizon quality state.

**Constraints on this taxonomy:**

- Long-term verification goals in this pack must materially exceed 90 days so
  that temporal structure logic is actually exercised. Goals classified
  `long_term` at exactly 91 days do not stress long-horizon behavior.
- The system maximum horizon must remain explicitly defined in implementation
  even if this runbook does not set the final hard cap. Until finalized, the
  working strategic range is the established podcast-to-medical-degree range.

---

## 4. Locked Verification Pack

The following 6 goals are the locked audit subjects for this runbook. No
substitution is permitted without a formal brief update.

---

**ST-01**
- **Goal title:** Finish and release a polished 3-song EP
- **Horizon:** 45 days
- **Horizon class:** `short_term`
- **Why it is in the pack:**
  - creative production archetype under tight horizon
  - tests prep vs. execution distinction
  - tests external release and admin work classification
  - tests short-horizon schedule realism and block title quality

---

**ST-02**
- **Goal title:** Lose 12 pounds with a consistent training and meal-prep routine
- **Horizon:** 70 days
- **Horizon class:** `short_term`
- **Why it is in the pack:**
  - repeated execution cadence across physical training archetype
  - tests prep/execution linkage
  - tests resistance to vague filler blocks
  - tests block title fidelity under recurring activity patterns

---

**ST-03**
- **Goal title:** Launch a branded landing page and get first 25 leads
- **Horizon:** 60 days
- **Horizon class:** `short_term`
- **Why it is in the pack:**
  - business/brand launch archetype
  - tests setup vs. outreach execution separation
  - tests feasibility against constrained calendar reality
  - tests mixed deliverable and action types

---

**LT-01**
- **Goal title:** Build and launch a weekly podcast from concept to consistent publication
- **Horizon:** 12 months
- **Horizon class:** `long_term`
- **Why it is in the pack:**
  - long-horizon phase structure for creative/media archetype
  - tests recurring production cadence across months
  - tests prep-to-execution transition over time
  - tests checkpoint and pacing realism at one-year scale

---

**LT-02**
- **Goal title:** Go from beginner to employable software developer with portfolio and job-readiness
- **Horizon:** 18 months
- **Horizon class:** `long_term`
- **Why it is in the pack:**
  - long-term skill acquisition with staged progression
  - tests uncertainty honesty at deep horizon
  - tests false-precision resistance
  - tests sustained prep/execution balance across learning, building, applying phases

---

**LT-03**
- **Goal title:** Build a business from concept to first sustainable revenue
- **Horizon:** 24 months
- **Horizon class:** `long_term`
- **Why it is in the pack:**
  - venture-launch temporal structure at outer edge of verified horizon
  - tests high assumption burden and honest feasibility degradation
  - tests long-term pacing and checkpoint logic across multi-year span
  - tests feasibility honesty under deep uncertainty

---

## 5. Standard Audit Procedure

The following procedure must be followed for every goal in the pack. No steps
may be skipped. The same procedure must be used for all 6 goals.

1. **Create or load the goal.** Enter the goal contract using the standard
   intake path. Confirm goal text, verification criteria, and deadline are
   correctly captured before proceeding.

2. **Confirm accepted horizon classification.** Verify the horizon falls within
   the locked taxonomy. Record the horizon class (`short_term` or `long_term`)
   for the audit record.

3. **Inspect intake sufficiency.** Before generating the plan, evaluate whether
   the goal contract is complete: terminal outcome, verification criteria,
   deadline, and absence of blocking ambiguity.

4. **Generate the plan.** Run plan generation. Do not apply the plan yet.

5. **Inspect the formal plan chart before apply.** Evaluate the chart at
   proposed state: deliverable quality, action quality, action type coverage,
   dependency/readiness annotations, assumption surfacing, and block title
   fidelity. Record findings.

6. **Inspect feasibility explanation before apply.** Record the feasibility
   state and the explanation or reason codes surfaced on the planning surface.
   Evaluate whether the state and reasons are honest relative to the plan
   structure observed.

7. **Apply the schedule.** Confirm that apply requires explicit user action (not
   auto-applied). Run apply.

8. **Inspect chart truth after apply.** Confirm the chart remains accurate after
   apply. Confirm no orphaned rows, stale blocks, or contradictions between
   chart state and applied state.

9. **Inspect planning surface consistency.** Confirm that the planning surface
   agrees with the chart and lifecycle state. Confirm no surface shows phantom
   blocks or contradictory feasibility state.

10. **Record audit-dimension findings.** For each of the 13 audit dimensions,
    record what was observed. Use the audit dimension matrix in section 6 as the
    standard.

11. **Assign per-goal verdict.** Apply the verdict rules in section 9 and record
    the verdict: `pass`, `partial_pass`, or `fail`.

12. **Classify root cause if not pass.** For any `partial_pass` or `fail`
    verdict, assign at least one root-cause classification from the taxonomy in
    section 8.

---

## 6. Audit Dimension Matrix

The following 13 dimensions are the locked audit matrix. Every goal must be
evaluated against all 13. The applicability note in the temporal quality row
identifies which class of goal each sub-dimension applies to.

---

### D-01: Intake sufficiency

**Definition:** The goal contract contains a concrete terminal outcome,
meaningful verification criteria, an explicit deadline, and no unresolvable
ambiguity that blocks plan generation.

**Evidence to look for:** Terminal outcome text, verification criteria text,
deadline presence, absence of clarification blocking.

**Pass concern:** Intake is sufficiently concrete for plan generation.

**Fail concern:** Outcome is vague, verification criteria is missing or
circular, deadline is absent, or intake cannot proceed without unresolved
context.

---

### D-02: Deliverable quality

**Definition:** Deliverables carry specific, object-bearing titles that are
distinguishable from one another. Generic phase labels (`Planning & setup`,
`Core production`, `Verification & finalization`) are failures.

**Evidence to look for:** Deliverable titles in the chart. Check whether titles
carry the goal object and represent real, success-relevant outputs.

**Pass concern:** All deliverable titles are specific, distinguishable, and
goal-object-bearing.

**Fail concern:** One or more deliverables carry hollow phase labels, restate
the goal verbatim without specificity, or are undistinguishable from one
another.

---

### D-03: Action quality

**Definition:** Actions carry specific, non-generic titles that inherit the goal
object. Actions must materially serve a deliverable, be specific enough to
schedule, and not collapse multiple unrelated intents into one vague row.

**Evidence to look for:** Action titles in the chart. Check inheritance of goal
object. Check whether actions are schedulable and specific.

**Pass concern:** Actions are specific, inheriting goal object, and
distinguishable.

**Fail concern:** Actions are generic session labels, restatements of the
deliverable, or collapse multiple unrelated work intents.

---

### D-04: Canonical actionType coverage

**Definition:** Every canonical action carries a resolved `actionType`
(`preparation` or `execution`). Plans with unresolved or missing action types
across the majority of actions are a coverage failure.

**Evidence to look for:** ActionType labels in chart rows. Count how many
actions show `Unknown` or no type.

**Pass concern:** All or nearly all actions have resolved types.

**Fail concern:** A material portion of actions carry `Unknown` or no type,
treating a planning defect as acceptable completion.

---

### D-05: Dependency and readiness truth

**Definition:** Actions with sequencing requirements carry explicit dependency or
readiness annotations. Plans with dependency-free sequences where sequencing is
materially required are a partial or full failure depending on severity.

**Evidence to look for:** Dependency or readiness fields on actions. Check
whether sequencing is inspectable. Check whether preparation blocks are
correctly placed before dependent execution blocks.

**Pass concern:** Material sequencing dependencies are annotated or canonically
visible.

**Fail concern:** Execution is presented without readiness dependencies where
they are materially required, making sequencing non-inspectable.

---

### D-06: Assumption honesty

**Definition:** Assumptions are surfaced where the plan cannot resolve starting
state or external conditions from canonical inputs. Plans that silently resolve
assumptions without surfacing them are a failure.

**Evidence to look for:** Assumption markers on deliverables, actions, or blocks
in the chart. Check whether assumption burden is visible in the planning surface
or feasibility explanation.

**Pass concern:** Assumptions are surfaced and contribute to plan quality
degradation where material.

**Fail concern:** Assumptions are silently resolved as facts, or assumption
burden is high but invisible in the plan.

---

### D-07: Block title fidelity

**Definition:** Blocks carry titles that inherit the goal object from the action
they represent. Generic session labels (`Work session`, `Focused time`, `Review
block`) without goal-object inheritance are failures.

**Evidence to look for:** Block titles as shown in the chart and calendar
surfaces. Check whether object inheritance is preserved.

**Pass concern:** Block titles are distinguishable and goal-object-bearing.

**Fail concern:** Block titles are generic, interchangeable, or have lost the
goal-object during materialization.

---

### D-08: Chart inspectability

**Definition:** A user inspecting the formal plan chart can determine what
success requires, what preparation vs. execution looks like, how the plan is
sequenced, and what assumptions are present. Decorative chart rows without
schedulable truth are a failure.

**Evidence to look for:** Whether the chart exposes goal → deliverables →
actions → blocks lineage. Whether actionType, assumptions, and dependencies are
visible. Whether the chart conveys what the work is and why it is sequenced as
shown.

**Pass concern:** Chart is inspectable to canonical lineage depth. A reviewer
can determine decomposition quality without navigating to internal state.

**Fail concern:** Chart rows carry no meaningful lineage, or chart is a
decorative summary with no canonical backing.

---

### D-09: Lifecycle correctness

**Definition:** The full lifecycle path — generate, review, apply, activate,
chart — remains distinct and auditable. Proposed blocks must not auto-apply.
Applied blocks must reflect the reviewed plan. The chart must remain accurate
after apply.

**Evidence to look for:** Confirmation that generate did not auto-apply. Chart
state before and after apply. Absence of orphaned rows or stale blocks from
prior cycles. Consistency between chart and calendar surfaces after apply.

**Pass concern:** Lifecycle stages are distinct; chart truth is preserved across
generate → review → apply.

**Fail concern:** Auto-apply occurred, chart contradicts applied state, orphaned
blocks remain from prior cycles, or surfaces disagree on block existence after
apply.

---

### D-10: Temporal quality (long_term) / Structural quality (short_term)

**For `short_term` goals — structural quality:**

**Definition:** The plan satisfies full structural quality: complete
deliverable/action/block lineage, resolved action types, non-generic titles,
honest assumption surfacing, and feasibility reflecting actual schedule fit.

**Evidence to look for:** Structural quality state in goal policy. Presence of
all lineage levels. Absence of structural defects.

**Pass concern:** Structural quality is `trusted` or `provisional` with known
bounded weaknesses.

**Fail concern:** Structural quality is `degraded` or `withheld` due to lineage
gaps, missing action types, or hollow titles.

---

**For `long_term` goals — temporal quality:**

**Definition:** The plan shows meaningful phase structure, believable pacing,
honest uncertainty on deep segments, checkpoint discipline, and saturation
control across the full horizon.

**Evidence to look for:** Phase structure in the chart. Pacing shape. Existence
of uncertainty bands on deep horizon segments. Checkpoint presence. Saturation
state. Long-horizon quality state.

**Pass concern:** Temporal quality is `trusted` or `provisional` with bounded
weaknesses. Phase structure reflects real work-mode shifts. Pacing is
distributed credibly. Uncertainty is marked where honest.

**Fail concern:** One undifferentiated horizon with no phase structure. Packing
is unrealistically front-loaded or back-loaded. Deep segments are falsely
precise. No checkpoints for a materially volatile horizon. Long-horizon quality
is `degraded` or `withheld`.

---

### D-11: Feasibility honesty

**Definition:** Feasibility state (`feasible`, `constrained`, `degraded`,
`withheld`) must reflect actual structural support, schedule fit, and capacity
truth. Feasibility that is `feasible` because the plan is structurally thin
enough to avoid detection of constraints is not a pass.

**Evidence to look for:** Feasibility state on planning surface. Reason codes
surfaced. Correspondence between plan structural quality, schedule fit, and
stated feasibility state.

**Pass concern:** Feasibility state is congruent with plan structural quality
and schedule truth. Reason codes identify actual contributors.

**Fail concern:** Feasibility is `feasible` while plan quality is thin enough
that real constraints go undetected. Feasibility is `withheld` not because
canonical truth is thin but because plan quality failure was not properly
isolated. Reason codes do not correspond to observable plan state.

---

### D-12: End-to-end consistency

**Definition:** The planning surface, chart surface, and lifecycle outputs must
agree. What is shown in the formal plan chart must match what was generated,
reviewed, and applied. No surface may display phantom blocks, orphaned actions,
or lifecycle states that contradict the canonical event record.

**Evidence to look for:** Consistency between planning surface block count and
chart block count. Consistency between chart before and after apply. Agreement
between today/week/calendar views and chart after apply.

**Pass concern:** All observable surfaces agree on plan state, block existence,
and lifecycle position.

**Fail concern:** Any surface shows phantom blocks, orphaned actions, or a
lifecycle state contradicting canonical truth.

---

### D-13: Standardization consistency

**Definition:** The plan's structure, title patterns, and quality characteristics
are consistent with what the system is expected to produce across other goals in
the same archetype class. Idiosyncratic outputs that pass locally but diverge
from cross-archetype standards are a partial-pass or fail concern.

**Evidence to look for:** Whether deliverable and action titles follow
object-bearing patterns consistently with what other goals produce. Whether
feasibility state is calibrated consistently with comparable structural inputs.

**Pass concern:** Output is consistent with the system's established quality
standard. No idiosyncratic pass that only works for one specific goal input.

**Fail concern:** The goal passes due to specific input characteristics that
happen to avoid known failure modes, while the system would fail on
semantically adjacent inputs.

---

## 7. Goal Audit Templates

One template per locked goal. Fill in all fields during the audit run.

---

### Template: ST-01

**Goal ID:** ST-01
**Goal title:** Finish and release a polished 3-song EP
**Horizon:** 45 days
**Horizon class:** `short_term`

#### Dimension findings

| Dimension | Observation | Concern level |
|-----------|-------------|--------------|
| D-01: Intake sufficiency | | |
| D-02: Deliverable quality | | |
| D-03: Action quality | | |
| D-04: ActionType coverage | | |
| D-05: Dependency/readiness truth | | |
| D-06: Assumption honesty | | |
| D-07: Block title fidelity | | |
| D-08: Chart inspectability | | |
| D-09: Lifecycle correctness | | |
| D-10: Structural quality | | |
| D-11: Feasibility honesty | | |
| D-12: End-to-end consistency | | |
| D-13: Standardization consistency | | |

#### Summary fields

**Observed strengths:**

**Observed weaknesses:**

**Feasibility state observed:**

**Feasibility explanation observed:**

**Lifecycle contradictions observed:**

**Root cause classification (if not pass):**

**Verdict:** `pass` / `partial_pass` / `fail`

**Notes:**

---

### Template: ST-02

**Goal ID:** ST-02
**Goal title:** Lose 12 pounds with a consistent training and meal-prep routine
**Horizon:** 70 days
**Horizon class:** `short_term`

#### Dimension findings

| Dimension | Observation | Concern level |
|-----------|-------------|--------------|
| D-01: Intake sufficiency | | |
| D-02: Deliverable quality | | |
| D-03: Action quality | | |
| D-04: ActionType coverage | | |
| D-05: Dependency/readiness truth | | |
| D-06: Assumption honesty | | |
| D-07: Block title fidelity | | |
| D-08: Chart inspectability | | |
| D-09: Lifecycle correctness | | |
| D-10: Structural quality | | |
| D-11: Feasibility honesty | | |
| D-12: End-to-end consistency | | |
| D-13: Standardization consistency | | |

#### Summary fields

**Observed strengths:**

**Observed weaknesses:**

**Feasibility state observed:**

**Feasibility explanation observed:**

**Lifecycle contradictions observed:**

**Root cause classification (if not pass):**

**Verdict:** `pass` / `partial_pass` / `fail`

**Notes:**

---

### Template: ST-03

**Goal ID:** ST-03
**Goal title:** Launch a branded landing page and get first 25 leads
**Horizon:** 60 days
**Horizon class:** `short_term`

#### Dimension findings

| Dimension | Observation | Concern level |
|-----------|-------------|--------------|
| D-01: Intake sufficiency | | |
| D-02: Deliverable quality | | |
| D-03: Action quality | | |
| D-04: ActionType coverage | | |
| D-05: Dependency/readiness truth | | |
| D-06: Assumption honesty | | |
| D-07: Block title fidelity | | |
| D-08: Chart inspectability | | |
| D-09: Lifecycle correctness | | |
| D-10: Structural quality | | |
| D-11: Feasibility honesty | | |
| D-12: End-to-end consistency | | |
| D-13: Standardization consistency | | |

#### Summary fields

**Observed strengths:**

**Observed weaknesses:**

**Feasibility state observed:**

**Feasibility explanation observed:**

**Lifecycle contradictions observed:**

**Root cause classification (if not pass):**

**Verdict:** `pass` / `partial_pass` / `fail`

**Notes:**

---

### Template: LT-01

**Goal ID:** LT-01
**Goal title:** Build and launch a weekly podcast from concept to consistent publication
**Horizon:** 12 months
**Horizon class:** `long_term`

#### Dimension findings

| Dimension | Observation | Concern level |
|-----------|-------------|--------------|
| D-01: Intake sufficiency | | |
| D-02: Deliverable quality | | |
| D-03: Action quality | | |
| D-04: ActionType coverage | | |
| D-05: Dependency/readiness truth | | |
| D-06: Assumption honesty | | |
| D-07: Block title fidelity | | |
| D-08: Chart inspectability | | |
| D-09: Lifecycle correctness | | |
| D-10: Temporal quality | | |
| D-11: Feasibility honesty | | |
| D-12: End-to-end consistency | | |
| D-13: Standardization consistency | | |

#### Summary fields

**Observed strengths:**

**Observed weaknesses:**

**Feasibility state observed:**

**Feasibility explanation observed:**

**Temporal quality state observed:**

**Phase structure observed:**

**Pacing shape observed:**

**Uncertainty bands observed:**

**Checkpoints observed:**

**Saturation state observed:**

**Lifecycle contradictions observed:**

**Root cause classification (if not pass):**

**Verdict:** `pass` / `partial_pass` / `fail`

**Notes:**

---

### Template: LT-02

**Goal ID:** LT-02
**Goal title:** Go from beginner to employable software developer with portfolio and job-readiness
**Horizon:** 18 months
**Horizon class:** `long_term`

#### Dimension findings

| Dimension | Observation | Concern level |
|-----------|-------------|--------------|
| D-01: Intake sufficiency | | |
| D-02: Deliverable quality | | |
| D-03: Action quality | | |
| D-04: ActionType coverage | | |
| D-05: Dependency/readiness truth | | |
| D-06: Assumption honesty | | |
| D-07: Block title fidelity | | |
| D-08: Chart inspectability | | |
| D-09: Lifecycle correctness | | |
| D-10: Temporal quality | | |
| D-11: Feasibility honesty | | |
| D-12: End-to-end consistency | | |
| D-13: Standardization consistency | | |

#### Summary fields

**Observed strengths:**

**Observed weaknesses:**

**Feasibility state observed:**

**Feasibility explanation observed:**

**Temporal quality state observed:**

**Phase structure observed:**

**Pacing shape observed:**

**Uncertainty bands observed:**

**Checkpoints observed:**

**Saturation state observed:**

**Lifecycle contradictions observed:**

**Root cause classification (if not pass):**

**Verdict:** `pass` / `partial_pass` / `fail`

**Notes:**

---

### Template: LT-03

**Goal ID:** LT-03
**Goal title:** Build a business from concept to first sustainable revenue
**Horizon:** 24 months
**Horizon class:** `long_term`

#### Dimension findings

| Dimension | Observation | Concern level |
|-----------|-------------|--------------|
| D-01: Intake sufficiency | | |
| D-02: Deliverable quality | | |
| D-03: Action quality | | |
| D-04: ActionType coverage | | |
| D-05: Dependency/readiness truth | | |
| D-06: Assumption honesty | | |
| D-07: Block title fidelity | | |
| D-08: Chart inspectability | | |
| D-09: Lifecycle correctness | | |
| D-10: Temporal quality | | |
| D-11: Feasibility honesty | | |
| D-12: End-to-end consistency | | |
| D-13: Standardization consistency | | |

#### Summary fields

**Observed strengths:**

**Observed weaknesses:**

**Feasibility state observed:**

**Feasibility explanation observed:**

**Temporal quality state observed:**

**Phase structure observed:**

**Pacing shape observed:**

**Uncertainty bands observed:**

**Checkpoints observed:**

**Saturation state observed:**

**Lifecycle contradictions observed:**

**Root cause classification (if not pass):**

**Verdict:** `pass` / `partial_pass` / `fail`

**Notes:**

---

## 8. Root Cause Classification

Every non-pass goal must receive at least one root-cause classification from the
following bounded taxonomy. If a failure does not fit any listed category, use
`RC-13: other` with a narrow explanation.

| Code | Root cause |
|------|-----------|
| RC-01 | Intake insufficiency — goal contract too ambiguous or incomplete to generate a usable plan |
| RC-02 | Deliverable decomposition weakness — hollow, generic, or undistinguishable deliverable titles |
| RC-03 | Action decomposition weakness — generic, filler, or collapsed action titles |
| RC-04 | ActionType coverage gap — material portion of actions carry Unknown or no type |
| RC-05 | Dependency/readiness truth weakness — sequencing is materially unverifiable from canonical data |
| RC-06 | Assumption handling weakness — assumptions resolved silently or burden invisible in plan |
| RC-07 | Block materialization/title fidelity weakness — blocks lost goal-object inheritance or degraded to generic labels |
| RC-08 | Chart truth mismatch — chart rows do not correspond to canonical model state before or after apply |
| RC-09 | Lifecycle state inconsistency — surfaces disagree, auto-apply occurred, or orphaned state persists |
| RC-10 | Temporal quality weakness — long-horizon plan lacks phase structure, credible pacing, uncertainty honesty, or checkpoint discipline |
| RC-11 | Feasibility reasoning weakness — feasibility state does not correspond to observed plan structural truth or schedule fit |
| RC-12 | Standardization inconsistency — output passes locally but diverges from cross-archetype quality standard |
| RC-13 | Other — must be explained narrowly; general "quality concern" is not acceptable |

---

## 9. Per-Goal Verdict Rules

### `pass`

No foundational defects in truth ownership, plan structure, feasibility
honesty, or lifecycle consistency. Remaining issues are refinement-level and do
not compromise canonical truth for this goal.

A goal must not receive `pass` if feasibility looks correct only because the
plan is structurally thin enough that real constraints were not exercised. That
is a plan-quality failure, not a feasibility pass.

### `partial_pass`

The system is broadly usable for this goal, but one or more significant quality
weaknesses remain. The weakness must be documented with root cause. The goal
could plausibly be used in production but with identified trust limitations.

### `fail`

A foundational defect in plan truth, feasibility truth, temporal truth, or
lifecycle consistency breaks canonical correctness for this goal. Examples:
hollow deliverable titles that survive gate checks, feasibility marked `feasible`
for a plan that cannot honestly schedule, blocks that apply without review, chart
that contradicts applied state, long-term plan with no temporal structure.

### Constraints on verdict assignment

- `pass` requires that all 13 dimensions have been evaluated and recorded.
- `partial_pass` or `fail` must cite at least one root-cause classification from
  section 8.
- Long-term goals must be evaluated against temporal quality criteria (D-10
  temporal) and not only local structural criteria.
- A `pass` verdict for a long-term goal with a `withheld` or `degraded`
  temporal quality state requires explicit justification, as that combination is
  contradictory under normal conditions.

---

## 10. Aggregate Gate Decision

Complete this section only after all 6 goal audits are finished.

### Per-goal verdict summary

| Goal ID | Goal title | Horizon class | Verdict | Root causes (if applicable) |
|---------|-----------|--------------|---------|---------------------------|
| ST-01 | Finish and release a polished 3-song EP | short_term | | |
| ST-02 | Lose 12 pounds with a consistent training and meal-prep routine | short_term | | |
| ST-03 | Launch a branded landing page and get first 25 leads | short_term | | |
| LT-01 | Build and launch a weekly podcast from concept to consistent publication | long_term | | |
| LT-02 | Go from beginner to employable software developer with portfolio and job-readiness | long_term | | |
| LT-03 | Build a business from concept to first sustainable revenue | long_term | | |

### Short-term summary

**Short-term pass count:** __ / 3

**Patterns observed across short-term goals:**

**Repeated root causes in short-term goals:**

### Long-term summary

**Long-term pass count:** __ / 3

**Patterns observed across long-term goals:**

**Repeated root causes in long-term goals:**

### Repeated root-cause pattern summary

List any root-cause codes that appear in 2 or more goals. These are systemic
signals, not isolated failures.

| Root cause code | Goals affected | Interpretation |
|----------------|---------------|---------------|
| | | |

### Final gate decision

**Gate decision:** `open_live_pos_gate` / `keep_live_pos_blocked`

**Decision rationale:**

---

#### Gate decision rules

The gate may open only if:

- the majority of the 6-goal pack (4 or more) passes without foundational
  defects, and
- no repeated foundational defects appear across multiple goals in truth
  ownership, lifecycle behavior, feasibility honesty, or long-term temporal
  quality

The gate must remain closed if:

- fewer than 4 goals pass
- repeated foundational root-cause patterns appear even if individual goals
  received `partial_pass` verdicts
- any long-term goal fails on temporal quality grounds while passing on local
  structural grounds (these are separate criteria, not substitutable)
- feasibility honesty failures appear in 2 or more goals

`partial_pass` verdicts must be evaluated by pattern severity. A majority of
`partial_pass` verdicts with the same root cause is effectively a systemic
foundational failure and must keep the gate closed.

---

## 11. Evidence Recording Rules

The following rules govern how evidence is recorded during audit runs.

- Evidence must be tied to specific surfaces or observable behavior. "The plan
  looked reasonable" is not evidence.

- Observations must distinguish pre-apply vs. post-apply truth. Chart behavior
  before apply and after apply are separate evidence points and must not be
  conflated.

- Feasibility observations must record both the state label (`feasible`,
  `constrained`, `degraded`, `withheld`) and the explanation or reason codes as
  displayed on the planning surface.

- Long-term goal observations must record phase structure, pacing shape,
  checkpoint presence, uncertainty band presence, and saturation state
  individually. A single "temporal quality looks fine" note is not sufficient
  evidence.

- Contradictions between surfaces must be recorded explicitly, not smoothed
  over. If the chart shows 12 blocks and the calendar shows 10, that is a
  contradiction and must be documented.

- Vague commentary is not acceptable evidence. Replace "looked good" with a
  specific observation about what was confirmed and where.

- Absence of expected evidence is itself evidence. If no assumptions were
  surfaced in a plan that materially depends on unresolved starting state, record
  that absence.

---

## 12. Failure Cases To Prevent

- Skipping dimensions because the goal "felt fine." All 13 dimensions must be
  recorded for every goal.

- Changing the audit procedure mid-run. The procedure in section 5 must be
  followed identically for all 6 goals.

- Using different quality standards for short-term vs. long-term goals without
  the explicit dimension taxonomy from section 6 as the guide.

- Issuing `pass` without dimension-level evidence recorded. Verdict without
  evidence is not auditable.

- Treating repo green status as a substitute for goal-level behavioral
  verification.

- Hand-waving repeated root-cause patterns with explanations like "known
  limitation" without blocking consequences.

- Letting one especially strong goal outweigh multiple foundational failures
  elsewhere. Gate logic is based on majority pass without foundational defects,
  not on averaging across a mixed set.

- Substituting goals from the locked pack for "easier" goals that avoid known
  system weaknesses.

- Treating `partial_pass` as semantically close to `pass` when issuing the
  aggregate gate decision. `partial_pass` with repeated root causes is a
  systemic signal.

- Completing only short-term audits and issuing a gate-open decision without
  completing long-term audits.

---

## 13. Execution Checklist

Use this checklist to confirm the runbook was executed correctly before issuing
a gate decision.

- [ ] Horizon taxonomy confirmed: `short_term` = 1–90 days, `long_term` = 91
      days to system max
- [ ] Goal pack locked to the 6 goals listed in section 4; no substitutions made
- [ ] Same 12-step audit procedure used for all 6 goals
- [ ] All 13 dimensions recorded for ST-01
- [ ] All 13 dimensions recorded for ST-02
- [ ] All 13 dimensions recorded for ST-03
- [ ] All 13 dimensions recorded for LT-01 (temporal quality dimension used)
- [ ] All 13 dimensions recorded for LT-02 (temporal quality dimension used)
- [ ] All 13 dimensions recorded for LT-03 (temporal quality dimension used)
- [ ] Temporal quality fields (phase, pacing, uncertainty, checkpoints,
      saturation) recorded separately for all long-term goals
- [ ] All non-pass goals have at least one root-cause classification from
      section 8
- [ ] Per-goal verdicts assigned for all 6 goals
- [ ] Repeated root-cause patterns across goals identified and documented
- [ ] Aggregate gate decision completed per the decision rules in section 10
- [ ] Live P.O.S. remains blocked until this checklist is fully completed and
      the gate decision is `open_live_pos_gate`
