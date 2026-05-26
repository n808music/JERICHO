# LIVE_POS_STATE_MACHINE_IMPLEMENTATION_BRIEF

## 1. Purpose

Stage 2 of Live P.O.S. exists to define the deterministic post-eligibility state machine that governs how Live P.O.S. changes once canonical execution evidence is present.

This stage sits downstream of the canonical-input eligibility layer and upstream of any score math or UI rendering.

The purpose of this stage is to ensure that Live P.O.S. does not jump directly from withheld evidence gating into opaque score output. It must first pass through a bounded, inspectable state model with explicit transitions and explicit reason ownership.

This stage is not a scoring pass. It is a state-semantics pass.

---

## 2. Canonical Role

The Live P.O.S. state machine is the governing canonical transition layer for post-execution probability status.

It must sit downstream of:
- canonical execution-event inputs
- Live P.O.S. eligibility / withholding logic
- frozen feasibility and trust substrate

It must drive:
- whether Live P.O.S. is active at all
- what live state the system is currently in
- why that state is active
- how state transitions occur from new canonical evidence

It must not act as score math, surface styling, or narrative theater.

Its role is to formalize live-state truth before numeric probability or UI explanation layers are allowed to exist.

---

## 3. State Machine Scope

This state machine governs only the canonical live post-execution state of a goal after Live P.O.S. becomes eligible.

It covers:
- withheld state before sufficient evidence exists
- active live-state transitions after eligibility
- degradation and recovery from execution evidence
- deterministic reason-code ownership for state changes

It does not cover:
- numeric score computation
- trend chart rendering
- explanatory UX copy beyond reason codes
- feasibility computation
- terminal convergence judgment

This stage must remain bounded to state semantics.

---

## 4. Canonical Inputs

The state machine may use only canonical post-execution truth and frozen upstream planning truth.

Allowed inputs include:
- canonical Live P.O.S. eligibility result
- canonical execution events
- canonical linkage quality of execution evidence
- canonical committed/live schedule state
- canonical schedule drift or miss/reschedule events where they exist
- canonical plan lineage needed to interpret evidence
- canonical feasibility state as frozen context only, not as live evidence
- canonical trust-state ceilings where doctrine requires them

The state machine must not use:
- UI-local interpretation
- inferred user motivation
- speculative user behavior
- future completion assumptions
- non-canonical summaries

---

## 5. Allowed Live States

The Live P.O.S. state machine should use a small deterministic set of live states.

Minimum supported states:
- `withheld`
- `activating`
- `stable`
- `at_risk`
- `recovering`

State meanings:

### `withheld`
Canonical live evidence is insufficient or unavailable for an honest Live P.O.S. state.

### `activating`
Live evidence has become eligible, but evidence density and stability are still early. The system can acknowledge live signal presence without claiming stable trajectory yet.

### `stable`
Live evidence is sufficiently coherent and aligned that the post-execution trajectory appears stable within the current evidence window.

### `at_risk`
Live evidence indicates meaningful slippage, misses, drift, or instability relative to the live schedule and canonical execution path.

### `recovering`
The goal was previously at risk or unstable, but newer canonical evidence indicates credible stabilization or corrective recovery.

These are state semantics only. They are not score bands.

---

## 6. Eligibility To Active-State Transition

The state machine must define the transition from withheld into active live states explicitly.

Rules:
- `withheld` may transition only when the canonical Live P.O.S. eligibility layer reports `eligible`
- eligibility alone does not require immediate `stable`
- first activation should normally enter `activating`
- a direct transition from `withheld` to `stable` is allowed only if the doctrine later defines a sufficiently strong evidence threshold

Necessary conditions for leaving `withheld`:
- live schedule is active
- canonical execution-event source is available
- at least minimum linked execution evidence exists
- canonical lineage remains sufficient to interpret that evidence honestly

If any of these fail, the state remains `withheld`

---

## 7. Transition Rules

Transitions must be deterministic and evidence-driven.

Minimum transition doctrine:

### `withheld -> activating`
Occurs when Live P.O.S. becomes eligible for the first time through sufficient canonical evidence.

### `activating -> stable`
Occurs when canonical evidence becomes sufficiently coherent, linked, and non-fragmentary across the active evidence window.

### `activating -> at_risk`
Occurs when early live evidence shows meaningful misses, drift, or instability before stability is established.

### `stable -> at_risk`
Occurs when later evidence shows credible schedule slippage, missed execution, or destabilizing drift.

### `at_risk -> recovering`
Occurs when new canonical evidence shows credible re-engagement or schedule correction after a risk state.

### `recovering -> stable`
Occurs when recovery evidence becomes sufficiently coherent and sustained.

### `recovering -> at_risk`
Occurs when recovery collapses and negative evidence resumes.

### `stable -> withheld`
Allowed only when canonical execution truth becomes structurally unavailable or invalidated, not merely because the score would later drop.

### `at_risk -> withheld`
Allowed only when canonical evidence becomes too thin or invalid to support honest state interpretation.

State transitions must not be driven by decorative confidence changes or UI events.

---

## 8. Evidence-Driven Transition Rules

State changes must be tied to explicit categories of canonical execution evidence.

Relevant evidence categories include:
- linked completion evidence
- linked miss evidence
- linked reschedule evidence
- linked update or recovery evidence where canonical
- schedule-live continuity
- evidence density within the current live window
- lineage-preserving evidence continuity across time

Deterministic rules should distinguish:
- presence of evidence
- direction of evidence
- continuity of evidence
- interruption of evidence

State transitions must not be based on one-off narrative interpretation.

Reschedules and misses may count as live evidence, but they must not be treated as positive completion evidence. They should affect risk and stability semantics according to their canonical meaning.

---

## 9. Drift and Recovery Semantics

Schedule drift and recovery must have explicit state-machine meaning.

Rules:
- drift is not identical to failure
- repeated slippage or missed blocks can move the state toward `at_risk`
- isolated rescheduling without broader instability should not automatically force `at_risk`
- recovery requires new canonical evidence, not optimism
- recovery must be tied to actual resumed linked execution behavior

The system must not treat inactivity, drift, and recovery as interchangeable.

Recovery must remain a distinct canonical state when the evidence supports it.

---

## 10. Reason Code Ownership

Reason codes must belong to the state machine, not to UI copy or score interpretation.

State-machine reason codes should explain:
- why a state is withheld
- why a state activated
- why a state degraded to risk
- why a state entered recovery
- why a state stabilized

Minimum reason-code classes should allow distinctions such as:
- insufficient execution evidence
- unlinked evidence only
- live schedule not active
- evidence density too thin
- drift accumulating
- missed execution burden rising
- linked completion continuity improving
- recovery evidence established
- canonical truth lost or invalidated

Reason-code semantics must remain narrow and deterministic.

---

## 11. Non-Goals

This stage does not define:
- numeric probability values
- score bands
- score formulas
- trend charts
- surface labels beyond canonical state names
- explanatory prose beyond reason codes
- user-facing confidence language

This stage also does not redefine:
- feasibility
- trust-state doctrine
- planning quality
- long-term quality

Those layers remain frozen inputs or adjacent doctrine, not mutable outputs of this state machine.

---

## 12. Acceptance Criteria

The brief is complete when:
- allowed live states are explicitly defined
- transition rules are explicit
- eligibility-to-active transition rules are explicit
- drift and recovery semantics are explicit
- reason-code ownership is explicit
- canonical input boundaries are explicit
- separation from feasibility and score math is explicit
- the brief can drive a bounded implementation pass without becoming vague

---

## 13. Failure Cases To Prevent

The implementation derived from this brief must prevent:
- skipping directly from eligibility to score output
- treating any execution event as equivalent evidence
- treating feasibility as live evidence
- treating trust as a substitute for live evidence
- collapsing misses, drift, and inactivity into one generic negative state
- collapsing recovery into optimistic narrative instead of evidence
- allowing UI or copy layers to own state semantics
- creating so many states that the system becomes non-deterministic
- using score math to backfill missing state doctrine

---

## 14. Minimal Implementation Order

The rollout order for this stage should be:

1. define the allowed live states canonically
2. define withheld-to-active transition rules
3. define evidence-driven state transitions
4. define drift and recovery semantics
5. define reason-code ownership
6. implement the canonical state machine without score math
7. verify state transitions and freeze the layer
8. only then move to numeric Live P.O.S. scoring
