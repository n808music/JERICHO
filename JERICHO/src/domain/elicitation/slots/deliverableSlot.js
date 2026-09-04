import { REPROBES } from '../reprobes.js';
import { isHoldableNoun } from '../../planQuality/isHoldableNoun';

// Deliverable intake slot contract (Section 6).
// Required declaration fields: id, name, parent_project, executing_entity, target_date, description, buffer_anchor, buffer_binding.
// Phase is never elicited — computed at read time from parent Project's terminal date.
// Description is optional (formerly what_ships).
// Buffers are paired: both buffer_anchor and buffer_binding present, or neither.
// Dependencies are edge-structured (not intake fields) — handled via edge builder.

export const DELIVERABLE_SLOT_ID = 'slot:deliverable';

export const DELIVERABLE_SLOT = {
  slotId: DELIVERABLE_SLOT_ID,
  section: 6,
  matrixBinding: {
    action: 'DECLARE_DELIVERABLE',
    fields: ['name', 'parent_project', 'executing_entity', 'target_date', 'description', 'buffer_anchor', 'buffer_binding'],
  },
  dependsOn: ['slot:project', 'slot:entity'],
  // Field-by-field gate ladder. Each entry is a pure detector over the
  // captured field bag. The code maps directly to a REPROBES entry.
  gate: [
    {
      code: 'DELIVERABLE_NAME_MISSING',
      fieldName: 'name',
      detect: (captured) => !captured?.name,
    },
    {
      code: 'DELIVERABLE_NAME_NOT_HOLDABLE',
      fieldName: 'name',
      detect: (captured) => Boolean(captured?.name) && !isHoldableNoun(String(captured.name)),
    },
    {
      code: 'DELIVERABLE_PROJECT_MISSING',
      fieldName: 'parent_project',
      detect: (captured) => !captured?.parent_project,
      // Cross-section pick: reads matrix.projectsById from the current snapshot.
      pickSet: 'declaredProjects',
    },
    {
      code: 'DELIVERABLE_EXECUTING_ENTITY_MISSING',
      fieldName: 'executing_entity',
      detect: (captured) => !captured?.executing_entity,
      // Cross-section pick: reads matrix.entitiesById from the current snapshot.
      pickSet: 'declaredEntities',
    },
    {
      code: 'DELIVERABLE_TARGET_DATE_MISSING',
      fieldName: 'target_date',
      detect: (captured) => !captured?.target_date,
    },
    {
      code: 'DELIVERABLE_TARGET_DATE_INVALID',
      fieldName: 'target_date',
      detect: (captured) => {
        if (!captured?.target_date) return false;
        const date = new Date(captured.target_date);
        return isNaN(date.getTime());
      },
    },
    {
      code: 'DELIVERABLE_BUFFER_PAIR_INCOMPLETE',
      fieldName: 'buffer_binding',
      detect: (captured) => {
        const hasAnchor = Boolean(captured?.buffer_anchor);
        const hasBinding = Boolean(captured?.buffer_binding);
        // Violation: anchor without binding, or binding without anchor
        return hasAnchor !== hasBinding;
      },
    },
  ],
};

// Map a gate failure code to the field the engine should ask about next.
export function fieldNameForCode(code) {
  const found = DELIVERABLE_SLOT.gate.find((g) => g.code === code);
  return found?.fieldName || null;
}

// Build the DECLARE_DELIVERABLE payload from captured fields.
// Returns all fields in the shape expected by the reducer's declareDeliverable function.
export function buildDeliverableDeclarePayload(captured) {
  // Generate a deterministic id from the captured name.
  const idSlug = String(captured?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return {
    id: `deliverable-${idSlug}`,
    name: captured.name,
    parent_project: captured.parent_project,
    executing_entity: captured.executing_entity,
    target_date: captured.target_date,
    // Description is optional; relabeled from what_ships.
    description: captured.description ?? null,
    // Buffers are paired (both or neither); use ?? null for silent defaults.
    buffer_anchor: captured.buffer_anchor ?? null,
    buffer_binding: captured.buffer_binding ?? null,
    // Phase: never elicited; computed at read time from parent Project.
    // depends_on: never intake fields; dependencies handled via edge builder.
  };
}
