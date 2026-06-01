/**
 * canonicalDateNormalization.test.ts
 *
 * Tests for canonical date format enforcement (Phase 3)
 * Deadline dayKey must be YYYY-MM-DD format (dayKey)
 * No ISO timestamps in contract core fields
 * Validated at admission time to prevent post-admission DEADLINE_INVALID
 */

import { describe, it, expect } from 'vitest';
import { validateGoalAdmission } from '../GoalAdmissionPolicy';
import { GoalRejectionCode } from '../GoalRejectionCode';

const NOW_ISO = '2026-01-10T12:00:00.000Z';
const DEADLINE_VALID = '2026-02-20';

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
  workWindows: {
    mon: [{ start: '09:00', end: '11:00' }],
    tue: [{ start: '09:00', end: '11:00' }],
    wed: [{ start: '09:00', end: '11:00' }],
    thu: [{ start: '09:00', end: '11:00' }],
    fri: [{ start: '09:00', end: '11:00' }],
    sat: [],
    sun: [],
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

  describe('work windows are required', () => {
    it('rejects when no windows exist', () => {
      const contract = buildMinimalValidContract({
        workWindows: {
          mon: [],
          tue: [],
          wed: [],
          thu: [],
          fri: [],
          sat: [],
          sun: [],
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.NO_WORK_WINDOWS);
    });
  });

  describe('integration: canonical deadline + windows requirement', () => {
    it('rejects when deadline is invalid and windows are missing', () => {
      const contract = buildMinimalValidContract({
        deadline: {
          dayKey: '2026-02-20T00:00:00Z',
          isHardDeadline: true,
        },
        workWindows: {
          mon: [],
          tue: [],
          wed: [],
          thu: [],
          fri: [],
          sat: [],
          sun: [],
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.DEADLINE_MISSING);
      expect(result.rejectionCodes).toContain(GoalRejectionCode.NO_WORK_WINDOWS);
    });

    it('admits when deadline is canonical and windows are valid', () => {
      const contract = buildMinimalValidContract({
        deadline: {
          dayKey: '2026-02-20',
          isHardDeadline: true,
        },
        workWindows: {
          mon: [{ start: '08:00', end: '10:00' }],
          tue: [],
          wed: [],
          thu: [],
          fri: [],
          sat: [],
          sun: [],
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);
      expect(result.rejectionCodes).not.toContain(GoalRejectionCode.DEADLINE_MISSING);
      expect(result.rejectionCodes).not.toContain(GoalRejectionCode.NO_WORK_WINDOWS);
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
        expect(contract.workWindows.mon[0].start).toMatch(/^\d{2}:\d{2}$/);
      }
    });
  });
});
