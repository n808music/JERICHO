# PLAN_QUALITY_2_MILESTONE_BRIEF.md

## Purpose

Plan Quality 2 is a bounded generation-quality expansion pass.

Its goal is to improve plan substance upstream so that more plans qualify
honestly under the existing admission seam because deliverables and blocks
preserve the goal object and lineage more faithfully.

This milestone is about making plans better. It is not about making the gate
softer.

---

## Doctrine

The admission doctrine established in Plan Quality 1 remains unchanged:

- plan quality first
- feasibility second
- P.O.S. third

Feasibility and P.O.S. remain downstream outputs. They must continue to be
withheld when the plan substrate is inadmissible.

Plan Quality 2 expands generation quality while preserving that rule.

---

## Non-goals

This milestone does **not** include:

- relaxing or weakening the plan-quality gate
- rewriting feasibility or P.O.S. logic
- broad planner architecture refactors
- semantic freeform or AI-like adjudication
- replacing deterministic checks with subjective heuristics
- broad UI redesigns or new provisional-state surface work

The blast radius should remain minimal and local.

---

## Primary Goal

Increase the percentage of plans that pass the plan-quality gate because the
generated substrate is more complete, more specific, and more semantically
coherent.

Success means:

- more plans preserve the goal object through deliverables and blocks
- more plans retain visible lineage meaning in surfaced labels
- multi-component goals are less likely to collapse into partial surrogates
- withholding behavior remains unchanged for still-weak plans

---

## Targeted Deferred Codes

Plan Quality 2 should promote the most product-visible deferred codes in a
controlled order.

Primary target set:

- `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH`
- `PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE`
- `DELIVERABLE_GOAL_DISCONNECTED`
- `DELIVERABLE_SEMANTIC_HOLLOWNESS`
- `BLOCK_GOAL_OBJECT_MISSING`
- `LINEAGE_VISIBLE_MEANING_LOSS`

These codes should be implemented only where deterministic evidence is
available.

---

## Implementation Focus

### 1. Deliverable branch preservation

Improve generation so multi-component goals retain explicit deliverable branches
instead of silently collapsing into narrower surrogate plans.

Examples:

- build + launch + outreach should preserve all three tracks
- episode-based media goals should preserve episode branches rather than only
  generic production phases

### 2. Deliverable object preservation

Generated deliverables must preserve the “what” of the goal object, not just
planning shape.

Desired direction:

- weak: `reference sheet with 20 key terms`
- stronger: `reference sheet of 20 key podcast interview prompts`

- weak: `practice environment configured`
- stronger: `recording environment configured for 6-episode podcast capture`

### 3. Lineage carry-through

The semantic object must survive through:

- goal
- deliverable
- action
- block

It is not enough for lineage to exist internally if surfaced labels lose the
object of work.

### 4. Visible meaning preservation

Block labels must communicate meaningful work to the user.

Desired direction:

- weak: `run internal review`
- stronger: `review episode 2 edit for pacing and clarity`

- weak: `prepare release package`
- stronger: `prepare release package for episode 4 publication`

---

## Implementation Constraints

- keep the canonical admission seam intact
- prefer local improvements to deliverable/action/block generation paths
- avoid merging quality-adjudication logic into feasibility logic
- use bounded deterministic checks and explicit structural evidence
- add only the minimum new diagnostics needed to verify the slice

If a check cannot be implemented deterministically with current substrate, it
should remain deferred rather than guessed.

---

## Suggested Technical Focus Areas

Plan Quality 2 should likely concentrate on the generation path where semantic
substance is lost before blocks are ever scheduled.

Candidate focus areas:

- deliverable synthesis from admitted contract text / definition of done
- stronger propagation of deliverable titles into actions and session plan
- stronger propagation of action/deliverable object into scheduled block titles
- multi-branch preservation for goals with explicit parallel tracks

The aim is to improve generated substrate first, then evaluate with the gate.

---

## Acceptance Standard

Plans should pass because they are better, not because the gate becomes more
permissive.

A valid Plan Quality 2 implementation should produce:

- stronger deliverable specificity
- stronger visible goal-object preservation
- stronger visible lineage in blocks
- unchanged withholding behavior for plans that are still incomplete or generic

If a previously weak plan now passes, the improvement must be explainable by
better substrate generation.

---

## Verification Matrix

Keep the first Plan Quality 2 verification matrix small and substance-focused.

### 1. Multi-component branch preservation

Verify that a goal with multiple major tracks produces distinct deliverable
branches instead of dropping one.

Expected enforcement surface:

- `PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH`
- `PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE`

### 2. Deliverable “what” preservation

Verify that generated deliverables retain the concrete object of work.

Expected enforcement surface:

- `DELIVERABLE_GOAL_DISCONNECTED`
- `DELIVERABLE_SEMANTIC_HOLLOWNESS`

### 3. Block goal-object preservation

Verify that surfaced blocks retain the object of work from the deliverable
branch.

Expected enforcement surface:

- `BLOCK_GOAL_OBJECT_MISSING`

### 4. Visible lineage integrity

Verify that a user reading a block can still tell what they are doing and why.

Expected enforcement surface:

- `LINEAGE_VISIBLE_MEANING_LOSS`

### 5. Withholding behavior unchanged

Verify that a still-weak plan continues to be withheld even after quality
generation improvements land.

This guards against accidental softening of the gate.

---

## Suggested Test Philosophy

Tests for this milestone should center on plan substance, not merely downstream
admission outputs.

Preferred test style:

- inspect generated deliverables/actions/blocks directly
- assert preserved object and lineage meaning
- then assert gate pass/fail behavior

Avoid relying only on downstream score or feasibility state to infer plan
quality.

---

## Milestone Exit Criteria

Plan Quality 2 can be considered complete when:

- the targeted deferred codes above are implemented where deterministic evidence
  exists
- generation quality demonstrably improves for representative weak-plan cases
- unchanged gate doctrine is preserved
- still-weak plans are still withheld
- repo-wide verification is clean on the resulting tree

---

## Milestone Summary

Plan Quality 2 is the direct successor to the Plan Quality 1 freeze.

Its scope is:

- improve upstream generation quality
- preserve goal object through deliverables and blocks
- make visible lineage meaning a first-class output
- promote the next bounded set of deferred quality codes
- keep admission doctrine unchanged

This is the next controlled step in making Jericho’s plans not only admissible,
but substantively better.
