import { mapLaneToEntity, DEPRECATED_LANE_LABELS } from './laneToEntity';
import {
  classifyProvenance,
} from './provenanceClassification';
import type { IntakeSignals, ProvenanceStatus } from './provenanceClassification';
import type { EnterprisePhaseScope } from './enterpriseIdentityMap';

export type EnterprisePriorityStatus =
  | 'active'
  | 'incubating'
  | 'deferred'
  | 'gated'
  | 'blocked';

export interface EnterpriseDisplayProjection {
  displayName: string;
  displaySubtitle: string;
  internalLane: string;
  companyCategory: string;
  products: string[];
  typeLabel: string;
  phaseScope: EnterprisePhaseScope;
  priorityStatus: EnterprisePriorityStatus;
  provenanceStatus: ProvenanceStatus;
  sourceEvidence: string[];
  warnings: string[];
}

export interface EnterpriseDisplayProjectionInput {
  laneId: string;
  laneLabel: string;
  intakeSignals: IntakeSignals;
}

const PRIORITY_BY_SCOPE: Record<EnterprisePhaseScope, EnterprisePriorityStatus> = {
  P1: 'active',
  'P1-P3': 'active',
  P2: 'incubating',
  P3: 'incubating',
  'P2-P3': 'deferred',
};

const REAL_ESTATE_WARNING =
  'Real Estate is not P1-critical unless prerequisite proof, capital, legal, runway, or dependency constraints justify it.';
const F8_PRONUNCIATION_NOTE =
  'F8 Energy Co. (pronounced like "fate"). Energy Gym belongs under F8 Energy Co., not E8 Energy Co.';
const UNSUPPORTED_WARNING =
  'No canonical enterprise entity matched this lane; treat as system-only until intake supports it.';

export function projectEnterpriseDisplay(
  input: EnterpriseDisplayProjectionInput,
): EnterpriseDisplayProjection {
  const { laneId, laneLabel, intakeSignals } = input;
  const entity = mapLaneToEntity(laneId);
  const isDeprecatedLabel = DEPRECATED_LANE_LABELS.includes(
    String(laneId || '').toLowerCase().trim(),
  );

  if (!entity) {
    const classification = classifyProvenance({
      laneId,
      laneLabel,
      hasMapEntry: false,
      intakeSignals,
    });
    return {
      displayName: laneLabel || laneId || 'Unknown',
      displaySubtitle: '',
      internalLane: laneId,
      companyCategory: '',
      products: [],
      typeLabel: '',
      phaseScope: 'P2-P3',
      priorityStatus: 'deferred',
      provenanceStatus: classification.status,
      sourceEvidence: classification.sourceEvidence,
      warnings: [UNSUPPORTED_WARNING],
    };
  }

  const classification = classifyProvenance({
    laneId,
    laneLabel,
    normalizedDisplayName: isDeprecatedLabel ? entity.displayName : undefined,
    isDeprecatedLabel: false,
    hasMapEntry: true,
    intakeSignals,
  });

  const warnings: string[] = [];
  if (entity.companyCategory === 'Real Estate') {
    warnings.push(REAL_ESTATE_WARNING);
  }
  if (entity.companyCategory === 'Energy Gym') {
    warnings.push(F8_PRONUNCIATION_NOTE);
  }

  const priorityStatus: EnterprisePriorityStatus =
    classification.status === 'system_placeholder' ||
    classification.status === 'deprecated'
      ? 'deferred'
      : PRIORITY_BY_SCOPE[entity.phaseScope];

  const subtitle = entity.products.length > 0
    ? entity.products.slice(0, 3).join(' / ')
    : entity.typeLabel;

  return {
    displayName: entity.displayName,
    displaySubtitle: subtitle,
    internalLane: laneId,
    companyCategory: entity.companyCategory,
    products: [...entity.products],
    typeLabel: entity.typeLabel,
    phaseScope: entity.phaseScope,
    priorityStatus,
    provenanceStatus: classification.status,
    sourceEvidence: classification.sourceEvidence,
    warnings,
  };
}
