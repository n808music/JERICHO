import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';

function buildState({
  startDay = '2026-01-01',
  deadlineDay = '2026-01-05',
  actions = [],
  constraints = {},
  milestones = [],
  defaultBufferMinutes = 0,
  draftItems = [],
} = {}) {
  const cycleId = 'cycle-sticky-invalidation';
  return {
    state: {
      executionEvents: [],
      suggestedBlocks: [],
      appTime: { activeDayKey: startDay, timeZone: 'UTC' },
      today: { date: startDay },
      planDraft: { routeMinutes: 30, executionHorizonDays: 90 },
      constraints,
      dependencies: { defaultBufferMinutes },
      draftScheduleItemsByCycleId: { [cycleId]: draftItems },
      actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-1', actions } },
      cyclesById: {
        [cycleId]: {
          id: cycleId,
          actions,
          goalContract: {
            goalId: 'goal-1',
            startDate: startDay,
            deadline: { dayKey: deadlineDay },
            milestones,
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

describe('draftSchedule sticky invalidation', () => {
  it('invalidates preserved chunks when caps become tighter', () => {
    const actions = [
      { id: 'a', title: 'A', detail: 'A', category: 'Focus', estimateMin: 60, deps: [], topoIndex: 0, priority: 1 },
    ];
    const draftItems = [
      {
        id: 'draft-a-0',
        source: 'FULL_PLAN',
        requiresActionContext: true,
        actionId: 'a',
        dayKey: '2026-01-01',
        dateISO: '2026-01-01',
        startISO: '2026-01-01T09:00:00.000Z',
        endISO: '2026-01-01T09:30:00.000Z',
        minutes: 30,
        chunkIndex: 0,
        chunkCount: 2,
        allocatedMin: 30,
      },
      {
        id: 'draft-a-1',
        source: 'FULL_PLAN',
        requiresActionContext: true,
        actionId: 'a',
        dayKey: '2026-01-01',
        dateISO: '2026-01-01',
        startISO: '2026-01-01T09:30:00.000Z',
        endISO: '2026-01-01T10:00:00.000Z',
        minutes: 30,
        chunkIndex: 1,
        chunkCount: 2,
        allocatedMin: 30,
      },
    ];

    const { state, cycleId } = buildState({
      actions,
      constraints: { maxScheduledMinutesPerDay: 30 },
      draftItems,
    });

    let captured = null;
    buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
      captureStats: (stats) => {
        captured = stats;
      },
    });

    expect(captured.droppedChunkCount).toBeGreaterThan(0);
    expect(captured.churnReasonsCount.CAPACITY_CAP_VIOLATION || 0).toBeGreaterThan(0);
  });

  it('invalidates preserved dependent chunk when dependency buffer is violated', () => {
    const actions = [
      { id: 'a', title: 'A', detail: 'A', category: 'Focus', estimateMin: 30, deps: [], topoIndex: 0, priority: 1 },
      { id: 'b', title: 'B', detail: 'B', category: 'Focus', estimateMin: 30, deps: ['a'], topoIndex: 1, priority: 2 },
    ];
    const draftItems = [
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
      {
        id: 'draft-a',
        source: 'FULL_PLAN',
        requiresActionContext: true,
        actionId: 'a',
        dayKey: '2026-01-01',
        dateISO: '2026-01-01',
        startISO: '2026-01-01T09:30:00.000Z',
        endISO: '2026-01-01T10:00:00.000Z',
        minutes: 30,
        chunkIndex: 0,
        chunkCount: 1,
        allocatedMin: 30,
      },
    ];

    const { state, cycleId } = buildState({ actions, defaultBufferMinutes: 60, draftItems });
    let captured = null;
    buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
      captureStats: (stats) => {
        captured = stats;
      },
    });

    expect(captured.churnReasonsCount.DEP_BUFFER_VIOLATION || 0).toBeGreaterThan(0);
  });

  it('invalidates preserved window-bound chunk outside hard window', () => {
    const actions = [
      {
        id: 'm',
        title: 'Milestone',
        detail: 'M',
        category: 'Focus',
        estimateMin: 30,
        deps: [],
        topoIndex: 0,
        priority: 1,
      },
    ];
    const milestones = [
      {
        id: 'm-1',
        actionIds: ['m'],
        checkpointActionIds: [],
        windowStartDayKey: '2026-01-02',
        windowEndDayKey: '2026-01-02',
      },
    ];
    const draftItems = [
      {
        id: 'draft-m',
        source: 'FULL_PLAN',
        requiresActionContext: true,
        actionId: 'm',
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

    const { state, cycleId } = buildState({
      actions,
      milestones,
      constraints: { maxScheduledMinutesPerDay: 120 },
      draftItems,
    });
    let captured = null;
    buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
      captureStats: (stats) => {
        captured = stats;
      },
    });

    expect(captured.milestoneWindowConstraintMode).toBe('hard');
    expect(captured.churnReasonsCount.WINDOW_VIOLATION || 0).toBeGreaterThan(0);
  });
});
