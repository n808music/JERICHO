import { isHoldableNoun } from '../planQuality/isHoldableNoun';
import { hasAuthoredSubstance } from '../planQuality/hasAuthoredSubstance';

// Section 4 (Systems / Recurring Engines) slot contract.
//
// A system is a RECURRING ENGINE — an operating loop that serves entities,
// initiatives, or projects but outlives them. Systems carry four intake fields:
// name, owner (entity or 'Cross-cutting'), mechanism (the operating loop prose),
// and feeds_converges_into (downstream feed list).
//
// No phase, boundary_type, or description field — mechanism IS the description.
// One owning entity per system (no multi-owner variation like Deliverable).

export const SYSTEM_SLOT_ID = 'slot:system';

// Entity-less sentinel. A system marked cross-cutting serves the whole
// operation rather than one entity; declareSystem matches this literal
// exactly and stores owningEntityId: null. The value is load-bearing —
// reference_matrix_v3_0.json carries `"owner": "Cross-cutting"` verbatim.
export const SYSTEM_OWNER_ENTITY_LESS = 'Cross-cutting';

export const SYSTEM_SLOT = {
  slotId: SYSTEM_SLOT_ID,
  section: 4,
  matrixBinding: {
    action: 'DECLARE_SYSTEM',
    fields: ['name', 'owner', 'mechanism', 'feeds_converges_into'],
  },
  dependsOn: [],
  gate: [
    // ── name: required, non-empty, unique within Systems ──────────────────
    {
      code: 'SYSTEM_NAME_MISSING',
      fieldName: 'name',
      detect: (captured: Record<string, unknown>) => !captured?.name,
    },
    {
      code: 'SYSTEM_NAME_NOT_HOLDABLE',
      fieldName: 'name',
      detect: (captured: Record<string, unknown>) =>
        Boolean(captured?.name) && !isHoldableNoun(String(captured.name)),
    },
    // ── owner: required, entity OR 'Cross-cutting' literal ────────────────
    // Cross-cutting means no individual entity owns it; it is infrastructure.
    // Gate passes both paths: entity-resolution happens in the reducer.
    {
      code: 'SYSTEM_OWNER_MISSING',
      fieldName: 'owner',
      detect: (captured: Record<string, unknown>) => !captured?.owner,
      pickSet: 'systemOwnerOptions',
    },
    // ── mechanism: required, non-empty, the operating loop description ─────
    {
      code: 'SYSTEM_MECHANISM_MISSING',
      fieldName: 'mechanism',
      detect: (captured: Record<string, unknown>) => !captured?.mechanism,
    },
    {
      code: 'SYSTEM_MECHANISM_NOT_SUBSTANTIVE',
      fieldName: 'mechanism',
      detect: (captured: Record<string, unknown>) =>
        Boolean(captured?.mechanism) && !hasAuthoredSubstance(String(captured.mechanism)),
    },
    // ── feeds_converges_into: required, non-empty, downstream feed list ────
    // Delimiter: semicolon (normalized in reducer). Multiple feeds separated
    // by '; ' in the fixture, stored as-is after normalization.
    {
      code: 'SYSTEM_FEEDS_MISSING',
      fieldName: 'feeds_converges_into',
      detect: (captured: Record<string, unknown>) => !captured?.feeds_converges_into,
    },
    {
      code: 'SYSTEM_FEEDS_NOT_SUBSTANTIVE',
      fieldName: 'feeds_converges_into',
      detect: (captured: Record<string, unknown>) =>
        Boolean(captured?.feeds_converges_into) &&
        !hasAuthoredSubstance(String(captured.feeds_converges_into)),
    },
  ] as const,
};

export function buildSystemDeclarePayload(captured: Record<string, unknown>) {
  const idSlug = String(captured?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return {
    id: `system-${idSlug}`,
    name: String(captured?.name || '').trim(),
    owner: String(captured?.owner || '').trim(),
    mechanism: String(captured?.mechanism || '').trim(),
    feeds_converges_into: String(captured?.feeds_converges_into || '')
      .trim()
      .split(/\s*[;,]\s*/) // split on ; or , with optional whitespace
      .filter(Boolean)
      .join('; '), // normalize to semicolon delimiter
  };
}
