import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';

function buildState({
  startDay = '2026-01-01',
  deadlineDay = '2026-01-03',
  actions = [],
  milestones = [],
  constraints = {},
  defaultBufferMinutes = 0,
} = {}) {
  const cycleId = 'cycle-dep-buffer';
  return {
    state: {
      executionEvents: [],
      suggestedBlocks: [],
      appTime: { activeDayKey: startDay, timeZone: 'UTC' },
      today: { date: startDay },
      planDraft: { routeMinutes: 30 },
      constraints,
      dependencies: { defaultBufferMinutes },
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

describe('draftSchedule dependency buffer placement', () => {
  it('enforces earliest start using last dep chunk end plus buffer', () => {
    const actions = [
      { id: 'a', title: 'A', detail: 'A', category: 'Focus', estimateMin: 75, deps: [], topoIndex: 0, priority: 1 },
      { id: 'b', title: 'B', detail: 'B', category: 'Focus', estimateMin: 30, deps: ['a'], topoIndex: 1, priority: 2 },
    ];
    const { state, cycleId } = buildState({ actions, defaultBufferMinutes: 60 });
    const items = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
    });

    const aItems = items.filter((item) => item.actionId === 'a');
    const bItem = items.find((item) => item.actionId === 'b');
    const aLastEndAt = Math.max(...aItems.map((item) => Date.parse(item.endISO)));
    const bStartAt = Date.parse(bItem.startISO);
    expect(bStartAt).toBeGreaterThanOrEqual(aLastEndAt + 60 * 60000);
  });

  it('allows immediate dependent placement when buffer is zero', () => {
    const actions = [
      { id: 'a', title: 'A', detail: 'A', category: 'Focus', estimateMin: 75, deps: [], topoIndex: 0, priority: 1 },
      { id: 'b', title: 'B', detail: 'B', category: 'Focus', estimateMin: 30, deps: ['a'], topoIndex: 1, priority: 2 },
    ];
    const { state, cycleId } = buildState({ actions, defaultBufferMinutes: 0 });
    const items = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
    });

    const aItems = items.filter((item) => item.actionId === 'a');
    const bItem = items.find((item) => item.actionId === 'b');
    const aLastEndAt = Math.max(...aItems.map((item) => Date.parse(item.endISO)));
    const bStartAt = Date.parse(bItem.startISO);
    expect(bStartAt).toBeGreaterThanOrEqual(aLastEndAt);
  });

  it('marks dependent unplaced when buffer makes schedule infeasible', () => {
    const actions = [
      { id: 'a', title: 'A', detail: 'A', category: 'Focus', estimateMin: 75, deps: [], topoIndex: 0, priority: 1 },
      { id: 'b', title: 'B', detail: 'B', category: 'Focus', estimateMin: 30, deps: ['a'], topoIndex: 1, priority: 2 },
    ];
    const { state, cycleId } = buildState({
      actions,
      deadlineDay: '2026-01-01',
      defaultBufferMinutes: 60,
    });
    let captured = null;
    const items = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
      captureStats: (stats) => {
        captured = stats;
      },
    });

    expect(items.some((item) => item.actionId === 'b')).toBe(false);
    expect(captured.unassignedActionReasons?.b).toBe('DEPENDENCY_NOT_READY');
  });

  it('keeps soft fallback deterministic and dep-ready for windowed milestone action', () => {
    const actions = [
      { id: 'a', title: 'A', detail: 'A', category: 'Focus', estimateMin: 75, deps: [], topoIndex: 0, priority: 1 },
      { id: 'b', title: 'B', detail: 'B', category: 'Focus', estimateMin: 30, deps: ['a'], topoIndex: 1, priority: 2 },
    ];
    const milestones = [
      {
        id: 'm-1',
        windowStartDayKey: '2026-01-01',
        windowEndDayKey: '2026-01-01',
        actionIds: ['b'],
        checkpointActionIds: [],
      },
    ];
    const { state, cycleId } = buildState({ actions, milestones, defaultBufferMinutes: 60 });
    let captured = null;
    const items = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
      captureStats: (stats) => {
        captured = stats;
      },
    });

    const bItem = items.find((item) => item.actionId === 'b');
    const aItems = items.filter((item) => item.actionId === 'a');
    expect(captured.milestoneWindowConstraintMode).toBe('soft');
    if (bItem) {
      const aLastEndAt = Math.max(...aItems.map((item) => Date.parse(item.endISO)));
      expect(Date.parse(bItem.startISO)).toBeGreaterThanOrEqual(aLastEndAt + 60 * 60000);
      expect(bItem.dayKey >= '2026-01-02').toBe(true);
    } else {
      expect(captured.unassignedActionReasons?.b).toBe('MILESTONE_WINDOW_NO_SLOT');
    }
  });

  it('applies dep cutoff against preserved reservations from prior draft cache', () => {
    const actions = [
      { id: 'a', title: 'A', detail: 'A', category: 'Focus', estimateMin: 30, deps: [], topoIndex: 0, priority: 1 },
      { id: 'b', title: 'B', detail: 'B', category: 'Focus', estimateMin: 30, deps: ['a'], topoIndex: 1, priority: 2 },
    ];
    const { state, cycleId } = buildState({ actions, defaultBufferMinutes: 60 });
    state.draftScheduleItemsByCycleId = {
      [cycleId]: [
        {
          id: 'draft:a',
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
      ],
    };
    const items = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
    });
    const a = items.find((item) => item.actionId === 'a');
    const b = items.find((item) => item.actionId === 'b');
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(Date.parse(b.startISO)).toBeGreaterThanOrEqual(Date.parse(a.endISO) + 60 * 60000);
  });
});
