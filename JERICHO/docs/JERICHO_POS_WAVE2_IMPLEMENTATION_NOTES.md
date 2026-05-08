# JERICHO P.O.S. Wave 2 — Implementation Notes

**Version:** 1.0 **Date:** 2026-03-25 **Status:** Complete — all tests pass, no
regressions

---

## What Wave 2 Added

Wave 2 wires family-aware trust derivation into the scoring engine.
Externally-mediated archetypes (JobSearchPipeline, SalesPipeline, Fundraising)
now require both 7 internal evidence days AND at least one confirmed qualifying
external evidence event before trust can reach `trusted`.

---

## Changes to `probabilityScore.ts`

### New exports

```typescript
export const EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER =
  'Reflects execution quality of preparation activities. External response evidence not yet received.';

export type FamilyClass = 'internally_controlled' | 'externally_mediated';
```

### `deriveTrustState()` — extended signature (backward-compatible)

```typescript
export function deriveTrustState(
  scoringStatus: ProbabilityResult['status'],
  eligibilityStatus: EligibilityStatus,
  options?: {
    familyClass?: FamilyClass;
    qualifyingExternalEvidenceCount?: number;
  }
): TrustState;
```

The third `options` parameter is optional. All Wave 1 call sites pass no options
and behave identically to before. The new behavior fires only when
`options.familyClass === 'externally_mediated'` and
`options.qualifyingExternalEvidenceCount === 0`.

### `QUALIFYING_EXTERNAL_STAGES` (private constant)

Maps archetype name → Set of stage strings that represent qualifying external
evidence. Only third-party-initiated responses qualify. User preparation actions
do not.

| Archetype           | Qualifying stages                                                                    |
| ------------------- | ------------------------------------------------------------------------------------ |
| `JobSearchPipeline` | `recruiter_reply`, `interview_invite`, `screening_scheduled`, `offer_received`       |
| `SalesPipeline`     | `qualified_response`, `discovery_call_booked`, `proposal_requested`, `deal_advanced` |
| `Fundraising`       | `investor_reply`, `meeting_booked`, `diligence_request`, `commitment_received`       |

### New private helpers

**`resolveGoalFamilyInfo(goalId, state)`** Reads `familyClass` and `archetype`
from `cycle.goalContract`. Returns `null` for both if not found. No error on
missing fields.

**`countQualifyingExternalEvidenceEvents(goalId, state, archetype, nowISO)`**
Filters `state.externalEvidenceEvents` for:

1. `ev.goalId === goalId`
2. `ev.confirmed === true`
3. `ev.stage` in qualifying stages for the archetype
4. `ev.dateISO` within the last 30 days from `nowISO` (recency window)

Returns a count. Zero means the external evidence gate is closed.

### Cap invariant enforcement

The 0.65 cap invariant (`value ≤ 0.65` for any `provisional` trust state) is now
enforced for the external evidence gate path as well. When
`familyAwareTrustState === 'provisional'` but `evidenceDays >= 7`,
`finalValue = Math.min(combined, 0.65)` and `capApplied: true` with reason
`'CAP_APPLIED_EXTERNALLY_MEDIATED'`.

### `ProbabilityResult` type — new optional field

```typescript
qualifier?: string;
```

Set to `EXTERNALLY_MEDIATED_PROVISIONAL_QUALIFIER` when the trust state is
`provisional` and the family is externally mediated. Absent otherwise.

---

## State shape — external evidence events

Wave 2 reads from `state.externalEvidenceEvents` — a separate array from
`state.executionEvents`.

Event shape:

```typescript
{
  type: 'external_evidence';
  goalId: string;
  cycleId?: string;
  dateISO: string;          // YYYY-MM-DD
  familyClass?: string;
  stage: string;            // the qualifying stage key
  evidenceLabel?: string;   // human label
  confirmed: boolean;       // must be true to count
}
```

If `state.externalEvidenceEvents` is absent or empty, the external evidence
count is 0 (externally-mediated goals remain `provisional`).

---

## Contract shape — family classification

`cycle.goalContract` must carry `familyClass` and `archetype` for the
family-aware path to activate:

```javascript
goalContract: {
  goalId: 'goal-xyz',
  startDayKey: '2026-03-01',
  endDayKey: '2026-06-01',
  familyClass: 'externally_mediated',   // or 'internally_controlled'
  archetype: 'JobSearchPipeline',        // used for qualifying stage lookup
}
```

Goals without `familyClass` on the contract are treated as internally controlled
(the default Wave 1 path).

---

## Acceptance proofs satisfied

| ID                    | Rule                                                                                        | Result              |
| --------------------- | ------------------------------------------------------------------------------------------- | ------------------- |
| POS-005               | Externally-mediated stays `provisional` at 7 internal days without external evidence        | PASS (3 archetypes) |
| POS-005 qualifier     | Canonical qualifier present on externally-mediated provisional                              | PASS                |
| POS-006               | Transitions to `trusted` on first qualifying external event + 7 internal days               | PASS (3 archetypes) |
| POS-006 qualifier-off | Qualifier absent when `trusted`                                                             | PASS                |
| POS-006b              | Non-qualifying stages (application_sent, deck_updated, outreach_sent) do not unlock trusted | PASS (3 stages)     |
| POS-006b              | Unconfirmed qualifying event does not unlock trusted                                        | PASS                |
| POS-DOWN-3            | Stale external evidence (30+ days old) does not count                                       | PASS                |
| POS-DOWN-3            | Fresh external evidence (within 30 days) still counts                                       | PASS                |
| Internally controlled | PhysicalTraining reaches trusted at 7 days without external evidence                        | PASS                |
| Internally controlled | Internally-controlled provisional does not carry externally-mediated qualifier              | PASS                |

---

## What Wave 2 Does Not Change

- The scoring formula (mean/stddev/normalCdf)
- The 0.65 cap threshold (still 0.65)
- The 7-day internal evidence threshold (still 7 distinct days)
- The eligibility gating logic in `probabilityEligibility.ts`
- The `deriveProbabilityStatus` contract
- Wave 1 tests — all 20 still pass

---

## Full suite result

- 298 test files, 1105 tests, 0 failures
- Wave 2 new tests: 16 (in `tests/state/pos.externalEvidence.trustGate.test.js`)
- Wave 1 tests: 20 (in `tests/state/pos.trustState.lifecycle.test.js`)
