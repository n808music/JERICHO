# JERICHO_OUTCOME_VALIDITY_GATE_SPEC.md

## Status

**Draft — gate specification**  
Depends on: JERICHO_TERMINAL_OUTCOME_AUTHORITY_FRAMEWORK.md  
Grounded in: audit pack evidence ST-01 through LT-04  
Date: 2026-04-06

---

## Problem statement

The current quality gate (`evaluatePlanQualityGate`) performs one class of
check: **plan structural validity**. It verifies that deliverables are specific
enough (not generic phase labels), that the action layer exists, and that lineage
is intact. These checks are necessary. They are not sufficient.

The audit pack has established two categories of gate failure that the current
checks cannot detect:

### Category A — Wrong archetype passes

A structurally valid plan for the wrong outcome passes the gate. The deliverables
are specific, the actions are linked, the lineage is complete — but the plan
covers a different goal dimension than the one stated.

Observed instances:
- LT-02: SkillAcquisition plan passes for a goal requiring a job offer
- LT-03: SkillAcquisition plan passes for a pure hiring goal

### Category B — Corridor truncation passes

A structurally valid plan that stops before the terminal corridor is complete
passes the gate. The deliverables cover preparation but not the stage where the
terminal event can occur.

Observed instances:
- LT-04: packagePrepMode fundraising plan (thesis, deck, targets, outreach
  readiness) passes for a goal requiring "signed investment agreement received"
  and "wire transfer confirmed." The plan stops before investor contact begins.

Both categories have the same root: the gate has no concept of **outcome
validity** — whether the plan actually spans the causal path to the stated
terminal event.

This specification defines the **Outcome Validity Gate**: a second gate layer
that runs after structural validation and checks outcome coverage independently.

---

## Gate architecture

### Current gate (structural validity)

```
evaluatePlanQualityGate(input) → {
  status: 'PLAN_QUALITY_PASSED' | 'PLAN_QUALITY_WITHHELD'
  failureCodes: PlanQualityFailureCode[]
}
```

Checks:
- Deliverable specificity (not `DELIVERABLE_TOO_GENERIC`)
- Action layer presence
- Lineage integrity
- Major component coverage (e.g., episode N for episodic goals)

### Proposed outcome validity layer

The outcome validity layer runs independently and produces its own result.
It does not modify the structural gate result. The two results compose to
produce the final gate verdict.

```
evaluateOutcomeValidityGate(input) → {
  status: 'OUTCOME_VALID' | 'OUTCOME_VALIDITY_DEGRADED' | 'OUTCOME_VALIDITY_WITHHELD'
  failureCodes: OutcomeValidityFailureCode[]
  authorityClass: TerminalOutcomeAuthority
  corridorCoverage: CorridorCoverageResult
}
```

**Combined verdict:**

| Structural gate | Outcome validity | Final status |
|----------------|-----------------|--------------|
| PASS | OUTCOME_VALID | `PLAN_QUALITY_PASSED` |
| PASS | OUTCOME_VALIDITY_DEGRADED | `PLAN_QUALITY_PASSED_WITH_OUTCOME_WARNING` |
| PASS | OUTCOME_VALIDITY_WITHHELD | `PLAN_QUALITY_WITHHELD` |
| WITHHELD | any | `PLAN_QUALITY_WITHHELD` |

---

## Outcome Validity failure codes

```typescript
type OutcomeValidityFailureCode =
  | 'OUTCOME_COVERAGE_MISSING_TERMINAL_CORRIDOR'
  | 'OUTCOME_COVERAGE_PREP_ONLY'
  | 'OUTCOME_AUTHORITY_UNACKNOWLEDGED'
  | 'OUTCOME_EXTERNAL_DEPENDENCY_UNREPRESENTED'
  | 'OUTCOME_VERIFICATION_TEXT_NOT_COVERED'
  | 'OUTCOME_MIXED_AUTHORITY_PARTIAL_COVERAGE';
```

### `OUTCOME_COVERAGE_MISSING_TERMINAL_CORRIDOR`

The plan does not contain deliverables for all required corridor stages given
the goal's authority class.

**Fires when:**
- Authority class is `externally_mediated` AND deliverables do not include a
  direct-contact stage (investor meeting, employer interview, client pitch)
- Authority class is `market_dependent` AND deliverables do not include a
  distribution or reach mechanism stage
- Authority class is `fully_controllable` AND deliverables do not span from
  preparation to the completion artifact

**Severity:** `OUTCOME_VALIDITY_WITHHELD` for `externally_mediated` and
`market_dependent`. `OUTCOME_VALIDITY_DEGRADED` for `fully_controllable`.

### `OUTCOME_COVERAGE_PREP_ONLY`

The plan contains only preparation deliverables and stops before any external
contact or execution of the delivery mechanism.

**Fires when:**
- Authority class is `externally_mediated` AND no deliverable covers the stage
  where the user submits, presents, or contacts the external party
- Authority class is `market_dependent` AND no deliverable covers the
  distribution/publication stage

**This is the RC-25 condition.** A fundraising plan that stops at readiness
review fires `OUTCOME_COVERAGE_PREP_ONLY`. A job-search plan that stops at
resume preparation fires it too.

**Severity:** `OUTCOME_VALIDITY_WITHHELD`

**Detection heuristic:** scan deliverable titles for contact/submission verbs:
`submit`, `send`, `pitch`, `publish`, `apply`, `meet with`, `outreach`, `contact`,
`present to`. If none are present and authority class is `externally_mediated`
or `market_dependent`, fire the code.

### `OUTCOME_AUTHORITY_UNACKNOWLEDGED`

The plan passes the structural gate and covers the full corridor but does not
acknowledge that the terminal event is externally controlled.

**Fires when:**
- Authority class is `externally_mediated` AND no deliverable, action, or
  plan note explicitly acknowledges that the terminal event requires external
  decision

**Severity:** `OUTCOME_VALIDITY_DEGRADED` — the plan is structurally honest
and covers the corridor, but it presents itself as if executing the plan is
sufficient for the outcome. The gap is in the trust model, not the plan content.

**Note:** This code is aspirational given current system architecture. It
requires the plan representation layer to support acknowledgment notes or
terminal event descriptors. Until that exists, this code cannot fire reliably.

### `OUTCOME_EXTERNAL_DEPENDENCY_UNREPRESENTED`

No deliverable spans the decision-wait or decision-response stage — the period
after external contact is made and before the terminal event occurs.

**Fires when:**
- Authority class is `externally_mediated` AND the plan contains outreach/contact
  deliverables but no deliverable representing response management, follow-up,
  or decision-stage handling

**Rationale:** In externally mediated goals, the decision-wait stage is
structurally significant. "Submit applications" without "Log responses and
manage active processes" is a plan that treats the external party's decision
as automatic. The follow-up and response management stage is where the user
can still influence the probability of a positive outcome — it is not fully
externally controlled. Its absence signals that the plan does not take the
externally mediated nature of the goal seriously.

**Severity:** `OUTCOME_VALIDITY_DEGRADED`

### `OUTCOME_VERIFICATION_TEXT_NOT_COVERED`

The plan does not contain deliverables that represent all outcome clauses in
the verification text.

**Fires when:**
- The verification text contains multiple distinct outcome clauses AND at least
  one clause has no deliverable that plausibly addresses it

**This is the RC-18 condition from LT-02.** "3 portfolio projects deployed"
has deliverable coverage; "junior software engineer offer letter received" has
none. The gate should detect this gap.

**Implementation approach:**
1. Parse verification text into outcome clauses (split on periods, "and",
   "with at least", semicolons)
2. For each clause, check whether any deliverable title contains semantically
   related terms
3. Flag clauses with zero coverage

**Severity:** `OUTCOME_VALIDITY_WITHHELD` when a clause represents the primary
terminal event (e.g., offer letter, signed agreement). `OUTCOME_VALIDITY_DEGRADED`
when a clause represents a supporting or secondary outcome.

### `OUTCOME_MIXED_AUTHORITY_PARTIAL_COVERAGE`

The goal has mixed authority class (e.g., `fully_controllable` + `externally_mediated`)
and the plan covers the controllable dimension but not the externally mediated
dimension.

**Fires when:**
- Authority class is `mixed` AND the plan contains deliverables for the
  `fully_controllable` outcome dimension but not the `externally_mediated` dimension

**This is the LT-02 pattern.** SkillAcquisition plan covers portfolio building;
no deliverable covers the job search pipeline.

**Severity:** `OUTCOME_VALIDITY_WITHHELD`

---

## Corridor stage requirements by authority class

### `fully_controllable`

Required stages:
1. **Setup/preparation** — scoping, baseline, tooling
2. **Execution** — the primary work that produces the artifact
3. **Completion** — the deliverable is in its final form, verifiable

Gate passes if: deliverables span stages 1–3.  
Gate fires `OUTCOME_COVERAGE_MISSING_TERMINAL_CORRIDOR` if execution or
completion stage is absent.

### `externally_mediated`

Required stages:
1. **Preparation** — controllable artifacts that enable the contact stage
2. **Direct contact** — user submits, applies, pitches, or presents to the
   external party
3. **Decision-wait / response management** — user handles follow-up, manages
   the external party's evaluation process
4. **Terminal event acknowledgment** — the plan explicitly represents that the
   external party must decide (this may be a plan note or policy acknowledgment,
   not a user-executable deliverable)

Gate passes with `OUTCOME_VALID` if: deliverables span stages 1–3 AND stage 4
is acknowledged (or the system emits `OUTCOME_AUTHORITY_UNACKNOWLEDGED` with
degraded status if stage 4 is missing but stages 1–3 are present).

Gate fires `OUTCOME_COVERAGE_PREP_ONLY` if only stage 1 is present.  
Gate fires `OUTCOME_COVERAGE_MISSING_TERMINAL_CORRIDOR` if stage 2 or 3 is absent.

### `market_dependent`

Required stages:
1. **Preparation** — content, product, or service ready for distribution
2. **Distribution / reach mechanism** — the channel or mechanism that puts the
   preparation in front of the target population
3. **Iteration / response** — adjusting based on market response
4. **Measurement / tracking** — monitoring progress toward the threshold metric

Gate passes if: deliverables span stages 1–4.  
Gate fires `OUTCOME_COVERAGE_MISSING_TERMINAL_CORRIDOR` if distribution stage
is absent (preparation-only plan for a market-dependent goal).

### `mixed`

Apply the requirements of the most restrictive authority class present. A goal
with both `fully_controllable` and `externally_mediated` dimensions must satisfy
the `externally_mediated` corridor requirements in addition to the
`fully_controllable` ones.

If either dimension has zero deliverable coverage, fire
`OUTCOME_MIXED_AUTHORITY_PARTIAL_COVERAGE`.

---

## Trust state implications

### Trust state definitions (extended)

| State | Current meaning | Authority-aware meaning |
|-------|----------------|------------------------|
| `trusted` | Plan clean, evidence sufficient | Plan clean, evidence sufficient, AND terminal event is `fully_controllable` or external decision has been recorded |
| `provisional` | Plan degraded or evidence thin | (narrowed — see below) |
| `provisional_external` | NEW | Plan structurally clean, corridor covered, terminal event externally mediated, external decision not yet recorded |
| `provisional_market` | NEW | Plan structurally clean, distribution active, threshold metric not yet confirmed |
| `withheld` | Intake blocked or plan policy blocked | No change |

**Narrowing of `provisional`:**

The existing `provisional` state results from structural plan degradation
(assumptions, missing boundary, missing execution graph). It should not be
reachable for `externally_mediated` goals that have full corridor coverage —
those should reach `provisional_external` instead, which has a different
resolution path.

**Resolution paths:**

- `provisional` resolves when: plan structure improves (boundary resolved,
  starting state confirmed, execution graph present)
- `provisional_external` resolves when: external decision event is recorded
  (offer accepted, commitment signed, agreement received)
- `provisional_market` resolves when: threshold metric is confirmed from
  evidence (listener count verified, MRR confirmed)

---

## Gate refusal conditions

**Unconditional `OUTCOME_VALIDITY_WITHHELD`:**

1. `OUTCOME_COVERAGE_PREP_ONLY` fires — plan stops before external contact
   for `externally_mediated` or `market_dependent` goal
2. `OUTCOME_COVERAGE_MISSING_TERMINAL_CORRIDOR` fires with missing contact
   stage — plan does not reach the external party at all
3. `OUTCOME_VERIFICATION_TEXT_NOT_COVERED` fires on primary terminal outcome
   clause

**`OUTCOME_VALIDITY_DEGRADED` (plan passes with warning):**

1. `OUTCOME_EXTERNAL_DEPENDENCY_UNREPRESENTED` fires — outreach present but
   no follow-up/response management
2. `OUTCOME_AUTHORITY_UNACKNOWLEDGED` fires — corridor covered but external
   dependency not explicitly acknowledged
3. `OUTCOME_VERIFICATION_TEXT_NOT_COVERED` fires on secondary outcome clause

---

## Prep-only insufficiency condition (RC-25 formalization)

The **prep-only insufficiency condition** fires when ALL of the following are true:

1. Goal authority class is `externally_mediated` or `market_dependent`
2. Deliverable titles contain no contact/submission/distribution verbs:
   `submit`, `apply`, `send`, `pitch`, `publish`, `contact`, `present to`,
   `outreach to`, `meet with`, `distribute`, `launch`, `release`, `broadcast`
3. All deliverables use preparation verbs only:
   `define`, `build`, `prepare`, `create`, `establish`, `develop`, `design`,
   `research`, `audit`, `review`, `plan`, `draft`, `finalize` (in isolation)

When this condition fires, emit `OUTCOME_COVERAGE_PREP_ONLY` and set
`OUTCOME_VALIDITY_WITHHELD`.

**Note:** "Finalize legal close process" would trigger this in the fundraising
packagePrepMode — "finalize" is a preparation verb when applied to a process
the user controls, and the plan has no "meet with", "pitch", or "outreach to"
deliverable. The full pipeline does not trigger this because "Run first wave
of investor outreach and meetings" contains "outreach" and "meetings."

---

## Examples across goal classes

### Hiring goal (LT-03) — current gate result vs. required

**Current:** `PLAN_QUALITY_PASSED` (structural gate passes)  
**Required on correct path:** `PLAN_QUALITY_PASSED_WITH_OUTCOME_WARNING`
— authority is `externally_mediated`, corridor is covered (target → materials
→ applications → interviews → follow-up), but `OUTCOME_AUTHORITY_UNACKNOWLEDGED`
fires because no deliverable explicitly frames the offer as contingent on
employer decision

**Required on skill_acquisition contamination path:** `PLAN_QUALITY_WITHHELD`
— `OUTCOME_VERIFICATION_TEXT_NOT_COVERED` fires because "offer letter received"
has no deliverable coverage

### Fundraising goal (LT-04) — full pipeline vs. prep-only

**Full pipeline, current:** `PLAN_QUALITY_PASSED`  
**Full pipeline, required:** `PLAN_QUALITY_PASSED_WITH_OUTCOME_WARNING`
— corridor covered (thesis → deck → outreach → meetings → follow-up → close),
`OUTCOME_AUTHORITY_UNACKNOWLEDGED` fires

**Prep-only (packagePrepMode), current:** `PLAN_QUALITY_PASSED`  
**Prep-only, required:** `PLAN_QUALITY_WITHHELD`
— `OUTCOME_COVERAGE_PREP_ONLY` fires: no meeting, no contact, no close stage

### Dual-outcome goal (LT-02, SkillAcquisition path)

**Current:** `PLAN_QUALITY_PASSED`  
**Required:** `PLAN_QUALITY_WITHHELD`
— `OUTCOME_MIXED_AUTHORITY_PARTIAL_COVERAGE` fires: "offer letter received"
clause in verification text has zero deliverable coverage

### Podcast goal (LT-01)

**Current:** `PLAN_QUALITY_WITHHELD` on PUBLISH and CreativeProduction paths
(episode coverage gap). `PLAN_QUALITY_WITHHELD` on episodic_production path
(missing action descendants — probe artifact)  
**Required:** No change — growth/listener outcome should additionally fire
`OUTCOME_COVERAGE_MISSING_TERMINAL_CORRIDOR` (no distribution mechanism
deliverable for the `market_dependent` listener dimension)

---

## Implementation priority

**Phase 1 — detection only (no gate behavior change):**

Add `terminalOutcomeAuthority` derivation to `buildGoalIntakeContract`. Log
the classification. Do not yet use it to alter gate behavior. This establishes
the field and its detection heuristics without changing any existing gate
verdicts.

**Phase 2 — `OUTCOME_COVERAGE_PREP_ONLY` check:**

This is the highest-severity gap (RC-25). Implement the prep-only insufficiency
condition. This will cause current packagePrepMode fundraising plans and
preparation-only job-search plans to receive `OUTCOME_VALIDITY_WITHHELD`. Only
affects `externally_mediated` and `market_dependent` goals.

**Phase 3 — `OUTCOME_VERIFICATION_TEXT_NOT_COVERED` check:**

Parse verification text into clauses. For each clause, verify deliverable
coverage. This closes the RC-18 (LT-02 dual-outcome) and wrong-archetype blind
spots. Most likely to affect mixed-authority goals.

**Phase 4 — corridor completeness checks:**

Full corridor stage validation by authority class. Emit
`OUTCOME_COVERAGE_MISSING_TERMINAL_CORRIDOR` and
`OUTCOME_EXTERNAL_DEPENDENCY_UNREPRESENTED`.

**Phase 5 — trust state extension:**

Add `provisional_external` and `provisional_market` to `posTrust` state type.
Update `evaluateInitialFeasibility` and trust evaluation logic to use authority
class. Requires Phase 1 to be stable.

---

## Dependencies and integration points

### `GoalIntakeContract`

New field: `terminalOutcomeAuthority: TerminalOutcomeAuthority`  
Populated by: `buildGoalIntakeContract` via detection heuristics from goal text
and verification criteria  
Used by: `evaluateOutcomeValidityGate`, `buildGoalPolicySnapshot`

### `evaluatePlanQualityGate`

Current signature:
```typescript
evaluatePlanQualityGate(input: {
  goalText: string;
  verificationText: string;
  deliverables: Deliverable[];
  actions: Action[];
}) → PlanQualityGateResult
```

Extended with authority-aware checks. `verificationText` parsing for clause
extraction is new work.

### `buildGoalPolicySnapshot`

`posTrust` evaluation must receive `terminalOutcomeAuthority` from intake
contract and apply trust ceiling logic. Trust ceiling should be applied before
structural evaluation — a structurally `trusted` plan with authority class
`externally_mediated` should be downgraded to `provisional_external`.

### `GoalPolicy.ts` — new reason codes

```typescript
| 'OUTCOME_COVERAGE_MISSING_TERMINAL_CORRIDOR'
| 'OUTCOME_COVERAGE_PREP_ONLY'
| 'OUTCOME_AUTHORITY_UNACKNOWLEDGED'
| 'OUTCOME_EXTERNAL_DEPENDENCY_UNREPRESENTED'
| 'OUTCOME_VERIFICATION_TEXT_NOT_COVERED'
| 'OUTCOME_MIXED_AUTHORITY_PARTIAL_COVERAGE'
```

---

## What this spec does not address

1. **Recording terminal events:** The mechanism by which a user records "offer
   received" or "investment signed" is a UX concern outside this spec. This spec
   only defines the gate and trust logic assuming that event either has or has
   not been recorded.

2. **Probability modeling:** For `market_dependent` goals, a progress probability
   could be derived from leading indicators (applications submitted, listener
   growth rate). This spec treats `market_dependent` trust as binary
   (threshold reached or not reached) — probability integration is deferred.

3. **Rejection handling:** A plan for an `externally_mediated` goal where multiple
   external contacts have been made and all have declined is not in its current
   form a failed plan — it may require strategy revision. The trust model does
   not currently represent "external contacts made, insufficient positive
   responses." This is an open question in the authority framework.

4. **Verification text parsing robustness:** Clause extraction from verification
   text is heuristic. Complex sentences may not split cleanly. Edge cases (e.g.,
   conjunctions within a single clause, conditional statements) require test
   coverage before Phase 3 implementation.
