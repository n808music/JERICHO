# JERICHO Agent Integration Doctrine

## Core Principle: Deterministic Authority Remains Canonical

Jericho is not an agent-led system. It is a deterministic execution engine with
optional bounded assistants at its edges.

Canonical authority remains in:

- deterministic policies
- deterministic gates
- reducers
- validated contracts
- explicit user confirmations

Agents may assist the user, but they may never own truth inside the core.

## Allowed Agent Functions

Agents may:

- suggest candidate answers to unresolved intake questions
- explain a classification result after deterministic classification has already
  happened
- narrate machine-generated recovery signals in plain language
- draft non-authoritative wording for review when explicitly bounded
- assist with clarification, not decision ownership

Every allowed function must remain advisory, bounded, and reversible.

## Forbidden Agent Functions

Agents may never:

- decide the final archetype
- mutate stored classification state
- set admission status
- bypass intake gates
- create schedule authority
- create trust authority
- write canonical planning artifacts
- auto-select alternatives on behalf of the user
- generate persuasive recommendation framing that substitutes for deterministic
  policy

## Required Safety Chain

Every future agent role must follow the same safety chain:

`model output -> parse -> validate -> typed bounded struct -> explicit user confirmation -> deterministic re-entry`

That chain is mandatory because each step removes a different class of failure:

- raw model output can be malformed
- parsing can fail
- validation can reject unsupported shape
- typed structures bound the assistant’s surface area
- explicit confirmation prevents silent auto-application
- deterministic re-entry re-establishes canonical authority

## Store Mutation Prohibition

No agent may mutate store state directly.

If an agent output is ever allowed to influence canonical state, it must do so
only after passing through a deterministic gate and a normal store action path
that already exists for that domain.

Agents are never allowed to short-circuit reducers.

## Provenance Requirements

Every agent output must be provenance-tagged as advisory content.

At minimum, the output must clearly record:

- that it came from an agent draft
- what schema version it uses
- what user-facing state it is intended to help clarify
- what it does not own

If the provenance is unclear, the role is not admissible.

## Confirmation Requirements

If an agent output touches any user-facing truth, the user must explicitly
confirm it before it re-enters canonical state.

Confirmation cannot be assumed from display, timing, or user proximity to the
UI.

The confirmation boundary is the control point that prevents agent output from
becoming hidden authority.

## Null-Fail-Safe Requirements

Every agent role must collapse to a safe no-op on failure.

Required failure behavior:

- parse failure returns null or equivalent safe failure
- provider failure returns null or equivalent safe failure
- schema failure returns null or equivalent safe failure
- UI failure does not mutate canonical state

The assistant must degrade to manual deterministic flow, not partial authority.

## Versioned Profile Requirements

All agent calls must use versioned profiles.

The profile must specify at least:

- a named role
- a schema version
- a bounded token budget
- a bounded retry policy

For Role A, the canonical profile is `INTAKE_CLARIFICATION` with schema version
`jericho_intake_draft_v1`.

Versioning is required so future roles cannot silently inherit a broader or
weaker contract.

## Injected Caller Pattern

The agent call function must be injected, not imported directly by the helper.

This is required because:

- it keeps the helper testable
- it keeps the role isolated from production transport concerns
- it allows mocks in tests without replacing the role contract
- it prevents the agent helper from becoming a hidden integration hub

The helper should accept a caller and return a bounded response. Nothing more.

## UI Qualification Requirements

Agent output shown in UI must be visibly qualified as advisory.

The UI must make it impossible to mistake an agent draft for canonical truth.

Required UI properties:

- visible non-authoritative labeling
- explicit confirm action
- dismiss action
- retention of the manual path
- no automatic promotion

If the UI makes the role look authoritative, the implementation fails doctrine.

## Testing Requirements Before Any Agent Role Ships

Before any role is admitted, the implementation must prove:

- parser/validator rejects malformed output
- null-fail-safe fallback works
- user confirmation is required
- no store dispatch occurs from the helper
- canonical state does not mutate until deterministic re-entry
- UI labels the output as advisory
- the role remains bounded to its insertion point and exit point

No role ships on the basis of prompt quality alone.

## Freeze Statement: Role A Is the Current Canonical Pattern

Role A is the frozen canonical reference pattern for Jericho agent integration.

All future roles must justify themselves against this containment model:

- advisory only
- pre-authoritative insertion point
- parser-validated
- provenance-tagged
- explicit user confirmation required
- null-fail-safe
- no store dispatch
- no canonical mutation from helper
- deterministic intake gate remains authoritative

If a future role cannot satisfy this doctrine, it is not architecturally legal.
