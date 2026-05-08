import type { RecoveryLeverCode } from './recoveryTypes';

export function requiresRecoveryConfirmation({
  recoveryLevers,
  affectsSuccessDefinition = false,
  affectsDeadline = false,
  affectsTargetThreshold = false,
  insufficientContext = false,
}: {
  laneKey: string;
  recoveryLevers: RecoveryLeverCode[];
  proposedAdjustment: string;
  affectsSuccessDefinition?: boolean;
  affectsDeadline?: boolean;
  affectsTargetThreshold?: boolean;
  insufficientContext?: boolean;
}): { confirmationRequired: boolean; reason?: string } {
  if (insufficientContext || recoveryLevers.includes('ESCALATE_CONTEXT')) {
    return {
      confirmationRequired: true,
      reason: 'Missing required context before safe recovery adjustment.',
    };
  }

  if (affectsSuccessDefinition || recoveryLevers.includes('PAUSE_FOR_CONFIRMATION')) {
    return {
      confirmationRequired: true,
      reason: 'Recovery adjustment changes success meaning or scope.',
    };
  }

  if (affectsDeadline) {
    return {
      confirmationRequired: true,
      reason: 'Recovery adjustment changes deadline expectation.',
    };
  }

  if (affectsTargetThreshold || recoveryLevers.includes('CHANGE_TARGET_THRESHOLD')) {
    return {
      confirmationRequired: true,
      reason: 'Recovery adjustment changes target threshold materially.',
    };
  }

  return { confirmationRequired: false };
}
