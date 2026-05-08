import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildAppliedReviewState() {
  const cycleId = 'cycle-applied-review';
  const goalId = 'goal-applied-review';
  return {
    appTime: {
      nowISO: '2026-04-13T12:00:00.000Z',
      activeDayKey: '2026-04-13',
      timeZone: 'UTC',
      isFollowingNow: true,
    },
    today: { date: '2026-04-13', blocks: [] },
    currentWeek: { weekStart: '2026-04-13', days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    scheduleApplied: true,
    scheduleLifecycle: 'applied_review',
    constraints: {
      maxBlocksPerDay: 2,
      weeklyWindows: {
        MON: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        TUE: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        WED: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        THU: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        FRI: [{ startHHMM: '09:00', endHHMM: '11:00' }],
      },
    },
    goalWorkById: {
      [goalId]: [{ workItemId: 'w1', title: 'Review prep work', blocksRemaining: 2 }],
    },
    deliverablesByCycleId: {
      [cycleId]: {
        cycleId,
        deliverables: [
          {
            id: 'd1',
            title: 'Completed review package with acceptance checklist',
            estimateMin: 120,
            actionIds: ['act-1'],
          },
        ],
        suggestionLinks: {},
        lastUpdatedAtISO: '2026-04-13T12:00:00.000Z',
      },
    },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        scheduleLifecycle: 'applied_review',
        scheduleReviewBlocks: [
          {
            id: 'review-block-1',
            cycleId,
            goalId,
            deliverableId: 'd1',
            actionId: 'act-1',
            title: 'Complete review package acceptance checklist',
            start: '2026-04-14T09:00:00.000Z',
            durationMinutes: 60,
          },
          {
            id: 'review-block-2',
            cycleId,
            goalId,
            deliverableId: 'd1',
            actionId: 'act-1',
            title: 'Finalize complete review package acceptance checklist',
            start: '2026-04-15T09:00:00.000Z',
            durationMinutes: 60,
          },
          {
            id: 'stale-review-block',
            cycleId: 'cycle-old',
            goalId: 'goal-old',
            title: 'Deleted cycle task',
            start: '2026-04-16T09:00:00.000Z',
            durationMinutes: 60,
          },
        ],
        goalContract: {
          goalId,
          goalText: 'Complete review package with acceptance checklist by deadline',
          terminalOutcome: {
            text: 'Complete review package with acceptance checklist by deadline',
            verificationCriteria: 'The review package and acceptance checklist are complete',
          },
          startDayKey: '2026-04-13',
          endDayKey: '2026-04-30',
        },
        goalGovernanceContract: {
          contractId: `gov-${goalId}`,
          version: 1,
          goalId,
          activeFromISO: '2026-04-13',
          activeUntilISO: '2026-04-30',
          scope: { timezone: 'UTC' },
          governance: { suggestionsEnabled: true, probabilityEnabled: true, minEvidenceEvents: 0 },
        },
        actions: [
          {
            id: 'act-1',
            title: 'Complete review package acceptance checklist',
            deliverableId: 'd1',
            estimateMin: 120,
          },
        ],
        metrics: {},
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: {
      goalId,
      goalText: 'Complete review package with acceptance checklist by deadline',
      terminalOutcome: {
        text: 'Complete review package with acceptance checklist by deadline',
        verificationCriteria: 'The review package and acceptance checklist are complete',
      },
      startDayKey: '2026-04-13',
      endDayKey: '2026-04-30',
    },
    lastPlanError: null,
  };
}

describe('applied review schedule pre-execution support truth', () => {
  it('uses the applied review schedule for support metrics without creating execution evidence', () => {
    const next = computeDerivedState(buildAppliedReviewState(), { type: 'NO_OP' });
    const metrics = next.cyclesById['cycle-applied-review'].metrics;

    expect(next.executionEvents).toEqual([]);
    expect(metrics.integrityMinutesCounted).toBe(0);
    expect(metrics.dynamicOutcome?.plannedBlocks).toBe(2);
    expect(metrics.dynamicOutcome?.workableDaysRemaining).toBeGreaterThan(0);
    expect(metrics.requiredWeeklyThroughput).toBeGreaterThan(0);
    expect(metrics.recoveryMetrics?.unscheduledRequiredBurden).toBe(0);
  });

  it('does not collapse support horizon fields when plan quality withholds feasibility but applied review blocks exist', () => {
    const state = buildAppliedReviewState();
    const cycle = state.cyclesById[state.activeCycleId];
    const goalId = 'goal-applied-review';
    delete state.goalWorkById;
    state.goalExecutionContract = {
      goalId,
      goalText: 'Land 3 final-round interviews for remote project management roles in 60 days',
      terminalOutcome: {
        text: 'Land 3 final-round interviews for remote project management roles in 60 days',
        verificationCriteria: 'Three final-round interviews are scheduled or completed by the deadline',
      },
      startDayKey: '2026-04-13',
      endDayKey: '2026-06-12',
    };
    cycle.goalContract = {
      ...cycle.goalContract,
      goalText: state.goalExecutionContract.goalText,
      terminalOutcome: state.goalExecutionContract.terminalOutcome,
      startDayKey: '2026-04-13',
      endDayKey: '2026-06-12',
    };
    cycle.goalGovernanceContract.activeUntilISO = '2026-06-12';
    state.deliverablesByCycleId[state.activeCycleId].deliverables = [
      {
        id: 'd1',
        title: 'Remote project management job-search pipeline',
        estimateMin: 180,
        actionIds: ['act-1'],
      },
    ];
    cycle.actions = [
      {
        id: 'act-1',
        title: 'Maintain remote project management application tracker',
        deliverableId: 'd1',
        estimateMin: 180,
      },
    ];
    cycle.scheduleReviewBlocks = [
      {
        id: 'review-job-1',
        cycleId: state.activeCycleId,
        goalId,
        deliverableId: 'd1',
        actionId: 'act-1',
        title: 'Administrative tracker cleanup',
        start: '2026-04-20T09:00:00.000Z',
        durationMinutes: 60,
      },
      {
        id: 'review-job-2',
        cycleId: state.activeCycleId,
        goalId,
        deliverableId: 'd1',
        actionId: 'act-1',
        title: 'Administrative tracker cleanup follow-up',
        start: '2026-05-11T09:00:00.000Z',
        durationMinutes: 60,
      },
      {
        id: 'review-job-3',
        cycleId: state.activeCycleId,
        goalId,
        deliverableId: 'd1',
        actionId: 'act-1',
        title: 'Administrative tracker cleanup final pass',
        start: '2026-06-01T09:00:00.000Z',
        durationMinutes: 60,
      },
    ];

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const metrics = next.cyclesById[state.activeCycleId].metrics;

    expect(next.executionEvents).toEqual([]);
    expect(next.feasibilityByGoal[goalId].status).toBe('WITHHELD');
    expect(metrics.dynamicOutcome?.plannedBlocks).toBe(3);
    expect(metrics.workableDaysRemaining).toBeGreaterThan(0);
    expect(metrics.requiredWeeklyThroughput).toBeGreaterThan(0);
    expect(Number.isFinite(metrics.actualAvgPerWeek)).toBe(true);
    expect(Number.isFinite(metrics.recoveryMetrics?.projectedSlackAfterRecovery)).toBe(true);
    expect(metrics.supportHorizon?.source).toBe('applied_review_schedule');
  });
});
