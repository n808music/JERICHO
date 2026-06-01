import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';

function buildState({ draftItems = [] } = {}) {
  const cycleId = 'cycle-sticky-conflict';
  const actions = [
    { id: 'a', title: 'A', detail: 'A', category: 'Focus', estimateMin: 30, deps: [], topoIndex: 0, priority: 1 },
    { id: 'b', title: 'B', detail: 'B', category: 'Focus', estimateMin: 30, deps: [], topoIndex: 1, priority: 2 },
  ];
  return {
    state: {
      executionEvents: [],
      suggestedBlocks: [],
      appTime: { activeDayKey: '2026-01-01', timeZone: 'UTC' },
      today: { date: '2026-01-01' },
      planDraft: { routeMinutes: 30, executionHorizonDays: 90 },
      constraints: {},
      dependencies: { defaultBufferMinutes: 0 },
      draftScheduleItemsByCycleId: { [cycleId]: draftItems },
      actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-1', actions } },
      cyclesById: {
        [cycleId]: {
          id: cycleId,
          actions,
          goalContract: {
            goalId: 'goal-1',
            startDate: '2026-01-01',
            deadline: { dayKey: '2026-01-03' },
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
    actions,
  };
}

describe('draftSchedule sticky conflict resolution', () => {
  it('resolves overlapping reservations deterministically', () => {
    const overlapDraft = [
      {
        id: 'draft-a',
        source: 'FULL_PLAN',
        requiresActionContext: true,
        actionId: 'a',
        dayKey: '2026-01-01',
        dateISO: '2026-01-01',
        startISO: '2026-01-01T09:00:00.000Z',
        endISO: '2026-01-01T09:30:00.000Z',
        minutes: 30,
        chunkIndex: 0,
        chunkCount: 1,
        allocatedMin: 30,
      },
      {
        id: 'draft-b',
        source: 'FULL_PLAN',
        requiresActionContext: true,
        actionId: 'b',
        dayKey: '2026-01-01',
        dateISO: '2026-01-01',
        startISO: '2026-01-01T09:00:00.000Z',
        endISO: '2026-01-01T09:30:00.000Z',
        minutes: 30,
        chunkIndex: 0,
        chunkCount: 1,
        allocatedMin: 30,
      },
    ];

    const { state, cycleId, actions } = buildState({ draftItems: overlapDraft });

    let firstStats = null;
    const first = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
      captureStats: (stats) => {
        firstStats = stats;
      },
    });

    let secondStats = null;
    const second = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
      captureStats: (stats) => {
        secondStats = stats;
      },
    });

    expect(first).toEqual(second);
    expect(firstStats.churnReasonsCount.OVERLAP_CONFLICT || 0).toBeGreaterThan(0);
    expect(firstStats.churnReasonsCount).toEqual(secondStats.churnReasonsCount);
  });
});
