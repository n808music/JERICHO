# Jericho Context Admission Matrix 1.0

## Purpose

This defines the minimum viable lane-based context intake layer for 1.0. The
execution engine is already validated on a bounded 45-lane surface. This layer
adds the minimum context required to avoid generic planning where lane-critical
variables are unresolved.

## 1.0 Intake Rules

For each lane:

- ask `3` required questions
- allow up to `2` optional enhancement questions
- hard cap `5` questions before first-plan generation
- if required answers are missing, proceed with explicit defaults + confirmation
  requirement

Context should be requested only when it materially affects:

- output scope/type
- action complexity
- schedule intensity
- dependency ordering
- success definition
- risk/correction logic

## Product behavior sequence

1. Admit goal into archetype
2. Infer subtype lane
3. Resolve lane-required context questions
4. Ask only top 3 required questions
5. Ask optional questions only if required is satisfied and confidence remains
   low
6. Generate first plan with explicit assumptions
7. Track corrections against context-backed assumptions

## Implementation reference

- Selector + lane contract:
  - `src/state/contracts/contextAdmissionMatrix1_0.ts`
- Coverage tests:
  - `tests/state/contextAdmissionMatrix1_0.contract.test.ts`
  - `tests/state/contextAdmissionSelector.rules.test.ts`

## Scope note

This is a bounded 1.0 context layer and does not claim universal intake for
goals outside the canonical 45-lane matrix.
