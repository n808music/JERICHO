import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';

function buildState() {
  const cycleId = 'cycle-1';
  const actions = Array.from({ length: 3 }).map((_, i) => ({
    id: `a-${i + 1}`,
    goalId: 'goal-1',
    title: `Action ${i + 1}`,
    brief: `Detail ${i + 1}`,
    category: 'Focus',
    deps: [],
    status: 'todo',
    topoIndex: i,
    priority: 1,
  }));
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
          deadline: { dayKey: '2026-01-22' },
          temporalBinding: { daysPerWeek: 7 },
        },
        actions,
        coldPlan: { forecastByDayKey, dailyProjection: { forecastByDayKey: {} } },
      },
    },
    deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [] } },
  };
}

describe('draft schedule boundary stop', () => {
  it('does not emit items beyond boundary date', () => {
    const items = buildDraftScheduleItems(buildState(), 'cycle-1', { boundaryMode: 'GOAL_ONLY' });
    expect(items.length).toBe(3);
    expect(items.every((item) => item.dayKey <= '2026-01-22')).toBe(true);
  });
});
