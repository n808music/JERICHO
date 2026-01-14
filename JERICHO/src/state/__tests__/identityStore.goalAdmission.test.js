import { describe, it, expect } from 'vitest';
import { attemptGoalAdmissionPure } from '../identityStore.js';
import { computeContractHash } from '../../domain/goal/GoalAdmissionPolicy.ts';

const NOW_ISO = '2026-01-10T12:00:00.000Z';

function buildMinimalState() {
  return {
    appTime: { nowISO: NOW_ISO, timeZone: 'UTC', activeDayKey: '2026-01-10' },
    cyclesById: {},
    activeCycleId: null,
    cycleOrder: [],
    aspirations: [],
    aspirationsByCycleId: {},
    // computeDerivedState will fill other defaults
  };
}

function createValidContract() {
  const contract = {
    planGenerationMechanismClass: 'GENERIC_DETERMINISTIC',
    terminalOutcome: { text: 'Ship MVP feature X', hash: '', verificationCriteria: 'Feature is live', isConcrete: true },
    deadline: { dayKey: '2026-02-20', isHardDeadline: true },
    sacrifice: { whatIsGivenUp: 'Weekend social activities', duration: '6 weeks', quantifiedImpact: '10 hours/week', rationale: 'Focus on delivery', hash: '' },
    temporalBinding: { daysPerWeek: 5, activationTime: '09:00', sessionDurationMinutes: 120, weeklyMinutes: 600, startDayKey: '2026-01-10' },
    causalChain: { steps: [{ sequence: 1, description: 'Design' }], hash: '' },
    reinforcement: { dailyExposureEnabled: true, dailyMechanism: 'Calendar title', checkInFrequency: 'DAILY', triggerDescription: 'Morning' },
    inscription: { contractHash: '', inscribedAtISO: NOW_ISO, acknowledgment: 'I accept', acknowledgmentHash: '', isCompromised: false },
    isAspirational: false
  };
  // compute and populate hashes
  contract.inscription.contractHash = computeContractHash(contract);
  contract.terminalOutcome.hash = contract.inscription.contractHash.slice(0, 16);
  contract.sacrifice.hash = contract.inscription.contractHash.slice(16, 32);
  contract.causalChain.hash = contract.inscription.contractHash.slice(32);
  contract.inscription.acknowledgmentHash = contract.inscription.contractHash.slice(0, 16);
  return contract;
}

function createRejectedContract() {
  const c = createValidContract();
  // make it invalid by removing sacrifice
  delete c.sacrifice;
  return c;
}

describe('identityStore.attemptGoalAdmissionPure', () => {
  it('creates an aspiration on rejected contract and does not change activeCycle', () => {
    const state = buildMinimalState();
    // add an existing active cycle to ensure invariant
    state.cyclesById['cycle-1'] = { id: 'cycle-1', status: 'Active', goalContract: { terminalOutcome: { text: 'Other goal' } } };
    state.activeCycleId = 'cycle-1';
    state.cycleOrder = ['cycle-1'];

    const badContract = createRejectedContract();
    const { nextState, result } = attemptGoalAdmissionPure(state, badContract);

    expect(result.status).toBe('REJECTED');
    expect(result.aspirationId).toBeTruthy();
    expect(Array.isArray(nextState.aspirations)).toBe(true);
    expect(nextState.aspirations.length).toBe(1);
    // active cycle unchanged
    expect(nextState.activeCycleId).toBe('cycle-1');
    // no new cycles created
    expect(Object.keys(nextState.cyclesById).length).toBe(1);
  });

  it('creates a new active cycle on admitted contract and leaves aspirations unchanged', () => {
    const state = buildMinimalState();
    // pre-existing cycle present
    state.cyclesById['cycle-1'] = { id: 'cycle-1', status: 'Active', goalContract: { terminalOutcome: { text: 'Other goal' } } };
    state.activeCycleId = 'cycle-1';
    state.cycleOrder = ['cycle-1'];

    const goodContract = createValidContract();
    const { nextState, result } = attemptGoalAdmissionPure(state, goodContract);

    expect(result.status).toBe('ADMITTED');
    expect(result.cycleId).toBeTruthy();
    expect(nextState.activeCycleId).toBe(result.cycleId);
    expect(nextState.cyclesById[result.cycleId]).toBeTruthy();
    expect(nextState.cyclesById[result.cycleId].status).toBe('Active');
    expect(Array.isArray(nextState.aspirations)).toBe(true);
    // aspirations unchanged (still empty)
    expect(nextState.aspirations.length).toBe(0);
    // stored goal hash must match inscription.contractHash
    expect(nextState.cyclesById[result.cycleId].goalHash).toBe(goodContract.inscription.contractHash);
  });
});
