# INITIAL_FEASIBILITY_IMPLEMENTATION_BRIEF

## 1. Purpose

Stage 4 exists to define an honest pre-execution feasibility layer after
structural and long-term plan quality have been established.

Feasibility answers whether the current accepted goal and canonical plan are
schedulable and structurally supportable within the stated horizon and
constraints.

Stage 4 must not drift into execution scoring, follow-through scoring, or live
success tracking.

---

## 2. Canonical Role

Initial Feasibility Score is the governing pre-execution forecast layer for
accepted plans.

It sits downstream of:

- Stage 2 structural plan quality
- Stage 3 long-term temporal quality
- canonical calendar and schedule truth

It must drive:

- pre-execution user truth about whether the plan fits reality
- explanation of limiting factors before execution begins
- later separation from live P.O.S.

Feasibility is about schedulability and structural support, not execution
behavior.

---

## 3. Feasibility Definition

Feasibility is a pre-execution estimate of whether the accepted goal and current
canonical plan can be realistically supported by the available horizon, schedule
shape, and structural planning truth.

Feasibility is not a promise of success.

Feasibility is not a measure of motivation, discipline, integrity, or
follow-through.

Feasibility is not execution evidence.

Feasibility may be strong even when success is not guaranteed.

Feasibility may be weak even when a goal is theoretically possible in the
abstract.

---

## 4. Non-Feasibility Boundaries

Feasibility must not include:

- live execution evidence
- inferred future completion behavior
- integrity scoring
- live P.O.S. logic
- claims about whether the user will follow through
- decorative plan polish used as a substitute for schedulability truth
- collapse of assumptions, uncertainty, and execution risk into one generic
  score

Feasibility must remain a planning forecast, not a behavioral forecast.

---

## 5. Canonical Inputs

Feasibility may use only canonical planning and scheduling truth.

Allowed inputs include, where available:

- accepted goal and canonical goal contract
- deliverable -> action -> block lineage
- Stage 2 structural quality state and reason codes
- actionType coverage
- dependency and readiness truth
- assumptions and assumption burden
- schedule truth before execution
- work windows and capacity shape where canonically available
- Stage 3 temporal quality state and reason codes for long-horizon plans
- pacing, phase structure, checkpoints, uncertainty, and saturation for
  long-horizon plans where applicable
- horizon length and target duration
- canonical scheduling failure signals or missing-input reason codes already
  present in the system

Feasibility must not use ad hoc UI interpretation as an input source.

---

## 6. Feasibility Contributors

### Structural completeness and inspectability

The degree to which the accepted plan is defined clearly enough to be scheduled
and explained honestly.

### Calendar fit and capacity fit

The degree to which the required scheduled work appears to fit within the
available horizon, work windows, and capacity shape.

### Dependency realism

The degree to which action and block sequencing appears structurally supportable
given canonical dependency and readiness truth.

### Preparation burden

The degree to which readiness work consumes schedule space before substantive
execution can occur.

### Action and block density

The degree to which scheduled work is packed tightly or sparsely enough to
affect supportability.

### Long-horizon pacing realism

The degree to which longer plans distribute work across time in a believable way
instead of collapsing into front-loading, back-loading, or clustering.

### Assumption burden

The degree to which the plan relies on unresolved assumed facts or missing
details.

### Uncertainty burden

The degree to which future structure is necessarily provisional because temporal
precision is not yet fully supportable.

### Schedule saturation and under-structure

The degree to which longer-horizon segments are overloaded, unreadably dense, or
too sparse to support a credible path.

These contributors are pre-execution planning factors only. They are not live
behavior signals.

---

## 7. Feasibility States

### Feasible

The canonical plan appears structurally supportable and schedulable with
manageable constraints.

### Constrained

The canonical plan is usable, but materially limited by schedule fit, capacity
fit, dependency pressure, assumption burden, or other identifiable planning
constraints.

### Degraded

The canonical plan shows materially weak schedulability or structural support
even though some plan structure exists.

### Withheld

Canonical truth is too thin to make an honest pre-execution feasibility call.

These are pre-execution forecast states. They are not live outcome states.

---

## 8. Explanation Requirements

Feasibility explanation must be grounded in canonical inputs.

It should:

- identify the main limiting contributors
- distinguish schedule and capacity constraints from structural weakness
- distinguish assumption burden from uncertainty burden
- distinguish long-horizon temporal weakness where relevant
- use explicit reason codes where practical
- avoid sounding like a prediction of user behavior

Explanation must clarify why the current plan is feasible, constrained,
degraded, or withheld.

---

## 9. Withholding and Degradation Rules

Feasibility should degrade when:

- structural quality is weak but still inspectable
- long-horizon temporal quality is weak but still inspectable
- schedule fit or capacity fit is materially strained
- assumption burden is high
- dependency or readiness truth is weak enough to constrain confidence

Feasibility should be withheld when:

- canonical inputs are too thin to support an honest pre-execution call
- plan structure exists only as decorative or incomplete shape without
  schedulable truth
- temporal structure is too weak to support meaningful long-horizon judgment
  where a long-horizon judgment is required

Withheld should not be overused when the system still has enough truth for a
constrained or degraded call.

---

## 10. Acceptance Criteria

Pass conditions for Stage 4 feasibility standard:

- feasibility is explicitly defined and bounded from live P.O.S.
- canonical inputs are explicitly defined
- contributor categories are explicit
- feasibility states are explicit and usable
- degradation and withholding rules are explicit
- explanation requirements are explicit
- the standard can guide later implementation work without becoming vague
- the standard can be applied across the canonical 45

---

## 11. Failure Cases To Prevent

Prevent:

- feasibility acting like live probability of success
- feasibility pretending to know future user behavior
- feasibility ignoring schedule or capacity fit
- feasibility relying only on attractive plan structure with no schedulability
  truth
- feasibility collapsing assumptions, uncertainty, and dependency weakness into
  one undifferentiated penalty
- feasibility over-withholding when constrained truth is still possible
- feasibility sounding like investor or demo theater instead of canonical
  planning truth
- standards so abstract they cannot guide implementation

---

## 12. Minimal Implementation Order

The minimal Stage 4 rollout path should be:

- define feasibility meaning and non-feasibility boundaries
- define canonical inputs
- define contributor categories
- define feasibility states
- define degradation and withholding rules
- define explanation requirements
- use this brief to drive the first implementation pass on feasibility
  computation and reason codes
- then later connect feasibility cleanly to surfaces without collapsing into
  live P.O.S.
