import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';

function buildState({ startDay = '2026-01-01', deadlineDay = '2026-01-10', actions = [] } = {}) {
  const cycleId = 'cycle-sticky-preserve';
  return {
    state: {
      executionEvents: [],
      suggestedBlocks: [],
      appTime: { activeDayKey: startDay, timeZone: 'UTC' },
      today: { date: startDay },
      planDraft: { routeMinutes: 30, executionHorizonDays: 90 },
      constraints: {},
      dependencies: { defaultBufferMinutes: 0 },
      draftScheduleItemsByCycleId: { [cycleId]: [] },
      actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-1', actions } },
      cyclesById: {
        [cycleId]: {
          id: cycleId,
          actions,
          goalContract: {
            goalId: 'goal-1',
            startDate: startDay,
            deadline: { dayKey: deadlineDay },
            temporalBinding: {
              daysPerWeek: 7,
              specificDays: 'mon,tue,wed,thu,fri,sat,sun',
              sessionDurationMinutes: 30,
            },
          },
          coldPlan: { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } },
        },
      },
      deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [] } },
    },
    cycleId,
  };
}

describe('draftSchedule sticky preserve', () => {
  it('preserves all existing valid reservations on no-input rebuild', () => {
    const actions = Array.from({ length: 8 }).map((_, index) => ({
      id: `a-${index + 1}`,
      title: `Action ${index + 1}`,
      detail: `Detail ${index + 1}`,
      category: 'Focus',
      estimateMin: 30,
      deps: [],
      topoIndex: index,
      priority: index + 1,
    }));

    const { state, cycleId } = buildState({ actions });
    let firstStats = null;
    const first = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01', executionHorizonDays: 90 },
      captureStats: (stats) => {
        firstStats = stats;
      },
    });

    state.draftScheduleItemsByCycleId[cycleId] = first;

    let secondStats = null;
    const second = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01', executionHorizonDays: 90 },
      captureStats: (stats) => {
        secondStats = stats;
      },
    });

    expect(second).toEqual(first);
    expect(secondStats.reservationInputCount).toBeGreaterThan(0);
    expect(secondStats.preservedChunkCount).toBe(secondStats.reservationInputCount);
    expect(secondStats.movedChunkCount).toBe(0);
    expect(secondStats.droppedChunkCount).toBe(0);
    expect(secondStats.churnMovedMinutesTotal).toBe(0);
    expect(secondStats.churnReasonsCount).toEqual({});
    expect(firstStats.reasonCode).toBe(secondStats.reasonCode);
  });
});
