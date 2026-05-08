# LIVE_POS_SCORE_MATH_IMPLEMENTATION_BRIEF

## 1. Purpose

Stage 3 of Live P.O.S. exists to define bounded numeric score math only after the canonical evidence gate and deterministic live-state machine are in place.

This stage translates canonical live-state truth into numeric probability behavior without inventing new semantics that belong in the state machine.

The purpose of this stage is to let the system express post-execution probability as a controlled numeric layer while preserving the doctrinal separation from:
- feasibility
- structural plan quality
- long-term plan quality
- UI presentation

This stage is not a surface pass. It is a score-math pass.

---

## 2. Canonical Role

Live P.O.S. score math is the governing numeric probability layer for post-execution state once Live P.O.S. is canonically admitted and statefully active.

It sits downstream of:
- canonical execution evidence
- Live P.O.S. eligibility / withholding
- deterministic live-state semantics

It must drive:
- numeric Live P.O.S. output
- deterministic score movement from live evidence
- bounded relationship between live state and score range
- later surface consumption

It must not redefine:
- whether Live P.O.S. is admitted
- what live state means
- what feasibility means
- what UI should say

Its role is numeric interpretation of already-defined live-state truth.

---

## 3. Score Math Scope

This stage covers:
- allowed score inputs
- score range doctrine by live state
- upward and downward movement rules
- evidence-density effects
- withholding and capping behavior
- score reason-code compatibility

This stage does not cover:
- score rendering
- chart or dashboard presentation
- explanatory prose beyond reason-code support
- user-facing narrative language
- feasibility computation
- integrity scoring

The score layer must remain subordinate to canonical state semantics.

---

## 4. Canonical Inputs

Score math may use only canonical post-execution inputs and already-frozen upstream doctrine.

Allowed score inputs include:
- Live P.O.S. eligibility result
- Live P.O.S. active live state
- Live P.O.S. live-state reason codes
- linked execution-event counts
- linked completion counts
- linked miss counts
- linked reschedule counts
- recovery evidence counts
- evidence density across the active live window
- canonical schedule-live state
- canonical lineage sufficiency needed to interpret evidence

Permitted frozen context inputs:
- feasibility state as historical baseline context only
- trust-state ceilings where doctrine explicitly requires them

The score layer must not use:
- UI-derived interpretation
- inferred user motivation
- speculative future completion behavior
- non-canonical summaries
- narrative heuristics

---

## 5. Score Input Boundaries

This section is critical.

The score layer must treat the state machine as authoritative.

Rules:
- the score must not create a new semantic state model
- the score must not override `withheld`
- the score must not contradict `activating`, `stable`, `at_risk`, or `recovering`
- the score may refine magnitude within bounded ranges, but not state meaning
- score movement must be driven by evidence deltas, not cosmetic smoothing

The numeric layer must be constrained by the canonical state machine, not the other way around.

---

## 6. Score State Mapping Rules

Each live state must map to bounded numeric behavior.

Minimum doctrine:

### `withheld`
- no numeric Live P.O.S. score is emitted
- score remains absent, null, or explicitly withheld

### `activating`
- score may exist only in an early bounded range
- activating must not be numerically indistinguishable from stable
- activating score should reflect live evidence presence without overclaiming trajectory certainty

### `stable`
- score may occupy the strongest range permitted by the available evidence
- stable does not imply perfection or inevitability
- stable score must still respond to evidence density and continuity

### `at_risk`
- score must reflect meaningful degradation from stable conditions
- at-risk score must not remain numerically close to strong stable output
- negative live evidence must have visible consequence

### `recovering`
- score may improve relative to at_risk
- recovering must remain distinguishable from both stable and at_risk
- recovery must not instantly erase prior risk without sufficient evidence

These ranges should be bounded and deterministic.

---

## 7. Evidence Density Handling

Evidence density must affect score confidence and score reach.

Rules:
- thin evidence may activate Live P.O.S. while still limiting the reachable score range
- early activating evidence should constrain score upward movement
- denser linked evidence may permit stronger stable or recovering score output
- sparse evidence should not produce high-confidence numeric output

Evidence density is not identical to score direction.

A plan can have:
- positive but thin evidence
- negative but thin evidence
- coherent dense evidence

The score layer must distinguish these cases explicitly.

---

## 8. Drift and Recovery Score Movement

Drift and recovery must have explicit numeric consequences.

Rules:
- linked misses and meaningful drift events must push score downward
- repeated drift must have stronger consequence than isolated drift
- recovery evidence may move score upward only after canonical recovery state is supportable
- recovery movement must be incremental and evidence-backed
- upward recovery movement must not erase risk immediately

The score layer must not treat:
- one completion after repeated misses
- one reschedule
- one isolated miss

as equivalent signal.

Score movement must remain deterministic and evidence-proportional.

---

## 9. Withholding and Capping Rules

The score layer must clearly distinguish withholding from capping.

### Withholding
The score is withheld when:
- Live P.O.S. eligibility is withheld
- canonical truth is too thin for honest numeric output
- live schedule state is not active
- linked execution evidence is absent or insufficient for score existence

### Capping
The score may exist but be capped when:
- evidence density is still thin
- state is activating
- recovery is still early
- trust doctrine imposes a ceiling despite live evidence

Withholding means no score.

Capping means numeric output exists, but cannot exceed a bounded range.

These must never be conflated.

---

## 10. Non-Feasibility Boundaries

This score layer must remain fully separate from feasibility.

Rules:
- feasibility is pre-execution support truth
- Live P.O.S. score is post-execution evidence truth
- feasibility may inform starting context or ceiling doctrine only where explicitly frozen
- feasibility must not act as synthetic live evidence
- a strong feasibility baseline must not keep a weak live score artificially high
- a weak feasibility baseline must not suppress genuine positive live recovery evidence beyond doctrine limits

The score must reflect live evidence, not pre-execution optimism.

---

## 11. Explanation and Reason-Code Support

The score layer must remain explainable from canonical facts.

Rules:
- numeric output must be attributable to canonical live-state inputs
- explanation support should identify the main drivers of score movement
- score explanation must distinguish:
  - thin evidence
  - strong continuity
  - drift burden
  - missed execution burden
  - recovery evidence
  - ceiling/cap constraints

The score layer may reuse state-machine reason codes and later add score-math-specific reason codes, but it must not collapse everything into a generic confidence phrase.

---

## 12. Acceptance Criteria

The brief is complete when:
- score input boundaries are explicit
- score-to-state mapping rules are explicit
- evidence-density handling is explicit
- drift and recovery movement rules are explicit
- withholding vs capping is explicit
- separation from feasibility is explicit
- explanation support requirements are explicit
- the brief can drive a bounded implementation pass without becoming vague

---

## 13. Failure Cases To Prevent

The implementation derived from this brief must prevent:
- score appearing while Live P.O.S. is still withheld
- numeric output overriding the state machine
- activating scores looking indistinguishable from stable scores
- at-risk scores remaining artificially high after negative evidence
- recovery scores snapping upward without sufficient evidence
- feasibility leaking into live score as pseudo-evidence
- UI polish or narrative copy driving numeric interpretation
- score math becoming an implicit second state machine

---

## 14. Minimal Implementation Order

The rollout order for this stage should be:

1. define canonical score inputs
2. define state-to-score mapping bounds
3. define evidence-density effects
4. define drift and recovery movement rules
5. define withholding vs capping rules
6. implement score math canonically below the UI
7. verify numeric behavior against deterministic fixtures
8. only then move to surface rendering
