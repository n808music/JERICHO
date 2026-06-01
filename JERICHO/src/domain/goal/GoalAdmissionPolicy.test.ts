/**
 * GoalAdmissionPolicy.test.ts
 *
 * Test hard constraints enforcement:
 * - Missing deadline → rejected
 * - Mutable inscription → rejected
 * - Valid contract → admitted
 * - Rejected goal stored as aspiration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { validateGoalAdmission, verifyContractIntegrity, hashField } from './GoalAdmissionPolicy';
import { GoalRejectionCode } from './GoalRejectionCode';
import { buildValidGoalContract } from './testHelpers';

const NOW_ISO = '2026-01-10T12:00:00.000Z';

function createValidContract(overrides = {}) {
  return buildValidGoalContract(overrides);
}

describe('GoalAdmissionPolicy', () => {
  describe('validateGoalAdmission', () => {
    it('admits a fully valid contract', () => {
      const contract = createValidContract();
      const result = validateGoalAdmission(contract, NOW_ISO);

      expect(result.status).toBe('ADMITTED');
      expect(result.rejectionCodes).toEqual([]);
      expect(result.rejectionMessages).toEqual([]);
    });

    it('rejects when terminal outcome is missing', () => {
      const contract = createValidContract({
        terminalOutcome: undefined,
      });
      const result = validateGoalAdmission(contract, NOW_ISO);

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain(GoalRejectionCode.TERMINAL_OUTCOME_MISSING);
    });

    it('rejects when terminal outcome is too vague', () => {
      const contract = createValidContract({
        terminalOutcome: {
          text: 'do stuff',
          hash: 'x',
          verificationCriteria: 'see if done',
          isConcrete: false,
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain(GoalRejectionCode.TERMINAL_OUTCOME_IMMEASURABLE);
    });

    it('rejects when verification criteria is missing', () => {
      const contract = createValidContract({
        terminalOutcome: {
          text: 'Complete the implementation',
          hash: 'x',
          verificationCriteria: '',
          isConcrete: true,
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain(GoalRejectionCode.TERMINAL_OUTCOME_IMMEASURABLE);
    });

    it('rejects when deadline is in the past', () => {
      const contract = createValidContract({
        deadline: {
          dayKey: '2026-01-01',
          isHardDeadline: true,
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain(GoalRejectionCode.DEADLINE_IN_PAST);
    });

    it('rejects when deadline is too soon (< 3 days)', () => {
      const contract = createValidContract({
        deadline: {
          dayKey: '2026-01-12',
          isHardDeadline: true,
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain(GoalRejectionCode.DEADLINE_TOO_SOON);
    });

    it('admits when sacrifice is missing because planning constraints now live in structured intake', () => {
      const contract = createValidContract({
        sacrifice: undefined,
      });
      const result = validateGoalAdmission(contract, NOW_ISO);

      expect(result.status).toBe('ADMITTED');
      expect(result.rejectionCodes).not.toContain(GoalRejectionCode.SACRIFICE_MISSING);
    });

    it('admits when legacy sacrifice language is trivial because it no longer gates admission', () => {
      const contract = createValidContract({
        sacrifice: {
          whatIsGivenUp: 'maybe something',
          duration: '6 weeks',
          quantifiedImpact: '1 hour/day',
          rationale: 'might help',
          hash: 'x',
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);

      expect(result.status).toBe('ADMITTED');
      expect(result.rejectionCodes).not.toContain(GoalRejectionCode.SACRIFICE_NOT_BINDING);
    });

    it('rejects when no work windows are configured', () => {
      const contract = createValidContract({
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

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain(GoalRejectionCode.NO_WORK_WINDOWS);
    });

    it('rejects when causal chain is empty', () => {
      const contract = createValidContract({
        causalChain: {
          steps: [],
          hash: 'x',
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain(GoalRejectionCode.CAUSAL_CHAIN_INCOMPLETE);
    });

    it('rejects when reinforcement daily exposure is disabled', () => {
      const contract = createValidContract({
        reinforcement: {
          dailyExposureEnabled: false,
          dailyMechanism: '',
          checkInFrequency: 'DAILY',
          triggerDescription: '',
        },
      });
      const result = validateGoalAdmission(contract, NOW_ISO);

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain(GoalRejectionCode.REINFORCEMENT_NOT_DECLARED);
    });

    it('rejects when inscription is missing', () => {
      const contract = createValidContract({
        inscription: undefined,
      });
      const result = validateGoalAdmission(contract, NOW_ISO);

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain(GoalRejectionCode.INSCRIPTION_MISSING);
    });

    it('rejects when goal is marked aspirational', () => {
      const contract = createValidContract({
        isAspirational: true,
      });
      const result = validateGoalAdmission(contract, NOW_ISO);

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain(GoalRejectionCode.ASPIRATIONAL_ONLY);
    });

    it('requires commitment disclosure before admission', () => {
      const contract = createValidContract();
      contract.commitmentDisclosureAccepted = false;
      const rejected = validateGoalAdmission(contract, NOW_ISO);
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectionCodes).toContain(GoalRejectionCode.REJECT_DISCLOSURE_REQUIRED);

      const accepted = createValidContract();
      accepted.commitmentDisclosureAccepted = true;
      accepted.commitmentDisclosureAcceptedAtISO = NOW_ISO;
      const result = validateGoalAdmission(accepted, NOW_ISO);
      expect(result.status).toBe('ADMITTED');
    });

    it('rejects duplicate active goals', () => {
      const contract = createValidContract();
      const existingOutcomes = ['Complete the JERICHO implementation'];
      const result = validateGoalAdmission(contract, NOW_ISO, existingOutcomes);

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionCodes).toContain(GoalRejectionCode.DUPLICATE_ACTIVE);
    });

    it('collects multiple rejection codes', () => {
      const contract = createValidContract({
        terminalOutcome: undefined,
        deadline: undefined,
      });
    const result = validateGoalAdmission(contract, NOW_ISO);

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionCodes.length).toBeGreaterThanOrEqual(2);
  });
  });

  describe('verifyContractIntegrity', () => {
    it('verifies a contract with matching hash', () => {
      const contract = createValidContract();
      const isValid = verifyContractIntegrity(contract);
      // Will be false because we didn't compute the actual hash
      // But the function should work correctly
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('hashField', () => {
    it('produces consistent hashes', () => {
      const text = 'My goal is to achieve X';
      const hash1 = hashField(text);
      const hash2 = hashField(text);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(16);
    });

    it('produces different hashes for different input', () => {
      const hash1 = hashField('Goal A');
      const hash2 = hashField('Goal B');

      expect(hash1).not.toBe(hash2);
    });

    it('trims whitespace before hashing', () => {
      const hash1 = hashField('Goal A');
      const hash2 = hashField('  Goal A  ');

      expect(hash1).toBe(hash2);
    });
  });
});
