import { detectDriftSignals } from './driftSignalDetector';
import { mapFailureClasses } from './failureClassMapper';
import { generateRecoveryRecommendation } from './recoveryRecommendationEngine';
import type {
  DriftDetectionInput,
  FailureClassCode,
  RecoveryContextState,
  RecoveryExecutionState,
  RecoveryPlanState,
  StabilityRecoveryPayload,
} from './recoveryTypes';

export function buildStabilityRecoveryPayload({
  laneKey,
  archetype,
  subtype,
  planState,
  executionState,
  scheduleState,
  contextState,
}: {
  laneKey: string;
  archetype: string;
  subtype: string;
  planState?: RecoveryPlanState;
  executionState?: RecoveryExecutionState;
  scheduleState?: DriftDetectionInput['scheduleState'];
  contextState?: RecoveryContextState;
}): StabilityRecoveryPayload {
  const driftSignals = detectDriftSignals({
    laneKey,
    archetype,
    subtype,
    planState,
    executionState,
    scheduleState,
    contextState,
  });

  const failureClasses = mapFailureClasses({
    laneKey,
    archetype,
    subtype,
    driftSignals,
    planState,
    contextState,
  });

  if (driftSignals.length === 0) {
    return {
      laneKey,
      signalCount: 0,
      driftSignals: [],
      primaryFailureClass: null,
      recommendation: {
        issueDetected: 'No recovery drift detected for current lane state.',
        proposedAdjustment: 'No adjustment required.',
        tradeoff: 'None.',
        confirmationRequired: false,
      },
      recoveryIntegrity: {
        usedLaneSpecificRules: true,
        insufficientContext: false,
        fallbackUsed: false,
      },
    };
  }

  const recommendation = generateRecoveryRecommendation({
    laneKey,
    driftSignals,
    failureClasses,
    contextState,
    planState,
  });

  return {
    laneKey,
    signalCount: driftSignals.length,
    driftSignals,
    primaryFailureClass: (failureClasses[0]?.code || recommendation.primaryFailureClass) as FailureClassCode,
    recommendation: {
      issueDetected: recommendation.issueDetected,
      proposedAdjustment: recommendation.proposedAdjustment,
      tradeoff: recommendation.tradeoff,
      confirmationRequired: recommendation.confirmationRequired,
    },
    recoveryIntegrity: {
      usedLaneSpecificRules: true,
      insufficientContext: (contextState?.missingRequiredAnswers || []).length > 0,
      fallbackUsed: false,
    },
  };
}
