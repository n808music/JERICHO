import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';

function buildState() {
  const cycleId = 'cycle-1';
  const startDay = '2026-01-01';
  const deadlineDay = '2026-01-02';
  const actions = [
    {
      id: 'a-late',
      title: 'late outcome',
      detail: 'detail',
      category: 'Focus',
      estimateMin: 30,
      deps: [],
      topoIndex: 0,
      priority: 1,
    },
    {
      id: 'a-early-checkpoint',
      title: 'early checkpoint',
      detail: 'detail',
      category: 'Creation',
      estimateMin: 30,
      deps: [],
      topoIndex: 1,
      priority: 2,
    },
    {
      id: 'a-early-outcome',
      title: 'early outcome',
      detail: 'detail',
      category: 'Creation',
      estimateMin: 30,
      deps: [],
      topoIndex: 2,
      priority: 3,
    },
    {
      id: 'a-unbound',
      title: 'unbound',
      detail: 'detail',
      category: 'Resources',
      estimateMin: 30,
      deps: [],
      topoIndex: 3,
      priority: 4,
    },
  ];

  const goalContract = {
    goalId: 'goal-1',
    startDate: startDay,
    deadline: { dayKey: deadlineDay },
    milestones: [
      {
        id: 'm-early',
        windowStartDayKey: '2026-01-01',
        windowEndDayKey: '2026-01-02',
        actionIds: ['a-early-outcome'],
        checkpointActionIds: ['a-early-checkpoint'],
      },
      {
        id: 'm-late',
        windowStartDayKey: '2026-01-10',
        windowEndDayKey: '2026-01-20',
        actionIds: ['a-late'],
        checkpointActionIds: [],
      },
    ],
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

describe('draftSchedule full plan milestone ordering', () => {
  it('places earliest milestone checkpoint and outcome first under constrained capacity', () => {
    const { state, cycleId, actions, goalContract } = buildState();
    const items = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
    });

    const placedActionIds = Array.from(new Set(items.map((item) => item.actionId)));
    expect(placedActionIds.length).toBeGreaterThan(0);
    expect(placedActionIds[0]).toBe('a-early-checkpoint');
  });
});
