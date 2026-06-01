import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const cycleId = 'cycle-1';
  const startDay = '2026-01-01';
  const deadlineDay = '2026-01-05';
  const actions = [
    {
      id: 'action-1',
      goalId: 'goal-1',
      title: 'Deep work block',
      brief: 'Long estimate that should split',
      detail: 'Long estimate that should split',
      category: 'Focus',
      deps: [],
      status: 'todo',
      topoIndex: 0,
      priority: 1,
      estimateMin: 75,
    },
  ];
  const forecastByDayKey = {
    '2026-01-01': { totalBlocks: 3, byDeliverable: {} },
    '2026-01-02': { totalBlocks: 3, byDeliverable: {} },
    '2026-01-03': { totalBlocks: 3, byDeliverable: {} },
    '2026-01-04': { totalBlocks: 3, byDeliverable: {} },
    '2026-01-05': { totalBlocks: 3, byDeliverable: {} },
  };
  return {
    vector: {},
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [] }, flow: { streams: [] } },
    today: { date: startDay, blocks: [] },
    currentWeek: { weekStart: startDay, days: [] },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    ledger: [],
    executionEvents: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [] } },
    actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-1', actions } },
    draftScheduleItemsByCycleId: {},
    draftScheduleDiagnosticsByCycleId: {},
    appTime: { timeZone: 'UTC', activeDayKey: startDay, nowISO: `${startDay}T08:00:00.000Z`, isFollowingNow: true },
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        actions,
        goalContract: {
          goalId: 'goal-1',
          startDate: startDay,
          deadline: { dayKey: deadlineDay },
          temporalBinding: { daysPerWeek: 7, activationTime: '09:00', sessionDurationMinutes: 30 },
        },
        coldPlan: { forecastByDayKey, dailyProjection: { forecastByDayKey: {} } },
      },
    },
  };
}

describe('FULL_PLAN diagnostics alignment', () => {
  it('uses the same slot/assignment stats as emitted chunked draft items', () => {
    const rebuilt = computeDerivedState(buildState(), { type: 'REBUILD_SCHEDULE', payload: { cycleId: 'cycle-1' } });
    const draftItems = rebuilt.draftScheduleItemsByCycleId?.['cycle-1'] || [];
    const diagnostics = rebuilt.draftScheduleDiagnosticsByCycleId?.['cycle-1'] || {};

    expect(draftItems).toHaveLength(3);
    expect(diagnostics.requiredSlotsWeighted).toBe(3);
    expect(diagnostics.missingSlotsWeighted).toBe(0);
    expect(diagnostics.emittedAutomationSlots).toBe(3);
    expect(diagnostics.requiredSlotsWeighted).toBe(diagnostics.emittedAutomationSlots);
    expect(diagnostics.reasonCode).toBe('FULL_PLAN_PLACED_TO_DEADLINE');
  });
});
