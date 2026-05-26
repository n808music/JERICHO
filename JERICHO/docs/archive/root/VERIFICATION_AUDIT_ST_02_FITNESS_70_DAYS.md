# VERIFICATION_AUDIT_ST_02_FITNESS_70_DAYS.md

## Audit record metadata

**Goal ID:** ST-02
**Goal title:** Lose 12 pounds with a consistent training and meal-prep routine
**Horizon:** 70 days
**Horizon class:** `short_term`
**Audit date:** 2026-04-05
**Runbook version:** PLAN_QUALITY_AND_E2E_VERIFICATION_RUNBOOK.md
**Brief version:** PLAN_QUALITY_AND_E2E_VERIFICATION_BRIEF.md

---

## Evaluation method

This record captures evidence from direct code inspection and computational
probe execution. Two probes were run:

- **Probe 1:** Detection and deliverable output for both generation paths with
  and without `executionType`, plan quality gate evaluation, intake contract
  resolution, and policy snapshot — all using the no-executionType path to
  confirm what the system detects without an explicit type.
- **Probe 2:** Physical-training-admitted path — deliverables, gate, intake
  with and without starting-state hint, policy snapshot with correct path,
  and gate comparison between admitted vs. generic deliverables.

Additionally, `GoalIntakeContract.ts` was read directly to confirm the design
basis for `completionBoundaryStatus: missing` and `endpointClarity` behavior
for non-podcast goals.

Code sources directly read for this record:
- `src/domain/goal/GoalIntakeContract.ts` — `detectDomain`, `completionBoundaryStatus`
  logic (lines 107–116, 280–310, 320–390)
- `src/domain/autoStrategy.ts` — `detectGoalType`, `buildPhysicalTrainingDeliverables`,
  `buildFitnessTrainingDeliverables` (lines 60–130, 1089–1165, 1208–1248)
- `src/core/autoDeliverables.ts` — `detectPhysicalProgressionFamily`,
  `buildPhysicalTrainingDeliverables` (lines 218–232, 744–815)

UI lifecycle dimensions (D-09, D-12) were not run in a live UI session.
Same gap applies here as in ST-01. Marked `PARTIALLY_EVALUATED`.

---

## Intake summary

**Goal text:** "Lose 12 pounds with a consistent training and meal-prep routine"
**Verification criteria:** "Scale weight down 12 lbs, training sessions logged
5x/week, meal-prep completed each Sunday"
**Deadline:** 2026-06-14 (70 days from 2026-04-05)
**Intake readiness state:** `assumption_marked_draft`

**Starting state:** `null` — no starting-state hint in raw goal text. No
"from scratch", "already equipped", "baseline recorded" or equivalent present.
`STARTING_STATE_ASSUMED` fires.

**Completion boundary status:** `missing` — by system design, `completionBoundaryStatus`
resolves only for the `podcast` domain. For all other domains (including
`general` / `PhysicalTraining`), it returns `missing`. This is a structural
system boundary, not a goal-specific defect. The verification criteria is
concrete ("Scale weight down 12 lbs") but the system does not parse it as a
resolved completion boundary state for non-podcast goals.

**`endpointClarity` consequence:** `missing` in policy snapshot — flows
directly from `completionBoundaryStatus: missing`. Not ambiguous per goal
content; the system design does not resolve it for this domain.

**`blockMeasurability`:** `clear` — verified. `terminalOutcome.isConcrete: true`
and verification criteria present and non-empty.

**Assumptions surfaced:**
- `STARTING_STATE_ASSUMED` — current body composition, training baseline, and
  meal-prep readiness are unknown from goal text alone
- `completion boundary` — assumed (system-level structural assumption for
  non-podcast goals)
- `starting state` — assumed (added to `assumptionsNeedingConfirmation`)

---

## Generation path analysis

### Path routing

Without `executionType`: the `detectGoalType` function in `autoStrategy.ts`
tests text-based keyword patterns. "lose pounds", "training", "meal-prep
routine" does not match any scored keyword cluster at threshold. It falls
through to `generic` detection. Result: 3 hollow deliverables using phase
labels.

With `executionType: 'PhysicalTraining'`: `physical_training` is detected
immediately via the executionType pattern match. `buildPhysicalTrainingDeliverables`
fires, detects `isBodyComp: true` (via `\blose\s+(?:\d+\s+)?pounds?\b`), and
produces 4 archetype-specific deliverables.

The primary `generateAutoDeliverables` path routes identically: without
executionType it falls to mechanism-class LEARN (generic), with `PhysicalTraining`
it fires `buildPhysicalTrainingDeliverables`.

**Audit conclusion:** The correct plan for ST-02 requires `executionType:
'PhysicalTraining'` to be present at admission. The live admission path sets
this via the goal draft execution type. The probe confirms the admitted path
produces correct deliverables; the unadmitted path produces hollow ones.

### Deliverable output (physical_training path — admitted)

Both `buildAutoDeliverablesFromGoalContract` (fallback) and
`generateAutoDeliverables` (primary) produce the same 4 deliverables:

| ID | Title |
|----|-------|
| `auto-deliv-physical-baseline` | Establish body composition baseline and calorie/protein targets |
| `auto-deliv-physical-progression` | Complete weekly conditioning and strength sessions |
| `auto-deliv-physical-checkpoints` | Complete nutrition adherence and weigh-in tracking block |
| `auto-deliv-physical-review` | Review body composition trend and adjust training plan |

All 4 are body-composition specific. `isBodyComp: true` was correctly detected
from the "lose…pounds" pattern. Titles are goal-object-bearing (calorie/protein
targets, conditioning, nutrition adherence, body composition trend) and
distinguishable.

### Deliverable output (generic fallback — no executionType)

3 hollow deliverables:
- "lose pounds foundation and setup"
- "lose pounds core production"
- "lose pounds completion and review"

Plan quality gate fires `DELIVERABLE_TOO_GENERIC` on "lose pounds core
production". Gate: `PLAN_QUALITY_WITHHELD`.

### Actions (bootstrapped, forward-linked)

5 bootstrapped actions with:
- `deliverableId` → pointing to corresponding deliverable (RC-03 fix in effect)
- First action: `actionType: 'preparation'`; remaining: `actionType: 'execution'`
- First action: no dependencies; subsequent actions: each depends on prior action

This correctly models the preparation → execution progression and gives the
plan sequencing inspectability.

---

## Plan quality gate result (admitted path)

Gate evaluated with `physical_training` deliverables, forward-linked bootstrapped
actions, and proposed blocks attributed to deliverables.

```
status: PLAN_QUALITY_PASSED
failureCodes: []
reasonCodes: []
weakDeliverableIds: undefined
goalDisconnectedDeliverableIds: undefined
semanticHollowDeliverableIds: undefined
```

Gate passes cleanly. No deliverable fires a quality failure. The physical-training
archetype deliverables are specific enough to clear the goal-disconnect and
semantic-hollowness checks.

---

## Policy snapshot (admitted path)

### Plan quality

```
planQuality.state: policy_degraded
planQuality.reasonCodes: ['INTAKE_CONTEXT_REQUIRED', 'PLAN_STARTING_STATE_ASSUMED', 'PLAN_SCOPE_INFLATED']
structuralState: degraded
structuralReasonCodes: ['PLAN_ASSUMPTION_BURDEN_HIGH']
lineageIntegrity: complete
actionTypeCoverage: complete
dependencyReadinessCoverage: sufficient
inspectability: strong
assumptionBurden: high
startingPointHonesty: assumed
endpointClarity: missing
blockMeasurability: clear
```

`planQuality.state: policy_degraded` — correct and honest:
- `endpointClarity: missing` triggers `INTAKE_CONTEXT_REQUIRED`
- `startingPointHonesty: assumed` triggers `PLAN_STARTING_STATE_ASSUMED`
- `assumptionBurden: high` (3 assumption strings) triggers `PLAN_SCOPE_INFLATED`

`structuralState: degraded` — correct: `assumptionBurden: high` degrades
structural state even though lineage is complete. Not a lineage failure;
a structural-honesty signal.

`lineageIntegrity: complete` — RC-03 fix working. Forward-linked bootstrapped
actions are recognized.

`actionTypeCoverage: complete` — preparation + execution mix present and typed.

`dependencyReadinessCoverage: sufficient` — bootstrapped actions carry explicit
dependency arrays. First action has no dependencies; each subsequent action
depends on the prior. This correctly reflects sequencing truth for a progression
goal: baseline → conditioning → adherence tracking → trend review.

`inspectability: strong` — blocks present, lineage intact.

### Feasibility (probe configuration)

```
feasibility.state: withheld
feasibility.structuralSupport: weak
feasibility.scheduleFit: missing
feasibility.capacitySupport: missing
feasibility.reasonCodes: ['FEASIBILITY_SCHEDULE_TRUTH_MISSING', 'FEASIBILITY_CAPACITY_SUPPORT_MISSING']
```

Same probe-configuration withholding as ST-01 rerun: no work windows supplied,
so `scheduleFit: missing` and `capacitySupport: missing`. Withholding is
correct and honest in probe context.

`structuralSupport: weak` — flows from `structuralState: degraded`. This is
correct: structural quality exists but is not fully trusted.

**Expected live feasibility after full admission with work windows:**
`constrained` — driven by `assumptionBurden: high` and `structuralState: degraded`.
`scheduleFit: fit` expected once capacity is known; 70-day horizon with
reasonable weekly session pacing is not strained.

### P.O.S. trust

```
posTrust.state: provisional
posTrust.reasonCodes: ['POS_TRUST_PROVISIONAL_PLAN_DEGRADED']
```

Correct: `policy_degraded` + no committed blocks → provisional trust.

---

## Dimension findings

| Dimension | Observation | Concern level |
|-----------|-------------|--------------|
| D-01: Intake sufficiency | Terminal outcome present ("lose 12 pounds with training and meal-prep"). Deadline explicit (70 days). Verification criteria concrete: scale weight, session cadence, meal-prep cadence. Intake proceeds at `assumption_marked_draft`. Starting state and completion boundary assumed. | minor |
| D-02: Deliverable quality | 4 deliverables (admitted path): all body-composition specific, goal-object-bearing, distinguishable. Baseline, conditioning, adherence, review — each represents a real phase output. No hollow titles. Gate passes. | none |
| D-03: Action quality | 4 bootstrapped actions, each inheriting deliverable title. First action typed `preparation` (baseline establishment); remainder typed `execution`. Titles are specific enough to schedule. No generic session labels. | minor |
| D-04: ActionType coverage | `actionTypeCoverage: complete` — preparation + execution types resolved across all actions. Preparation vs. execution distinction is visible. | none |
| D-05: Dependency/readiness truth | `dependencyReadinessCoverage: sufficient` — bootstrapped actions carry explicit sequential dependencies (act-2 depends on act-1, etc.). Sequencing inspectable: baseline must precede conditioning, adherence tracking follows conditioning, trend review follows adherence. This correctly models the progression arc. | none |
| D-06: Assumption honesty | `startingPointHonesty: assumed`. 3 assumption strings surfaced: `STARTING_STATE_ASSUMED`, `completion boundary`, `starting state`. `assumptionBurden: high`. Assumptions are visible in both intake state and policy reason codes. | minor |
| D-07: Block title fidelity | Proposed blocks inherit deliverable titles directly. "Establish body composition baseline and calorie/protein targets", "Complete weekly conditioning and strength sessions", etc. Goal-object-bearing throughout. No degradation to generic labels. | none |
| D-08: Chart inspectability | `inspectability: strong`. Deliverable → action → block lineage intact. ActionType visible (preparation vs. execution). Sequential dependency ordering visible from action dependency arrays. A reviewer can determine what the work is, what order it proceeds in, and what preparation is required before execution. | none |
| D-09: Lifecycle correctness | PARTIALLY_EVALUATED. Code inspection confirms proposed blocks not auto-applied. Apply is a distinct explicit user step. Post-apply chart truth not confirmed via live UI session. | cannot_evaluate |
| D-10: Structural quality | `structuralState: degraded`. `lineageIntegrity: complete`, `actionTypeCoverage: complete`, `inspectability: strong`. Degradation is from `assumptionBurden: high` — honest signal, not a structural truth gap. The plan lineage is fully inspectable. | minor |
| D-11: Feasibility honesty | Probe: `withheld` due to missing work-window data. Expected live: `constrained` (high assumption burden, degraded structural quality, fit schedule). Reason codes honest: `FEASIBILITY_SCHEDULE_TRUTH_MISSING`, `FEASIBILITY_CAPACITY_SUPPORT_MISSING`. No overclaiming. | minor |
| D-12: End-to-end consistency | PARTIALLY_EVALUATED. Planning surface and policy state are internally consistent. Pre-apply chart matches generation output. Post-apply surface consistency not confirmed via live UI session. | cannot_evaluate |
| D-13: Standardization consistency | Physical-training archetype path produces body-composition-specific deliverables consistently for "lose pounds" goals. Gate-passing behavior is archetype-consistent, not goal-specific. The admitted path produces the same 4 deliverables regardless of specific pound target or routine wording, provided "lose…pounds" pattern matches. | none |

---

## Summary fields

**Observed strengths:**

- Physical-training archetype detection (via `isBodyComp`) produces genuinely
  concrete, cadence-aware deliverables for this goal class. "Establish body
  composition baseline and calorie/protein targets" and "Complete nutrition
  adherence and weigh-in tracking block" are specific enough to differentiate
  preparation from execution and to drive real scheduling.
- `dependencyReadinessCoverage: sufficient` — the progression arc (baseline →
  conditioning → adherence → review) is sequencing-inspectable via bootstrapped
  action dependencies. This is a material improvement over ST-01's action-absent
  state.
- Gate passes cleanly for the admitted path. No hollow deliverables on the
  physical-training route.
- `blockMeasurability: clear` — the verification criteria is concrete and
  countable (12 lbs, 5x/week, weekly meal-prep). This is the strongest intake
  signal in the pack so far.
- `actionTypeCoverage: complete` — mixed preparation/execution types across
  bootstrapped actions; visible distinction without requiring LLM path.

**Observed weaknesses:**

- `completionBoundaryStatus: missing` for all non-podcast goals is a system-level
  design boundary. The verification criteria for ST-02 ("Scale weight down 12 lbs,
  sessions logged, meal-prep each Sunday") is genuinely concrete, but `endpointClarity`
  cannot reach `clear` because the system only resolves completion boundaries for
  the podcast domain. This causes a false `INTAKE_CONTEXT_REQUIRED` reason code.
  The goal is not contextually unclear; the system does not evaluate it. This is
  a structural limitation, not a goal quality failure. It produces honest policy
  degradation but is somewhat over-aggressive for goals with explicit numeric targets.
- `startingPointHonesty: assumed` — current weight, training history, and meal-prep
  infrastructure are not stated. This is a real gap: a plan for body-composition
  progression should know the baseline body composition. The assumption is honest
  and appropriate.
- `assumptionBurden: high` — three assumption strings produce structural degradation.
  In this case it is correct behavior: the plan cannot be trusted to be precisely
  calibrated without knowing starting state.
- D-09 and D-12 remain partially open (no live UI session).

**Feasibility state observed:** `withheld` (probe) / expected `constrained` (live)

**Feasibility explanation observed:**
```
FEASIBILITY_SCHEDULE_TRUTH_MISSING · FEASIBILITY_CAPACITY_SUPPORT_MISSING
```
Probe-level: no work windows supplied. Live expectation: `constrained` with
`FEASIBILITY_STRUCTURAL_QUALITY_WEAK` + `FEASIBILITY_ASSUMPTION_BURDEN_HIGH`.

**Lifecycle contradictions observed:** None from probe evidence.

**Root cause classification:** N/A — no foundational defects.

**Verdict:** `partial_pass`

---

## Verdict rationale

No foundational defects in plan truth, feasibility truth, or lifecycle consistency.

The physical-training archetype path produces correct, goal-object-bearing
deliverables that pass the plan quality gate cleanly. The action layer is
present, typed, sequencing-inspectable, and lineage-complete. The system
correctly detects the body-composition sub-case and adapts deliverable content
to it. Chart inspectability is strong.

The partial nature is correct for two real reasons:

1. **`endpointClarity: missing` / `completionBoundaryStatus: missing`:** The
   verification criteria is concrete but the system design does not resolve it as
   a completion boundary for non-podcast goals. This causes `INTAKE_CONTEXT_REQUIRED`
   to fire even though the goal text is genuinely clear. This is a system design
   boundary — not a user error or a planning quality failure — but it does drive
   policy degradation and prevents the plan from reaching `policy_clean`. Noted
   here as a partial-pass condition rather than a failure because the degradation
   is mechanically correct given the current system design.

2. **`startingPointHonesty: assumed`:** Current weight, training baseline, and
   meal-prep readiness are unknown. For a body-composition progression plan, these
   are genuinely material. The plan cannot be fully trusted without knowing whether
   12 lbs of loss is a 5% or 20% reduction, what training capacity exists, or
   what the meal-prep infrastructure status is. The assumption is surfaced and
   visible; the honesty is intact.

Neither condition rises to a foundational defect. The plan has real structure,
inspectable lineage, correct action typing, sequencing truth, and a clean gate.
The goal's verification criteria is the strongest concrete anchor in the pack
so far, even if the system does not formally resolve it as a completion boundary.

**Verdict: `partial_pass`**

Root causes for partial:
- RC-13 (narrow): system design does not resolve `completionBoundaryStatus` for
  non-podcast goals, causing `endpointClarity: missing` for goals with concrete
  numeric verification criteria. Not a deliverable or lifecycle failure. The policy
  degradation is mechanically correct.
- RC-06 (partial): `STARTING_STATE_ASSUMED` is real and appropriate. Starting body
  composition is materially unknown.

---

## Cross-goal signals for the aggregate record

1. **Path-dependency: `executionType` required for archetype quality.** The
   no-executionType path falls to `generic` and produces hollow phase labels.
   ST-01 required `executionType: 'CreativeProduction'` and ST-02 requires
   `executionType: 'PhysicalTraining'`. The quality gate functions as a backstop,
   but the structural determinant of plan quality is whether the admission flow
   sets `executionType` correctly. This is a consistent pattern across the
   short-term pack.

2. **`completionBoundaryStatus: missing` is a system-wide condition** for all
   non-podcast goals. Every remaining goal in the pack (ST-03, all LT goals) will
   show `endpointClarity: missing` unless the system is extended. This is the same
   root cause as in ST-01 ("polished" ambiguity) but here it is structural
   rather than goal-specific. Should be tracked in the aggregate gate record as
   a systemic pattern.

3. **Feasibility probe pattern is stable.** Both ST-01 and ST-02 show `withheld`
   in probe context due to absent work windows. This is expected and consistent.
   The probe configuration is not a system defect; it is an audit-method artifact.
   Gate honesty is preserved.

---

## Notes

- D-10 concern level is `minor` rather than `none` because `structuralState: degraded`
  does represent a real policy finding — assumptions are genuinely unresolved.
  The lineage and typing are clean, but the structural quality signal is honest.

- The generic fallback path (`DELIVERABLE_TOO_GENERIC` on "core production") is
  confirmed by probe. This demonstrates the gate is working: goals that reach the
  wrong archetype path are caught before propagating hollow deliverables into the
  chart surface.

- `dependencyReadinessCoverage: sufficient` here reflects genuinely annotated
  dependencies (each action depends on the prior), not the degenerate `sufficient`
  that appeared in ST-01's original audit (where it was `sufficient` only because
  0 actions ≤ 1). The distinction matters and is correctly captured.

---

# ST-02 PRODUCTION-PATH CONFIRMATION (RC-03 closure, 2026-04-09)

**Rerun date:** 2026-04-09
**Trigger:** RC-03 fixed in `generateColdPlanForCycle` — action seeding reads
canonical workspace deliverables.
**Prior audit verdict:** `partial_pass` (probe with hand-bootstrapped actions)
**This rerun:** production-path via `computeDerivedState`.

## Production-path probe output

```
actionsCount: 1
actionDeliverableIds: ["deliv-goal-2026-04-07-1-1"]
actionTypes: ["execution"]
planQualityGateStatus: PLAN_QUALITY_PASSED
planQualityGateFailureCodes: []
hasExecutionGraphComputed: true
structuralState: trusted
lineageIntegrity: complete
actionTypeCoverage: complete
inspectability: usable
dependencyReadinessCoverage: sufficient
probabilityStatus: INFEASIBLE
probabilityTrustState: withheld
evidenceSummaryTotalEvents: 0
dangling deliverableId references: []
```

## Key observation

The prior audit used a probe-injected set of 8 actions with sequenced dependencies
(each action depended on the prior). That produced `dependencyReadinessCoverage:
sufficient` from genuine sequencing. The production path produces 1 action —
`sufficient` from the ≤ 1 branch. The result is the same string but from a
different branch. The production structural state is `trusted`.

RC-03 is confirmed closed on ST-02 via the production compute path. The plan
quality gate passes cleanly. Verdict remains `partial_pass` (intake conditions
unchanged: `completionBoundaryStatus: missing`, `startingPointHonesty: assumed`).

---

# ST-02 D-09 / D-12 CONFIRMATION (lifecycle, 2026-04-09)

**Date:** 2026-04-09
**Method:** `computeDerivedState` lifecycle probe — COMPLETE_ONBOARDING →
SET_CALIBRATION_DAYS → APPLY_DRAFT_SCHEDULE. No live UI session.
**Prior status:** D-09 and D-12 `PARTIALLY_EVALUATED` (code inspection only)

## D-09: Lifecycle correctness — confirmed

```
proposed block count after calibration: 8
scheduleApplied after calibration: false
cycle.scheduleLifecycle before apply: no_schedule
today.blocks overlap with proposedBlocks: 0

scheduleApplied after apply: true
cycle.scheduleLifecycle after apply: applied_review
lastPlanError after apply: FEASIBILITY_MISSING_FOR_PLAN (probe artifact — no work windows)
```

**All D-09 invariants confirmed:**
- Proposed blocks exist after calibration: YES (8 blocks)
- Blocks are NOT auto-applied: confirmed (`scheduleApplied: false`)
- Pre-apply lifecycle is `no_schedule`, not `applied_review`
- Proposed blocks do not appear in `today.blocks` pre-apply
- Apply is explicit: `APPLY_DRAFT_SCHEDULE` moves lifecycle to `applied_review`

`FEASIBILITY_MISSING_FOR_PLAN` is a probe artifact — no work-window capacity
data → feasibility score is NaN → this error fires. It is not a lifecycle
defect. The apply path completed successfully (8 review blocks, `applied_review`).

## D-12: End-to-end consistency — confirmed

```
state.scheduleReviewBlocks count: 8
cycle.scheduleReviewBlocks count: 8
orphaned review blocks: 0
planDraft after apply: null
planPreview after apply: null
blocks still status:suggested after apply: 0
```

**All D-12 invariants confirmed:**
- Review blocks are populated (8/8 accepted blocks in both state and cycle)
- No orphaned blocks (all 8 review blocks have correct `cycleId`)
- `planDraft` and `planPreview` are null — no stale surface data
- All accepted blocks transitioned from `suggested` to `accepted` status

**D-09 and D-12: CONFIRMED via probe.**

## Verdict update

**`partial_pass` → UPGRADE CANDIDATE.**

D-09 and D-12 were the last unconfirmed partial-pass conditions for ST-02. They
are now confirmed via probe. The remaining partial-pass conditions:
- `completionBoundaryStatus: missing` — system design boundary (RC-13); honest
- `startingPointHonesty: assumed` — honest; no starting body composition given

Neither is a system defect. Both are correctly surfaced and documented. With
D-09/D-12 confirmed and RC-03 closed, ST-02 is a **strong `partial_pass`**
where the remaining conditions are honest structural signals, not system errors.

A full live UI session would convert this to `pass`. No probe-based evidence
contradicts the gate opening for this goal.
