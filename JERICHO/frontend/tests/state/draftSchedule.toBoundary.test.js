import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';

function mkAction(id, topoIndex) {
  return {
    id,
    goalId: 'goal-1',
    title: `Action ${id}`,
    brief: `Detail ${id}`,
    category: 'Focus',
    deps: [],
    status: 'todo',
    topoIndex,
    priority: 1,
  };
}

function buildState() {
  const cycleId = 'cycle-1';
  const actions = Array.from({ length: 10 }).map((_, index) => mkAction(`a-${index + 1}`, index));
  const forecastByDayKey = {};
  for (let i = 0; i < 10; i += 1) {
    const day = `2026-01-${String(20 + i).padStart(2, '0')}`;
    forecastByDayKey[day] = { totalBlocks: 1, byDeliverable: {} };
  }
  return {
    activeCycleId: cycleId,
    today: { date: '2026-01-20' },
    appTime: { timeZone: 'UTC', activeDayKey: '2026-01-20' },
    executionEvents: [],
    actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-1', actions } },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        goalContract: {
          goalId: 'goal-1',
          startDate: '2026-01-20',
          deadline: { dayKey: '2026-01-29' },
          temporalBinding: { daysPerWeek: 7 },
        },
        actions,
        coldPlan: { forecastByDayKey, dailyProjection: { forecastByDayKey: {} } },
      },
    },
    deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [] } },
    planDraft: { executionHorizonDays: 365 },
  };
}

describe('draft schedule to boundary', () => {
  it('emits rows across boundary days when slots and ready actions exist', () => {
    const state = buildState();
    const items = buildDraftScheduleItems(state, 'cycle-1', { boundaryMode: 'GOAL_ONLY' });
    const uniqueDays = new Set(items.map((item) => item.dayKey)).size;
    expect(items.length).toBeGreaterThan(0);
    expect(uniqueDays).toBeGreaterThan(0);
    expect(uniqueDays).toBeLessThanOrEqual(10);
  });
});
