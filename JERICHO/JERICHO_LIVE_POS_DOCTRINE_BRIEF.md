# JERICHO_LIVE_POS_DOCTRINE_BRIEF

## Purpose

This brief defines the bounded doctrine for Live P.O.S. after the planning,
long-horizon, feasibility, and end-to-end substrate has been validated.

Live P.O.S. exists to answer a different question from feasibility.

- feasibility asks whether the current accepted plan is supportable before
  execution begins
- Live P.O.S. asks how likely successful completion is now, given canonical
  execution evidence and current runtime truth

This phase must not collapse back into planning remediation or cosmetic scoring.

---

## Canonical Role

Live P.O.S. is the governing post-execution probability layer for admitted goals
with canonical plan and schedule truth.

It sits downstream of:

- Stage 2 structural plan quality
- Stage 3 long-term temporal quality
- Stage 4 initial feasibility
- runtime lifecycle truth
- canonical execution evidence

It must drive:

- live confidence updates from actual execution evidence
- trust-aware explanation of why confidence is rising, stable, falling, or
  withheld
- honest separation from feasibility

---

## Core Definition

Live P.O.S. is the system’s current probability judgment about successful goal
completion based on canonical execution evidence against the accepted goal,
accepted plan, and active schedule truth.

Live P.O.S. is:

- post-execution
- evidence-driven
- lineage-bound
- trust-gated

Live P.O.S. is not:

- initial feasibility
- user motivation scoring
- decorative confidence theater
- a substitute for execution evidence

---

## Required Canonical Inputs

Live P.O.S. may consume only canonical inputs such as:

- admitted goal contract
- canonical deliverable -> action -> block lineage
- canonical applied schedule
- canonical execution events
- schedule drift and reschedule truth where canonically recorded
- completion evidence by linked block/action/deliverable
- recovery and renegotiation truth where canonically recorded
- Stage 2 structural quality state and reason codes
- Stage 3 long-term quality state and reason codes
- Stage 4 feasibility state and reason codes
- runtime trust gates already present in the stack

Live P.O.S. must not consume ad hoc UI interpretation or non-canonical mirrors
as authoritative input.

---

## What Counts As Execution Evidence

Execution evidence must be canonical and attributable.

The following count as execution evidence when canonically linked:

- completed scheduled blocks
- missed scheduled blocks
- rescheduled scheduled blocks
- linked manual blocks where the system explicitly records linkage
- canonical recovery actions
- canonical renegotiation outcomes where they alter forward support truth

The following do not count as execution evidence by themselves:

- plan existence
- visual chart completeness
- schedule generation alone
- decorative milestones
- user intent claims with no runtime evidence

---

## Eligibility

Live P.O.S. should not exist immediately for every goal.

Eligibility requires, at minimum:

- admitted goal contract
- canonical plan lineage
- canonical schedule truth
- sufficient plan/feasibility trust to justify runtime scoring
- some minimum execution evidence threshold

If those conditions are not met, Live P.O.S. must remain withheld.

---

## Trust States

Live P.O.S. should use a small deterministic trust-state set:

- `trusted`
- `provisional`
- `withheld`

Meaning:

- `trusted`
  - canonical execution evidence is sufficient and lineage-safe enough to
    support a live probability judgment
- `provisional`
  - some live probability judgment is possible, but evidence quality, quantity,
    or lineage is still materially limited
- `withheld`
  - canonical truth is too thin, too early, or too compromised to support an
    honest live probability judgment

These trust states are not the same as the probability itself. They govern
whether the probability can be trusted.

---

## Boundary From Feasibility

This boundary is mandatory.

### Feasibility

- pre-execution
- support truth
- schedulability and structural support
- no execution evidence

### Live P.O.S.

- post-execution
- probability truth from evidence
- sensitive to execution drift, completion, misses, and recovery
- may consume feasibility as prior context, but may not redefine feasibility

The system must not merge these into a single blended score.

---

## Evidence Semantics Questions

Implementation work for Live P.O.S. must answer, canonically and explicitly:

- when does Live P.O.S. become eligible
- what minimum evidence threshold activates it
- how completed blocks affect confidence
- how missed blocks affect confidence
- how rescheduled blocks affect confidence
- whether schedule drift is evidence and under what conditions
- how throughput trends affect confidence
- how recovery affects confidence
- how renegotiation affects confidence
- how long-horizon provisional future structure should constrain confidence

These answers must be encoded in canonical reasoned rules, not UI phrasing.

---

## Required Reason-Code Surface

Live P.O.S. must expose explicit reason codes for:

- insufficient execution evidence
- insufficient lineage integrity
- insufficient schedule truth
- trust withheld until admission or plan quality
- confidence constrained by missed work
- confidence improved by sustained linked completion
- confidence constrained by drift/slippage
- confidence affected by recovery or renegotiation
- confidence constrained by long-horizon provisionality

Reason codes must remain narrow and interpretable.

---

## Withholding Rules

Live P.O.S. should be withheld when:

- the goal is not admitted
- plan or lifecycle truth is not trustworthy enough
- execution evidence is too thin
- evidence is not linked safely enough to canonical plan structure
- runtime state is too inconsistent to support an honest probability judgment

Withheld must not be overused when provisional truth is honestly available.

---

## State Transition Discipline

Live P.O.S. state transitions must be explicit and auditable.

At minimum, the doctrine must support:

- withheld -> provisional
- provisional -> trusted
- trusted -> provisional
- provisional -> withheld

Transitions must be triggered by canonical evidence and trust conditions, not
presentation convenience.

---

## Minimal Implementation Order

The implementation order for Live P.O.S. should be:

1. define canonical inputs and evidence boundaries
2. define eligibility and withholding rules
3. define trust states
4. define deterministic reason codes
5. define probability update semantics from canonical execution evidence
6. implement canonical selector/policy path
7. only then expose surfaces

This order is required to prevent cosmetic confidence output from outrunning
canonical truth.

---

## Out Of Scope

This doctrine brief does not implement:

- live probability math
- UI presentation
- confidence charts
- recovery weighting details
- renegotiation weighting details

Those belong to later bounded implementation passes.

---

## Phase Conclusion

Live P.O.S. is now the active open frontier.

Its implementation must build on the frozen gate-open substrate and remain
strictly separated from feasibility, planning quality, and lifecycle validation.
