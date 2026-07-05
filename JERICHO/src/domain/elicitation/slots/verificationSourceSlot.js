import { isHoldableNoun } from '../../planQuality/isHoldableNoun';

// Section 1A (Verification Sources) slot — PROMOTED to first-class.
//
// Was: spawned-only (a project naming an undeclared source pushed this slot,
// asked one question — domain — and popped). The `source` field was captured
// but ungated; only `domain` had a gate. That left 1A half-gated.
//
// Now: (1) `source` is gated — presence + holdable-name check (isHoldableNoun,
// the same substance check used for entity/project names; source is a NAME
// field, not prose, so this is the correct predicate and inherits the verified
// proper-noun safety). (2) The slot is registered as a first-class declarable
// slot in the engine, so verification sources can be declared directly during
// intake — not only as a project side-effect. This is what lets done-whens at
// any tier (entity, initiative) reference a declared source via the
// source-aware isExternallyVerifiable predicate, instead of sources only
// existing after projects spawn them.
//
// Gate order (first-failure-wins = probe order): source name first (what tool
// do you open?), then domain (what does it measure?).

export const VERIFICATION_SOURCE_SLOT_ID = 'slot:verificationSource';

export const VERIFICATION_SOURCE_SLOT = {
  slotId: VERIFICATION_SOURCE_SLOT_ID,
  section: '1A',
  matrixBinding: {
    action: 'DECLARE_VERIFICATION_SOURCE',
    fields: ['id', 'source', 'domain'],
  },
  dependsOn: [],
  gate: [
    // ── source (the tool/screen you open to check) ──────────────────────
    {
      code: 'VERIFICATION_SOURCE_SOURCE_MISSING',
      fieldName: 'source',
      detect: (captured) => !captured?.source,
    },
    {
      code: 'VERIFICATION_SOURCE_SOURCE_NOT_HOLDABLE',
      fieldName: 'source',
      // Name-field substance check: a source must be a holdable thing (a tool,
      // app, screen, record), not an action. Mirrors entity/project name gates.
      detect: (captured) =>
        Boolean(captured?.source) && !isHoldableNoun(String(captured.source)),
    },
    // ── domain (what kind of measurement it reports) — presence only ────
    {
      code: 'VERIFICATION_SOURCE_DOMAIN_MISSING',
      fieldName: 'domain',
      detect: (captured) => !captured?.domain,
    },
  ],
};

export function fieldNameForCode(code) {
  const found = VERIFICATION_SOURCE_SLOT.gate.find((g) => g.code === code);
  return found?.fieldName || null;
}

export function buildVerificationSourceDeclarePayload(captured) {
  const idSlug = String(captured?.source || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return {
    id: `src-${idSlug}`,
    source: captured.source,
    domain: captured.domain,
  };
}
