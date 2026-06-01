# JERICHO_TERMINAL_OUTCOME_AUTHORITY_FRAMEWORK.md

## Status

**Draft — policy basis established from audit evidence**  
Grounded in: ST-01, ST-02, ST-03, LT-01, LT-02, LT-03, LT-04  
Threshold event: LT-04 confirmed RC-20 cross-lane (hiring + fundraising)  
Date: 2026-04-06

---

## Problem statement

The JERICHO system can model sophisticated preparation pipelines. It can produce
structurally sound plans with healthy action layers, complete lineage, and
specific deliverable titles. It can route goals to appropriate archetypes when
given an explicit executionType. Its quality gate reliably detects hollow or
generic deliverables.

But the system currently has no model for **who controls the terminal event**.

This creates a category error that the quality gate cannot detect: a plan that
is structurally excellent and covers all controllable preparation work passes
for goals where the terminal outcome requires a third party to decide. The user
who completes every deliverable in the plan may still not achieve the goal —
not because the plan was wrong, but because the terminal event was never in
their control.

Two-lane evidence confirms this is not an archetype defect. It is a missing
policy axis:

| Lane | Goal terminal event | Controlling party | posTrust result |
|------|---------------------|-------------------|-----------------|
| LT-03: hiring | Offer letter received | Employer | provisional (structural) |
| LT-04: fundraising | Signed investment agreement + wire | Investor | provisional (structural) |

Both plans received `POS_TRUST_PROVISIONAL_PLAN_DEGRADED` via identical code
paths. Trust was awarded based on plan process quality, not on acknowledgment
that the terminal event is outside the user's direct control.

---

## Terminal Outcome Authority taxonomy

### `fully_controllable`

The user completing the deliverable set causes the terminal event to occur by
definition. No external actor needs to decide. If the user does the work, the
outcome follows.

**Characteristics:**
- Terminal event is a direct artifact of user action
- Verification criteria are self-certifying or objectively observable by the
  user without external confirmation
- Preparation completeness ≈ outcome attainment

**Examples:**
- Publish 24 podcast episodes → if you press publish, they are published
- Complete a portfolio of 3 projects → if you build them, they exist
- Pass a certification exam → if you take the exam and score above threshold,
  you passed (though scheduling and grading are external, the decision is rule-
  based, not discretionary)
- Build a financial model → if you complete it, it exists

**Audit pack examples:**
- LT-01 (publish 24 episodes): `fully_controllable`
- LT-02 (build 3 portfolio projects): the skill/portfolio side is
  `fully_controllable`; the job offer side is `externally_mediated`

---

### `externally_mediated`

The user completing the deliverable set is necessary but not sufficient. A
specific external actor must make a **discretionary decision** in the user's
favor. No amount of preparation guarantees the terminal event.

**Characteristics:**
- A specific identifiable external party (employer, investor, publisher, admissions
  committee, client) must decide
- The decision is discretionary — the external party can refuse regardless of
  preparation quality
- Verification criteria cannot be self-certified by the user
- Terminal corridor includes a stage (negotiation, evaluation, decision) where
  the user presents but does not control the outcome

**Examples:**
- Receive a job offer → employer decides
- Receive a signed investment commitment → investor decides
- Get a manuscript accepted → editor/publisher decides
- Close a client contract → client decides to sign
- Get accepted to a program → admissions committee decides

**Audit pack examples:**
- LT-02: "junior software engineer offer letter received" → `externally_mediated`
- LT-03: "active job offer letter received" → `externally_mediated`
- LT-04: "signed investment agreement received" → `externally_mediated`

**Trust implication:** Preparation completeness does not imply outcome attainment.
A plan where all deliverables are complete and no offer/commitment has arrived
is not a failed plan — it is a plan in the dependency stage. The system must
represent this honestly.

---

### `market_dependent`

The terminal outcome emerges from the aggregate behavior of a population — no
single external party decides, but the outcome is probabilistic and not within
the user's direct control. Success requires accumulating a sufficient number of
positive external responses.

**Characteristics:**
- No single decision-maker controls the outcome
- Outcome is a function of volume, timing, market conditions, audience behavior
- Verification criteria involve quantity thresholds or measurable aggregate
  responses
- Preparation increases probability but does not guarantee the threshold

**Examples:**
- Reach 1,000 monthly listeners → depends on aggregate audience behavior
- Grow revenue to $10K MRR → depends on aggregate customer purchases
- Generate 50 qualified leads → depends on market response
- Gain 500 followers → depends on audience growth

**Audit pack examples:**
- LT-01: "grow to 1,000 monthly listeners" → the production side is
  `fully_controllable` (publishing episodes); the growth side is `market_dependent`
- ST-03 (brand launch landing page): "collect 50 sign-ups" → `market_dependent`

**Trust implication:** Completion of preparation work establishes conditions
for the outcome but cannot be equated with achieving it. Unlike `externally_mediated`,
there is no single decision to wait for — the outcome accumulates over time.

---

## How authority class affects system behavior

### Effect on `endpointClarity`

Current behavior: `endpointClarity` is `clear` only if `completionBoundaryStatus:
resolved`, which only occurs for podcast-domain goals. All other goals receive
`endpointClarity: missing` regardless of how concrete their verification criteria is.

Required behavior by authority class:

| Authority class | `endpointClarity` resolution rule |
|----------------|-----------------------------------|
| `fully_controllable` | Should resolve from concrete verification text (binary, self-certifying) |
| `externally_mediated` | Should resolve AND emit `external_dependency` flag — endpoint is clear but not user-controlled |
| `market_dependent` | Should resolve with `threshold_dependent` flag — endpoint is measurable but probabilistic |

A goal with "signed investment agreement received" has a clear endpoint. The
current system returns `endpointClarity: missing` for this. The endpoint clarity
field is failing to distinguish "endpoint unclear" from "endpoint clear but
externally controlled."

---

### Effect on `posTrust`

Current behavior: `posTrust` has three states — `trusted`, `provisional`,
`withheld`. All goal classes reach these states via the same logic: plan
structure quality, evidence, and whether `hasExecutionGraph` is true.

Required behavior by authority class:

| Authority class | Additional trust constraint |
|----------------|----------------------------|
| `fully_controllable` | No change to current logic. Structural quality → trust. |
| `externally_mediated` | Trust ceiling of `provisional_external` regardless of structural quality. Even a fully admitted, fully clean plan cannot reach `trusted` until the external decision event is recorded. |
| `market_dependent` | Trust ceiling of `provisional_market` until the threshold metric is confirmed from evidence. |

**Why a trust ceiling matters, not just a reason code:**

Adding a reason code to the existing `provisional` state (as would be implied
by just adding `POS_EXTERNALLY_CONTINGENT` to reason codes) is insufficient.
The state must be different because the resolution path is different:

- `provisional` resolves when plan structure improves, evidence accumulates, or
  execution graph is populated
- `provisional_external` cannot resolve through any user-side plan improvement —
  it resolves only when the external decision event is recorded

These have different meanings for what the user should do next. `provisional`
says "improve the plan." `provisional_external` says "the plan is sound; now
the external party must decide."

---

### Effect on gate behavior

Current behavior: quality gate validates deliverable specificity and action
layer presence. It does not check whether the deliverable set covers the
terminal corridor.

Required behavior by authority class:

**`fully_controllable`:** Current gate logic is sufficient. Deliverable specificity
and action layer coverage are the right checks.

**`externally_mediated`:** Gate must additionally verify:
1. At least one deliverable represents the **direct-contact stage** with the
   external decision-maker (investor meeting, employer interview, client pitch)
2. At least one deliverable or acknowledgment represents the **decision-wait
   stage** (following up, managing responses, handling rejection)
3. The plan must not pass if it contains only preparation deliverables and stops
   before external contact begins

**`market_dependent`:** Gate must additionally verify:
1. At least one deliverable represents the **distribution/reach mechanism**
   (how the user gets in front of the relevant population)
2. A measurement/tracking mechanism is present

---

### Effect on corridor requirements

For each authority class, the required corridor stages are:

**`fully_controllable`:**
1. Preparation → Execution → Completion

**`externally_mediated`:**
1. Preparation (controllable artifacts)
2. Outreach / contact (user initiates contact with external party)
3. Evaluation stage (external party evaluates; user supports but does not control)
4. Decision acknowledgment (plan must represent that a decision is pending)
5. Terminal event (external party decides — this is the non-controllable gate)

The plan must contain deliverables for stages 1–4. Stage 5 cannot be a
deliverable owned by the user — but it must be named and acknowledged as the
terminal event that the user cannot control.

**`market_dependent`:**
1. Preparation (controllable artifacts)
2. Distribution / reach mechanism
3. Iteration / optimization (respond to market feedback)
4. Measurement / tracking

---

## Interaction with RC-13 (completion boundary)

RC-20 (terminal outcome authority) and RC-13 (completion boundary missing for
non-podcast goals) are independent but adjacent.

**RC-13** is about recognition: can the system identify and encode what the
completion state is from the goal text and verification criteria?

**RC-20** is about authority: once the completion state is recognized, does
the system know who controls whether that state is reached?

A correct resolution looks like:

1. RC-13 fix: `completionBoundaryStatus` and `endpointClarity` resolve from
   concrete binary verification criteria, not only from podcast domain detection.

2. RC-20 fix: Once the completion boundary is recognized, classify it by
   `terminalOutcomeAuthority` — `fully_controllable`, `externally_mediated`,
   or `market_dependent` — and propagate that classification to trust states,
   gate requirements, and corridor coverage checks.

The two fixes should be sequenced: RC-13 first (recognize the endpoint), then
RC-20 (understand who controls it). But they are logically separable — a system
with a fixed RC-13 and no RC-20 fix would correctly identify "offer letter
received" as the endpoint, then incorrectly treat it as controllable by the user.

---

## Proposed `GoalIntakeContract` field

```typescript
terminalOutcomeAuthority: 'fully_controllable' | 'externally_mediated' | 'market_dependent' | 'mixed' | 'unknown';
terminalOutcomeAuthorityReason: string | null;
```

**`mixed`**: when a goal has multiple outcome dimensions with different authority
classes (e.g., LT-02: portfolio building = `fully_controllable`, job offer =
`externally_mediated`). A mixed authority goal with `externally_mediated` on
any outcome dimension should inherit `externally_mediated` trust constraints.

**Detection heuristics:**

`externally_mediated` signals:
- Verification text contains: "received", "accepted", "approved", "signed",
  "offer", "commitment", "agreement", "letter", "decision", "admitted"
- Goal text contains: "land a", "get hired", "raise from", "close with",
  "secure from", "accepted by", "placed with"
- Named external actor in verification: "employer", "investor", "publisher",
  "client", "committee", "board"

`market_dependent` signals:
- Verification text contains quantity thresholds: "X listeners", "X followers",
  "X leads", "X sign-ups", "$X MRR", "X customers"
- Goal text contains: "grow to", "reach X", "acquire X"

`fully_controllable` signals (in absence of above):
- Verification text is self-certifying: "deployed", "published", "built",
  "completed", "submitted", "passed"
- Terminal event is an artifact the user creates

---

## Audit pack summary — authority classifications

| Goal | Terminal outcome | Authority class | Trust ceiling |
|------|-----------------|-----------------|---------------|
| ST-01 (landing page) | Live deployed page | `fully_controllable` | trusted |
| ST-02 (fitness) | Physical benchmark reached | `fully_controllable` | trusted |
| ST-03 (brand launch) | Page live + 50 sign-ups | `mixed` (fc + market) | provisional_market |
| LT-01 (podcast) | 24 published + 1K listeners | `mixed` (fc + market) | provisional_market |
| LT-02 (fullstack + job) | Portfolio built + offer received | `mixed` (fc + externally_mediated) | provisional_external |
| LT-03 (job search) | Offer letter received | `externally_mediated` | provisional_external |
| LT-04 (fundraising) | Signed commitment + wire | `externally_mediated` | provisional_external |

**Pattern:** LT-01 introduced `market_dependent` as a secondary outcome (growth/
listeners). LT-02 introduced `externally_mediated` as a secondary outcome (offer
letter). LT-03 and LT-04 are pure `externally_mediated`. The audit pack has
covered all three authority classes within 7 goals.

---

## Open design questions

1. **Recording the external decision event:** If `provisional_external` cannot
   resolve until the external party decides, what is the mechanism for recording
   that event? This is a UX question — the user must be able to mark "offer
   received" or "investment signed" to advance the trust state. The intake/
   execution model needs a terminal event recording field.

2. **Partial commitment:** What if the user receives a $25K commitment toward
   a $50K goal? The goal is not met, but meaningful external validation has
   occurred. The authority framework does not currently model partial terminal
   events.

3. **Rejection as information:** In `externally_mediated` goals, a rejection
   (employer passes, investor passes) is not a plan failure — it is evidence
   that informs strategy. The trust model should have a state for "external
   contacts made, awaiting sufficient positive responses" distinct from "no
   contact made."

4. **Mixed-authority decomposition:** LT-02 has both `fully_controllable` (build
   portfolio) and `externally_mediated` (get job). Should these be treated as
   sub-goals with independent authority classes, or as a single mixed-authority
   goal? The current system has no sub-goal concept, so the whole goal inherits
   the more restrictive authority class.
