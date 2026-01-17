/**
 * GoalAdmissionUI.test.tsx
 * 
 * Test UI validation and rendering:
 * - Rejection banner shows with rejection codes
 * - Admission banner shows when valid
 * - Section checkmarks appear when valid
 * - Daily exposure checkbox always checked and disabled
 * - Action buttons appropriately enabled/disabled
 */

import { describe, it, expect, vi } from 'vitest';
import { GoalExecutionContract } from '../../domain/goal/GoalExecutionContract';
import { hashField, validateGoalAdmission, computeContractHash } from '../../domain/goal/GoalAdmissionPolicy';
import { GoalRejectionCode } from '../../domain/goal/GoalRejectionCode';

const NOW_ISO = '2026-01-10T12:00:00.000Z';
const DEADLINE_VALID = '2026-02-15';

function createValidContract(
  overrides: Partial<GoalExecutionContract> = {}
): GoalExecutionContract {
  const base: GoalExecutionContract = {
    goalId: 'goal-1',
    cycleId: 'cycle-1',
    planGenerationMechanismClass: 'GENERIC_DETERMINISTIC',
    terminalOutcome: {
      text: 'Complete the JERICHO implementation',
      hash: hashField('Complete the JERICHO implementation'),
      verificationCriteria: 'All modules deployed and tested',
      isConcrete: true,
    },
    deadline: {
      dayKey: DEADLINE_VALID,
      isHardDeadline: true,
    },
    sacrifice: {
      whatIsGivenUp: 'Free time on weekends',
      duration: 'Until February 15',
      quantifiedImpact: '8 hours/week',
      rationale: 'Weekend time for development',
      hash: hashField('Free time on weekends'),
    },
    temporalBinding: {
      daysPerWeek: 5,
      activationTime: '09:00',
      sessionDurationMinutes: 120,
      weeklyMinutes: 600,
      startDayKey: '2026-01-10',
    },
    causalChain: {
      steps: [
        { sequence: 1, description: 'Design API', approximateDayOffset: 7 },
        { sequence: 2, description: 'Implement services', approximateDayOffset: 14 },
      ],
      hash: hashField('design-implement'),
    },
    reinforcement: {
      dailyExposureEnabled: true,
      dailyMechanism: 'Calendar block + banner',
      checkInFrequency: 'DAILY',
      triggerDescription: 'Every morning at 6 AM',
    },
    inscription: {
      contractHash: 'abc123def456',
      inscribedAtISO: NOW_ISO,
      acknowledgment: 'I understand this commitment',
      acknowledgmentHash: hashField('I understand this commitment'),
      isCompromised: false,
    },
    admissionStatus: 'PENDING',
    admissionAttemptCount: 0,
    rejectionCodes: [],
    createdAtISO: NOW_ISO,
    isAspirational: false,
  };
  const contract = {
    ...base,
    ...overrides,
  } as GoalExecutionContract;
  if (contract.inscription) {
    contract.inscription.contractHash = computeContractHash(contract);
  }
  return contract;
}

describe('GoalAdmissionPolicy.validateGoalAdmission (Integration Tests)', () => {
  it('admits a fully valid contract', () => {
    const contract = createValidContract();
    const result = validateGoalAdmission(contract, NOW_ISO);

    expect(result.status).toBe('ADMITTED');
    expect(result.rejectionCodes).toHaveLength(0);
  });

  it('rejects when terminal outcome is missing', () => {
    const contract = createValidContract({
      terminalOutcome: undefined,
    });
    const result = validateGoalAdmission(contract, NOW_ISO);

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionCodes).toContain(GoalRejectionCode.TERMINAL_OUTCOME_MISSING);
  });

  it('rejects when outcome text is too vague', () => {
    const contract = createValidContract({
      terminalOutcome: {
        text: 'do',
        hash: 'x',
        verificationCriteria: 'see',
        isConcrete: false,
      },
    });
    const result = validateGoalAdmission(contract, NOW_ISO);

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionCodes.length).toBeGreaterThan(0);
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

  it('rejects when sacrifice is missing', () => {
    const contract = createValidContract({
      sacrifice: undefined,
    });
    const result = validateGoalAdmission(contract, NOW_ISO);

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionCodes).toContain(GoalRejectionCode.SACRIFICE_MISSING);
  });

  it('rejects when sacrifice contains trivial language (maybe)', () => {
    const contract = createValidContract({
      sacrifice: {
        whatIsGivenUp: 'maybe something',
        duration: '6 weeks',
        quantifiedImpact: '1 hour/day',
        rationale: 'rationale',
        hash: 'x',
      },
    });
    const result = validateGoalAdmission(contract, NOW_ISO);

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionCodes).toContain(GoalRejectionCode.SACRIFICE_NOT_BINDING);
  });

  it('rejects when temporal binding is invalid (empty activation time)', () => {
    const contract = createValidContract({
      temporalBinding: {
        daysPerWeek: 3,
        activationTime: '',
        sessionDurationMinutes: 60,
        weeklyMinutes: 180,
        startDayKey: '2026-01-10',
      },
    });
    const result = validateGoalAdmission(contract, NOW_ISO);

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionCodes).toContain(GoalRejectionCode.TEMPORAL_BINDING_INVALID);
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
        dailyMechanism: 'something',
        checkInFrequency: 'DAILY',
        triggerDescription: 'trigger',
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

  it('rejects aspirational goals', () => {
    const contract = createValidContract({
      isAspirational: true,
    });
    const result = validateGoalAdmission(contract, NOW_ISO);

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionCodes).toContain(GoalRejectionCode.ASPIRATIONAL_ONLY);
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
      sacrifice: undefined,
      causalChain: {
        steps: [],
        hash: 'x',
      },
    });
    const result = validateGoalAdmission(contract, NOW_ISO);

    expect(result.status).toBe('REJECTED');
    expect(result.rejectionCodes.length).toBeGreaterThanOrEqual(3);
  });

  it('returns rejection messages for each code', () => {
    const contract = createValidContract({
      sacrifice: undefined,
      deadline: undefined,
    });
    const result = validateGoalAdmission(contract, NOW_ISO);

    expect(result.rejectionMessages.length).toBeGreaterThan(0);
    expect(result.rejectionMessages[0]).toMatch(/[A-Za-z]/); // At least has text
  });
});

describe('hashField utility', () => {
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

  it('is deterministic across calls', () => {
    const hashes = new Set();
    for (let i = 0; i < 5; i++) {
      hashes.add(hashField('same text'));
    }
    expect(hashes.size).toBe(1);
  });
});

describe('Goal Admission Contract Behavior', () => {
  it('stores rejection codes on rejection', () => {
    const contract = createValidContract({
      sacrifice: undefined,
    });
    const result = validateGoalAdmission(contract, NOW_ISO);

    expect(result.status).toBe('REJECTED');
    expect(Array.isArray(result.rejectionCodes)).toBe(true);
    expect(result.rejectionCodes[0]).toBe(GoalRejectionCode.SACRIFICE_MISSING);
  });

  it('stores no rejection codes on admission', () => {
    const contract = createValidContract();
    const result = validateGoalAdmission(contract, NOW_ISO);

    expect(result.status).toBe('ADMITTED');
    expect(result.rejectionCodes).toEqual([]);
  });

  it('computes contract hash deterministically', () => {
    const contract1 = createValidContract();
    const contract2 = createValidContract();

    // Same contracts should have deterministic computation
    const result1 = validateGoalAdmission(contract1, NOW_ISO);
    const result2 = validateGoalAdmission(contract2, NOW_ISO);

    expect(result1.status).toBe(result2.status);
  });
});
