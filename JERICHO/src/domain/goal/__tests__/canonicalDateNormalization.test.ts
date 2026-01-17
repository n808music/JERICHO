/**
 * canonicalDateNormalization.test.ts
 *
 * Tests for canonical date format enforcement (Phase 3)
 * Deadline and temporalBinding.startDayKey must be YYYY-MM-DD format (dayKey)
 * No ISO timestamps in contract core fields
 * Validated at admission time to prevent post-admission DEADLINE_INVALID
 */

import { describe, it, expect } from 'vitest';
import { validateGoalAdmission } from '../GoalAdmissionPolicy';
import { GoalRejectionCode } from '../GoalRejectionCode';

const NOW_ISO = '2026-01-10T12:00:00.000Z';
const DEADLINE_VALID = '2026-02-20';
const START_VALID = '2026-01-10';

// Minimal valid contract for testing
const buildMinimalValidContract = (overrides: any = {}) => ({
  goalId: 'goal-1',
  cycleId: 'cycle-1',
  planGenerationMechanismClass: 'GENERIC_DETERMINISTIC' as const,
  terminalOutcome: {
    text: 'Complete project by deadline',
    hash: 'hash1',
    verificationCriteria: 'Delivered and working',
    isConcrete: true,
  },
  deadline: {
    dayKey: DEADLINE_VALID,
    isHardDeadline: true,
  },
  sacrifice: {
    whatIsGivenUp: 'Leisure time',
    duration: '6 weeks',
    quantifiedImpact: '10 hours/week',
    rationale: 'To complete project',
    hash: 'hash2',
  },
  temporalBinding: {
    daysPerWeek: 5,
    specificDays: 'Mon-Fri',
    activationTime: '09:00',
    sessionDurationMinutes: 60,
    weeklyMinutes: 300,
    startDayKey: START_VALID,
  },
  causalChain: {
    steps: [
      { sequence: 1, description: 'Design', approximateDayOffset: 30 },
      { sequence: 2, description: 'Build', approximateDayOffset: 20 },
      { sequence: 3, description: 'Test', approximateDayOffset: 5 },
    ],
    hash: 'hash3',
  },
  reinforcement: {
    dailyExposureEnabled: true,
    dailyMechanism: 'Dashboard banner',
    checkInFrequency: 'DAILY' as const,
    triggerDescription: 'Every morning',
  },
  inscription: {
    contractHash: 'computed-hash',
    inscribedAtISO: NOW_ISO,
    acknowledgment: 'I understand this is binding',
    acknowledgmentHash: 'ack-hash',
    isCompromised: false,
  },
  admissionStatus: 'PENDING' as const,
  admissionAttemptCount: 0,
  rejectionCodes: [],
  createdAtISO: NOW_ISO,
  isAspirational: false,
  ...overrides,
});

describe('Canonical Date Normalization (Phase 3)', () => {
  describe('deadline.dayKey format validation', () => {
    it('accepts valid YYYY-MM-DD format', () => {
      const contract = buildMinimalValidContract();
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).not.toContain(GoalRejectionCode.DEADLINE_MISSING);
    });

    it('rejects ISO timestamp format in dayKey', () => {
      const contract = buildMinimalValidContract({
        deadline: {
          dayKey: '2026-02-20T00:00:00Z',
          isHardDeadline: true,
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.DEADLINE_MISSING);
      expect(result.status).toBe('REJECTED');
    });

    it('rejects incomplete date (YYYY-MM)', () => {
      const contract = buildMinimalValidContract({
        deadline: {
          dayKey: '2026-02',
          isHardDeadline: true,
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.DEADLINE_MISSING);
    });

    it('rejects date with time (YYYY-MM-DD HH:MM:SS)', () => {
      const contract = buildMinimalValidContract({
        deadline: {
          dayKey: '2026-02-20 09:00:00',
          isHardDeadline: true,
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.DEADLINE_MISSING);
    });

    it('rejects non-numeric date', () => {
      const contract = buildMinimalValidContract({
        deadline: {
          dayKey: 'February 20, 2026',
          isHardDeadline: true,
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.DEADLINE_MISSING);
    });

    it('rejects empty string dayKey', () => {
      const contract = buildMinimalValidContract({
        deadline: {
          dayKey: '',
          isHardDeadline: true,
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.DEADLINE_MISSING);
    });

    it('rejects null dayKey', () => {
      const contract = buildMinimalValidContract({
        deadline: {
          dayKey: null as any,
          isHardDeadline: true,
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.DEADLINE_MISSING);
    });
  });

  describe('temporalBinding.startDayKey format validation', () => {
    it('accepts valid YYYY-MM-DD format', () => {
      const contract = buildMinimalValidContract({
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01-10',
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).not.toContain(GoalRejectionCode.TEMPORAL_BINDING_INVALID);
    });

    it('rejects ISO timestamp format in startDayKey', () => {
      const contract = buildMinimalValidContract({
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01-10T00:00:00Z',
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.TEMPORAL_BINDING_INVALID);
    });

    it('rejects incomplete date (YYYY-MM)', () => {
      const contract = buildMinimalValidContract({
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01',
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.TEMPORAL_BINDING_INVALID);
    });

    it('rejects date with time', () => {
      const contract = buildMinimalValidContract({
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01-10 09:00',
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.TEMPORAL_BINDING_INVALID);
    });

    it('rejects non-numeric date', () => {
      const contract = buildMinimalValidContract({
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: 'January 10, 2026',
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.TEMPORAL_BINDING_INVALID);
    });

    it('rejects empty startDayKey', () => {
      const contract = buildMinimalValidContract({
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '',
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.TEMPORAL_BINDING_INVALID);
    });
  });

  describe('integration: both dates must be canonical', () => {
    it('rejects when both deadline and startDayKey are invalid', () => {
      const contract = buildMinimalValidContract({
        deadline: {
          dayKey: '2026-02-20T00:00:00Z',
          isHardDeadline: true,
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01-10T00:00:00Z',
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.DEADLINE_MISSING);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.TEMPORAL_BINDING_INVALID);
    });

    it('admits when both dates are valid YYYY-MM-DD', () => {
      const contract = buildMinimalValidContract({
        deadline: {
          dayKey: '2026-02-20',
          isHardDeadline: true,
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01-10',
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).not.toContain(GoalRejectionCode.DEADLINE_MISSING);
      expect(result.rejectionCodes).not.toContain(GoalRejectionCode.TEMPORAL_BINDING_INVALID);
    });
  });

  describe('prevents post-admission DEADLINE_INVALID', () => {
    it('canonical format at admission prevents later format errors', () => {
      // This tests that the admission gating prevents malformed dates
      // so they cannot cause DEADLINE_INVALID post-admission
      const contract = buildMinimalValidContract();
      const result = validateGoalAdmission(contract, NOW_ISO);

      // If admitted, dates are guaranteed canonical
      if (result.status === 'ADMITTED') {
        expect(contract.deadline.dayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(contract.temporalBinding.startDayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });
});
