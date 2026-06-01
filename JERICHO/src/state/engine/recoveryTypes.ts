export type DriftSignalCode =
  | 'MISSED_SESSIONS'
  | 'OUTPUT_DELAY'
  | 'LOW_READINESS'
  | 'LOW_THROUGHPUT'
  | 'QUALITY_FAILURE'
  | 'DEPENDENCY_BLOCK'
  | 'CAPACITY_OVERRUN'
  | 'LOW_ADHERENCE'
  | 'RESOURCE_GAP'
  | 'EXTERNAL_TIMING_DISRUPTION';

export type FailureClassCode =
  | 'SCOPE_OVERLOAD'
  | 'CAPACITY_MISMATCH'
  | 'SEQUENCING_FAILURE'
  | 'READINESS_GAP'
  | 'QUALITY_GAP'
  | 'RESOURCE_GAP'
  | 'CONSISTENCY_FAILURE'
  | 'CONVERSION_FAILURE'
  | 'RECOVERY_SAFETY_FAILURE'
  | 'UNCLEAR_SUCCESS_DEFINITION';

export type RecoveryLeverCode =
  | 'REDUCE_SCOPE'
  | 'REORDER_DEPENDENCIES'
  | 'INCREASE_REMEDIATION'
  | 'SHIFT_SCHEDULE_DENSITY'
  | 'ADD_BUFFER'
  | 'SPLIT_OUTPUT'
  | 'SUBSTITUTE_LIGHTER_ACTION'
  | 'ESCALATE_CONTEXT'
  | 'CHANGE_TARGET_THRESHOLD'
  | 'PAUSE_FOR_CONFIRMATION';

export type DriftSignal = {
  code: DriftSignalCode;
  severity: 'warning' | 'critical';
  evidence: Record<string, unknown>;
  laneKey: string;
};

export type FailureClassResult = {
  code: FailureClassCode;
  confidence: 'high' | 'medium';
  basedOn: DriftSignalCode[];
};

export type RecoveryRecommendation = {
  laneKey: string;
  issueDetected: string;
  primaryFailureClass: FailureClassCode;
  recoveryLevers: RecoveryLeverCode[];
  proposedAdjustment: string;
  tradeoff: string;
  confirmationRequired: boolean;
  confirmationReason?: string;
  escalatedContextQuestions?: string[];
};

export type RecoveryContextState = {
  missingRequiredAnswers?: string[];
  successDefinitionClear?: boolean;
  assumptionsApplied?: string[];
  painOrSafetyRisk?: boolean;
};

export type RecoveryPlanState = {
  plannedOutputs?: number;
  completedOutputs?: number;
  blockedDependencies?: number;
  setupOutputsIncomplete?: number;
  requiredWeeklySessions?: number;
  availableWeeklySessions?: number;
};

export type RecoveryExecutionState = {
  plannedSessions?: number;
  completedSessions?: number;
  missedSessions?: number;
  adherenceRate?: number;
  readinessScore?: number;
  benchmarkPassed?: boolean;
  throughputActual?: number;
  throughputExpected?: number;
  qualityScore?: number;
  qualityFailures?: number;
  dependencyBlocked?: boolean;
  resourceGap?: boolean;
  externalTimingDisruption?: boolean;
};

export type DriftDetectionInput = {
  laneKey: string;
  archetype: string;
  subtype: string;
  planState?: RecoveryPlanState;
  executionState?: RecoveryExecutionState;
  scheduleState?: {
    unplacedSessions?: number;
    requiredWeeklySessions?: number;
    availableWeeklySessions?: number;
  };
  contextState?: RecoveryContextState;
};

export type StabilityRecoveryPayload = {
  laneKey: string;
  signalCount: number;
  driftSignals: DriftSignal[];
  primaryFailureClass: FailureClassCode | null;
  recommendation: {
    issueDetected: string;
    proposedAdjustment: string;
    tradeoff: string;
    confirmationRequired: boolean;
  };
  recoveryIntegrity: {
    usedLaneSpecificRules: boolean;
    insufficientContext: boolean;
    fallbackUsed: boolean;
  };
};
