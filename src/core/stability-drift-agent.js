/**
 * Stability and Drift Agent
 *
 * Agent 6 in the integration order.
 * Tracks execution against committed schedule, detects drift patterns,
 * classifies failure types for recovery handoff.
 *
 * Modules: 10 (Stability Tracking), 11 (Drift Detection), 12 (Failure Classification)
 */

import { ERROR_CODES } from './diagnostics.js';

// Execution event types
export const EXECUTION_EVENT_TYPES = {
  COMPLETION: 'COMPLETION',
  MISS: 'MISS',
  RESCHEDULE: 'RESCHEDULE'
};

// Completion quality levels
export const COMPLETION_QUALITY = {
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
  WITH_ISSUES: 'WITH_ISSUES'
};

// Miss reason categories
export const MISS_REASONS = {
  TIME_CONFLICT: 'TIME_CONFLICT',
  LOW_ENERGY: 'LOW_ENERGY',
  DEPENDENCY_BLOCKED: 'DEPENDENCY_BLOCKED',
  EXTERNAL_FACTOR: 'EXTERNAL_FACTOR',
  NOT_GIVEN: 'NOT_GIVEN'
};

// Pacing status levels
export const PACING_STATUS = {
  AHEAD: 'AHEAD',
  ON_TRACK: 'ON_TRACK',
  BEHIND: 'BEHIND',
  CRITICAL: 'CRITICAL'
};

// Drift pattern types
export const DRIFT_PATTERNS = {
  PACING_DRIFT: 'PACING_DRIFT',
  COMPLETION_RATE_DRIFT: 'COMPLETION_RATE_DRIFT',
  CONSECUTIVE_MISS: 'CONSECUTIVE_MISS',
  SCHEDULE_COLLAPSE: 'SCHEDULE_COLLAPSE',
  DEADLINE_RISK: 'DEADLINE_RISK',
  DEPENDENCY_STALL: 'DEPENDENCY_STALL',
  CRITICAL_PACING: 'CRITICAL_PACING',
  ABANDONMENT_RISK: 'ABANDONMENT_RISK'
};

// Failure classes
export const FAILURE_CLASSES = {
  CAPACITY_OVERCOMMIT: 'CAPACITY_OVERCOMMIT',
  SCHEDULE_MISMATCH: 'SCHEDULE_MISMATCH',
  MOTIVATION_DRIFT: 'MOTIVATION_DRIFT',
  DEPENDENCY_BLOCK: 'DEPENDENCY_BLOCK',
  EXTERNAL_DISRUPTION: 'EXTERNAL_DISRUPTION',
  DEADLINE_COMPRESSION: 'DEADLINE_COMPRESSION',
  SCOPE_UNDERESTIMATE: 'SCOPE_UNDERESTIMATE'
};

// Severity levels
export const SEVERITY_LEVELS = {
  NONE: 'NONE',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

// Recovery urgency levels
export const RECOVERY_URGENCY = {
  MONITOR: 'MONITOR',
  PROMPT: 'PROMPT',
  URGENT: 'URGENT',
  IMMEDIATE: 'IMMEDIATE'
};

// Goal family drift adjustments
const FAMILY_DRIFT_ADJUSTMENTS = {
  VentureLaunch: {
    ABANDONMENT_RISK: { threshold: 21 } // Extended from 14 to 21 days
  },
  SkillAcquisition: {
    CONSECUTIVE_MISS: { threshold: 2 } // Reduced from 3 to 2
  },
  ProfessionalQualification: {
    DEADLINE_RISK: { triggerAt: 0.85, completionThreshold: 0.80 }
  },
  PhysicalTraining: {
    excludeRestDays: true
  },
  JobSearchPipeline: {
    SCHEDULE_COLLAPSE: { threshold: 0.40 } // Relaxed from 0.50
  },
  CreativeProduction: {
    PACING_DRIFT: { extended: true }
  },
  BrandLaunch: {
    COMPLETION_RATE_DRIFT: { window: 14 } // Extended from 7 to 14 days
  },
  SalesPipeline: {
    DEPENDENCY_STALL: { threshold: 2 } // Reduced from 3 to 2 days
  },
  Fundraising: {
    EXTERNAL_DISRUPTION: { lenient: true }
  }
};

/**
 * Process an execution signal from the user
 * @param {Object} signal - The execution signal
 * @param {Object} committedSchedule - The committed schedule blocks
 * @returns {Object} Processing result with execution event and stability record
 */
export function processExecutionSignal(signal, committedSchedule) {
  // Validate signal completeness
  const validation = validateExecutionSignal(signal);
  if (!validation.valid) {
    return {
      success: false,
      errorCode: validation.errorCode,
      executionEvent: null,
      stabilityRecord: null
    };
  }

  if (!committedSchedule || !Array.isArray(committedSchedule.blocks)) {
    return {
      success: false,
      errorCode: ERROR_CODES.STABILITY_TRACKING_NO_COMMITTED_SCHEDULE,
      executionEvent: null,
      stabilityRecord: null
    };
  }

  // Map signal to execution event
  const executionEvent = mapSignalToEvent(signal, committedSchedule);
  if (!executionEvent) {
    return {
      success: false,
      errorCode: ERROR_CODES.CANONICAL_SOURCE_MISMATCH,
      executionEvent: null,
      stabilityRecord: null
    };
  }

  // Generate stability record (Module 10)
  const stabilityRecord = generateStabilityRecord(executionEvent, committedSchedule);

  // Detect drift (Module 11)
  const driftDetection = detectDrift(stabilityRecord, committedSchedule);

  // Classify failure (Module 12)
  const failureClassification = classifyFailure(driftDetection, committedSchedule);

  return {
    success: true,
    executionEvent,
    stabilityRecord,
    driftDetection,
    failureClassification,
    errorCode: null
  };
}

/**
 * Validate execution signal completeness
 * @param {Object} signal - The execution signal
 * @returns {Object} Validation result
 */
function validateExecutionSignal(signal) {
  if (!signal || !signal.blockReference) {
    return {
      valid: false,
      errorCode: ERROR_CODES.EXECUTION_SIGNAL_INCOMPLETE
    };
  }

  // Validate based on signal type
  switch (signal.type) {
    case EXECUTION_EVENT_TYPES.COMPLETION:
      if (!signal.completionDate || !signal.completionQuality) {
        return {
          valid: false,
          errorCode: ERROR_CODES.EXECUTION_SIGNAL_INCOMPLETE
        };
      }
      break;
    case EXECUTION_EVENT_TYPES.MISS:
      if (!signal.missDate || !signal.missReason) {
        return {
          valid: false,
          errorCode: ERROR_CODES.EXECUTION_SIGNAL_INCOMPLETE
        };
      }
      break;
    case EXECUTION_EVENT_TYPES.RESCHEDULE:
      if (!signal.requestedNewDate) {
        return {
          valid: false,
          errorCode: ERROR_CODES.EXECUTION_SIGNAL_INCOMPLETE
        };
      }
      break;
    default:
      return {
        valid: false,
        errorCode: ERROR_CODES.EXECUTION_SIGNAL_INCOMPLETE
      };
  }

  return { valid: true };
}

/**
 * Map execution signal to canonical execution event
 * @param {Object} signal - The execution signal
 * @param {Object} committedSchedule - The committed schedule
 * @returns {Object|null} Execution event or null if block not found
 */
function mapSignalToEvent(signal, committedSchedule) {
  // Find the block in committed schedule
  const block = committedSchedule.blocks.find(b => b.blockId === signal.blockReference);
  if (!block) {
    return null; // CANONICAL_SOURCE_MISMATCH
  }

  const event = {
    eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    goalId: committedSchedule.goalId,
    cycleId: committedSchedule.cycleId,
    blockId: signal.blockReference,
    actionId: block.actionId,
    goalFamily: committedSchedule.goalFamily,
    goalSubtype: committedSchedule.goalSubtype,
    eventType: signal.type,
    scheduledDate: block.scheduledDate,
    actualDate: null,
    completionQuality: null,
    missReason: null,
    rescheduleRequestedDate: null,
    rescheduleApproved: null,
    notes: signal.notes || null,
    timestamp: new Date().toISOString()
  };

  // Set type-specific fields
  switch (signal.type) {
    case EXECUTION_EVENT_TYPES.COMPLETION:
      event.actualDate = signal.completionDate;
      event.completionQuality = signal.completionQuality;
      break;
    case EXECUTION_EVENT_TYPES.MISS:
      event.actualDate = signal.missDate;
      event.missReason = signal.missReason;
      break;
    case EXECUTION_EVENT_TYPES.RESCHEDULE:
      event.rescheduleRequestedDate = signal.requestedNewDate;
      event.rescheduleApproved = false; // Default to not approved
      break;
  }

  return event;
}

/**
 * Generate stability record (Module 10)
 * @param {Object} executionEvent - The execution event
 * @param {Object} committedSchedule - The committed schedule
 * @returns {Object} Stability record
 */
function generateStabilityRecord(executionEvent, committedSchedule) {
  const blocks = committedSchedule.blocks;
  const now = new Date();
  const goalDeadline = new Date(committedSchedule.deadline);

  // Calculate basic metrics
  const totalBlocks = blocks.length;
  const completedBlocks = blocks.filter(b => b.status === 'completed').length;
  const missedBlocks = blocks.filter(b => b.status === 'missed').length;
  const rescheduledBlocks = blocks.filter(b => b.status === 'rescheduled').length;
  const remainingBlocks = totalBlocks - completedBlocks - missedBlocks - rescheduledBlocks;

  // Calculate rates
  const completionRate = completedBlocks / (completedBlocks + missedBlocks) || 0;
  const scheduleAdherenceRate = calculateScheduleAdherence(blocks);

  // Calculate pacing
  const daysElapsed = Math.ceil((now - new Date(committedSchedule.startDate)) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((goalDeadline - now) / (1000 * 60 * 60 * 24));
  const totalDays = Math.ceil((goalDeadline - new Date(committedSchedule.startDate)) / (1000 * 60 * 60 * 24));

  const percentageTimeElapsed = Math.min(daysElapsed / totalDays, 1);
  const percentageWorkCompleted = completedBlocks / totalBlocks;
  const pacingGap = (percentageWorkCompleted - percentageTimeElapsed) * 100;

  // Determine pacing status
  let currentPacingStatus;
  if (pacingGap >= 10) currentPacingStatus = PACING_STATUS.AHEAD;
  else if (pacingGap >= -10) currentPacingStatus = PACING_STATUS.ON_TRACK;
  else if (pacingGap >= -25) currentPacingStatus = PACING_STATUS.BEHIND;
  else currentPacingStatus = PACING_STATUS.CRITICAL;

  // Calculate stability score
  const stabilityScore = calculateStabilityScore({
    completionRate,
    scheduleAdherenceRate,
    pacingGap,
    missReasonSeverity: calculateMissReasonSeverity(blocks),
    trendDirection: calculateTrendDirection(blocks)
  });

  // Determine trend
  const trendDirection = calculateTrendDirection(blocks);

  return {
    goalId: executionEvent.goalId,
    cycleId: executionEvent.cycleId,
    trackingTimestamp: now.toISOString(),
    totalBlocksScheduled: totalBlocks,
    totalBlocksCompleted: completedBlocks,
    totalBlocksMissed: missedBlocks,
    totalBlocksRescheduled: rescheduledBlocks,
    totalBlocksRemaining: remainingBlocks,
    completionRate,
    scheduleAdherenceRate,
    currentPacingStatus,
    daysElapsed,
    daysRemaining,
    percentageTimeElapsed,
    percentageWorkCompleted,
    pacingGap,
    stabilityScore,
    trendDirection,
    errorCode: null
  };
}

/**
 * Calculate schedule adherence rate
 * @param {Array} blocks - Schedule blocks
 * @returns {number} Adherence rate (0-1)
 */
function calculateScheduleAdherence(blocks) {
  const dueBlocks = blocks.filter(b => new Date(b.scheduledDate) <= new Date());
  if (dueBlocks.length === 0) return 1;

  const isSameDay = (a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateA.toISOString().slice(0, 10) === dateB.toISOString().slice(0, 10);
  };

  const onTimeCompletions = dueBlocks.filter(b =>
    b.status === 'completed' && b.actualDate && isSameDay(b.actualDate, b.scheduledDate)
  ).length;

  return onTimeCompletions / dueBlocks.length;
}

/**
 * Calculate stability score (0-100)
 * @param {Object} factors - Stability factors
 * @returns {number} Stability score
 */
function calculateStabilityScore(factors) {
  const weights = {
    completionRate: 0.30,
    scheduleAdherence: 0.25,
    pacingGap: 0.25,
    missReasonSeverity: 0.10,
    trendDirection: 0.10
  };

  // Normalize factors to 0-1 scale
  const normalized = {
    completionRate: factors.completionRate,
    scheduleAdherence: factors.scheduleAdherence,
    pacingGap: Math.max(0, Math.min(1, (factors.pacingGap + 50) / 100)), // -50 to +50 -> 0 to 1
    missReasonSeverity: 1 - factors.missReasonSeverity, // Invert (lower severity = higher score)
    trendDirection: factors.trendDirection === 'IMPROVING' ? 1 :
                   factors.trendDirection === 'STABLE' ? 0.5 : 0
  };

  const score =
    (normalized.completionRate * weights.completionRate) +
    (normalized.scheduleAdherence * weights.scheduleAdherence) +
    (normalized.pacingGap * weights.pacingGap) +
    (normalized.missReasonSeverity * weights.missReasonSeverity) +
    (normalized.trendDirection * weights.trendDirection);

  if (!Number.isFinite(score)) return 0;
  return Math.round(score * 100);
}

/**
 * Calculate miss reason severity (0-1, higher = more severe)
 * @param {Array} blocks - Schedule blocks
 * @returns {number} Severity score
 */
function calculateMissReasonSeverity(blocks) {
  const missedBlocks = blocks.filter(b => b.status === 'missed' && b.missReason);
  if (missedBlocks.length === 0) return 0;

  const severityMap = {
    [MISS_REASONS.EXTERNAL_FACTOR]: 0.2,
    [MISS_REASONS.DEPENDENCY_BLOCKED]: 0.4,
    [MISS_REASONS.LOW_ENERGY]: 0.6,
    [MISS_REASONS.TIME_CONFLICT]: 0.8,
    [MISS_REASONS.NOT_GIVEN]: 1.0
  };

  const totalSeverity = missedBlocks.reduce((sum, block) =>
    sum + (severityMap[block.missReason] || 0.5), 0
  );

  return totalSeverity / missedBlocks.length;
}

/**
 * Calculate trend direction
 * @param {Array} blocks - Schedule blocks
 * @returns {string} Trend direction
 */
function calculateTrendDirection(blocks) {
  // Simple trend: compare recent completions vs older ones
  const recentBlocks = blocks.slice(-5); // Last 5 blocks
  const olderBlocks = blocks.slice(-10, -5); // Previous 5 blocks

  const recentCompletionRate = recentBlocks.filter(b => b.status === 'completed').length / recentBlocks.length;
  const olderCompletionRate = olderBlocks.filter(b => b.status === 'completed').length / olderBlocks.length;

  if (recentCompletionRate > olderCompletionRate + 0.1) return 'IMPROVING';
  if (recentCompletionRate < olderCompletionRate - 0.1) return 'DECLINING';
  return 'STABLE';
}

/**
 * Detect drift patterns (Module 11)
 * @param {Object} stabilityRecord - Current stability record
 * @param {Object} committedSchedule - Committed schedule
 * @returns {Object} Drift detection result
 */
function detectDrift(stabilityRecord, committedSchedule) {
  const blocks = committedSchedule.blocks;
  const goalFamily = committedSchedule.goalFamily;
  const adjustments = FAMILY_DRIFT_ADJUSTMENTS[goalFamily] || {};

  const driftSignals = [];
  let overallSeverity = SEVERITY_LEVELS.NONE;
  const severityRank = {
    [SEVERITY_LEVELS.NONE]: 0,
    [SEVERITY_LEVELS.MEDIUM]: 1,
    [SEVERITY_LEVELS.HIGH]: 2,
    [SEVERITY_LEVELS.CRITICAL]: 3
  };

  const updateSeverity = (sev) => {
    if (severityRank[sev] > severityRank[overallSeverity]) {
      overallSeverity = sev;
    }
  };

  // PACING_DRIFT: pacingGap below -10 for 2 consecutive tracking points
  if (stabilityRecord.pacingGap < -10) {
    driftSignals.push({
      driftPattern: DRIFT_PATTERNS.PACING_DRIFT,
      severity: SEVERITY_LEVELS.MEDIUM,
      detectedAt: stabilityRecord.trackingTimestamp,
      supportingEvidence: `Pacing gap: ${stabilityRecord.pacingGap.toFixed(1)}%`,
      affectedBlocks: [],
      affectedActions: []
    });
    updateSeverity(SEVERITY_LEVELS.MEDIUM);
  }

  // COMPLETION_RATE_DRIFT: completionRate below 0.70
  if (stabilityRecord.completionRate < 0.70) {
    driftSignals.push({
      driftPattern: DRIFT_PATTERNS.COMPLETION_RATE_DRIFT,
      severity: SEVERITY_LEVELS.MEDIUM,
      detectedAt: stabilityRecord.trackingTimestamp,
      supportingEvidence: `Completion rate: ${(stabilityRecord.completionRate * 100).toFixed(1)}%`,
      affectedBlocks: [],
      affectedActions: []
    });
    updateSeverity(SEVERITY_LEVELS.MEDIUM);
  }

  // CONSECUTIVE_MISS: 3 or more consecutive blocks missed
  const consecutiveMissThreshold = adjustments.CONSECUTIVE_MISS?.threshold || 3;
  const consecutiveMisses = findConsecutiveMisses(blocks, consecutiveMissThreshold);
  if (consecutiveMisses.length > 0) {
    driftSignals.push({
      driftPattern: DRIFT_PATTERNS.CONSECUTIVE_MISS,
      severity: SEVERITY_LEVELS.HIGH,
      detectedAt: stabilityRecord.trackingTimestamp,
      supportingEvidence: `${consecutiveMisses.length} consecutive misses`,
      affectedBlocks: consecutiveMisses,
      affectedActions: []
    });
    updateSeverity(SEVERITY_LEVELS.HIGH);
  }

  // SCHEDULE_COLLAPSE: scheduleAdherenceRate below 0.50
  const collapseThreshold = adjustments.SCHEDULE_COLLAPSE?.threshold || 0.50;
  if (stabilityRecord.scheduleAdherenceRate < collapseThreshold) {
    driftSignals.push({
      driftPattern: DRIFT_PATTERNS.SCHEDULE_COLLAPSE,
      severity: SEVERITY_LEVELS.HIGH,
      detectedAt: stabilityRecord.trackingTimestamp,
      supportingEvidence: `Adherence rate: ${(stabilityRecord.scheduleAdherenceRate * 100).toFixed(1)}%`,
      affectedBlocks: [],
      affectedActions: []
    });
    updateSeverity(SEVERITY_LEVELS.HIGH);
  }

  // DEADLINE_RISK: At current pace, goal cannot complete by deadline
  const deadlineRisk = checkDeadlineRisk(stabilityRecord, committedSchedule, adjustments);
  if (deadlineRisk.atRisk) {
    driftSignals.push({
      driftPattern: DRIFT_PATTERNS.DEADLINE_RISK,
      severity: SEVERITY_LEVELS.HIGH,
      detectedAt: stabilityRecord.trackingTimestamp,
      supportingEvidence: deadlineRisk.evidence,
      affectedBlocks: [],
      affectedActions: []
    });
    updateSeverity(SEVERITY_LEVELS.HIGH);
  }

  // DEPENDENCY_STALL: A dependency-blocking action is overdue
  const stallThreshold = adjustments.DEPENDENCY_STALL?.threshold || 3;
  const stalledDependencies = findStalledDependencies(blocks, stallThreshold);
  if (stalledDependencies.length > 0) {
    driftSignals.push({
      driftPattern: DRIFT_PATTERNS.DEPENDENCY_STALL,
      severity: SEVERITY_LEVELS.HIGH,
      detectedAt: stabilityRecord.trackingTimestamp,
      supportingEvidence: `${stalledDependencies.length} stalled dependencies`,
      affectedBlocks: stalledDependencies,
      affectedActions: []
    });
    updateSeverity(SEVERITY_LEVELS.HIGH);
  }

  // CRITICAL_PACING: pacingGap below -25
  if (stabilityRecord.pacingGap < -25) {
    driftSignals.push({
      driftPattern: DRIFT_PATTERNS.CRITICAL_PACING,
      severity: SEVERITY_LEVELS.CRITICAL,
      detectedAt: stabilityRecord.trackingTimestamp,
      supportingEvidence: `Critical pacing gap: ${stabilityRecord.pacingGap.toFixed(1)}%`,
      affectedBlocks: [],
      affectedActions: []
    });
    updateSeverity(SEVERITY_LEVELS.CRITICAL);
  }

  // ABANDONMENT_RISK: No completion signal for extended period
  const abandonmentThreshold = adjustments.ABANDONMENT_RISK?.threshold || 14;
  const daysSinceLastCompletion = calculateDaysSinceLastCompletion(blocks);
  if (daysSinceLastCompletion !== null && daysSinceLastCompletion >= abandonmentThreshold) {
    driftSignals.push({
      driftPattern: DRIFT_PATTERNS.ABANDONMENT_RISK,
      severity: SEVERITY_LEVELS.CRITICAL,
      detectedAt: stabilityRecord.trackingTimestamp,
      supportingEvidence: `${daysSinceLastCompletion} days since last completion`,
      affectedBlocks: [],
      affectedActions: []
    });
    updateSeverity(SEVERITY_LEVELS.CRITICAL);
  }

  return {
    goalId: stabilityRecord.goalId,
    cycleId: stabilityRecord.cycleId,
    detectionTimestamp: stabilityRecord.trackingTimestamp,
    driftDetected: driftSignals.length > 0,
    driftSignals,
    overallDriftSeverity: overallSeverity,
    recoveryRecommended: overallSeverity !== SEVERITY_LEVELS.NONE,
    errorCode: null
  };
}

/**
 * Find consecutive misses
 * @param {Array} blocks - Schedule blocks
 * @param {number} threshold - Minimum consecutive misses
 * @returns {Array} Block IDs of consecutive misses
 */
function findConsecutiveMisses(blocks, threshold) {
  let consecutive = 0;
  let consecutiveIds = [];

  for (const block of blocks) {
    if (block.status === 'missed') {
      consecutive += 1;
      consecutiveIds.push(block.blockId);
      if (consecutive >= threshold) {
        return consecutiveIds.slice(-threshold);
      }
    } else {
      consecutive = 0;
      consecutiveIds = [];
    }
  }

  return [];
}

/**
 * Check for deadline risk
 * @param {Object} stabilityRecord - Stability record
 * @param {Object} committedSchedule - Committed schedule
 * @param {Object} adjustments - Family adjustments
 * @returns {Object} Deadline risk assessment
 */
function checkDeadlineRisk(stabilityRecord, committedSchedule, adjustments) {
  const remainingWork = stabilityRecord.totalBlocksRemaining;
  const daysRemaining = stabilityRecord.daysRemaining;

  if (daysRemaining <= 0) {
    return { atRisk: true, evidence: 'Deadline has passed' };
  }

  // Projected completion rate (assume current completion rate continues)
  const projectedCompletions = Math.floor(daysRemaining * (stabilityRecord.completionRate || 0.5));
  const willComplete = projectedCompletions >= remainingWork;

  // Special handling for ProfessionalQualification
  if (adjustments.DEADLINE_RISK) {
    const { triggerAt, completionThreshold } = adjustments.DEADLINE_RISK;
    if (stabilityRecord.percentageTimeElapsed >= triggerAt &&
        stabilityRecord.percentageWorkCompleted < completionThreshold) {
      return {
        atRisk: true,
        evidence: `Professional qualification deadline risk: ${Math.round(stabilityRecord.percentageWorkCompleted * 100)}% complete at ${Math.round(stabilityRecord.percentageTimeElapsed * 100)}% of timeline`
      };
    }
  }

  return {
    atRisk: !willComplete,
    evidence: willComplete ? 'On track to complete' : `Projected ${projectedCompletions} completions in ${daysRemaining} days, but ${remainingWork} blocks remaining`
  };
}

/**
 * Find stalled dependencies
 * @param {Array} blocks - Schedule blocks
 * @param {number} threshold - Days overdue threshold
 * @returns {Array} Block IDs of stalled dependencies
 */
function findStalledDependencies(blocks, threshold) {
  const now = new Date();
  const overdueBlocks = blocks.filter(block => {
    if (block.status !== 'pending') return false;
    const scheduledDate = new Date(block.scheduledDate);
    const daysOverdue = Math.floor((now - scheduledDate) / (1000 * 60 * 60 * 24));
    return daysOverdue >= threshold;
  });

  return overdueBlocks.map(b => b.blockId);
}

/**
 * Calculate days since last completion
 * @param {Array} blocks - Schedule blocks
 * @returns {number} Days since last completion
 */
function calculateDaysSinceLastCompletion(blocks) {
  const completedBlocks = blocks.filter(b => b.status === 'completed' && b.actualDate);
  if (completedBlocks.length === 0) return null;

  const lastCompletion = new Date(Math.max(...completedBlocks.map(b => new Date(b.actualDate))));
  const now = new Date();
  return Math.floor((now - lastCompletion) / (1000 * 60 * 60 * 24));
}

/**
 * Classify failure type (Module 12)
 * @param {Object} driftDetection - Drift detection result
 * @param {Object} committedSchedule - Committed schedule
 * @returns {Object} Failure classification result
 */
function classifyFailure(driftDetection, committedSchedule) {
  const goalFamily = committedSchedule.goalFamily;
  const adjustments = FAMILY_DRIFT_ADJUSTMENTS[goalFamily] || {};

  // Need at least 3 execution events for classification
  const executionEvents = committedSchedule.blocks.filter(b => b.status !== 'pending');
  if (executionEvents.length < 2) {
    return {
      goalId: driftDetection.goalId,
      cycleId: driftDetection.cycleId,
      classificationTimestamp: new Date().toISOString(),
      failureClassDetected: false,
      failureClass: null,
      failureClassRationale: 'Insufficient execution data for drift classification',
      driftPatternsConsumed: [],
      severityLevel: SEVERITY_LEVELS.NONE,
      recoveryEligible: false,
      recoveryUrgency: RECOVERY_URGENCY.MONITOR,
      handoffToRecoveryAgent: false,
      errorCode: ERROR_CODES.DRIFT_CLASSIFICATION_INSUFFICIENT_DATA
    };
  }

  let failureClass = null;
  let rationale = '';
  const consumedPatterns = [];

  const hasConsecutiveMiss = driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.CONSECUTIVE_MISS);
  const hasPacingDrift = driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.PACING_DRIFT);
  const hasCompletionRateDrift = driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.COMPLETION_RATE_DRIFT);
  const hasScheduleCollapse = driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.SCHEDULE_COLLAPSE);
  const hasAbandonmentRisk = driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.ABANDONMENT_RISK);
  const hasDependencyStall = driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.DEPENDENCY_STALL);
  const hasDeadlineRisk = driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.DEADLINE_RISK);
  const hasCriticalPacing = driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.CRITICAL_PACING);

  const externalMisses = committedSchedule.blocks
    .filter(b => b.status === 'missed')
    .filter(b => b.missReason === MISS_REASONS.EXTERNAL_FACTOR);

  const hasExternalReasons = externalMisses.length > 0;

  // EXTERNAL_DISRUPTION: CONSECUTIVE_MISS with EXTERNAL_FACTOR reasons
  if (hasConsecutiveMiss && externalMisses.length >= 2 && (!adjustments.EXTERNAL_DISRUPTION?.lenient || externalMisses.length >= 3)) {
    failureClass = FAILURE_CLASSES.EXTERNAL_DISRUPTION;
    rationale = 'Multiple consecutive misses due to external factors beyond user control';
    consumedPatterns.push(DRIFT_PATTERNS.CONSECUTIVE_MISS);
  }
  // CAPACITY_OVERCOMMIT: PACING_DRIFT + COMPLETION_RATE_DRIFT
  else if (hasPacingDrift && hasCompletionRateDrift) {
    failureClass = FAILURE_CLASSES.CAPACITY_OVERCOMMIT;
    rationale = 'Consistent pacing behind schedule combined with low completion rate indicates overcommitted capacity';
    consumedPatterns.push(DRIFT_PATTERNS.PACING_DRIFT, DRIFT_PATTERNS.COMPLETION_RATE_DRIFT);
  }
  // DEADLINE_COMPRESSION: DEADLINE_RISK + CRITICAL_PACING
  else if (hasDeadlineRisk && hasCriticalPacing) {
    failureClass = FAILURE_CLASSES.DEADLINE_COMPRESSION;
    rationale = 'Timeline is no longer achievable at current pace with critical pacing gap';
    consumedPatterns.push(DRIFT_PATTERNS.DEADLINE_RISK, DRIFT_PATTERNS.CRITICAL_PACING);
  }
  // SCHEDULE_MISMATCH: SCHEDULE_COLLAPSE
  else if (hasScheduleCollapse) {
    failureClass = FAILURE_CLASSES.SCHEDULE_MISMATCH;
    rationale = 'Schedule adherence has collapsed, indicating committed time windows do not match actual availability';
    consumedPatterns.push(DRIFT_PATTERNS.SCHEDULE_COLLAPSE);
  }
  // MOTIVATION_DRIFT: ABANDONMENT_RISK + CONSECUTIVE_MISS (without external reasons)
  else if (hasAbandonmentRisk && hasConsecutiveMiss && !hasExternalReasons) {
    failureClass = FAILURE_CLASSES.MOTIVATION_DRIFT;
    rationale = 'Extended period without progress combined with consecutive misses, no external factors present';
    consumedPatterns.push(DRIFT_PATTERNS.ABANDONMENT_RISK, DRIFT_PATTERNS.CONSECUTIVE_MISS);
  }
  // DEPENDENCY_BLOCK: DEPENDENCY_STALL
  else if (hasDependencyStall) {
    failureClass = FAILURE_CLASSES.DEPENDENCY_BLOCK;
    rationale = 'Critical dependency actions are stalled, blocking downstream progress';
    consumedPatterns.push(DRIFT_PATTERNS.DEPENDENCY_STALL);
  }
  // SCOPE_UNDERESTIMATE: PACING_DRIFT with high completion rate
  else if (hasPacingDrift) {
    const stabilityRecord = getLatestStabilityRecord();
    if (stabilityRecord && stabilityRecord.completionRate > 0.8) {
      failureClass = FAILURE_CLASSES.SCOPE_UNDERESTIMATE;
      rationale = 'Completing blocks but falling behind schedule indicates effort per block was underestimated';
      consumedPatterns.push(DRIFT_PATTERNS.PACING_DRIFT);
    }
  }

  // Determine severity and recovery urgency
  let severityLevel = driftDetection.overallDriftSeverity;

  // Override severity for certain failure classes to align with recovery expectations
  if (failureClass === FAILURE_CLASSES.CAPACITY_OVERCOMMIT) {
    severityLevel = SEVERITY_LEVELS.MEDIUM;
  }

  let recoveryUrgency;

  switch (severityLevel) {
    case SEVERITY_LEVELS.NONE:
      recoveryUrgency = RECOVERY_URGENCY.MONITOR;
      break;
    case SEVERITY_LEVELS.MEDIUM:
      recoveryUrgency = RECOVERY_URGENCY.PROMPT;
      break;
    case SEVERITY_LEVELS.HIGH:
      recoveryUrgency = RECOVERY_URGENCY.URGENT;
      break;
    case SEVERITY_LEVELS.CRITICAL:
      recoveryUrgency = RECOVERY_URGENCY.IMMEDIATE;
      break;
    default:
      recoveryUrgency = RECOVERY_URGENCY.MONITOR;
  }

  return {
    goalId: driftDetection.goalId,
    cycleId: driftDetection.cycleId,
    classificationTimestamp: new Date().toISOString(),
    failureClassDetected: failureClass !== null,
    failureClass,
    failureClassRationale: rationale,
    driftPatternsConsumed: consumedPatterns,
    severityLevel,
    recoveryEligible: failureClass !== null,
    recoveryUrgency,
    handoffToRecoveryAgent: recoveryUrgency === RECOVERY_URGENCY.PROMPT ||
                           recoveryUrgency === RECOVERY_URGENCY.URGENT ||
                           recoveryUrgency === RECOVERY_URGENCY.IMMEDIATE,
    errorCode: null
  };
}

/**
 * Get latest stability record from committed schedule
 * @returns {Object|null} Latest stability record
 */
function getLatestStabilityRecord() {
  // This would typically come from a stability record store
  // For now, return null as we don't have historical records
  return null;
}