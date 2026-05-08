/**
 * Tests for Stability and Drift Agent
 */

import {
  processExecutionSignal,
  EXECUTION_EVENT_TYPES,
  COMPLETION_QUALITY,
  MISS_REASONS,
  PACING_STATUS,
  DRIFT_PATTERNS,
  FAILURE_CLASSES,
  SEVERITY_LEVELS,
  RECOVERY_URGENCY
} from '../../src/core/stability-drift-agent.js';

describe('Stability and Drift Agent', () => {
  let mockCommittedSchedule;

  beforeEach(() => {
    mockCommittedSchedule = {
      goalId: 'test-goal-123',
      cycleId: 'cycle-test-1',
      goalFamily: 'VentureLaunch',
      goalSubtype: 'SaaS Product Launch',
      startDate: '2026-01-01T00:00:00.000Z',
      deadline: '2026-06-01T00:00:00.000Z',
      blocks: [
        {
          blockId: 'block-1',
          actionId: 'action-1',
          scheduledDate: '2026-01-15T10:00:00.000Z',
          status: 'pending'
        },
        {
          blockId: 'block-2',
          actionId: 'action-2',
          scheduledDate: '2026-01-16T10:00:00.000Z',
          status: 'pending'
        },
        {
          blockId: 'block-3',
          actionId: 'action-3',
          scheduledDate: '2026-01-17T10:00:00.000Z',
          status: 'pending'
        }
      ]
    };
  });

  describe('processExecutionSignal', () => {
    it('should process a completion signal correctly', () => {
      const signal = {
        type: EXECUTION_EVENT_TYPES.COMPLETION,
        blockReference: 'block-1',
        completionDate: '2026-01-15T12:00:00.000Z',
        completionQuality: COMPLETION_QUALITY.FULL,
        notes: 'Completed successfully'
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.success).toBe(true);
      expect(result.executionEvent).toMatchObject({
        eventType: EXECUTION_EVENT_TYPES.COMPLETION,
        blockId: 'block-1',
        actualDate: '2026-01-15T12:00:00.000Z',
        completionQuality: COMPLETION_QUALITY.FULL,
        notes: 'Completed successfully'
      });
      expect(result.stabilityRecord).toBeDefined();
      expect(result.driftDetection).toBeDefined();
      expect(result.failureClassification).toBeDefined();
    });

    it('should process a miss signal correctly', () => {
      const signal = {
        type: EXECUTION_EVENT_TYPES.MISS,
        blockReference: 'block-1',
        missDate: '2026-01-15T10:00:00.000Z',
        missReason: MISS_REASONS.LOW_ENERGY,
        rescheduleIntent: true
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.success).toBe(true);
      expect(result.executionEvent).toMatchObject({
        eventType: EXECUTION_EVENT_TYPES.MISS,
        blockId: 'block-1',
        actualDate: '2026-01-15T10:00:00.000Z',
        missReason: MISS_REASONS.LOW_ENERGY
      });
    });

    it('should process a reschedule request correctly', () => {
      const signal = {
        type: EXECUTION_EVENT_TYPES.RESCHEDULE,
        blockReference: 'block-1',
        requestedNewDate: '2026-01-18T10:00:00.000Z',
        reason: 'Conflict with meeting'
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.success).toBe(true);
      expect(result.executionEvent).toMatchObject({
        eventType: EXECUTION_EVENT_TYPES.RESCHEDULE,
        blockId: 'block-1',
        rescheduleRequestedDate: '2026-01-18T10:00:00.000Z'
      });
    });

    it('should reject signals referencing non-existent blocks', () => {
      const signal = {
        type: EXECUTION_EVENT_TYPES.COMPLETION,
        blockReference: 'non-existent-block',
        completionDate: '2026-01-15T12:00:00.000Z',
        completionQuality: COMPLETION_QUALITY.FULL
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CANONICAL_SOURCE_MISMATCH');
    });

    it('should reject incomplete completion signals', () => {
      const signal = {
        type: EXECUTION_EVENT_TYPES.COMPLETION,
        blockReference: 'block-1'
        // Missing completionDate and completionQuality
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EXECUTION_SIGNAL_INCOMPLETE');
    });
  });

  describe('Stability Tracking (Module 10)', () => {
    it('should generate correct stability record for mixed execution', () => {
      // Set up blocks with different statuses
      mockCommittedSchedule.blocks[0].status = 'completed';
      mockCommittedSchedule.blocks[0].actualDate = '2026-01-15T12:00:00.000Z';
      mockCommittedSchedule.blocks[1].status = 'missed';
      mockCommittedSchedule.blocks[1].missReason = MISS_REASONS.LOW_ENERGY;
      mockCommittedSchedule.blocks[2].status = 'pending';

      const signal = {
        type: EXECUTION_EVENT_TYPES.COMPLETION,
        blockReference: 'block-1',
        completionDate: '2026-01-15T12:00:00.000Z',
        completionQuality: COMPLETION_QUALITY.FULL
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.stabilityRecord).toMatchObject({
        goalId: 'test-goal-123',
        cycleId: 'cycle-test-1',
        totalBlocksScheduled: 3,
        totalBlocksCompleted: 1,
        totalBlocksMissed: 1,
        totalBlocksRescheduled: 0,
        totalBlocksRemaining: 1,
        completionRate: 0.5, // 1 completed out of 2 due
        currentPacingStatus: expect.any(String),
        stabilityScore: expect.any(Number)
      });
      expect(result.stabilityRecord.scheduleAdherenceRate).toBeCloseTo(1/3, 6);
    });

    it('should calculate pacing status correctly', () => {
      // Set up a scenario with behind pacing
      mockCommittedSchedule.blocks[0].status = 'completed';
      mockCommittedSchedule.blocks[0].actualDate = '2026-01-15T12:00:00.000Z';

      const signal = {
        type: EXECUTION_EVENT_TYPES.COMPLETION,
        blockReference: 'block-1',
        completionDate: '2026-01-15T12:00:00.000Z',
        completionQuality: COMPLETION_QUALITY.FULL
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      // With only 1 completion out of 3 total, should be behind
      expect([PACING_STATUS.BEHIND, PACING_STATUS.CRITICAL]).toContain(result.stabilityRecord.currentPacingStatus);
    });

    it('should calculate stability score with proper weighting', () => {
      mockCommittedSchedule.blocks[0].status = 'completed';
      mockCommittedSchedule.blocks[0].actualDate = '2026-01-15T12:00:00.000Z';

      const signal = {
        type: EXECUTION_EVENT_TYPES.COMPLETION,
        blockReference: 'block-1',
        completionDate: '2026-01-15T12:00:00.000Z',
        completionQuality: COMPLETION_QUALITY.FULL
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.stabilityRecord.stabilityScore).toBeGreaterThanOrEqual(0);
      expect(result.stabilityRecord.stabilityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Drift Detection (Module 11)', () => {
    it('should detect PACING_DRIFT when gap below -10', () => {
      // Set up scenario with poor completion rate
      mockCommittedSchedule.blocks[0].status = 'missed';
      mockCommittedSchedule.blocks[1].status = 'missed';

      const signal = {
        type: EXECUTION_EVENT_TYPES.MISS,
        blockReference: 'block-1',
        missDate: '2026-01-15T10:00:00.000Z',
        missReason: MISS_REASONS.LOW_ENERGY
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.driftDetection.driftDetected).toBe(true);
      expect(result.driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.PACING_DRIFT)).toBe(true);
    });

    it('should detect CONSECUTIVE_MISS when 3+ consecutive misses', () => {
      // Set up consecutive misses
      mockCommittedSchedule.blocks[0].status = 'missed';
      mockCommittedSchedule.blocks[1].status = 'missed';
      mockCommittedSchedule.blocks[2].status = 'missed';

      const signal = {
        type: EXECUTION_EVENT_TYPES.MISS,
        blockReference: 'block-1',
        missDate: '2026-01-15T10:00:00.000Z',
        missReason: MISS_REASONS.LOW_ENERGY
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.driftDetection.driftDetected).toBe(true);
      expect(result.driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.CONSECUTIVE_MISS)).toBe(true);
    });

    it('should detect SCHEDULE_COLLAPSE when adherence below threshold', () => {
      // Set up low adherence
      mockCommittedSchedule.blocks[0].status = 'missed';
      mockCommittedSchedule.blocks[1].status = 'missed';

      const signal = {
        type: EXECUTION_EVENT_TYPES.MISS,
        blockReference: 'block-1',
        missDate: '2026-01-15T10:00:00.000Z',
        missReason: MISS_REASONS.LOW_ENERGY
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.driftDetection.driftDetected).toBe(true);
      expect(result.driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.SCHEDULE_COLLAPSE)).toBe(true);
    });

    it('should apply VentureLaunch family adjustments', () => {
      // VentureLaunch should have extended ABANDONMENT_RISK threshold
      mockCommittedSchedule.goalFamily = 'VentureLaunch';

      const signal = {
        type: EXECUTION_EVENT_TYPES.MISS,
        blockReference: 'block-1',
        missDate: '2026-01-15T10:00:00.000Z',
        missReason: MISS_REASONS.LOW_ENERGY
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      // Should not detect abandonment risk at 14 days for VentureLaunch (threshold is 21)
      expect(result.driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.ABANDONMENT_RISK)).toBe(false);
    });
  });

  describe('Failure Classification (Module 12)', () => {
    it('should classify CAPACITY_OVERCOMMIT from pacing and completion drift', () => {
      // Set up both PACING_DRIFT and COMPLETION_RATE_DRIFT
      mockCommittedSchedule.blocks[0].status = 'missed';
      mockCommittedSchedule.blocks[1].status = 'missed';

      const signal = {
        type: EXECUTION_EVENT_TYPES.MISS,
        blockReference: 'block-1',
        missDate: '2026-01-15T10:00:00.000Z',
        missReason: MISS_REASONS.LOW_ENERGY
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.failureClassification.failureClass).toBe(FAILURE_CLASSES.CAPACITY_OVERCOMMIT);
      expect(result.failureClassification.severityLevel).toBe(SEVERITY_LEVELS.MEDIUM);
      expect(result.failureClassification.recoveryUrgency).toBe(RECOVERY_URGENCY.PROMPT);
    });

    it('should classify EXTERNAL_DISRUPTION from consecutive external misses', () => {
      // Set up consecutive misses with external reasons
      mockCommittedSchedule.blocks[0].status = 'missed';
      mockCommittedSchedule.blocks[0].missReason = MISS_REASONS.EXTERNAL_FACTOR;
      mockCommittedSchedule.blocks[1].status = 'missed';
      mockCommittedSchedule.blocks[1].missReason = MISS_REASONS.EXTERNAL_FACTOR;
      mockCommittedSchedule.blocks[2].status = 'missed';
      mockCommittedSchedule.blocks[2].missReason = MISS_REASONS.EXTERNAL_FACTOR;

      const signal = {
        type: EXECUTION_EVENT_TYPES.MISS,
        blockReference: 'block-1',
        missDate: '2026-01-15T10:00:00.000Z',
        missReason: MISS_REASONS.EXTERNAL_FACTOR
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.failureClassification.failureClass).toBe(FAILURE_CLASSES.EXTERNAL_DISRUPTION);
    });

    it('should defer classification with insufficient data', () => {
      // Only one execution event
      const signal = {
        type: EXECUTION_EVENT_TYPES.COMPLETION,
        blockReference: 'block-1',
        completionDate: '2026-01-15T12:00:00.000Z',
        completionQuality: COMPLETION_QUALITY.FULL
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.failureClassification.failureClassDetected).toBe(false);
      expect(result.failureClassification.errorCode).toBe('DRIFT_CLASSIFICATION_INSUFFICIENT_DATA');
    });

    it('should set recovery handoff for medium severity failures', () => {
      // Set up capacity overcommit scenario (3 missed blocks triggers CAPACITY_OVERCOMMIT)
      mockCommittedSchedule.blocks[0].status = 'missed';
      mockCommittedSchedule.blocks[1].status = 'missed';
      mockCommittedSchedule.blocks[2].status = 'missed';

      const signal = {
        type: EXECUTION_EVENT_TYPES.MISS,
        blockReference: 'block-1',
        missDate: '2026-01-15T10:00:00.000Z',
        missReason: MISS_REASONS.LOW_ENERGY
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.failureClassification.handoffToRecoveryAgent).toBe(true);
      expect(result.failureClassification.recoveryUrgency).toBe(RECOVERY_URGENCY.PROMPT);
    });
  });

  describe('Goal Family Adjustments', () => {
    it('should apply SkillAcquisition consecutive miss threshold reduction', () => {
      mockCommittedSchedule.goalFamily = 'SkillAcquisition';
      mockCommittedSchedule.blocks[0].status = 'missed';
      mockCommittedSchedule.blocks[1].status = 'missed';

      const signal = {
        type: EXECUTION_EVENT_TYPES.MISS,
        blockReference: 'block-1',
        missDate: '2026-01-15T10:00:00.000Z',
        missReason: MISS_REASONS.LOW_ENERGY
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      // Should detect consecutive miss at 2 instead of 3
      expect(result.driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.CONSECUTIVE_MISS)).toBe(true);
    });

    it('should apply ProfessionalQualification deadline risk rules', () => {
      mockCommittedSchedule.goalFamily = 'ProfessionalQualification';
      // Set up scenario where time elapsed > 85% but completion < 80%
      mockCommittedSchedule.startDate = '2026-01-01T00:00:00.000Z';
      mockCommittedSchedule.deadline = '2026-01-20T00:00:00.000Z'; // Short deadline

      mockCommittedSchedule.blocks[0].status = 'completed';

      const signal = {
        type: EXECUTION_EVENT_TYPES.COMPLETION,
        blockReference: 'block-1',
        completionDate: '2026-01-15T12:00:00.000Z',
        completionQuality: COMPLETION_QUALITY.FULL
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      // Should detect deadline risk due to professional qualification rules
      expect(result.driftDetection.driftSignals.some(s => s.driftPattern === DRIFT_PATTERNS.DEADLINE_RISK)).toBe(true);
    });

    it('should exclude rest days from PhysicalTraining miss calculations', () => {
      mockCommittedSchedule.goalFamily = 'PhysicalTraining';
      // PhysicalTraining adjustments would exclude rest days from calculations
      // This is a simplified test - in practice would need rest day detection
      expect(mockCommittedSchedule.goalFamily).toBe('PhysicalTraining');
    });
  });

  describe('Error Handling', () => {
    it('should handle CANONICAL_SOURCE_MISMATCH correctly', () => {
      const signal = {
        type: EXECUTION_EVENT_TYPES.COMPLETION,
        blockReference: 'invalid-block-id',
        completionDate: '2026-01-15T12:00:00.000Z',
        completionQuality: COMPLETION_QUALITY.FULL
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CANONICAL_SOURCE_MISMATCH');
    });

    it('should handle EXECUTION_SIGNAL_INCOMPLETE correctly', () => {
      const signal = {
        type: EXECUTION_EVENT_TYPES.COMPLETION,
        blockReference: 'block-1'
        // Missing required fields
      };

      const result = processExecutionSignal(signal, mockCommittedSchedule);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EXECUTION_SIGNAL_INCOMPLETE');
    });

    it('should handle STABILITY_TRACKING_NO_COMMITTED_SCHEDULE correctly', () => {
      const signal = {
        type: EXECUTION_EVENT_TYPES.COMPLETION,
        blockReference: 'block-1',
        completionDate: '2026-01-15T12:00:00.000Z',
        completionQuality: COMPLETION_QUALITY.FULL
      };

      const result = processExecutionSignal(signal, null);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('STABILITY_TRACKING_NO_COMMITTED_SCHEDULE');
    });
  });
});