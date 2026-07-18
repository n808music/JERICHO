import { isHoldableNoun } from '../planQuality/isHoldableNoun';
import { hasAuthoredSubstance } from '../planQuality/hasAuthoredSubstance';
import { isExternallyVerifiable } from '../planQuality/isExternallyVerifiable';
import { ENTITY_ROLE_TAGS, ROLE_TAG_DISPLAY_LABELS, isValidRoleTag } from '../enterprise/entityRoleTags';
import { FORMATION_STATES, isValidFormationState } from '../enterprise/entityFormationStates';

// Section 2 (Entities / Nodes) slot contract.
//
// Filling an entity slot is OPTIONAL (the user is never forced to declare a
// company). But IF filled, the identity fields are required — only doneWhen
// stays optional. This is the entity-tier exception; every tier BELOW entity
// requires all fields.
//
// Required:  name, roleTags, purpose, formationState, statusEvidence
// Optional:  doneWhen  (no presence gate; validity-gated only when present)
//
// "Current status" is decomposed into a closed-set pick (formationState) plus a
// substance-gated evidence field (statusEvidence) — together they form a real
// state report, which is what intake exists to capture.
//
// Mirrors PROJECT_SLOT shape so firstFailingGate / probeFor run unchanged.

export const ENTITY_SLOT_ID = 'slot:entity';

export const ENTITY_SLOT = {
  slotId: ENTITY_SLOT_ID,
  section: 2,
  matrixBinding: {
    action: 'DECLARE_ENTITY',
    fields: ['name', 'roleTags', 'purpose', 'formationState', 'statusEvidence', 'doneWhen'],
  },
  dependsOn: [],
  // First-failure-wins gate ladder. Field order = probe order.
  gate: [
    // ── name ────────────────────────────────────────────────────────────
    {
      code: 'ENTITY_NAME_MISSING',
      fieldName: 'name',
      detect: (captured) => !captured?.name,
    },
    {
      code: 'ENTITY_NAME_NOT_HOLDABLE',
      fieldName: 'name',
      // NOTE: entity names are proper nouns ("Global State Systems", "F8
      // Energy Co."). Verify isHoldableNoun passes these at test time; if a
      // valid proper-noun name false-fails, this gate needs a proper-noun
      // allowance rather than the bare holdable check.
      detect: (captured) =>
        Boolean(captured?.name) && !isHoldableNoun(String(captured.name)),
    },
    // ── roleTags ────────────────────────────────────────────────────────
    {
      code: 'ENTITY_ROLETAGS_MISSING',
      fieldName: 'roleTags',
      detect: (captured) =>
        !Array.isArray(captured?.roleTags) || captured.roleTags.length === 0,
      pickSet: 'roleTagOptions',
    },
    {
      code: 'ENTITY_ROLETAGS_INVALID',
      fieldName: 'roleTags',
      detect: (captured) =>
        Array.isArray(captured?.roleTags) &&
        captured.roleTags.length > 0 &&
        captured.roleTags.some((t) => !isValidRoleTag(String(t))),
      pickSet: 'roleTagOptions',
    },
    // ── purpose ─────────────────────────────────────────────────────────
    {
      code: 'ENTITY_PURPOSE_MISSING',
      fieldName: 'purpose',
      detect: (captured) => !captured?.purpose,
    },
    {
      code: 'ENTITY_PURPOSE_NOT_SUBSTANTIVE',
      fieldName: 'purpose',
      detect: (captured) =>
        Boolean(captured?.purpose) && !hasAuthoredSubstance(String(captured.purpose)),
    },
    // ── current status: formationState (pick) + statusEvidence (substance) ─
    {
      code: 'ENTITY_FORMATION_STATE_MISSING',
      fieldName: 'formationState',
      detect: (captured) => !captured?.formationState,
      pickSet: 'formationStateOptions',
    },
    {
      code: 'ENTITY_FORMATION_STATE_INVALID',
      fieldName: 'formationState',
      detect: (captured) =>
        Boolean(captured?.formationState) &&
        !isValidFormationState(String(captured.formationState)),
      pickSet: 'formationStateOptions',
    },
    {
      code: 'ENTITY_STATUS_EVIDENCE_MISSING',
      fieldName: 'statusEvidence',
      detect: (captured) => !captured?.statusEvidence,
    },
    {
      code: 'ENTITY_STATUS_EVIDENCE_NOT_SUBSTANTIVE',
      fieldName: 'statusEvidence',
      detect: (captured) =>
        Boolean(captured?.statusEvidence) &&
        !hasAuthoredSubstance(String(captured.statusEvidence)),
    },
    // ── doneWhen: OPTIONAL — no presence gate; validity only when present ─
    {
      code: 'ENTITY_DONEWHEN_NOT_VERIFIABLE',
      fieldName: 'doneWhen',
      detect: (captured) =>
        Boolean(captured?.doneWhen) && !isExternallyVerifiable(String(captured.doneWhen)),
    },
  ],
};

export function fieldNameForCode(code) {
  const found = ENTITY_SLOT.gate.find((g) => g.code === code);
  return found?.fieldName || null;
}

export function buildEntityDeclarePayload(captured) {
  const idSlug = String(captured?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const payload = {
    id: `entity-${idSlug}`,
    name: captured.name,
    roleTags: captured.roleTags,
    purpose: captured.purpose,
    formationState: captured.formationState,
    statusEvidence: captured.statusEvidence,
  };
  // doneWhen is optional — include only when authored.
  if (captured?.doneWhen) payload.doneWhen = captured.doneWhen;
  return payload;
}

export { ENTITY_ROLE_TAGS, ROLE_TAG_DISPLAY_LABELS, FORMATION_STATES };
