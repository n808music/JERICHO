import type {
  DriftSignal,
  FailureClassCode,
  FailureClassResult,
  RecoveryContextState,
  RecoveryLeverCode,
  RecoveryPlanState,
  RecoveryRecommendation,
} from './recoveryTypes';
import { requiresRecoveryConfirmation } from './recoveryConfirmationPolicy';

function parseLane(laneKey: string): { archetype: string; subtype: string } {
  const [archetype = '', subtype = ''] = String(laneKey || '').split('::');
  return { archetype, subtype };
}

function baseLeversForFailure(failure: FailureClassCode): RecoveryLeverCode[] {
  switch (failure) {
    case 'SCOPE_OVERLOAD':
      return ['REDUCE_SCOPE', 'SPLIT_OUTPUT', 'SHIFT_SCHEDULE_DENSITY'];
    case 'CAPACITY_MISMATCH':
      return ['SHIFT_SCHEDULE_DENSITY', 'ADD_BUFFER', 'SUBSTITUTE_LIGHTER_ACTION'];
    case 'SEQUENCING_FAILURE':
      return ['REORDER_DEPENDENCIES', 'ADD_BUFFER'];
    case 'READINESS_GAP':
      return ['INCREASE_REMEDIATION', 'SHIFT_SCHEDULE_DENSITY'];
    case 'QUALITY_GAP':
      return ['INCREASE_REMEDIATION', 'SPLIT_OUTPUT'];
    case 'RESOURCE_GAP':
      return ['ESCALATE_CONTEXT', 'REORDER_DEPENDENCIES'];
    case 'CONSISTENCY_FAILURE':
      return ['SHIFT_SCHEDULE_DENSITY', 'SUBSTITUTE_LIGHTER_ACTION'];
    case 'CONVERSION_FAILURE':
      return ['INCREASE_REMEDIATION', 'REORDER_DEPENDENCIES'];
    case 'RECOVERY_SAFETY_FAILURE':
      return ['SUBSTITUTE_LIGHTER_ACTION', 'SHIFT_SCHEDULE_DENSITY', 'CHANGE_TARGET_THRESHOLD'];
    case 'UNCLEAR_SUCCESS_DEFINITION':
      return ['ESCALATE_CONTEXT', 'PAUSE_FOR_CONFIRMATION'];
    default:
      return ['PAUSE_FOR_CONFIRMATION'];
  }
}

function laneSpecificAdjustment(
  laneKey: string,
  primaryFailureClass: FailureClassCode
): {
  issueDetected: string;
  proposedAdjustment: string;
  tradeoff: string;
  extraLevers: RecoveryLeverCode[];
  affectsSuccessDefinition?: boolean;
  affectsDeadline?: boolean;
  affectsTargetThreshold?: boolean;
} {
  const { archetype, subtype } = parseLane(laneKey);

  if (archetype === 'ProfessionalQualification') {
    return {
      issueDetected: 'Readiness and exam-trajectory drift detected.',
      proposedAdjustment:
        'Reallocate study toward weak domains, increase timed practice cadence, and add a focused remediation block before final review.',
      tradeoff: 'Breadth is reduced to improve readiness reliability.',
      extraLevers: ['INCREASE_REMEDIATION', 'SHIFT_SCHEDULE_DENSITY'],
      affectsDeadline: primaryFailureClass === 'CAPACITY_MISMATCH',
    };
  }

  if (archetype === 'PhysicalTraining' && subtype === 'Rehab Return to Training') {
    return {
      issueDetected: 'Progression tolerance and readiness drift detected.',
      proposedAdjustment:
        'Regress to prior rehab milestone, reduce progression speed, and insert symptom checkpoints before return-to-training blocks.',
      tradeoff: 'Timeline speed decreases to preserve safe progression.',
      extraLevers: ['SUBSTITUTE_LIGHTER_ACTION', 'ADD_BUFFER'],
      affectsTargetThreshold: primaryFailureClass === 'RECOVERY_SAFETY_FAILURE',
    };
  }

  if (archetype === 'JobSearchPipeline') {
    return {
      issueDetected: 'Pipeline conversion drift detected.',
      proposedAdjustment:
        'Tighten target list fit, revise core materials, and rebalance toward quality-first outreach before increasing weekly volume.',
      tradeoff: 'Short-term throughput may drop while response quality improves.',
      extraLevers: ['REORDER_DEPENDENCIES'],
    };
  }

  if (archetype === 'CreativeProduction' && subtype === 'Podcast Production') {
    return {
      issueDetected: 'Production scope and schedule drift detected.',
      proposedAdjustment:
        'Reduce launch batch to trailer plus first episode, simplify production format, and separate setup recovery from recording blocks.',
      tradeoff: 'Initial launch breadth narrows to preserve completion certainty.',
      extraLevers: ['REDUCE_SCOPE', 'SPLIT_OUTPUT'],
      affectsSuccessDefinition: true,
    };
  }

  if (archetype === 'Fundraising') {
    return {
      issueDetected: 'Fundraising conversion and readiness drift detected.',
      proposedAdjustment:
        'Tighten target-funder fit, sharpen narrative/deck materials, and add structured follow-up progression checkpoints.',
      tradeoff: 'Pipeline breadth narrows while fit and progression quality improve.',
      extraLevers: ['INCREASE_REMEDIATION', 'REORDER_DEPENDENCIES'],
    };
  }

  if (archetype === 'VentureLaunch') {
    return {
      issueDetected: 'Launch sequencing drift detected.',
      proposedAdjustment:
        'Protect core launch outputs, move optional assets after readiness checkpoints, and split critical outputs into core vs optional tracks.',
      tradeoff: 'Non-critical polish work is delayed to protect readiness.',
      extraLevers: ['SPLIT_OUTPUT', 'REORDER_DEPENDENCIES'],
      affectsSuccessDefinition: primaryFailureClass === 'SCOPE_OVERLOAD',
    };
  }

  if (archetype === 'BrandLaunch') {
    return {
      issueDetected: 'Brand scope and messaging coherence drift detected.',
      proposedAdjustment:
        'Reduce channel and asset spread, lock core positioning first, and prioritize essential launch touchpoints.',
      tradeoff: 'Launch surface narrows to improve coherence and execution quality.',
      extraLevers: ['REDUCE_SCOPE', 'REORDER_DEPENDENCIES'],
      affectsSuccessDefinition: primaryFailureClass === 'SCOPE_OVERLOAD',
    };
  }

  if (archetype === 'SalesPipeline') {
    return {
      issueDetected: 'Sales conversion pipeline drift detected.',
      proposedAdjustment:
        'Refine ICP and messaging, strengthen qualification flow, and sequence outreach volume behind conversion-path fixes.',
      tradeoff: 'Initial volume focus shifts to conversion quality and fit.',
      extraLevers: ['REORDER_DEPENDENCIES', 'INCREASE_REMEDIATION'],
    };
  }

  if (archetype === 'SkillAcquisition') {
    return {
      issueDetected: 'Skill progression and output completion drift detected.',
      proposedAdjustment:
        'Reduce output scope, increase targeted remediation, and rebalance schedule toward guided build/practice sessions.',
      tradeoff: 'Output count may decrease while completion fidelity increases.',
      extraLevers: ['REDUCE_SCOPE', 'INCREASE_REMEDIATION'],
      affectsSuccessDefinition: primaryFailureClass === 'SCOPE_OVERLOAD',
    };
  }

  return {
    issueDetected: 'Execution drift detected.',
    proposedAdjustment:
      'Reorder dependencies, add a buffer checkpoint, and rebalance schedule density around critical outputs.',
    tradeoff: 'Timeline efficiency is traded for reliability and clarity.',
    extraLevers: ['REORDER_DEPENDENCIES', 'ADD_BUFFER'],
  };
}

function dedupeLevers(levers: RecoveryLeverCode[]): RecoveryLeverCode[] {
  return Array.from(new Set(levers));
}

export function generateRecoveryRecommendation({
  laneKey,
  driftSignals,
  failureClasses,
  contextState = {},
}: {
  laneKey: string;
  driftSignals: DriftSignal[];
  failureClasses: FailureClassResult[];
  contextState?: RecoveryContextState;
  planState?: RecoveryPlanState;
}): RecoveryRecommendation {
  const primary = failureClasses[0]?.code || 'UNCLEAR_SUCCESS_DEFINITION';
  const laneSpecific = laneSpecificAdjustment(laneKey, primary);
  const baseLevers = baseLeversForFailure(primary);
  const recoveryLevers = dedupeLevers([...baseLevers, ...laneSpecific.extraLevers]);

  const insufficientContext = (contextState.missingRequiredAnswers || []).length > 0;
  const confirmation = requiresRecoveryConfirmation({
    laneKey,
    recoveryLevers,
    proposedAdjustment: laneSpecific.proposedAdjustment,
    affectsSuccessDefinition: Boolean(laneSpecific.affectsSuccessDefinition),
    affectsDeadline: Boolean(laneSpecific.affectsDeadline),
    affectsTargetThreshold: Boolean(laneSpecific.affectsTargetThreshold),
    insufficientContext,
  });

  const escalatedContextQuestions = insufficientContext
    ? (contextState.missingRequiredAnswers || []).slice(0, 3)
    : undefined;

  const signalSummary = driftSignals.map((signal) => signal.code).join(', ') || 'NO_SIGNALS';

  return {
    laneKey,
    issueDetected: `${laneSpecific.issueDetected} Signals: ${signalSummary}`,
    primaryFailureClass: primary,
    recoveryLevers,
    proposedAdjustment: laneSpecific.proposedAdjustment,
    tradeoff: laneSpecific.tradeoff,
    confirmationRequired: confirmation.confirmationRequired,
    confirmationReason: confirmation.reason,
    escalatedContextQuestions,
  };
}
