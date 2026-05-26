# FORMAL_PLAN_CHART_IMPLEMENTATION_BRIEF

## 1. Purpose

The Formal Plan Chart is the first gate of the current phase.

Its job is to make plan truth legible before scoring or UI/UX polish.

It must support plan-quality inspection, not just schedule display.

The chart exists to expose the canonical structure of a plan so decomposition
defects, sequencing defects, preparation/execution imbalance, lineage gaps, and
assumption burden are visible before apply.

## 2. Canonical Role

The Formal Plan Chart is the canonical visible truth surface for:

- goal
- deliverables
- actions
- scheduled blocks

The chart must reflect canonical planning state, not reconstructed or inferred
UI-only state.

The chart must remain truthful before and after apply.

The chart is not a decorative summary layer. It is the visible inspection
surface for canonical plan ownership.

## 3. Required Data Model

The minimum canonical fields required for meaningful chart rendering are:

- `goalId`
- `goalTitle`
- `deliverableId`
- `deliverableTitle`
- `actionId`
- `actionTitle`
- `actionType`
- `actionStatus`
- `dependencyIds` or explicit readiness condition
- `blockId`
- `blockTitle`
- `blockStatus`
- lineage fields linking `block -> action -> deliverable`
- assumption flags and/or assumption text where relevant
- `cycleId` where required for lifecycle integrity
- ordering or index fields where required for deterministic chart order

The chart must not rely on loose numbering alone.

Block titles must preserve action meaning and must not collapse into generic
labels.

If a row cannot be tied to canonical identifiers and lineage fields, it is not a
valid chart row.

## 4. Chart Rendering Requirements

The chart must visibly expose:

- goal
- deliverables
- actions nested under deliverables
- action type: preparation vs execution
- dependencies or readiness conditions
- generated blocks under actions
- assumptions attached to relevant rows
- lifecycle state where relevant

The chart must allow inspection of:

- what success requires
- what is preparation vs execution
- which blocks came from which actions
- whether sequencing is coherent
- whether assumptions are carrying too much of the plan

Long-title handling requirements:

- preserve semantic meaning
- no destructive truncation
- wrapping or controlled expansion is acceptable
- the UI must not hide the distinguishing part of a title

If a title must compress, it must preserve the object, operation, and
distinguishing context needed to understand the row.

## 5. Action Type Rules

Canonical action-type distinction:

- `preparation` = readiness-enabling work
- `execution` = substantive output-producing work

Every canonical action row in the chart must carry an `actionType`.

Every scheduled block must inherit or preserve that `actionType` visibly or
through lineage.

The system must not treat preparation as equivalent to execution progress.

Execution blocks should not appear sequenced ahead of unmet preparation
dependencies unless explicitly justified by the model.

If the model cannot distinguish preparation from execution for an action, that
is a planning defect and should remain visible.

## 6. Assumption Handling

Assumptions must be surfaced, not hidden.

Assumptions should be attached to the relevant deliverable, action, or block row
where possible.

The chart should make assumption burden visible enough to identify weak plans.

Assumed facts must not be rendered as confirmed truth.

If an assumption materially affects sequencing, readiness, or validity of a row,
that assumption must remain inspectable in the chart.

## 7. Lifecycle Requirements

The chart must respect lifecycle discipline:

- generate must not auto-apply
- review/proposed chart state must be distinguishable from applied chart state
  where necessary
- chart must remain accurate after apply
- cycle deletion must not leave orphan chart rows or stale blocks
- chart/day/week/month/review surfaces must not disagree on whether blocks exist
- chart must read from canonical sources of truth

The chart must remain valid across:

- generate
- review
- apply
- activate
- execute
- reschedule
- delete-cycle

Lifecycle state may change chart row status, but it must not change chart truth
ownership.

## 8. Acceptance Criteria

The Formal Plan Chart passes this stage only if all of the following are true:

- every block shown maps to a real action
- every action shown maps to a real deliverable
- every action has a valid `actionType`
- block titles reflect action meaning
- assumptions are surfaced where present
- preparation vs execution is inspectable
- chart remains correct after apply
- deleting a cycle removes invalid cycle-owned chart artifacts
- no “no scheduled blocks” contradiction occurs when canonical blocks exist
- long titles remain readable without destroying meaning

Additional pass conditions:

- chart rows are derived from canonical identifiers and lineage
- dependencies or readiness conditions are visible where required
- block/action/deliverable ordering is deterministic
- chart truth does not depend on month-local or view-local reconstruction

## 9. Failure Cases To Prevent

The Formal Plan Chart must prevent these failure cases:

- decorative chart with no canonical backing
- generic numbered rows with no semantic meaning
- blocks visible with no action lineage
- actions visible with no deliverable lineage
- preparation rendered as substantive execution
- stale prior-cycle blocks lingering
- chart says no blocks while schedule surfaces show blocks
- long titles clipped so meaning is lost
- assumptions hidden or silently converted into facts

Additional failure cases to prevent:

- chart rows surviving after cycle deletion with no canonical owner
- blocks attached to the wrong cycle after lifecycle transition
- preparation and execution rows rendered as interchangeable
- inferred UI-only rows diverging from canonical model state

## 10. Minimal Implementation Order

The minimal implementation path for this stage is:

1. define or confirm the canonical chart schema
2. define `actionType` semantics in the model if missing
3. wire lineage fields into chart rows
4. preserve canonical action meaning in block titles
5. render the chart with explicit preparation/execution visibility
6. render assumptions
7. verify post-apply truth
8. verify cycle deletion cleanup
9. add targeted tests before broader UI refinement

This implementation order is mandatory for minimal blast radius.

Chart truth ownership and lineage correctness come before visual refinement.
