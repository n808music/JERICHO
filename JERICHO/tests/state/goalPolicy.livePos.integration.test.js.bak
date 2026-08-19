import { describe, expect, it } from 'vitest';
import { buildGoalIntakeContract } from '../../src/domain/goal/GoalIntakeContract.ts';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildBaseState({ executionEvents = [], scheduleAppliedAtISO = null } = {}) {
  const intake = buildGoalIntakeContract({
    goalId: 'goal-live-pos-1',
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
    executionEvents,
    ledger: [],
    aspirations: [],
    aspirationsByCycleId: {},
    cyclesById: {
      'cycle-live-pos-1': {
        id: 'cycle-live-pos-1',
        status: 'ACTIVE',
        startedAtDayKey: '2026-05-01',
        executionGraphReady: true,
        scheduleAppliedAtISO,
        goalContract: {
          goalId: 'goal-live-pos-1',
          cycleId: 'cycle-live-pos-1',
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
            goalId: 'goal-live-pos-1',
            deliverableId: 'd1',
            actionId: 'a1',
            title: 'Define show format',
            start: '2026-05-02T14:00:00.000Z',
            durationMinutes: 60,
          },
          {
            id: 'b2',
            goalId: 'goal-live-pos-1',
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
    cycleOrder: ['cycle-live-pos-1'],
    activeCycleId: 'cycle-live-pos-1',
    appTime: {
      timeZone: 'UTC',
      nowISO: '2026-05-03T12:00:00.000Z',
      activeDayKey: '2026-05-03',
      isFollowingNow: true,
    },
    constraints: { maxBlocksPerDay: 4, maxBlocksPerWeek: 16 },
    goalAdmissionByGoal: { 'goal-live-pos-1': { status: 'ADMITTED' } },
    probabilityByGoal: {},
    probabilityStatusByGoal: { 'goal-live-pos-1': { status: 'computed' } },
    feasibilityByGoal: {},
    deliverablesByCycleId: {
      'cycle-live-pos-1': {
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

describe('goal policy live pos canonical inputs', () => {
  it('withholds live pos when the schedule is not yet live', () => {
    const next = computeDerivedState(buildBaseState(), { type: 'NO_OP' });

    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.state).toBe('withheld');
    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.reasonCodes).toContain(
      'LIVE_POS_WITHHELD_SCHEDULE_NOT_LIVE'
    );
  });

  it('marks live pos eligible once linked canonical execution evidence exists on a live schedule', () => {
    const next = computeDerivedState(
      buildBaseState({
        scheduleAppliedAtISO: '2026-05-01T12:00:00.000Z',
        executionEvents: [
          {
            id: 'evt-1',
            cycleId: 'cycle-live-pos-1',
            goalId: 'goal-live-pos-1',
            kind: 'complete',
            status: 'completed',
            blockId: 'b1',
            actionId: 'a1',
            deliverableId: 'd1',
            linkageStatus: 'LINKED',
          },
        ],
      }),
      { type: 'NO_OP' }
    );

    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.state).toBe('eligible');
    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.reasonCodes).toEqual([]);
    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.liveState).toBe('activating');
    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.liveStateReasonCodes).toContain(
      'LIVE_POS_ACTIVATING_EVIDENCE_EARLY'
    );
    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.score.state).toBe('available');
    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.score.value).toBeGreaterThanOrEqual(0.52);
    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.score.value).toBeLessThanOrEqual(0.6);
    expect(next.cyclesById['cycle-live-pos-1'].policyState.goalPolicy.livePos.evidenceCount).toBe(1);
  });

  it('preserves stable live pos state through the canonical reducer path when linked continuity spans multiple days', () => {
    const next = computeDerivedState(
      buildBaseState({
        scheduleAppliedAtISO: '2026-05-01T12:00:00.000Z',
        executionEvents: [
          {
            id: 'evt-1',
            cycleId: 'cycle-live-pos-1',
            goalId: 'goal-live-pos-1',
            kind: 'complete',
            status: 'completed',
            dateISO: '2026-05-02',
            blockId: 'b1',
            actionId: 'a1',
            deliverableId: 'd1',
            linkageStatus: 'LINKED',
          },
          {
            id: 'evt-2',
            cycleId: 'cycle-live-pos-1',
            goalId: 'goal-live-pos-1',
            kind: 'complete',
            status: 'completed',
            dateISO: '2026-05-04',
            blockId: 'b2',
            actionId: 'a2',
            deliverableId: 'd2',
            linkageStatus: 'LINKED',
          },
        ],
      }),
      { type: 'NO_OP' }
    );

    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.state).toBe('eligible');
    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.liveState).toBe('stable');
    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.liveStateReasonCodes).toContain(
      'LIVE_POS_STABLE_LINKED_EXECUTION_CONTINUITY'
    );
    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.score.state).toBe('available');
    expect(next.goalPolicyByGoalId['goal-live-pos-1'].livePos.score.value).toBeGreaterThanOrEqual(0.72);
  });
});
