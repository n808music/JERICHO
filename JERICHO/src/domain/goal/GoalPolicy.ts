import type { GoalExecutionContract } from './GoalExecutionContract';
import type { GoalIntakeContract, IntakeReadinessState } from './GoalIntakeContract';
import { deriveFeasibilitySubstrateLevel } from '../feasibility/feasibilitySubstrateLevel';
import type { FeasibilitySubstrateLevel } from '../feasibility/feasibilitySubstrateLevel';

export type GoalPolicyReasonCode =
  | 'LIVE_POS_ACTIVATING_EVIDENCE_EARLY'
  | 'LIVE_POS_AT_RISK_DRIFT_ACCUMULATING'
  | 'LIVE_POS_AT_RISK_EVIDENCE_THIN'
  | 'LIVE_POS_AT_RISK_MISSED_EXECUTION_BURDEN'
  | 'LIVE_POS_RECOVERING_AFTER_RISK'
  | 'LIVE_POS_RECOVERING_LINKED_RECOVERY_EVIDENCE'
  | 'LIVE_POS_SCORE_ACTIVATING_RANGE'
  | 'LIVE_POS_SCORE_AT_RISK_RANGE'
  | 'LIVE_POS_SCORE_CAPPED_EARLY_EVIDENCE'
  | 'LIVE_POS_SCORE_CAPPED_RECOVERY_EARLY'
  | 'LIVE_POS_SCORE_EVIDENCE_DENSITY_STRONG'
  | 'LIVE_POS_SCORE_EVIDENCE_DENSITY_THIN'
  | 'LIVE_POS_SCORE_RECOVERY_UPLIFT'
  | 'LIVE_POS_SCORE_STABLE_CONTINUITY'
  | 'LIVE_POS_SCORE_WITHHELD'
  | 'LIVE_POS_STABLE_LINKED_EXECUTION_CONTINUITY'
  | 'LIVE_POS_WITHHELD_CANONICAL_TRUTH_THIN'
  | 'LIVE_POS_WITHHELD_EXECUTION_STATE_UNAVAILABLE'
  | 'LIVE_POS_WITHHELD_LINEAGE_INSUFFICIENT'
  | 'LIVE_POS_WITHHELD_SCHEDULE_NOT_LIVE'
  | 'LIVE_POS_WITHHELD_UNLINKED_EVIDENCE_ONLY'
  | 'LIVE_POS_WITHHELD_UNTIL_ADMISSION'
  | 'LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE'
  | 'LIVE_POS_CORRECTION_ADJUSTMENT_RECOMMENDED'
  | 'LIVE_POS_CORRECTION_RECOVERY_REQUIRED'
  | 'FEASIBILITY_ASSUMPTION_BURDEN_HIGH'
  | 'FEASIBILITY_CANONICAL_TRUTH_THIN'
  | 'FEASIBILITY_CAPACITY_SUPPORT_MISSING'
  | 'FEASIBILITY_DEPENDENCY_BURDEN_HIGH'
  | 'FEASIBILITY_LANE_CLASSIFICATION_MISSING'
  | 'FEASIBILITY_SCHEDULE_STRAINED'
  | 'FEASIBILITY_SCHEDULE_TRUTH_MISSING'
  | 'FEASIBILITY_STRUCTURAL_QUALITY_WEAK'
  | 'FEASIBILITY_TEMPORAL_QUALITY_WEAK'
  | 'FEASIBILITY_UNCERTAINTY_BURDEN_HIGH'
  | 'FEASIBILITY_LONG_HORIZON_OVERLOADED'
  | 'FEASIBILITY_LONG_HORIZON_UNDERSTRUCTURED'
  | 'INTAKE_ARTIFACT_UNCLEAR'
  | 'INTAKE_BOUNDARY_AMBIGUOUS'
  | 'INTAKE_CONTEXT_REQUIRED'
  | 'INTAKE_DEADLINE_MISSING'
  | 'INTAKE_DOMAIN_CONTEXT_REQUIRED'
  | 'PLAN_ACTION_TYPE_COVERAGE_WEAK'
  | 'PLAN_ASSUMPTION_BURDEN_HIGH'
  | 'PLAN_DEPENDENCY_INCOHERENT'
  | 'PLAN_FEASIBILITY_NOT_TRUTHFUL'
  | 'PLAN_INSPECTABILITY_THIN'
  | 'PLAN_LINEAGE_INCOMPLETE'
  | 'PLAN_MEASURABILITY_WEAK'
  | 'PLAN_READINESS_METADATA_THIN'
  | 'PLAN_SCOPE_INFLATED'
  | 'PLAN_STARTING_STATE_ASSUMED'
  | 'PLAN_STRUCTURAL_TRUTH_WITHHELD'
  | 'POS_TRUST_PROVISIONAL_AUTHORITY_CEILING'
  | 'POS_TRUST_PROVISIONAL_PLAN_DEGRADED'
  | 'POS_WITHHELD_UNTIL_ADMISSION'
  | 'POS_WITHHELD_UNTIL_EVIDENCE'
  | 'POS_WITHHELD_UNTIL_PLAN_QUALITY';

export type GoalBoundaryPolicy = {
  required: string[];
  bounded: string[];
  prohibited: string[];
  assumptionsNeedingConfirmation: string[];
};

export type ScopeClassification = {
  required: string[];
  recommended: string[];
  optional: string[];
  blockedByUnconfirmedContext: string[];
  assumedBaselineSupporting: string[];
};

export type IntakeReadinessEvaluation = {
  state: IntakeReadinessState;
  isReadyForPlanning: boolean;
  reasonCodes: GoalPolicyReasonCode[];
  assumptions: string[];
};

export type PlanQualityEvaluation = {
  state: 'policy_clean' | 'policy_degraded' | 'policy_blocked';
  reasonCodes: GoalPolicyReasonCode[];
  structuralState: 'trusted' | 'provisional' | 'degraded' | 'withheld';
  structuralReasonCodes: GoalPolicyReasonCode[];
  endpointClarity: 'clear' | 'ambiguous' | 'missing';
  startingPointHonesty: 'explicit' | 'assumed' | 'unknown';
  scopeDiscipline: 'clean' | 'degraded' | 'inflated';
  blockMeasurability: 'clear' | 'weak';
  feasibilityHonesty: 'clear' | 'degraded' | 'blocked';
  actionTypeCoverage: 'complete' | 'partial' | 'missing';
  dependencyReadinessCoverage: 'sufficient' | 'partial' | 'missing';
  assumptionBurden: 'none' | 'moderate' | 'high';
  inspectability: 'strong' | 'usable' | 'thin' | 'missing';
  lineageIntegrity: 'complete' | 'partial' | 'missing';
};

export type PosTrustState = 'trusted' | 'provisional' | 'withheld';

export type PosTrustEvaluation = {
  state: PosTrustState;
  reasonCodes: GoalPolicyReasonCode[];
  explanation: string;
};

export type FeasibilityEvaluation = {
  state: 'feasible' | 'constrained' | 'degraded' | 'withheld';
  percent: number | null;
  score: number | null;
  range: [number, number] | null;
  confidence: 'low' | 'moderate' | 'high';
  substrateLevel: FeasibilitySubstrateLevel;
  summary: string;
  reasonCodes: GoalPolicyReasonCode[];
  assumptions: string[];
  structuralSupport: 'strong' | 'limited' | 'weak' | 'missing';
  scheduleFit: 'fit' | 'strained' | 'missing';
  capacitySupport: 'sufficient' | 'limited' | 'missing';
  dependencyBurden: 'manageable' | 'elevated' | 'weak';
  assumptionBurden: 'none' | 'moderate' | 'high';
  uncertaintyBurden: 'none' | 'moderate' | 'high';
  temporalSupport: 'strong' | 'limited' | 'weak' | 'missing';
};

export type LivePosInputEvaluation = {
  state: 'withheld' | 'provisional' | 'available' | 'eligible';
  percent: number | null;
  scoreValue: number | null;
  range: [number, number] | null;
  confidence: 'low' | 'moderate' | 'high';
  baselineInitialFeasibilityPercent: number | null;
  reasonCodes: GoalPolicyReasonCode[];
  liveState: 'withheld' | 'activating' | 'stable' | 'at_risk' | 'recovering';
  liveStateReasonCodes: GoalPolicyReasonCode[];
  summary: string;
  correctionLevel: string | null;
  paceState: string | null;
  completionRate: number | null;
  score: {
    state: 'withheld' | 'available';
    value: number | null;
    reasonCodes: GoalPolicyReasonCode[];
    capped: boolean;
    evidenceDensity: 'thin' | 'moderate' | 'strong' | 'unavailable';
    lowerBound: number | null;
    upperBound: number | null;
  };
  canonicalEventSource: 'available' | 'missing';
  canonicalExternalEvidenceSource: 'available' | 'missing';
  liveScheduleState: 'live' | 'not_live';
  evidenceCount: number;
  externalEvidenceCount: number;
  positiveExternalEvidenceCount: number;
  negativeExternalEvidenceCount: number;
  noResponseExternalEvidenceCount: number;
  blockedExternalEvidenceCount: number;
  linkedEvidenceCount: number;
  linkedCompletionCount: number;
  linkedMissedCount: number;
  linkedRescheduleCount: number;
  recoveryEvidenceCount: number;
  evidenceKinds: string[];
};

export type GoalPolicySnapshot = {
  goalId: string | null;
  macroBoundaryPolicy: GoalBoundaryPolicy;
  intakeReadiness: IntakeReadinessEvaluation;
  planQuality: PlanQualityEvaluation;
  feasibility: FeasibilityEvaluation;
  livePos: LivePosInputEvaluation;
  posTrust: PosTrustEvaluation;
  scopeClassification: ScopeClassification;
  evaluatedAtISO: string;
};

export type GoalPolicyInput = {
  goalId?: string | null;
  intakeContract?: GoalIntakeContract | null;
  executionContract?: GoalExecutionContract | null;
  planProof?: {
    feasibilityStatus?: 'FEASIBLE' | 'INFEASIBLE' | string;
    feasibilityReasons?: string[];
    requiredPacePerDay?: number;
    maxPerDay?: number;
    maxPerWeek?: number;
    totalRequiredUnits?: number;
    workableDaysRemaining?: number;
  } | null;
  probabilityStatus?: 'disabled' | 'insufficient_evidence' | 'computed' | null;
  feasibilityStatus?: 'FEASIBLE' | 'REQUIRED' | 'INFEASIBLE' | string | null;
  hasCommittedBlocks?: boolean;
  hasProposedBlocks?: boolean;
  hasExecutionGraph?: boolean;
  canonicalActions?: Array<Record<string, unknown>> | null;
  canonicalDeliverables?: Array<Record<string, unknown>> | null;
  longTermPlan?: {
    isLongHorizon?: boolean;
    quality?: { state?: string | null; reasonCodes?: string[] | null } | null;
    saturation?: { saturationShape?: string | null } | null;
    uncertainty?: { bands?: Array<{ certainty?: string | null }> | null } | null;
    checkpoints?: Array<Record<string, unknown>> | null;
  } | null;
  preExecutionSchedule?: {
    blockCount?: number | null;
    totalMinutes?: number | null;
  } | null;
  canonicalExecutionEvents?: Array<Record<string, unknown>> | null;
  canonicalExternalEvidenceEvents?: Array<Record<string, unknown>> | null;
  liveScheduleApplied?: boolean | null;
  outcomeAuthorityClass?:
    | 'fully_controllable'
    | 'externally_mediated'
    | 'market_dependent'
    | 'mixed'
    | 'unknown'
    | null;
  planQualityFailureCodes?: string[] | null;
  executionCorrectionState?: string | null;
  executionCorrectionLevel?: string | null;
  blockedDownstreamCount?: number | null;
  timedDeadlineRiskCount?: number | null;
  paceState?: string | null;
};

function uniqueList(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function hasStartingState(intakeContract: GoalIntakeContract | null | undefined): boolean {
  return (
    Boolean(String(intakeContract?.startingState || '').trim()) ||
    intakeContract?.answeredContext?.startingState !== undefined
  );
}

function normalizeActionType(value: unknown): 'preparation' | 'execution' | null {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === 'preparation' || raw === 'prep' || raw === 'readiness') return 'preparation';
  if (raw === 'execution' || raw === 'execute') return 'execution';
  return null;
}

function toDayKey(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return text.slice(0, 10);
}

function daySpanInclusive(startDayKey: string, endDayKey: string): number | null {
  const startMs = Date.parse(`${startDayKey}T00:00:00.000Z`);
  const endMs = Date.parse(`${endDayKey}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  return Math.floor((endMs - startMs) / 86400000) + 1;
}

function resolveGoalDayBounds(executionContract: GoalExecutionContract | null | undefined) {
  const startDayKey = toDayKey(
    (executionContract as Record<string, unknown> | null | undefined)?.startDayKey ||
      (executionContract as Record<string, unknown> | null | undefined)?.startDateISO
  );
  const endDayKey = toDayKey(
    (executionContract as Record<string, unknown> | null | undefined)?.endDayKey ||
      executionContract?.deadline?.dayKey ||
      (executionContract as Record<string, unknown> | null | undefined)?.deadlineISO
  );
  return { startDayKey, endDayKey };
}

function windowDurationMinutes(window: unknown): number {
  const start = String((window as Record<string, unknown> | null)?.start || '').trim();
  const end = String((window as Record<string, unknown> | null)?.end || '').trim();
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  if (
    !Number.isFinite(startHour) ||
    !Number.isFinite(startMinute) ||
    !Number.isFinite(endHour) ||
    !Number.isFinite(endMinute)
  ) {
    return 0;
  }
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  return Math.max(0, endTotal - startTotal);
}

function clampUnitScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeNullableNumber(value: unknown): number | null {
  const candidate = Number(value);
  return Number.isFinite(candidate) ? candidate : null;
}

function buildFeasibilitySummary(state: FeasibilityEvaluation['state'], assumptions: string[]): string {
  if (state === 'withheld') {
    return 'Initial feasibility is withheld until the minimum forecast substrate is available.';
  }
  if (assumptions.length === 0) {
    if (state === 'feasible') {
      return 'Structurally credible pre-execution path with enough substrate to state a forecast.';
    }
    if (state === 'constrained') {
      return 'Forecast is available, but known constraints limit the odds.';
    }
    return 'Forecast is available, but plan quality or burden reduces trust in the estimate.';
  }
  return `Possible but dependent on ${assumptions.slice(0, 4).join(', ')}.`;
}

function deriveFeasibilityPointEstimate(
  range: [number, number],
  confidence: FeasibilityEvaluation['confidence']
): number {
  const [lower, upper] = range;
  const width = Math.max(0, upper - lower);
  if (confidence === 'low') {
    // Conservative deterministic rule: use the lower-third of the range when downside risk is high.
    return clampUnitScore(lower + width / 3);
  }
  // Default deterministic rule: midpoint of the range.
  return clampUnitScore(lower + width / 2);
}

function computeCapacitySupport(executionContract: GoalExecutionContract | null | undefined) {
  const workWindows = executionContract?.workWindows || null;
  const { startDayKey, endDayKey } = resolveGoalDayBounds(executionContract);
  const horizonDays = startDayKey && endDayKey ? daySpanInclusive(startDayKey, endDayKey) : null;
  const weekdayKeys: Array<keyof NonNullable<GoalExecutionContract['workWindows']>> = [
    'sun',
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
  ];
  const dailyMinutesByWeekday = weekdayKeys.map((key) =>
    (workWindows?.[key] || []).reduce((sum, window) => sum + windowDurationMinutes(window), 0)
  );
  const workdayCount = dailyMinutesByWeekday.filter((minutes) => minutes > 0).length;
  const weeklyMinutes = dailyMinutesByWeekday.reduce((sum, minutes) => sum + minutes, 0);
  if (!workWindows || weeklyMinutes <= 0 || !horizonDays) {
    return {
      capacitySupport: 'missing' as const,
      totalWorkableMinutes: 0,
      totalWorkableDays: 0,
      horizonDays: horizonDays || 0,
    };
  }
  const fullWeeks = Math.floor(horizonDays / 7);
  const remainderDays = horizonDays % 7;
  const averageDailyMinutes = weeklyMinutes / 7;
  const totalWorkableMinutes = Math.max(0, Math.round(fullWeeks * weeklyMinutes + remainderDays * averageDailyMinutes));
  const totalWorkableDays = Math.max(0, Math.round((horizonDays / 7) * workdayCount));
  return {
    capacitySupport: totalWorkableMinutes > 0 ? ('sufficient' as const) : ('missing' as const),
    totalWorkableMinutes,
    totalWorkableDays,
    horizonDays,
  };
}

function evaluateInitialFeasibility(input: GoalPolicyInput, planQuality: PlanQualityEvaluation): Omit<FeasibilityEvaluation, 'substrateLevel'> {
  const reasonCodes: GoalPolicyReasonCode[] = [];
  const assumptions: string[] = [];
  const gateFailureCodes = Array.isArray(input.planQualityFailureCodes) ? input.planQualityFailureCodes : [];
  const longTermPlan = input.longTermPlan || null;
  const preExecutionSchedule = input.preExecutionSchedule || null;
  const scheduledBlockCount = Math.max(0, Number(preExecutionSchedule?.blockCount || 0));
  const scheduledMinutes = Math.max(0, Number(preExecutionSchedule?.totalMinutes || 0));
  const capacity = computeCapacitySupport(input.executionContract || null);
  const intakeContext = (input.intakeContract?.answeredContext || {}) as Record<string, unknown>;
  const capitalAvailable = normalizeNullableNumber(intakeContext.capitalAvailable);
  const capitalAcquisitionRequired = intakeContext.capitalAcquisitionRequired === true;
  const formulaPathway = String(intakeContext.formulaPathway || '').trim().toLowerCase();
  const goalClassification = String(intakeContext.goalClassification || '').trim().toLowerCase();
  const laneDomain = input.intakeContract?.domain ?? input.executionContract?.goalIntakeContract?.domain ?? null;
  const terminalOutcomeText = String(input.executionContract?.terminalOutcome?.text || '').trim();
  const terminalVerification = String(input.executionContract?.terminalOutcome?.verificationCriteria || '').trim();
  const hasCanonicalTerminalOutcome = Boolean(terminalOutcomeText && terminalVerification);
  const endpointWithheldByGate = gateFailureCodes.includes('OUTCOME_ENDPOINT_MISSING');
  const hasConcreteEndpoint =
    !endpointWithheldByGate &&
    (planQuality.endpointClarity === 'clear' ||
      hasCanonicalTerminalOutcome ||
      (Boolean(input.executionContract?.terminalOutcome?.isConcrete) && hasCanonicalTerminalOutcome));
  const { startDayKey, endDayKey } = resolveGoalDayBounds(input.executionContract || null);
  const hasTimeline = Boolean(startDayKey && endDayKey);
  const hasClassifiedLane = laneDomain !== 'unknown';
  const hasPlanSubstrate =
    Boolean(input.hasExecutionGraph) &&
    (scheduledBlockCount > 0 ||
      scheduledMinutes > 0 ||
      Boolean(input.hasProposedBlocks) ||
      Boolean(input.hasCommittedBlocks));

  let structuralSupport: FeasibilityEvaluation['structuralSupport'] = 'strong';
  if (planQuality.structuralState === 'withheld') {
    structuralSupport = 'missing';
  } else if (planQuality.structuralState === 'degraded') {
    structuralSupport = 'weak';
  } else if (planQuality.structuralState === 'provisional') {
    structuralSupport = 'limited';
  }

  let temporalSupport: FeasibilityEvaluation['temporalSupport'] = 'strong';
  const longTermQualityState = String(longTermPlan?.quality?.state || '')
    .trim()
    .toLowerCase();
  if (Boolean(longTermPlan?.isLongHorizon)) {
    if (longTermQualityState === 'withheld') {
      temporalSupport = 'missing';
    } else if (longTermQualityState === 'degraded') {
      temporalSupport = 'weak';
    } else if (longTermQualityState === 'provisional') {
      temporalSupport = 'limited';
    }
  } else {
    temporalSupport = 'strong';
  }

  const dependencyBurden: FeasibilityEvaluation['dependencyBurden'] =
    planQuality.dependencyReadinessCoverage === 'missing'
      ? 'weak'
      : planQuality.dependencyReadinessCoverage === 'partial'
        ? 'elevated'
        : 'manageable';
  const assumptionBurden = planQuality.assumptionBurden;
  const provisionalBands = Array.isArray(longTermPlan?.uncertainty?.bands)
    ? longTermPlan.uncertainty.bands.filter(
        (band) =>
          String(band?.certainty || '')
            .trim()
            .toLowerCase() === 'provisional'
      ).length
    : 0;
  const uncertaintyBurden: FeasibilityEvaluation['uncertaintyBurden'] =
    provisionalBands >= 2 ? 'high' : provisionalBands > 0 ? 'moderate' : 'none';

  let scheduleFit: FeasibilityEvaluation['scheduleFit'] = 'fit';
  if (scheduledBlockCount === 0) {
    scheduleFit = 'missing';
  } else if (capacity.totalWorkableMinutes <= 0) {
    scheduleFit = 'missing';
  } else if (scheduledMinutes > capacity.totalWorkableMinutes || input.planProof?.feasibilityStatus === 'INFEASIBLE') {
    scheduleFit = 'strained';
  } else if (scheduledMinutes / Math.max(1, capacity.totalWorkableMinutes) >= 0.85) {
    scheduleFit = 'strained';
  }

  let state: FeasibilityEvaluation['state'] = 'feasible';
  if (
    !hasConcreteEndpoint ||
    !hasTimeline ||
    !hasClassifiedLane ||
    !hasPlanSubstrate ||
    structuralSupport === 'missing' ||
    scheduleFit === 'missing' ||
    capacity.capacitySupport === 'missing'
  ) {
    state = 'withheld';
    if (!hasConcreteEndpoint) {
      reasonCodes.push('FEASIBILITY_CANONICAL_TRUTH_THIN');
    }
    if (structuralSupport === 'missing') {
      reasonCodes.push('FEASIBILITY_CANONICAL_TRUTH_THIN', 'FEASIBILITY_STRUCTURAL_QUALITY_WEAK');
    }
    if (!hasTimeline || scheduleFit === 'missing') {
      reasonCodes.push('FEASIBILITY_SCHEDULE_TRUTH_MISSING');
    }
    if (!hasClassifiedLane) {
      reasonCodes.push('FEASIBILITY_LANE_CLASSIFICATION_MISSING');
    }
    if (!hasPlanSubstrate) {
      reasonCodes.push('FEASIBILITY_CANONICAL_TRUTH_THIN');
    }
    if (capacity.capacitySupport === 'missing') {
      reasonCodes.push('FEASIBILITY_CAPACITY_SUPPORT_MISSING');
    }
  } else {
    if (structuralSupport === 'weak') {
      state = 'degraded';
      reasonCodes.push('FEASIBILITY_STRUCTURAL_QUALITY_WEAK');
    } else if (structuralSupport === 'limited') {
      state = 'constrained';
      reasonCodes.push('FEASIBILITY_STRUCTURAL_QUALITY_WEAK');
    }

    if (temporalSupport === 'weak') {
      state = 'degraded';
      reasonCodes.push('FEASIBILITY_TEMPORAL_QUALITY_WEAK');
    } else if (temporalSupport === 'limited' && state === 'feasible') {
      state = 'constrained';
      reasonCodes.push('FEASIBILITY_TEMPORAL_QUALITY_WEAK');
    }

    if (dependencyBurden === 'weak') {
      state = 'degraded';
      reasonCodes.push('FEASIBILITY_DEPENDENCY_BURDEN_HIGH');
    } else if (dependencyBurden === 'elevated' && state === 'feasible') {
      state = 'constrained';
      reasonCodes.push('FEASIBILITY_DEPENDENCY_BURDEN_HIGH');
    }

    if (assumptionBurden === 'high') {
      state = 'degraded';
      reasonCodes.push('FEASIBILITY_ASSUMPTION_BURDEN_HIGH');
    } else if (assumptionBurden === 'moderate' && state === 'feasible') {
      state = 'constrained';
      reasonCodes.push('FEASIBILITY_ASSUMPTION_BURDEN_HIGH');
    }

    if (uncertaintyBurden === 'high') {
      state = state === 'degraded' ? state : 'constrained';
      reasonCodes.push('FEASIBILITY_UNCERTAINTY_BURDEN_HIGH');
      assumptions.push('material uncertainty across the execution path');
    } else if (uncertaintyBurden === 'moderate') {
      assumptions.push('meaningful uncertainty still exists across the path');
    }

    if (scheduleFit === 'strained') {
      state = state === 'withheld' ? state : 'constrained';
      reasonCodes.push('FEASIBILITY_SCHEDULE_STRAINED');
      if (scheduledMinutes > capacity.totalWorkableMinutes || input.planProof?.feasibilityStatus === 'INFEASIBLE') {
        state = 'degraded';
      }
    }

    const saturationShape = String(longTermPlan?.saturation?.saturationShape || '')
      .trim()
      .toLowerCase();
    if (saturationShape === 'overloaded' || saturationShape === 'uneven') {
      state = 'degraded';
      reasonCodes.push('FEASIBILITY_LONG_HORIZON_OVERLOADED');
    } else if (saturationShape === 'understructured') {
      state = state === 'degraded' ? state : 'constrained';
      reasonCodes.push('FEASIBILITY_LONG_HORIZON_UNDERSTRUCTURED');
    }

    const authority = input.outcomeAuthorityClass ?? null;
    if (
      authority === 'externally_mediated' ||
      authority === 'market_dependent' ||
      authority === 'mixed' ||
      authority === 'unknown'
    ) {
      state = state === 'degraded' ? state : 'constrained';
      assumptions.push(
        authority === 'externally_mediated'
          ? 'a third-party decision'
          : authority === 'market_dependent'
            ? 'market conversion'
            : authority === 'mixed'
              ? 'both execution and external response'
              : 'uncertain outcome authority'
      );
    }

    if (capitalAvailable === 0 || capitalAcquisitionRequired) {
      state = state === 'degraded' ? state : 'constrained';
      assumptions.push('a capital bridge');
    }

    if (goalClassification === 'regulated_physical_consumable' && (!formulaPathway || formulaPathway === 'undecided')) {
      state = 'degraded';
      assumptions.push('regulated sourcing and compliance-safe claims');
    }

    if (
      authority === 'market_dependent' ||
      /first\s+sales?|revenue|mrr|orders?|checkout/i.test(
        String(input.executionContract?.terminalOutcome?.text || input.intakeContract?.rawGoalText || '')
      )
    ) {
      assumptions.push('first-sales conversion');
    }
  }

  const uniqueAssumptions = uniqueList(assumptions);
  let score: number | null = null;
  let percent: number | null = null;
  let range: [number, number] | null = null;
  let confidence: FeasibilityEvaluation['confidence'] = 'low';
  let summary = buildFeasibilitySummary(state, uniqueAssumptions);

  if (state !== 'withheld') {
    let scoreValue = 0.82;
    if (state === 'constrained') scoreValue -= 0.08;
    if (state === 'degraded') scoreValue -= 0.18;
    if (structuralSupport === 'limited') scoreValue -= 0.14;
    if (structuralSupport === 'weak') scoreValue -= 0.26;
    if (temporalSupport === 'limited') scoreValue -= 0.08;
    if (temporalSupport === 'weak') scoreValue -= 0.16;
    if (dependencyBurden === 'elevated') scoreValue -= 0.08;
    if (dependencyBurden === 'weak') scoreValue -= 0.16;
    if (assumptionBurden === 'moderate') scoreValue -= 0.08;
    if (assumptionBurden === 'high') scoreValue -= 0.16;
    if (uncertaintyBurden === 'moderate') scoreValue -= 0.06;
    if (uncertaintyBurden === 'high') scoreValue -= 0.12;
    if (scheduleFit === 'strained') scoreValue -= 0.14;
    if (capitalAvailable === 0) scoreValue -= 0.08;
    if (capitalAcquisitionRequired) scoreValue -= 0.06;
    if (goalClassification === 'regulated_physical_consumable' && (!formulaPathway || formulaPathway === 'undecided')) {
      scoreValue -= 0.1;
    }
    if (
      input.outcomeAuthorityClass === 'externally_mediated' ||
      input.outcomeAuthorityClass === 'market_dependent' ||
      input.outcomeAuthorityClass === 'mixed' ||
      input.outcomeAuthorityClass === 'unknown'
    ) {
      scoreValue -= 0.08;
    }

    if (
      state === 'feasible' &&
      structuralSupport === 'strong' &&
      temporalSupport === 'strong' &&
      assumptionBurden === 'none' &&
      uncertaintyBurden === 'none'
    ) {
      confidence = 'high';
    } else if (state === 'degraded' || uncertaintyBurden === 'high' || uniqueAssumptions.length >= 3) {
      confidence = 'low';
    } else {
      confidence = 'moderate';
    }

    const rangeRadius =
      confidence === 'high' ? 0.07 : confidence === 'moderate' ? 0.11 : 0.16;
    const seedScore = clampUnitScore(Math.max(state === 'feasible' ? 0.12 : 0.06, scoreValue));
    range = [clampUnitScore(seedScore - rangeRadius), clampUnitScore(seedScore + rangeRadius)];
    score = deriveFeasibilityPointEstimate(range, confidence);
    percent = Math.round(score * 100);
    summary = buildFeasibilitySummary(state, uniqueAssumptions);
  }

  return {
    state,
    percent,
    score,
    range,
    confidence,
    reasonCodes: uniqueList(reasonCodes) as GoalPolicyReasonCode[],
    summary,
    assumptions: uniqueAssumptions,
    structuralSupport,
    scheduleFit,
    capacitySupport:
      capacity.capacitySupport === 'missing' ? 'missing' : scheduleFit === 'strained' ? 'limited' : 'sufficient',
    dependencyBurden,
    assumptionBurden,
    uncertaintyBurden,
    temporalSupport,
  };
}

function evaluateLivePosInputs(
  input: GoalPolicyInput,
  intakeReadinessState: IntakeReadinessState,
  planQuality: PlanQualityEvaluation,
  feasibility: FeasibilityEvaluation
): LivePosInputEvaluation {
  const eventSourceAvailable = Array.isArray(input.canonicalExecutionEvents);
  const events = eventSourceAvailable ? input.canonicalExecutionEvents || [] : [];
  const externalEvidenceSourceAvailable = Array.isArray(input.canonicalExternalEvidenceEvents);
  const externalEvidenceEvents = externalEvidenceSourceAvailable ? input.canonicalExternalEvidenceEvents || [] : [];
  const liveScheduleState: LivePosInputEvaluation['liveScheduleState'] = input.liveScheduleApplied
    ? 'live'
    : 'not_live';
  const evidenceKinds = uniqueList(
    events.map((event) => {
      const kind = String(event?.kind || '')
        .trim()
        .toLowerCase();
      if (kind) {
        return kind;
      }
      return String(event?.status || '')
        .trim()
        .toLowerCase();
    })
  );
  const linkedEvidence = events.filter((event) => {
    const linkageStatus = String(event?.linkageStatus || '')
      .trim()
      .toUpperCase();
    if (linkageStatus === 'LINKED') {
      return true;
    }
    return Boolean(
      String(event?.deliverableId || '').trim() ||
      String(event?.actionId || '').trim() ||
      String(event?.criterionId || '').trim()
    );
  });
  const normalizeEventKind = (event: Record<string, unknown>) => {
    const rawKind = String(event?.kind || '')
      .trim()
      .toLowerCase();
    const rawStatus = String(event?.status || '')
      .trim()
      .toLowerCase();
    if (rawKind === 'complete' || rawStatus === 'completed' || rawStatus === 'complete') {
      return 'complete';
    }
    if (rawKind === 'missed' || rawStatus === 'missed') {
      return 'missed';
    }
    if (rawKind === 'skipped' || rawStatus === 'skipped') {
      return 'skipped';
    }
    if (rawKind === 'backlog_accept') {
      return 'backlog_accept';
    }
    if (rawKind === 'reschedule' || rawStatus === 'rescheduled') {
      return 'reschedule';
    }
    if (rawKind === 'create') {
      return 'create';
    }
    if (rawKind === 'update') {
      return 'update';
    }
    return rawKind || rawStatus || 'unknown';
  };
  const eventOrderValue = (event: Record<string, unknown>) => {
    const candidate = [
      String(event?.dateISO || '').trim(),
      String(event?.startISO || '').trim(),
      String(event?.endISO || '').trim(),
      String(event?.atISO || '').trim(),
      String(event?.missedAtISO || '').trim(),
    ].find(Boolean);
    if (!candidate) {
      return '';
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      return `${candidate}T00:00:00.000Z`;
    }
    return candidate;
  };
  const orderedLinkedEvidence = [...linkedEvidence].sort((left, right) =>
    eventOrderValue(left).localeCompare(eventOrderValue(right))
  );
  const linkedCompletionEvents = orderedLinkedEvidence.filter((event) => normalizeEventKind(event) === 'complete');
  const linkedMissedEvents = orderedLinkedEvidence.filter((event) => normalizeEventKind(event) === 'missed');
  const linkedRescheduleEvents = orderedLinkedEvidence.filter((event) => normalizeEventKind(event) === 'reschedule');
  const linkedNegativeEvents = orderedLinkedEvidence.filter((event) => {
    const kind = normalizeEventKind(event);
    return kind === 'missed' || kind === 'reschedule' || kind === 'skipped';
  });
  const lastNegativeIndex = orderedLinkedEvidence.reduce((latestIndex, event, index) => {
    const kind = normalizeEventKind(event);
    return kind === 'missed' || kind === 'reschedule' || kind === 'skipped' ? index : latestIndex;
  }, -1);
  const recoveryCompletionEvents =
    lastNegativeIndex >= 0
      ? orderedLinkedEvidence.slice(lastNegativeIndex + 1).filter((event) => normalizeEventKind(event) === 'complete')
      : [];
  const completionDays = uniqueList(
    linkedCompletionEvents.map((event) => toDayKey(event?.dateISO || event?.startISO || event?.atISO))
  );
  const recoveryCompletionDays = uniqueList(
    recoveryCompletionEvents.map((event) => toDayKey(event?.dateISO || event?.startISO || event?.atISO))
  );

  const reasonCodes: GoalPolicyReasonCode[] = [];
  let state: LivePosInputEvaluation['state'] = 'available';
  const baselineInitialFeasibilityPercent =
    feasibility?.state !== 'withheld'
      ? Number.isFinite(feasibility?.percent)
        ? Number(feasibility.percent)
        : Number.isFinite(feasibility?.score)
          ? Math.round(Number(feasibility.score) * 100)
          : null
      : null;

  if (intakeReadinessState === 'intake_blocked') {
    state = 'withheld';
    reasonCodes.push('LIVE_POS_WITHHELD_UNTIL_ADMISSION');
  } else if (!eventSourceAvailable) {
    state = 'withheld';
    reasonCodes.push('LIVE_POS_WITHHELD_EXECUTION_STATE_UNAVAILABLE');
  } else if (liveScheduleState !== 'live') {
    state = 'withheld';
    reasonCodes.push('LIVE_POS_WITHHELD_SCHEDULE_NOT_LIVE');
  } else if (planQuality.lineageIntegrity === 'missing' || planQuality.structuralState === 'withheld') {
    state = 'withheld';
    reasonCodes.push('LIVE_POS_WITHHELD_LINEAGE_INSUFFICIENT', 'LIVE_POS_WITHHELD_CANONICAL_TRUTH_THIN');
  } else if (events.length === 0) {
    state = 'withheld';
    reasonCodes.push('LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE');
  } else if (linkedEvidence.length === 0) {
    state = 'withheld';
    reasonCodes.push('LIVE_POS_WITHHELD_UNLINKED_EVIDENCE_ONLY', 'LIVE_POS_WITHHELD_LINEAGE_INSUFFICIENT');
  }

  let liveState: LivePosInputEvaluation['liveState'] = 'withheld';
  const liveStateReasonCodes: GoalPolicyReasonCode[] = [];
  const relevantEvidence = orderedLinkedEvidence.filter((event) => {
    const kind = normalizeEventKind(event);
    return kind === 'complete' || kind === 'missed' || kind === 'reschedule' || kind === 'skipped';
  });
  const relevantEvidenceCount = relevantEvidence.length;
  const linkedCompletionCount = linkedCompletionEvents.length;
  const linkedMissedCount = linkedMissedEvents.length;
  const linkedRescheduleCount = linkedRescheduleEvents.length;
  const linkedSkippedCount = orderedLinkedEvidence.filter((event) => normalizeEventKind(event) === 'skipped').length;
  const completedRequiredCount = linkedCompletionEvents.filter((event) => Boolean(event?.requiredSystemBlock)).length;
  const missedRequiredCount = linkedMissedEvents.filter((event) => Boolean(event?.requiredSystemBlock)).length;
  const skippedRequiredCount = orderedLinkedEvidence.filter(
    (event) => normalizeEventKind(event) === 'skipped' && Boolean(event?.requiredSystemBlock)
  ).length;
  const negativeEvidenceCount = linkedNegativeEvents.length + linkedSkippedCount;
  const recoveryEvidenceCount = recoveryCompletionEvents.length;
  const completionRate = relevantEvidenceCount > 0 ? linkedCompletionCount / relevantEvidenceCount : null;
  const correctionLevel = String(input.executionCorrectionLevel || '').trim().toLowerCase() || null;
  const paceState = String(input.paceState || '').trim().toLowerCase() || null;
  const blockedDownstreamCount = Math.max(0, Number(input.blockedDownstreamCount || 0));
  const timedDeadlineRiskCount = Math.max(0, Number(input.timedDeadlineRiskCount || 0));
  const positiveExternalEvidenceTypes = new Set([
    'positive_response',
    'submission_confirmed',
    'approval_received',
    'quote_received',
    'sample_ordered',
    'sale_occurred',
    'artifact_published',
  ]);
  const negativeExternalEvidenceTypes = new Set([
    'negative_response',
    'rejection_received',
    'quote_blocking',
    'sample_failed',
    'payment_failed',
  ]);
  const noResponseExternalEvidenceTypes = new Set(['no_response']);
  const blockedExternalEvidenceTypes = new Set(['external_dependency_blocked']);
  const relevantExternalEvidence = externalEvidenceEvents.filter((event) => {
    const goalMatch =
      !input.goalId || !event?.goalId || String(event.goalId).trim() === String(input.goalId).trim();
    return goalMatch && String(event?.kind || '').trim().toLowerCase() === 'external_evidence';
  });
  const positiveExternalEvidenceCount = relevantExternalEvidence.filter((event) =>
    positiveExternalEvidenceTypes.has(String(event?.evidenceType || '').trim().toLowerCase())
  ).length;
  const negativeExternalEvidenceCount = relevantExternalEvidence.filter((event) =>
    negativeExternalEvidenceTypes.has(String(event?.evidenceType || '').trim().toLowerCase())
  ).length;
  const noResponseExternalEvidenceCount = relevantExternalEvidence.filter((event) =>
    noResponseExternalEvidenceTypes.has(String(event?.evidenceType || '').trim().toLowerCase())
  ).length;
  const blockedExternalEvidenceCount = relevantExternalEvidence.filter((event) =>
    blockedExternalEvidenceTypes.has(String(event?.evidenceType || '').trim().toLowerCase())
  ).length;

  if (state === 'withheld') {
    liveState = 'withheld';
    liveStateReasonCodes.push(...reasonCodes);
  } else {
    if (
      negativeEvidenceCount > 0 ||
      negativeExternalEvidenceCount > 0 ||
      noResponseExternalEvidenceCount > 0 ||
      blockedExternalEvidenceCount > 0
    ) {
      if (recoveryEvidenceCount >= 2 && recoveryCompletionDays.length >= 2) {
        liveState = 'recovering';
        liveStateReasonCodes.push('LIVE_POS_RECOVERING_AFTER_RISK', 'LIVE_POS_RECOVERING_LINKED_RECOVERY_EVIDENCE');
      } else {
        liveState = 'at_risk';
        if (linkedMissedCount > 0) {
          liveStateReasonCodes.push('LIVE_POS_AT_RISK_MISSED_EXECUTION_BURDEN');
        }
        if (linkedRescheduleCount > 0) {
          liveStateReasonCodes.push('LIVE_POS_AT_RISK_DRIFT_ACCUMULATING');
        }
        if (linkedCompletionCount === 0) {
          liveStateReasonCodes.push('LIVE_POS_AT_RISK_EVIDENCE_THIN');
        }
      }
    } else if (linkedCompletionCount >= 2 && completionDays.length >= 2) {
      liveState = 'stable';
      liveStateReasonCodes.push('LIVE_POS_STABLE_LINKED_EXECUTION_CONTINUITY');
    } else {
      liveState = 'activating';
      liveStateReasonCodes.push('LIVE_POS_ACTIVATING_EVIDENCE_EARLY');
    }
  }

  const evidenceDensity: LivePosInputEvaluation['score']['evidenceDensity'] =
    linkedEvidence.length <= 1 || completionDays.length <= 1
      ? state === 'withheld'
        ? 'unavailable'
        : 'thin'
      : linkedEvidence.length >= 4 && completionDays.length >= 3
        ? 'strong'
        : 'moderate';

  const clampUnitScore = (value: number) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    if (value <= 0) {
      return 0;
    }
    if (value >= 1) {
      return 1;
    }
    return Math.round(value * 1000) / 1000;
  };
  const clampToBand = (value: number, lower: number, upper: number) =>
    clampUnitScore(Math.min(upper, Math.max(lower, value)));
  const scoreReasonCodes: GoalPolicyReasonCode[] = [];
  let scoreState: LivePosInputEvaluation['score']['state'] = 'withheld';
  let scoreValue: number | null = null;
  let scoreCapped = false;
  let lowerBound: number | null = null;
  let upperBound: number | null = null;
  let percent: number | null = null;
  let range: [number, number] | null = null;
  let confidence: LivePosInputEvaluation['confidence'] = 'low';
  let summary =
    state === 'withheld'
      ? 'Live P.O.S. is intentionally withheld until canonical execution evidence is available.'
      : 'Live P.O.S. is being computed from linked execution evidence on the live schedule.';

  if (state === 'withheld') {
    scoreReasonCodes.push('LIVE_POS_SCORE_WITHHELD');
  } else {
    state = 'eligible';
    scoreState = 'available';
    let dynamicScore = Number.isFinite(baselineInitialFeasibilityPercent)
      ? clampUnitScore(Number(baselineInitialFeasibilityPercent) / 100)
      : 0.5;

    if (completionRate !== null) {
      dynamicScore += (completionRate - 0.5) * 0.08;
    }
    dynamicScore += Math.min(0.03, completedRequiredCount * 0.015);
    dynamicScore -= Math.min(0.24, missedRequiredCount * 0.12);
    dynamicScore -= Math.min(0.16, skippedRequiredCount * 0.08);
    dynamicScore -= Math.min(0.12, blockedDownstreamCount * 0.05);
    dynamicScore -= Math.min(0.12, timedDeadlineRiskCount * 0.03);
    dynamicScore += Math.min(0.08, positiveExternalEvidenceCount * 0.03);
    dynamicScore -= Math.min(0.16, negativeExternalEvidenceCount * 0.05);
    dynamicScore -= Math.min(0.18, noResponseExternalEvidenceCount * 0.06);
    dynamicScore -= Math.min(0.18, blockedExternalEvidenceCount * 0.08);

    if (correctionLevel === 'reschedule') {
      dynamicScore -= 0.04;
    } else if (correctionLevel === 'compression_warning') {
      dynamicScore -= 0.1;
    } else if (correctionLevel === 'dependency_impact') {
      dynamicScore -= 0.18;
    } else if (correctionLevel === 'plan_evolution_required') {
      dynamicScore -= 0.28;
      scoreCapped = true;
    } else if (correctionLevel === 'none') {
      dynamicScore += 0.02;
    }

    if (paceState === 'ahead') {
      dynamicScore += 0.02;
    } else if (paceState === 'on_track') {
      dynamicScore += 0.01;
    } else if (paceState === 'behind') {
      dynamicScore -= 0.05;
    } else if (paceState === 'critical') {
      dynamicScore -= 0.1;
      scoreCapped = true;
    }

    if (blockedExternalEvidenceCount > 0 || noResponseExternalEvidenceCount >= 2) {
      scoreCapped = true;
      dynamicScore = Math.min(dynamicScore, 0.45);
    }

    if (liveState === 'activating') {
      scoreCapped = true;
      dynamicScore = Math.min(dynamicScore, 0.6);
    } else if (liveState === 'at_risk') {
      dynamicScore = Math.min(dynamicScore, 0.55);
    } else if (liveState === 'recovering') {
      scoreCapped = true;
      dynamicScore = Math.min(dynamicScore, 0.72);
    } else if (liveState === 'stable') {
      let stableContinuityScore = 0.74;
      stableContinuityScore += Math.min(0.06, Math.max(0, linkedCompletionCount - 2) * 0.03);
      stableContinuityScore += Math.min(0.04, Math.max(0, completionDays.length - 2) * 0.02);
      stableContinuityScore += Math.min(0.03, completedRequiredCount * 0.015);
      stableContinuityScore -= Math.min(0.12, blockedDownstreamCount * 0.05);
      stableContinuityScore -= Math.min(0.12, timedDeadlineRiskCount * 0.03);
      stableContinuityScore += Math.min(0.08, positiveExternalEvidenceCount * 0.03);
      stableContinuityScore -= Math.min(0.16, negativeExternalEvidenceCount * 0.05);
      stableContinuityScore -= Math.min(0.18, noResponseExternalEvidenceCount * 0.06);
      stableContinuityScore -= Math.min(0.18, blockedExternalEvidenceCount * 0.08);

      if (correctionLevel === 'reschedule') {
        stableContinuityScore -= 0.04;
      } else if (correctionLevel === 'compression_warning') {
        stableContinuityScore -= 0.1;
      } else if (correctionLevel === 'dependency_impact') {
        stableContinuityScore -= 0.18;
      } else if (correctionLevel === 'plan_evolution_required') {
        stableContinuityScore -= 0.28;
        scoreCapped = true;
      } else if (correctionLevel === 'none') {
        stableContinuityScore += 0.02;
      }

      if (paceState === 'ahead') {
        stableContinuityScore += 0.02;
      } else if (paceState === 'on_track') {
        stableContinuityScore += 0.01;
      } else if (paceState === 'behind') {
        stableContinuityScore -= 0.05;
      } else if (paceState === 'critical') {
        stableContinuityScore -= 0.1;
        scoreCapped = true;
      }

      dynamicScore = clampToBand(stableContinuityScore, 0.72, 0.86);
    }

    scoreValue = clampUnitScore(dynamicScore);
    percent = Math.round(scoreValue * 100);

    if (liveState === 'stable') {
      scoreReasonCodes.push('LIVE_POS_SCORE_STABLE_CONTINUITY');
    } else if (liveState === 'at_risk') {
      scoreReasonCodes.push('LIVE_POS_SCORE_AT_RISK_RANGE');
    } else if (liveState === 'recovering') {
      scoreReasonCodes.push('LIVE_POS_SCORE_RECOVERY_UPLIFT');
    } else {
      scoreReasonCodes.push('LIVE_POS_SCORE_ACTIVATING_RANGE');
    }

    if (evidenceDensity === 'thin') {
      scoreCapped = true;
      scoreReasonCodes.push('LIVE_POS_SCORE_EVIDENCE_DENSITY_THIN');
    } else if (evidenceDensity === 'strong') {
      scoreReasonCodes.push('LIVE_POS_SCORE_EVIDENCE_DENSITY_STRONG');
    }

    if (liveState === 'activating' && scoreCapped) {
      scoreReasonCodes.push('LIVE_POS_SCORE_CAPPED_EARLY_EVIDENCE');
    }
    if (liveState === 'recovering' && scoreCapped) {
      scoreReasonCodes.push('LIVE_POS_SCORE_CAPPED_RECOVERY_EARLY');
    }

    confidence =
      linkedEvidence.length >= 4 &&
      evidenceDensity === 'strong' &&
      negativeExternalEvidenceCount === 0 &&
      noResponseExternalEvidenceCount === 0 &&
      blockedExternalEvidenceCount === 0
        ? 'high'
        : linkedEvidence.length >= 2 &&
            correctionLevel !== 'plan_evolution_required' &&
            blockedExternalEvidenceCount === 0 &&
            noResponseExternalEvidenceCount < 2
          ? 'moderate'
          : 'low';
    const halfWidth = confidence === 'high' ? 0.06 : confidence === 'moderate' ? 0.1 : 0.14;
    lowerBound = clampUnitScore(scoreValue - halfWidth);
    upperBound = clampUnitScore(scoreValue + halfWidth);
    range = [lowerBound, upperBound];
    summary =
      liveState === 'activating'
        ? `Live P.O.S. is activating at ${percent}% while execution evidence is still early.`
        : `Live P.O.S. is ${percent}% based on execution continuity against the initial feasibility baseline.`;
    if (positiveExternalEvidenceCount > 0 && negativeExternalEvidenceCount === 0 && noResponseExternalEvidenceCount === 0) {
      summary = `${summary} Positive external evidence is now reinforcing the signal.`;
    } else if (
      negativeExternalEvidenceCount > 0 ||
      noResponseExternalEvidenceCount > 0 ||
      blockedExternalEvidenceCount > 0
    ) {
      summary = `${summary} External outcome evidence is currently pressuring the outlook.`;
    }
  }

  return {
    state,
    percent,
    scoreValue,
    range,
    confidence,
    baselineInitialFeasibilityPercent,
    reasonCodes: uniqueList(reasonCodes) as GoalPolicyReasonCode[],
    liveState,
    liveStateReasonCodes: uniqueList(liveStateReasonCodes) as GoalPolicyReasonCode[],
    summary,
    correctionLevel,
    paceState,
    completionRate,
    score: {
      state: scoreState,
      value: scoreValue,
      reasonCodes: uniqueList(scoreReasonCodes) as GoalPolicyReasonCode[],
      capped: scoreCapped,
      evidenceDensity,
      lowerBound,
      upperBound,
    },
    canonicalEventSource: eventSourceAvailable ? 'available' : 'missing',
    canonicalExternalEvidenceSource: externalEvidenceSourceAvailable ? 'available' : 'missing',
    liveScheduleState,
    evidenceCount: events.length,
    externalEvidenceCount: relevantExternalEvidence.length,
    positiveExternalEvidenceCount,
    negativeExternalEvidenceCount,
    noResponseExternalEvidenceCount,
    blockedExternalEvidenceCount,
    linkedEvidenceCount: linkedEvidence.length,
    linkedCompletionCount: linkedCompletionEvents.length,
    linkedMissedCount: linkedMissedEvents.length,
    linkedRescheduleCount: linkedRescheduleEvents.length,
    recoveryEvidenceCount: recoveryCompletionEvents.length,
    evidenceKinds,
  };
}

function evaluateStructuralPlanQuality(input: GoalPolicyInput, assumptionCount: number) {
  const actions = Array.isArray(input.canonicalActions) ? input.canonicalActions : [];
  const deliverables = Array.isArray(input.canonicalDeliverables) ? input.canonicalDeliverables : [];
  const actionIds = actions.map((action) => String(action?.id || '').trim()).filter(Boolean);
  const actionIdSet = new Set(actionIds);
  const deliverableIdSet = new Set(deliverables.map((d) => String(d?.id || '').trim()).filter(Boolean));
  // Reverse links: deliverable.actionIds → action.id
  const mappedActionIds = new Set(
    deliverables.flatMap((deliverable) =>
      Array.isArray(deliverable?.actionIds)
        ? deliverable.actionIds.map((id) => String(id || '').trim()).filter(Boolean)
        : []
    )
  );
  // Forward links: action.deliverableId → deliverable.id (deterministic bootstrap path)
  actions.forEach((action) => {
    const fwdDeliverableId = String((action as Record<string, unknown>)?.deliverableId || '').trim();
    if (fwdDeliverableId && deliverableIdSet.has(fwdDeliverableId)) {
      const actionId = String((action as Record<string, unknown>)?.id || '').trim();
      if (actionId) mappedActionIds.add(actionId);
    }
  });

  const actionTypeKnownCount = actions.filter((action) =>
    normalizeActionType((action as Record<string, unknown>)?.actionType || (action as Record<string, unknown>)?.type)
  ).length;
  const dependencyAnnotatedCount = actions.filter((action) => {
    const dependencies = Array.isArray((action as Record<string, unknown>)?.dependencies)
      ? (action as Record<string, unknown>).dependencies
      : Array.isArray((action as Record<string, unknown>)?.dependencyIds)
        ? (action as Record<string, unknown>).dependencyIds
        : [];
    const readinessConditions = Array.isArray((action as Record<string, unknown>)?.readinessConditions)
      ? (action as Record<string, unknown>).readinessConditions
      : [
          (action as Record<string, unknown>)?.readinessCondition,
          (action as Record<string, unknown>)?.readiness,
        ].filter(Boolean);
    return dependencies.length > 0 || readinessConditions.length > 0;
  }).length;
  const invalidDependencyCount = actions.reduce((count, action) => {
    const dependencies = Array.isArray((action as Record<string, unknown>)?.dependencies)
      ? (action as Record<string, unknown>).dependencies
      : Array.isArray((action as Record<string, unknown>)?.dependencyIds)
        ? (action as Record<string, unknown>).dependencyIds
        : [];
    const missingRefs = dependencies
      .map((dep) => String(dep || '').trim())
      .filter(Boolean)
      .filter((dep) => !actionIdSet.has(dep)).length;
    return count + missingRefs;
  }, 0);
  const rowLevelAssumptionCount = new Set(
    [
      ...actions.flatMap((action) =>
        Array.isArray((action as Record<string, unknown>)?.assumptions)
          ? (action as Record<string, unknown>).assumptions
          : [(action as Record<string, unknown>)?.assumption]
      ),
      ...deliverables.flatMap((deliverable) =>
        Array.isArray((deliverable as Record<string, unknown>)?.assumptions)
          ? (deliverable as Record<string, unknown>).assumptions
          : [(deliverable as Record<string, unknown>)?.assumption]
      ),
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ).size;
  const hasBlocks = Boolean(input.hasProposedBlocks || input.hasCommittedBlocks);
  const mappedActionCount = actionIds.filter((actionId) => mappedActionIds.has(actionId)).length;

  const actionTypeCoverage =
    actions.length === 0
      ? 'missing'
      : actionTypeKnownCount === actions.length
        ? 'complete'
        : actionTypeKnownCount > 0
          ? 'partial'
          : 'missing';
  const dependencyReadinessCoverage =
    actions.length <= 1
      ? 'sufficient'
      : dependencyAnnotatedCount > 0
        ? 'sufficient'
        : deliverables.some(
              (deliverable) =>
                Array.isArray(deliverable?.dependencyIds) &&
                deliverable.dependencyIds.some((id) => String(id || '').trim().length > 0)
            )
          ? 'partial'
          : 'missing';
  const lineageIntegrity =
    actionIds.length === 0 || deliverables.length === 0
      ? 'missing'
      : mappedActionCount === actionIds.length
        ? 'complete'
        : mappedActionCount > 0
          ? 'partial'
          : 'missing';
  const inspectability =
    actionIds.length === 0 || deliverables.length === 0
      ? 'missing'
      : hasBlocks
        ? 'strong'
        : lineageIntegrity === 'complete'
          ? 'usable'
          : 'thin';
  const totalAssumptionCount = Number(assumptionCount || 0) + rowLevelAssumptionCount;
  const assumptionBurden = totalAssumptionCount >= 3 ? 'high' : totalAssumptionCount > 0 ? 'moderate' : 'none';

  let structuralState: PlanQualityEvaluation['structuralState'] = 'trusted';
  const structuralReasonCodes: GoalPolicyReasonCode[] = [];

  if (
    !input.hasExecutionGraph ||
    actionIds.length === 0 ||
    deliverables.length === 0 ||
    lineageIntegrity === 'missing'
  ) {
    structuralState = 'withheld';
    structuralReasonCodes.push('PLAN_STRUCTURAL_TRUTH_WITHHELD');
    if (lineageIntegrity !== 'complete') {
      structuralReasonCodes.push('PLAN_LINEAGE_INCOMPLETE');
    }
  } else {
    if (lineageIntegrity !== 'complete') {
      structuralState = 'degraded';
      structuralReasonCodes.push('PLAN_LINEAGE_INCOMPLETE');
    }
    if (actionTypeCoverage === 'missing') {
      structuralState = 'degraded';
      structuralReasonCodes.push('PLAN_ACTION_TYPE_COVERAGE_WEAK');
    } else if (actionTypeCoverage === 'partial' && structuralState === 'trusted') {
      structuralState = 'provisional';
      structuralReasonCodes.push('PLAN_ACTION_TYPE_COVERAGE_WEAK');
    }
    if (dependencyReadinessCoverage === 'missing' && actions.length > 1) {
      structuralState = structuralState === 'trusted' ? 'provisional' : structuralState;
      structuralReasonCodes.push('PLAN_READINESS_METADATA_THIN');
    } else if (dependencyReadinessCoverage === 'partial' && structuralState === 'trusted') {
      structuralState = 'provisional';
      structuralReasonCodes.push('PLAN_READINESS_METADATA_THIN');
    }
    if (invalidDependencyCount > 0) {
      structuralState = 'degraded';
      structuralReasonCodes.push('PLAN_DEPENDENCY_INCOHERENT');
    }
    if (assumptionBurden === 'high') {
      structuralState = 'degraded';
      structuralReasonCodes.push('PLAN_ASSUMPTION_BURDEN_HIGH');
    } else if (assumptionBurden === 'moderate' && structuralState === 'trusted') {
      structuralState = 'provisional';
      structuralReasonCodes.push('PLAN_STARTING_STATE_ASSUMED');
    }
    if (inspectability === 'thin' || inspectability === 'missing') {
      structuralState = structuralState === 'trusted' ? 'provisional' : structuralState;
      structuralReasonCodes.push('PLAN_INSPECTABILITY_THIN');
    }
  }

  return {
    structuralState,
    structuralReasonCodes: uniqueList(structuralReasonCodes) as GoalPolicyReasonCode[],
    actionTypeCoverage,
    dependencyReadinessCoverage,
    assumptionBurden,
    inspectability,
    lineageIntegrity,
  };
}

export function buildGoalPolicySnapshot(input: GoalPolicyInput): GoalPolicySnapshot {
  const intakeContract = input.intakeContract || null;
  const goalId = input.goalId || intakeContract?.goalId || input.executionContract?.goalId || null;
  const intakeReadinessState = intakeContract?.readiness?.state || 'intake_blocked';
  const intakeReasonCodes = uniqueList([
    ...(intakeContract?.readiness?.blockingReasons || []),
    ...(intakeContract?.requiredContextQuestions || []).map((question) => question?.reasonCode),
  ]) as GoalPolicyReasonCode[];
  const assumptions = uniqueList([
    ...(intakeContract?.readiness?.assumptionReasons || []),
    ...(intakeContract?.scopePolicy?.assumptionsNeedingConfirmation || []),
  ]);

  const macroBoundaryPolicy: GoalBoundaryPolicy = {
    required: uniqueList(intakeContract?.scopePolicy?.required || []),
    bounded: uniqueList([
      ...(intakeContract?.scopePolicy?.recommended || []),
      ...(intakeContract?.scopePolicy?.optional || []),
    ]),
    prohibited: uniqueList(intakeContract?.scopePolicy?.excluded || []),
    assumptionsNeedingConfirmation: assumptions,
  };

  const scopeClassification: ScopeClassification = {
    required: uniqueList(intakeContract?.scopePolicy?.required || []),
    recommended: uniqueList(intakeContract?.scopePolicy?.recommended || []),
    optional: uniqueList(intakeContract?.scopePolicy?.optional || []),
    blockedByUnconfirmedContext:
      intakeReadinessState === 'intake_blocked' ? assumptions : uniqueList(intakeContract?.scopePolicy?.excluded || []),
    assumedBaselineSupporting:
      intakeReadinessState === 'assumption_marked_draft'
        ? assumptions
        : hasStartingState(intakeContract)
          ? []
          : assumptions,
  };

  const endpointClarity =
    intakeContract?.completionBoundaryStatus === 'resolved'
      ? 'clear'
      : intakeContract?.completionBoundaryStatus === 'ambiguous'
        ? 'ambiguous'
        : 'missing';
  const startingPointHonesty = hasStartingState(intakeContract)
    ? 'explicit'
    : assumptions.length > 0
      ? 'assumed'
      : 'unknown';
  const hasConcreteOutcomeFlag = Boolean(input.executionContract?.terminalOutcome?.isConcrete);
  const hasVerificationCriteria = Boolean(String(input.executionContract?.terminalOutcome?.verificationCriteria || '').trim());
  const hasTargetMetric = input.intakeContract?.targetCount !== null && Boolean(String(input.intakeContract?.targetUnit || '').trim());
  const hasClearTerminalEndpoint =
    input.intakeContract?.terminalEndpoint?.status === 'clear_explicit' ||
    input.intakeContract?.terminalEndpoint?.status === 'clear_inferred';
  const blockMeasurability =
    hasVerificationCriteria && (hasConcreteOutcomeFlag || hasTargetMetric || hasClearTerminalEndpoint) ? 'clear' : 'weak';
  const planProofFeasibility =
    String(input.planProof?.feasibilityStatus || '')
      .trim()
      .toUpperCase() || null;
  const feasibilityStatus =
    String(input.feasibilityStatus || '')
      .trim()
      .toUpperCase() || null;
  const feasibilityHonesty =
    planProofFeasibility === 'INFEASIBLE'
      ? 'blocked'
      : input.planProof
        ? 'clear'
        : 'degraded';

  const planQualityReasonCodes: GoalPolicyReasonCode[] = [];
  let planQualityState: PlanQualityEvaluation['state'] = 'policy_clean';

  if (intakeReadinessState === 'intake_blocked') {
    planQualityState = 'policy_blocked';
    planQualityReasonCodes.push('INTAKE_CONTEXT_REQUIRED');
  } else {
    if (endpointClarity !== 'clear') {
      planQualityState = 'policy_degraded';
      planQualityReasonCodes.push('INTAKE_CONTEXT_REQUIRED');
    }
    if (startingPointHonesty === 'assumed') {
      planQualityState = planQualityState === 'policy_blocked' ? planQualityState : 'policy_degraded';
      planQualityReasonCodes.push('PLAN_STARTING_STATE_ASSUMED');
    }
    if (scopeClassification.assumedBaselineSupporting.length > 0) {
      planQualityState = planQualityState === 'policy_blocked' ? planQualityState : 'policy_degraded';
      planQualityReasonCodes.push('PLAN_SCOPE_INFLATED');
    }
    if (blockMeasurability === 'weak') {
      planQualityState = planQualityState === 'policy_blocked' ? planQualityState : 'policy_degraded';
      planQualityReasonCodes.push('PLAN_MEASURABILITY_WEAK');
    }
    if (feasibilityHonesty === 'blocked') {
      planQualityState = 'policy_blocked';
      planQualityReasonCodes.push('PLAN_FEASIBILITY_NOT_TRUTHFUL');
    } else if (feasibilityHonesty === 'degraded' && planQualityState === 'policy_clean') {
      planQualityState = 'policy_degraded';
    }
  }

  const structuralQuality = evaluateStructuralPlanQuality(input, assumptions.length);

  const planQuality: PlanQualityEvaluation = {
    state: planQualityState,
    reasonCodes: uniqueList(planQualityReasonCodes) as GoalPolicyReasonCode[],
    structuralState: structuralQuality.structuralState,
    structuralReasonCodes: structuralQuality.structuralReasonCodes,
    endpointClarity,
    startingPointHonesty,
    scopeDiscipline:
      planQualityState === 'policy_blocked'
        ? 'inflated'
        : scopeClassification.assumedBaselineSupporting.length > 0
          ? 'degraded'
          : 'clean',
    blockMeasurability,
    feasibilityHonesty,
    actionTypeCoverage: structuralQuality.actionTypeCoverage,
    dependencyReadinessCoverage: structuralQuality.dependencyReadinessCoverage,
    assumptionBurden: structuralQuality.assumptionBurden,
    inspectability: structuralQuality.inspectability,
    lineageIntegrity: structuralQuality.lineageIntegrity,
  };

  const feasibility = evaluateInitialFeasibility(input, planQuality);

  // Gate failure codes are computed here so livePos post-processing can honour them.
  const gateFailureCodes = Array.isArray(input.planQualityFailureCodes) ? input.planQualityFailureCodes : [];
  const TRUST_WITHHOLDING_GATE_CODES = new Set([
    'OUTCOME_COVERAGE_PREP_ONLY',
    'OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING',
    'OUTCOME_ENDPOINT_MISSING',
    'OUTCOME_SPLIT_DIMENSION_UNCOVERED',
  ]);
  const hasGateWithholdingFailure = gateFailureCodes.some((code) => TRUST_WITHHOLDING_GATE_CODES.has(code));

  const livePosRaw = evaluateLivePosInputs(input, intakeReadinessState, planQuality, feasibility);
  const correctionState = String(input.executionCorrectionState || '').trim().toLowerCase();
  const livePosExtraCodes: GoalPolicyReasonCode[] = [];

  // Explicit gate failures override livePos eligibility — no live score when canonical truth is gated.
  // Note: planQuality.state === 'policy_blocked' (from INFEASIBLE plan) does NOT gate livePos;
  // a plan can be infeasible while execution evidence remains valid and observable.
  const livePosGateWithheld =
    hasGateWithholdingFailure && livePosRaw.state !== 'withheld';

  if (livePosGateWithheld) {
    livePosExtraCodes.push('LIVE_POS_WITHHELD_CANONICAL_TRUTH_THIN');
  } else if (livePosRaw.state !== 'withheld' && correctionState === 'recovery_required') {
    livePosExtraCodes.push('LIVE_POS_CORRECTION_RECOVERY_REQUIRED');
  } else if (livePosRaw.state !== 'withheld' && correctionState === 'adjustment_recommended') {
    livePosExtraCodes.push('LIVE_POS_CORRECTION_ADJUSTMENT_RECOMMENDED');
  }

  const livePos: typeof livePosRaw = livePosGateWithheld
    ? {
        ...livePosRaw,
        state: 'withheld',
        percent: null,
        scoreValue: null,
        range: null,
        reasonCodes: uniqueList([...livePosRaw.reasonCodes, 'LIVE_POS_WITHHELD_CANONICAL_TRUTH_THIN']) as GoalPolicyReasonCode[],
        liveState: 'withheld',
        liveStateReasonCodes: uniqueList([...livePosRaw.liveStateReasonCodes, 'LIVE_POS_WITHHELD_CANONICAL_TRUTH_THIN']) as GoalPolicyReasonCode[],
        score: { ...livePosRaw.score, state: 'withheld', value: null, reasonCodes: ['LIVE_POS_SCORE_WITHHELD'] as GoalPolicyReasonCode[] },
      }
    : livePosExtraCodes.length > 0
      ? {
          ...livePosRaw,
          liveStateReasonCodes: uniqueList([
            ...livePosRaw.liveStateReasonCodes,
            ...livePosExtraCodes,
          ]) as GoalPolicyReasonCode[],
        }
      : livePosRaw;

  const posTrustReasonCodes: GoalPolicyReasonCode[] = [];
  let posTrustState: PosTrustState = 'trusted';

  const substrateLevel = deriveFeasibilitySubstrateLevel(
    {
      planStatus: planQuality.state === 'policy_blocked' ? 'INVALID_VIOLATIONS_PRESENT'
        : planQuality.state === 'policy_degraded' ? 'VALID_WITH_WARNINGS'
        : 'VALID_AND_FULLY_SCHEDULED',
      violationCount: hasGateWithholdingFailure || planQuality.state === 'policy_blocked' ? 1 : 0,
      warningCount: planQuality.state === 'policy_degraded' ? 1 : 0,
    },
    {
      status: hasGateWithholdingFailure ? 'PLAN_QUALITY_WITHHELD' : 'PLAN_QUALITY_PASSED',
    }
  );

  const feasibilityForcedWithheld = !substrateLevel.feasibilityEligible && feasibility.state !== 'withheld';
  const feasibilityFull: FeasibilityEvaluation = feasibilityForcedWithheld
    ? {
        ...feasibility,
        substrateLevel: substrateLevel.level,
        state: 'withheld',
        score: null,
        percent: null,
        range: null,
        summary: substrateLevel.reason,
      }
    : {
        ...feasibility,
        substrateLevel: substrateLevel.level,
        state: feasibility.state,
      };

  if (intakeReadinessState === 'intake_blocked') {
    posTrustState = 'withheld';
    posTrustReasonCodes.push('POS_WITHHELD_UNTIL_ADMISSION');
  } else if (planQuality.state === 'policy_blocked' || hasGateWithholdingFailure) {
    posTrustState = 'withheld';
    posTrustReasonCodes.push('POS_WITHHELD_UNTIL_PLAN_QUALITY');
  } else if (
    planQuality.state === 'policy_degraded' ||
    input.probabilityStatus === 'disabled' ||
    input.probabilityStatus === 'insufficient_evidence' ||
    feasibilityStatus === 'REQUIRED' ||
    !input.hasCommittedBlocks ||
    !input.hasProposedBlocks ||
    !input.hasExecutionGraph
  ) {
    posTrustState = 'provisional';
    posTrustReasonCodes.push('POS_TRUST_PROVISIONAL_PLAN_DEGRADED');
    if (input.probabilityStatus === 'disabled' || input.probabilityStatus === 'insufficient_evidence') {
      posTrustReasonCodes.push('POS_WITHHELD_UNTIL_EVIDENCE');
    }
  } else {
    // Authority ceiling: externally_mediated, market_dependent, and mixed goals cannot reach
    // trusted pre-execution. The terminal event is controlled by a third party or aggregate
    // market behavior; structural plan quality alone cannot guarantee attainability.
    // unknown authority also capped — cannot trust what cannot be characterized.
    const authority = input.outcomeAuthorityClass ?? null;
    if (
      authority === 'externally_mediated' ||
      authority === 'market_dependent' ||
      authority === 'mixed' ||
      authority === 'unknown'
    ) {
      posTrustState = 'provisional';
      posTrustReasonCodes.push('POS_TRUST_PROVISIONAL_AUTHORITY_CEILING');
    }
  }

  const posTrust: PosTrustEvaluation = {
    state: posTrustState,
    reasonCodes: uniqueList(posTrustReasonCodes) as GoalPolicyReasonCode[],
    explanation:
      posTrustState === 'trusted'
        ? 'Policy-clean plan with explicit boundary, measurable outcome, and sufficient evidence.'
        : posTrustState === 'provisional'
          ? 'Plan is admissible but not yet fully trusted; assumptions or evidence are still unresolved.'
          : 'Trust withheld until intake and plan quality are resolved.',
  };

  return {
    goalId,
    macroBoundaryPolicy,
    intakeReadiness: {
      state: intakeReadinessState,
      isReadyForPlanning: Boolean(intakeContract?.readiness?.isReadyForPlanning),
      reasonCodes: intakeReasonCodes,
      assumptions,
    },
    planQuality,
    feasibility: feasibilityFull,
    livePos,
    posTrust,
    scopeClassification,
    evaluatedAtISO: new Date().toISOString(),
  };
}
