import { describe, expect, it } from 'vitest';
import {
  buildDraftScheduleItems,
  buildRouteSlotsWindow,
  filterDraftItemsByDay,
  getDraftBoundary,
  getDraftDiagnostics,
} from '../../src/state/draftSchedule.js';
import { buildExecutionEventFromBlock } from '../../src/state/engine/todayAuthority.ts';
import { getActionBlockers } from '../../src/domain/actions/actionSelectors.ts';

function buildSpineState({ deliverables = [], actions = [], forecastByDayKey = {}, executionEvents = [] } = {}) {
  const cycleId = 'cycle-1';
  const goalId = 'goal-1';
  return {
    activeCycleId: cycleId,
    appTime: { timeZone: 'UTC', activeDayKey: '2026-01-20', nowISO: '2026-01-20T08:00:00.000Z' },
    today: { date: '2026-01-20' },
    executionEvents,
    actionsByCycleId: {
      [cycleId]: { cycleId, goalId, actions },
    },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        goalContract: { goalId, startDate: '2026-01-20', deadline: { dayKey: '2026-02-20' } },
        actions,
        coldPlan: { forecastByDayKey, dailyProjection: { forecastByDayKey: {} } },
      },
    },
    deliverablesByCycleId: {
      [cycleId]: { cycleId, deliverables },
    },
  };
}

describe('Draft schedule builder', () => {
  it('builds forward route slots across days in deterministic order', () => {
    const state = buildSpineState({
      forecastByDayKey: {
        '2026-01-20': { totalBlocks: 1, byDeliverable: {} },
        '2026-01-21': { totalBlocks: 1, byDeliverable: {} },
        '2026-01-22': { totalBlocks: 1, byDeliverable: {} },
      },
    });
    const window = buildRouteSlotsWindow(state, {
      cycleId: 'cycle-1',
      startDateISO: '2026-01-20',
      daysForward: 3,
      routeMinutes: 30,
      timeZone: 'UTC',
    });
    const slots = window.slots;
    expect(slots).toHaveLength(3);
    expect(slots.map((slot) => slot.dayKey)).toEqual(['2026-01-20', '2026-01-21', '2026-01-22']);
    expect(window.daysCovered).toBe(3);
  });

  it('excludes occupied overlapping slots from the route window', () => {
    const executionEvents = [
      buildExecutionEventFromBlock(
        {
          id: 'blk-occupied',
          cycleId: 'cycle-1',
          goalId: 'goal-1',
          title: 'Occupied slot',
          start: '2026-01-20T09:00:00.000Z',
          end: '2026-01-20T09:30:00.000Z',
          status: 'scheduled',
        },
        { id: 'evt-occupied', kind: 'create', completed: false, dateISO: '2026-01-20' }
      ),
    ];
    const state = buildSpineState({
      executionEvents,
      forecastByDayKey: {
        '2026-01-20': { totalBlocks: 2, byDeliverable: {} },
      },
    });
    const window = buildRouteSlotsWindow(state, {
      cycleId: 'cycle-1',
      startDateISO: '2026-01-20',
      daysForward: 1,
      routeMinutes: 30,
      timeZone: 'UTC',
    });
    expect(window.slots).toHaveLength(1);
    expect(window.slots[0].startISO).toBe('2026-01-20T09:30:00.000Z');
  });

  it('merges suggested and route items deterministically and filters by contract start', () => {
    const suggested = [
      {
        id: 's1',
        title: 'Suggested soon',
        startISO: '2026-01-21T09:00:00.000Z',
        durationMinutes: 30,
        domain: 'CREATION',
      },
      {
        id: 's2',
        title: 'Suggested later',
        startISO: '2026-01-23T10:00:00.000Z',
        durationMinutes: 45,
        domain: 'FOCUS',
      },
    ];
    const route = [
      { dayKey: '2026-01-20', totalBlocks: 2 },
      { dayKey: '2026-01-21', totalBlocks: 1 },
    ];
    const contract = { startDate: '2026-01-21' };
    const items = buildDraftScheduleItems(null, null, {
      suggestedBlocks: suggested,
      routeSuggestions: route,
      contract,
      defaults: { primaryDomain: 'CREATION' },
    });
    expect(items.every((item) => item.dayKey >= '2026-01-21')).toBe(true);
    expect(items[0].dayKey).toBe('2026-01-21');
    expect(items.some((item) => item.source === 'coldPlan')).toBe(true);
    expect(items.some((item) => item.source === 'suggestedPath')).toBe(true);
  });

  it('filters items for a given day key', () => {
    const items = [
      { dayKey: '2026-01-20', id: 'one' },
      { dayKey: '2026-01-20', id: 'two' },
      { dayKey: '2026-01-21', id: 'three' },
    ];
    const filtered = filterDraftItemsByDay(items, '2026-01-20');
    expect(filtered.map((item) => item.id)).toEqual(['one', 'two']);
  });

  it('stamps requiresActionContext for strategic plan generated items', () => {
    const contract = {
      planGenerationMechanismClass: 'GENERIC_DETERMINISTIC',
      target: { count: 1, unit: 'SONG_DRAFT' },
      temporalBinding: {
        daysPerWeek: 3,
        activationTime: '09:00',
        sessionDurationMinutes: 60,
        startDayKey: '2026-01-19',
      },
      deadline: { dayKey: '2026-01-31' },
      domainPrimary: 'FOCUS',
    };
    const items = buildDraftScheduleItems(null, null, {
      contract,
      suggestedBlocks: [],
      routeSuggestions: [],
      actions: [],
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.source === 'strategicPlan')).toBe(true);
    expect(items.every((item) => item.requiresActionContext === true)).toBe(true);
  });

  it('keeps requiresActionContext for coldPlan and suggestedPath items', () => {
    const items = buildDraftScheduleItems(null, null, {
      suggestedBlocks: [
        { id: 's1', title: 'Suggested block', dayKey: '2026-01-21', durationMinutes: 30, domain: 'FOCUS' },
      ],
      routeSuggestions: [{ dayKey: '2026-01-21', totalBlocks: 1 }],
      contract: { startDate: '2026-01-20' },
      defaults: { primaryDomain: 'FOCUS' },
    });
    const coldPlanItems = items.filter((item) => item.source === 'coldPlan');
    const suggestedItems = items.filter((item) => item.source === 'suggestedPath');
    expect(coldPlanItems.length).toBeGreaterThan(0);
    expect(suggestedItems.length).toBeGreaterThan(0);
    expect(coldPlanItems.every((item) => item.requiresActionContext === true)).toBe(true);
    expect(suggestedItems.every((item) => item.requiresActionContext === true)).toBe(true);
  });

  it('emits only action-linked automation items when an action plan exists', () => {
    const actions = Array.from({ length: 8 }).map((_, idx) => ({
      id: `a-${idx + 1}`,
      goalId: 'goal-1',
      title: `Action ${idx + 1}`,
      brief: `Brief ${idx + 1}`,
      category: 'Focus',
      deps: [],
      status: 'todo',
      topoIndex: idx,
      priority: 1,
    }));
    const items = buildDraftScheduleItems(null, null, {
      suggestedBlocks: [],
      routeSuggestions: [{ dayKey: '2026-01-21', totalBlocks: 2 }],
      actions,
      contract: { startDate: '2026-01-20' },
      defaults: { primaryDomain: 'FOCUS' },
    });
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.source === 'coldPlan')).toBe(true);
    expect(items.every((item) => item.actionId)).toBe(true);
    expect(items.some((item) => (item.title || '').includes('Missing action context'))).toBe(false);
  });

  it('drops automation rows that are missing action context when actions exist', () => {
    const actions = [
      {
        id: 'a-1',
        goalId: 'goal-1',
        title: 'Action 1',
        brief: 'Brief 1',
        category: 'Focus',
        deps: [],
        status: 'todo',
        topoIndex: 0,
        priority: 1,
      },
    ];
    const items = buildDraftScheduleItems(null, null, {
      suggestedBlocks: [],
      routeSuggestions: [{ dayKey: '2026-01-21', totalBlocks: 2 }],
      actions,
      contract: { startDate: '2026-01-20' },
      defaults: { primaryDomain: 'FOCUS' },
    });
    expect(items).toHaveLength(1);
    expect(items[0].actionId).toBe('a-1');
  });

  it('reports NO_READY_ACTIONS diagnostics when actions exist but none are dependency-ready', () => {
    const actions = [
      {
        id: 'a-1',
        goalId: 'goal-1',
        title: 'Action 1',
        brief: 'Brief 1',
        category: 'Focus',
        deps: ['a-2'],
        status: 'todo',
        topoIndex: 1,
        priority: 1,
      },
      {
        id: 'a-2',
        goalId: 'goal-1',
        title: 'Action 2',
        brief: 'Brief 2',
        category: 'Focus',
        deps: ['a-1'],
        status: 'todo',
        topoIndex: 2,
        priority: 1,
      },
    ];
    const routeSuggestions = [{ dayKey: '2026-01-21', totalBlocks: 2 }];
    const items = buildDraftScheduleItems(null, null, {
      suggestedBlocks: [],
      routeSuggestions,
      actions,
      contract: { startDate: '2026-01-20' },
      defaults: { primaryDomain: 'FOCUS' },
    });
    expect(items.length).toBeLessThanOrEqual(1);
    const diagnostics = getDraftDiagnostics({
      routeSuggestions,
      actions,
      draftItems: items,
      scheduleMode: 'READY_ONLY',
    });
    const diagnosticsWithDeadline = getDraftDiagnostics({
      routeSuggestions,
      actions,
      draftItems: items,
      scheduleMode: 'READY_ONLY',
      deadlineISO: '2026-01-31T23:59:59.000Z',
    });
    expect(diagnostics.reasonCode).toBe('NO_GOAL_DEADLINE');
    expect(diagnosticsWithDeadline.reasonCode).toBe('NO_READY_ACTIONS');
    expect(diagnosticsWithDeadline.requestedAutomationSlots).toBe(2);
    expect(diagnosticsWithDeadline.emittedAutomationSlots).toBe(0);
    const blockers = getActionBlockers(actions);
    expect(blockers.length).toBeGreaterThan(0);
  });

  it('stops DELIVERABLE boundary emission once deliverable actions are already covered', () => {
    const actions = [
      {
        id: 'a-1',
        goalId: 'goal-1',
        title: 'Define season thesis',
        detail: 'Write thesis',
        brief: 'Write thesis',
        category: 'Focus',
        deps: [],
        status: 'todo',
        topoIndex: 0,
        priority: 1,
      },
    ];
    const deliverables = [{ id: 'd-1', title: 'Season thesis', dueDayKey: '2026-01-22', actionIds: ['a-1'] }];
    const executionEvents = [
      buildExecutionEventFromBlock(
        {
          id: 'blk-1',
          cycleId: 'cycle-1',
          goalId: 'goal-1',
          actionId: 'a-1',
          title: 'Define season thesis',
          detail: 'Write thesis',
          category: 'Focus',
          start: '2026-01-20T09:00:00.000Z',
          end: '2026-01-20T09:30:00.000Z',
          status: 'planned',
        },
        {
          id: 'evt-1',
          kind: 'create',
          completed: false,
          dateISO: '2026-01-20',
        }
      ),
    ];
    const state = buildSpineState({
      actions,
      deliverables,
      executionEvents,
      forecastByDayKey: { '2026-01-21': { totalBlocks: 1, byDeliverable: { 'd-1': 1 } } },
    });
    const items = buildDraftScheduleItems(state, 'cycle-1', {
      startDateISO: '2026-01-20',
      daysForward: 7,
      actions,
      contract: state.cyclesById['cycle-1'].goalContract,
    });
    expect(items.length).toBeLessThanOrEqual(1);
    const diagnostics = getDraftDiagnostics({
      routeSuggestions: [{ dayKey: '2026-01-21', totalBlocks: 1 }],
      actions,
      draftItems: items,
      boundaryKind: 'DELIVERABLE',
      boundaryLabel: 'Season thesis (due 2026-01-22)',
      routeSlotWindowDays: 7,
      routeSlotsCount: 1,
      deadlineISO: '2026-01-22T23:59:59.000Z',
      deliverableCovered: true,
    });
    expect(diagnostics.reasonCode).toBe('DELIVERABLE_COVERED');
    expect(diagnostics.boundaryKind).toBe('DELIVERABLE');
  });

  it('uses goal/horizon boundary and emits up to available boundary slots when deliverables are absent', () => {
    const actions = [
      {
        id: 'a-1',
        goalId: 'goal-1',
        title: 'Define season thesis',
        detail: 'Write thesis',
        brief: 'Write thesis',
        category: 'Focus',
        deps: [],
        status: 'todo',
        topoIndex: 0,
        priority: 1,
      },
      {
        id: 'a-2',
        goalId: 'goal-1',
        title: 'Map season arc beats',
        detail: 'Map beats',
        brief: 'Map beats',
        category: 'Creation',
        deps: [],
        status: 'todo',
        topoIndex: 1,
        priority: 2,
      },
    ];
    const state = buildSpineState({
      actions,
      forecastByDayKey: {
        '2026-01-20': { totalBlocks: 1, byDeliverable: {} },
        '2026-01-21': { totalBlocks: 1, byDeliverable: {} },
      },
    });
    const boundary = getDraftBoundary(state, 'cycle-1', { daysForward: 7 });
    const items = buildDraftScheduleItems(state, 'cycle-1', {
      startDateISO: '2026-01-20',
      daysForward: 7,
      boundary,
      actions,
      contract: state.cyclesById['cycle-1'].goalContract,
    });
    expect(['GOAL', 'HORIZON_FALLBACK', 'HORIZON']).toContain(boundary.kind);
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.actionId && item.title && item.detail)).toBe(true);
    const diagnostics = getDraftDiagnostics({
      routeSuggestions: [
        { dayKey: '2026-01-20', totalBlocks: 1 },
        { dayKey: '2026-01-21', totalBlocks: 1 },
      ],
      actions,
      draftItems: items,
      boundaryKind: boundary.kind,
      boundaryLabel: boundary.label,
      routeSlotWindowDays: 7,
      routeSlotsCount: 2,
    });
    expect(typeof diagnostics.boundaryLabel).toBe('string');
    expect(diagnostics.routeSlotsCount).toBe(2);
  });
});
