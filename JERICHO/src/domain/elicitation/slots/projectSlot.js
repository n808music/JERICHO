import { REPROBES } from '../reprobes.js';
import { isHoldableNoun } from '../../planQuality/isHoldableNoun';
import { isQuantifiableMetric } from '../../planQuality/isQuantifiableMetric';
import { classifyPhase } from '../../masterGrid/phaseClassification.js';

// Section 5 (Projects) slot contract.
// Required declaration fields: id, name, owningEntityId, successMetric, verificationSourceId, phase, requiresLegalFormation.
// Field order matches gate order — first failure wins gives a natural probe sequence.

export const PROJECT_SLOT_ID = 'slot:project';

export const PROJECT_SLOT = {
  slotId: PROJECT_SLOT_ID,
  section: 5,
  matrixBinding: {
    action: 'DECLARE_PROJECT',
    fields: ['name', 'owningEntityId', 'successMetric', 'verificationSourceId', 'phase', 'requiresLegalFormation'],
  },
  dependsOn: [],
  // Field-by-field gate ladder. Each entry is a pure detector over the
  // captured field bag. The code maps directly to a REPROBES entry.
  gate: [
    {
      code: 'PROJECT_NAME_MISSING',
      fieldName: 'name',
      detect: (captured) => !captured?.name,
    },
    {
      code: 'PROJECT_NAME_NOT_HOLDABLE',
      fieldName: 'name',
      detect: (captured) => Boolean(captured?.name) && !isHoldableNoun(String(captured.name)),
    },
    {
      code: 'PROJECT_OWNER_MISSING',
      fieldName: 'owningEntityId',
      detect: (captured) => !captured?.owningEntityId,
      // Cross-section pick: reads matrix.entitiesById from the current snapshot.
      pickSet: 'declaredEntities',
    },
    {
      code: 'PROJECT_METRIC_MISSING',
      fieldName: 'successMetric',
      detect: (captured) => !captured?.successMetric,
    },
    {
      code: 'PROJECT_METRIC_UNQUANTIFIED',
      fieldName: 'successMetric',
      detect: (captured) =>
        Boolean(captured?.successMetric) && !isQuantifiableMetric(String(captured.successMetric)),
    },
    {
      code: 'PROJECT_SOURCE_MISSING',
      fieldName: 'verificationSource',
      // Detect via the resolved verificationSourceId — set after spawn.
      detect: (captured) => !captured?.verificationSourceId,
    },
    {
      // §5 raw-phase attestation (Wave 2, Gate 1). Fires when the operator hasn't yet stated
      // which stage toward the terminal this project sits in. Required at intake — a phase-
      // attested node is the point of the gate; absent phase only survives on non-intake paths
      // (existing/derived), where it drops to the residual bucket.
      code: 'PROJECT_PHASE_UNATTESTED',
      fieldName: 'phase',
      detect: (captured) => captured?.phase == null || String(captured.phase).trim() === '',
    },
    {
      // Present-but-invalid phase is rejected at ANSWER time through the SINGLE shared validator
      // (Gate 5's classifyPhase) — no second validation path. classifyPhase throws on anything
      // outside {1,2,3}; we translate that throw into a gate failure so the operator re-answers
      // while still in the conversation instead of the store persisting corruption until render.
      code: 'PROJECT_PHASE_NON_CANONICAL',
      fieldName: 'phase',
      detect: (captured) => {
        const raw = captured?.phase;
        if (raw == null || String(raw).trim() === '') return false; // absence handled above
        try {
          classifyPhase(raw, captured?.name);
          return false;
        } catch {
          return true;
        }
      },
    },
    // ── legal formation prerequisite ────────────────────────────────────
    {
      code: 'PROJECT_LEGAL_FORMATION_MISSING',
      fieldName: 'requiresLegalFormation',
      detect: (captured) => captured?.requiresLegalFormation === undefined || captured?.requiresLegalFormation === null,
      pickSet: 'yesNoOptions',
    },
  ],
};

// Map a gate failure code to the field the engine should ask about next.
export function fieldNameForCode(code) {
  const found = PROJECT_SLOT.gate.find((g) => g.code === code);
  return found?.fieldName || null;
}

// Build the DECLARE_PROJECT payload from captured fields.
export function buildProjectDeclarePayload(captured) {
  // Generate a deterministic id from the captured name. Two runs with the
  // same answer produce the same id, satisfying the determinism property.
  const idSlug = String(captured?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return {
    id: `project-${idSlug}`,
    name: captured.name,
    owningEntityId: captured.owningEntityId,
    successMetric: captured.successMetric,
    verificationSourceId: captured.verificationSourceId,
    // classifyPhase returns the canonical number (the gate guaranteed 1/2/3 or absent);
    // never a second validator, always the shared one.
    phase: classifyPhase(captured.phase, captured.name),
    requiresLegalFormation: captured.requiresLegalFormation !== undefined ? Boolean(captured.requiresLegalFormation) : false,
  };
}
