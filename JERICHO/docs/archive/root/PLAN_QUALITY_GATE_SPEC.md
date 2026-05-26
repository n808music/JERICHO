# PLAN_QUALITY_GATE_SPEC.md

## Purpose

Define a deterministic pre-feasibility quality gate so Jericho does not generate
credibility-bearing feasibility or P.O.S. from incomplete, ambiguous, or
semantically hollow plans.

This spec formalizes:

- gate order
- gate pass/fail definitions
- stable failure codes
- scoring/withholding rules
- a repeatable observation rubric for test goals

---

## Core Rule

**Feasibility and P.O.S. are downstream outputs, not first-order outputs.**

The system must not issue a credibility-bearing feasibility judgment unless the
plan first satisfies deterministic plan-quality gates.

A plan may be schedulable and still be invalid.

Therefore:

- **plan validity precedes schedule validity**
- **schedule validity precedes credibility-bearing P.O.S.**

---

## Canonical Evaluation Order

### Stage 1 — Coverage Integrity

Determine whether the generated plan covers the full semantic scope of the goal.

### Stage 2 — Deliverable Specificity

Determine whether deliverables preserve the goal object and are semantically
meaningful on their own.

### Stage 3 — Action / Block Lineage Integrity

Determine whether execution artifacts clearly inherit meaning from the
deliverables and the goal.

### Stage 4 — Feasibility Admission

Only plans that pass Stages 1–3 are eligible for final feasibility evaluation.

### Stage 5 — P.O.S. Admission

Only plans that pass Stages 1–4 are eligible for credibility-bearing P.O.S.

---

## Output States

Every plan must resolve to one of these states before final surface
presentation.

### `PLAN_QUALITY_PASSED`

Plan is complete enough, specific enough, and semantically coherent enough to
enter feasibility evaluation.

### `PLAN_QUALITY_WITHHELD`

Plan failed one or more quality gates. Final feasibility/P.O.S. must be
withheld.

### `PLAN_QUALITY_PROVISIONAL`

Optional transitional state for internal diagnostics only. This may be used
during development to indicate that the plan is partially structured but not yet
admissible for trusted feasibility.

For 1.0 user-facing truth, prefer:

- passed
- withheld

not nuanced soft states.

---

## Deterministic Gates

# Gate 1 — Coverage Integrity

## Goal

Ensure the plan covers the full goal rather than a reduced surrogate.

## Pass Condition

A plan passes Coverage Integrity only if:

1. all major goal components are represented in deliverables, and
2. no essential project track is dropped, and
3. each required deliverable area has descendant actions or blocks, and
4. the plan does not collapse a multi-part goal into a partial subset without
   explicit acknowledgment.

## Fail Condition

Fail if any major goal component implied by the goal is absent from deliverables
or absent from execution descendants.

## Stable Failure Codes

### `PLAN_COVERAGE_MISSING_MAJOR_COMPONENT`

One or more major goal components are not represented at all.

Examples:

- 3 project streams implied, only 2 represented
- build + launch + outreach requested, outreach absent

### `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH`

A major component exists conceptually but has no deliverable branch.

### `PLAN_COVERAGE_MISSING_EXECUTION_DESCENDANTS`

Deliverable exists, but no actions/blocks descend from it.

### `PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE`

The generated plan silently narrows the goal into a smaller implied goal.

## Withholding Rule

If any Gate 1 code is present:

- final feasibility = withheld
- final P.O.S. = withheld

---

# Gate 2 — Deliverable Specificity

## Goal

Ensure deliverables preserve the “what” of the goal rather than becoming generic
planning shells.

## Pass Condition

A deliverable passes only if it is understandable as a goal-relevant artifact on
its own and explicitly preserves the object of work.

Each deliverable must answer:

- what is being produced, configured, learned, prepared, built, or completed
- in relation to what concrete goal object

A valid deliverable should remain meaningful even when read outside the
surrounding paragraph.

## Fail Condition

Fail if the deliverable is structurally formatted but semantically incomplete.

## Stable Failure Codes

### `DELIVERABLE_OBJECT_MISSING`

The deliverable omits the object of work.

Examples:

- “notes on 5 core examples”
- “practice environment configured”
- “reference sheet with 20 key terms”

without specifying examples of what, environment for what, terms for what.

### `DELIVERABLE_TOO_GENERIC`

The deliverable could apply to many unrelated goals with no goal-specific
anchor.

### `DELIVERABLE_GOAL_DISCONNECTED`

The deliverable does not clearly map back to the originating goal.

### `DELIVERABLE_SEMANTIC_HOLLOWNESS`

The deliverable has formal planning shape but insufficient semantic substance.

## Withholding Rule

If any Gate 2 code is present:

- final feasibility = withheld
- final P.O.S. = withheld

---

# Gate 3 — Action / Block Lineage Integrity

## Goal

Ensure blocks inherit meaning from deliverables and remain visibly connected to
the goal.

## Pass Condition

Actions and blocks pass only if a reviewer can tell:

- what work is being done
- for which deliverable
- toward which goal object

A block must not feel like a generic productivity task detached from plan
substance.

## Fail Condition

Fail if action/block labels are generic, semantically detached, or not visibly
grounded in the deliverable branch.

## Stable Failure Codes

### `ACTION_LINEAGE_BROKEN`

Action does not clearly map to a deliverable.

### `BLOCK_LINEAGE_BROKEN`

Block does not clearly map to action/deliverable/goal lineage.

### `BLOCK_TOO_GENERIC`

Block label could belong to many unrelated goals.

Examples:

- “review notes”
- “practice examples”
- “set up environment” with no retained object.

### `BLOCK_GOAL_OBJECT_MISSING`

The execution block omits the target object of work.

### `LINEAGE_VISIBLE_MEANING_LOSS`

The internal lineage may exist, but the rendered label loses the meaning needed
for user trust and plan validation.

## Withholding Rule

If any Gate 3 code is present:

- final feasibility = withheld
- final P.O.S. = withheld

---

# Gate 4 — Feasibility Admission

## Goal

Restrict final feasibility evaluation to plans that have already passed quality
gates.

## Pass Condition

Gate 4 may be evaluated only if Gates 1–3 passed.

Then standard feasibility checks may run:

- capacity fit
- temporal fit
- dependency coherence
- conflict/overflow behavior
- schedule distribution reasonableness

## Fail Condition

Fail if the plan either:

1. was not admitted due to upstream gate failure, or
2. fails actual scheduling constraints after admission.

## Stable Failure Codes

### Admission Codes

#### `FEASIBILITY_NOT_ADMITTED_PLAN_QUALITY_WITHHELD`

Feasibility cannot be evaluated credibly because the plan failed upstream
quality gates.

### Scheduling Codes

Existing deterministic feasibility/scheduling codes should remain separate from
plan-quality failures.

Examples:

- `NO_ACTION_GRAPH`
- `NO_PROPOSED_BLOCKS`
- overflow/conflict codes
- missing throughput/capacity codes

## Surface Rule

If Gate 4 is blocked by plan-quality withholding, the system must not surface a
normal feasibility score as if it were trustworthy.

Allowed output:

- withheld
- not admitted
- provisional internal diagnostic only

Not allowed:

- normal confidence score presented as authoritative

---

# Gate 5 — P.O.S. Admission

## Goal

Restrict P.O.S. to plans whose structure and schedule are both admissible.

## Pass Condition

P.O.S. may be produced only if:

- Gate 1 passed
- Gate 2 passed
- Gate 3 passed
- Gate 4 admitted and completed

## Fail Condition

Fail if any upstream gate failed or feasibility was not admitted.

## Stable Failure Codes

### `POS_NOT_ADMITTED_PLAN_QUALITY_WITHHELD`

### `POS_NOT_ADMITTED_FEASIBILITY_WITHHELD`

### `POS_NOT_ADMITTED_INCOMPLETE_PLAN_SUBSTRATE`

## Surface Rule

If P.O.S. is not admitted, the system must explicitly withhold it rather than
backfilling a weak forecast from an incomplete substrate.

---

## Gate Precedence

When multiple failures are present, precedence should resolve as follows:

1. Coverage Integrity failures
2. Deliverable Specificity failures
3. Lineage Integrity failures
4. Feasibility admission failures
5. Feasibility runtime failures
6. P.O.S. admission failures

Reason: The earliest structural truth failure is the canonical reason the plan
cannot be trusted.

---

## Deterministic Adjudication Rules

## Rule 1 — Partial plans cannot receive final feasibility

If the goal implies missing project branches, the plan is incomplete even if
existing branches schedule cleanly.

## Rule 2 — Formal structure is not enough

A list of deliverables is not valid merely because it is formatted like
deliverables.

## Rule 3 — Meaning must survive compression

The object of work must remain visible through:

- goal
- deliverable
- action
- block

## Rule 4 — Invisible lineage counts as broken lineage

If the system internally “knows” the lineage but the surfaced artifact loses the
semantic object, the plan still fails user-truth quality.

## Rule 5 — P.O.S. cannot outrun plan substance

No credibility-bearing probability or feasibility judgment may exceed the
quality of the underlying plan substrate.

---

## Minimum Data Contract for Quality Admission

Before final feasibility is allowed, the canonical plan should support at least:

- canonical goal text
- identified major goal components
- canonical deliverables
- deliverable-to-goal object linkage
- deliverable descendants
- block descendants
- surfaced labels that preserve semantic object

If these are not available, quality admission must fail deterministically.

---

## Observation Rubric for Test Goals

Use this rubric during test-goal review before evaluating feasibility.

# Section A — Goal Coverage

## A1. Major component count

Question: How many distinct major project components are implied by the goal?

Record:

- expected component count
- observed component count
- missing components

Pass: All major components represented

Fail codes:

- `PLAN_COVERAGE_MISSING_MAJOR_COMPONENT`
- `PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE`

## A2. Deliverable branch coverage

Question: Does each major component have a deliverable branch?

Pass: Yes for all components

Fail code:

- `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH`

## A3. Execution descendant coverage

Question: Does each deliverable branch produce actions/blocks?

Pass: Yes for all required branches

Fail code:

- `PLAN_COVERAGE_MISSING_EXECUTION_DESCENDANTS`

---

# Section B — Deliverable Quality

## B1. “What” presence

Question: Does each deliverable explicitly state what it is about?

Pass: Object of work present

Fail code:

- `DELIVERABLE_OBJECT_MISSING`

## B2. Goal relevance

Question: Could a reviewer tell how this deliverable serves the goal?

Pass: Clearly yes

Fail code:

- `DELIVERABLE_GOAL_DISCONNECTED`

## B3. Specificity level

Question: Could this deliverable belong to many unrelated goals?

Pass: No

Fail code:

- `DELIVERABLE_TOO_GENERIC`

## B4. Semantic substance

Question: Does the deliverable feel like a real goal artifact rather than a
planning placeholder?

Pass: Yes

Fail code:

- `DELIVERABLE_SEMANTIC_HOLLOWNESS`

---

# Section C — Block / Action Quality

## C1. Lineage traceability

Question: Can the reviewer tell which deliverable this block belongs to?

Pass: Yes

Fail code:

- `ACTION_LINEAGE_BROKEN`
- `BLOCK_LINEAGE_BROKEN`

## C2. Goal-object preservation

Question: Does the block retain the object of work?

Pass: Yes

Fail code:

- `BLOCK_GOAL_OBJECT_MISSING`

## C3. Genericity check

Question: Could the same block label be reused for ten unrelated goals?

Pass: No

Fail code:

- `BLOCK_TOO_GENERIC`

## C4. User-truth check

Question: Would a user looking only at the surfaced block understand what they
are doing and why?

Pass: Yes

Fail code:

- `LINEAGE_VISIBLE_MEANING_LOSS`

---

# Section D — Feasibility Admission

## D1. Quality gate admission

Question: Did Gates 1–3 pass?

Pass: Yes

Fail code:

- `FEASIBILITY_NOT_ADMITTED_PLAN_QUALITY_WITHHELD`

## D2. Feasibility validity

Question: If admitted, is the plan actually schedulable under constraints?

Pass: Yes

Else: use existing feasibility/runtime codes

---

# Section E — P.O.S. Admission

## E1. Admission truth

Question: Did the plan pass quality and feasibility admission?

Pass: Yes

Fail codes:

- `POS_NOT_ADMITTED_PLAN_QUALITY_WITHHELD`
- `POS_NOT_ADMITTED_FEASIBILITY_WITHHELD`
- `POS_NOT_ADMITTED_INCOMPLETE_PLAN_SUBSTRATE`

---

## Suggested Test Observation Template

```md
## Test Goal:

[goal text]

## Expected Major Components:

1.
2.
3.

## Observed Major Components:

1.
2.
3.

## Gate 1 — Coverage Integrity

- Pass/Fail:
- Failure Codes:
- Notes:

## Gate 2 — Deliverable Specificity

- Pass/Fail:
- Failure Codes:
- Notes:
- Example weak deliverables:
- Example corrected deliverable forms:

## Gate 3 — Action / Block Lineage Integrity

- Pass/Fail:
- Failure Codes:
- Notes:
- Example weak blocks:
- Example corrected block forms:

## Gate 4 — Feasibility Admission

- Admitted / Withheld:
- Failure Codes:
- Notes:

## Gate 5 — P.O.S. Admission

- Admitted / Withheld:
- Failure Codes:
- Notes:

## Overall Determination

- PLAN_QUALITY_PASSED / PLAN_QUALITY_WITHHELD
- Root cause:
- Recommendation:
```

---

## Correction Standard

When a plan fails quality gates, correction should aim to restore:

- full goal coverage
- object-preserving deliverables
- visible lineage into actions/blocks
- only then schedule realism

Correction should not merely:

- rename superficially
- add more blocks without semantic repair
- compute new feasibility on unchanged hollow deliverables

---

## 1.0 Product Truth Rule

For 1.0 investor-proof truth surface:

The product should prefer **withholding** over **false precision**.

That means:

- incomplete plan -> withhold
- ambiguous deliverables -> withhold
- broken lineage -> withhold
- only quality-admitted plans receive final feasibility/P.O.S.

This is stronger, cleaner, and more credible than scoring weak plan substrates.

---

## Bottom-Line Standard

A plan is not admissible merely because it exists, is formatted, or fits on a
calendar.

A plan is admissible only when it is:

- complete in scope
- explicit in object
- connected in lineage
- then schedulable
- then scoreable

That is the deterministic truth chain this spec establishes.

If you want, I’ll convert this next into a tighter implementation-ready version
with:

- a canonical `PlanQualityGateResult` shape
- enum/code definitions
- reducer/selector integration points
- minimal acceptance tests.
