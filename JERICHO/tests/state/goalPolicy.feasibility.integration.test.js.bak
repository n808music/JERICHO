import { describe, expect, it } from 'vitest';
import { buildGoalIntakeContract } from '../../src/domain/goal/GoalIntakeContract.ts';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const intake = buildGoalIntakeContract({
    goalId: 'goal-feasibility-1',
    rawGoalText: 'Publish 6 episodes from scratch by deadline',
    verificationCriteria: '6 episodes are live',
    executionType: 'CreativeProduction',
    deadline: '2026-06-30',
  });

  return {
    today: {
      date: '2026-05-01',
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: '2026-05-01', days: [], metrics: {} },
    cycle: [],
    viewDate: '2026-05-01',
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: false },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    aspirations: [],
    aspirationsByCycleId: {},
    cyclesById: {
      'cycle-feasibility-1': {
        id: 'cycle-feasibility-1',
        status: 'ACTIVE',
        startedAtDayKey: '2026-05-01',
        executionGraphReady: true,
        goalContract: {
          goalId: 'goal-feasibility-1',
          cycleId: 'cycle-feasibility-1',
          goalIntakeContract: intake,
          terminalOutcome: {
            text: 'Publish 6 episodes from scratch by deadline',
            verificationCriteria: '6 episodes are live',
            isConcrete: true,
          },
          startDayKey: '2026-05-01',
          endDayKey: '2026-06-30',
          deadline: { dayKey: '2026-06-30' },
          workWindows: {
            mon: [{ start: '09:00', end: '11:00' }],
            tue: [{ start: '09:00', end: '11:00' }],
            wed: [{ start: '09:00', end: '11:00' }],
            thu: [{ start: '09:00', end: '11:00' }],
            fri: [{ start: '09:00', end: '11:00' }],
            sat: [],
            sun: [],
          },
        },
        planProof: { feasibilityStatus: 'FEASIBLE' },
        actions: [
          { id: 'a1', title: 'Define show format', actionType: 'preparation', dependencies: [] },
          { id: 'a2', title: 'Record and edit episodes', actionType: 'execution', dependencies: ['a1'] },
        ],
        canonicalDeliverables: [
          { id: 'd1', title: 'Show format', actionIds: ['a1'] },
          { id: 'd2', title: 'Episode set', actionIds: ['a2'] },
        ],
        scheduleReviewBlocks: [
          {
            id: 'b1',
            goalId: 'goal-feasibility-1',
            deliverableId: 'd1',
            actionId: 'a1',
            title: 'Define show format',
            start: '2026-05-02T14:00:00.000Z',
            durationMinutes: 60,
          },
          {
            id: 'b2',
            goalId: 'goal-feasibility-1',
            deliverableId: 'd2',
            actionId: 'a2',
            title: 'Record and edit episodes',
            start: '2026-06-05T14:00:00.000Z',
            durationMinutes: 90,
          },
        ],
        proposedBlocks: [],
        suggestedBlocks: [],
      },
    },
    cycleOrder: ['cycle-feasibility-1'],
    activeCycleId: 'cycle-feasibility-1',
    appTime: {
      timeZone: 'UTC',
      nowISO: '2026-05-01T12:00:00.000Z',
      activeDayKey: '2026-05-01',
      isFollowingNow: true,
    },
    constraints: { maxBlocksPerDay: 4, maxBlocksPerWeek: 16 },
    goalAdmissionByGoal: { 'goal-feasibility-1': { status: 'ADMITTED' } },
    probabilityByGoal: {},
    probabilityStatusByGoal: { 'goal-feasibility-1': { status: 'computed' } },
    feasibilityByGoal: {},
    deliverablesByCycleId: {
      'cycle-feasibility-1': {
        deliverables: [
          { id: 'd1', title: 'Show format', actionIds: ['a1'] },
          { id: 'd2', title: 'Episode set', actionIds: ['a2'] },
        ],
        scaffoldGroups: [
          { id: 'phase-prep', title: 'Preparation', type: 'phase', actionIds: ['a1'], deliverableIds: ['d1'] },
          { id: 'phase-exec', title: 'Execution', type: 'phase', actionIds: ['a2'], deliverableIds: ['d2'] },
        ],
      },
    },
  };
}

describe('goal policy feasibility integration', () => {
  it('stores canonical pre-execution feasibility from review blocks without using execution events', () => {
    const next = computeDerivedState(buildState(), { type: 'NO_OP' });

    expect(next.executionEvents).toEqual([]);
    expect(next.goalPolicyByGoalId['goal-feasibility-1'].feasibility.state).toBe('feasible');
    expect(next.goalPolicyByGoalId['goal-feasibility-1'].feasibility.reasonCodes).toEqual([]);
    expect(next.cyclesById['cycle-feasibility-1'].policyState.goalPolicy.feasibility.state).toBe('feasible');
  });
});
