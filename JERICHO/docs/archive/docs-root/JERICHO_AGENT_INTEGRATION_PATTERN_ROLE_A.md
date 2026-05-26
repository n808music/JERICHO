# JERICHO Agent Integration Pattern - Role A

## Purpose and Scope

Role A is the canonical Jericho agent pattern for bounded intake assistance. It
exists only to help resolve unanswered intake questions before deterministic
planning begins. It does not own truth, does not mutate canonical state, and
does not participate in scheduling or admission authority.

Role A is allowed because it reduces ambiguity without replacing the
deterministic gate that already governs Jericho intake. It is a helper at the
edge of the system, not a decision-maker inside the core.

## Why Role A Is Allowed

Role A is safe because it is advisory-only and pre-authoritative:

- It reads an unresolved `GoalIntakeContract`.
- It produces candidate answers only for unanswered required questions.
- It labels every output as non-authoritative and requiring user confirmation.
- It returns `null` on any failure instead of improvising a partial truth.
- It never dispatches to the store and never mutates canonical contract state.
- The deterministic intake gate remains the final authority.

Role A is allowed precisely because it resolves ambiguity without owning the
resolution.

## Exact Insertion Point

The insertion point is between deterministic intake evaluation and planning:

1. `buildGoalIntakeContract(...)` runs.
2. If required questions remain unanswered, the intake gate stays authoritative.
3. `callIntakeDraftAssistant(...)` may be invoked as a bounded advisory helper.
4. The UI presents candidate answers in `MissionSetupFlow.jsx` through
   `IntakeDraftSuggestion.jsx`.
5. The user explicitly confirms any suggested answer.
6. Confirmed answers re-enter the system through `localAnsweredContext`.
7. `buildGoalIntakeContract(...)` runs again and determines readiness
   deterministically.
8. Only then can planning continue.

This means the agent sits before authoritative plan generation and never crosses
into reducer ownership.

## Exact Exit Point

Role A exits at the moment the user confirms or dismisses the suggested answer.
Its output does not survive as agent state. The only durable effect is a
user-confirmed answer re-entering local intake context and being re-evaluated by
deterministic policy.

If the helper fails, returns `null`, or produces invalid output, the exit point
is the same: the system falls back to manual intake without changing canonical
state.

## Typed Contract and Required Fields

Role A uses a versioned, bounded contract:

- `source: 'agent_draft'`
- `schemaVersion: 'jericho_intake_draft_v1'`
- `draftedAnswers[]`

Each drafted answer must include:

- `questionId`
- `field`
- `suggestedValue`
- `rationale`
- `requiresUserConfirmation: true`

The contract is deliberately narrow. It does not carry planning output, schedule
output, admission output, or trust output.

## Provenance and Confirmation Rules

Every Role A answer must be provenance-tagged as an agent draft and must require
explicit user confirmation.

That requirement is enforced twice:

- In the validator, which rejects missing or non-confirming payloads.
- In the parser, which normalizes the payload and forces
  `requiresUserConfirmation: true` on each answer.

The parser-enforced confirmation rule is stronger than a type annotation alone
because model output can be malformed, incomplete, or subtly non-compliant. The
parser is the containment boundary; the type is only a shape.

## Null-Fallback and Failure Semantics

Role A is fail-safe by design:

- Any provider exception returns `null`.
- Any malformed payload returns `null`.
- Any schema violation returns `null`.
- Any unanswered-question precondition failure returns `null`.

This null-fallback matters operationally, not just defensively. It guarantees
that the user can continue with the manual intake path if the agent is
unavailable, inaccurate, or overconfident. The assistant cannot become a brittle
dependency.

## Why Local State Re-Entry Preserves Deterministic Authority

Confirmed answers are written only to local intake state in the UI flow. That
local state is not canonical by itself. It is simply an input to the next
deterministic `buildGoalIntakeContract(...)` evaluation.

This preserves authority because:

- The agent never writes canonical state directly.
- The user explicitly confirms the answer.
- The deterministic contract rebuild decides whether the goal is now ready.
- Any unresolved ambiguity remains visible as policy state, not hidden by the
  helper.

The answer becomes truth only after deterministic re-entry proves that the
confirmation satisfies intake rules.

## Explicit Non-Authority Statement

Role A is not allowed to:

- decide admission status
- decide execution type
- decide completion boundary
- decide schedule structure
- decide P.O.S. trust
- write to the store
- produce planning artifacts
- bypass the intake gate
- silently auto-apply suggested answers

Role A is advisory assistance only. It is not an alternate source of authority.

## What Role A Is Forbidden From Doing

Role A must never:

- mutate canonical goal or cycle state
- dispatch store actions
- generate plan blocks
- create dependencies
- set execution type
- set admission status
- set schedule lifecycle state
- produce downstream planning artifacts
- suppress the intake gate
- bypass user confirmation
- reuse an invalid or untagged response as if it were authoritative

## Test Proof / Validation Summary

Role A is validated by the focused and system-level tests already in the tree,
including:

- `tests/state/intakeDraftAssistant.test.ts`
- `tests/components/intakeDraftSuggestion.ui.test.jsx`
- `tests/state/contextAdmissionSelector.rules.test.ts`
- `tests/components/StructurePageConsolidated.admitGoalFlow.test.jsx`

The validated behaviors are:

- advisory-only output
- parser/validator enforcement
- null-fail-safe behavior
- explicit user confirmation
- local-state re-entry into deterministic intake
- no store dispatch
- no canonical mutation

## Reuse Checklist for Future Agent Roles

Before any future role is allowed, verify all of the following:

- The role is advisory-only.
- The role has a bounded insertion point.
- The role has a bounded exit point.
- The role uses a typed contract with versioned schema.
- The role output is parser-validated, not type-annotated only.
- The role is provenance-tagged.
- The role has a null-fail-safe path.
- The role requires explicit user confirmation if it affects user-facing truth.
- The role cannot dispatch to the store.
- The role cannot mutate canonical state.
- The role cannot produce downstream planning artifacts unless a deterministic
  gate re-authorizes them.

If any item fails, the role is not architecturally admissible.
