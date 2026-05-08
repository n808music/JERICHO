import { describe, expect, it } from 'vitest';
import { attemptGoalAdmissionPure } from '../../src/state/identityStore.js';
import { buildValidGoalContract } from '../../src/domain/goal/testHelpers.ts';
import { computeContractHash } from '../../src/domain/goal/GoalAdmissionPolicy.ts';

const NOW_ISO = '2026-01-10T12:00:00.000Z';

function buildMinimalState() {
  return {
    appTime: { nowISO: NOW_ISO, timeZone: 'UTC', activeDayKey: '2026-01-10' },
    cyclesById: {},
    activeCycleId: null,
    cycleOrder: [],
    aspirations: [],
    aspirationsByCycleId: [],
  };
}

function createValidContract() {
  const contract = buildValidGoalContract({
    terminalOutcome: { text: 'Launch waitlist page', verificationCriteria: 'Page is published', isConcrete: true },
    deadline: { dayKey: '2026-02-20', isHardDeadline: true },
    sacrifice: {
      whatIsGivenUp: 'Streaming time',
      duration: '6 weeks',
      quantifiedImpact: '8 hours/week',
      rationale: 'Focus on shipping',
    },
    temporalBinding: {
      daysPerWeek: 5,
      activationTime: '09:00',
      sessionDurationMinutes: 120,
      weeklyMinutes: 600,
      startDayKey: '2026-01-10',
    },
    causalChain: { steps: [{ sequence: 1, description: 'Build landing page', approximateDayOffset: 7 }] },
    reinforcement: {
      dailyExposureEnabled: true,
      dailyMechanism: 'Calendar title',
      checkInFrequency: 'DAILY',
      triggerDescription: 'Morning',
    },
    inscription: { inscribedAtISO: NOW_ISO, acknowledgment: 'I accept', isCompromised: false },
    isAspirational: false,
  });
  contract.inscription.contractHash = computeContractHash(contract);
  return contract;
}

describe('attemptGoalAdmissionPure graph bootstrap', () => {
  it('creates admitted cycle with deterministic actions and execution graph readiness', () => {
    const { nextState, result } = attemptGoalAdmissionPure(buildMinimalState(), createValidContract());
    expect(result.status).toBe('ADMITTED');
    const cycle = nextState.cyclesById?.[result.cycleId];
    expect(cycle).toBeTruthy();
    expect(cycle.executionGraphReady).toBe(true);
    expect(Array.isArray(cycle.actions)).toBe(true);
    expect(cycle.actions.length).toBeGreaterThan(0);
    expect(cycle.planProof).toBeTruthy();
    expect(cycle.goalContract.goalIntakeContract).toBeTruthy();
    expect(cycle.goalContract.goalIntakeContract.readiness.isReadyForPlanning).toBe(true);
    expect(nextState.lastPlanError?.code).not.toBe('ACTION_GRAPH_MISSING');
  });
});
