# LIVE_POS_CANONICAL_INPUTS_IMPLEMENTATION_BRIEF

## 1. Purpose

This brief defines the first implementation pass for Live P.O.S.

This pass exists to establish the canonical evidence boundary for live
probability before any score, trend, or surface work is allowed.

The system must answer, in canonical terms:

- what counts as execution evidence
- what sources are allowed
- when Live P.O.S. becomes eligible
- when Live P.O.S. must remain withheld
- what Live P.O.S. is forbidden to consume

This pass does not define score math or presentation.

---

## 2. Canonical Role

This pass is the canonical input and eligibility layer for Live P.O.S.

It sits downstream of the frozen validated substrate:

- chart truth
- structural plan quality
- long-term temporal quality
- initial feasibility
- end-to-end lifecycle truth

Its role is to ensure that Live P.O.S. can only exist when canonical
post-execution evidence exists and is attributable to the accepted goal, plan,
and schedule.

---

## 3. Canonical Execution-Event Sources

Live P.O.S. may read only from canonical execution-state sources.

Allowed canonical sources include:

- committed scheduled blocks
- canonical execution events
- completion events attached to linked scheduled blocks
- miss / skip / incomplete events attached to linked scheduled blocks where
  canonically recorded
- reschedule events where canonically recorded
- activation and lifecycle transitions that prove a schedule became live
- canonical recovery actions where they are recorded in execution-state truth
- canonical renegotiation state where it alters the live forward contract and is
  recorded canonically

The system must treat the following as evidence context only when they are
canonically linked:

- linked manual blocks
- linked reschedules
- linked recovery moves

The system must treat the following as non-canonical for Live P.O.S. input:

- generated plan text
- chart layout or chart readability
- feasibility outputs as live evidence
- UI-local interpretation
- inferred user intent not represented in canonical execution state
- non-canonical mirrors where a canonical source exists

---

## 4. Minimum Evidence Set

Live P.O.S. must not exist merely because a plan exists or a schedule has been
applied.

The minimum evidence set must require:

- admitted goal contract
- canonical plan lineage
- canonical live schedule state or equivalent canonical execution context
- at least one canonical execution event tied to the active goal

The following do not satisfy the minimum evidence set on their own:

- generated proposed blocks
- applied schedule with no execution events
- feasibility state
- plan-quality state
- long-horizon structure alone

The brief adopts the following Phase-1 rule:

- one canonical execution event is the minimum threshold for eligibility to be
  evaluated
- one event does not automatically imply trusted Live P.O.S.
- purely scheduled blocks without execution evidence keep Live P.O.S. withheld

Reschedules may count as canonical runtime evidence only if they are stored as
canonical execution-state events. Otherwise they are not evidence in this pass.

---

## 5. Eligibility Rules

Live P.O.S. becomes eligible only when all of the following are true:

- the goal is admitted
- canonical plan lineage exists
- canonical schedule truth exists in live/applied form
- canonical execution-state truth exists
- at least one canonical execution event linked to the active goal is present

Necessary but not sufficient conditions include:

- plan quality present
- feasibility present
- active cycle present
- generated or applied schedule present

Those conditions alone do not activate Live P.O.S.

If the system has planning truth but no execution evidence, Live P.O.S. remains
withheld.

---

## 6. Withholding Rules

Live P.O.S. must remain withheld when any of the following conditions hold:

- no canonical execution evidence exists
- canonical execution-event source is absent
- the schedule is not live/applied in canonical state
- the goal is not admitted
- lineage is too weak to attribute execution evidence honestly
- execution state is structurally unavailable for the active goal
- canonical runtime truth is too thin to support live probability semantics

The withholding layer should distinguish these reasons explicitly rather than
collapsing them into a generic unavailable state.

Examples of withholding categories this pass should support:

- no execution evidence yet
- schedule not live
- execution state unavailable
- lineage insufficient for attribution
- canonical runtime truth too thin

Withheld must not be bypassed by:

- plan completeness
- feasibility confidence
- trust language without evidence
- UI assumptions that the user is “on track”

---

## 7. Strict Exclusions

Live P.O.S. in this pass must not consume:

- feasibility as live evidence
- plan quality as live evidence
- trust as a substitute for evidence
- UI-derived heuristics
- generated narrative text
- inferred motivation, discipline, or follow-through
- future-looking assumptions treated as post-execution truth
- non-canonical surface interpretation of momentum or progress

Feasibility may remain prior context in later phases, but it is not evidence.

---

## 8. Canonical Attribution Rules

Execution evidence must be attributable.

At minimum, the system should prefer canonical linkage through:

- block -> action -> deliverable -> goal
- execution event -> linked block -> action -> deliverable -> goal

If attribution cannot be made honestly, Live P.O.S. should remain withheld or
keep the event outside the usable evidence set.

Unlinked activity must not be silently promoted into valid live probability
evidence.

---

## 9. Required Reason-Code Surface

This pass should prepare explicit withholding and eligibility reason codes for
later implementation.

The canonical categories should include, at minimum:

- no execution evidence
- schedule not live
- execution state unavailable
- lineage insufficient
- runtime truth too thin
- canonical event source missing

These codes should remain narrow, deterministic, and implementation-directed.

---

## 10. Separation From Later Phases

This pass explicitly does not define:

- probability score math
- score movement logic
- trend rendering
- narrative explanation beyond basic reason-code categories
- display policy
- UI surfaces
- confidence colors, labels, or visual presentation

This pass is only:

- canonical inputs
- minimum evidence
- eligibility
- withholding

---

## 11. Acceptance Criteria

This brief is complete for Phase-1 Live P.O.S. inputs when:

- canonical execution-event sources are explicitly defined
- non-canonical sources are explicitly excluded
- the minimum evidence set is explicit
- eligibility rules are explicit
- withholding rules are explicit
- feasibility is explicitly separated from live evidence
- attribution requirements are explicit
- the scope remains bounded away from score math and UI policy

---

## 12. Minimal Implementation Order

The bounded implementation order after this brief should be:

1. identify exact canonical execution-event sources in code
2. define the canonical evidence set
3. define deterministic eligibility checks
4. define deterministic withholding checks
5. define narrow reason codes
6. expose the resulting raw Live P.O.S. input state canonically
7. only then begin the later state-model pass

---

## 13. Conclusion

Live P.O.S. must begin as a canonical evidence-bound layer, not a score
presentation layer.

Until the system can state, canonically and deterministically, what evidence it
is allowed to use and when Live P.O.S. must remain withheld, no live probability
output should exist.
