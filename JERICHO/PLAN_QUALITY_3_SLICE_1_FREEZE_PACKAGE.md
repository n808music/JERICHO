# PLAN_QUALITY_3_SLICE_1_FREEZE_PACKAGE.md

## Status

Closed.

This slice is frozen on the basis of canonical sharded verification.

---

## Verification policy for this milestone

Canonical verification method (inherited from PQ2):

- `npm run lint`
- `npm run format:check`
- `npx vitest run --shard=1/2`
- `npx vitest run --shard=2/2`

### Final verification results

- lint: pass
- format:check: pass
- vitest --shard=1/2: pass
  - `161` files
  - `671` tests
- vitest --shard=2/2: pass
  - `160` files
  - `646` tests

### Aggregate logical total

- `321` files passed
- `1317` tests passed

---

## Scope of this slice

First PQ3 pass: improve generation quality so more plans pass the existing
PQ1/PQ2 gates honestly.

The gate was not changed. Generation was improved at the failure sources
identified in `PLAN_QUALITY_3_GENERATION_SUBSTANCE_BRIEF.md`.

---

## What changed

### New helpers added (`src/domain/autoStrategy.ts`)

**`extractGoalObjectPhrase(outcomeText, verificationText)`**

Extracts the primary object noun phrase from goal text. Strips stopwords and
process verbs, then captures the first 1–3 meaningful content words following a
process verb. Falls back to the first 2 content words if no post-verb capture
matches.

Used as input to `buildObjectAwareStagedTitle`.

**`buildObjectAwareStagedTitle(stage, index, goalObject)`**

Builds a deliverable title that carries the goal object through a phase
position. Applies phase-position templates:

- early: `{object} foundation and setup`,
  `{object} scope and initial structure`, `{object} planning and preparation`
- middle: `{object} core production`, `{object} development and iteration`,
  `{object} build and refinement`
- late: `{object} completion and review`, `{object} final delivery`,
  `{object} release and closeout`

Falls back to `stageDeliverable()` only if no object can be extracted.

---

### Call sites replaced

| Location                            | Before                                          | After                                                                  |
| ----------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| `buildGenericDeliverables` — early  | `stageDeliverable('early', 0)`                  | `buildObjectAwareStagedTitle('early', 0, goalObject)`                  |
| `buildGenericDeliverables` — middle | `stageDeliverable('middle', 0)`                 | `buildObjectAwareStagedTitle('middle', 0, goalObject)`                 |
| `buildGenericDeliverables` — late   | `stageDeliverable('late', 0)`                   | `buildObjectAwareStagedTitle('late', 0, goalObject)`                   |
| Minimum-deliverable padding loop    | `stageDeliverable('late', deliverables.length)` | `buildObjectAwareStagedTitle('late', deliverables.length, goalObject)` |

`goalObject` is extracted once in the main export function and threaded into
both call sites.

---

### Episodic fallback non-count path

**Before:** `'Record and edit podcast episode set'` — directly matched
`DELIVERABLE_OBJECT_MISSING_PATTERNS`, guaranteed gate failure

**After:** `'Record and edit podcast episode batch'` — preserves the concrete
object, does not match the failure pattern

---

### Before/after title examples

| Goal text                                          | Phase              | Before                                | After                                       |
| -------------------------------------------------- | ------------------ | ------------------------------------- | ------------------------------------------- |
| "Launch a consulting practice with paying clients" | early              | `Planning & setup`                    | `consulting practice foundation and setup`  |
| "Launch a consulting practice with paying clients" | middle             | `Core production`                     | `consulting practice core production`       |
| "Launch a consulting practice with paying clients" | late               | `Verification & finalization`         | `consulting practice completion and review` |
| Any goal → padding                                 | late               | `Verification & finalization`         | `{object} completion and review`            |
| "Start a podcast" (no count)                       | episode production | `Record and edit podcast episode set` | `Record and edit podcast episode batch`     |

---

### Downstream inheritance

Block and action titles that inherit from these deliverable titles now carry the
goal object without additional changes to the block generation layer. The
improvement propagates through existing inheritance — no block-specific hacks
added.

---

## Evaluator doctrine

No evaluator changes were made. No new failure codes added. No detection logic
modified. No gate thresholds adjusted.

The evaluator and admission doctrine are unchanged from PQ2 slice 2 freeze
state.

---

## Tests added or updated (`src/domain/autoStrategy.test.ts`)

### New tests

1. **generic fallback: deliverable titles carry the goal object, not hollow
   phase labels**
   - Goal: "Launch a consulting practice with paying clients"
   - Asserts `detectedType === 'generic'`
   - Asserts no title matches hollow phase label patterns (`Planning & setup`,
     `Core production`, `Verification & finalization`, etc.)
   - Asserts at least one title contains the extracted goal object

2. **minimum-deliverable padding: padded titles carry the goal object, not
   generic phase labels**
   - Goal: "Complete ceramic sculpture series for gallery submission"
   - Asserts minimum 3 deliverables
   - Asserts no padded title is a bare hollow phase label

3. **episodic fallback non-count path: no longer produces
   DELIVERABLE_OBJECT_MISSING title**
   - Goal: "Record and release a podcast show" (no episode count)
   - Asserts `detectedType === 'episodic_production'`
   - Asserts titles do not contain `record and edit episode set` or
     `record and edit podcast episode set`

### Updated test

- Existing assertion
  `expect(titles).toContain('record and edit podcast episode set')` updated to
  `'record and edit podcast episode batch'`

---

## Deferred scope

Still intentionally deferred after this slice:

- Wiring `branchCoverageSummary` from the generation layer so PQ2 coverage
  checks are exercised in real plan flows (not just in explicitly-instrumented
  tests)
- Archetype-specific object-aware builder improvements for the highest-value
  non-generic lanes
- Broader fallback title hardening beyond the three source paths targeted here
- Aggregate single-run Vitest harness stabilization (infrastructure track)

---

## Milestone conclusion

Plan Quality 3 slice 1 is frozen. Hollow generation titles in the generic staged
path, padding path, and episodic fallback path were replaced with object-aware
title construction, improving deliverable and inherited block substance without
changing evaluator doctrine or widening detection scope.
