# JERICHO P.O.S. Acceptance Plan

**Version:** 1.0 **Date:** 2026-03-20 **Depends on:**
`JERICHO_POS_HARDENING_SPEC.md`

---

## Purpose

This document turns POS-001 through POS-010 into concrete, executable test work.

For each acceptance proof it specifies:

- the exact rule being tested
- the file to extend or create
- the test inputs (fixtures)
- the expected state transitions and outputs

This is implementation-ready. Nothing here is aspirational.

---

## Preliminary Tightenings

These four definitions must be nailed before any test is written. They are the
places the spec was deliberately left open for this document to close.

---

### Tightening A — Qualifying external evidence per family

The following defines exactly what counts and what does not count as a confirmed
external evidence event for each externally-mediated archetype.

**JobSearchPipeline**

| Counts                                                                          | Does NOT count                       |
| ------------------------------------------------------------------------------- | ------------------------------------ |
| `recruiter_reply` — any recruiter-initiated reply to an application or outreach | Application sent or logged           |
| `interview_invite` — interview or screen explicitly scheduled by the employer   | Resume updated                       |
| `screening_scheduled` — phone/video screen confirmed and on calendar            | Outreach message composed or drafted |
| `offer_received` — verbal or written offer extended                             | Target company added to list         |

**SalesPipeline**

| Counts                                                                            | Does NOT count                  |
| --------------------------------------------------------------------------------- | ------------------------------- |
| `qualified_response` — prospect replies and confirms genuine interest or question | Prospect added to pipeline list |
| `discovery_call_booked` — call explicitly booked by the prospect                  | Outreach message sent           |
| `proposal_requested` — prospect explicitly requests a proposal or quote           | CRM entry created or updated    |
| `deal_advanced` — prospect moves to a next pipeline stage at their own initiative | Follow-up sent with no response |

**Fundraising**

| Counts                                                                        | Does NOT count                  |
| ----------------------------------------------------------------------------- | ------------------------------- |
| `investor_reply` — investor replies to deck/intro with substantive engagement | Investor added to target list   |
| `meeting_booked` — meeting or call explicitly confirmed by the investor       | Deck revised or updated         |
| `diligence_request` — investor requests materials for diligence               | Outreach email sent             |
| `commitment_received` — verbal or written commitment or term sheet issued     | Follow-up sent with no response |

**Rule:** An external evidence event must be confirmed by a third-party action,
not a user preparation action. If the user sent the outreach but the third party
has not yet responded, no external evidence event exists.

---

### Tightening B — The 7-day rule, precisely

"7 internal evidence days" means:

**7 distinct calendar date keys (`YYYY-MM-DD`) on which at least 1 completed
execution block exists in the scoring window.**

Not:

- 7 scheduled work days in the plan
- 7 calendar days elapsed since activation
- 7 total blocks across fewer than 7 distinct days

**Implementation reference:** This is already what the code computes:
`evidenceDays = Object.keys(throughput.completedBlocksByDay || {}).length`. The
rule formalizes what the code already does.

**Test implication:** Any test asserting trust state = `trusted` must set up
exactly 7 distinct `dateISO` values in the `executionEvents` array, each with
`completed: true`. A setup with 7 blocks all on the same day must NOT produce
`trusted`.

---

### Tightening C — Trust downgrade triggers

Trust upgrades are not permanent. These are the conditions that move trust state
backward.

| Trigger                             | Current state                   | New state     | Condition                                                                                                                                                                  |
| ----------------------------------- | ------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence days drop below 7          | `trusted`                       | `provisional` | Rolling window mode only: execution stalls and old evidence ages out of the window. `evidenceDays` < 7.                                                                    |
| Contract expires                    | `provisional` or `trusted`      | `withheld`    | `activeUntilISO` < `nowISO`                                                                                                                                                |
| Deadline passed with remaining work | Any                             | `withheld`    | INFEASIBLE: `deadline < now` AND `remainingBlocksTotal > 0`                                                                                                                |
| External evidence recency expires   | `trusted` (externally-mediated) | `provisional` | For externally-mediated families only: most recent external evidence event is more than 30 days old with no new internal or external activity. Recency qualifier triggers. |

**Cycle_to_date mode note:** In `cycle_to_date` mode, `evidenceDays` only
increases (completed blocks are not un-completed). The `trusted → provisional`
downgrade via evidence decay only applies in rolling window mode. Tests for
downgrade must use rolling window mode (`scoringWindowDays` override).

---

### Tightening D — Preparation-quality qualifier, standardized

The preparation-quality qualifier for externally-mediated families in
`provisional` state must be a deterministic constant, not composed ad-hoc in UI
code.

**Canonical qualifier text:**

```
"Reflects execution quality of preparation activities. External response evidence not yet received."
```

This string must be defined as a named constant (e.g.,
`EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER`) in a single location and imported
wherever it is needed. It must not be paraphrased or varied per component.

**Test implication:** Any test checking POS-010 must match against this exact
string, not a partial match.

---

## Wave 1 — Trust State Foundation

Wave 1 adds the `trustState` field to the scoring output and wires it into the
lifecycle. No external evidence tracking yet.

### POS-001 — `trustState` field exists in scoring output

**Rule:** `scoreGoalSuccessProbability()` must return a `trustState` field with
one of: `withheld`, `provisional`, `trusted`.

**File to extend:** `tests/state/probabilityScore.test.js`

**New describe block:** `'trustState field'`

**Tests to add:**

```
it('returns trustState field on every result', () => {
  // Arrange: standard state with active contract, zero events
  // Act: scoreGoalSuccessProbability(...)
  // Assert: result.trustState is one of ['withheld', 'provisional', 'trusted']
})

it('trustState is provisional when status is NO_EVIDENCE', () => {
  // Arrange: activated goal, active contract, zero execution events
  // Assert: result.status === 'NO_EVIDENCE'
  // Assert: result.trustState === 'provisional'
})

it('trustState is withheld when status is INFEASIBLE', () => {
  // Arrange: maxBlocksPerDay = 0, remainingBlocks > 0
  // Assert: result.status === 'INFEASIBLE'
  // Assert: result.trustState === 'withheld'
})
```

**Expected state mapping (from spec Section 2.2):**

| Scoring status                        | Expected `trustState`             |
| ------------------------------------- | --------------------------------- |
| `INFEASIBLE`                          | `withheld`                        |
| `disabled` (eligibility)              | `withheld`                        |
| `insufficient_evidence` (eligibility) | `withheld`                        |
| `NO_EVIDENCE`                         | `provisional`                     |
| `INELIGIBLE`                          | `provisional`                     |
| `ELIGIBLE`                            | `trusted` (internally-controlled) |
| `UNSCHEDULABLE`                       | `provisional`                     |

---

### POS-002 — P.O.S. is `withheld` at admission (no active cycle)

**Rule:** A goal that has been admitted but has no active cycle produces trust
state = `withheld`.

**File:** New file — `tests/state/pos.trustState.lifecycle.test.js`

**Fixture:** State with `goalAdmissionByGoal` entry (status `ADMITTED`) but no
`activeCycleId` and no cycle in `cyclesById` that matches the goal.

**Test:**

```
it('withheld when goal is admitted but not in an active cycle', () => {
  // Arrange: goal admitted, cyclesById empty or no matching cycle
  // Act: scoreGoalSuccessProbability(goalId, state, constraints, nowISO)
  // Assert: result.trustState === 'withheld'
  // Assert: result.status === 'disabled' (no active contract)
})
```

**Note:** The current code returns `status: 'disabled'` when no contract is
found. `trustState = 'withheld'` maps from that. This test verifies the mapping
is wired.

---

### POS-003 — P.O.S. is `provisional` at activation, NO_EVIDENCE, score ≤ 0.65

**Rule:** An activated goal with an active contract but zero completed execution
events produces trust state = `provisional` and score ≤ 0.65.

**File:** `tests/state/pos.trustState.lifecycle.test.js`

**Fixture:** Active cycle, active governance contract, `executionEvents: []`,
`goalWorkById` has remaining blocks, deadline is future.

**Tests:**

```
it('provisional at activation with no execution evidence', () => {
  // Arrange: full active state, executionEvents = []
  // Assert: result.trustState === 'provisional'
  // Assert: result.status === 'NO_EVIDENCE'
  // Assert: result.value <= 0.65
})

it('provisional score never exceeds 0.65 with zero execution events', () => {
  // Arrange: tight schedule (intensityRatio high, slackRatio low)
  // Assert: result.value <= 0.65
  // Assert: result.trustState === 'provisional'
})
```

---

### POS-004 — P.O.S. transitions to `trusted` at 7 evidence days (internally-controlled family)

**Rule:** A PhysicalTraining or CreativeProduction goal with 7 distinct days of
completed execution events produces trust state = `trusted` and score is not
capped.

**File:** `tests/state/pos.trustState.lifecycle.test.js`

**Fixture (7 evidence days — exactly the threshold):**

```javascript
executionEvents: [
  { goalId, completed: true, dateISO: '2026-03-01', kind: 'complete', cycleId },
  { goalId, completed: true, dateISO: '2026-03-02', kind: 'complete', cycleId },
  { goalId, completed: true, dateISO: '2026-03-03', kind: 'complete', cycleId },
  { goalId, completed: true, dateISO: '2026-03-04', kind: 'complete', cycleId },
  { goalId, completed: true, dateISO: '2026-03-05', kind: 'complete', cycleId },
  { goalId, completed: true, dateISO: '2026-03-06', kind: 'complete', cycleId },
  { goalId, completed: true, dateISO: '2026-03-07', kind: 'complete', cycleId },
];
```

**Tests:**

```
it('trusted after exactly 7 distinct evidence days', () => {
  // Arrange: 7 distinct dateISO values, all completed
  // Assert: result.trustState === 'trusted'
  // Assert: result.status === 'ELIGIBLE'
})

it('still provisional at 6 evidence days', () => {
  // Arrange: 6 distinct dateISO values, all completed
  // Assert: result.trustState === 'provisional'
  // Assert: result.status === 'INELIGIBLE'
  // Assert: result.value <= 0.65
})

it('7 blocks on 1 day does not produce trusted state', () => {
  // Arrange: 7 execution events all with same dateISO
  // Assert: result.trustState === 'provisional'  (only 1 evidence day)
  // Assert: result.value <= 0.65
})
```

The third test is the precision test for Tightening B. 7 blocks on 1 day must
not produce `trusted`.

---

### POS-008 — P.O.S. is `withheld` when deadline passed with remaining work

**Rule:** A goal past its deadline with remaining work produces trust state =
`withheld`.

**File:** `tests/state/pos.trustState.lifecycle.test.js`

**Fixture:** `deadlineISO` set to yesterday, `remainingBlocksTotal > 0`.

**Test:**

```
it('withheld when deadline is passed with remaining blocks', () => {
  // Arrange: deadlineISO = '2026-01-01', nowISO = '2026-03-20', blocksRemaining = 3
  // Assert: result.trustState === 'withheld'
  // Assert: result.status === 'INFEASIBLE'
  // Assert: result.value === 0
})
```

---

### Trust downgrade — rolling window evidence decay (Tightening C)

**Rule:** In rolling window mode, a goal that was `trusted` can drop to
`provisional` if execution stalls long enough for evidence days to fall below 7.

**File:** `tests/state/pos.trustState.lifecycle.test.js`

**Tests:**

```
it('trusted degrades to provisional when rolling window evidence drops below 7 days', () => {
  // Arrange 1: 7 evidence days in the past window → trusted
  // Arrange 2: advance nowISO far enough that same events fall outside 14-day rolling window → only 3 evidence days remain
  // Assert for Arrange 2: result.trustState === 'provisional'
  // Assert for Arrange 2: result.value <= 0.65
})

it('contract expiry produces withheld regardless of evidence', () => {
  // Arrange: activeUntilISO = '2026-01-01', nowISO = '2026-03-20', 7 evidence days present
  // Assert: result.trustState === 'withheld'
})
```

---

## Wave 2 — External Evidence Trust Gate

Wave 2 adds the external evidence event type and the family-class trust gate.

### POS-005 — Externally-mediated family stays `provisional` at 7 internal evidence days without external evidence

**Rule:** A JobSearchPipeline/Fundraising/SalesPipeline goal with 7+ internal
evidence days but zero confirmed external evidence events must remain
`provisional`.

**File:** New file — `tests/state/pos.externalEvidence.trustGate.test.js`

**Fixture:** JobSearchPipeline goal. 7+ execution events across 7 distinct days.
`externalEvidenceEvents: []`.

**Tests:**

```
it('JobSearchPipeline stays provisional at 7 evidence days without external evidence', () => {
  // Arrange: 7 completed internal execution events, distinct days
  //          familyClass: 'externally_mediated' on goal contract
  //          externalEvidenceEvents: []
  // Assert: result.trustState === 'provisional'
  // Assert: result.value <= 0.65
})

it('Fundraising stays provisional at 10 evidence days without external evidence', () => {
  // Arrange: 10 completed internal execution events, distinct days
  //          familyClass: 'externally_mediated'
  //          externalEvidenceEvents: []
  // Assert: result.trustState === 'provisional'
})

it('SalesPipeline stays provisional regardless of internal evidence depth without external evidence', () => {
  // Arrange: 14 completed internal execution events, distinct days
  //          externalEvidenceEvents: []
  // Assert: result.trustState === 'provisional'
})
```

---

### POS-006 — Externally-mediated family transitions to `trusted` on first confirmed external evidence event + 7 internal days

**Rule:** First confirmed external evidence event, combined with 7+ internal
evidence days, unlocks `trusted` and removes the cap.

**File:** `tests/state/pos.externalEvidence.trustGate.test.js`

**Fixtures — qualifying events per family (from Tightening A):**

```javascript
// JobSearchPipeline — qualifying event
const recruitRecruiterReply = {
  type: 'external_evidence',
  goalId,
  cycleId,
  dateISO: '2026-03-10',
  familyClass: 'externally_mediated',
  stage: 'recruiter_reply',
  evidenceLabel: 'Recruiter replied to application',
  confirmed: true,
};

// JobSearchPipeline — non-qualifying event (must NOT trigger trusted)
const applicationSent = {
  type: 'external_evidence',
  goalId,
  cycleId,
  dateISO: '2026-03-10',
  familyClass: 'externally_mediated',
  stage: 'application_sent', // internal user action, not external response
  evidenceLabel: 'Application submitted',
  confirmed: true,
};
```

**Tests:**

```
it('JobSearchPipeline transitions to trusted on recruiter_reply with 7 internal days', () => {
  // Arrange: 7 internal evidence days + recruiter_reply external event
  // Assert: result.trustState === 'trusted'
  // Assert: result.value may exceed 0.65
})

it('application_sent does not unlock trusted state even with 7 internal days', () => {
  // Arrange: 7 internal evidence days + application_sent external event
  // Assert: result.trustState === 'provisional'
  // Assert: result.value <= 0.65
})

it('Fundraising transitions to trusted on meeting_booked with 7 internal days', () => {
  // Arrange: 7 internal evidence days + meeting_booked external event
  // Assert: result.trustState === 'trusted'
})

it('investor deck update does not count as external evidence for Fundraising', () => {
  // Arrange: 7 internal evidence days + external_evidence event with stage 'deck_updated'
  // Assert: result.trustState === 'provisional'
})

it('SalesPipeline transitions to trusted on discovery_call_booked with 7 internal days', () => {
  // Arrange: 7 internal evidence days + discovery_call_booked external event
  // Assert: result.trustState === 'trusted'
})

it('SalesPipeline outreach_sent does not count as external evidence', () => {
  // Arrange: 7 internal evidence days + stage 'outreach_sent'
  // Assert: result.trustState === 'provisional'
})
```

**External evidence recency downgrade (Tightening C):**

```
it('externally-mediated trusted downgrades to provisional when external evidence is 30+ days stale', () => {
  // Arrange: 7 internal evidence days + 1 external event with dateISO 35 days ago
  //          no new internal or external activity in last 30 days
  //          nowISO is 35 days after external event dateISO
  // Assert: result.trustState === 'provisional'
  // Assert: result has recency qualifier signal
})
```

---

## Wave 3 — Recovery Trust Isolation

### POS-007 — Recovery acceptance does not restore `trusted` state without new execution

**Rule:** After a recovery option is applied (forward contract mutated), if no
new completed execution events exist, trust state must not improve.

**File:** New file — `tests/state/pos.recovery.noTrustRestore.test.js`

**Scenario:** Goal was in `provisional` state (< 7 evidence days). User accepted
a recovery option that extended the deadline. No new execution events. Score
must not improve vs pre-recovery.

**Fixture setup:**

```
// Step 1: state_before_recovery
//   - 5 internal evidence days (provisional)
//   - recovery option applied: deadlineISO extended by 30 days
//   - executionEvents unchanged (no new completion)

// Step 2: state_after_recovery = { ...state_before_recovery, deadlineISO: extended }
```

**Tests:**

```
it('trust state does not improve after recovery option with no new execution', () => {
  // score_before = scoreGoalSuccessProbability(goalId, state_before_recovery, ...)
  // score_after = scoreGoalSuccessProbability(goalId, state_after_recovery, ...)
  // Assert: score_after.trustState is not 'trusted' (was provisional before, stays provisional)
  // Assert: score_after.value is not significantly higher than score_before.value
  //         (deadline extension may marginally change feasibility, but trust state must not jump)
})

it('trust is re-earned only after new completed execution following recovery', () => {
  // state_post_recovery_with_execution = add 7 new execution events to state_after_recovery
  // score = scoreGoalSuccessProbability(...)
  // Assert: score.trustState === 'trusted'
  //   (trust restored by execution, not by recovery action itself)
})

it('repeated recovery with no execution keeps trust provisional', () => {
  // Apply 3 successive deadline extensions with no new execution
  // Assert: trustState remains 'provisional' throughout
  // Assert: score does not improve with each recovery
})
```

---

## Wave 4 — User-Facing Policy

### POS-009 — Provisional P.O.S. carries a qualifier label

**Rule:** Any goal with trust state = `provisional` must produce a qualifier
label in the P.O.S. display output.

**File:** New file — `tests/components/pos.userFacing.qualifier.test.jsx`

**Approach:** Test via the component that renders P.O.S. metrics. Check that the
qualifier is present when trust state is `provisional`.

**Tests:**

```
it('renders provisional qualifier when trustState is provisional', () => {
  // Render component with metrics.posTrustState = 'provisional'
  // Assert: qualifier text is visible in the rendered output
})

it('does not render provisional qualifier when trustState is trusted', () => {
  // Render component with metrics.posTrustState = 'trusted'
  // Assert: qualifier text is NOT present
})

it('does not render POS display at all when trustState is withheld', () => {
  // Render component with metrics.posTrustState = 'withheld'
  // Assert: no probability score element rendered
})
```

---

### POS-010 — Externally-mediated provisional P.O.S. carries preparation-quality qualifier

**Rule:** JobSearchPipeline, Fundraising, and SalesPipeline goals with trust
state = `provisional` must render the standardized preparation-quality qualifier
(see Tightening D). Not any qualifier — specifically the canonical one.

**Canonical qualifier constant:**

```
EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER =
  "Reflects execution quality of preparation activities. External response evidence not yet received."
```

**File:** `tests/components/pos.userFacing.qualifier.test.jsx`

**Tests:**

```
it('JobSearchPipeline provisional renders canonical preparation-quality qualifier', () => {
  // Arrange: JobSearchPipeline goal, trustState = 'provisional', no external evidence
  // Assert: rendered text contains EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER exactly
})

it('Fundraising provisional renders canonical preparation-quality qualifier', () => {
  // Same as above for Fundraising
})

it('SalesPipeline provisional renders canonical preparation-quality qualifier', () => {
  // Same as above for SalesPipeline
})

it('internally-controlled provisional uses generic qualifier, not preparation-quality qualifier', () => {
  // Arrange: PhysicalTraining goal, trustState = 'provisional', 3 evidence days
  // Assert: EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER is NOT present
  // Assert: some generic provisional qualifier IS present (not the external-specific one)
})

it('preparation-quality qualifier disappears when external evidence event is confirmed', () => {
  // Arrange: JobSearchPipeline, trustState = 'trusted' (7 internal days + external event)
  // Assert: EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER is NOT rendered
})
```

---

## Summary Table

| ID         | Wave | Rule                                                                        | File                                                     | Status |
| ---------- | ---- | --------------------------------------------------------------------------- | -------------------------------------------------------- | ------ |
| POS-001    | 1    | `trustState` field on all scoring results                                   | Extend `tests/state/probabilityScore.test.js`            | Open   |
| POS-002    | 1    | `withheld` at admission (no active cycle)                                   | New `tests/state/pos.trustState.lifecycle.test.js`       | Open   |
| POS-003    | 1    | `provisional` at activation, NO_EVIDENCE, ≤ 0.65                            | `pos.trustState.lifecycle.test.js`                       | Open   |
| POS-004    | 1    | `trusted` at 7 distinct evidence days (internally-controlled)               | `pos.trustState.lifecycle.test.js`                       | Open   |
| POS-004b   | 1    | 7 blocks on 1 day does NOT produce `trusted`                                | `pos.trustState.lifecycle.test.js`                       | Open   |
| POS-DOWN-1 | 1    | Rolling window evidence decay → `trusted` to `provisional`                  | `pos.trustState.lifecycle.test.js`                       | Open   |
| POS-DOWN-2 | 1    | Contract expiry → `withheld`                                                | `pos.trustState.lifecycle.test.js`                       | Open   |
| POS-008    | 1    | `withheld` when deadline passed with remaining work                         | `pos.trustState.lifecycle.test.js`                       | Open   |
| POS-005    | 2    | Externally-mediated stays `provisional` without external evidence           | New `tests/state/pos.externalEvidence.trustGate.test.js` | Open   |
| POS-006    | 2    | Transitions to `trusted` on first qualifying external event + 7 days        | `pos.externalEvidence.trustGate.test.js`                 | Open   |
| POS-006b   | 2    | Non-qualifying external events do not unlock `trusted`                      | `pos.externalEvidence.trustGate.test.js`                 | Open   |
| POS-DOWN-3 | 2    | External evidence recency expiry → `trusted` to `provisional`               | `pos.externalEvidence.trustGate.test.js`                 | Open   |
| POS-007    | 3    | Recovery acceptance does not restore `trusted` without new execution        | New `tests/state/pos.recovery.noTrustRestore.test.js`    | Open   |
| POS-009    | 4    | Provisional qualifier present in UI                                         | New `tests/components/pos.userFacing.qualifier.test.jsx` | Open   |
| POS-010    | 4    | Canonical preparation-quality qualifier for externally-mediated provisional | `pos.userFacing.qualifier.test.jsx`                      | Open   |

---

## What Wave 1 Does Not Require

Wave 1 implementation requires no changes to:

- The existing scoring formula
- The 0.65 cap logic
- The evidence window computation
- The eligibility gating logic
- Any external event tracking

Wave 1 only requires:

1. Adding `trustState` to the `ProbabilityResult` type
2. Implementing `deriveTrustState()` — a pure function mapping
   `(scoringStatus, eligibilityStatus, familyClass?) → trustState`
3. Wiring `trustState` into the return value of `scoreGoalSuccessProbability()`
4. Adding `posTrustState` to the metrics output in `identityCompute.js`

Wave 1 tests will pass once those four changes are made and all existing tests
still pass.

---

## Non-Negotiable Rules Across All Waves

These rules must hold throughout all implementation work:

1. **Existing tests must not break.** No test that currently passes may be
   broken by any wave of implementation.
2. **The cap is a correctness rule.** `value ≤ 0.65` must hold for any
   `provisional` trust state. No exceptions for well-structured plans.
3. **`trusted` requires execution evidence.** A goal with zero completed
   execution events must never produce `trustState = 'trusted'`, regardless of
   plan quality.
4. **Externally-mediated provisional is a distinct state.** Do not conflate it
   with generic provisional. The qualifier text must be exactly canonical
   (Tightening D).
5. **Recovery does not write trust.** This is the single most important
   invariant across Wave 3. Test it from multiple angles.
