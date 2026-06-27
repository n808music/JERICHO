// Section 1A (Verification Sources) slot.
// Spawned by the Project slot when the operator names a source that is not
// yet declared. The engine pushes a fresh VS slot onto its stack, asks the
// domain question, dispatches DECLARE_VERIFICATION_SOURCE, then pops back to
// the parent slot with the new source resolved.

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
    {
      code: 'VERIFICATION_SOURCE_DOMAIN_MISSING',
      fieldName: 'domain',
      detect: (captured) => !captured?.domain,
    },
  ],
};

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
