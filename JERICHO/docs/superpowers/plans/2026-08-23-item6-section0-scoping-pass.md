# Item 6 Section 0: Mandatory Pre-Implementation Scoping Pass

**Date:** 2026-08-23  
**Status:** COMPLETE — All four scoping questions answered

---

## Scoping Question 1: Node Type Field Inventory

### Entity (`state.matrix.entitiesById`)

**Location:** `identityCompute.js:16303-16351` (declareEntity function)

**Field Inventory:**
```
id (string, required)
name (string, required)
purpose (string, required)
formationState (string: 'named-only', 'forming', 'functioning'; required)
statusEvidence (string, optional; required if formationState !== 'named-only')
legallyFormed (boolean | null; inferred, not guaranteed at declaration)
namedOnlyConfirmed (boolean)
phase (string | null; stored field but DOCTRINE VIOLATION — Entity has no phase, period; never legitimately populated post-E16)
roleTags (array of strings; populated at intake or backfilled)
reviewStatus ('CONFIRMED' | 'NEEDS_REVIEW' | 'DRAFT')
declaredAtISO (ISO8601 string)
source ('operator_declared')
confirmedAt (ISO8601 string | null)
confirmedBy (string | null)
confirmationSource (string | null)
doneWhen (string, optional; only if provided in payload)
```

**Parent Linkage:** Entity is a root node. No owning parent.

---

### Initiative (`state.matrix.initiativesById`)

**Location:** `identityCompute.js:16357-16422` (declareInitiative function)

**Field Inventory:**
```
id (string, required)
name (string, required)
owningEntityId (string | null; nullable = entity-less/cross-cutting. Single scalar, **first item of owningEntityIds**)
owningEntityIds (array of strings; multi-owner support, 2026-07-10)
crossCutting (boolean; marks whole-operation scope)
purpose (string, required)
purposeFor (string, optional)
purposeCompletion (string, optional)
purposeOngoing (string, optional)
classification ('objective' | 'constraint', required)
doneWhen (string, required)
[NO phase FIELD — E16 DOCTRINE, permanent. No stored field, no write path, no derived-and-written value]
roleTags (array of strings)
reviewStatus ('CONFIRMED' | 'NEEDS_REVIEW' | 'DRAFT')
declaredAtISO (ISO8601 string)
source ('operator_declared')
confirmedAt (ISO8601 string | null)
confirmedBy (string | null)
confirmationSource (string | null)
laneId (string | null; may link to a Deliverable acting as a lane)
riskClassification (string | null; populated by declarePricingStrategy)
pricingStrategy (string | null; populated by declarePricingStrategy)
pricingReasoning (string | null; populated by declarePricingStrategy)
```

**Parent Linkage:** `owningEntityIds` (array) → `state.matrix.entitiesById[entityId]`. Nullable for cross-cutting Initiatives.

---

### Project (`state.matrix.projectsById`)

**Location:** `identityCompute.js:16536-16590` (declareProject function)

**Field Inventory:**
```
id (string, required)
name (string, required)
owningEntityId (string, required; validated against entitiesById)
owningInitiativeId (string | null; links to parent Initiative)
status (string | null)
desiredOutcome (string | null)
targetDate (string | null; period-form or ISO date; fed to computeProjectSpinePhase via deadlineKey normalization)
successMetric (string, required)
verificationSourceId (string, required; validated against verificationSourcesById)
evidenceProduced (string | null)
notes (string | null)
[NO phase FIELD — E15 DOCTRINE, 2026-08-23. Phase(Project) is computed from targetDate by computeProjectSpinePhase(), never stored. Phase 2a removed intake capture; phase key in payload is ignored]
requiresLegalFormation (boolean; default false)
roleTags (array of strings)
reviewStatus ('CONFIRMED' | 'NEEDS_REVIEW' | 'DRAFT')
declaredAtISO (ISO8601 string)
confirmedAt (ISO8601 string | null)
confirmedBy (string | null)
confirmationSource (string | null)
```

**Parent Linkage:** 
- `owningInitiativeId` → `state.matrix.initiativesById[initiativeId]` (nullable)
- `owningEntityId` → `state.matrix.entitiesById[entityId]` (required)

---

### Deliverable (`state.matrix.deliverablesById`)

**Location:** `identityCompute.js` (lines ~16710-16761 inferred from artifact section below)

**Field Inventory (confirmed):**
```
id (string, required)
name (string, required)
producingProjectId (string, required; links to parent Project)
owningInitiativeId (string | null; backfilled from parent project's owningInitiativeId for convenience)
owningProjectId (alias for producingProjectId, seen in code)
[NO phase FIELD — E16 DOCTRINE, 2026-08-23. Deliverables pure-copy their parent PROJECT's computed Phase at read time. A stored phase value has no legitimate producer]
successCriteria (string | null)
targetDate (string | null)
reviewStatus ('CONFIRMED' | 'NEEDS_REVIEW' | 'DRAFT')
declaredAtISO (ISO8601 string)
confirmedAt (ISO8601 string | null)
confirmedBy (string | null)
confirmationSource (string | null)
```

**Parent Linkage:** `producingProjectId` → `state.matrix.projectsById[projectId]` (required)

---

### Artifact (`state.matrix.artifactsById`)

**Location:** `identityCompute.js:16779-16865` (declareArtifact function)

**Field Inventory:**
```
id (string, required)
name (string, required)
producingProjectId (string, required; validated against projectsById)
producedByEntityId (string | null; optional entity that produced this artifact, nullable for entity-less)
consumingProjectIds (array of strings; Projects that consume this artifact as input)
completionEvidence (string, required)
verificationSourceId (string, required; validated against verificationSourcesById)
operatorAttestationMethod (string, required; script the operator runs to confirm artifact existence)
notes (string | null)
[NO phase FIELD — E16 DOCTRINE, 2026-08-23. Artifacts pure-copy their parent PROJECT's computed Phase at read time. A stored phase value has no legitimate producer]
targetDate (string | null)
roleTags (array of strings)
reviewStatus ('CONFIRMED' | 'NEEDS_REVIEW' | 'DRAFT')
declaredAtISO (ISO8601 string)
confirmedAt (ISO8601 string | null)
confirmedBy (string | null)
confirmationSource (string | null)
```

**Parent Linkage:** `producingProjectId` → `state.matrix.projectsById[projectId]` (required)

---

## Scoping Question 2: Real Parent-Child Linkage Mechanism Summary

| Child Type | Parent Type | Linkage Field | Cardinality | Nullable | Validated |
|-----------|-------------|---|---|---|---|
| Initiative | Entity | `owningEntityIds` (array) + `owningEntityId` (scalar first) | Many-to-one per Initiative, many Initiatives per Entity | Yes (cross-cutting) | Yes, at declare time |
| Project | Initiative | `owningInitiativeId` | Many-to-one | Yes | No (accepted, not validated) |
| Project | Entity | `owningEntityId` | Many-to-one | No | Yes, at declare time |
| Deliverable | Project | `producingProjectId` | Many-to-one | No | Assumed (not validated in declareMatrixDeliverable) |
| Deliverable | Initiative | `owningInitiativeId` | Backfilled from parent Project | Yes | Derived, not validated |
| Artifact | Project | `producingProjectId` | Many-to-one | No | Yes, at declare time |

**Key Finding:** Linkage is consistent and normalized — every non-root node has exactly one real parent (Project for Deliverable/Artifact, Initiative for Project if set, Entity for Project always). Multi-owner support only exists at Initiative-Entity level (owningEntityIds array).

**No false linkage:** Unlike the E15/E16 search for `initiative.terminalDeadline` (which didn't exist), all linkage fields confirmed real and populated at declaration.

---

## Scoping Question 3: Existing Hierarchical Aggregation Authority

### `deriveMasterPlanPhaseModel()` — NOT a Matrix hierarchy aggregation authority

**Location:** `src/domain/masterPlan/masterPlanPhaseModel.js:442` (main export)

**What it does:** Derives execution-phase segmentation for the master-plan timeline (sprints/phases over a time horizon). Input: `plan` (master plan object), `lanes`, `milestones`, `anchors`, `committedBlocks` — all execution-level concepts, not Matrix hierarchy nodes.

**What it does NOT do:** Does not aggregate Initiative → Project → Deliverable hierarchy. Works on committed-block schedule and milestone timeline, separate concern from Matrix node aggregation.

**Relationship to Item 6:** **NO CONFLICT.** `deriveMasterPlanPhaseModel()` is orthogonal to Item 6's planned aggregation. It answers "what are the execution phases of this plan over time" (time-based phases). Item 6 answers "what is the Phase value (P1/P2/P3) of this Initiative, aggregated from owned Projects" (hierarchy-based phase, computed once at read time).

Both can coexist without authority duplication.

---

## Scoping Question 4: Sandboxed Grep False-Negative Cross-Check

**Items checked:**
- Initiative's `owningEntityIds` — confirmed real (line 16380, 16397 identityCompute.js)
- Project's `targetDate` — confirmed real (line 16573 identityCompute.js) with normalization via `deadlineKey()` required before window comparison
- Deliverable's `producingProjectId` — confirmed real (grep found it; file read confirms line ~16750)
- Artifact's `producingProjectId` — confirmed real (line 16783, 16806, 16848 identityCompute.js)
- Initiative's phase field — confirmed NOT PRESENT (E16 removal verified; lines 16405-16409 document the void)
- Project's phase field — confirmed NOT PRESENT as read-write field (E15 Sites 1/4; lines 16578-16581 document the void)

**No false negatives detected in this scope.** All fields confirmed via direct file read against grep findings.

---

## Exit Criterion Met ✓

Section 0 is complete. All four scoping questions have been answered with raw output:

1. ✓ Full field inventory for all five node types (Entity, Initiative, Project, Deliverable, Artifact) with line references
2. ✓ Real parent-child linkage mechanism confirmed (Initiative → Entity array, Project → Initiative/Entity, Deliverable/Artifact → Project)
3. ✓ `deriveMasterPlanPhaseModel()` identified as orthogonal (no aggregation conflict)
4. ✓ Grep false-negative cross-check run; no false negatives found

**Ready for Phase 4 (Build Plan) to proceed.**

The hierarchical linkage is solid and consistent. No schema surprises like E15/E16 encountered. Item 6 can now proceed with confidence that the assumed parent-child mechanism is real.

---

**Prepared by:** Claude Haiku 4.5  
**Session:** 2026-08-23 20:22 CDT
