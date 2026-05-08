import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems } from '../../src/state/draftSchedule.js';
import { computeStressMetrics } from '../../src/stress/metrics.ts';

function buildState({
  startDay = '2026-01-01',
  deadlineDay = '2027-12-31',
  actions = [],
  milestones = [],
  executionHorizonDays = 90,
} = {}) {
  const cycleId = 'cycle-dual-horizon';
  return {
    state: {
      executionEvents: [],
      suggestedBlocks: [],
      appTime: { activeDayKey: startDay, timeZone: 'UTC' },
      today: { date: startDay },
      planDraft: { routeMinutes: 30, executionHorizonDays },
      constraints: {},
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

function buildActions(count) {
  return Array.from({ length: count }).map((_, index) => {
    const id = `a-${String(index + 1).padStart(3, '0')}`;
    return {
      id,
      title: `Action ${index + 1}`,
      detail: `Detail ${index + 1}`,
      category: 'Focus',
      estimateMin: 30,
      deps: index > 0 ? [`a-${String(index).padStart(3, '0')}`] : [],
      topoIndex: index,
      priority: index + 1,
    };
  });
}

describe('draftSchedule dual horizon', () => {
  it('emits only execution-horizon chunks and classifies feasible-later work as outside execution horizon', () => {
    const actions = buildActions(400);
    const { state, cycleId } = buildState({
      actions,
      executionHorizonDays: 90,
    });
    let captured = null;
    const items = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: {
        routeMinutes: 30,
        primaryDomain: 'FOCUS',
        todayKey: '2026-01-01',
        executionHorizonDays: 90,
        fullPlanMaxHorizonDays: 800,
      },
      captureStats: (stats) => {
        captured = stats;
      },
    });

    expect(captured.executionHorizonDays).toBe(90);
    expect(captured.reasonCode).toBe('OUTSIDE_EXECUTION_HORIZON');
    expect(captured.outsideExecutionHorizonCount).toBeGreaterThan(0);
    expect(captured.outsideExecutionHorizonEstimateMinTotal).toBeGreaterThan(0);
    expect(captured.executionWindowEndISO.startsWith('2026-03-31')).toBe(true);
    const maxItemDay = items.reduce((latest, item) => (item.dayKey > latest ? item.dayKey : latest), '0000-01-01');
    expect(maxItemDay <= '2026-03-31').toBe(true);
  });

  it('computes milestone slack with feasibility horizon beyond execution horizon', () => {
    const actions = buildActions(20);
    const milestones = [
      {
        id: 'm-far',
        title: 'Far milestone',
        windowStartDayKey: '2030-01-01',
        windowEndDayKey: '2030-03-01',
        actionIds: ['a-020'],
        checkpointActionIds: [],
      },
    ];
    const { state, cycleId } = buildState({
      actions,
      deadlineDay: '2030-12-31',
      milestones,
      executionHorizonDays: 90,
    });
    let captured = null;
    buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: {
        routeMinutes: 30,
        primaryDomain: 'FOCUS',
        todayKey: '2026-01-01',
        executionHorizonDays: 90,
        fullPlanMaxHorizonDays: 3652,
      },
      captureStats: (stats) => {
        captured = stats;
      },
    });

    const metrics = computeStressMetrics({
      fixture: {
        scenarioId: 'doctor_10y',
        goalText: 'Dual horizon',
        prompt: 'Dual horizon',
        horizon: { startDayKey: '2026-01-01', endDayKey: '2030-12-31' },
        availability: {
          daysPerWeek: 7,
          specificDays: 'mon,tue,wed,thu,fri,sat,sun',
          maxBlocksPerDay: 3,
          routeMinutesDefault: 30,
        },
        milestones,
        inferredGraph: { source: 'fixture_snapshot', snapshotVersion: 'dual.v1', actions },
      },
      actions,
      previewItems: [],
      materializedBlocks: [],
      diagnostics: captured,
    });

    expect(captured.executionWindowEndISO.startsWith('2026-03-31')).toBe(true);
    expect(captured.feasibilityWindowEndISO.startsWith('2030-03-01')).toBe(true);
    expect(metrics.milestoneWindowSlack.byMilestone['m-far']?.overlapDays || 0).toBeGreaterThan(0);
  });

  it('is deterministic for emitted schedule and outside classification', () => {
    const actions = buildActions(240);
    const { state, cycleId } = buildState({ actions, executionHorizonDays: 90 });

    let firstStats = null;
    const first = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: state.cyclesById[cycleId].goalContract,
      timeZone: 'UTC',
      defaults: {
        routeMinutes: 30,
        primaryDomain: 'FOCUS',
        todayKey: '2026-01-01',
        executionHorizonDays: 90,
        fullPlanMaxHorizonDays: 800,
      },
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
      defaults: {
        routeMinutes: 30,
        primaryDomain: 'FOCUS',
        todayKey: '2026-01-01',
        executionHorizonDays: 90,
        fullPlanMaxHorizonDays: 800,
      },
      captureStats: (stats) => {
        secondStats = stats;
      },
    });

    expect(second).toEqual(first);
    expect(secondStats.outsideExecutionHorizonCount).toBe(firstStats.outsideExecutionHorizonCount);
    expect(secondStats.outsideExecutionHorizonEstimateMinTotal).toBe(
      firstStats.outsideExecutionHorizonEstimateMinTotal
    );
  });
});
