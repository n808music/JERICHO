import { describe, expect, it } from 'vitest';
import { activateGoalContract, deriveGoalStatus, validateGoalContractForActivation } from '../../src/state/contracts/goalContract.ts';

const makeContract = (overrides = {}) => ({
  goalId: 'goal-1',
  status: 'draft',
  activationDateISO: '2025-01-01',
  deadlineISO: '2025-02-01',
  success: [
    {
      metricType: 'threshold',
      metricName: 'revenue',
      targetValue: 10000,
      validationMethod: 'user_attest'
    }
  ],
  requirements: {
    requiredDomains: ['Body', 'Focus', 'Creation', 'Resources'],
    minimumCadencePerDomain: {
      Body: 2,
      Focus: 3,
      Creation: 4,
      Resources: 1
    },
    expectedDomainMix: {
      Body: 0.2,
      Focus: 0.3,
      Creation: 0.4,
      Resources: 0.1
    },
    maxAllowedVariance: 0.2
  },
  ...overrides
});

describe('goal contract activation', () => {
  it('rejects activation without success conditions', () => {
    const contract = makeContract({ success: [] });
    const validation = validateGoalContractForActivation(contract, '2025-01-10');
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('success:missing');
  });

  it('rejects activation when deadline is not in the future', () => {
    const contract = makeContract({ deadlineISO: '2025-01-10' });
    const validation = validateGoalContractForActivation(contract, '2025-01-10');
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('deadline:invalid');
  });

  it('rejects activation when domain mix does not sum to 1', () => {
    const contract = makeContract({
      requirements: {
        ...makeContract().requirements,
        expectedDomainMix: { Body: 0.5, Focus: 0.2, Creation: 0.2, Resources: 0.2 }
      }
    });
    const validation = validateGoalContractForActivation(contract, '2025-01-10');
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('mix:sum');
  });

  it('activates with valid success, future deadline, and valid mix', () => {
    const contract = makeContract();
    const { contract: activated, errors } = activateGoalContract(contract, '2025-01-10');
    expect(errors).toHaveLength(0);
    expect(activated.status).toBe('active');
  });
});

describe('goal status transitions', () => {
  it('invalidates when deadline has passed', () => {
    const contract = makeContract({ status: 'active', deadlineISO: '2025-01-05' });
    const status = deriveGoalStatus(contract, { nowISO: '2025-01-10' });
    expect(status).toBe('invalidated');
  });

  it('achieves only when success met and active', () => {
    const activeContract = makeContract({ status: 'active', deadlineISO: '2025-02-01' });
    const activeStatus = deriveGoalStatus(activeContract, { nowISO: '2025-01-10', successMet: true });
    expect(activeStatus).toBe('achieved');

    const draftContract = makeContract({ status: 'draft', deadlineISO: '2025-02-01' });
    const draftStatus = deriveGoalStatus(draftContract, { nowISO: '2025-01-10', successMet: true });
    expect(draftStatus).toBe('draft');
  });
});
