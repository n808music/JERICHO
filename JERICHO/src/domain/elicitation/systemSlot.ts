import { isHoldableNoun } from '../planQuality/isHoldableNoun';
import { hasAuthoredSubstance } from '../planQuality/hasAuthoredSubstance';

// Section 4 (Systems / Recurring Engines) slot contract.
//
// A system is a RECURRING ENGINE — a loop that never ends (the ↺). It can be
// put in place to serve an initiative's objective, a project's outcome, or an
// entity's scaling, and it can OUTLIVE all of them. So by design a system has
// NO doneWhen of its own — it may work TOWARD a done-when, but it is not
// bounded by one. Its status-of-existence is ACTIVATION (is it looping yet?),
// not completion.
//
// This refines the fractal status principle: not "done-when at every tier", but
// "the right status-of-existence at every tier" —
//   entity      → formationState  (how formed)
//   initiative  → doneWhen         (a completion)
//   system      → activationState  (is it operational and looping?)
//
// Below the entity tier, so all REQUIRED fields are mandatory. The one optional
// field is activationCondition (entity-tier-style: available, not mandatory) —
// most useful for a 'missing' system to surface what must be true before it runs.
//
// Reuses the initiative slot's two proven mechanics: nullable-resolved owner
// (entity-less sentinel) and the role-tag owner filter — here filtered on
// [system]-capable entities.

export const SYSTEM_SLOT_ID = 'slot:system';

// Sentinel chosen from the owner pickSet to declare a system entity-less.
export const SYSTEM_OWNER_ENTITY_LESS = '__entity_less__';

// Start-small closed set. Expand later if real systems need more rungs.
export const SYSTEM_ACTIVATION_STATES = ['running', 'missing', 'planned'] as const;

export const SYSTEM_SLOT = {
  slotId: SYSTEM_SLOT_ID,
  section: 4,
  matrixBinding: {
    action: 'DECLARE_SYSTEM',
    fields: ['name', 'owningEntityId', 'cycle', 'activationState', 'activationCondition'],
  },
  dependsOn: [],
  gate: [
    // ── name ────────────────────────────────────────────────────────────
    {
      code: 'SYSTEM_NAME_MISSING',
      fieldName: 'name',
      detect: (captured) => !captured?.name,
    },
    {
      code: 'SYSTEM_NAME_NOT_HOLDABLE',
      fieldName: 'name',
      detect: (captured) =>
        Boolean(captured?.name) && !isHoldableNoun(String(captured.name)),
    },
    // ── owner: resolved = named ([system]-filtered) OR entity-less ──────
    {
      code: 'SYSTEM_OWNER_UNRESOLVED',
      fieldName: 'owningEntityId',
      detect: (captured) => !captured?.owningEntityId,
      pickSet: 'systemOwnerOptions',
    },
    // ── cycle: the loop (prose, substance-gated) — replaces done-when ───
    {
      code: 'SYSTEM_CYCLE_MISSING',
      fieldName: 'cycle',
      detect: (captured) => !captured?.cycle,
    },
    {
      code: 'SYSTEM_CYCLE_NOT_SUBSTANTIVE',
      fieldName: 'cycle',
      detect: (captured) =>
        Boolean(captured?.cycle) && !hasAuthoredSubstance(String(captured.cycle)),
    },
    // ── activationState: recurring-tier status (closed set) ─────────────
    {
      code: 'SYSTEM_ACTIVATION_STATE_MISSING',
      fieldName: 'activationState',
      detect: (captured) => !captured?.activationState,
      pickSet: 'activationStateOptions',
    },
    {
      code: 'SYSTEM_ACTIVATION_STATE_INVALID',
      fieldName: 'activationState',
      detect: (captured) =>
        Boolean(captured?.activationState) &&
        !(SYSTEM_ACTIVATION_STATES as readonly string[]).includes(
          String(captured.activationState).trim().toLowerCase(),
        ),
      pickSet: 'activationStateOptions',
    },
    // ── activationCondition: OPTIONAL — validity only when present ───────
    // No presence gate (optional). If authored, must be substantive (it names
    // what must be true before the system runs — most useful for 'missing').
    {
      code: 'SYSTEM_ACTIVATION_CONDITION_NOT_SUBSTANTIVE',
      fieldName: 'activationCondition',
      detect: (captured) =>
        Boolean(captured?.activationCondition) &&
        !hasAuthoredSubstance(String(captured.activationCondition)),
    },
  ],
};

export function fieldNameForCode(code) {
  const found = SYSTEM_SLOT.gate.find((g) => g.code === code);
  return found?.fieldName || null;
}

export function buildSystemDeclarePayload(captured) {
  const idSlug = String(captured?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const owningEntityId =
    captured.owningEntityId === SYSTEM_OWNER_ENTITY_LESS ? null : captured.owningEntityId;
  const payload = {
    id: `system-${idSlug}`,
    name: captured.name,
    owningEntityId,
    cycle: captured.cycle,
    activationState: String(captured.activationState).trim().toLowerCase(),
  };
  // activationCondition is optional — include only when authored.
  if (captured?.activationCondition) payload.activationCondition = captured.activationCondition;
  return payload;
}
