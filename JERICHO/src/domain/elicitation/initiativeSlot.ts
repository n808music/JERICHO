import { isHoldableNoun } from '../planQuality/isHoldableNoun';
import { hasAuthoredSubstance } from '../planQuality/hasAuthoredSubstance';
import { isExternallyVerifiable } from '../planQuality/isExternallyVerifiable';

// Section 3 (Initiatives / Missions) slot contract.
//
// An initiative is a BOUNDED UNDERTAKING — a mission with a beginning, an end,
// and a completion condition — owned BY an entity (or explicitly entity-less,
// e.g. business funding). Distinct from an entity (a standing structure). The
// role-tag [initiative] on an entity means "can own initiatives"; the actual
// initiatives are records here.
//
// This is the first slot BELOW the entity tier, so the lower-tier rule applies:
// ALL fields required — there is NO optional-field exception. In particular,
// doneWhen is MANDATORY here (presence + validity), unlike the entity tier
// where it was optional.
//
// Three mechanics new to this slot:
//   1. Nullable-but-RESOLVED owner — the user must either name an owner OR
//      explicitly choose entity-less. Blank is unresolved (ambiguous) and fails.
//      Expressed via the OWNER_ENTITY_LESS sentinel; the payload normalizes it
//      to owningEntityId: null.
//   2. Role-tag owner filter — the owner pickSet 'initiativeOwnerOptions' is
//      entitiesById filtered to [initiative]-capable entities (+ the entity-less
//      option). The filter lives in pickSet resolution, not a detect — the user
//      structurally cannot pick a non-[initiative] entity. First consumption of
//      the role-tags captured by the entity slot.

export const INITIATIVE_SLOT_ID = 'slot:initiative';

// Sentinel chosen from the owner pickSet to declare an initiative entity-less.
export const INITIATIVE_OWNER_ENTITY_LESS = '__entity_less__';

// Initiative role-tags: system (ongoing) or project (bounded). Multi-select;
// initiatives can be both (e.g., Jericho ships as a product AND becomes an
// operational system). Determines which Purpose question variant fires.
export const INITIATIVE_ROLE_TAGS = ['system', 'project'] as const;

export const INITIATIVE_SLOT = {
  slotId: INITIATIVE_SLOT_ID,
  section: 3,
  matrixBinding: {
    action: 'DECLARE_INITIATIVE',
    fields: [
      'name',
      'owningEntityId',
      'roleTags',
      'purpose',
      'purposeFor',
      'purposeCompletion',
      'purposeOngoing',
      'doneWhen',
    ],
  },
  dependsOn: [],
  gate: [
    // ── name ────────────────────────────────────────────────────────────
    {
      code: 'INITIATIVE_NAME_MISSING',
      fieldName: 'name',
      detect: (captured) => !captured?.name,
    },
    {
      code: 'INITIATIVE_NAME_NOT_HOLDABLE',
      fieldName: 'name',
      detect: (captured) =>
        Boolean(captured?.name) && !isHoldableNoun(String(captured.name)),
    },
    // ── owner: resolved = named OR explicitly entity-less ───────────────
    // Sentinel counts as "set", so presence detect passes once the user has
    // EITHER named an owner OR chosen entity-less. Blank stays unresolved.
    // The role-tag [initiative] filter lives in the pickSet, not here.
    {
      code: 'INITIATIVE_OWNER_UNRESOLVED',
      fieldName: 'owningEntityId',
      // Accepts a single id (legacy), an array of ids (multi-owner), or the
      // cross-cutting sentinel — alone or alongside entities. Empty/blank is
      // the only unresolved state.
      detect: (captured) =>
        !captured?.owningEntityId ||
        (Array.isArray(captured.owningEntityId) && captured.owningEntityId.length === 0),
      pickSet: 'initiativeOwnerOptions',
    },
    // ── roleTags: multi-select system | project (or both) ─────────────────
    // Multi-select (array): at least one must be chosen. Determines which
    // Purpose question variant fires (system produces ongoing output; project
    // accomplishes a completion goal).
    {
      code: 'INITIATIVE_ROLETAGS_MISSING',
      fieldName: 'roleTags',
      detect: (captured) =>
        !captured?.roleTags ||
        (Array.isArray(captured.roleTags) && captured.roleTags.length === 0),
      pickSet: 'initiativeRoleTagOptions',
    },
    {
      code: 'INITIATIVE_ROLETAGS_INVALID',
      fieldName: 'roleTags',
      detect: (captured) =>
        Boolean(captured?.roleTags) &&
        Array.isArray(captured.roleTags) &&
        !captured.roleTags.every((tag) =>
          (INITIATIVE_ROLE_TAGS as readonly string[]).includes(
            String(tag).trim().toLowerCase(),
          ),
        ),
      pickSet: 'initiativeRoleTagOptions',
    },
    // ── purpose: split into three conditional probes ─────────────────────
    // All initiatives answer: "What does it do?" (INITIATIVE_PURPOSE_MISSING)
    // and "What is it for?" (INITIATIVE_PURPOSE_FOR_MISSING).
    // Additional probes depend on roleTags:
    //   - "project" in roleTags → INITIATIVE_PURPOSE_COMPLETION_MISSING
    //   - "system" in roleTags → INITIATIVE_PURPOSE_ONGOING_MISSING
    // Both may fire if initiative is dual-tagged (non-redundant answers).
    {
      code: 'INITIATIVE_PURPOSE_MISSING',
      fieldName: 'purpose',
      detect: (captured) => !captured?.purpose,
    },
    {
      code: 'INITIATIVE_PURPOSE_NOT_SUBSTANTIVE',
      fieldName: 'purpose',
      detect: (captured) =>
        Boolean(captured?.purpose) && !hasAuthoredSubstance(String(captured.purpose)),
    },
    // "What is it for?" — orthogonal to mechanism, asked of all initiatives
    {
      code: 'INITIATIVE_PURPOSE_FOR_MISSING',
      fieldName: 'purposeFor',
      detect: (captured) => !captured?.purposeFor,
    },
    {
      code: 'INITIATIVE_PURPOSE_FOR_NOT_SUBSTANTIVE',
      fieldName: 'purposeFor',
      detect: (captured) =>
        Boolean(captured?.purposeFor) && !hasAuthoredSubstance(String(captured.purposeFor)),
    },
    // Conditional: "What does completing it accomplish?" (project-type initiatives)
    {
      code: 'INITIATIVE_PURPOSE_COMPLETION_MISSING',
      fieldName: 'purposeCompletion',
      detect: (captured) => {
        const roleTags = captured?.roleTags || [];
        const isProject = Array.isArray(roleTags) && roleTags.some((t) =>
          String(t).trim().toLowerCase() === 'project',
        );
        // Only fail this gate if the initiative is project-type and purposeCompletion is missing
        return isProject && !captured?.purposeCompletion;
      },
    },
    {
      code: 'INITIATIVE_PURPOSE_COMPLETION_NOT_SUBSTANTIVE',
      fieldName: 'purposeCompletion',
      detect: (captured) => {
        const roleTags = captured?.roleTags || [];
        const isProject = Array.isArray(roleTags) && roleTags.some((t) =>
          String(t).trim().toLowerCase() === 'project',
        );
        // Only fail if project-type and purposeCompletion exists but is not substantive
        return (
          isProject &&
          Boolean(captured?.purposeCompletion) &&
          !hasAuthoredSubstance(String(captured.purposeCompletion))
        );
      },
    },
    // Conditional: "What does this produce while running?" (system-type initiatives)
    {
      code: 'INITIATIVE_PURPOSE_ONGOING_MISSING',
      fieldName: 'purposeOngoing',
      detect: (captured) => {
        const roleTags = captured?.roleTags || [];
        const isSystem = Array.isArray(roleTags) && roleTags.some((t) =>
          String(t).trim().toLowerCase() === 'system',
        );
        // Only fail this gate if the initiative is system-type and purposeOngoing is missing
        return isSystem && !captured?.purposeOngoing;
      },
    },
    {
      code: 'INITIATIVE_PURPOSE_ONGOING_NOT_SUBSTANTIVE',
      fieldName: 'purposeOngoing',
      detect: (captured) => {
        const roleTags = captured?.roleTags || [];
        const isSystem = Array.isArray(roleTags) && roleTags.some((t) =>
          String(t).trim().toLowerCase() === 'system',
        );
        // Only fail if system-type and purposeOngoing exists but is not substantive
        return (
          isSystem &&
          Boolean(captured?.purposeOngoing) &&
          !hasAuthoredSubstance(String(captured.purposeOngoing))
        );
      },
    },
    // ── doneWhen: MANDATORY at this tier (presence + validity) ──────────
    {
      code: 'INITIATIVE_DONEWHEN_MISSING',
      fieldName: 'doneWhen',
      detect: (captured) => !captured?.doneWhen,
    },
    {
      code: 'INITIATIVE_DONEWHEN_NOT_VERIFIABLE',
      fieldName: 'doneWhen',
      // NOTE: called without declaredSources, so gate-time verification uses
      // the veto + world-state paths only (not source-name citation). Operation
      // Endgame done-whens carry world-states/numbers and pass. Full source-
      // aware checking needs the engine to inject declared sources into detect —
      // flagged as a future engine enhancement, not required for Endgame.
      detect: (captured) =>
        Boolean(captured?.doneWhen) && !isExternallyVerifiable(String(captured.doneWhen)),
    },
  ],
};

export function fieldNameForCode(code) {
  const found = INITIATIVE_SLOT.gate.find((g) => g.code === code);
  return found?.fieldName || null;
}

export function buildInitiativeDeclarePayload(captured) {
  const idSlug = String(captured?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // Owner normalization (2026-07-10): the answer may be a single id (legacy),
  // an array of ids (multi-owner), and may include the cross-cutting sentinel
  // ALONGSIDE entities — cross-cutting describes scope, it does not force
  // entity-less. Sentinel alone → no owners (true entity-less).
  const rawOwners = Array.isArray(captured.owningEntityId)
    ? captured.owningEntityId
    : [captured.owningEntityId];
  const crossCutting = rawOwners.includes(INITIATIVE_OWNER_ENTITY_LESS);
  const owningEntityIds = rawOwners.filter(
    (id) => id && id !== INITIATIVE_OWNER_ENTITY_LESS,
  );
  // Role-tags normalization: array input, normalized to lowercase.
  const roleTags = Array.isArray(captured.roleTags)
    ? captured.roleTags.map((tag) => String(tag).trim().toLowerCase())
    : [];

  return {
    id: `initiative-${idSlug}`,
    name: captured.name,
    // First owner kept in the legacy scalar field for downstream consumers.
    owningEntityId: owningEntityIds[0] || null,
    owningEntityIds,
    crossCutting,
    roleTags,
    purpose: captured.purpose,
    purposeFor: captured.purposeFor || null,
    purposeCompletion: captured.purposeCompletion || null,
    purposeOngoing: captured.purposeOngoing || null,
    doneWhen: captured.doneWhen,
  };
}
