# JERICHO_TRUST_STATE_SEMANTICS_BRIEF.md

## Status

**Draft — doctrine brief, pre-implementation**
Upstream of: implementation phase (not yet started)
Depends on:
- JERICHO_OUTCOME_VALIDITY_PACKAGE_FREEZE.md (Phases 1–3)
- JERICHO_TERMINAL_ENDPOINT_RECOGNITION_FREEZE.md (Phases B/C)
- JERICHO_PHASE_D_ENDPOINT_GATE_CONSEQUENCE_BRIEF.md (Phase D — complete)
Date: 2026-04-07

---

## 1. Title and Purpose

This brief defines what trust is allowed to mean in JERICHO, given the upstream
truth surfaces now in place. It resolves the mismatch between the richness of
the system's current knowledge — about endpoints, authority, plan corridor
coverage, and split-goal structure — and the current trust state semantics,
which were designed before those surfaces existed.

The brief covers doctrine only. No code is changed. No tests are written.
The deliverable is a precise enough definition of trust semantics that a later
implementation phase can be bounded, tested, and frozen without ambiguity.

---

## 2. Why This Layer Is Next

The system now knows:

1. **What the terminal event is** — `terminalEndpoint` (clear_explicit, clear_inferred,
   ambiguous, missing, split)
2. **Who controls it** — `terminalOutcomeAuthority` (fully_controllable,
   externally_mediated, market_dependent, mixed, unknown)
3. **Whether the plan leaves preparation** — `OUTCOME_COVERAGE_PREP_ONLY`
4. **Whether the plan reaches terminal-stage coverage** — `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING`
5. **Whether the goal has a recognizable endpoint at all** — `OUTCOME_ENDPOINT_MISSING`
6. **Whether a split goal has zero coverage of one dimension** — `OUTCOME_SPLIT_DIMENSION_UNCOVERED`

Trust is the layer above these signals. It is the system's synthesized claim
about how much confidence it can honestly extend about a plan's relationship
to its terminal outcome. Currently, trust semantics do not consume any of these
signals. A plan can be `trusted` while the gate has just determined that:
- the plan never contacts the external decision-maker
- the terminal event is unrecognizable
- one dimension of a split goal has zero plan coverage

That mismatch is the problem this brief resolves.

---

## 3. Inputs Consumed From Frozen Packages

The trust layer reads these upstream fields. It does not recompute them.

| Input | Source | Status |
|-------|--------|--------|
| `terminalEndpoint.status` | `GoalIntakeContract.terminalEndpoint` (via `detectTerminalEndpoint`) | Frozen — read-only |
| `terminalEndpoint.secondaryEndpoint` | Same | Frozen — read-only |
| `terminalOutcomeAuthority.authority` | `GoalIntakeContract.terminalOutcomeAuthority` (via `deriveTerminalOutcomeAuthority`) | Frozen — read-only |
| `OUTCOME_COVERAGE_PREP_ONLY` | Gate failure code — `evaluatePlanQualityGate` result | Frozen — read-only |
| `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` | Gate failure code | Frozen — read-only |
| `OUTCOME_ENDPOINT_MISSING` | Gate failure code — Phase D | Frozen — read-only |
| `OUTCOME_SPLIT_DIMENSION_UNCOVERED` | Gate failure code — Phase D | Frozen — read-only |

**Consumption constraint:** The trust layer consumes these as read inputs only.
It does not call detectors directly for these values; it reads results that
have been computed upstream. This prevents recomputation drift.

**Current gap:** `buildGoalPolicySnapshot` does not receive the gate result.
The gate and the policy snapshot are parallel evaluators. Bridging this — making
the gate's failure codes visible to the trust layer — is part of the
implementation scope implied by this brief, not a violation of any freeze.

---

## 4. Definitions

### 4.1 Feasibility

Feasibility is a claim about the relationship between **plan structure and
available capacity**. It answers: given the time horizon, work windows,
scheduled blocks, and structural integrity of the plan, is this goal
physically executable within the stated constraints?

Feasibility does not address whether the terminal event will actually occur.
A plan can be feasible (all blocks scheduled, capacity sufficient) while
targeting an externally controlled event that will never happen.

Current states: `feasible | constrained | degraded | withheld`

### 4.2 Gate Validity

Gate validity is a claim about **plan sufficiency for the stated outcome type**.
It answers: does this plan have the structural properties required to be a
credible attempt at the terminal outcome — given what the system knows about
how that outcome type must be approached?

Gate validity withholds when the plan fails to traverse the required corridor
(prep-only, no terminal stage) or fails to address a recognized outcome
structure (missing endpoint, uncovered split dimension).

Gate validity is binary at the plan level: `PLAN_QUALITY_PASSED` or
`PLAN_QUALITY_WITHHELD`.

### 4.3 Trust

Trust is a claim about **how much the system can honestly commit to
a predicted relationship between this plan and its terminal outcome**.

Trust is not:
- Whether the plan is well-structured (that is gate validity and structural quality)
- Whether the goal is feasible within capacity (that is feasibility)
- Whether execution evidence confirms early progress (that is evidence)

Trust IS:
- Whether the combination of plan structure, authority class, endpoint clarity,
  and available evidence allows the system to make a meaningful forward prediction
  about terminal attainment

**Authority matters to trust** because the terminal event is controlled by
different parties for different goal types. A fully_controllable goal with
a clean plan can be trusted to reach its terminal event if executed. An
externally_mediated goal cannot be trusted to the same degree regardless of
how clean the plan is — the external party has a vote.

**The key principle:** Trust cannot claim terminal attainability beyond what
authority and evidence allow. A structurally valid plan for an externally
mediated goal is not automatically highly trusted. The authority class
creates a ceiling on pre-execution trust.

### 4.4 Evidence-Aware Trust

Evidence-aware trust is trust that has been updated by observed external
responses — recruiter replies, investor meetings booked, commitment signals.

This brief defines the **pre-execution trust semantics** — what trust can mean
before such evidence exists. It acknowledges that evidence can elevate trust
later, but does not design the evidence intake system.

Evidence-based trust elevation is an existing mechanism in `deriveTrustState`
(`probabilityScore.ts:109`). That mechanism is not changed by this brief.
The brief only defines what the ceiling is pre-evidence, and what signals from
upstream truth surfaces must be respected.

---

## 5. Trust Semantics by Authority Class

### 5.1 Pre-Execution Trust Ceilings

The authority class constrains what trust can honestly claim before execution
evidence exists. These are structural ceilings — the plan cannot earn above
them regardless of how well-structured it is.

| Authority class | Pre-execution trust ceiling | Rationale |
|-----------------|-----------------------------|-----------|
| `fully_controllable` | `trusted` | User controls the terminal event. A clean plan that is feasible can be trusted to reach the outcome if executed. |
| `externally_mediated` | `provisional` | A third party controls the terminal decision. The plan can be well-structured and corridor-complete, but until the external party responds, no trust claim about terminal attainment is honest. |
| `mixed` | `provisional` | Contains at least one externally_mediated terminal dimension. Same ceiling applies: the external component is unresolved. |
| `market_dependent` | See §5.2 | Threshold metric creates a different trust shape. Defer full doctrine. |
| `unknown` | `provisional` | Authority cannot be determined. Cannot honestly trust what cannot be characterized. |

### 5.2 Market-Dependent Trust

`market_dependent` goals have a threshold terminal event (N listeners, $X MRR).
The constraint is real but distinct from externally_mediated: the external party
is not a single decision-maker but an aggregate market signal.

Pre-execution, `market_dependent` goals cannot be `trusted` because the threshold
has not been reached and market response is not guaranteed. However, the ceiling
and ceiling-lifting mechanism are different from `externally_mediated`:
- External evidence is distribution signals, not decision-maker responses
- The qualifying external stages for market goals differ by archetype

**This brief explicitly defers full `market_dependent` trust doctrine** because:
1. The market response gateway in `QUALIFYING_EXTERNAL_STAGES` is archetype-specific
   and already partially implemented
2. Defining the trust ceiling precisely requires knowing what constitutes external
   market evidence — that is product-level domain knowledge not resolved here
3. The current implementation (`deriveTrustState` in `probabilityScore.ts`) already
   handles the evidence-stage path for known market archetypes
4. The gap is pre-execution ceiling definition, which requires a separate brief
   once the market archetype trust evidence model is stable

**Working assumption until that brief exists:** `market_dependent` goals are
treated as `provisional` pre-execution. This is consistent with the current
behavior when evidence is `insufficient_evidence` or `disabled`.

### 5.3 Ceiling Interaction with Existing deriveTrustState

`deriveTrustState` in `probabilityScore.ts` already applies a ceiling for
externally_mediated goals with zero qualifying evidence events (returns
`provisional` even when `ELIGIBLE`). This is correct and consistent with the
doctrine defined here.

The gap this brief identifies is in `buildGoalPolicySnapshot`, which independently
derives `posTrustState` without authority-class ceiling awareness. A goal can
currently reach `posTrustState = 'trusted'` from `buildGoalPolicySnapshot` while
`deriveTrustState` would return `provisional`. The implementation phase must align
these: the policy snapshot's trust ceiling must respect the authority class, not
just structural quality.

---

## 6. Trust Semantics by Endpoint Status

The terminal endpoint status adds a second axis to trust semantics, orthogonal
to authority class.

| Endpoint status | Trust impact | Rationale |
|-----------------|-------------|-----------|
| `clear_explicit` | No trust reduction from endpoint alone | System knows exactly what it is trusting toward |
| `clear_inferred` | No trust reduction from endpoint alone | Endpoint is identified with confidence |
| `missing` + em/mixed authority | Trust cannot exceed `provisional`; gate fires `OUTCOME_ENDPOINT_MISSING` | Cannot trust that a plan reaches an outcome the system cannot identify |
| `missing` + fully_controllable | No trust reduction from endpoint alone | Gate does not fire; fc authority means user defines their own terminal event |
| `ambiguous` | No trust reduction in Phase D — deferred | See Phase D brief; rare case, worst instances covered by authority ceiling |
| `split` | Trust bounded by secondary dimension coverage | See §7 |

**Critical rule:** `OUTCOME_ENDPOINT_MISSING` firing does not simply degrade trust
to `provisional`. It undermines the target of the trust claim itself. If the system
cannot identify what the plan is supposed to reach, a `provisional` trust label
is still misleading — it implies the claim is directionally valid, just uncertain.

The implementation must apply the same `withheld` consequence as the gate:
when `OUTCOME_ENDPOINT_MISSING` fires, trust is `withheld`, not degraded.

This is distinct from "provisional because authority class caps pre-execution
claims." Provisional means the target is known but attainability is uncertain.
Withheld means the system cannot make the claim at all.

---

## 7. Trust Semantics for Split Goals

Split goals have two terminal endpoints with (typically) different authority
classes. Trust must account for both dimensions.

### 7.1 The Baseline Case

If a split goal has full plan coverage of both dimensions:
- The trust ceiling is determined by the more restrictive authority class
- LT-02 (artifact_complete + offer_received): artifact_complete is fc,
  offer_received is externally_mediated. The trust ceiling is `provisional`
  because the externally_mediated dimension is unresolved.

### 7.2 Secondary Dimension Uncovered

When `OUTCOME_SPLIT_DIMENSION_UNCOVERED` fires:
- The plan has zero coverage of one terminal dimension
- This is not a corridor gap (Phase 3 concern) — it is a structural omission
  of an entire outcome from the plan
- Trust consequence: `withheld`

Rationale: a plan that ignores one of two stated terminal outcomes is not a plan
for the whole goal. The user explicitly stated they want both. Provisional trust
on such a plan is dishonest — the system would be implying "this plan might reach
your goals" when the plan doesn't address half of them.

### 7.3 Deferred: Full Mixed-Authority Trust Decomposition

This brief does not define per-dimension trust scores or per-dimension trust
states. The split goal trust consequence is binary at the plan level: if the
secondary dimension is missing, trust is withheld. Once both dimensions are
represented, trust is bounded by the most restrictive authority class.

Full decomposition — separate trust claims per dimension, each with its own
evidence requirement — is deferred. It requires a separate brief if justified
by product need.

---

## 8. Recommended State Model

### The Decision: Option A — Narrow the Existing States

**Keep `trusted | provisional | withheld`. Do not introduce new state names.**

Reasoning:

The three states map cleanly to the system's display behaviors:
- `withheld` → suppress score, show `—`
- `provisional` → show capped score (≤ 0.65) + qualifier text
- `trusted` → show full live score, no qualifier

These display consequences are correct for the semantics defined in this brief:
- A goal with `OUTCOME_ENDPOINT_MISSING` should show `—` → `withheld` is right
- An externally_mediated goal pre-evidence should show a capped score + qualifier → `provisional` is right
- A fully_controllable goal with clean structure should show the full score → `trusted` is right

**What must change is not the states but the conditions that assign them.**

Currently `buildGoalPolicySnapshot` can reach `trusted` for externally_mediated
goals if structural quality is clean and evidence fields are populated. That must
be corrected by adding:
1. An authority-class ceiling check (em/mixed → max `provisional`)
2. Gate failure code consumption (OUTCOME_ENDPOINT_MISSING, OUTCOME_SPLIT_DIMENSION_UNCOVERED → `withheld`)

**What must also change is the reason code language.**

The existing reason code `POS_TRUST_PROVISIONAL_PLAN_DEGRADED` is semantically wrong
when applied to the authority ceiling case. If an externally_mediated goal reaches
`provisional` because the authority class imposes a ceiling — not because the plan
is degraded — that reason code is misleading. The implementation must distinguish:
- `provisional` because plan has structural gaps → `POS_TRUST_PROVISIONAL_PLAN_DEGRADED` (existing)
- `provisional` because authority class imposes pre-execution ceiling → new reason code required

**One new reason code is justified:** `POS_TRUST_PROVISIONAL_AUTHORITY_CEILING`

This reason code does not change the state name. It changes why the state was assigned,
which is necessary for honest display messaging and for future evidence-elevation logic
to know whether it can lift the state (evidence can lift `AUTHORITY_CEILING` for some
authority classes; evidence cannot fix `PLAN_DEGRADED`).

No other new reason codes are required at this time.

---

## 9. Mapping Table: Condition → Allowed Trust Meaning

### Pre-execution trust assignments

| Condition | Trust state | Reason code(s) | Notes |
|-----------|-------------|----------------|-------|
| Intake blocked | `withheld` | `POS_WITHHELD_UNTIL_ADMISSION` | No change from current |
| Plan quality policy_blocked | `withheld` | `POS_WITHHELD_UNTIL_PLAN_QUALITY` | No change from current |
| Gate fires `OUTCOME_ENDPOINT_MISSING` | `withheld` | `POS_WITHHELD_UNTIL_PLAN_QUALITY` | NEW: gate failure must propagate to trust |
| Gate fires `OUTCOME_SPLIT_DIMENSION_UNCOVERED` | `withheld` | `POS_WITHHELD_UNTIL_PLAN_QUALITY` | NEW: gate failure must propagate to trust |
| Gate fires `OUTCOME_COVERAGE_PREP_ONLY` | `withheld` | `POS_WITHHELD_UNTIL_PLAN_QUALITY` | NEW: gate failure must propagate to trust |
| Gate fires `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING` | `withheld` | `POS_WITHHELD_UNTIL_PLAN_QUALITY` | NEW: gate failure must propagate to trust |
| Authority is `externally_mediated` or `mixed`, gate passes | `provisional` | `POS_TRUST_PROVISIONAL_AUTHORITY_CEILING` | NEW reason code — distinguishes ceiling from degradation |
| Authority is `unknown`, gate passes | `provisional` | `POS_TRUST_PROVISIONAL_AUTHORITY_CEILING` | Cannot trust what cannot be characterized |
| Authority is `fully_controllable`, gate passes, structure clean | `trusted` | none | Matches current conditions; now explicitly bounded |
| Authority is `fully_controllable`, plan policy_degraded | `provisional` | `POS_TRUST_PROVISIONAL_PLAN_DEGRADED` | No change from current |
| Missing blocks or execution graph (any authority) | `provisional` | `POS_WITHHELD_UNTIL_EVIDENCE` | No change from current |
| Probability disabled or insufficient_evidence | `provisional` | `POS_WITHHELD_UNTIL_EVIDENCE` | No change from current |

### Post-evidence trust elevation (read-only for this brief)

| Condition | Effect on trust | Note |
|-----------|-----------------|------|
| `externally_mediated` + qualifying external event received | Eligible for elevation from `provisional` → `trusted` | Existing `deriveTrustState` mechanism; not changed here |
| `fully_controllable` + committed blocks + evidence | Already `trusted`; evidence confirms, not changes | |
| Gate failure code fires | Trust cannot be elevated by evidence alone | Gate must pass before elevation is meaningful |

---

## 10. Non-Goals / Deferred Questions

The following are explicitly out of scope for the implementation phase that
follows this brief.

**1. Per-dimension trust states for split goals**
Trust is a single plan-level claim. Per-dimension trust tracking for split goals
(e.g., "trusted on artifact dimension, provisional on offer dimension") is not
defined here. If justified by product need, it requires a new brief.

**2. Full `market_dependent` trust doctrine**
The ceiling for md goals and the conditions under which market evidence lifts it
are deferred. The working assumption (provisional pre-evidence) is adequate as
a placeholder.

**3. `ambiguous` endpoint trust consequences**
Phase D deferred ambiguous endpoint consequences. This brief does the same.
If ambiguous proves common, a targeted brief should address it.

**4. Evidence intake system design**
This brief acknowledges that evidence can change trust semantics but does not
define how evidence is collected, what counts, or how the evidence pipeline
is structured. That is outside this brief's scope.

**5. Trust for unaudited lanes**
SalesPipeline, Publishing, and other unaudited lanes have `unknown` corridor lane
classification. Their trust semantics follow the authority-class ceiling (em/mixed
→ provisional, fc → trusted given clean structure), not lane-specific logic.
No additional doctrine is needed until those lanes are audited.

**6. `completionBoundaryStatus` integration**
`completionBoundaryStatus` remains podcast-domain only (existing mechanism).
Trust does not consume it. The `endpointClarity` field in `PlanQualityEvaluation`
still derives from `completionBoundaryStatus`. This brief does not change that
relationship.

**7. Feasibility-to-trust coupling**
This brief does not redefine how feasibility outcomes affect trust. The existing
structural coupling (degraded feasibility → degraded trust pathway) is preserved.
The new doctrine adds authority-class and gate-failure dimensions alongside,
not instead of, the existing structural pathway.

---

## 11. Freeze Criteria

The implementation phase that follows this brief is complete when:

1. `buildGoalPolicySnapshot` applies authority-class pre-execution ceilings to
   `posTrustState`:
   - `externally_mediated` and `mixed` goals: max `provisional` pre-execution
   - `unknown` authority: max `provisional`
   - `fully_controllable`: `trusted` reachable given clean structure and gate pass
2. Gate failure codes are consumed by the trust layer:
   - Any of `OUTCOME_ENDPOINT_MISSING`, `OUTCOME_SPLIT_DIMENSION_UNCOVERED`,
     `OUTCOME_COVERAGE_PREP_ONLY`, `OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING`
     causes `withheld`, not `provisional` or `trusted`
3. `POS_TRUST_PROVISIONAL_AUTHORITY_CEILING` reason code exists and is used
   exclusively for the authority-ceiling case (not for plan degradation)
4. `POS_TRUST_PROVISIONAL_PLAN_DEGRADED` is preserved and used for structural
   degradation cases only
5. Trust state semantics are consistent between `buildGoalPolicySnapshot`
   (policy layer) and `deriveTrustState` in `probabilityScore.ts`
   (scoring layer) — no case where the two systems produce contradictory states
   for the same input
6. Audit pack verification: LT-02 (split, mixed authority) produces `provisional`
   on the full pipeline plan and `withheld` on the skill-only and job-only plans
7. LT-03 (externally_mediated, clear_explicit, offer_received): full pipeline
   produces `provisional` (authority ceiling, no external evidence); not `trusted`
8. LT-04 (externally_mediated, clear_explicit, capital_secured): same as LT-03
9. ST-01 (fully_controllable, clear_explicit): full pipeline can reach `trusted`
10. Zero existing tests that assert trust states are broken without a corresponding
    doctrinal justification for the change
11. Full suite passes — zero regressions

---

## 12. Reopening Criteria

A new brief is required before additional changes if any of the following occur:

1. A fourth trust state is proposed — that is a state-model change requiring
   full doctrine re-evaluation
2. `market_dependent` trust ceiling is defined differently from the working
   assumption (provisional pre-evidence) — the deferred doctrine must be written
   first
3. Per-dimension trust is introduced for split goals — that is a structural change
   to the trust model that requires its own brief
4. `ambiguous` endpoint is given trust consequences — the deferred case requires
   a targeted brief
5. Trust semantics are changed to depend on verification text clause content
   (clause-level parsing) — that requires the Phase 4 verification coverage work
   to be done first
6. The gate result and the policy snapshot are merged into a single evaluation
   function — that is an architectural change requiring a new brief
7. `completionBoundaryStatus` is connected to `terminalEndpoint` in a way that
   affects trust — requires an integration brief

---

## Key Risks This Layer Prevents

**RC-20 (partially):** The gate now enforces corridor sufficiency for audited
lanes. Trust now reflects authority class. RC-20 ("gate passed without checking
investor decision dependency") is addressed by: an externally_mediated goal
that passes the gate is still bounded to `provisional` trust — the system
explicitly acknowledges the external decision-maker has not yet responded.

**RC-23 class (lexical drift):** By narrowing the conditions under which each
trust state is assigned, and adding `POS_TRUST_PROVISIONAL_AUTHORITY_CEILING`
to distinguish ceiling from degradation, the brief prevents future implementors
from conflating "provisional because the plan is weak" with "provisional because
the authority class prohibits stronger claims."

**Trust inflation for externally_mediated goals:** Currently a fully structured
job-search or fundraising plan can reach `trusted`. Under this doctrine, it
cannot — pre-execution trust is capped at `provisional` because no external
party has responded. This prevents the system from claiming more about terminal
attainability than the authority class allows.

**Trust incoherence on withheld gate plans:** Currently a plan that fails the
gate can still be `provisional` in the policy snapshot because the two systems
don't share results. Under this doctrine, any gate-withheld plan is `withheld`
in trust as well. The two systems must agree.

---

## Recommended Next Move

**Recommended: a small probe-first audit pass before implementation.**

Do not proceed directly to implementation. Reason:

The change that requires the most care is wiring the gate result into
`buildGoalPolicySnapshot`. Currently these are independent evaluators, and
both are tested in isolation. Making `posTrustState` depend on gate failure
codes requires the gate to be called from (or its result passed into) the
policy snapshot builder. That introduces a coupling that is not yet documented
in either system's ownership contract.

Before writing any code, run an audit pass consisting of:

1. Read the current LT-02, LT-03, LT-04 probe tests and record what trust
   states they currently produce — these are the baseline to protect
2. Identify the exact call sites in `buildGoalPolicySnapshot` that set
   `posTrustState` — there are currently three branches (lines ~696–716);
   the new authority ceiling and gate failure code inputs need to be inserted
   without breaking the existing conditions
3. Confirm that `GoalPolicyInput` can be extended to carry gate results without
   breaking callers — check all call sites for `buildGoalPolicySnapshot`

This probe pass is two to three hours of reading, no code changes, and produces
a concrete list of the two or three call-site edits needed. The implementation
itself then becomes mechanical. Without the probe, the risk is discovering
unexpected coupling mid-implementation that requires doctrine re-evaluation.
