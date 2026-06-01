# PLAN_QUALITY_3_GENERATION_SUBSTANCE_BRIEF.md

## Purpose

Improve generation so more plans pass the existing PQ1/PQ2 gates honestly.

The gate now knows how to reject:

- hollow deliverables
- lost goal objects
- visible meaning loss in surfaced blocks
- dropped required branches
- partial scope collapse

PQ3 is not about widening the gate further. It is about reducing how often those
failures are produced in the first place.

---

## Why this is the right next move

PQ1 established doctrine. PQ2 slice 1 expanded object-chain coverage. PQ2 slice
2 expanded structural coverage completeness. Both PQ2 slices now reject plans
that drift from the declared goal object and plans that silently drop declared
branches.

The next leverage is upstream: generate better structure so fewer plans fail at
the gate.

---

## Identified failure sources in the current generation layer

### 1. Generic fallback deliverables (`buildGenericDeliverables`)

**Location:** `src/domain/autoStrategy.ts` — `buildGenericDeliverables()` and
`stageDeliverable()`

When no archetype matches, all 15+ unrecognized goal types fall through to:

```ts
stageDeliverable('early', 0); // → 'Planning & setup'
stageDeliverable('middle', 0); // → 'Core production'
stageDeliverable('late', 0); // → 'Verification & finalization'
```

These titles are exactly what `DELIVERABLE_TOO_GENERIC_PATTERNS` rejects:

- `Planning & setup`
- `Core production`
- `Verification & finalization`
- `Build & refinement`
- `Execution & iteration`
- `Main development`
- `Final Review`
- `Launch & rollout`

Any goal routed to `buildGenericDeliverables` will fail plan quality before a
single block is scheduled.

**Fix target:** Replace `stageDeliverable()` with an object-preserving title
builder that accepts the goal text and constructs phase titles containing the
goal's concrete object.

---

### 2. Episodic production fallback path (`buildEpisodeProductionDeliverables`)

**Location:** `src/domain/autoStrategy.ts` ~L380-L410

The non-episodic-specific fallback branch produces:

```ts
title: 'Record and edit podcast episode set';
title: 'Finalize podcast release package and publishing plan';
```

`Record and edit podcast episode set` matches
`DELIVERABLE_OBJECT_MISSING_PATTERNS` directly. This path fires when episode
count is not parseable from the goal text — so the fallback is guaranteed to
fail plan quality.

**Fix target:** The fallback path should produce episode-set titles that
preserve the concrete object (already partially addressed in PQ2 slice 1 for
some paths; needs full coverage for the non-count-parseable case).

---

### 3. Generic block title propagation

**Location:** `src/domain/autoStrategy.ts` — `stageDeliverable()` output flows
into block title generation

When `stageDeliverable()` titles are used as deliverable names, any blocks
inheriting those titles will fail `BLOCK_TOO_GENERIC_PATTERNS` and
`LINEAGE_VISIBLE_MEANING_LOSS`. The root is the deliverable title — fix the
deliverable title and block propagation improves automatically if the
propagation rule is preserved.

---

### 4. Minimum-deliverable padding (`stageDeliverable('late', ...)`)

**Location:** `src/domain/autoStrategy.ts` L1220-1226

The while loop that ensures minimum 3 deliverables calls
`stageDeliverable('late', ...)` unconditionally. This will produce
`Verification & finalization`, `Quality assurance`, or `Final review` as padding
— all rejected by `DELIVERABLE_TOO_GENERIC_PATTERNS`.

**Fix target:** Padding deliverables should be constructed from the goal object,
not from phase-label pools.

---

## Bounded implementation order

1. **Define a goal-object-aware title builder**

   A small utility that accepts the extracted goal object tokens and a phase
   position, and constructs a deliverable title that includes the concrete
   object.

   Example output for goal "launch a podcast":
   - early: `podcast show format and setup`
   - middle: `podcast episode production`
   - late: `podcast release and distribution`

   This is bounded: no semantic inference, just object token propagation through
   phase templates.

2. **Replace `stageDeliverable()` calls in `buildGenericDeliverables()`**

   Replace the three `stageDeliverable()` calls with the new object-aware
   builder, passing the extracted goal object.

3. **Replace `stageDeliverable()` calls in the minimum-deliverable padding
   loop**

   Same builder, same goal object. Padding titles should carry the object.

4. **Fix the episodic fallback non-count path**

   When episode count is not parseable, produce object-specific titles rather
   than the `record and edit episode set` pattern that directly matches
   `DELIVERABLE_OBJECT_MISSING_PATTERNS`.

5. **Add focused tests for each generation improvement**

   Per-archetype tests confirming:
   - generic fallback output no longer fails `DELIVERABLE_TOO_GENERIC`
   - episodic fallback non-count path no longer fails
     `DELIVERABLE_OBJECT_MISSING`
   - minimum-deliverable padding carries the goal object

---

## What not to do

- Do not add more archetype branches for edge cases
- Do not generalize the goal-type detector
- Do not change the admission doctrine or gate thresholds
- Do not soften PQ2 evaluator heuristics to accommodate weak titles
- Do not add NLP or fuzzy matching to generation

The improvement should be structural: object-preserving title templates, not
smarter inference.

---

## Success condition

A plan generated for an unrecognized goal type should produce deliverable titles
that:

- contain the goal's concrete object (not just a phase label)
- do not match `DELIVERABLE_TOO_GENERIC_PATTERNS`
- do not match `DELIVERABLE_OBJECT_MISSING_PATTERNS`
- propagate the object through to block titles without loss

Measured by: existing PQ2 evaluator output. No new gate changes required.

---

## Scope boundary

This milestone is complete when:

- `buildGenericDeliverables` produces object-bearing titles
- episodic fallback non-count path no longer produces
  `DELIVERABLE_OBJECT_MISSING` titles
- minimum-deliverable padding no longer produces `DELIVERABLE_TOO_GENERIC`
  titles
- focused tests are green
- canonical sharded verification passes

It does not require:

- fixing all 16 archetype builders (only the fallback and padding paths)
- upstream wiring of `branchCoverageSummary` (separate scope)
- any changes to the evaluator or gate doctrine
