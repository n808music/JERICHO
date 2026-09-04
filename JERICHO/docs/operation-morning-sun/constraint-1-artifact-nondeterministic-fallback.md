# Test 1 Entry Condition: Artifact Nondeterministic Fallback

**Finding Date**: 2026-09-04  
**Status**: Identified as test-1 blocker  
**Severity**: Blocks determinism guarantee  
**Related**: Test 1 entry conditions; Artifact intake gate completeness

## The Defect

**Location**: `src/domain/elicitation/artifactSlot.ts:68`

```typescript
const id =
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `artifact-${Date.now()}`;
```

When an Artifact name slugifies to empty, the id defaults to `artifact-${Date.now()}` — a **nondeterministic timestamp**.

## Why This Is a Blocker

### 1. Breaks determinism (test-1 core property)
Test 1 exists to verify that intake-produced nodes are byte-identical to fixtures across runs. A `Date.now()` id defeats this: the same declaration produces a different node id every time.

### 2. Silent default (wrong pattern)
Instead of failing on invalid input (an empty-slug Artifact), it invents an id. This is the `|| 'reference'` and `'on going'` antipattern that was identified and removed elsewhere — it's not caught here.

### 3. Gate missing
The existence of the fallback signals a missing non-empty-name gate on the Artifact slot. Compare to **Deliverable Gate A** (required: name is substantive), which this design locked first. The Artifact slot should reject empty names at the gate level, making line 68 unreachable.

### 4. Immune to Layer 2
The uniqueness assertion (proposed in the prefix-shadowing finding) cannot catch this. A timestamp-based id is unique by construction, so an assertion that "no id is minted twice" will always pass — rendering it blind to the nondeterminism.

## The Fix

**Do not route this through `nodeId()`.** That would centralize the bad behavior, not fix it.

**Remove the fallback entirely.** Fail the declaration if the name slugifies to empty:

```typescript
const slug = name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 64);

if (!slug) {
  // Reject the declaration — name is empty or invalid
  return { errorCode: 'ARTIFACT_NAME_INVALID_EMPTY_SLUG', ... };
}

const id = slug;
```

This requires a corresponding gate on the Artifact slot: **"Artifact name must slugify to a non-empty string."** This closes the gap that the fallback was masking.

## Entry Condition Impact

This is one of four entry conditions for test 1:

1. **All six classes producible** — Entity, Initiative, Project, Deliverable, Artifact, System ✅
2. **Artifact parentage node-shape** — Artifact→Deliverable→Project linkage ✅ (verified in v3.0 fixture)
3. **Artifact-grain buffers** — elicitation produces Artifact-sized units — *blocked by this defect*
4. **ID determinism** — same intake produces identical node ids across runs — *blocked by this defect*
5. **Edge `target_date` resolution** — convergence edges resolve their dates — pending

**Deliverable Gate A** (name substantiveness, locked during design) stands as proof of concept. Artifact Gate needs the same rigor.

## Evidence

- `artifactSlot.ts:61-84` — fallback at line 68, gate list at lines 10-58 (no non-empty-slug gate)
- `slots/deliverableSlot.js` — has substantive-name gate; Artifact slot does not
- Test 1 spec: "deterministic output" — violated by `Date.now()`
