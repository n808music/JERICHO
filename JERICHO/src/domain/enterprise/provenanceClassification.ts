export type ProvenanceStatus =
  | 'intake_declared'
  | 'intake_normalized'
  | 'system_inferred'
  | 'system_placeholder'
  | 'deprecated'
  | 'unsupported';

export interface IntakeSignals {
  /** The goal contract text the user submitted at intake. */
  goalText: string;
  /** Lane IDs the intake explicitly declared. */
  declaredLaneIds: string[];
}

export interface ProvenanceClassificationInput {
  laneId: string;
  laneLabel: string;
  /** When the display name differs from the raw lane label (e.g., civic → Global State Holdings). */
  normalizedDisplayName?: string | null;
  /** True when the raw lane label is on the deprecated list. */
  isDeprecatedLabel?: boolean;
  /** True when this entity exists in the canonical enterprise map. */
  hasMapEntry?: boolean;
  intakeSignals: IntakeSignals;
}

export interface ProvenanceClassification {
  status: ProvenanceStatus;
  sourceEvidence: string[];
}

const CONCEPT_KEYWORDS_BY_LANE: Record<string, RegExp[]> = {
  capital: [/capital/i, /funding/i, /runway/i],
  revenue: [/revenue/i, /income/i, /monetization/i],
  product: [/product/i, /software/i, /app/i],
  creative: [/creative/i, /album/i, /music/i, /artist/i],
  media: [/media/i, /podcast/i, /tv\b/i, /documentar/i],
  operations: [/operations/i, /ops\b/i, /operating system/i],
  civic: [/civic/i, /coalition/i],
  real_estate: [/real estate/i, /property/i, /corridor/i, /79th/i, /\bhq\b/i],
  institution: [/institution/i],
  education: [/private school/i, /education/i, /academy/i],
  energy_gym: [/energy gym/i, /f8/i],
};

export function classifyProvenance(
  input: ProvenanceClassificationInput,
): ProvenanceClassification {
  const { laneId, intakeSignals, isDeprecatedLabel, hasMapEntry, normalizedDisplayName } = input;
  const evidence: string[] = [];

  if (isDeprecatedLabel === true) {
    return { status: 'deprecated', sourceEvidence: ['deprecatedLabelList'] };
  }

  const declared = Array.isArray(intakeSignals.declaredLaneIds)
    ? intakeSignals.declaredLaneIds.map((value) => String(value || '').toLowerCase().trim())
    : [];
  const isDeclared = declared.includes(String(laneId || '').toLowerCase().trim());

  if (isDeclared && normalizedDisplayName) {
    evidence.push('declaredLaneIds', 'normalizedDisplayName');
    return { status: 'intake_normalized', sourceEvidence: evidence };
  }

  if (isDeclared) {
    evidence.push('declaredLaneIds');
    return { status: 'intake_declared', sourceEvidence: evidence };
  }

  const goalText = String(intakeSignals.goalText || '');
  const keywords = CONCEPT_KEYWORDS_BY_LANE[laneId] || [];
  const conceptMatch = keywords.some((pattern) => pattern.test(goalText));
  if (conceptMatch) {
    evidence.push('goalTextConceptMatch');
    return { status: 'system_inferred', sourceEvidence: evidence };
  }

  if (hasMapEntry === false) {
    return { status: 'unsupported', sourceEvidence: [] };
  }

  return { status: 'system_placeholder', sourceEvidence: [] };
}
