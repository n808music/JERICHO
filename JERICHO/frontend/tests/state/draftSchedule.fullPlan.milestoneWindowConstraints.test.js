import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';

function buildState() {
  const cycleId = 'cycle-1';
  const startDay = '2026-01-01';
  const deadlineDay = '2026-01-03';
  const actions = [
    {
      id: 'a-milestone',
      title: 'milestone action',
      detail: 'detail',
      category: 'Focus',
      estimateMin: 30,
      deps: [],
      topoIndex: 0,
      priority: 1,
    },
    {
      id: 'a-normal',
      title: 'normal action',
      detail: 'detail',
      category: 'Creation',
      estimateMin: 30,
      deps: [],
      topoIndex: 1,
      priority: 2,
    },
  ];

  const goalContract = {
    goalId: 'goal-1',
    startDate: startDay,
    deadline: { dayKey: deadlineDay },
    milestones: [
      {
        id: 'm-future',
        windowStartDayKey: '2026-02-01',
        windowEndDayKey: '2026-02-05',
        actionIds: ['a-milestone'],
        checkpointActionIds: [],
      },
    ],
    temporalBinding: { daysPerWeek: 7, specificDays: 'mon,tue,wed,thu,fri,sat,sun', sessionDurationMinutes: 30 },
  };

  return {
    state: {
      executionEvents: [],
      suggestedBlocks: [],
      appTime: { activeDayKey: startDay, timeZone: 'UTC' },
      today: { date: startDay },
      planDraft: { routeMinutes: 30 },
      constraints: { maxScheduledMinutesPerDay: 30, maxScheduledMinutesPerWeek: 60 },
      actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-1', actions } },
      cyclesById: {
        [cycleId]: {
          id: cycleId,
          actions,
          goalContract,
          coldPlan: { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } },
        },
      },
      deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [] } },
    },
    cycleId,
    actions,
    goalContract,
  };
}

describe('draftSchedule milestone window constraints', () => {
  it('uses milestone horizon even when milestone end is beyond goal deadline', () => {
    const { state, cycleId, actions, goalContract } = buildState();
    let captured = null;
    buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01', fullPlanMaxHorizonDays: 365 },
      captureStats: (stats) => {
        captured = stats;
      },
    });

    expect(captured.horizonMode).toBe('MILESTONE_WINDOW');
    expect(captured.placementHorizonDays).toBeGreaterThan(7);
    expect(captured.placementHorizonRequestedEndISO?.startsWith('2026-02-05')).toBe(true);
    expect(captured.placementWindowEndISO?.startsWith('2026-02-05')).toBe(true);
    expect(captured.placementHorizonGuardApplied).toBe(false);
  });

  it('applies deterministic horizon guard when requested horizon exceeds guard days', () => {
    const { state, cycleId, actions } = buildState();
    state.cyclesById[cycleId].goalContract.milestones = [
      {
        id: 'm-long',
        windowStartDayKey: '2026-04-01',
        windowEndDayKey: '2026-12-31',
        actionIds: ['a-milestone'],
        checkpointActionIds: [],
      },
    ];

    let captured = null;
    buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01', fullPlanMaxHorizonDays: 20 },
      captureStats: (stats) => {
        captured = stats;
      },
    });

    expect(captured.horizonMode).toBe('MILESTONE_WINDOW');
    expect(captured.placementHorizonRequestedEndISO?.startsWith('2026-12-31')).toBe(true);
    expect(captured.placementHorizonGuardApplied).toBe(true);
    expect(captured.placementHorizonGuardDays).toBe(20);
    expect(captured.placementHorizonGuardedEndISO?.startsWith('2026-01-20')).toBe(true);
    expect(captured.placementWindowEndISO?.startsWith('2026-01-20')).toBe(true);
  });

  it('marks milestone action as dependency-not-ready-in-window when prerequisite is unresolved', () => {
    const { state, cycleId, goalContract } = buildState();
    const actions = [
      {
        id: 'a-prereq',
        title: 'prereq',
        detail: 'detail',
        category: 'Focus',
        estimateMin: 30,
        deps: [],
        topoIndex: 0,
        priority: 1,
      },
      {
        id: 'a-milestone',
        title: 'milestone action',
        detail: 'detail',
        category: 'Focus',
        estimateMin: 30,
        deps: ['a-prereq'],
        topoIndex: 1,
        priority: 2,
      },
    ];
    state.actionsByCycleId[cycleId].actions = actions;
    state.cyclesById[cycleId].actions = actions;
    state.cyclesById[cycleId].goalContract.milestones = [
      {
        id: 'm-gated',
        windowStartDayKey: '2026-01-01',
        windowEndDayKey: '2026-01-02',
        actionIds: ['a-milestone'],
        checkpointActionIds: [],
      },
    ];

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

    const placedActionIds = Array.from(new Set(items.map((item) => item.actionId)));
    expect(placedActionIds).toContain('a-prereq');
    expect(placedActionIds).not.toContain('a-milestone');
    expect(captured.unassignedActionReasons).toEqual({ 'a-milestone': 'DEP_NOT_READY_IN_WINDOW' });
  });

  it('marks milestone action unplaced when no slot exists inside required window', () => {
    const { state, cycleId, actions, goalContract } = buildState();
    state.cyclesById[cycleId].goalContract.temporalBinding = {
      ...state.cyclesById[cycleId].goalContract.temporalBinding,
      specificDays: 'mon',
    };
    state.cyclesById[cycleId].goalContract.milestones = [
      {
        id: 'm-no-slot',
        windowStartDayKey: '2026-01-02',
        windowEndDayKey: '2026-01-03',
        actionIds: ['a-milestone'],
        checkpointActionIds: [],
      },
    ];
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

    const placedActionIds = Array.from(new Set(items.map((item) => item.actionId)));
    expect(placedActionIds).toEqual([]);
    expect(captured.reasonCode).toBe('MILESTONE_WINDOW_NO_SLOT');
    expect(captured.unassignedActionReasons?.['a-milestone']).toBe('MILESTONE_WINDOW_NO_SLOT');
    expect(captured.milestoneWindowMissCountPlacement).toBe(1);
  });

  it('uses full candidate slot universe in soft mode', () => {
    const { state, cycleId, actions } = buildState();
    state.constraints = { maxBlocksPerDay: 3 };
    state.cyclesById[cycleId].goalContract.milestones = [
      {
        id: 'm-soft',
        windowStartDayKey: '2026-01-02',
        windowEndDayKey: '2026-01-03',
        actionIds: ['a-milestone'],
        checkpointActionIds: [],
      },
    ];

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

    expect(captured.milestoneWindowConstraintMode).toBe('soft');
    expect(captured.slotUniverseMode).toBe('FULL_CANDIDATE');
    expect(captured.slotUniverseCandidateCount).toBe(9);
    expect(captured.slotUniverseSelectedCount).toBe(9);
  });

  it('marks windowed action as DEP_NOT_READY_IN_WINDOW in soft mode when dependency cutoff blocks all in-window slots', () => {
    const { state, cycleId } = buildState();
    state.constraints = { maxBlocksPerDay: 3 };
    const actions = [
      {
        id: 'a-prereq',
        title: 'prereq',
        detail: 'detail',
        category: 'Focus',
        estimateMin: 90,
        deps: [],
        topoIndex: 0,
        priority: 1,
      },
      {
        id: 'a-windowed',
        title: 'windowed action',
        detail: 'detail',
        category: 'Creation',
        estimateMin: 30,
        deps: ['a-prereq'],
        topoIndex: 1,
        priority: 2,
      },
    ];
    state.actionsByCycleId[cycleId].actions = actions;
    state.cyclesById[cycleId].actions = actions;
    state.cyclesById[cycleId].goalContract.milestones = [
      {
        id: 'm-windowed',
        windowStartDayKey: '2026-01-01',
        windowEndDayKey: '2026-01-01',
        actionIds: ['a-windowed'],
        checkpointActionIds: [],
      },
    ];

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

    const placedActionIds = Array.from(new Set(items.map((item) => item.actionId)));
    expect(placedActionIds).toEqual(['a-prereq']);
    expect(captured.milestoneWindowConstraintMode).toBe('soft');
    expect(['DEP_NOT_READY_IN_WINDOW', 'MILESTONE_WINDOW_NO_SLOT']).toContain(
      captured.unassignedActionReasons?.['a-windowed']
    );
  });

  it('enforces dependency cutoff using final chunk end in soft mode', () => {
    const { state, cycleId } = buildState();
    state.constraints = { maxBlocksPerDay: 3 };
    const actions = [
      {
        id: 'a-long',
        title: 'long action',
        detail: 'detail',
        category: 'Focus',
        estimateMin: 75,
        deps: [],
        topoIndex: 0,
        priority: 1,
      },
      {
        id: 'a-after',
        title: 'dependent action',
        detail: 'detail',
        category: 'Creation',
        estimateMin: 30,
        deps: ['a-long'],
        topoIndex: 1,
        priority: 2,
      },
    ];
    state.actionsByCycleId[cycleId].actions = actions;
    state.cyclesById[cycleId].actions = actions;
    state.cyclesById[cycleId].goalContract.deadline = { dayKey: '2026-01-03' };

    const items = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
    });

    const longItems = items.filter((item) => item.actionId === 'a-long');
    const afterItem = items.find((item) => item.actionId === 'a-after');
    expect(longItems.length).toBe(3);
    expect(afterItem).toBeDefined();
    const longEndAt = Math.max(...longItems.map((item) => Date.parse(item.endISO)));
    const afterStartAt = Date.parse(afterItem.startISO);
    expect(afterStartAt).toBeGreaterThanOrEqual(longEndAt);
  });
});
