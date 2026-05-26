# JERICHO P.O.S. Wave 3 — Scope

**Version:** 1.0 **Date:** 2026-03-25 **Depends on:** Wave 1 (trust foundation),
Wave 2 (family-aware external evidence gating)

---

## Decisions Already Finalized

These decisions are closed and will not be reopened in this wave.

| Decision                         | Resolution                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| Drift model                      | Derived-only. No persisted drift state.                                                       |
| Goal outcome type                | Deferred. Not implemented this wave.                                                          |
| External evidence representation | Internal model only. No external API integrations.                                            |
| Downgrade set                    | Current evidence + current schedule facts only.                                               |
| Recovery rule                    | Recovery does not change trust without new evidence.                                          |
| Display policy                   | withheld → hide strong confidence; provisional → capped/qualified; trusted → full live signal |

---

## What Wave 3 Does

Wave 3 hardens trust downgrade and enforces user-facing display policy.

### A. Derived-only trust degradation

Trust downgrade is computed from present facts, not from persisted drift
history:

| Trigger                                            | Transition                | Source                                                   |
| -------------------------------------------------- | ------------------------- | -------------------------------------------------------- |
| Rolling window evidence decay                      | `trusted` → `provisional` | evidenceDays falls below 7 in current window             |
| Insufficient recent completions on active schedule | `trusted` → `provisional` | same as above — no separate signal                       |
| Deadline passed with remaining work                | any → `withheld`          | INFEASIBLE: deadline < nowISO and remainingWork > 0      |
| Contract expiry                                    | any → `withheld`          | activeUntilISO < nowISO                                  |
| Stale qualifying external evidence                 | `trusted` → `provisional` | externally-mediated: qualifying events all > 30 days old |

All of these are already derivable from facts present in the current state
object. No new state fields are written for drift tracking.

### B. Recovery non-restoration

Recovery actions (deadline extension, renegotiation) mutate the goal contract
but do not add execution events. The scorer derives trust exclusively from
execution events and current schedule facts. Therefore recovery alone cannot
change trust upward.

This property is structural (not a rule that needs to be enforced by code) but
must be verified by explicit test.

### C. User-facing display policy

A `derivePosDisplayPolicy()` function enforces the display policy as a pure,
testable selector:

| Trust state               | `showScore`                 | `displayValue`  | `qualifierText`  |
| ------------------------- | --------------------------- | --------------- | ---------------- |
| `withheld`                | `false`                     | `'—'`           | `null`           |
| `provisional`             | `true` (if score available) | `'${pct}%'`     | qualifier if set |
| `trusted`                 | `true` (if score available) | `'${pct}%'`     | `null`           |
| `null` (not yet computed) | legacy behavior             | legacy behavior | `null`           |

This function is exported from `probabilityScore.ts` and used directly in
`ZionDashboard.jsx`.

---

## What Wave 3 Does NOT Do

- Does not add persisted drift state to store
- Does not implement goal outcome type (deferred to future wave)
- Does not add external API integrations
- Does not redesign the probability score formula
- Does not let recovery restore trust
- Does not introduce broad architecture churn

---

## Files Changed

| File                                                | Change                                                          |
| --------------------------------------------------- | --------------------------------------------------------------- |
| `src/state/engine/probabilityScore.ts`              | Add `derivePosDisplayPolicy()` export, `PosDisplayPolicy` type  |
| `src/state/identityCompute.js`                      | Propagate `metrics.posQualifier` from `probability?.qualifier`  |
| `src/components/ZionDashboard.jsx`                  | Use `derivePosDisplayPolicy` to gate POS display on trust state |
| `tests/state/pos.recovery.noTrustRestore.test.js`   | POS-007: recovery does not restore trust                        |
| `tests/state/pos.activeSchedule.inactivity.test.js` | Active schedule inactivity degrades trust via present facts     |
| `tests/state/pos.displayPolicy.test.js`             | Display policy enforcement: withheld/provisional/trusted        |
