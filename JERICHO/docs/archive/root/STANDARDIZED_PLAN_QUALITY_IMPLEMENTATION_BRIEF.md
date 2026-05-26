# STANDARDIZED_PLAN_QUALITY_IMPLEMENTATION_BRIEF

## 1. Purpose

Stage 2 exists to formalize what counts as a good plan before feasibility and
live P.O.S.

Stage 2 turns plan review from intuition into deterministic standard.

The immediate practical need is to reduce upstream ambiguity in canonical
planning data, including actionType coverage, assumptions, and
dependency/readiness quality.

---

## 2. Canonical Role

Standardized Plan Quality is the governing standard for evaluating canonical
plans across the canonical 45.

This standard must drive:

- plan generation expectations
- chart interpretability
- degraded-policy detection
- feasibility inputs later
- live P.O.S. trust inputs later

Plan quality is about structural truth, not cosmetic UI presentation.

---

## 3. Plan Quality Pillars

### Completeness

The plan contains the success-relevant deliverables, actions, and scheduled work
needed to represent the goal meaningfully within the admitted scope.

### Specificity

Deliverables, actions, and blocks preserve concrete domain meaning and do not
collapse into vague phase language.

### Lineage Integrity

Deliverables, actions, and blocks remain canonically linked so that visible work
can be traced back to its originating planning intent.

### Execution Relevance

The plan contains substantive work that advances the goal, not just planning
posture, review posture, or organizational filler.

### Preparation/Execution Clarity

The plan distinguishes readiness-enabling work from substantive output-producing
work and does not silently treat them as equivalent.

### Dependency/Readiness Coherence

The plan exposes enough predecessor and readiness truth to inspect whether
execution is sequenced coherently.

### Assumption Honesty

Assumptions are surfaced as assumptions and contribute to plan-quality
degradation when they carry too much of the plan.

### Temporal Realism

The plan’s structure, spacing, and work burden remain credible for the stated
horizon and constraints.

### Inspectability

The plan is represented canonically enough that a reviewer can inspect what the
work is, what it depends on, and how it is meant to achieve the goal.

---

## 4. Deliverable Quality Standard

A deliverable is acceptable only if it represents a real success-relevant output
or completion-relevant state.

Deliverables must not merely restate the goal vaguely.

Deliverables must be distinguishable from one another in object, function,
output, or proof role.

Deliverables must be substantial enough to organize action work rather than
acting as empty labels above counts.

Deliverables must support visible action and block lineage.

Deliverables must not be empty shells with only counts and no meaningful
downstream work.

---

## 5. Action Quality Standard

Each action must materially serve a deliverable.

Each action must be specific enough to schedule and inspect.

Actions must not be generic filler or paraphrases of the goal.

Actions must support visible lineage into scheduled blocks.

Actions should expose their execution role where canonically required.

Actions should not collapse multiple unrelated work intents into one vague row.

Actions must be suitable for quality inspection on the chart.

---

## 6. Block Quality Standard

Each scheduled block must preserve meaningful action title truth.

Each block must map back to a real action and deliverable.

Block titles must not degrade into generic placeholders.

Scheduled blocks must be distinguishable from required counts or implied
sessions.

Block rows must preserve enough meaning to inspect readiness and sequencing
quality.

A block must not appear as substantive work if it is only unresolved placeholder
structure.

---

## 7. Assumption Standard

Assumptions must be surfaced, not hidden.

Assumptions must remain marked as assumptions.

Assumption burden can degrade plan quality.

Assumptions should attach to the relevant deliverable, action, or block row
where possible.

A plan with too many unsupported assumptions must not be treated as fully
trusted.

Assumptions must not silently upgrade uncertain plan structure into canonical
certainty.

---

## 8. Dependency and Readiness Standard

Actions and blocks should expose predecessor and readiness truth where
canonically available.

Execution should not be presented as cleanly ready if upstream preparation or
dependencies are unresolved.

Dependency structure should be coherent enough to inspect sequencing quality.

Unresolved dependencies should be visible enough to degrade plan quality when
severe.

The standard must not require fabricated dependency precision where the model
truly lacks it.

---

## 9. Action Type Coverage Standard

Every canonical action should carry an execution-role classification wherever
the lane or model can support it.

Minimum supported canonical values are:

- preparation
- execution

If a path cannot currently classify honestly, it may remain unknown temporarily,
but that must be treated as degraded quality rather than normal completion.

Chart `Unknown` is acceptable as an honest fallback during transition, but not
as the long-term standard.

ActionType coverage is a tracked quality requirement, not a UI-only concern.

Plans with broad actionType unknown coverage must not be treated as full-quality
plans.

---

## 10. Plan Quality States

### Trusted

The plan has strong structural truth across deliverables, actions, blocks,
actionType, assumptions, and dependency/readiness coverage. Remaining
uncertainty is bounded and explicitly surfaced.

### Provisional

The plan is structurally usable, but one or more important quality dimensions
remain incomplete, weak, or only partially surfaced. The plan may support
execution, but not with full structural confidence.

### Degraded

The plan contains material quality gaps such as weak specificity, broad
actionType unknown coverage, heavy unsupported assumptions, thin lineage, or
poor readiness visibility. The plan may still exist canonically, but it must not
be treated as high-trust plan truth.

### Withheld

The plan lacks sufficient canonical structural truth to support responsible
inspection or downstream trust-sensitive interpretation.

These states describe canonical plan structure quality, not live execution
behavior.

---

## 11. Acceptance Criteria

The plan quality pillars are explicitly defined.

Deliverable, action, and block quality rules are explicit.

Assumption and dependency standards are explicit.

The actionType coverage requirement is explicit.

Unknown actionType is treated as degraded truth, not silently accepted as
complete.

The standard is usable across the canonical 45 without becoming vague.

The standard can guide later implementation work for field completion and
scoring inputs.

---

## 12. Failure Cases To Prevent

- vague deliverables that merely restate the goal
- filler actions with no real execution meaning
- blocks that preserve no action truth
- hidden assumptions treated as facts
- execution presented without readiness truth
- `Unknown` actionType normalized as acceptable final quality
- plans judged good because they render cleanly despite weak canonical structure
- standards so abstract they cannot guide implementation

---

## 13. Minimal Implementation Order

1. Define the plan quality pillars.
2. Define deliverable, action, and block standards.
3. Define assumption and dependency/readiness standards.
4. Define the actionType coverage standard.
5. Define plan quality states.
6. Use the standard to drive upstream field coverage work.
7. Use the standard to support later feasibility and live P.O.S. inputs.
