# JERICHO Role B Admission Criteria

## What Role B Is Supposed to Do

Role B, the Classification Diagnostic Assistant, would explain why a
deterministic classification chose a specific archetype and what that
classification means for the user.

Its purpose is explanatory only:

- describe the classification signals
- describe the resulting archetype shape
- surface composition or ambiguity context
- help the user understand the current classification decision

Role B is not supposed to change the decision.

## Why Role B Is Riskier Than Role A

Role A sits before canonical truth is established. Role B sits closer to an
already-made interpretation decision, which makes it easier to create hidden
influence through wording.

Role B is riskier because it can:

- sound authoritative even when it is only explanatory
- nudge the user toward a different archetype by framing
- blur explanation into recommendation
- contaminate canonical classification reasoning
- accidentally couple into downstream planning language

The closer a role is to classification interpretation, the stricter its
containment must be.

## Primary Failure Modes

Role B must be treated as failed if any of the following occur:

- explanation drift into recommendation
- user overtrust of diagnostic language
- hidden authority through UI wording
- contamination of canonical classification reasoning
- accidental coupling to downstream planning

Any one of these failure modes is enough to disallow the role.

## Conditions Under Which Role B Is Prohibited

Role B is prohibited if it cannot be proven to be all of the following:

- explanation-only
- not recommendation-heavy
- unable to influence canonical classification truth directly
- unable to silently steer the user into a different archetype
- unable to produce downstream planning artifacts
- representable as a dismissible diagnostic layer rather than an authority layer
- governed by the same containment chain as Role A

If any condition is missing, Role B is not allowed.

## Preconditions Required Before Role B Implementation Can Begin

Role B may begin only if the following are already true:

- Role A is frozen as the canonical pattern
- the agent doctrine is frozen in docs
- parser/validator/provenance patterns are already proven
- the UI can display an advisory diagnostic without implying authority
- the classification pipeline remains deterministic and authoritative without
  Role B
- the proposed Role B output can be rejected safely with no canonical side
  effects

If these preconditions are not met, the answer is no-go.

## Allowed Output Shape for Role B

Role B output must be a short-lived, dismissible diagnostic object or panel
with:

- a reasoned explanation of the current classification
- a plain-English summary of signals used
- a plain-English summary of the resulting archetype shape
- a note about any composition or ambiguity detected
- no recommendation framing beyond optional user understanding

The output must remain a diagnostic layer. It must not look like authority.

## Disallowed Output Behaviors for Role B

Role B must not:

- decide the final archetype
- mutate stored classification state
- auto-select alternatives
- write deliverables
- write dependencies
- write blocks
- write feasibility logic
- write policy outcomes
- persuade the user toward a different archetype
- claim improved outcomes as a result of switching

Role B cannot forward-write any downstream planning artifact.

## Required Insertion Point and Exit Point

Role B, if ever allowed, must sit only after deterministic classification and
before any optional user-facing explanation is dismissed.

Required flow:

1. Deterministic classifier resolves the archetype.
2. Diagnostic layer reads the result.
3. Role B explains the result in bounded form.
4. User dismisses or proceeds.
5. Deterministic pipeline continues unchanged.

Role B exits immediately after explanation. It does not re-enter the canonical
path as authority.

## Required Parser / Validator / Confirmation / Provenance Rules

Role B must use the same containment chain as Role A:

- model output must be parsed
- parsed output must be validated
- output must be typed and bounded
- provenance must be explicit
- the UI must qualify it as advisory

If Role B ever proposes an action or alternative, that output must still be
non-authoritative and dismissible.

Confirmation requirements are stricter here than Role A because the role sits
closer to interpretation risk.

## Required UI Qualification Rules

Role B UI must:

- label the output as diagnostic
- label the output as advisory
- avoid recommendation-heavy language
- avoid implying that classification should be changed unless the user
  independently chooses to do so
- avoid language that sounds like a final decision
- remain dismissible without side effects

If the UI wording sounds like authority, Role B fails admissibility.

## Required Test Gates

Before Role B can ship, it must pass tests proving:

- explanation-only behavior
- no canonical classification mutation
- no recommendation drift
- no downstream planning output
- no hidden UI authority
- no alternative auto-selection
- no coupling to schedule generation
- same containment chain as Role A

It must also pass stricter wording checks than Role A because the risk is
interpretation, not raw intake.

## Final Go / No-Go Rubric

Role B is allowed only if all seven of the following can be proven:

1. It is explanation-only, not recommendation-heavy.
2. It cannot influence canonical classification truth directly.
3. It cannot silently steer the user into a different archetype.
4. It cannot produce downstream planning artifacts.
5. It can be represented as a dismissible diagnostic layer rather than an
   authority layer.
6. It uses the same containment chain as Role A.
7. It passes stricter UI and wording qualification because it sits closer to
   model interpretation risk.

If any one of these fails, Role B is a no-go.

## Current Status

Role B is not implemented.

Role B remains prohibited until the full rubric above can be satisfied without
weakening Jericho’s deterministic authority.
