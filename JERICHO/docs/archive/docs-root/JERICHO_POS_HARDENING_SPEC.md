# JERICHO P.O.S. Hardening Specification

**Version:** 1.0 **Date:** 2026-03-20 **Phase:** P.O.S. hardening (entered after
plan-quality phase exit)

---

## Purpose

This document defines the rules Jericho must satisfy for P.O.S. (Probability of
Success) to be a trustworthy, honest signal — not a flattering estimate.

The plan-quality phase established that Jericho can produce the right plan. The
P.O.S. hardening phase establishes how confidence in that plan should be
initialized, gated, updated, and trusted as execution unfolds.

The central rule:

**P.O.S. is only as honest as the evidence behind it. The system must refuse to
manufacture trust it has not earned.**

---

## Section 1 — Current Baseline (What Exists)

This section documents the current P.O.S. model as-built, so that hardening
rules can be grounded in what is real.

### 1.1 Scoring status values (current)

`scoreGoalSuccessProbability()` returns one of these status codes:

| Status          | Meaning                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| `INFEASIBLE`    | Feasibility check fails (deadline passed, no workable days, or total capacity < remaining blocks). Score = 0. |
| `NO_EVIDENCE`   | No execution events yet. Initial score computed from plan_proof only. Hard cap: 0.65.                         |
| `INELIGIBLE`    | Some evidence exists but fewer than 7 evidence days. Score computed but still capped at 0.65.                 |
| `ELIGIBLE`      | 7+ evidence days. Full scoring active. Cap removed. Combined initial + throughput score.                      |
| `UNSCHEDULABLE` | Active plan has scheduling conflicts. Score = base score × 0.8.                                               |

### 1.2 Initial probability computation (NO_EVIDENCE state)

When no execution events exist, the score is derived from plan structural
properties:

```
base = 1 - (0.45 × intensityPenalty + 0.35 × slackPenalty + 0.2 × constraintDensity)
score = min(base, 0.65)   // hard cap until evidence exists
```

Where:

- `intensityRatio` = requiredPacePerDay / maxPerDay (from `planProof`)
- `slackRatio` = slack units / total required units (from `planProof`)
- `constraintDensity` = fraction of 5 constraint types present
  (caps/blackouts/weekday policy)

This is the honest pre-execution estimate. It cannot exceed 0.65 because plan
feasibility does not substitute for execution evidence.

### 1.3 Evidence-based scoring (INELIGIBLE / ELIGIBLE states)

When execution events exist:

1. Window computed via `getProbabilityWindowSpec()`:
   - `cycle_to_date` if active contract has a start date (default)
   - `rolling` 14-day window if contract specifies rolling mode or no start date
2. Throughput computed: `completedBlocksByDay` for each day in window
3. Statistics: mu = mean blocks/day, sigma = stddev, D = workable days remaining
4. Score: `P(D × mu ≥ remainingBlocks)` via normal CDF
5. Combined score: `(evidenceScore + initialScore) / 2` when ≥ 7 evidence days
6. Still capped at 0.65 when < 7 evidence days

### 1.4 Eligibility gating (current)

`deriveProbabilityStatus()` returns:

- `disabled` — no active contract for the goal
- `insufficient_evidence` — active contract but `executionEventCount` <
  `governance.minEvidenceEvents`
- `computed` — full scoring authorized

Only when status is `computed` does the main scoring path execute. Otherwise,
the initial estimate is returned with the eligibility status attached.

### 1.5 What the current model does NOT define

The following are gaps that P.O.S. hardening must close:

1. No explicit `withheld / provisional / trusted` trust state distinct from
   scoring status
2. No lifecycle rule governing when P.O.S. should exist at all (admission vs
   activation)
3. No differentiation between internally-controllable evidence and
   externally-mediated evidence
4. No formal rule for what happens when drift is detected (pattern of misses vs
   isolated miss)
5. No rule for how recovery actions affect trust state
6. No user-facing policy for when P.O.S. is appropriate to surface vs withhold

---

## Section 2 — Trust State Taxonomy

### 2.1 Three trust states

P.O.S. hardening introduces an explicit trust state layer above the scoring
status. This layer determines whether the score is shown to the user and how it
is labeled.

| Trust State   | User-facing             | Definition                                                                                                                                        |
| ------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `withheld`    | Hidden                  | P.O.S. exists as a system signal but is not exposed to the user because trust preconditions are not met.                                          |
| `provisional` | Shown with qualifier    | P.O.S. is shown but explicitly marked as a preliminary estimate. Evidence exists but is insufficient to remove the cap or confirm the trajectory. |
| `trusted`     | Shown as primary signal | P.O.S. is shown as a primary accountability signal. Sufficient evidence exists to make the score meaningful and directional.                      |

### 2.2 Mapping from scoring status to trust state

| Scoring Status                        | Trust State   | Reason                                                                                                                    |
| ------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `INFEASIBLE`                          | `withheld`    | An infeasible goal has no honest probability to show. Surfaces as feasibility failure, not P.O.S.                         |
| `disabled` (eligibility)              | `withheld`    | No active contract. Nothing to score.                                                                                     |
| `insufficient_evidence` (eligibility) | `withheld`    | Evidence count below minimum. Score would be meaningless.                                                                 |
| `NO_EVIDENCE`                         | `provisional` | Goal is activated and a plan exists, but execution has not started. Pre-execution estimate only.                          |
| `INELIGIBLE`                          | `provisional` | Execution has begun but < 7 evidence days. Score is real but too early to be trusted.                                     |
| `ELIGIBLE`                            | `trusted`     | 7+ evidence days, full scoring active, combined score unlocked.                                                           |
| `UNSCHEDULABLE`                       | `provisional` | Conflicts in plan. Score is penalized but the situation is recoverable. Show as provisional until conflicts are resolved. |

### 2.3 Trust state is the user-facing layer

Trust state governs UI presentation. Scoring status governs computation. They
are separate concerns.

The scoring engine must always produce a score and status for any goal with an
active contract and sufficient eligibility. The trust state layer then decides
whether and how that score is surfaced.

---

## Section 3 — P.O.S. Lifecycle

### 3.1 Admission (goal admitted, not yet activated)

**Rule:** P.O.S. is `withheld` at admission.

A goal that has been admitted but not yet activated into an active cycle does
not produce a user-facing P.O.S. The plan substance exists, but no
accountability relationship has been accepted. Showing P.O.S. at this stage
would be a pre-commitment signal, which is not honest about where risk lives.

The system may compute an internal feasibility estimate for admission gating
(INFEASIBLE blocks admission), but the probability signal itself is not
surfaced.

### 3.2 Activation (goal moved into active cycle with contract)

**Rule:** P.O.S. transitions to `NO_EVIDENCE → provisional` at activation.

When a goal is activated into an active cycle with an execution contract:

- The scoring window begins (`cycle_to_date` mode, starting at activation date)
- The initial plan-proof-based score is computed
- Trust state = `provisional`
- The 0.65 cap is active

The pre-execution P.O.S. is a structural estimate: it reflects plan intensity,
slack, and constraint density. It is honest but not evidenced. It should be
shown as `provisional`, not as a confidence-worthy score.

**Acceptance proof for this rule:** A goal with zero execution events must show
a score ≤ 0.65 with trust state = `provisional`. An activated goal with no
execution history must never show `trusted` P.O.S.

### 3.3 Early execution (< 7 evidence days)

**Rule:** P.O.S. remains `provisional` until 7 evidence days are crossed.

Execution events are accumulating. The scoring model is computing throughput
statistics. But with fewer than 7 days of data, the distribution is unstable.
The cap (0.65) remains, and the trust state remains `provisional`.

**Rationale:** 7 days of evidence represents approximately one full work-pattern
cycle. Below that, the user's throughput pattern is not yet established and the
statistics are unreliable. A 3-day sprint does not prove a sustained cadence.

### 3.4 Established execution (≥ 7 evidence days)

**Rule:** P.O.S. transitions to `trusted` at 7+ evidence days, for
internally-controlled families.

When the evidence window crosses 7 days:

- The 0.65 cap is removed
- The combined score (evidence + initial) / 2 is active
- Trust state = `trusted`
- The score becomes a primary accountability signal

**Exception for externally-mediated families:** See Section 5.

### 3.5 Deadline crossing

**Rule:** When the deadline passes with remaining work, P.O.S. → `withheld`
(terminal state).

A goal that has passed its deadline with incomplete work cannot have an honest
P.O.S. The feasibility check returns `INFEASIBLE` with reason `DEADLINE_PASSED`.
Trust state = `withheld`. The failure state is surfaced instead.

---

## Section 4 — Evidence Classes

### 4.1 Internal execution evidence

**Definition:** Completed work blocks that are directly within the user's
control.

Examples:

- Completed training session
- Completed draft chapter
- Completed study block
- Completed coding session

Internal execution evidence is the primary source of throughput data. Every
`completed = true` execution event in the scoring window contributes to `mu` and
`sigma`. This drives the current scoring model.

**Evidence quality rule:** Planning events, draft creation, and rescheduling do
NOT count as execution evidence. Only completed blocks count. This is already
enforced by the comment in `computeCompletedThroughput`: "Probability evidence =
completed execution only. Planning churn is ignored here by design."

### 4.2 External mediation events (not yet modeled)

**Definition:** Outcomes that depend on a third party's decision, not only the
user's effort.

Examples:

- Investor agrees to a meeting (Fundraising)
- Recruiter responds to application (JobSearchPipeline)
- Customer converts to paid (SalesPipeline)
- Submission is accepted by regulator (ProfessionalQualification — Licensure)

**Current state:** These events are not tracked separately. The current scoring
model treats all completed blocks equally, regardless of whether they represent
internal preparation (controllable) or external conversion (uncontrollable).

**Rule to implement:** For externally-mediated families, `trusted` trust state
requires both internal execution evidence (7+ days) AND at least one confirmed
external evidence event. See Section 5.

### 4.3 Evidence decay (not yet modeled)

**Current state:** The scoring window is fixed (`cycle_to_date` or rolling 14
days). Evidence from the start of the cycle is included equally with recent
evidence.

**Rule to implement:** Evidence decay is relevant when execution patterns drift
significantly mid-cycle. Old evidence from an active phase should not inflate
the score during a current inactive phase. The rolling window mode (14 days)
partially handles this, but `cycle_to_date` mode does not.

**Minimum rule:** When the user has missed all blocks for N consecutive days,
the score must reflect that gap, not historical throughput. The current model
handles this partially (missed days = 0 in the daily series, lowering mu), but
the rule should be made explicit:

- **Consecutive miss threshold:** 5+ workable days with no completed blocks →
  the moving average is dragged toward 0, which the normal CDF scoring naturally
  captures. This is already implicitly enforced.
- **Explicit rule:** No special override needed for consecutive misses — the
  throughput math handles it. The trust state does not need to degrade
  separately from the score. The score degrading is the signal.

---

## Section 5 — Family-Specific Trust Asymmetry

### 5.1 The asymmetry rule

**Internally-controlled families** — the user's own consistent execution is
sufficient evidence for trust state transition.

**Externally-mediated families** — the user's execution is necessary but not
sufficient. The outcome depends on a third party (investor, employer, customer,
regulator). Internal execution evidence does not prove conversion. Trust state
in these families must distinguish between "user is executing well" and
"external conversion is occurring."

### 5.2 Internally-controlled families

| Archetype                              | Trust asymmetry | Notes                                                                                                                                    |
| -------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| PhysicalTraining                       | None            | Training completion is the primary evidence. Performance benchmarks are measurable internally.                                           |
| SkillAcquisition                       | Minimal         | Evidence = blocks completed. Portfolio artifacts are measurable. External critique is informational, not a gate.                         |
| CreativeProduction                     | Minimal         | Evidence = draft/production blocks completed. Revision and completion are internally verifiable.                                         |
| ProfessionalQualification (exam-based) | Low             | Exam outcome is external, but readiness is internally measurable. P.O.S. should reflect preparation quality, not exam result prediction. |
| VentureLaunch (pre-launch)             | Low             | Build/design/prep work is internally controlled. Launch reception is external — but is post-goal in the planning horizon.                |
| BrandLaunch (production)               | Low             | Asset creation and content production are internal. Audience response is post-launch.                                                    |

For these families, the standard trust transition applies:
`withheld → provisional → trusted` at 7 evidence days.

### 5.3 Externally-mediated families

| Archetype         | External gate                            | Minimum external evidence for `trusted`                                                 |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| JobSearchPipeline | Employer response / interview invitation | At least 1 confirmed external-stage event (response, invitation, or screen completion)  |
| Fundraising       | Investor/donor commitment signal         | At least 1 confirmed meeting or commitment conversation                                 |
| SalesPipeline     | Buyer conversion signal                  | At least 1 qualified pipeline stage reached (e.g., proposal delivered, verbal interest) |

**Trust state rule for externally-mediated families:**

- 0–6 evidence days: `provisional` (same as internally-controlled)
- 7+ evidence days, **no external evidence event**: `provisional` — score is
  capped at 0.65 and labeled as reflecting preparation quality, not conversion
  probability
- 7+ evidence days, **at least 1 external evidence event**: `trusted` — cap
  removed, full scoring active

**Rationale:** A job seeker who has sent 50 applications is executing well. But
if zero applications have received a response, the probability of success is not
the same as an execution score suggests. The external evidence gate prevents the
model from rewarding internal preparation as if it were conversion progress.

**Implementation requirement:** External evidence events are a new event type
that must be defined and tracked separately from execution blocks. They are not
currently tracked in `executionEvents`. This is a new data model requirement for
P.O.S. hardening.

**Minimum external evidence event schema (to define):**

```
{
  type: 'external_evidence',
  goalId: string,
  cycleId: string,
  dateISO: string,
  familyClass: 'externally_mediated',
  stage: string,           // e.g., 'first_response', 'meeting_scheduled', 'verbal_interest'
  evidenceLabel: string,   // human-readable description
  confirmed: boolean
}
```

---

## Section 6 — Drift and Missed Block Effects

### 6.1 How the current model handles misses

The scoring model naturally degrades when blocks are missed:

- Each day with 0 completed blocks contributes 0 to the throughput series
- This lowers `mu`, potentially increases `sigma`
- The normal CDF score decreases as `D × mu` diverges from
  `remainingBlocksTotal`

This is correct and needs no change. The score degrades honestly when execution
stalls.

### 6.2 Drift detection (existing, partially separate)

The `driftSignalDetector.ts` engine produces drift signals (e.g.,
`CONSISTENCY_FAILURE`, `CAPACITY_MISMATCH`) based on execution patterns. These
feed into the recovery recommendation engine.

**Rule:** Drift signals do not directly change the P.O.S. score. They inform
recovery recommendations. The P.O.S. score changes because the throughput
statistics change, not because drift was labeled.

This separation is correct and should be preserved.

### 6.3 Recovery actions and P.O.S.

**Current state:** Accepting a recovery option changes the forward contract
(e.g., extends deadline, reduces scope). This changes the feasibility inputs,
which changes the initial probability estimate and potentially the required
blocks remaining. The scoring model will naturally update.

**Rule:** Recovery acceptance does not automatically restore trust state. Trust
state is earned through execution after recovery, not through the act of
renegotiating.

- If scope is reduced and the goal is now feasible: `provisional` state
  continues, trust re-earned through subsequent execution
- If deadline is extended: the feasibility score may improve, but evidence
  window continues from where it was. Old missed blocks still count in the
  throughput statistics.
- If recovery restores feasibility but execution remains zero: trust state
  remains `provisional` at best

**Rationale:** A user who accepts 3 consecutive recovery options without
resuming execution should not be shown an improving P.O.S. Renegotiation without
execution is not evidence of success.

**Acceptance proof:** After a recovery option is applied, the next P.O.S. score
must not be higher than the pre-recovery score unless new completed execution
events exist in the window.

---

## Section 7 — User-Facing P.O.S. Policy

### 7.1 When P.O.S. is appropriate to surface

P.O.S. is a user-facing accountability signal, not a system-internal metric. The
following rules govern when it should be shown.

**Show P.O.S.:**

- Trust state = `provisional`: show score with explicit qualifier (e.g.,
  "Pre-execution estimate" or "Early-stage estimate — building confidence")
- Trust state = `trusted`: show score as primary signal without qualifier

**Do not show P.O.S.:**

- Trust state = `withheld`: surface feasibility failure or inactive state
  instead
- Goal is in draft (not activated): no P.O.S. surface
- Goal contract is disabled or expired: no P.O.S. surface

### 7.2 The cap is a honesty rule, not a presentation choice

The 0.65 cap for `NO_EVIDENCE` and `INELIGIBLE` states is a correctness rule. It
must not be removed for presentation purposes. A pre-execution goal that shows
80%+ P.O.S. is lying to the user.

The cap applies regardless of how well-structured the plan is. A tightly-scoped
plan with generous slack can earn a high initial estimate — but it will
correctly cap at 0.65 until execution proves the rate is sustainable.

### 7.3 P.O.S. is not a completion percentage

P.O.S. measures the probability that remaining work will be completed by the
deadline given observed throughput. It is not a measure of how much work has
been done.

A goal that is 80% complete with 1 day remaining and 20% of required work still
outstanding may have a low P.O.S. A goal that is 20% complete with generous time
and pace may have a higher P.O.S.

This distinction must be preserved in any user-facing language around P.O.S.

### 7.4 Externally-mediated goals require honest language

For externally-mediated families (JobSearchPipeline, Fundraising,
SalesPipeline), the P.O.S. in `provisional` state (no external evidence yet)
should be labeled to reflect that it measures preparation quality, not
conversion probability.

Example qualifier for provisional externally-mediated P.O.S.:

> "Reflects execution quality of preparation activities. Conversion probability
> requires external response evidence."

This prevents the system from appearing to predict whether an investor will say
yes or an employer will extend an offer.

---

## Section 8 — Acceptance Proofs

These are the concrete acceptance criteria that define when each P.O.S.
hardening item is done.

| ID      | Rule                                                                                                                       | Acceptance Proof                                                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POS-001 | Trust state exists as an explicit output                                                                                   | `scoreGoalSuccessProbability()` returns a `trustState` field with value `withheld / provisional / trusted`                                                         |
| POS-002 | P.O.S. is `withheld` at admission                                                                                          | Test: admitted goal with no active cycle → trust state = `withheld`                                                                                                |
| POS-003 | P.O.S. is `provisional` at activation with NO_EVIDENCE                                                                     | Test: activated goal, zero execution events → trust state = `provisional`, score ≤ 0.65                                                                            |
| POS-004 | P.O.S. transitions to `trusted` at 7 evidence days for internally-controlled families                                      | Test: PhysicalTraining / CreativeProduction goal with 7 completed blocks across 7 days → trust state = `trusted`, cap removed                                      |
| POS-005 | Externally-mediated families stay `provisional` at 7 evidence days without external evidence event                         | Test: JobSearchPipeline goal with 10 execution blocks across 7 days, zero external evidence events → trust state = `provisional`, score ≤ 0.65                     |
| POS-006 | Externally-mediated families transition to `trusted` on first confirmed external evidence event + 7 internal evidence days | Test: same goal with one confirmed `external_evidence` event added → trust state = `trusted`, cap removed                                                          |
| POS-007 | Recovery acceptance does not restore `trusted` state without new execution                                                 | Test: goal with drift → recovery applied → no new execution events → trust state must not improve vs pre-recovery                                                  |
| POS-008 | P.O.S. is `withheld` when deadline is passed with remaining work                                                           | Test: deadline passed, remainingBlocksTotal > 0 → trust state = `withheld`, feasibility failure surfaced                                                           |
| POS-009 | Provisional P.O.S. carries a qualifier label                                                                               | UI test: any goal with trust state = `provisional` has a qualifier label in the P.O.S. display                                                                     |
| POS-010 | Externally-mediated provisional P.O.S. carries a preparation-quality qualifier                                             | UI test: JobSearchPipeline / Fundraising / SalesPipeline with trust state = `provisional` shows preparation-quality qualifier, not conversion-probability language |

---

## Section 9 — Implementation Sequence

Items ordered by dependency.

### Wave 1 — Foundation (unblocks all other work)

1. **POS-001:** Add `trustState` field to `ProbabilityResult` type in
   `probabilityScore.ts`
2. Implement `deriveTrustState()` function that maps scoring status +
   eligibility + family class → trust state
3. **POS-002 + POS-003 + POS-008:** Wire trust state into
   admission/activation/deadline lifecycle (tests: POS-002, POS-003, POS-008)

### Wave 2 — Externally-mediated family gating

4. Define `external_evidence` event type and schema
5. Add external evidence event tracking to `executionEvents` or a separate
   `externalEvidenceEvents` array
6. **POS-005 + POS-006:** Update `deriveProbabilityStatus()` to check for
   external evidence events when goal is in an externally-mediated archetype.
   Tests: POS-005, POS-006.
7. Add `familyClass: 'internally_controlled' | 'externally_mediated'` to goal
   contract or archetype resolution path

### Wave 3 — Recovery and drift rules

8. **POS-007:** Enforce no-trust-restoration rule after recovery without
   execution. Test: POS-007.

### Wave 4 — User-facing policy

9. **POS-009 + POS-010:** Surface trust state and qualifier labels in the P.O.S.
   display components. Tests: POS-009, POS-010.

---

## Section 10 — What Does Not Change

The following aspects of the current P.O.S. model are correct and should not
change during hardening:

1. **Evidence = completed execution only.** Planning churn does not count. This
   is already enforced.
2. **The 0.65 cap for NO_EVIDENCE and INELIGIBLE states.** This is a correctness
   rule.
3. **INFEASIBLE → score = 0.** An infeasible goal has no honest probability.
4. **The normal CDF scoring formula.** This is the correct probabilistic model
   for the throughput prediction problem.
5. **Cycle_to_date as the default window mode.** The full cycle window is the
   right evidence scope for a goal with an active contract.
6. **Drift signals and scoring are separate.** Drift detection informs recovery.
   Scoring reflects throughput. They must not be merged.
7. **Renegotiation changes the forward contract only.** Historical evidence is
   preserved. Recovery options do not rewrite the execution past.

---

## One-Line Summary

**P.O.S. hardening makes the probability signal honest about what it has
actually measured: internally-controlled execution is not the same as
externally-validated conversion, and plan quality does not substitute for
execution evidence.**
