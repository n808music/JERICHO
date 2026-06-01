/**
 * Tests for Recovery Agent
 */

import {
  processRecoveryRecommendation,
  getAvailableRecoveryOptions,
  RECOVERY_OPTIONS,
  FAILURE_CLASSES,
  SEVERITY_LEVELS,
  RECOVERY_URGENCY
} from '../../src/core/recovery-agent.js';

describe('Recovery Agent', () => {
  let mockFailureClassification;

  beforeEach(() => {
    mockFailureClassification = {
      goalId: 'test-goal-123',
      cycleId: 'cycle-test-1',
      failureClass: FAILURE_CLASSES.CAPACITY_OVERCOMMIT,
      failureClassRationale: 'Consistent pacing behind schedule combined with low completion rate',
      driftPatternsConsumed: ['PACING_DRIFT', 'COMPLETION_RATE_DRIFT'],
      severityLevel: SEVERITY_LEVELS.MEDIUM,
      recoveryEligible: true,
      handoffToRecoveryAgent: true,
      recoveryUrgency: RECOVERY_URGENCY.PROMPT,
      stabilityScore: 0.75,
      pacingGap: -15,
      daysRemaining: 30,
      totalBlocksRemaining: 10,
      totalBlocksMissed: 2,
      goalFamily: 'VentureLaunch',
      goalSubtype: 'SaaS Product Launch',
      targetDeadline: '2026-06-01T00:00:00.000Z'
    };
  });

  describe('processRecoveryRecommendation', () => {
    it('should process a valid recovery recommendation', () => {
      const selectedOption = RECOVERY_OPTIONS.REDUCE_WEEKLY_HOURS;
      const userConfirmed = false; // Not required for this option

      const result = processRecoveryRecommendation(mockFailureClassification, selectedOption, userConfirmed);

      expect(result.success).toBe(true);
      expect(result.recoveryRecommendation).toMatchObject({
        goalId: mockFailureClassification.goalId,
        cycleId: mockFailureClassification.cycleId,
        failureClassReceived: mockFailureClassification.failureClass,
        recoveryOptionSelected: selectedOption,
        requiresConfirmationGate: false,
        rePlanningRequired: true,
        rePlanningEntryPoint: 'AGENT_4',
        goalStatusChange: null
      });
    });

    it('should reject recovery for ineligible failure classification', () => {
      const ineligibleClassification = {
        ...mockFailureClassification,
        recoveryEligible: false
      };

      const result = processRecoveryRecommendation(ineligibleClassification, RECOVERY_OPTIONS.REDUCE_WEEKLY_HOURS);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('RECOVERY_NOT_ELIGIBLE');
    });

    it('should reject out-of-taxonomy recovery options', () => {
      const invalidOption = 'INVALID_OPTION';

      const result = processRecoveryRecommendation(mockFailureClassification, invalidOption);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('RECOVERY_TAXONOMY_EXCEEDED');
    });

    it('should require confirmation for material changes', () => {
      const materialOption = RECOVERY_OPTIONS.REDUCE_SCOPE;
      const userConfirmed = false;

      const result = processRecoveryRecommendation(mockFailureClassification, materialOption, userConfirmed);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CONFIRMATION_GATE_BYPASSED');
    });

    it('should accept confirmed material changes', () => {
      const materialOption = RECOVERY_OPTIONS.REDUCE_SCOPE;
      const userConfirmed = true;

      const result = processRecoveryRecommendation(mockFailureClassification, materialOption, userConfirmed);

      expect(result.success).toBe(true);
      expect(result.recoveryRecommendation.userConfirmed).toBe(true);
      expect(result.recoveryRecommendation.rePlanningEntryPoint).toBe('AGENT_2');
    });
  });

  describe('getAvailableRecoveryOptions', () => {
    it('should return valid options for CAPACITY_OVERCOMMIT', () => {
      const options = getAvailableRecoveryOptions(mockFailureClassification);

      expect(options).toHaveLength(4);
      const optionKeys = options.map(o => o.option);
      expect(optionKeys).toContain(RECOVERY_OPTIONS.REDUCE_WEEKLY_HOURS);
      expect(optionKeys).toContain(RECOVERY_OPTIONS.EXTEND_DEADLINE);
      expect(optionKeys).toContain(RECOVERY_OPTIONS.REDUCE_SCOPE);
      expect(optionKeys).toContain(RECOVERY_OPTIONS.ACKNOWLEDGE_AND_CONTINUE);
    });

    it('should return valid options for MOTIVATION_DRIFT', () => {
      const motivationDrift = {
        ...mockFailureClassification,
        failureClass: FAILURE_CLASSES.MOTIVATION_DRIFT
      };

      const options = getAvailableRecoveryOptions(motivationDrift);

      expect(options).toHaveLength(5);
      const optionKeys = options.map(o => o.option);
      expect(optionKeys).toContain(RECOVERY_OPTIONS.REDUCE_SESSION_LENGTH);
      expect(optionKeys).toContain(RECOVERY_OPTIONS.FRONT_LOAD_QUICK_WINS);
      expect(optionKeys).toContain(RECOVERY_OPTIONS.REDUCE_SCOPE);
      expect(optionKeys).toContain(RECOVERY_OPTIONS.EXTEND_DEADLINE);
      expect(optionKeys).toContain(RECOVERY_OPTIONS.CLOSE_GOAL);
    });

    it('should mark confirmation-required options correctly', () => {
      const options = getAvailableRecoveryOptions(mockFailureClassification);

      const reduceScopeOption = options.find(o => o.option === RECOVERY_OPTIONS.REDUCE_SCOPE);
      expect(reduceScopeOption.requiresConfirmation).toBe(true);

      const reduceHoursOption = options.find(o => o.option === RECOVERY_OPTIONS.REDUCE_WEEKLY_HOURS);
      expect(reduceHoursOption.requiresConfirmation).toBe(false);
    });
  });

  describe('Goal Family Adjustments', () => {
    it('should apply VentureLaunch CLOSE_GOAL extra confirmation', () => {
      const ventureLaunchDrift = {
        ...mockFailureClassification,
        failureClass: FAILURE_CLASSES.MOTIVATION_DRIFT,
        goalFamily: 'VentureLaunch'
      };

      const options = getAvailableRecoveryOptions(ventureLaunchDrift);
      const closeGoalOption = options.find(o => o.option === RECOVERY_OPTIONS.CLOSE_GOAL);

      expect(closeGoalOption.extraConfirmation).toContain('Financial and strategic implications');
    });

    it('should exclude SkillAcquisition REDUCE_SCOPE option', () => {
      const skillAcquisitionDrift = {
        ...mockFailureClassification,
        failureClass: FAILURE_CLASSES.MOTIVATION_DRIFT,
        goalFamily: 'SkillAcquisition'
      };

      const options = getAvailableRecoveryOptions(skillAcquisitionDrift);
      const hasReduceScope = options.some(o => o.option === RECOVERY_OPTIONS.REDUCE_SCOPE);

      expect(hasReduceScope).toBe(false);
    });

    it('should prioritize CreativeProduction FRONT_LOAD_QUICK_WINS', () => {
      const creativeDrift = {
        ...mockFailureClassification,
        failureClass: FAILURE_CLASSES.MOTIVATION_DRIFT,
        goalFamily: 'CreativeProduction'
      };

      const options = getAvailableRecoveryOptions(creativeDrift);
      const firstOption = options[0];

      expect(firstOption.option).toBe(RECOVERY_OPTIONS.FRONT_LOAD_QUICK_WINS);
    });

    it('should exclude SalesPipeline PAUSE_GOAL for DEADLINE_COMPRESSION', () => {
      const salesDeadlineCompression = {
        ...mockFailureClassification,
        failureClass: FAILURE_CLASSES.DEADLINE_COMPRESSION,
        goalFamily: 'SalesPipeline'
      };

      const options = getAvailableRecoveryOptions(salesDeadlineCompression);
      const hasPauseGoal = options.some(o => o.option === RECOVERY_OPTIONS.PAUSE_GOAL);

      expect(hasPauseGoal).toBe(false);
    });
  });

  describe('Re-planning Entry Points', () => {
    it('should route REDUCE_SCOPE to Agent 2', () => {
      const result = processRecoveryRecommendation(mockFailureClassification, RECOVERY_OPTIONS.REDUCE_SCOPE, true);

      expect(result.recoveryRecommendation.rePlanningEntryPoint).toBe('AGENT_2');
      expect(result.recoveryRecommendation.rePlanningRequired).toBe(true);
    });

    it('should route EXTEND_DEADLINE to Agent 3', () => {
      const result = processRecoveryRecommendation(mockFailureClassification, RECOVERY_OPTIONS.EXTEND_DEADLINE);

      expect(result.recoveryRecommendation.rePlanningEntryPoint).toBe('AGENT_3');
      expect(result.recoveryRecommendation.rePlanningRequired).toBe(true);
    });

    it('should route REDUCE_WEEKLY_HOURS to Agent 4', () => {
      const result = processRecoveryRecommendation(mockFailureClassification, RECOVERY_OPTIONS.REDUCE_WEEKLY_HOURS);

      expect(result.recoveryRecommendation.rePlanningEntryPoint).toBe('AGENT_4');
      expect(result.recoveryRecommendation.rePlanningRequired).toBe(true);
    });

    it('should not require re-planning for ACKNOWLEDGE_AND_CONTINUE', () => {
      const result = processRecoveryRecommendation(mockFailureClassification, RECOVERY_OPTIONS.ACKNOWLEDGE_AND_CONTINUE);

      expect(result.recoveryRecommendation.rePlanningRequired).toBe(false);
      expect(result.recoveryRecommendation.rePlanningEntryPoint).toBe(null);
    });
  });

  describe('Goal Status Changes', () => {
    it('should set goal status to PAUSED for PAUSE_GOAL', () => {
      const dependencyBlock = {
        ...mockFailureClassification,
        failureClass: FAILURE_CLASSES.DEPENDENCY_BLOCK
      };

      const result = processRecoveryRecommendation(dependencyBlock, RECOVERY_OPTIONS.PAUSE_GOAL);

      expect(result.recoveryRecommendation.goalStatusChange).toBe('PAUSED');
      expect(result.recoveryRecommendation.recommendationClass).toBe('STATUS_CHANGE');
    });

    it('should set goal status to CLOSED for CLOSE_GOAL', () => {
      const motivationDrift = {
        ...mockFailureClassification,
        failureClass: FAILURE_CLASSES.MOTIVATION_DRIFT
      };

      const result = processRecoveryRecommendation(motivationDrift, RECOVERY_OPTIONS.CLOSE_GOAL, true);

      expect(result.recoveryRecommendation.goalStatusChange).toBe('CLOSED');
      expect(result.recoveryRecommendation.recommendationClass).toBe('STATUS_CHANGE');
    });
  });

  describe('Error Handling', () => {
    it('should handle RECOVERY_NOT_ELIGIBLE correctly', () => {
      const ineligible = { ...mockFailureClassification, recoveryEligible: false };

      const result = processRecoveryRecommendation(ineligible, RECOVERY_OPTIONS.REDUCE_WEEKLY_HOURS);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('RECOVERY_NOT_ELIGIBLE');
    });

    it('should handle RECOVERY_TAXONOMY_EXCEEDED correctly', () => {
      const result = processRecoveryRecommendation(mockFailureClassification, 'INVALID_OPTION');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('RECOVERY_TAXONOMY_EXCEEDED');
    });

    it('should handle CONFIRMATION_GATE_BYPASSED correctly', () => {
      const result = processRecoveryRecommendation(mockFailureClassification, RECOVERY_OPTIONS.REDUCE_SCOPE, false);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CONFIRMATION_GATE_BYPASSED');
    });
  });

  describe('All Failure Classes', () => {
    it('should handle CAPACITY_OVERCOMMIT options', () => {
      const capacityOvercommit = { ...mockFailureClassification, failureClass: FAILURE_CLASSES.CAPACITY_OVERCOMMIT };
      const options = getAvailableRecoveryOptions(capacityOvercommit);

      expect(options).toHaveLength(4);
    });

    it('should handle SCHEDULE_MISMATCH options', () => {
      const scheduleMismatch = { ...mockFailureClassification, failureClass: FAILURE_CLASSES.SCHEDULE_MISMATCH };
      const options = getAvailableRecoveryOptions(scheduleMismatch);

      expect(options).toHaveLength(3);
    });

    it('should handle MOTIVATION_DRIFT options', () => {
      const motivationDrift = { ...mockFailureClassification, failureClass: FAILURE_CLASSES.MOTIVATION_DRIFT };
      const options = getAvailableRecoveryOptions(motivationDrift);

      expect(options).toHaveLength(5);
    });

    it('should handle DEPENDENCY_BLOCK options', () => {
      const dependencyBlock = { ...mockFailureClassification, failureClass: FAILURE_CLASSES.DEPENDENCY_BLOCK };
      const options = getAvailableRecoveryOptions(dependencyBlock);

      expect(options).toHaveLength(3);
    });

    it('should handle EXTERNAL_DISRUPTION options', () => {
      const externalDisruption = { ...mockFailureClassification, failureClass: FAILURE_CLASSES.EXTERNAL_DISRUPTION };
      const options = getAvailableRecoveryOptions(externalDisruption);

      expect(options).toHaveLength(4);
    });

    it('should handle DEADLINE_COMPRESSION options', () => {
      const deadlineCompression = { ...mockFailureClassification, failureClass: FAILURE_CLASSES.DEADLINE_COMPRESSION };
      const options = getAvailableRecoveryOptions(deadlineCompression);

      expect(options).toHaveLength(4);
    });

    it('should handle SCOPE_UNDERESTIMATE options', () => {
      const scopeUnderestimate = { ...mockFailureClassification, failureClass: FAILURE_CLASSES.SCOPE_UNDERESTIMATE };
      const options = getAvailableRecoveryOptions(scopeUnderestimate);

      expect(options).toHaveLength(3);
    });
  });
});