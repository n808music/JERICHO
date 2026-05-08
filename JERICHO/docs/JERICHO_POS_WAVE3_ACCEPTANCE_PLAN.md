# JERICHO P.O.S. Wave 3 — Acceptance Plan

**Version:** 1.0 **Date:** 2026-03-25 **Depends on:**
`JERICHO_POS_WAVE3_SCOPE.md`

---

## Acceptance Items

### POS-W3-001 — Evidence decay degrades `trusted` to `provisional`

**Rule:** A goal with `trusted` trust state (7+ distinct evidence days in
rolling window) transitions to `provisional` when execution stalls long enough
for those events to age out of the rolling window. This downgrade is derived
from present evidence only — no persisted drift state.

**File:** `tests/state/pos.activeSchedule.inactivity.test.js`

**Fixture:**

- Active cycle, future deadline, rolling window mode (no `startDayKey` on
  contract)
- 7 distinct evidence days, all within 14-day window relative to `nowISO` →
  `trusted`
- Same events, `nowISO` advanced 20 days → all events age out of window →
  `provisional`

**Tests:**

```
it('trusted at 7 evidence days within rolling window')
it('provisional when same events age out of 14-day rolling window')
it('trust state is computed from present facts only — no persisted state required')
```

---

### POS-W3-002 — Active schedule inactivity degrades trust through present facts

**Rule:** An active goal (future deadline, active contract) with no completions
in the current rolling window produces `provisional`, not `trusted`. The
downgrade is driven by the absence of evidence in the current scoring window,
not by a persisted "missed sessions" counter.

**File:** `tests/state/pos.activeSchedule.inactivity.test.js`

**Fixture:**

- Active cycle, deadline 60 days out, rolling window mode
- `executionEvents` contains 7 completed events from 30+ days ago (all outside
  current 14-day window)
- `nowISO` is recent → 0 evidence days in current window → `provisional`

**Tests:**

```
it('active goal with no recent completions produces provisional from present evidence alone')
it('the same goal with recent completions produces trusted')
```

---

### POS-W3-003 — `provisional → withheld` from deadline expiry

**Rule:** When the deadline passes with remaining work, trust transitions to
`withheld` from any prior state. Already implemented in Wave 1 (POS-008). Wave 3
asserts this still holds after Wave 2 additions.

**File:** `tests/state/pos.recovery.noTrustRestore.test.js`

**Test:**

```
it('deadline passage with remaining work produces withheld regardless of prior trust state')
```

---

### POS-W3-004 — Recovery does not restore `trusted` without new execution (POS-007)

**Rule:** Accepting a recovery option (deadline extension, renegotiation) does
not promote trust state. Only new qualifying execution evidence can change trust
upward.

**File:** `tests/state/pos.recovery.noTrustRestore.test.js`

**Scenario:**

1. Goal has 5 internal evidence days → `provisional`
2. Recovery applied: `endDayKey` extended by 30 days, no new execution events
3. Assert: trust state is still `provisional`
4. Score delta is not significant (deadline extension may marginally change
   feasibility, but trust does not jump)

**Corollary tests:**

```
it('trust stays provisional after recovery with no new execution')
it('trust is re-earned only after 7 new evidence days following recovery')
it('three successive deadline extensions with no new execution keep trust provisional')
```

---

### POS-W3-005 — Externally-mediated families still respect external evidence gating post-recovery

**Rule:** For externally-mediated families, even after recovery (deadline
extended), trust cannot reach `trusted` without a confirmed qualifying external
evidence event. Recovery does not substitute for external evidence.

**File:** `tests/state/pos.recovery.noTrustRestore.test.js`

**Fixture:** JobSearchPipeline goal. 7 internal evidence days. Recovery applied
(deadline extended). No external evidence events.

**Test:**

```
it('externally-mediated family stays provisional after recovery with no external evidence')
```

---

### POS-W3-006 — Display policy: `withheld` hides strong confidence

**Rule:** When `posTrustState === 'withheld'`, `derivePosDisplayPolicy()`
returns `showScore: false` and `displayValue: '—'`. A numeric confidence figure
is not surfaced.

**File:** `tests/state/pos.displayPolicy.test.js`

**Tests:**

```
it('withheld produces showScore: false and displayValue "—"')
it('withheld suppresses a non-zero posValuePct')
it('withheld displayValue is "—" even when posValuePct is 80')
```

---

### POS-W3-007 — Display policy: `provisional` shows capped signal with qualifier

**Rule:** When `posTrustState === 'provisional'`, `derivePosDisplayPolicy()`
returns `showScore: true` (when score available), `displayValue: '${pct}%'`, and
`qualifierText` = the passed qualifier (if any).

**File:** `tests/state/pos.displayPolicy.test.js`

**Tests:**

```
it('provisional with posValuePct shows score')
it('provisional with qualifier returns qualifierText equal to the qualifier')
it('provisional without qualifier returns qualifierText: null')
it('provisional with null posValuePct returns displayValue "—" and showScore: false')
```

---

### POS-W3-008 — Display policy: `trusted` shows full live signal, no qualifier

**Rule:** When `posTrustState === 'trusted'`, `derivePosDisplayPolicy()` returns
`showScore: true`, `displayValue: '${pct}%'`, and `qualifierText: null`. No
qualifier label is shown for trusted state.

**File:** `tests/state/pos.displayPolicy.test.js`

**Tests:**

```
it('trusted shows full score')
it('trusted qualifierText is null even when posQualifier is passed')
it('trusted trustBand is "trusted"')
```

---

### POS-W3-009 — Display policy: null trust state preserves legacy behavior

**Rule:** When `posTrustState === null` (trust state not yet computed), display
behavior is equivalent to the pre-trust-state rendering. No regression.

**File:** `tests/state/pos.displayPolicy.test.js`

**Tests:**

```
it('null trust state with posValuePct shows score (legacy path)')
it('null trust state with null posValuePct shows "—"')
it('null trust state trustBand is "unknown"')
```

---

## Summary Table

| ID         | Rule                                                        | File                                    | Status |
| ---------- | ----------------------------------------------------------- | --------------------------------------- | ------ |
| POS-W3-001 | Evidence decay: trusted → provisional from rolling window   | `pos.activeSchedule.inactivity.test.js` | Open   |
| POS-W3-002 | Active schedule inactivity → provisional from present facts | `pos.activeSchedule.inactivity.test.js` | Open   |
| POS-W3-003 | Deadline expiry → withheld (regression check)               | `pos.recovery.noTrustRestore.test.js`   | Open   |
| POS-W3-004 | Recovery does not restore trusted (POS-007)                 | `pos.recovery.noTrustRestore.test.js`   | Open   |
| POS-W3-005 | Externally-mediated stays provisional after recovery        | `pos.recovery.noTrustRestore.test.js`   | Open   |
| POS-W3-006 | withheld → displayValue "—", showScore false                | `pos.displayPolicy.test.js`             | Open   |
| POS-W3-007 | provisional → score + qualifier                             | `pos.displayPolicy.test.js`             | Open   |
| POS-W3-008 | trusted → full score, no qualifier                          | `pos.displayPolicy.test.js`             | Open   |
| POS-W3-009 | null trust → legacy display behavior                        | `pos.displayPolicy.test.js`             | Open   |

---

## Non-Negotiable Rules (Inherited)

All Wave 1 and Wave 2 non-negotiable rules continue to apply:

1. Existing tests must not break.
2. `value ≤ 0.65` must hold for any `provisional` trust state.
3. `trusted` requires execution evidence. Zero events must never produce
   `trusted`.
4. Recovery does not write trust. This is the single most important Wave 3
   invariant.
5. Externally-mediated provisional is distinct from generic provisional.
