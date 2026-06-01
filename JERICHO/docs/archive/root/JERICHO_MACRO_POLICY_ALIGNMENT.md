# JERICHO Macro Policy Alignment

## Summary

Jericho now enforces explicit macro boundaries instead of silently expanding
goals through domain-default assumptions. The system distinguishes between:

- required execution
- bounded recommendations
- optional support work
- blocked or assumed context

It also evaluates whether a goal is ready for honest planning, whether the
resulting plan is policy-clean enough to trust, and whether P.O.S. should be
trusted, provisional, or withheld.

## Policies

### Macro boundary policy

Jericho is a deterministic behavioral execution engine. It may:

- operationalize a chosen concept
- ask bounded, materially relevant questions
- use domain defaults as recommendations or assumptions
- generate draft plans under explicit assumptions

It must not:

- invent the destination by default
- run an open-ended intake conversation
- silently expand scope
- present assumption-driven output as fully admitted authority

### Intake sufficiency policy

Goal intake now resolves to one of three deterministic states:

- `fully_admitted`
- `assumption_marked_draft`
- `intake_blocked`

The readiness evaluation requires clarity on:

- endpoint / completion boundary
- target artifact
- deadline or horizon when required
- starting-state clarity or explicit assumed baseline
- materially relevant domain context

If critical ambiguity remains, the system blocks or downgrades to an
assumption-marked draft.

### Plan quality policy

Plan quality is now evaluated separately from plan existence. A plan can exist
but still be:

- `policy_clean`
- `policy_degraded`
- `policy_blocked`

The policy evaluation checks:

- endpoint clarity
- starting-point honesty
- scope discipline
- dependency coherence
- block measurability
- feasibility honesty

### P.O.S. trust policy

P.O.S. now has an explicit trust state:

- trusted
- provisional
- withheld

Trusted P.O.S. is withheld whenever admission or quality conditions are not met.

## Reason codes

Reason codes introduced and enforced through policy evaluation include:

- `INTAKE_ARTIFACT_UNCLEAR`
- `INTAKE_BOUNDARY_AMBIGUOUS`
- `INTAKE_CONTEXT_REQUIRED`
- `INTAKE_DEADLINE_MISSING`
- `INTAKE_DOMAIN_CONTEXT_REQUIRED`
- `PLAN_DEPENDENCY_INCOHERENT`
- `PLAN_FEASIBILITY_NOT_TRUTHFUL`
- `PLAN_MEASURABILITY_WEAK`
- `PLAN_SCOPE_INFLATED`
- `PLAN_STARTING_STATE_ASSUMED`
- `POS_TRUST_PROVISIONAL_PLAN_DEGRADED`
- `POS_WITHHELD_UNTIL_ADMISSION`
- `POS_WITHHELD_UNTIL_EVIDENCE`
- `POS_WITHHELD_UNTIL_PLAN_QUALITY`

## Code paths changed

- [src/domain/goal/GoalPolicy.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalPolicy.ts)
  - defines policy contracts and deterministic evaluation
- [src/domain/goal/GoalIntakeContract.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/GoalIntakeContract.ts)
  - resolves intake readiness states and blocking reasons
- [src/state/identityCompute.js](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/state/identityCompute.js)
  - materializes goal policy snapshots into derived state
- [src/state/identityStore.js](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/state/identityStore.js)
  - persists intake contract during admission
- [src/components/zion/StructurePageConsolidated.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/components/zion/StructurePageConsolidated.jsx)
  - surfaces intake state, assumptions, and policy status
- [src/components/ZionDashboard.jsx](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/components/ZionDashboard.jsx)
  - surfaces policy status in the Stability/P.O.S. panel

## UI states

Structure now surfaces:

- admission state
- assumptions active
- policy state

Dashboard now surfaces:

- intake state
- plan quality state
- P.O.S. trust state

## Before / after

### Before

- ambiguous goals could drift into broader obligations
- intake readiness was implicit
- plan quality and P.O.S. trust were not first-class policy states
- UI showed progress without clearly surfacing policy confidence

### After

- intake is deterministically classified
- policy state is materialized and visible
- P.O.S. trust can be withheld or downgraded
- plans are labeled by policy state rather than being treated as automatically
  trustworthy

## Tests

Coverage was added for:

- intake boundary ambiguity
- intake readiness states
- plan quality evaluation
- P.O.S. trust gating
- UI policy-state rendering

## Enforcement result

Jericho now officially enforces:

- macro boundaries
- intake sufficiency
- plan quality gating
- P.O.S. trust gating

This converts the previously implicit architecture into an explicit
deterministic policy system.
