/**
 * goalAdmission.mechanismClass.test.ts
 *
 * Tests for plan generation mechanism class gating in admission policy
 * Phase 3 v1: GENERIC_DETERMINISTIC required and only supported mechanism
 */

import { describe, it, expect } from 'vitest';
import { validateGoalAdmission } from '../GoalAdmissionPolicy';
import { GoalRejectionCode } from '../GoalRejectionCode';

describe('GoalAdmissionPolicy - MechanismClass Gating (Phase 3)', () => {
  // Minimal valid contract for testing (other fields can be placeholders)
  const buildMinimalValidContract = (overrides: any = {}) => ({
    goalId: 'goal-1',
    cycleId: 'cycle-1',
    planGenerationMechanismClass: 'GENERIC_DETERMINISTIC' as const,
    terminalOutcome: {
      text: 'Ship a product by deadline',
      hash: 'hash1',
      verificationCriteria: 'Shipped and live',
      isConcrete: true,
    },
    deadline: {
      dayKey: '2025-03-01',
      isHardDeadline: true,
    },
    sacrifice: {
      whatIsGivenUp: 'Leisure time',
      duration: '6 weeks',
      quantifiedImpact: '10 hours/week',
      rationale: 'To focus on shipping',
      hash: 'hash2',
    },
    temporalBinding: {
      daysPerWeek: 5,
      specificDays: 'Mon-Fri',
      activationTime: '09:00',
      sessionDurationMinutes: 60,
      weeklyMinutes: 300,
      startDayKey: '2025-02-01',
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
      inscribedAtISO: '2025-02-01T00:00:00Z',
      acknowledgment: 'I understand this is binding',
      acknowledgmentHash: 'ack-hash',
      isCompromised: false,
    },
    admissionStatus: 'PENDING' as const,
    admissionAttemptCount: 0,
    rejectionCodes: [],
    createdAtISO: '2025-02-01T00:00:00Z',
    isAspirational: false,
    ...overrides,
  });

  describe('planGenerationMechanismClass validation', () => {
    it('admits valid contract with GENERIC_DETERMINISTIC', () => {
      const contract = buildMinimalValidContract();
      const result = validateGoalAdmission(contract, '2025-02-01T00:00:00Z');

      // Should not include mechanism rejection codes
      expect(result.rejectionCodes).not.toContain(
        GoalRejectionCode.PLAN_GENERATION_MECHANISM_MISSING
      );
      expect(result.rejectionCodes).not.toContain(
        GoalRejectionCode.PLAN_GENERATION_MECHANISM_UNSUPPORTED
      );
    });

    it('rejects missing planGenerationMechanismClass', () => {
      const contract = buildMinimalValidContract({
        planGenerationMechanismClass: undefined,
      });
      const result = validateGoalAdmission(contract, '2025-02-01T00:00:00Z');

      expect(result.rejectionCodes).toContain(
        GoalRejectionCode.PLAN_GENERATION_MECHANISM_MISSING
      );
      expect(result.status).toBe('REJECTED');
    });

    it('rejects null planGenerationMechanismClass', () => {
      const contract = buildMinimalValidContract({
        planGenerationMechanismClass: null,
      });
      const result = validateGoalAdmission(contract, '2025-02-01T00:00:00Z');

      expect(result.rejectionCodes).toContain(
        GoalRejectionCode.PLAN_GENERATION_MECHANISM_MISSING
      );
    });

    it('rejects TEMPLATE_PIPELINE (not supported in v1)', () => {
      const contract = buildMinimalValidContract({
        planGenerationMechanismClass: 'TEMPLATE_PIPELINE',
      });
      const result = validateGoalAdmission(contract, '2025-02-01T00:00:00Z');

      expect(result.rejectionCodes).toContain(
        GoalRejectionCode.PLAN_GENERATION_MECHANISM_UNSUPPORTED
      );
    });

    it('rejects HABIT_LOOP (not supported in v1)', () => {
      const contract = buildMinimalValidContract({
        planGenerationMechanismClass: 'HABIT_LOOP',
      });
      const result = validateGoalAdmission(contract, '2025-02-01T00:00:00Z');

      expect(result.rejectionCodes).toContain(
        GoalRejectionCode.PLAN_GENERATION_MECHANISM_UNSUPPORTED
      );
    });

    it('rejects PROJECT_MILESTONE (not supported in v1)', () => {
      const contract = buildMinimalValidContract({
        planGenerationMechanismClass: 'PROJECT_MILESTONE',
      });
      const result = validateGoalAdmission(contract, '2025-02-01T00:00:00Z');

      expect(result.rejectionCodes).toContain(
        GoalRejectionCode.PLAN_GENERATION_MECHANISM_UNSUPPORTED
      );
    });

    it('rejects DELIVERABLE_DRIVEN (not supported in v1)', () => {
      const contract = buildMinimalValidContract({
        planGenerationMechanismClass: 'DELIVERABLE_DRIVEN',
      });
      const result = validateGoalAdmission(contract, '2025-02-01T00:00:00Z');

      expect(result.rejectionCodes).toContain(
        GoalRejectionCode.PLAN_GENERATION_MECHANISM_UNSUPPORTED
      );
    });

    it('rejects CUSTOM (not supported in v1)', () => {
      const contract = buildMinimalValidContract({
        planGenerationMechanismClass: 'CUSTOM',
      });
      const result = validateGoalAdmission(contract, '2025-02-01T00:00:00Z');

      expect(result.rejectionCodes).toContain(
        GoalRejectionCode.PLAN_GENERATION_MECHANISM_UNSUPPORTED
      );
    });
  });

  describe('mechanism gating with other errors', () => {
    it('includes mechanism rejection along with other errors', () => {
      const contract = buildMinimalValidContract({
        planGenerationMechanismClass: 'TEMPLATE_PIPELINE',
        deadline: { dayKey: '2025-02-02', isHardDeadline: true }, // too soon
      });
      const result = validateGoalAdmission(contract, '2025-02-01T00:00:00Z');

      expect(result.rejectionCodes).toContain(
        GoalRejectionCode.PLAN_GENERATION_MECHANISM_UNSUPPORTED
      );
      expect(result.rejectionCodes).toContain(GoalRejectionCode.DEADLINE_TOO_SOON);
      expect(result.status).toBe('REJECTED');
    });

    it('mechanism error is first to check (Phase 0)', () => {
      // Verify mechanism checking happens before other phases
      const contractWithMissingMechanism = buildMinimalValidContract({
        planGenerationMechanismClass: undefined,
        terminalOutcome: undefined, // also missing
      });
      const result = validateGoalAdmission(
        contractWithMissingMechanism,
        '2025-02-01T00:00:00Z'
      );

      // Should include both errors
      expect(result.rejectionCodes).toContain(
        GoalRejectionCode.PLAN_GENERATION_MECHANISM_MISSING
      );
      expect(result.rejectionCodes).toContain(GoalRejectionCode.TERMINAL_OUTCOME_MISSING);
    });
  });

  describe('mechanism validation messages', () => {
    it('provides message for missing mechanism', () => {
      const contract = buildMinimalValidContract({
        planGenerationMechanismClass: undefined,
      });
      const result = validateGoalAdmission(contract, '2025-02-01T00:00:00Z');

      const message = result.rejectionMessages.find((m) =>
        m.toLowerCase().includes('mechanism')
      );
      expect(message).toBeDefined();
      expect(message).toContain('required');
    });

    it('provides message for unsupported mechanism', () => {
      const contract = buildMinimalValidContract({
        planGenerationMechanismClass: 'TEMPLATE_PIPELINE',
      });
      const result = validateGoalAdmission(contract, '2025-02-01T00:00:00Z');

      const message = result.rejectionMessages.find((m) =>
        m.toLowerCase().includes('generic_deterministic')
      );
      expect(message).toBeDefined();
      expect(message).toContain('v1');
    });
  });
});
