import { isHoldableNoun } from '../planQuality/isHoldableNoun';
import { hasAuthoredSubstance } from '../planQuality/hasAuthoredSubstance';
import { isExternallyVerifiable } from '../planQuality/isExternallyVerifiable';

export const ARTIFACT_SLOT_ID = 'slot:artifact';

export const ARTIFACT_SLOT = {
  slotId: ARTIFACT_SLOT_ID,
  section: 6,
  matrixBinding: {
    action: 'DECLARE_ARTIFACT',
    fields: [
      'name',
      'parentDeliverableIds',
      'producedByEntityId',
      'completionEvidence',
      'verificationSourceId',
      'operatorAttestationMethod',
      // Step 3: Artifact intake fields
      'satisfaction_mode',
      'targetDate',
      'buffer_anchor',
      'buffer_binding',
    ],
  },
  dependsOn: [],
  gate: [
    {
      code: 'ARTIFACT_NAME_MISSING',
      fieldName: 'name',
      detect: (captured: Record<string, unknown>) => !captured?.name,
    },
    {
      code: 'ARTIFACT_NAME_NOT_HOLDABLE',
      fieldName: 'name',
      detect: (captured: Record<string, unknown>) =>
        Boolean(captured?.name) && !isHoldableNoun(String(captured.name)),
    },
    {
      code: 'ARTIFACT_SLUG_EMPTY',
      fieldName: 'name',
      detect: (captured: Record<string, unknown>) => {
        const name = String(captured?.name || '').trim();
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 64);
        return slug === '';
      },
    },
    {
      code: 'ARTIFACT_PRODUCING_PROJECT_UNRESOLVED',
      fieldName: 'producingProjectId',
      pickSet: 'producingProjectOptions',
      detect: (captured: Record<string, unknown>) => !captured?.producingProjectId,
    },
    {
      code: 'ARTIFACT_COMPLETION_EVIDENCE_MISSING',
      fieldName: 'completionEvidence',
      detect: (captured: Record<string, unknown>) => !captured?.completionEvidence,
    },
    {
      code: 'ARTIFACT_COMPLETION_EVIDENCE_NOT_VERIFIABLE',
      fieldName: 'completionEvidence',
      detect: (captured: Record<string, unknown>) =>
        Boolean(captured?.completionEvidence) &&
        !isExternallyVerifiable(String(captured.completionEvidence)),
    },
    {
      code: 'ARTIFACT_VERIFICATION_SOURCE_UNRESOLVED',
      fieldName: 'verificationSourceId',
      pickSet: 'declaredSources',
      detect: (captured: Record<string, unknown>) => !captured?.verificationSourceId,
    },
    {
      code: 'ARTIFACT_ATTESTATION_METHOD_MISSING',
      fieldName: 'operatorAttestationMethod',
      detect: (captured: Record<string, unknown>) => !captured?.operatorAttestationMethod,
    },
    {
      code: 'ARTIFACT_ATTESTATION_METHOD_NOT_SUBSTANTIVE',
      fieldName: 'operatorAttestationMethod',
      detect: (captured: Record<string, unknown>) =>
        Boolean(captured?.operatorAttestationMethod) &&
        !hasAuthoredSubstance(String(captured.operatorAttestationMethod)),
    },
    // ── Step 3: Artifact intake fields ──────────────────────────────
    {
      code: 'ARTIFACT_SATISFACTION_MODE_MISSING',
      fieldName: 'satisfaction_mode',
      detect: (captured: Record<string, unknown>) => !captured?.satisfaction_mode,
      pickSet: 'artifactSatisfactionModeOptions',
    },
    {
      code: 'ARTIFACT_TARGET_DATE_MISSING',
      fieldName: 'targetDate',
      detect: (captured: Record<string, unknown>) => !captured?.targetDate,
    },
    {
      code: 'ARTIFACT_TARGET_DATE_NOT_FUTURE',
      fieldName: 'targetDate',
      detect: (captured: Record<string, unknown>) => {
        if (!captured?.targetDate) return false;
        const date = new Date(String(captured.targetDate));
        return isNaN(date.getTime()) || date <= new Date();
      },
    },
    {
      code: 'ARTIFACT_BUFFER_BINDING_MISMATCH',
      fieldName: 'buffer_anchor',
      detect: (captured: Record<string, unknown>) => {
        const bufferAnchor = String(captured?.buffer_anchor || '').trim();
        const bufferBinding = String(captured?.buffer_binding || '').trim();
        const hasAnchor = Boolean(bufferAnchor);
        const hasBinding = Boolean(bufferBinding);
        // Both must be present or both absent
        return hasAnchor !== hasBinding;
      },
    },
    // Item 6: Buffer anchor resolution — must resolve to a declared node when mode requires buffer
    {
      code: 'ARTIFACT_BUFFER_ANCHOR_UNKNOWN',
      fieldName: 'buffer_anchor',
      detect: (captured: Record<string, unknown>) =>
        captured?.satisfaction_mode === 'buffer_anchored' &&
        !captured?.buffer_anchor,
      pickSet: 'allDeclaredNodeOptions',
    },
  ] as const,
};

export function buildArtifactDeclarePayload(captured: Record<string, unknown>) {
  const name = String(captured?.name || '').trim();
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  const consumingProjectIds = Array.isArray(captured?.consumingProjectIds)
    ? (captured.consumingProjectIds as unknown[])
        .map((cid) => String(cid || '').trim())
        .filter(Boolean)
    : [];
  return {
    id,
    name,
    producingProjectId: String(captured?.producingProjectId || '').trim(),
    parentDeliverableIds: Array.isArray(captured?.parentDeliverableIds)
      ? (captured.parentDeliverableIds as unknown[]).map((id) => String(id || '').trim()).filter(Boolean)
      : [],
    consumingProjectIds,
    completionEvidence: String(captured?.completionEvidence || '').trim(),
    verificationSourceId: String(captured?.verificationSourceId || '').trim(),
    operatorAttestationMethod: String(captured?.operatorAttestationMethod || '').trim(),
    notes: String(captured?.notes || '').trim() || null,
    // Step 3: Artifact intake fields
    satisfaction_mode: String(captured?.satisfaction_mode || '').trim(),
    targetDate: String(captured?.targetDate || '').trim(),
    buffer_anchor: String(captured?.buffer_anchor || '').trim() || null,
    buffer_binding: String(captured?.buffer_binding || '').trim() || null,
  };
}
