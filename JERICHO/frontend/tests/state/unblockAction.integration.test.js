import { describe, expect, it } from 'vitest';
import { computeReadyActions } from '../../src/domain/actions/actionSelectors.ts';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const dayKey = '2026-01-20';
  const cycleId = 'cycle-1';
  const a1 = {
    id: 'goal-1:a-1',
    goalId: 'goal-1',
    title: 'Skipped prerequisite',
    brief: 'Skipped prerequisite',
    definitionOfDone: 'Done',
    estimateMin: 30,
    category: 'Focus',
    deps: [],
    status: 'skipped',
    topoIndex: 0,
    priority: 1,
  };
  const a2 = {
    id: 'goal-1:a-2',
    goalId: 'goal-1',
    title: 'Blocked action',
    brief: 'Blocked by skipped prerequisite',
    definitionOfDone: 'Done',
    estimateMin: 30,
    category: 'Focus',
    deps: ['goal-1:a-1'],
    status: 'todo',
    topoIndex: 1,
    priority: 1,
  };
  return {
    vector: {},
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [] }, flow: { streams: [] } },
    today: { date: dayKey, blocks: [], completionRate: 0, practices: [], loadByPractice: {} },
    currentWeek: { weekStart: dayKey, days: [] },
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    lastAdaptedDate: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    constraints: {},
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T08:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    profileLearning: {},
    activeCycleId: cycleId,
    actionsByCycleId: {
      [cycleId]: { cycleId, goalId: 'goal-1', actions: [a1, a2] },
    },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        actions: [a1, a2],
        goalContract: {
          goalId: 'goal-1',
          goalLabel: 'ship deterministic planner validation',
          startDate: dayKey,
          deadline: { dayKey: '2026-02-20' },
        },
        coldPlan: {
          forecastByDayKey: {
            [dayKey]: { totalBlocks: 1, byDeliverable: {} },
          },
          dailyProjection: { forecastByDayKey: {} },
        },
        summary: { completionCount: 0, completionRate: 0 },
      },
    },
    goalExecutionContract: {
      goalId: 'goal-1',
      goalLabel: 'ship deterministic planner validation',
      startDate: dayKey,
      deadline: { dayKey: '2026-02-20' },
    },
    goalDirective: { goalId: 'goal-1', directiveId: 'dir-1' },
    directiveEligibilityByGoal: { 'goal-1': { eligible: true } },
    planDraft: { blocksPerWeek: 4, daysPerWeek: 4, primaryDomain: 'CREATION', minutesPerDay: 90 },
    planCalibration: null,
    correctionSignals: null,
  };
}

describe('unblock action integration', () => {
  it('creates deterministic unblock action and makes at least one action ready', () => {
    const before = buildState();
    expect(computeReadyActions(before.actionsByCycleId['cycle-1'].actions)).toHaveLength(0);

    const next = computeDerivedState(before, { type: 'CREATE_UNBLOCK_ACTION', payload: { cycleId: 'cycle-1' } });
    const actions = next.actionsByCycleId['cycle-1'].actions;
    expect(actions.length).toBe(3);
    const unblock = actions.find((action) => action.meta?.kind === 'unblock');
    expect(unblock).toBeTruthy();
    expect(unblock.id).toBe('unblock:cycle-1');
    expect(unblock.deps).toEqual([]);

    const ready = computeReadyActions(actions);
    expect(ready.length).toBeGreaterThan(0);
    expect(ready[0].id).toBe('unblock:cycle-1');

    const cycle = next.cyclesById['cycle-1'];
    const routeSuggestions = Object.keys(cycle.coldPlan?.forecastByDayKey || {}).map((key) => ({
      dayKey: key,
      totalBlocks: cycle.coldPlan.forecastByDayKey[key].totalBlocks || 0,
      byDeliverable: cycle.coldPlan.forecastByDayKey[key].byDeliverable || {},
    }));
    const draft = buildDraftScheduleItems(next, 'cycle-1', {
      suggestedBlocks: [],
      routeSuggestions,
      actions,
      contract: cycle.goalContract,
      defaults: { todayKey: '2026-01-20', primaryDomain: 'FOCUS', routeMinutes: 30 },
    });
    expect(draft.length).toBeGreaterThan(0);
    expect(draft[0].actionId).toBe('unblock:cycle-1');
  });
});
