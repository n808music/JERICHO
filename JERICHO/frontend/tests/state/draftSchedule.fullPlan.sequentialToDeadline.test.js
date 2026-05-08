import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems, getDraftDiagnostics } from '../../src/state/draftSchedule.js';

function buildState() {
  const cycleId = 'cycle-1';
  const startDay = '2026-01-05';
  const deadlineDay = '2026-01-20';
  const actions = Array.from({ length: 24 }).map((_, i) => {
    const id = `a-${i + 1}`;
    return {
      id,
      goalId: 'goal-1',
      title: `Action ${i + 1}`,
      brief: `Detail ${i + 1}`,
      detail: `Detail ${i + 1}`,
      category: 'Focus',
      deps: i === 0 ? [] : [`a-${i}`],
      status: 'todo',
      topoIndex: i,
      priority: 1,
    };
  });
  const forecastByDayKey = {};
  for (let i = 0; i < 20; i += 1) {
    const day = new Date(`${startDay}T00:00:00.000Z`);
    day.setUTCDate(day.getUTCDate() + i);
    const dayKey = day.toISOString().slice(0, 10);
    forecastByDayKey[dayKey] = { totalBlocks: 4, byDeliverable: {} };
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

describe('draft schedule full plan to deadline', () => {
  it('places all planning actions sequentially and includes blocked metadata', () => {
    const state = buildState();
    const cycleId = 'cycle-1';
    const items = buildDraftScheduleItems(state, cycleId, {
      startDateISO: state.appTime.activeDayKey,
      actions: state.actionsByCycleId[cycleId].actions,
      scheduleMode: 'FULL_PLAN',
    });
    const diagnostics = getDraftDiagnostics({
      state,
      cycleId,
      actions: state.actionsByCycleId[cycleId].actions,
      draftItems: items,
      fullDraftItems: items,
      scheduleMode: 'FULL_PLAN',
      startDateISO: `${state.appTime.activeDayKey}T00:00:00.000Z`,
      deadlineISO: '2026-01-20T23:59:59.000Z',
    });

    expect(diagnostics.reasonCode).toBe('FULL_PLAN_PLACED_TO_DEADLINE');
    expect(diagnostics.draftTotalCount).toBe(diagnostics.plannedActionsCount);
    expect(items.map((item) => `${item.dayKey}:${item.startISO}`)).toEqual(
      [...items.map((item) => `${item.dayKey}:${item.startISO}`)].sort((a, b) => a.localeCompare(b))
    );
    expect(items.some((item) => item.blocked === true)).toBe(true);
    expect(items.some((item) => Array.isArray(item.unmetDepIds) && item.unmetDepIds.length > 0)).toBe(true);
  });
});
