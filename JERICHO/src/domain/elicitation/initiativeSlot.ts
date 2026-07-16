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
//   3. Goal-relative classification — objective | constraint. Stored as a field;
//      POPULATED by the goal-relative ask (ask-don't-infer). Required-present.

export const INITIATIVE_SLOT_ID = 'slot:initiative';

// Sentinel chosen from the owner pickSet to declare an initiative entity-less.
export const INITIATIVE_OWNER_ENTITY_LESS = '__entity_less__';

export const INITIATIVE_CLASSIFICATIONS = ['objective', 'constraint'] as const;

export const INITIATIVE_SLOT = {
  slotId: INITIATIVE_SLOT_ID,
  section: 3,
  matrixBinding: {
    action: 'DECLARE_INITIATIVE',
    fields: ['name', 'owningEntityId', 'purpose', 'classification', 'doneWhen'],
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
    // ── purpose ─────────────────────────────────────────────────────────
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
    // ── classification: objective | constraint (goal-relative ask) ──────
    {
      code: 'INITIATIVE_CLASSIFICATION_MISSING',
      fieldName: 'classification',
      detect: (captured) => !captured?.classification,
      pickSet: 'classificationOptions',
    },
    {
      code: 'INITIATIVE_CLASSIFICATION_INVALID',
      fieldName: 'classification',
      detect: (captured) =>
        Boolean(captured?.classification) &&
        !(INITIATIVE_CLASSIFICATIONS as readonly string[]).includes(
          String(captured.classification).trim().toLowerCase(),
        ),
      pickSet: 'classificationOptions',
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
  return {
    id: `initiative-${idSlug}`,
    name: captured.name,
    // First owner kept in the legacy scalar field for downstream consumers.
    owningEntityId: owningEntityIds[0] || null,
    owningEntityIds,
    crossCutting,
    purpose: captured.purpose,
    classification: String(captured.classification).trim().toLowerCase(),
    doneWhen: captured.doneWhen,
  };
}
