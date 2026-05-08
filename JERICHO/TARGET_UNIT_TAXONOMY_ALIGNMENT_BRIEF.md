# TARGET_UNIT_TAXONOMY_ALIGNMENT_BRIEF.md

## Purpose

Define a bounded product slice to repair target-unit taxonomy alignment at the
intake layer so Jericho can represent the user's intended success metric before
planning begins.

This brief is about **intake measurement alignment**, not:

- builder quality
- evaluator doctrine
- UI truth-surface presentation
- lane-local wording polish

The problem sits upstream of planning truth. If the target unit is wrong, the
intake contract is already distorted before generation, evaluation, or schedule
logic can help.

---

## Core problem

Jericho can now generate materially better plans, but intake still sometimes
forces the wrong measurement grammar onto the goal.

The system currently has cases where:

- the goal is expressed in an **outcome unit**
- the lane taxonomy offers only **process units**
- the user must choose a proxy that does not match the stated goal

That creates a broken intake contract before planning starts.

---

## Why this matters

If target count and target unit are not semantically aligned to the goal, the
system risks:

- distorted plan generation
- incorrect feasibility interpretation
- weakened trust surface
- forced user compromise
- user abandonment from visible misunderstanding

The user sees this immediately:

- “I said pounds. Why can’t I choose pounds lost?”
- “I said fundraising package. Why am I choosing dollars committed?”

This is not a minor dropdown annoyance. It is a planning-truth bottleneck.

---

## Anchor examples

### Example 1 — Fundraising package preparation

Goal:

- “Prepare a friends-and-family fundraising package for Jericho in 21 days so I
  have a clear pitch, financial ask, use-of-funds story, and investor-ready
  materials.”

Observed gap:

- available units skew toward live raise execution
- dollars committed
- meetings completed
- diligence packets delivered
- lead investors secured

Problem:

- the goal asks for a package-preparation output
- the unit taxonomy pushes the user into live-raise proxy units

### Example 2 — PhysicalTraining weight-loss goal

Goal:

- lose 10 pounds
- improve conditioning
- build a sustainable plan

Observed gap:

- available units skew toward process units
- training sessions completed
- workout blocks completed
- benchmark checks completed
- conditioning blocks completed

Problem:

- the goal declares an explicit outcome unit: pounds lost
- the taxonomy does not let the user represent that stated success metric

---

## Problem definition

The systematic issue is:

**the target-unit taxonomy is lane-biased toward one kind of measurement and
cannot always represent the user’s actual goal metric.**

More specifically:

- intake can preserve lane selection
- intake can preserve target count
- but intake may still fail to preserve the **correct unit grammar**

That means the system may understand the domain but still misunderstand what
counts as success.

---

## Desired product behavior

### Best behavior

Infer a likely target unit directly from the goal text and selected lane when
the unit is explicit and supported.

Examples:

- “lose 10 pounds” -> `10` + `pounds lost`
- “prepare one fundraising package” -> `1` + `fundraising packages prepared`

### Acceptable behavior

If taxonomy confidence is low or the lane set is incomplete:

- allow a goal-native manual unit entry
- or provide an `Other` option with explicit user-entered unit

### Lane taxonomy standard

Each lane should be able to represent both of these when appropriate:

- **outcome units**
- **process units**

The product should not force every goal into process units when the goal is
clearly outcome-framed.

---

## Proposed solution shape

This slice should likely include three bounded layers.

### 1. Goal-to-unit inference

Extract likely unit signals from the goal text and selected lane.

Examples:

- pounds lost
- pounds gained
- miles run
- fundraising package prepared
- mock exams completed
- projects completed

### 2. Lane-aware taxonomy expansion

Expand lane taxonomies so they include both:

- lane-valid process units
- lane-valid outcome units

### 3. Manual fallback

If no taxonomy entry cleanly matches the goal:

- allow explicit manual unit entry
- preserve it through the intake contract

---

## Initial lane targets

This slice should start with the strongest proven examples:

### Fundraising

Needed additions:

- fundraising package prepared
- investor-ready package completed
- deck + diligence package completed

alongside existing execution-stage units where appropriate

### PhysicalTraining

Needed additions:

- pounds lost
- pounds gained
- body-fat points reduced
- miles completed
- pace benchmark achieved

alongside existing process units like sessions and training blocks

These two lanes should be treated as the first hard acceptance examples.

---

## Non-goals

This slice should **not**:

- redesign the full intake UI
- reopen builder-path work
- reopen evaluator doctrine
- add freeform semantic AI adjudication
- broaden into cross-lane planning refactors
- patch over the problem with UI-only labels while canonical units remain wrong

---

## Acceptance standard

The system should pass this truth test:

**Can the user represent the goal’s intended success metric directly, without
being forced into a semantically distorted proxy?**

If not, the intake layer is still wrong.

---

## Acceptance tests

Minimum first-pass matrix:

### Fundraising

- package-prep fundraising goal can select a package-preparation unit
- live-raise fundraising goal can still select execution-stage units
- package-prep goal is not forced into dollars/meetings/commitments

### PhysicalTraining

- weight-loss goal surfaces `pounds lost`
- general training goal can still use sessions/blocks
- outcome-framed goal is not forced into process-only units

### Contract preservation

- selected/inferred unit survives into the intake contract unchanged
- target count stays paired with the correct unit
- downstream planning reads the preserved unit rather than a coerced proxy

---

## Implementation constraints

- minimal blast radius
- source-level contract correctness first
- no fake UI backfill
- no silent coercion of outcome goals into process units
- preserve current lane/builder improvements
- keep policy doctrine unchanged unless direct evidence requires a bounded
  policy update

---

## Milestone outcome

This slice is successful when:

- users can represent their actual stated success metric at intake
- Fundraising package-prep and PhysicalTraining weight-loss goals no longer
  require distorted proxy units
- the target count + target unit pair becomes semantically aligned with the goal
- the intake contract becomes a trustworthy upstream substrate for planning

---

## Bottom line

Jericho now generates better plans, but intake still sometimes forces the wrong
measurement grammar onto the goal.

This brief isolates that issue as a distinct upstream slice:

**target-unit taxonomy alignment**

It should be implemented as a bounded contract-repair milestone before broader
lane expansion or downstream planning changes rely on the wrong measurement
surface.
