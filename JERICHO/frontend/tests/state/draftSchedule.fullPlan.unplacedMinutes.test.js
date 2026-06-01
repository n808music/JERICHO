import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';

function buildState() {
  const cycleId = 'cycle-1';
  const startDay = '2026-01-01';
  const deadlineDay = '2026-01-02';
  const actions = [
    {
      id: 'a-1',
      title: 'one',
      detail: 'detail',
      category: 'Focus',
      estimateMin: 30,
      deps: [],
      topoIndex: 0,
      priority: 1,
    },
    {
      id: 'a-2',
      title: 'two',
      detail: 'detail',
      category: 'Creation',
      estimateMin: 30,
      deps: [],
      topoIndex: 1,
      priority: 2,
    },
    {
      id: 'a-3',
      title: 'three',
      detail: 'detail',
      category: 'Resources',
      estimateMin: 30,
      deps: [],
      topoIndex: 2,
      priority: 3,
    },
  ];

  const goalContract = {
    goalId: 'goal-1',
    startDate: startDay,
    deadline: { dayKey: deadlineDay },
    temporalBinding: { daysPerWeek: 7, specificDays: 'mon,tue,wed,thu,fri,sat,sun', sessionDurationMinutes: 30 },
  };

  return {
    state: {
      executionEvents: [],
      suggestedBlocks: [],
      appTime: { activeDayKey: startDay, timeZone: 'UTC' },
      today: { date: startDay },
      planDraft: { routeMinutes: 30 },
      constraints: { maxScheduledMinutesPerDay: 30, maxScheduledMinutesPerWeek: 60 },
      actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-1', actions } },
      cyclesById: {
        [cycleId]: {
          id: cycleId,
          actions,
          goalContract,
          coldPlan: { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } },
        },
      },
      deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [] } },
    },
    cycleId,
    actions,
    goalContract,
  };
}

describe('draftSchedule full plan unplaced minute diagnostics', () => {
  it('captures total and category rollup for unplaced estimate minutes', () => {
    const { state, cycleId, actions, goalContract } = buildState();
    let captured = null;
    const items = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
      captureStats: (stats) => {
        captured = stats;
      },
    });

    expect(items).toHaveLength(2);
    expect(captured).toBeTruthy();
    expect(captured.unplacedEstimateMinTotal).toBe(30);
    expect(captured.unplacedEstimateMinByCategory).toEqual({ RESOURCES: 30 });
  });
});
