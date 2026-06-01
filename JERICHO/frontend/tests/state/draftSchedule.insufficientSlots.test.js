import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems, getDraftDiagnostics } from '../../src/state/draftSchedule.js';

function buildState() {
  const cycleId = 'cycle-1';
  const startDay = '2026-01-05';
  const deadlineDay = '2026-01-10';
  const actions = Array.from({ length: 24 }).map((_, i) => ({
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
  for (let i = 0; i < 6; i += 1) {
    const day = new Date(`${startDay}T00:00:00.000Z`);
    day.setUTCDate(day.getUTCDate() + i);
    const dayKey = day.toISOString().slice(0, 10);
    forecastByDayKey[dayKey] = { totalBlocks: 3, byDeliverable: {} };
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

describe('draft schedule insufficient slots', () => {
  it('fails explicitly when route slots before deadline are insufficient', () => {
    const state = buildState();
    const cycleId = 'cycle-1';
    const items = buildDraftScheduleItems(state, cycleId, {
      startDateISO: state.appTime.activeDayKey,
      actions: state.actionsByCycleId[cycleId].actions,
      scheduleMode: 'FULL_PLAN',
    });
    expect(Array.isArray(items)).toBe(true);

    const diagnostics = getDraftDiagnostics({
      state,
      cycleId,
      actions: state.actionsByCycleId[cycleId].actions,
      draftItems: items,
      fullDraftItems: items,
      scheduleMode: 'FULL_PLAN',
      startDateISO: `${state.appTime.activeDayKey}T00:00:00.000Z`,
      deadlineISO: '2026-01-10T23:59:59.000Z',
    });
    expect(['INSUFFICIENT_ROUTE_SLOTS_TO_DEADLINE', 'HIT_BOUNDARY']).toContain(diagnostics.reasonCode);
    expect(diagnostics.requiredSlots).toBe(24);
    expect(diagnostics.requiredSlotsWeighted).toBe(24);
    expect(diagnostics.availableSlots).toBe(18);
    expect(diagnostics.missingSlots).toBe(6);
    expect(diagnostics.missingSlotsWeighted).toBe(6);
  });
});
