import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';

function buildState({
  actionsCount = 24,
  startDay = '2026-01-05',
  deadlineDay = '2026-01-31',
  days = 20,
  blocksPerDay = 5,
} = {}) {
  const cycleId = 'cycle-1';
  const actions = Array.from({ length: actionsCount }).map((_, i) => ({
    id: `a-${i + 1}`,
    goalId: 'goal-1',
    title: `Action ${i + 1}`,
    brief: `Detail ${i + 1}`,
    detail: `Detail ${i + 1}`,
    category: 'Focus',
    deps: [],
    status: 'todo',
    topoIndex: i,
    priority: 1,
  }));
  const forecastByDayKey = {};
  for (let i = 0; i < days; i += 1) {
    const day = new Date(`${startDay}T00:00:00.000Z`);
    day.setUTCDate(day.getUTCDate() + i);
    const dayKey = day.toISOString().slice(0, 10);
    forecastByDayKey[dayKey] = { totalBlocks: blocksPerDay, byDeliverable: {} };
  }
  return {
    appTime: { timeZone: 'UTC', activeDayKey: startDay, nowISO: `${startDay}T08:00:00.000Z` },
    today: { date: startDay, blocks: [] },
    executionEvents: [],
    activeCycleId: cycleId,
    actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-1', actions } },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        actions,
        goalContract: {
          goalId: 'goal-1',
          startDate: startDay,
          deadline: { dayKey: deadlineDay },
          temporalBinding: { daysPerWeek: 7, activationTime: '09:00', sessionDurationMinutes: 90 },
        },
        coldPlan: { forecastByDayKey, dailyProjection: { forecastByDayKey: {} } },
      },
    },
  };
}

describe('draft schedule sequential fill', () => {
  it('sequentially places full plan to deadline with max 3/day and no filler', () => {
    const state = buildState();
    const items = buildDraftScheduleItems(state, 'cycle-1', {
      startDateISO: state.appTime.activeDayKey,
      actions: state.actionsByCycleId['cycle-1'].actions,
      scheduleMode: 'FULL_PLAN',
    });

    expect(items).toHaveLength(24);
    const countsByDay = items.reduce((acc, item) => {
      acc[item.dayKey] = (acc[item.dayKey] || 0) + 1;
      return acc;
    }, {});
    Object.values(countsByDay).forEach((count) => expect(count).toBeLessThanOrEqual(3));

    const startSeries = items.map((item) => `${item.dayKey}:${item.startISO}`);
    const sortedSeries = [...startSeries].sort((a, b) => a.localeCompare(b));
    expect(startSeries).toEqual(sortedSeries);

    const uniqueActions = new Set(items.map((item) => item.actionId));
    expect(uniqueActions.size).toBe(24);
  });
});
