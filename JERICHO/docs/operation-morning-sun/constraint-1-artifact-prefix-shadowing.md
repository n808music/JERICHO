# Constraint 1: Artifact Prefix-Shadowing Hazard

**Finding Date**: 2026-09-04  
**Status**: Identified, sequencing documented  
**Related**: Constraint 1 implementation (2026-08-28 through 2026-09-03)

## The Hazard

Five of six node classes now mint class-prefixed IDs:
- Entity: `entity-${slug}`
- Initiative: `initiative-${slug}`
- Project: `project-${slug}`
- Deliverable: `deliverable-${slug}`
- System: `system-${slug}`
- **Artifact: bare `${slug}` (no prefix)**

This creates a **prefix-shadowing collision risk**: an Artifact whose *name* slugifies to a string starting with another class's prefix will collide with a same-prefix node of a different class.

### Live example from current matrix

```
Artifact "System Architecture Diagram" → slugId("System Architecture Diagram")
System "Architecture Diagram" → slugId("Architecture Diagram")
```

Both produce `system-architecture-diagram` under current schemes (or would, if Artifact were prefixed):

```
Artifact "System Architecture Diagram" → "system-architecture-diagram"
System "System Architecture Diagram" → "system-architecture-diagram"  [collision: same id, different class]
```

This is a **silent corruption** — the load succeeds, no error raised, and both nodes resolve to the same object in the matrix. This is precisely the "string-as-foreign-key" defect Constraint 1 was built to eliminate.

### Why it matters

The naming patterns in this matrix make the collision probable:
- Artifacts are often named after their parent Deliverables or Projects
- "Business Plan Document," "Chapter/Finale," "System Requirements" are live artifact names
- "System," "Project," "Initiative" and "Deliverable" are common first words

A collision is not a distant edge case — it's a predictable consequence of natural naming.

## The Fix: Three Layers

### Layer 1: Prefix Artifact uniformly
**Change**: `artifactSlot.ts:68` and `loadReferenceMatrix.js` both mint `artifact-${slug}`  
**Cost**: 175 Artifact nodes + every test asserting bare artifact ids  
**Payoff**: Eliminates prefix shadowing entirely; makes all six classes follow the same rule.  
**Prerequisite**: `nodeId()` helper (now centralized in `loadReferenceMatrix.js`, used in tests).

### Layer 2: Add a uniqueness assertion (loud failure on collision)
**Change**: At mint time (both paths), check that no id has been minted twice. Fail through `lastPlanError` if a collision occurs.  
**Cost**: One small check in each builder and loader.  
**Payoff**: **Catches the defect under any prefix scheme**, including the long-term opaque-key design. Works regardless of whether Layer 1 lands.  
**Independence**: Can land first. If it passes with current data, you've proven no collision in the live matrix.

### Layer 3: Characterize the artifact fallback
**Check**: `artifactSlot.ts:68` has a nondeterministic fallback (`artifact-${Date.now()}`). Verify it doesn't mint through a path that bypasses Layers 1 & 2.

## Sequencing Recommendation

**Do Layer 2 first.** It's the actual fix — it makes collisions impossible to miss — and it's independent of Layer 1. If the current matrix passes Layer 2, you've closed the defect. Layer 1 is supporting hygiene (making the rule uniform), valuable but not the blocker.

The current Constraint 1 branch correctly implements the five prefixed classes and centralizes ID construction via `nodeId()`. This finding characterizes what remains on the Artifact side.

## Evidence

- Builder mints: `entitySlot.ts:142`, `initiativeSlot.ts:244`, `projectSlot.js:77`, `deliverableSlot.js:91`, `systemSlot.ts:118` — all prefixed ✓
- Loader mints: `loadReferenceMatrix.js:51-61` — all prefixed via `nodeId()` ✓
- **Artifact builder mint**: `artifactSlot.ts:68` — bare slug + nondeterministic fallback (unexamined)
- **Artifact loader mint**: `loadReferenceMatrix.js:58` — bare slug (uniform with builder, but no prefix)
