/**
 * Recovery Agent
 *
 * Agent 7 in the integration order.
 * Receives failure classification from Agent 6, presents bounded recovery options,
 * collects user selection, produces recovery recommendation that re-enters planning pipeline.
 *
 * Module: 13 (Recovery Recommendation)
 */

import { ERROR_CODES } from './diagnostics.js';
import { FAILURE_CLASSES, SEVERITY_LEVELS, RECOVERY_URGENCY } from './stability-drift-agent.js';

// Re-export for convenience
export { FAILURE_CLASSES, SEVERITY_LEVELS, RECOVERY_URGENCY };

// Recovery options taxonomy
export const RECOVERY_OPTIONS = {
  // Capacity Overcommit
  REDUCE_WEEKLY_HOURS: 'REDUCE_WEEKLY_HOURS',
  EXTEND_DEADLINE: 'EXTEND_DEADLINE',
  REDUCE_SCOPE: 'REDUCE_SCOPE',
  ACKNOWLEDGE_AND_CONTINUE: 'ACKNOWLEDGE_AND_CONTINUE',

  // Schedule Mismatch
  RESCHEDULE_WINDOWS: 'RESCHEDULE_WINDOWS',
  REDISTRIBUTE_BLOCKS: 'REDISTRIBUTE_BLOCKS',

  // Motivation Drift
  REDUCE_SESSION_LENGTH: 'REDUCE_SESSION_LENGTH',
  FRONT_LOAD_QUICK_WINS: 'FRONT_LOAD_QUICK_WINS',
  CLOSE_GOAL: 'CLOSE_GOAL',

  // Dependency Block
  UNBLOCK_DEPENDENCY: 'UNBLOCK_DEPENDENCY',
  BYPASS_DEPENDENCY: 'BYPASS_DEPENDENCY',
  PAUSE_GOAL: 'PAUSE_GOAL',

  // External Disruption
  // (uses EXTEND_DEADLINE, REDUCE_WEEKLY_HOURS, PAUSE_GOAL, ACKNOWLEDGE_AND_CONTINUE)

  // Deadline Compression
  INCREASE_WEEKLY_HOURS: 'INCREASE_WEEKLY_HOURS',
  // (uses EXTEND_DEADLINE, REDUCE_SCOPE, CLOSE_GOAL)

  // Scope Underestimate
  RECALIBRATE_ESTIMATES: 'RECALIBRATE_ESTIMATES'
  // (uses EXTEND_DEADLINE, REDUCE_SCOPE)
};

// Re-planning entry points
export const REPLANNING_ENTRY_POINTS = {
  AGENT_2: 'AGENT_2',
  AGENT_3: 'AGENT_3',
  AGENT_4: 'AGENT_4'
};

// Goal status changes
export const GOAL_STATUS_CHANGES = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED'
};

// Recovery taxonomy by failure class
const RECOVERY_TAXONOMY = {
  CAPACITY_OVERCOMMIT: [
    RECOVERY_OPTIONS.REDUCE_WEEKLY_HOURS,
    RECOVERY_OPTIONS.EXTEND_DEADLINE,
    RECOVERY_OPTIONS.REDUCE_SCOPE,
    RECOVERY_OPTIONS.ACKNOWLEDGE_AND_CONTINUE
  ],
  SCHEDULE_MISMATCH: [
    RECOVERY_OPTIONS.RESCHEDULE_WINDOWS,
    RECOVERY_OPTIONS.REDISTRIBUTE_BLOCKS,
    RECOVERY_OPTIONS.ACKNOWLEDGE_AND_CONTINUE
  ],
  MOTIVATION_DRIFT: [
    RECOVERY_OPTIONS.REDUCE_SESSION_LENGTH,
    RECOVERY_OPTIONS.FRONT_LOAD_QUICK_WINS,
    RECOVERY_OPTIONS.REDUCE_SCOPE,
    RECOVERY_OPTIONS.EXTEND_DEADLINE,
    RECOVERY_OPTIONS.CLOSE_GOAL
  ],
  DEPENDENCY_BLOCK: [
    RECOVERY_OPTIONS.UNBLOCK_DEPENDENCY,
    RECOVERY_OPTIONS.BYPASS_DEPENDENCY,
    RECOVERY_OPTIONS.PAUSE_GOAL
  ],
  EXTERNAL_DISRUPTION: [
    RECOVERY_OPTIONS.EXTEND_DEADLINE,
    RECOVERY_OPTIONS.REDUCE_WEEKLY_HOURS,
    RECOVERY_OPTIONS.PAUSE_GOAL,
    RECOVERY_OPTIONS.ACKNOWLEDGE_AND_CONTINUE
  ],
  DEADLINE_COMPRESSION: [
    RECOVERY_OPTIONS.EXTEND_DEADLINE,
    RECOVERY_OPTIONS.INCREASE_WEEKLY_HOURS,
    RECOVERY_OPTIONS.REDUCE_SCOPE,
    RECOVERY_OPTIONS.CLOSE_GOAL
  ],
  SCOPE_UNDERESTIMATE: [
    RECOVERY_OPTIONS.RECALIBRATE_ESTIMATES,
    RECOVERY_OPTIONS.EXTEND_DEADLINE,
    RECOVERY_OPTIONS.REDUCE_SCOPE
  ]
};

// Confirmation gate requirements
const CONFIRMATION_GATE_OPTIONS = [
  RECOVERY_OPTIONS.REDUCE_SCOPE,
  RECOVERY_OPTIONS.BYPASS_DEPENDENCY,
  RECOVERY_OPTIONS.CLOSE_GOAL,
  RECOVERY_OPTIONS.INCREASE_WEEKLY_HOURS
];

// Re-planning entry point mapping
const REPLANNING_MAPPING = {
  [RECOVERY_OPTIONS.REDUCE_SCOPE]: REPLANNING_ENTRY_POINTS.AGENT_2,
  [RECOVERY_OPTIONS.BYPASS_DEPENDENCY]: REPLANNING_ENTRY_POINTS.AGENT_2,
  [RECOVERY_OPTIONS.RECALIBRATE_ESTIMATES]: REPLANNING_ENTRY_POINTS.AGENT_3,
  [RECOVERY_OPTIONS.EXTEND_DEADLINE]: REPLANNING_ENTRY_POINTS.AGENT_3,
  [RECOVERY_OPTIONS.INCREASE_WEEKLY_HOURS]: REPLANNING_ENTRY_POINTS.AGENT_3,
  [RECOVERY_OPTIONS.REDUCE_WEEKLY_HOURS]: REPLANNING_ENTRY_POINTS.AGENT_4,
  [RECOVERY_OPTIONS.RESCHEDULE_WINDOWS]: REPLANNING_ENTRY_POINTS.AGENT_4,
  [RECOVERY_OPTIONS.REDISTRIBUTE_BLOCKS]: REPLANNING_ENTRY_POINTS.AGENT_4,
  [RECOVERY_OPTIONS.REDUCE_SESSION_LENGTH]: REPLANNING_ENTRY_POINTS.AGENT_4,
  [RECOVERY_OPTIONS.FRONT_LOAD_QUICK_WINS]: REPLANNING_ENTRY_POINTS.AGENT_4,
  [RECOVERY_OPTIONS.UNBLOCK_DEPENDENCY]: REPLANNING_ENTRY_POINTS.AGENT_4
};

// Goal status change mapping
const GOAL_STATUS_MAPPING = {
  [RECOVERY_OPTIONS.PAUSE_GOAL]: GOAL_STATUS_CHANGES.PAUSED,
  [RECOVERY_OPTIONS.CLOSE_GOAL]: GOAL_STATUS_CHANGES.CLOSED
};

// Goal family adjustments
const FAMILY_ADJUSTMENTS = {
  VentureLaunch: {
    [RECOVERY_OPTIONS.CLOSE_GOAL]: {
      extraConfirmation: true,
      reason: 'Financial and strategic implications require explicit acknowledgment'
    }
  },
  SkillAcquisition: {
    [RECOVERY_OPTIONS.REDUCE_SCOPE]: {
      unavailable: true,
      reason: 'Skill acquisition requires complete sequence for retention'
    }
  },
  ProfessionalQualification: {
    [RECOVERY_OPTIONS.EXTEND_DEADLINE]: {
      conditional: true,
      condition: 'examDateType',
      conditionValue: 'TARGET', // Only available if exam date is TARGET, not HARD
      reason: 'Exam date is fixed and cannot be extended'
    }
  },
  PhysicalTraining: {
    [RECOVERY_OPTIONS.PAUSE_GOAL]: {
      warning: true,
      reason: 'Fitness gains may reverse during pause (detraining risk)'
    }
  },
  JobSearchPipeline: {
    [RECOVERY_OPTIONS.PAUSE_GOAL]: {
      warning: true,
      reason: 'Job market conditions may change during pause'
    }
  },
  CreativeProduction: {
    [RECOVERY_OPTIONS.FRONT_LOAD_QUICK_WINS]: {
      prioritized: true,
      reason: 'Creative momentum responds well to small wins'
    }
  },
  BrandLaunch: {
    [RECOVERY_OPTIONS.REDUCE_SCOPE]: {
      warning: true,
      reason: 'Inconsistent publishing harms brand building'
    }
  },
  SalesPipeline: {
    [RECOVERY_OPTIONS.PAUSE_GOAL]: {
      unavailable: true,
      reason: 'Sales pipelines cannot be paused without losing momentum'
    }
  },
  Fundraising: {
    [RECOVERY_OPTIONS.EXTEND_DEADLINE]: {
      warning: true,
      reason: 'Extended timelines can signal weakness to investors'
    }
  }
};

/**
 * Process a recovery recommendation
 * @param {Object} failureClassification - Failure classification from Agent 6
 * @param {string} selectedRecoveryOption - User's selected recovery option
 * @param {boolean} userConfirmed - Whether user passed confirmation gate
 * @returns {Object} Recovery recommendation result
 */
export function processRecoveryRecommendation(failureClassification, selectedRecoveryOption, userConfirmed = null) {
  // Validate eligibility
  if (!failureClassification.recoveryEligible || !failureClassification.handoffToRecoveryAgent) {
    return {
      success: false,
      errorCode: ERROR_CODES.RECOVERY_NOT_ELIGIBLE,
      message: 'Goal is not eligible for recovery processing',
      recoveryRecommendation: null
    };
  }

  // Validate recovery option is in taxonomy for this failure class
  const validOptions = RECOVERY_TAXONOMY[failureClassification.failureClass] || [];
  if (!validOptions.includes(selectedRecoveryOption)) {
    return {
      success: false,
      errorCode: ERROR_CODES.RECOVERY_TAXONOMY_EXCEEDED,
      message: `Recovery option ${selectedRecoveryOption} not valid for failure class ${failureClassification.failureClass}`,
      recoveryRecommendation: null
    };
  }

  // Check confirmation gate for material changes
  const requiresConfirmation = CONFIRMATION_GATE_OPTIONS.includes(selectedRecoveryOption);
  if (requiresConfirmation && userConfirmed !== true) {
    return {
      success: false,
      errorCode: ERROR_CODES.CONFIRMATION_GATE_BYPASSED,
      message: `Material change ${selectedRecoveryOption} requires explicit user confirmation`,
      recoveryRecommendation: null
    };
  }

  // Apply family adjustments
  const familyAdjustment = getFamilyAdjustment(failureClassification.goalFamily, selectedRecoveryOption);
  if (familyAdjustment?.unavailable) {
    return {
      success: false,
      errorCode: ERROR_CODES.RECOVERY_TAXONOMY_EXCEEDED,
      message: familyAdjustment.reason,
      recoveryRecommendation: null
    };
  }

  // Check conditional availability
  if (familyAdjustment?.conditional) {
    const conditionMet = checkConditionalAvailability(familyAdjustment, failureClassification);
    if (!conditionMet) {
      return {
        success: false,
        errorCode: ERROR_CODES.RECOVERY_TAXONOMY_EXCEEDED,
        message: familyAdjustment.reason,
        recoveryRecommendation: null
      };
    }
  }

  // Generate recovery recommendation
  const recommendation = generateRecoveryRecommendation(failureClassification, selectedRecoveryOption, userConfirmed);

  return {
    success: true,
    errorCode: null,
    recoveryRecommendation: recommendation
  };
}

/**
 * Get available recovery options for a failure classification
 * @param {Object} failureClassification - Failure classification from Agent 6
 * @returns {Array} Available recovery options with descriptions
 */
export function getAvailableRecoveryOptions(failureClassification) {
  const failureClass = failureClassification.failureClass;
  const goalFamily = failureClassification.goalFamily;

  const baseOptions = RECOVERY_TAXONOMY[failureClass] || [];

  // Apply family adjustments
  const adjustedOptions = baseOptions.filter(option => {
    const adjustment = getFamilyAdjustment(goalFamily, option);
    return !adjustment?.unavailable;
  });

  // Apply conditional filtering
  const conditionalOptions = adjustedOptions.filter(option => {
    const adjustment = getFamilyAdjustment(goalFamily, option);
    if (!adjustment?.conditional) return true;

    return checkConditionalAvailability(adjustment, failureClassification);
  });

  // Sort with family prioritization
  const prioritizedOptions = conditionalOptions.sort((a, b) => {
    const aPriority = getFamilyAdjustment(goalFamily, a)?.prioritized ? 1 : 0;
    const bPriority = getFamilyAdjustment(goalFamily, b)?.prioritized ? 1 : 0;
    return bPriority - aPriority; // Prioritized options first
  });

  return prioritizedOptions.map(option => ({
    option,
    description: getRecoveryOptionDescription(option),
    requiresConfirmation: CONFIRMATION_GATE_OPTIONS.includes(option),
    familyWarning: getFamilyAdjustment(goalFamily, option)?.warning ? getFamilyAdjustment(goalFamily, option).reason : null,
    extraConfirmation: getFamilyAdjustment(goalFamily, option)?.extraConfirmation ? getFamilyAdjustment(goalFamily, option).reason : null
  }));
}

/**
 * Get recovery option description
 * @param {string} option - Recovery option
 * @returns {string} Description
 */
function getRecoveryOptionDescription(option) {
  const descriptions = {
    [RECOVERY_OPTIONS.REDUCE_WEEKLY_HOURS]: 'Reduce scheduled hours per week to match actual capacity',
    [RECOVERY_OPTIONS.EXTEND_DEADLINE]: 'Keep current hours, extend deadline to accommodate remaining work',
    [RECOVERY_OPTIONS.REDUCE_SCOPE]: 'Remove lower-priority actions from the graph to make goal achievable',
    [RECOVERY_OPTIONS.ACKNOWLEDGE_AND_CONTINUE]: 'User acknowledges the gap and continues with current plan',
    [RECOVERY_OPTIONS.RESCHEDULE_WINDOWS]: 'Update work windows to reflect when user is actually available',
    [RECOVERY_OPTIONS.REDISTRIBUTE_BLOCKS]: 'Keep same total hours, redistribute across different days or times',
    [RECOVERY_OPTIONS.REDUCE_SESSION_LENGTH]: 'Shorten individual block length to reduce friction',
    [RECOVERY_OPTIONS.FRONT_LOAD_QUICK_WINS]: 'Reorder actionable non-dependent tasks to create early momentum',
    [RECOVERY_OPTIONS.CLOSE_GOAL]: 'Formally close the goal with documented reason',
    [RECOVERY_OPTIONS.UNBLOCK_DEPENDENCY]: 'User commits to completing the stalled action — reschedule it immediately',
    [RECOVERY_OPTIONS.BYPASS_DEPENDENCY]: 'User confirms the blocking action is no longer needed — remove from graph',
    [RECOVERY_OPTIONS.PAUSE_GOAL]: 'Formally pause the goal until external block resolves',
    [RECOVERY_OPTIONS.INCREASE_WEEKLY_HOURS]: 'Keep deadline, increase hours per week to close the gap',
    [RECOVERY_OPTIONS.RECALIBRATE_ESTIMATES]: 'Update effort estimates based on actual time per block observed'
  };

  return descriptions[option] || 'Recovery option description not available';
}

/**
 * Get family adjustment for option
 * @param {string} goalFamily - Goal family
 * @param {string} option - Recovery option
 * @returns {Object|null} Family adjustment
 */
function getFamilyAdjustment(goalFamily, option) {
  return FAMILY_ADJUSTMENTS[goalFamily]?.[option] || null;
}

/**
 * Check conditional availability
 * @param {Object} adjustment - Family adjustment
 * @param {Object} failureClassification - Failure classification
 * @returns {boolean} Whether condition is met
 */
function checkConditionalAvailability(adjustment, failureClassification) {
  if (!adjustment.conditional) return true;

  const { condition, conditionValue } = adjustment;
  // For ProfessionalQualification, check exam date type
  if (condition === 'examDateType') {
    // This would come from goal metadata - for now assume it's available
    return failureClassification.examDateType === conditionValue;
  }

  return true;
}

/**
 * Generate recovery recommendation
 * @param {Object} failureClassification - Failure classification
 * @param {string} selectedOption - Selected recovery option
 * @param {boolean|null} userConfirmed - User confirmation status
 * @returns {Object} Recovery recommendation
 */
function generateRecoveryRecommendation(failureClassification, selectedOption, userConfirmed) {
  const recoveryId = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const requiresConfirmation = CONFIRMATION_GATE_OPTIONS.includes(selectedOption);

  const rePlanningRequired = !!REPLANNING_MAPPING[selectedOption];
  const rePlanningEntryPoint = REPLANNING_MAPPING[selectedOption] || null;
  const goalStatusChange = GOAL_STATUS_MAPPING[selectedOption] || null;

  const familyAdjustment = getFamilyAdjustment(failureClassification.goalFamily, selectedOption);

  return {
    goalId: failureClassification.goalId,
    cycleId: failureClassification.cycleId,
    recoveryId,
    recommendationTimestamp: new Date().toISOString(),
    failureClassReceived: failureClassification.failureClass,
    recoveryOptionSelected: selectedOption,
    recoveryOptionDescription: getRecoveryOptionDescription(selectedOption),
    requiresConfirmationGate: requiresConfirmation,
    confirmationGateReason: requiresConfirmation ? getConfirmationReason(selectedOption) : null,
    userConfirmed,
    rePlanningRequired,
    rePlanningEntryPoint,
    rePlanningPayload: rePlanningRequired ? generateRePlanningPayload(selectedOption, failureClassification) : null,
    goalStatusChange,
    recommendationClass: getRecommendationClass(selectedOption),
    rationale: generateRationale(failureClassification, selectedOption, familyAdjustment),
    errorCode: null
  };
}

/**
 * Get confirmation reason for material changes
 * @param {string} option - Recovery option
 * @returns {string} Confirmation reason
 */
function getConfirmationReason(option) {
  const reasons = {
    [RECOVERY_OPTIONS.REDUCE_SCOPE]: 'Removes actions from the canonical graph — irreversible without full restart',
    [RECOVERY_OPTIONS.BYPASS_DEPENDENCY]: 'Modifies dependency structure — changes what the system will schedule',
    [RECOVERY_OPTIONS.CLOSE_GOAL]: 'Permanently closes the goal with no automatic re-entry path',
    [RECOVERY_OPTIONS.INCREASE_WEEKLY_HOURS]: 'Material commitment increase — user must explicitly accept'
  };

  return reasons[option] || 'Material change requires explicit confirmation';
}

/**
 * Generate re-planning payload
 * @param {string} option - Recovery option
 * @param {Object} failureClassification - Failure classification
 * @returns {Object} Re-planning payload
 */
function generateRePlanningPayload(option, failureClassification) {
  // This would generate specific payloads for each agent entry point
  // For now, return a basic structure
  return {
    recoveryOption: option,
    failureClass: failureClassification.failureClass,
    goalFamily: failureClassification.goalFamily,
    // Additional context would be added based on the specific option
  };
}

/**
 * Get recommendation class
 * @param {string} option - Recovery option
 * @returns {string} Recommendation class
 */
function getRecommendationClass(option) {
  if (GOAL_STATUS_MAPPING[option]) {
    return 'STATUS_CHANGE';
  }
  if (REPLANNING_MAPPING[option]) {
    return 'REPLANNING';
  }
  return 'ACKNOWLEDGMENT';
}

/**
 * Generate rationale for recommendation
 * @param {Object} failureClassification - Failure classification
 * @param {string} option - Recovery option
 * @param {Object|null} familyAdjustment - Family adjustment
 * @returns {Array} Rationale statements
 */
function generateRationale(failureClassification, option, familyAdjustment) {
  const rationale = [
    `Selected ${option} for ${failureClassification.failureClass} failure`,
    `Addresses ${failureClassification.driftPatternsConsumed.join(', ')} drift patterns`
  ];

  if (familyAdjustment?.warning) {
    rationale.push(`Family consideration: ${familyAdjustment.reason}`);
  }

  if (familyAdjustment?.extraConfirmation) {
    rationale.push(`Extra confirmation required: ${familyAdjustment.reason}`);
  }

  return rationale;
}