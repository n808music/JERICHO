import { isHoldableNoun } from '../planQuality/isHoldableNoun';
import { hasAuthoredSubstance } from '../planQuality/hasAuthoredSubstance';
import { isExternallyVerifiable } from '../planQuality/isExternallyVerifiable';

export const ARTIFACT_SLOT_ID = 'slot:artifact';

export const ARTIFACT_SLOT = {
  slotId: ARTIFACT_SLOT_ID,
  section: 6,
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
  ] as const,
};

export function buildArtifactDeclarePayload(captured: Record<string, unknown>) {
  const name = String(captured?.name || '').trim();
  const id =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || `artifact-${Date.now()}`;
  const consumingProjectIds = Array.isArray(captured?.consumingProjectIds)
    ? (captured.consumingProjectIds as unknown[])
        .map((cid) => String(cid || '').trim())
        .filter(Boolean)
    : [];
  return {
    id,
    name,
    producingProjectId: String(captured?.producingProjectId || '').trim(),
    consumingProjectIds,
    completionEvidence: String(captured?.completionEvidence || '').trim(),
    verificationSourceId: String(captured?.verificationSourceId || '').trim(),
    operatorAttestationMethod: String(captured?.operatorAttestationMethod || '').trim(),
    notes: String(captured?.notes || '').trim() || null,
  };
}
