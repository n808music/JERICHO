# Deliverable Intake Design

**Status**: Design phase. Locked inputs from column-vs-clause audit. Ready for implementation.

**Date**: 2026-09-02

---

## Design Inputs (Locked)

### Fixture Properties (Six)
| Property | Fill Rate | Locked Behavior |
|---|---|---|
| `parent_project` | 100% | Required; exactly one Project parent (Clause 1) |
| `executing_entity` | 100% | Required; exactly one Entity, may differ from Project owner (Clause 2) |
| `target_date` | 100% | Required; Deliverable's own date (Clause 3); Phase derives from parent Project's date |
| `what_ships` | 44% (28/63) | Relabel to `description`; pure rename of loader line 133; context-awareness tier, never a gate |
| `buffer_anchor` | 32% (20/63) | Optional; 20 Deliverables have buffers; both anchor and binding appear together |
| `buffer_binding` | 32% (20/63) | Optional; paired with buffer_anchor; never split |

### Constraints (From Definition & Audit)
1. **Phase never elicited** — computed at read time from parent Project's terminal date
2. **Dependencies are edge-structured** — no `depends_on` or `dependency_type` Deliverable fields; edges stored separately in `canonical_edges` (from/to/type); intake uses edge builder
3. **Buffers are paired** — `buffer_anchor` and `buffer_binding` appear on same nodes; one buffer per buffered Deliverable
4. **No orphan fields** — all ten locked Deliverable columns are accounted for (seven properties, edge structure, computed phase)
5. **Clause 4 violation live** — two Deliverables have zero Artifacts: "79th Street — Acquisition Complete" and "First Academy Building — Opening"; need collapsed Artifacts with operator-defined doneWhen

---

## Intake Slot Design

### `deliverableSlot.ts` Structure

**Gate Sequence** (following established pattern):

```
1. INTAKE ELICITATION
   → name (text, non-empty)
   → parent_project (project selector, required, exactly one)
   → executing_entity (entity selector, required, exactly one)
   → target_date (ISO date YYYY-MM-DD, required)
   → description (text, optional; formerly what_ships)
   → buffer_anchor (text/selector, optional)
   → buffer_binding (dropdown: hard/advisory, conditional on buffer_anchor)

2. GATE SEQUENCE
   Gate A: name present and non-empty
   Gate B: parent_project selected and exists
   Gate C: executing_entity selected and exists
   Gate D: target_date is valid ISO date and >= today (or configurable threshold)
   Gate E: if buffer_anchor present, buffer_binding must be present (paired constraint)
   Gate F: completeness check for optional fields (description, buffers treated as optional unit)

3. VALIDATION RULES
   → Project must exist in matrix (resolved by parent_project selector)
   → Executing Entity must exist in matrix (resolved by selector)
   → target_date must be a valid calendar date (reject Feb 29 in non-leap years, etc.)
   → buffer_anchor and buffer_binding must both be present or both absent (atomic pair)
   → No duplicate Deliverable names within the same Project (user-level uniqueness)

4. ERROR RECOVERY
   → Missing required field → gate blocks, asks for value
   → Invalid date → ask for ISO format YYYY-MM-DD
   → buffer_binding without buffer_anchor → ask user to either provide anchor or clear binding
```

### Payload Builder Signature

```typescript
export function buildDeliverableDeclarePayload(captured: {
  name: string;
  parent_project: string;  // Project id
  executing_entity: string; // Entity id
  target_date: string;     // ISO date YYYY-MM-DD
  description?: string;    // optional, relabeled from what_ships
  buffer_anchor?: string;  // optional, must pair with binding
  buffer_binding?: 'hard' | 'advisory'; // optional, must pair with anchor
}): DeliverableDeclarePayload {
  // Returns:
  return {
    id: `deliverable-${slug(name)}`,
    name: captured.name,
    parent_project: captured.parent_project,
    executing_entity: captured.executing_entity,
    target_date: captured.target_date,
    description: captured.description || null,
    buffer_anchor: captured.buffer_anchor || null,
    buffer_binding: captured.buffer_binding || null,
    // Phase: never
    // depends_on: never (edges handled separately via edge builder)
  };
}
```

### Reducer Integration (`identityCompute.js`)

**`declareDeliverable` function** (analogous to `declareProject`, `declareArtifact`):

1. Extract and validate captured fields
2. Resolve parent_project and executing_entity IDs
3. Validate target_date calendar validity
4. Check buffer pair constraint (both or neither)
5. Create node:
   ```javascript
   state.matrix.deliverablesById[id] = {
     id,
     name,
     parent_project,      // owningProjectId in reducer
     executing_entity,
     target_date,
     description,
     buffer_anchor,
     buffer_binding,
     declaredAtISO: nowISO,
     // phase: computed at read time from parent Project
     // depends_on: handled via declareMatrixLink (edges)
   };
   ```
6. Record in state.matrix for phase resolution (phaseGridFromStore will inherit parent Project's phase)

---

## Two Creation Paths (Locked Pattern)

### Path 1: Deliverable Buffers (Intake Field)

Elicited as optional pair on the Deliverable form. Both stored on the same node.

**Lifecycle**:
- Intake → buildDeliverableDeclarePayload emits `buffer_anchor`, `buffer_binding`
- Reducer → `declareDeliverable` stores both
- Reader → `phaseGridFromStore` resolves parent Project phase for display

### Path 2: Deliverable Dependencies (Edge Builder)

**Not** elicited as Deliverable fields. Dependencies are edge-structured in `canonical_edges` (from/to/type).

**Intake flow** (separate from Deliverable form):
- User creates Deliverable first
- Then creates dependency edges via edge builder (`buildDependencyDeclarePayload`)
- Edge builder handles dependency type and satisfaction_mode

**Why two paths**:
- Buffers are Deliverable-grain state (when work is blocked, what kind of buffer)
- Dependencies are cross-node relationships (from one Deliverable to another)
- Doctrine states both "attach at Deliverable grain" — buffers as fields, dependencies as edges

---

## First Test Cases (Live Violations)

### Zero-Artifact Deliverables (Clause 4 Violation)

Two Deliverables have no child Artifacts, violating Clause 4 ("decomposes into one or more Artifacts"):

1. **"79th Street — Acquisition Complete"**
   - Project: "79th Street Renovation Production"
   - Fixture `what_ships`: "Target property acquired, launch milestone for the renovation initiative"
   - **Needed**: Collapsed Artifact with operator-defined doneWhen
   - **doneWhen pending**: [operator text describing closing process and verification source]

2. **"First Academy Building — Opening"**
   - Project: "First Academy Building Production"
   - Fixture `what_ships`: "Academy's first physical school location opens; houses Global State Solutions HQ"
   - **Needed**: Collapsed Artifact with operator-defined doneWhen
   - **doneWhen pending**: [operator text describing opening verification and verification source]

**Design exercise**:
1. Use intake to create both Deliverables (parent_project, executing_entity, target_date are known)
2. Create collapsed Artifact for each (one Artifact per Deliverable, with `parent_deliverable` = the Deliverable's id)
3. Elicit doneWhen from operator (Attestation Contract: operator actions against external verification source)
4. Verify Clause 4 is now satisfied (at least one Artifact per Deliverable)

---

## What Intake Does Not Handle

- **Phase**: Never elicited. Computed from parent Project's terminal date at read time.
- **Dependencies**: Handled via edge builder, not Deliverable intake.
- **Artifacts**: Created separately, bind to Deliverable via `parent_deliverable` field.

---

## Independent Items (No Blocking)

- **what_ships relabel** (loader line 133): One-line change, not gated on intake design. Can land anytime.
- **Two zero-Artifact collapsed Artifacts**: First content intake should create; ready anytime operator provides doneWhen.

---

## Next Steps

1. Implement `deliverableSlot.ts` with gate sequence
2. Implement `buildDeliverableDeclarePayload`
3. Implement `declareDeliverable` reducer function
4. Test with the two zero-Artifact Deliverables (first exercise of creation path)
5. Pending: Operator doneWhen text for both collapsed Artifacts
6. Pending: Initiative properties adjudication (boundary_type, completion_value, ongoing_output declare-or-retire)
