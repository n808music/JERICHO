# Convergence Lifecycle Step 3: Forward Declaration Implementation

## Overview
Step 3 implements the forward declaration mechanism for Convergence edges, including dependency validation, deliverable/artifact walkdown, and targetDate assignment.

## Code Changes

### 1. Helper Functions (identityCompute.js lines 16609-16695)

#### `validateSourcesNotSequentiallyDependent(sourceIds, dependenciesById)`
- **Purpose**: Hard-block sources that have sequential dependencies
- **Algorithm**: BFS traversal (reusing Task 2 pattern from aimCompute.js)
- **Returns**: `{ isSequential: boolean, violatingPair: [id1, id2] | null }`
- **Raises**: CONVERGENCE_SOURCES_SEQUENTIAL error if sequential dependency found

#### `findDeliverablesByOwner(nodeId, matrix)`
- **Purpose**: Discover all deliverables owned by an entity/initiative/system
- **Returns**: Array of Deliverable IDs
- **Traversal**: 
  - Direct ownership via `owningInitiativeId`
  - Indirect via projects owned by entity

#### `findArtifactsByProducer(projectId, matrix)`
- **Purpose**: Find all artifacts produced by a project
- **Returns**: Array of Artifact IDs

### 2. Updated `declareConvergence()` Function (identityCompute.js lines 16697-16849)

#### New Required Fields
- **`name`** (string, required): Operator-chosen name (e.g., "Oct 17 2026 Convergence")
  - Must be provided at declaration time
  - **Editable after declaration** (design requirement: names go stale with reschedules)
  - Raises: CONVERGENCE_NAME_REQUIRED error if missing

- **`targetDate`** (ISO string, optional): Shared deadline for all sources
  - Assigned to discovered deliverables/artifacts via `convergenceTargetDate` field

#### New Validation Logic
1. **Name validation**: Reject if name not provided
2. **Source normalization**: Accept either `fromNodeId` (scalar) or `fromNodeIds` (array)
3. **Source validation**: Verify all sources exist in declared-node registries
4. **Destination validation**: Verify destination exists
5. **Self-exclusion**: Filter out destination from sources list
6. **Sequential dependency check**: Hard block if any two sources are transitively dependent
   - Raises: CONVERGENCE_SOURCES_SEQUENTIAL error with violating pair

#### Walkdown Logic
```javascript
for (const sourceId of fromNodeIds) {
  // Find deliverables owned by this source
  const ownedDeliverables = findDeliverablesByOwner(sourceId, state.matrix);
  sourceDeliverableIds.push(...ownedDeliverables);

  // Find artifacts (if source is a project)
  const project = state.matrix.projectsById?.[sourceId];
  if (project) {
    const producedArtifacts = findArtifactsByProducer(sourceId, state.matrix);
    sourceArtifactIds.push(...producedArtifacts);
  }
}
```

#### TargetDate Assignment
```javascript
if (targetDate) {
  for (const delivId of uniqueDeliverableIds) {
    const deliv = state.matrix.deliverablesById[delivId];
    if (deliv) {
      deliv.convergenceTargetDate = targetDate;
    }
  }
  // Similar for artifacts
}
```

### 3. New Schema Fields (convergenceEdgesById entries)

#### Step 3 Added Fields
```typescript
{
  id: string;
  name: string;                          // NEW: operator-chosen name
  fromNodeId: string;                    // (legacy: first source)
  fromNodeIds: string[];                 // Multi-source support
  toNodeId: string;
  gives: string;
  targetDate: string | null;             // NEW: shared deadline
  status: 'PENDING';                     // NEW: computed at deadline
  sourceDeliverableIds: string[];        // NEW: walkdown result
  sourceArtifactIds: string[];           // NEW: walkdown result
  supersedes: string | null;             // NEW: (for Step 4 reschedule)
  supersededBy: string | null;           // NEW: (for Step 4 supersede)
  broken: boolean;
  label: string | null;
  declaredAtISO: string;
}
```

#### Matrix Registry Inclusion
- Added `deliverablesById` to REGISTRIES validation (line 16737)
- Enables deliverables to be direct convergence sources

## Design Decisions

### Name Editability
- Names are intentionally mutable after declaration
- Rationale: Date-based names become stale after reschedules
- Operator must be able to correct them without recreating the edge

### Hard Block on Sequential Dependencies
- Converging sources must be genuinely parallel
- Sequential sources indicate hidden serial dependency, not true convergence
- Operator judgment override not permitted (differs from many other gates)

### Walkdown Strategy
- Converges specified at high-level node (Entity/Initiative/Project)
- System automatically discovers owned deliverables/artifacts
- Operator confirms/selects specific units if needed (Step 3 intake UI)

### TargetDate Assignment
- Shared deadline propagated to all discovered units
- Assignment is deterministic (no operator override)
- Enables deadline-aware planning at deliverable granularity

## Error Codes

| Code | Trigger | Remedy |
|------|---------|--------|
| `CONVERGENCE_NAME_REQUIRED` | Name not provided | Provide operator-chosen name |
| `CONVERGENCE_SOURCES_EMPTY` | No sources after normalization | Provide fromNodeId or fromNodeIds |
| `CONVERGENCE_SOURCE_UNKNOWN` | Source not in any registry | Declare source first |
| `CONVERGENCE_TO_UNKNOWN` | Destination not in registry | Declare destination first |
| `CONVERGENCE_SOURCES_EXCLUDE_DEST` | All sources equal destination | Remove destination from sources |
| `CONVERGENCE_SOURCES_SEQUENTIAL` | Sequential dependency detected | Remove sequential source OR declare separately |

## Testing

### Test File: `convergence_step3_minimal.test.js`
- Schema validation (all fields present)
- Documentation of design decisions
- Structural verification (no integration complexity)

### Test File: `convergence_step3_forward_declaration.test.js`
- Full integration tests (pending simplification of entity/deliverable setup)
- Edge cases: parallel sources, walkdown discovery, targetDate propagation

## Next Steps (Step 4)

Step 4 will implement status computation and the reschedule/close logic:
- Converged: Write Milestone record
- Partial/Missed: Surface reschedule decision point
- Reschedule path: Create new superseding edge (mark old as superseded)
- Close-as-unresolved path: Block until all sources have disposition

