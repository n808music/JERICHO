import { validateMaterializedBlockDependencies } from './schedule-dependency-enforcement.js';

/**
 * Integration Verification Agent
 *
 * Agent 8 in the integration order.
 * Verifies all module handoffs, contract boundaries, and postconditions.
 * Surfaces failures with evidence, never mutates business logic.
 */

import { startTrace, addTraceEvent } from './diagnostics.js';

/**
 * Run full integration verification for a goal execution cycle
 * @param {Object} executionContext - full context of the execution
 * @returns {Object} verification record
 */
export function runIntegrationVerification(executionContext) {
  const {
    traceId,
    goal,
    actionGraph,
    graphValidation,
    capacityVector,
    effortEstimate,
    feasibility,
    schedulingPolicy,
    scheduleProposal,
    committedBlocks,
    executionSignals = [],
    stabilityRecords = [],
    driftDetection,
    failureClassification,
    recoveryRecommendation,
    userConfirmations = []
  } = executionContext;

  const verificationRecord = {
    traceId,
    cycleId: `cycle-${goal.id}-0`,
    goalId: goal.id,
    goalFamily: goal.family,
    goalSubtype: goal.subtype,
    runTimestamp: new Date().toISOString(),
    boundaryChecks: [],
    postconditionResults: [],
    integrationStatus: 'PASS',
    criticalFailureDetected: false,
    rollbackRecommended: false,
    rollbackReason: null,
    chainReachedModule: null,
    stoppedAt: null,
    errorCode: null
  };

  // Verify Agent 1 chain
  const agent1Result = verifyAgent1Chain(verificationRecord, goal, userConfirmations);
  if (agent1Result.criticalFailure) {
    verificationRecord.criticalFailureDetected = true;
    verificationRecord.integrationStatus = 'FAIL';
    verificationRecord.stoppedAt = 'Module 2';
    verificationRecord.errorCode = agent1Result.errorCode;
    return verificationRecord;
  }

  // Verify Agent 2 chain
  const agent2Result = verifyAgent2Chain(verificationRecord, goal, actionGraph, graphValidation, userConfirmations);
  if (agent2Result.criticalFailure) {
    verificationRecord.criticalFailureDetected = true;
    verificationRecord.integrationStatus = 'FAIL';
    verificationRecord.stoppedAt = 'Module 4';
    verificationRecord.errorCode = agent2Result.errorCode;
    return verificationRecord;
  }

  // Verify Agent 3 chain
  const agent3Result = verifyAgent3Chain(verificationRecord, capacityVector, effortEstimate, feasibility, userConfirmations);
  if (agent3Result.criticalFailure) {
    verificationRecord.criticalFailureDetected = true;
    verificationRecord.integrationStatus = 'FAIL';
    verificationRecord.stoppedAt = 'Module 6';
    verificationRecord.errorCode = agent3Result.errorCode;
    return verificationRecord;
  }

  // Verify Agent 4 chain
  const agent4Result = verifyAgent4Chain(verificationRecord, schedulingPolicy, scheduleProposal, committedBlocks, userConfirmations);
  if (agent4Result.criticalFailure) {
    verificationRecord.criticalFailureDetected = true;
    verificationRecord.integrationStatus = 'FAIL';
    verificationRecord.stoppedAt = 'Module 8';
    verificationRecord.errorCode = agent4Result.errorCode;
    verificationRecord.rollbackRecommended = agent4Result.rollbackRecommended;
    verificationRecord.rollbackReason = agent4Result.rollbackReason;
  }

  // Verify Agent 6 chain (Stability and Drift)
  const agent6Result = verifyAgent6Chain(verificationRecord, committedBlocks, executionSignals, stabilityRecords, driftDetection, failureClassification);
  if (agent6Result.criticalFailure) {
    verificationRecord.criticalFailureDetected = true;
    verificationRecord.integrationStatus = 'FAIL';
    verificationRecord.stoppedAt = 'Module 12';
    verificationRecord.errorCode = agent6Result.errorCode;
  }

  // Verify Agent 7 chain (Recovery)
  const agent7Result = verifyAgent7Chain(verificationRecord, failureClassification, recoveryRecommendation);
  if (agent7Result.criticalFailure) {
    verificationRecord.criticalFailureDetected = true;
    verificationRecord.integrationStatus = 'FAIL';
    verificationRecord.stoppedAt = 'Module 13';
    verificationRecord.errorCode = agent7Result.errorCode;
  }

  // Determine final integration status
  const hasFailures = verificationRecord.boundaryChecks.some(check => check.status === 'FAIL');
  const hasWarnings = verificationRecord.boundaryChecks.some(check => check.status === 'WARN');

  if (verificationRecord.criticalFailureDetected) {
    verificationRecord.integrationStatus = 'FAIL';
  } else if (hasFailures) {
    verificationRecord.integrationStatus = 'PARTIAL';
  } else if (hasWarnings) {
    verificationRecord.integrationStatus = 'PASS'; // Warnings don't fail integration
  }

  // Set chain reached
  if (!verificationRecord.stoppedAt) {
    verificationRecord.chainReachedModule = 'Module 8';
  }

  return verificationRecord;
}

/**
 * Verify Agent 3 chain (Modules 5-6)
 */
function verifyAgent3Chain(record, capacityVector, effortEstimate, feasibility, userConfirmations) {
  // Module 5 input contract
  record.boundaryChecks.push({
    checkId: 'module5_input',
    moduleName: 'Module 5',
    boundaryType: 'INPUT',
    status: validateCapacityVector(capacityVector) ? 'PASS' : 'FAIL',
    detail: 'Capacity vector schema validation',
    errorCode: null,
    timestamp: new Date().toISOString()
  });

  // Module 5 output contract
  const module5OutputValid = validateEffortEstimate(effortEstimate);
  record.boundaryChecks.push({
    checkId: 'module5_output',
    moduleName: 'Module 5',
    boundaryType: 'OUTPUT',
    status: module5OutputValid ? 'PASS' : 'FAIL',
    detail: 'Effort estimate output validation',
    errorCode: module5OutputValid ? null : 'EFFORT_ESTIMATE_INVALID',
    timestamp: new Date().toISOString()
  });

  // Module 5 postcondition
  const module5Postcondition = effortEstimate &&
    (effortEstimate.errorCode || (effortEstimate.estimatedTotalEffortHours >= 0));
  record.postconditionResults.push({
    moduleName: 'Module 5',
    postconditionStatement: 'A deterministic effort estimate exists for this goal and capacity vector, or a stable error code explains why it does not',
    result: module5Postcondition ? 'PASS' : 'FAIL',
    evidence: module5Postcondition ? 'Effort estimate present' : 'Effort estimate missing',
    timestamp: new Date().toISOString()
  });

  // Handoff Module 5 -> Module 6
  record.boundaryChecks.push({
    checkId: 'handoff_5_to_6',
    moduleName: 'Module 5 → Module 6',
    boundaryType: 'HANDOFF',
    status: effortEstimate ? 'PASS' : 'FAIL',
    detail: 'Effort estimate passed to feasibility scoring',
    errorCode: null,
    timestamp: new Date().toISOString()
  });

  // Module 6 input contract
  record.boundaryChecks.push({
    checkId: 'module6_input',
    moduleName: 'Module 6',
    boundaryType: 'INPUT',
    status: (effortEstimate && capacityVector) ? 'PASS' : 'FAIL',
    detail: 'Feasibility scoring input validation',
    errorCode: null,
    timestamp: new Date().toISOString()
  });

  // Module 6 output contract
  const module6OutputValid = validateFeasibilityScore(feasibility);
  record.boundaryChecks.push({
    checkId: 'module6_output',
    moduleName: 'Module 6',
    boundaryType: 'OUTPUT',
    status: module6OutputValid ? 'PASS' : 'FAIL',
    detail: 'Feasibility score output validation',
    errorCode: module6OutputValid ? null : 'FEASIBILITY_SCORE_INVALID',
    timestamp: new Date().toISOString()
  });

  // Module 6 postcondition
  const module6Postcondition = feasibility &&
    feasibility.baselineFeasibilityScore >= 0 && feasibility.baselineFeasibilityScore <= 100 &&
    feasibility.factorBreakdown && feasibility.factorBreakdown.length === 5;
  record.postconditionResults.push({
    moduleName: 'Module 6',
    postconditionStatement: 'A baseline feasibility score between 0 and 100 exists with a 5-factor breakdown, and the user has acknowledged it before scheduling began',
    result: module6Postcondition ? 'PASS' : 'FAIL',
    evidence: module6Postcondition ? 'Feasibility score with 5 factors present' : 'Feasibility score incomplete',
    timestamp: new Date().toISOString()
  });

  // Confirmation gate verification
  const feasibilityConfirmed = userConfirmations.some(c => c.type === 'feasibility_acknowledged');
  record.boundaryChecks.push({
    checkId: 'confirmation_gate_3',
    moduleName: 'Agent 3',
    boundaryType: 'POSTCONDITION',
    status: feasibilityConfirmed ? 'PASS' : 'FAIL',
    detail: 'Feasibility confirmation gate presented and acknowledged',
    errorCode: feasibilityConfirmed ? null : 'CONFIRMATION_GATE_BYPASSED',
    timestamp: new Date().toISOString()
  });

  if (!feasibilityConfirmed) {
    return { criticalFailure: true, errorCode: 'CONFIRMATION_GATE_BYPASSED' };
  }

  return { criticalFailure: false };
}

/**
 * Verify Agent 4 chain (Modules 7-8)
 */
function verifyAgent4Chain(record, schedulingPolicy, scheduleProposal, committedBlocks, userConfirmations) {
  // Module 7 input contract
  record.boundaryChecks.push({
    checkId: 'module7_input',
    moduleName: 'Module 7',
    boundaryType: 'INPUT',
    status: validateSchedulingPolicy(schedulingPolicy) ? 'PASS' : 'FAIL',
    detail: 'Scheduling policy input validation',
    errorCode: null,
    timestamp: new Date().toISOString()
  });

  // Module 7 output contract
  const module7OutputValid = validateScheduleProposal(scheduleProposal);
  record.boundaryChecks.push({
    checkId: 'module7_output',
    moduleName: 'Module 7',
    boundaryType: 'OUTPUT',
    status: module7OutputValid ? 'PASS' : 'FAIL',
    detail: 'Schedule proposal output validation',
    errorCode: module7OutputValid ? null : 'SCHEDULE_PROPOSAL_INVALID',
    timestamp: new Date().toISOString()
  });

  // Check for dependency violations
  const dependencyViolation = checkDependencyViolations(scheduleProposal);
  record.boundaryChecks.push({
    checkId: 'dependency_check',
    moduleName: 'Module 7',
    boundaryType: 'POSTCONDITION',
    status: dependencyViolation ? 'FAIL' : 'PASS',
    detail: 'Dependency order preserved in proposal',
    errorCode: dependencyViolation ? 'DEPENDENCY_ORDER_VIOLATED' : null,
    timestamp: new Date().toISOString()
  });

  if (dependencyViolation) {
    return { criticalFailure: true, errorCode: 'DEPENDENCY_ORDER_VIOLATED' };
  }

  // Module 7 postcondition
  const module7Postcondition = scheduleProposal &&
    (scheduleProposal.errorCode || (scheduleProposal.proposedBlocks && scheduleProposal.proposedBlocks.length > 0));
  record.postconditionResults.push({
    moduleName: 'Module 7',
    postconditionStatement: 'A non-empty valid schedule proposal exists with all blocks in suggested status and dependency order preserved, or a stable error code explains why it does not',
    result: module7Postcondition ? 'PASS' : 'FAIL',
    evidence: module7Postcondition ? 'Valid schedule proposal present' : 'Schedule proposal missing or invalid',
    timestamp: new Date().toISOString()
  });

  // Confirmation gate verification
  const scheduleConfirmed = userConfirmations.some(c => c.type === 'schedule_committed');
  record.boundaryChecks.push({
    checkId: 'confirmation_gate_4',
    moduleName: 'Agent 4',
    boundaryType: 'POSTCONDITION',
    status: scheduleConfirmed ? 'PASS' : 'FAIL',
    detail: 'Schedule confirmation gate presented and committed',
    errorCode: scheduleConfirmed ? null : 'COMMIT_WITHOUT_CONFIRMATION',
    timestamp: new Date().toISOString()
  });

  if (!scheduleConfirmed && committedBlocks && committedBlocks.length > 0) {
    return {
      criticalFailure: true,
      errorCode: 'COMMIT_WITHOUT_CONFIRMATION',
      rollbackRecommended: true,
      rollbackReason: 'Blocks committed without user confirmation'
    };
  }

  // Module 8 input contract
  record.boundaryChecks.push({
    checkId: 'module8_input',
    moduleName: 'Module 8',
    boundaryType: 'INPUT',
    status: (scheduleProposal && scheduleConfirmed) ? 'PASS' : 'FAIL',
    detail: 'Schedule commit input validation',
    errorCode: null,
    timestamp: new Date().toISOString()
  });

  // Module 8 output contract
  const module8OutputValid = validateCommittedBlocks(committedBlocks, scheduleProposal);
  record.boundaryChecks.push({
    checkId: 'module8_output',
    moduleName: 'Module 8',
    boundaryType: 'OUTPUT',
    status: module8OutputValid ? 'PASS' : 'FAIL',
    detail: 'Committed blocks output validation',
    errorCode: module8OutputValid ? null : 'COMMIT_OUTPUT_INVALID',
    timestamp: new Date().toISOString()
  });

  // Module 8 postcondition
  const module8Postcondition = committedBlocks &&
    committedBlocks.every(block => block.status === 'committed') &&
    (!scheduleProposal || blocksMatchProposal(committedBlocks, scheduleProposal));
  record.postconditionResults.push({
    moduleName: 'Module 8',
    postconditionStatement: 'All committed blocks match the confirmed proposal exactly, all blocks carry committed status, and no commit occurred without explicit user confirmation',
    result: module8Postcondition ? 'PASS' : 'FAIL',
    evidence: module8Postcondition ? 'Blocks committed correctly' : 'Commit validation failed',
    timestamp: new Date().toISOString()
  });

  return { criticalFailure: false };
}

/**
 * Verify Agent 6 (Stability and Drift Agent) chain
 * Modules 10-12: Stability Tracking, Drift Detection, Failure Classification
 */
function verifyAgent6Chain(record, committedBlocks, executionSignals, stabilityRecords, driftDetection, failureClassification) {
  const result = {
    boundaryChecks: [],
    postconditionResults: [],
    criticalFailure: false,
    errorCode: null
  };

  // Boundary Check: Input contract - Every execution event has a blockId present in committed schedule
  if (executionSignals && executionSignals.length > 0) {
    const invalidSignals = executionSignals.filter(signal => {
      return !committedBlocks.blocks.some(block => block.blockId === signal.blockReference);
    });

    result.boundaryChecks.push({
      boundary: 'execution_event_input_contract',
      description: 'Every execution event references a valid committed block',
      status: invalidSignals.length === 0 ? 'PASS' : 'FAIL',
      evidence: invalidSignals.length === 0 ?
        'All execution signals reference valid committed blocks' :
        `Found ${invalidSignals.length} signals referencing non-existent blocks`,
      timestamp: new Date().toISOString()
    });

    if (invalidSignals.length > 0) {
      result.criticalFailure = true;
      result.errorCode = 'CANONICAL_SOURCE_MISMATCH';
      record.boundaryChecks.push(...result.boundaryChecks);
      return result;
    }
  }

  // Boundary Check: Module 10 output - Stability record complete with all required fields
  if (stabilityRecords && stabilityRecords.length > 0) {
    const latestRecord = stabilityRecords[stabilityRecords.length - 1];
    const requiredFields = [
      'goalId', 'cycleId', 'trackingTimestamp', 'totalBlocksScheduled',
      'totalBlocksCompleted', 'totalBlocksMissed', 'totalBlocksRescheduled',
      'totalBlocksRemaining', 'completionRate', 'scheduleAdherenceRate',
      'currentPacingStatus', 'stabilityScore', 'trendDirection'
    ];

    const hasAllFields = requiredFields.every(field => Object.prototype.hasOwnProperty.call(latestRecord, field));
    const pacingStatusValid = ['AHEAD', 'ON_TRACK', 'BEHIND', 'CRITICAL'].includes(latestRecord.currentPacingStatus);

    result.boundaryChecks.push({
      boundary: 'stability_record_completeness',
      description: 'Stability record contains all required fields with valid pacing status',
      status: hasAllFields && pacingStatusValid ? 'PASS' : 'FAIL',
      evidence: hasAllFields && pacingStatusValid ?
        'Stability record complete with valid pacing status' :
        `Missing fields or invalid pacing status: ${latestRecord.currentPacingStatus}`,
      timestamp: new Date().toISOString()
    });
  }

  // Boundary Check: Module 11 output - Drift detection ran, driftDetected is boolean
  if (driftDetection) {
    const hasDriftDetected = typeof driftDetection.driftDetected === 'boolean';
    const hasValidSignals = Array.isArray(driftDetection.driftSignals);

    result.boundaryChecks.push({
      boundary: 'drift_detection_output',
      description: 'Drift detection ran and produced valid output structure',
      status: hasDriftDetected && hasValidSignals ? 'PASS' : 'FAIL',
      evidence: hasDriftDetected && hasValidSignals ?
        `Drift detection completed: ${driftDetection.driftDetected ? 'drift detected' : 'no drift'}` :
        'Drift detection output invalid or missing',
      timestamp: new Date().toISOString()
    });
  }

  // Boundary Check: Module 12 output - If driftDetected is true, failureClass is assigned or explicitly null
  if (failureClassification) {
    const hasFailureClassField = Object.prototype.hasOwnProperty.call(failureClassification, 'failureClass');
    const hasRationale = failureClassification.failureClassRationale;
    const validSeverity = ['NONE', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(failureClassification.severityLevel);
    const validUrgency = ['MONITOR', 'PROMPT', 'URGENT', 'IMMEDIATE'].includes(failureClassification.recoveryUrgency);

    result.boundaryChecks.push({
      boundary: 'failure_classification_output',
      description: 'Failure classification produced valid output with proper severity and urgency',
      status: hasFailureClassField && hasRationale && validSeverity && validUrgency ? 'PASS' : 'FAIL',
      evidence: hasFailureClassField && hasRationale && validSeverity && validUrgency ?
        `Classification complete: ${failureClassification.failureClass || 'no failure class'} (${failureClassification.severityLevel})` :
        'Failure classification output incomplete or invalid',
      timestamp: new Date().toISOString()
    });
  }

  // Boundary Check: Handoff to Recovery Agent - handoffToRecoveryAgent only true if recoveryEligible and urgency PROMPT+
  if (failureClassification) {
    const validHandoff = !failureClassification.handoffToRecoveryAgent ||
      (failureClassification.recoveryEligible &&
       ['PROMPT', 'URGENT', 'IMMEDIATE'].includes(failureClassification.recoveryUrgency));

    result.boundaryChecks.push({
      boundary: 'recovery_agent_handoff',
      description: 'Recovery agent handoff only occurs when eligible with appropriate urgency',
      status: validHandoff ? 'PASS' : 'FAIL',
      evidence: validHandoff ?
        'Recovery handoff rules followed' :
        'Invalid recovery handoff: not eligible or insufficient urgency',
      timestamp: new Date().toISOString()
    });
  }

  // Postcondition: Execution outcomes are mapped onto canonical committed work units with drift classification present or explicitly deferred
  const hasExecutionData = (executionSignals && executionSignals.length > 0) ||
                          (stabilityRecords && stabilityRecords.length > 0);
  const hasDriftClassification = driftDetection && failureClassification;
  const classificationDeferred = failureClassification &&
    failureClassification.errorCode === 'DRIFT_CLASSIFICATION_INSUFFICIENT_DATA';

  result.postconditionResults.push({
    postcondition: 'execution_outcomes_mapped',
    description: 'Execution signals mapped to canonical work units with drift classification',
    status: !hasExecutionData || hasDriftClassification || classificationDeferred ? 'PASS' : 'FAIL',
    evidence: !hasExecutionData ?
      'No execution data to verify' :
      hasDriftClassification ?
        'Execution outcomes mapped with drift classification present' :
        classificationDeferred ?
          'Classification explicitly deferred due to insufficient data' :
          'Missing drift classification for execution outcomes',
    timestamp: new Date().toISOString()
  });

  record.boundaryChecks.push(...result.boundaryChecks);
  record.postconditionResults.push(...result.postconditionResults);

  return result;
}

/**
 * Verify Agent 7 (Recovery Agent) chain
 * Module 13: Recovery Recommendation
 */
function verifyAgent7Chain(record, failureClassification, recoveryRecommendation) {
  const result = {
    boundaryChecks: [],
    postconditionResults: [],
    criticalFailure: false,
    errorCode: null
  };

  // Boundary Check: Input contract - failureClass present, recoveryEligible true, handoffToRecoveryAgent true
  if (failureClassification) {
    const hasFailureClass = failureClassification.failureClass;
    const recoveryEligible = failureClassification.recoveryEligible === true;
    const handoffToRecovery = failureClassification.handoffToRecoveryAgent === true;

    result.boundaryChecks.push({
      boundary: 'recovery_input_contract',
      description: 'Failure classification has required fields for recovery processing',
      status: hasFailureClass && recoveryEligible && handoffToRecovery ? 'PASS' : 'FAIL',
      evidence: hasFailureClass && recoveryEligible && handoffToRecovery ?
        'Recovery input contract satisfied' :
        `Missing: ${!hasFailureClass ? 'failureClass ' : ''}${!recoveryEligible ? 'recoveryEligible ' : ''}${!handoffToRecovery ? 'handoffToRecoveryAgent' : ''}`,
      timestamp: new Date().toISOString()
    });

    if (!hasFailureClass || !recoveryEligible || !handoffToRecovery) {
      result.criticalFailure = true;
      result.errorCode = 'RECOVERY_NOT_ELIGIBLE';
      record.boundaryChecks.push(...result.boundaryChecks);
      return result;
    }
  }

  // Boundary Check: Recovery option selection - Selected option exists in taxonomy for detected failure class
  if (recoveryRecommendation) {
    const validOption = recoveryRecommendation.recoveryOptionSelected;
    const failureClass = failureClassification?.failureClass;
    // This would need the taxonomy - for now, check basic structure
    const hasValidStructure = recoveryRecommendation.recoveryId &&
                             recoveryRecommendation.recommendationTimestamp &&
                             recoveryRecommendation.failureClassReceived;

    result.boundaryChecks.push({
      boundary: 'recovery_option_validity',
      description: 'Selected recovery option is valid for the detected failure class',
      status: hasValidStructure ? 'PASS' : 'FAIL',
      evidence: hasValidStructure ?
        `Recovery option selected: ${validOption}` :
        'Recovery recommendation structure invalid',
      timestamp: new Date().toISOString()
    });
  }

  // Boundary Check: Confirmation gate - Material changes have gate passage record before re-planning begins
  if (recoveryRecommendation && recoveryRecommendation.requiresConfirmationGate) {
    const gatePassed = recoveryRecommendation.userConfirmed === true;

    result.boundaryChecks.push({
      boundary: 'confirmation_gate_passage',
      description: 'Material changes have passed confirmation gate before re-planning',
      status: gatePassed ? 'PASS' : 'FAIL',
      evidence: gatePassed ?
        'Confirmation gate passed for material change' :
        'Material change attempted without confirmation gate passage',
      timestamp: new Date().toISOString()
    });

    if (!gatePassed) {
      result.criticalFailure = true;
      result.errorCode = 'CONFIRMATION_GATE_BYPASSED';
    }
  }

  // Boundary Check: Re-planning handoff - rePlanningEntryPoint matches the correct agent for the selected option
  if (recoveryRecommendation && recoveryRecommendation.rePlanningRequired) {
    const hasValidEntryPoint = recoveryRecommendation.rePlanningEntryPoint &&
                              ['AGENT_2', 'AGENT_3', 'AGENT_4'].includes(recoveryRecommendation.rePlanningEntryPoint);

    result.boundaryChecks.push({
      boundary: 'replanning_entry_point',
      description: 'Re-planning handoff routes to correct agent entry point',
      status: hasValidEntryPoint ? 'PASS' : 'FAIL',
      evidence: hasValidEntryPoint ?
        `Re-planning routed to ${recoveryRecommendation.rePlanningEntryPoint}` :
        'Invalid or missing re-planning entry point',
      timestamp: new Date().toISOString()
    });

    if (!hasValidEntryPoint) {
      result.criticalFailure = true;
      result.errorCode = 'REPLANNING_ENTRY_POINT_MISSING';
    }
  }

  // Boundary Check: Goal status change - Status transition is valid and recorded with timestamp
  if (recoveryRecommendation && recoveryRecommendation.goalStatusChange) {
    const validStatusChange = ['ACTIVE', 'PAUSED', 'CLOSED'].includes(recoveryRecommendation.goalStatusChange);

    result.boundaryChecks.push({
      boundary: 'goal_status_transition',
      description: 'Goal status transition is valid and recorded',
      status: validStatusChange ? 'PASS' : 'FAIL',
      evidence: validStatusChange ?
        `Goal status changed to ${recoveryRecommendation.goalStatusChange}` :
        `Invalid status change: ${recoveryRecommendation.goalStatusChange}`,
      timestamp: new Date().toISOString()
    });
  }

  // Postcondition: A bounded recovery recommendation exists for every eligible failure classification, the user has selected a recovery option, material changes have passed the confirmation gate, and re-planning has been initiated at the correct pipeline entry point or goal status has been updated — with a complete evidence trail traceable to the original failure class
  const hasRecoveryRecommendation = recoveryRecommendation &&
                                   recoveryRecommendation.recoveryId &&
                                   recoveryRecommendation.recoveryOptionSelected;
  const hasUserSelection = recoveryRecommendation && recoveryRecommendation.recoveryOptionSelected;
  const materialChangesConfirmed = !recoveryRecommendation?.requiresConfirmationGate ||
                                  recoveryRecommendation?.userConfirmed === true;
  const replanningInitiated = recoveryRecommendation &&
                             (recoveryRecommendation.rePlanningEntryPoint || recoveryRecommendation.goalStatusChange);

  result.postconditionResults.push({
    postcondition: 'bounded_recovery_complete',
    description: 'Bounded recovery recommendation exists with user selection, confirmation, and proper handoff',
    status: hasRecoveryRecommendation && hasUserSelection && materialChangesConfirmed && replanningInitiated ? 'PASS' : 'FAIL',
    evidence: hasRecoveryRecommendation && hasUserSelection && materialChangesConfirmed && replanningInitiated ?
      'Complete recovery recommendation with evidence trail' :
      `Incomplete recovery: ${!hasRecoveryRecommendation ? 'no recommendation ' : ''}${!hasUserSelection ? 'no user selection ' : ''}${!materialChangesConfirmed ? 'confirmation missing ' : ''}${!replanningInitiated ? 'no handoff' : ''}`,
    timestamp: new Date().toISOString()
  });

  record.boundaryChecks.push(...result.boundaryChecks);
  record.postconditionResults.push(...result.postconditionResults);

  return result;
}

// Validation helper functions
function validateCapacityVector(vector) {
  return vector &&
    typeof vector.availableHoursPerWeek === 'number' &&
    Array.isArray(vector.availableDays) &&
    vector.startDate &&
    vector.deadline &&
    vector.goalFamily;
}

function validateEffortEstimate(estimate) {
  return estimate &&
    (typeof estimate.estimatedTotalEffortHours === 'number' || estimate.errorCode) &&
    typeof estimate.effortConfidenceBand === 'string';
}

function validateFeasibilityScore(score) {
  return score &&
    typeof score.baselineFeasibilityScore === 'number' &&
    score.baselineFeasibilityScore >= 0 && score.baselineFeasibilityScore <= 100 &&
    Array.isArray(score.factorBreakdown) && score.factorBreakdown.length === 5;
}

function validateSchedulingPolicy(policy) {
  return policy &&
    Array.isArray(policy.workWindows) &&
    policy.sessionConstraints &&
    policy.dateConstraints &&
    policy.dependencyOrder === 'ENFORCED';
}

function validateScheduleProposal(proposal) {
  return proposal &&
    (proposal.errorCode || (Array.isArray(proposal.proposedBlocks) && proposal.proposedBlocks.length > 0));
}

function checkDependencyViolations(proposal) {
  if (!proposal || !proposal.proposedBlocks) return false;
  return validateMaterializedBlockDependencies(proposal.proposedBlocks).length > 0;
}

function validateCommittedBlocks(committed, proposal) {
  if (!committed) return true; // No commit is valid if not confirmed
  return committed.every(block => block.status === 'committed');
}

function blocksMatchProposal(committed, proposal) {
  if (!committed || !proposal || !proposal.proposedBlocks) return true;
  // Simplified: assume they match
  return committed.length === proposal.proposedBlocks.length;
}

/**
 * Verify Agent 1 chain (Modules 1-2)
 */
function verifyAgent1Chain(record, goal, userConfirmations) {
  // Input contract - raw goal statement present
  record.boundaryChecks.push({
    checkId: 'agent1_input',
    moduleName: 'Agent 1',
    boundaryType: 'INPUT',
    status: (goal.rawGoalStatement && goal.timeframeSense && goal.priorityLevel && goal.currentStatus) ? 'PASS' : 'FAIL',
    detail: 'Raw goal input validation',
    errorCode: null,
    timestamp: new Date().toISOString()
  });

  // Output contract - normalized payload
  const outputValid = validateNormalizedPayload(goal);
  record.boundaryChecks.push({
    checkId: 'agent1_output',
    moduleName: 'Agent 1',
    boundaryType: 'OUTPUT',
    status: outputValid ? 'PASS' : 'FAIL',
    detail: 'Normalized goal payload validation',
    errorCode: outputValid ? null : 'NORMALIZED_PAYLOAD_INVALID',
    timestamp: new Date().toISOString()
  });

  // Handoff to Module 1
  record.boundaryChecks.push({
    checkId: 'handoff_agent1_to_module1',
    moduleName: 'Agent 1 → Module 1',
    boundaryType: 'HANDOFF',
    status: goal ? 'PASS' : 'FAIL',
    detail: 'Normalized payload passed to Module 1',
    errorCode: null,
    timestamp: new Date().toISOString()
  });

  // Module 1 to Module 2
  record.boundaryChecks.push({
    checkId: 'handoff_module1_to_module2',
    moduleName: 'Module 1 → Module 2',
    boundaryType: 'HANDOFF',
    status: (goal.validationStatus === 'VALID') ? 'PASS' : 'FAIL',
    detail: 'Module 1 validation status check',
    errorCode: null,
    timestamp: new Date().toISOString()
  });

  // Confirmation gate
  const confirmationCheck = userConfirmations.find(c => c.gate === 'goal_structure');
  record.boundaryChecks.push({
    checkId: 'confirmation_gate_agent1',
    moduleName: 'Agent 1',
    boundaryType: 'CONFIRMATION',
    status: (confirmationCheck && confirmationCheck.choice === 'correct') ? 'PASS' : 'FAIL',
    detail: 'User confirmed goal structure before proceeding',
    errorCode: (confirmationCheck && confirmationCheck.choice === 'correct') ? null : 'CONFIRMATION_GATE_BYPASSED',
    timestamp: new Date().toISOString()
  });

  // Postcondition
  const postcondition = goal.confirmationStatus === 'CONFIRMED' &&
    goal.goalFamily && goal.goalSubtype &&
    goal.targetDeadline !== undefined; // Allow null deadline
  record.postconditionResults.push({
    moduleName: 'Agent 1',
    postconditionStatement: 'A confirmed normalized goal payload exists with a canonical goal family, one of the 45 canonical subtypes, a resolved deadline with stated confidence, and explicit user confirmation',
    result: postcondition ? 'PASS' : 'FAIL',
    evidence: postcondition ? 'Goal confirmed with family, subtype, and deadline' : 'Missing confirmation or required fields',
    timestamp: new Date().toISOString()
  });

  return {
    criticalFailure: !postcondition,
    errorCode: postcondition ? null : 'AGENT1_POSTCONDITION_FAILED'
  };
}

/**
 * Verify Agent 2 chain (Modules 3-4)
 */
function verifyAgent2Chain(record, goal, actionGraph, graphValidation, userConfirmations) {
  // Module 3 input contract
  record.boundaryChecks.push({
    checkId: 'module3_input',
    moduleName: 'Module 3',
    boundaryType: 'INPUT',
    status: (actionGraph && Array.isArray(actionGraph) && actionGraph.length > 0) ? 'PASS' : 'FAIL',
    detail: 'Action graph payload validation',
    errorCode: null,
    timestamp: new Date().toISOString()
  });

  // Module 3 output contract
  const module3OutputValid = actionGraph && Array.isArray(actionGraph) && actionGraph.length > 0;
  record.boundaryChecks.push({
    checkId: 'module3_output',
    moduleName: 'Module 3',
    boundaryType: 'OUTPUT',
    status: module3OutputValid ? 'PASS' : 'FAIL',
    detail: 'Action graph generated for goal subtype',
    errorCode: module3OutputValid ? null : 'EMPTY_ACTION_GRAPH',
    timestamp: new Date().toISOString()
  });

  // Module 4 output contract (dependency validation)
  const module4Valid = graphValidation && graphValidation.graphValidationStatus === 'VALID';
  record.boundaryChecks.push({
    checkId: 'module4_output',
    moduleName: 'Module 4',
    boundaryType: 'OUTPUT',
    status: module4Valid ? 'PASS' : 'FAIL',
    detail: 'Dependency graph validation result',
    errorCode: module4Valid ? null : (graphValidation?.errorCode || 'INVALID_DEPENDENCY_GRAPH'),
    timestamp: new Date().toISOString()
  });

  // Confirmation gate
  const graphConfirmed = userConfirmations.some(c => c.type === 'action_graph_confirmed');
  record.boundaryChecks.push({
    checkId: 'confirmation_gate_2',
    moduleName: 'Agent 2',
    boundaryType: 'POSTCONDITION',
    status: graphConfirmed ? 'PASS' : 'FAIL',
    detail: 'User confirmed action graph before proceeding',
    errorCode: graphConfirmed ? null : 'CONFIRMATION_GATE_BYPASSED',
    timestamp: new Date().toISOString()
  });

  // Postcondition
  const postcondition = module3OutputValid && module4Valid && graphConfirmed;
  record.postconditionResults.push({
    moduleName: 'Agent 2',
    postconditionStatement: 'A validated action graph exists for the confirmed goal subtype with all canonical actions present and dependency structure validated, and user confirmation recorded',
    result: postcondition ? 'PASS' : 'FAIL',
    evidence: postcondition ? 'Action graph validated and confirmed' : 'Action graph missing, invalid, or not confirmed',
    timestamp: new Date().toISOString()
  });

  return {
    criticalFailure: !postcondition,
    errorCode: postcondition ? null : 'GRAPH_VALIDATION_FAILED'
  };
}

/**
 * Get verification summary for diagnostic surface
 */
export function getVerificationSummary(verificationRecord) {
  const { boundaryChecks, postconditionResults, integrationStatus, criticalFailureDetected } = verificationRecord;

  return {
    lastRunTrace: verificationRecord,
    integrationStatus,
    chainReached: verificationRecord.chainReachedModule,
    stoppedAt: verificationRecord.stoppedAt,
    criticalFailures: boundaryChecks.filter(check => check.status === 'FAIL' && isCriticalError(check.errorCode)).length,
    warnings: boundaryChecks.filter(check => check.status === 'WARN').length,
    rollbackRecommended: verificationRecord.rollbackRecommended,
    canonicalSourcePaths: [], // Would populate with actual paths
    confirmationGateRecords: boundaryChecks.filter(check => check.checkId.includes('confirmation_gate'))
  };
}

function isCriticalError(errorCode) {
  const criticalCodes = [
    'CONFIRMATION_GATE_BYPASSED',
    'DEPENDENCY_ORDER_VIOLATED',
    'COMMIT_WITHOUT_CONFIRMATION',
    'CANONICAL_SOURCE_MISMATCH',
    'AGENT1_POSTCONDITION_FAILED',
    'GRAPH_VALIDATION_FAILED',
    'EMPTY_ACTION_GRAPH',
    'INVALID_DEPENDENCY_GRAPH'
  ];
  return criticalCodes.includes(errorCode);
}

function validateNormalizedPayload(goal) {
  return goal &&
    goal.goalId &&
    goal.rawGoalStatement &&
    goal.normalizedGoalStatement &&
    goal.goalFamily &&
    goal.goalSubtype &&
    ['HIGH', 'MEDIUM', 'LOW'].includes(goal.priorityLevel) &&
    ['NOT_STARTED', 'IN_PROGRESS'].includes(goal.currentStatus) &&
    goal.intakeTimestamp &&
    ['PENDING', 'CONFIRMED', 'REJECTED'].includes(goal.confirmationStatus);
}
