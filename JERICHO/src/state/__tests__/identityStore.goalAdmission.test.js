import { describe, it, expect } from 'vitest';
import { DEFAULT_PROFILE_ID, attemptGoalAdmissionPure } from '../identityStore.js';
import { computeContractHash } from '../../domain/goal/GoalAdmissionPolicy.ts';
import { buildValidGoalContract } from '../../domain/goal/testHelpers.ts';
import { GoalRejectionCode } from '../../domain/goal/GoalRejectionCode.ts';

const NOW_ISO = '2026-01-10T12:00:00.000Z';
const EXISTING_GOAL_ID = 'goal-1';
const EXISTING_CYCLE_ID = 'cycle-1';

function buildMinimalState() {
  return {
    appTime: { nowISO: NOW_ISO, timeZone: 'UTC', activeDayKey: '2026-01-10' },
        timeIsPinned: true,
    activeProfileId: DEFAULT_PROFILE_ID,
    profilesById: {
      [DEFAULT_PROFILE_ID]: {
        id: DEFAULT_PROFILE_ID,
        label: 'Local Profile',
        displayName: 'Local Profile',
        goalIds: [],
        activeGoalId: null,
        masterCalendarId: `calendar-${DEFAULT_PROFILE_ID}`,
        strategicClusterIds: [],
        createdAtISO: NOW_ISO,
        status: 'active',
      },
    },
    goalsById: {},
    goalAdmissionByGoal: {},
    cyclesById: {},
    activeCycleId: null,
    cycleOrder: [],
    aspirations: [],
    aspirationsByCycleId: {},
    masterCalendarsById: {},
    deliverablesByCycleId: {},
    // computeDerivedState will fill other defaults
  };
}

function attachExistingActiveCycle(state) {
  state.cyclesById[EXISTING_CYCLE_ID] = {
    id: EXISTING_CYCLE_ID,
    status: 'Active',
    profileId: DEFAULT_PROFILE_ID,
    goalId: EXISTING_GOAL_ID,
    goalContract: { goalId: EXISTING_GOAL_ID, terminalOutcome: { text: 'Other goal' } },
  };
  state.activeCycleId = EXISTING_CYCLE_ID;
  state.cycleOrder = [EXISTING_CYCLE_ID];
  state.goalsById[EXISTING_GOAL_ID] = {
    id: EXISTING_GOAL_ID,
    profileId: DEFAULT_PROFILE_ID,
    cycleIds: [EXISTING_CYCLE_ID],
    activeCycleId: EXISTING_CYCLE_ID,
    status: 'active',
    title: 'Other goal',
  };
  state.profilesById[DEFAULT_PROFILE_ID].goalIds = [EXISTING_GOAL_ID];
  state.profilesById[DEFAULT_PROFILE_ID].activeGoalId = EXISTING_GOAL_ID;
  state.aspirationsByCycleId[EXISTING_CYCLE_ID] = [];
}

function createValidContract(overrides = {}) {
  const contract = buildValidGoalContract({
    terminalOutcome: { text: 'Ship MVP feature X', verificationCriteria: 'Feature is live', isConcrete: true },
    deadline: { dayKey: '2026-02-20', isHardDeadline: true },
    sacrifice: {
      whatIsGivenUp: 'Weekend social activities',
      duration: '6 weeks',
      quantifiedImpact: '10 hours/week',
      rationale: 'Focus on delivery',
    },
    temporalBinding: {
      daysPerWeek: 5,
      activationTime: '09:00',
      sessionDurationMinutes: 120,
      weeklyMinutes: 600,
      startDayKey: '2026-01-10',
    },
    causalChain: { steps: [{ sequence: 1, description: 'Design', approximateDayOffset: 7 }] },
    reinforcement: {
      dailyExposureEnabled: true,
      dailyMechanism: 'Calendar title',
      checkInFrequency: 'DAILY',
      triggerDescription: 'Morning',
    },
    inscription: { inscribedAtISO: NOW_ISO, acknowledgment: 'I accept', isCompromised: false },
    isAspirational: false,
    ...overrides,
  });

  if (contract.inscription) {
    contract.inscription.contractHash = computeContractHash(contract);
    contract.terminalOutcome.hash = contract.inscription.contractHash.slice(0, 16);
    contract.sacrifice.hash = contract.inscription.contractHash.slice(16, 32);
    contract.causalChain.hash = contract.inscription.contractHash.slice(32);
    contract.inscription.acknowledgmentHash = contract.inscription.contractHash.slice(0, 16);
  }
  return contract;
}

function createRejectedContract() {
  const c = createValidContract();
  c.terminalOutcome = undefined;
  return c;
}

describe('identityStore.attemptGoalAdmissionPure', () => {
  it('creates an aspiration on rejected contract and does not change activeCycle', () => {
    const state = buildMinimalState();
    attachExistingActiveCycle(state);

    const badContract = createRejectedContract();
    const { nextState, result } = attemptGoalAdmissionPure(state, badContract);

    expect(result.status).toBe('REJECTED');
    expect(result.aspirationId).toBeTruthy();
    expect(Array.isArray(nextState.aspirations)).toBe(true);
    expect(nextState.aspirations.length).toBe(1);
    // active cycle unchanged
    expect(nextState.activeCycleId).toBe(EXISTING_CYCLE_ID);
    // no new cycles created
    expect(Object.keys(nextState.cyclesById).length).toBe(1);
  });

  it('creates a new active cycle on admitted contract and leaves aspirations unchanged', () => {
    const state = buildMinimalState();
    attachExistingActiveCycle(state);

    const goodContract = createValidContract();
    const { nextState, result } = attemptGoalAdmissionPure(state, goodContract);

    expect(result.status).toBe('ADMITTED');
    expect(result.cycleId).toBeTruthy();
    expect(nextState.activeCycleId).toBe(result.cycleId);
    expect(nextState.cyclesById[result.cycleId]).toBeTruthy();
    expect(nextState.cyclesById[result.cycleId].status).toBe('Active');
    expect(nextState.cyclesById[result.cycleId].goalContract?.admissionStatus).toBe('ADMITTED');
    const goalId = nextState.cyclesById[result.cycleId].goalContract?.goalId;
    expect(nextState.goalAdmissionByGoal?.[goalId]?.status).toBe('ADMITTED');
    expect(Array.isArray(nextState.aspirations)).toBe(true);
    // aspirations unchanged (still empty)
    expect(nextState.aspirations.length).toBe(0);
    // stored goal hash must match inscription.contractHash
    expect(nextState.cyclesById[result.cycleId].goalHash).toBe(goodContract.inscription.contractHash);
  });

  it('rejects a duplicate goal in the same active cycle', () => {
    const state = buildMinimalState();
    const contract = createValidContract();

    const first = attemptGoalAdmissionPure(state, contract);
    expect(first.result.status).toBe('ADMITTED');
    const second = attemptGoalAdmissionPure(first.nextState, contract);
    expect(second.result.status).toBe('REJECTED');
    expect(second.result.rejectionCodes).toContain(GoalRejectionCode.DUPLICATE_ACTIVE);
    expect(second.nextState.activeCycleId).toBe(first.result.cycleId);
  });

  it('allows the same goal to be admitted in a new cycle after ending the previous one', () => {
    const state = buildMinimalState();
    const contract = createValidContract();

    const first = attemptGoalAdmissionPure(state, contract);
    expect(first.result.status).toBe('ADMITTED');

    const blankCycleId = 'cycle-blank';
    const newState = JSON.parse(JSON.stringify(first.nextState));
    newState.cyclesById[first.result.cycleId].status = 'Ended';
    newState.cyclesById[blankCycleId] = {
      id: blankCycleId,
      status: 'Active',
      createdAtISO: '2026-01-10T00:00:00.000Z',
      goalContract: null,
      goalHash: null,
      executionEvents: [],
      suggestionEvents: [],
      suggestedBlocks: [],
      truthEntries: [],
    };
    newState.activeCycleId = blankCycleId;

    const second = attemptGoalAdmissionPure(newState, contract);
    expect(second.result.status).toBe('ADMITTED');
    expect(second.nextState.activeCycleId).toBe(second.result.cycleId);
    expect(second.nextState.cyclesById[second.result.cycleId].goalHash).toBe(contract.inscription.contractHash);
    expect(second.nextState.cyclesById[first.result.cycleId].status).toBe('Ended');
  });

  it('rejects duplicates when multiple active cycles share the same signature', () => {
    const state = buildMinimalState();
    const contract = createValidContract({
      terminalOutcome: { text: 'Duplicate goal', verificationCriteria: 'Goal complete', isConcrete: true },
    });
    // create two active cycles with same terminal outcome
    state.cyclesById['cycle-1'] = {
      id: EXISTING_CYCLE_ID,
      status: 'Active',
      goalContract: { terminalOutcome: { text: 'Duplicate goal' } },
    };
    state.cyclesById['cycle-2'] = {
      id: 'cycle-2',
      status: 'Active',
      goalContract: { terminalOutcome: { text: 'Duplicate goal' } },
    };
    state.activeCycleId = EXISTING_CYCLE_ID;

    const result = attemptGoalAdmissionPure(state, contract);
    expect(result.result.status).toBe('REJECTED');
    expect(result.result.rejectionCodes).toContain(GoalRejectionCode.DUPLICATE_ACTIVE);
  });

  it('hard-rejects inferred start day earlier than app active day', () => {
    const state = buildMinimalState();
    state.appTime.activeDayKey = '2026-02-01';
    state.appTime.nowISO = '2026-01-12T12:00:00.000Z';
    const contract = createValidContract({
      startDayKey: '2026-01-10',
    });

    const result = attemptGoalAdmissionPure(state, contract);
    expect(result.result.status).toBe('REJECTED');
    expect(result.result.rejectionCodes).toContain(GoalRejectionCode.START_DAY_BEFORE_ACTIVE_DAY);
    expect(result.nextState.activeCycleId).toBeNull();
  });

  it('does not reject admission just because the browsed active day is ahead of today', () => {
    const state = buildMinimalState();
    state.appTime.activeDayKey = '2026-02-01';
    state.appTime.nowISO = '2026-01-12T12:00:00.000Z';
    const contract = createValidContract({
      startDayKey: '2026-01-12',
    });

    const result = attemptGoalAdmissionPure(state, contract);
    expect(result.result.status).toBe('ADMITTED');
    expect(result.result.rejectionCodes || []).not.toContain(GoalRejectionCode.START_DAY_BEFORE_ACTIVE_DAY);
  });

  it('preserves explicit start and deadline day keys from midnight UTC ISO inputs', () => {
    const state = buildMinimalState();
    state.appTime.timeZone = 'America/Chicago';
    state.appTime.nowISO = '2026-04-02T18:00:00.000Z';
    state.appTime.activeDayKey = '2026-04-02';
    const contract = createValidContract({
      startDateISO: '2026-04-06T00:00:00.000Z',
      deadlineISO: '2026-05-06T23:59:59.000Z',
      deadline: { dayKey: '2026-05-06', isHardDeadline: true },
      temporalBinding: {
        ...createValidContract().temporalBinding,
        startDayKey: undefined,
      },
    });

    const result = attemptGoalAdmissionPure(state, contract);

    expect(result.result.status).toBe('ADMITTED');
    const admittedCycle = result.nextState.cyclesById[result.result.cycleId];
    expect(admittedCycle.startedAtDayKey).toBe('2026-04-06');
    expect(admittedCycle.goalContract.startDayKey).toBe('2026-04-06');
    expect(admittedCycle.definiteGoal.deadlineDayKey).toBe('2026-05-06');
    expect(result.nextState.goalExecutionContract.endDayKey).toBe('2026-05-06');
  });
});
