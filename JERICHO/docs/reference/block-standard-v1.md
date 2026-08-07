# Block Standard v1

**Status:** Locked 2026-08-07 (first confirmed-written instance)

**Provenance:** This is the first written and committed version of Block Standard v1. Any prior references to "R1–R11, audit predicates A1–A10" as an existing complete document should be treated as unconfirmed/aspirational. This document supersedes any such references going forward.

---

## Rules R1–R7 (Confirmed)

### R1 — Single Scheduled Date

Every block is authored with exactly one scheduled date. Blocks are never authored with a date range or window.

### R2 — Decomposability Test

Work decomposes into separate daily blocks **if and only if** it has genuine internally-shippable increments: sub-units that are each independently meaningful and independently verifiable as complete on their own.

**Example of decomposable work:** A 12-song album; each song is an internally-shippable increment.

**Example of non-decomposable work:** A full orchestral arrangement; the output is only meaningful/verifiable as a complete whole.

**Corollary:** Work without internally-shippable increments remains a single persistent block, regardless of how many days it takes to complete.

### R3 — No Partial-Credit States

"In progress" carries no system-truth value. It is a superficial, human-facing label, not a measurable or gate-relevant state. The system recognizes exactly two truth states for a block relative to its scheduled date:
- **Complete** — block finished by its scheduled date or later
- **Not complete** — block not finished by its scheduled date

### R4 — Unconditional Overdue

A block not completed by its scheduled date is past due starting the next day, and every day thereafter until completion. This applies identically to:
- Persistent multi-day blocks (per R2)
- Decomposed single-day blocks

There is no cushioning, grace window, or "still within its natural window" exemption for legitimately multi-day work.

**Implication:** If a block needs more than one day, it should have been scheduled with that multi-day nature understood upfront. The *scheduler and capacity model* are accountable for anticipating known multi-day work during initial plan construction, so that the plan's budget accounts for it — not so the block gets an exemption from overdue tracking, but so the schedule doesn't create surprise overdue blocks in normal operation.

### R5 — Time as Anchor Control Variable

Time does not pause for a block's internal progress. Overdue status is recomputed daily, not asserted once and left static. A block that was not-yet-due yesterday and hasn't been completed is recomputed as potentially overdue today if today is past its scheduled date.

### R6 — Deadline Role is Derived, Not Authored

A block/Deliverable/Artifact's `targetDate` role — **Gate** (has downstream dependents with a later date), **Terminal** (nothing depends on it further), and/or **Convergence** (declared Convergence source) — is computed from the existing dependency graph and Convergence edges.

It is never a separately authored field, to avoid a second, driftable source of truth. The dependency graph and explicit Convergence declarations are the source of truth; roles are derived from them deterministically.

---

## Rules R8–R11 (Reserved)

**R8:** (Not yet specified)

**R9:** (Not yet specified)

**R10:** (Not yet specified)

**R11:** (Not yet specified)

These rules are intentionally held in reserve pending Wave 4 intake and further gaps surfaced through real usage. When specified, they will follow the same pattern that produced R1–R6: discovery from concrete scenarios, written explicitly, and committed as doctrine before any corresponding code changes.

---

## Audit Predicates A1–A10 (Not Yet Specified)

Audit predicates for verifying block compliance against this standard are documented separately. (To be added as they are defined.)

---

## Notes for Implementation

- **Persistent multi-day blocks:** Use a single block record with a single scheduled date. The block remains "not complete" until genuinely finished, regardless of the number of days elapsed. The system marks it overdue if not complete by the day after its scheduled date, and that overdue status persists (per R5) until the block is completed.

- **Decomposed daily blocks:** If work has internally-shippable daily increments (per R2), author separate daily blocks, each with its own date. Each block is independently evaluated against R3, R4, and R5.

- **Scheduler accountability:** The scheduler must account for known multi-day work when computing capacity and building the initial plan (per R4's implication). This prevents the plan from creating surprise overdue blocks in normal operation.

- **No hidden states:** Do not introduce intermediate states like "partially complete," "blocked," "paused," or "in progress" as system-truth. Keep the gate layer deterministic: a block is either complete or it isn't, relative to its scheduled date.

---

## History

- **2026-08-07:** First confirmed-written instance. R1–R6 locked; R8–R11 reserved for Wave 4.
