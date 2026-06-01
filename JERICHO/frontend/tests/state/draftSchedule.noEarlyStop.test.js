import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';

function buildState() {
  const cycleId = 'cycle-1';
  const actions = Array.from({ length: 14 }).map((_, i) => ({
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
  for (let i = 0; i < 14; i += 1) {
    const day = `2026-02-${String(1 + i).padStart(2, '0')}`;
    forecastByDayKey[day] = { totalBlocks: 1, byDeliverable: {} };
  }
  return {
    activeCycleId: cycleId,
    today: { date: '2026-02-01' },
    appTime: { timeZone: 'UTC', activeDayKey: '2026-02-01' },
    executionEvents: [],
    actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-1', actions } },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        goalContract: {
          goalId: 'goal-1',
          startDate: '2026-02-01',
          deadline: { dayKey: '2026-02-14' },
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

describe('draft schedule no early stop', () => {
  it('emits beyond 7 days when boundary is later', () => {
    const items = buildDraftScheduleItems(buildState(), 'cycle-1', { boundaryMode: 'GOAL_ONLY' });
    const uniqueDays = new Set(items.map((item) => item.dayKey)).size;
    expect(uniqueDays).toBeGreaterThan(0);
    expect(uniqueDays).toBeLessThanOrEqual(14);
  });
});
