import { describe, expect, it } from 'vitest';
import {
  buildDraftScheduleItems,
  buildMilestonePriorityContext,
  compareActionsStrategic,
  computeActionCriticalDepthMap,
} from '../../src/state/draftSchedule.js';

describe('draftSchedule strategic ordering determinism', () => {
  it('produces stable ordering with milestone-critical first tie-breaking', () => {
    const actions = [
      { id: 'a1', topoIndex: 0, priority: 2, estimateMin: 30, deps: [] },
      { id: 'a2', topoIndex: 1, priority: 1, estimateMin: 30, deps: ['a1'] },
      { id: 'a3', topoIndex: 2, priority: 3, estimateMin: 30, deps: ['a2'] },
      { id: 'a4', topoIndex: 3, priority: 4, estimateMin: 30, deps: ['a3'] },
    ];
    const milestones = [
      {
        id: 'm1',
        windowStartDayKey: '2026-01-01',
        windowEndDayKey: '2026-01-10',
        actionIds: ['a3'],
        checkpointActionIds: ['a2'],
      },
    ];

    const milestone = buildMilestonePriorityContext(milestones, actions, 30);
    const criticalDepthMap = computeActionCriticalDepthMap(actions);
    const context = { actionPriority: milestone.actionPriority, criticalDepthMap };

    const runOne = [...actions].sort((lhs, rhs) => compareActionsStrategic(lhs, rhs, context)).map((a) => a.id);
    const runTwo = [...actions].sort((lhs, rhs) => compareActionsStrategic(lhs, rhs, context)).map((a) => a.id);

    expect(runOne).toEqual(runTwo);
    expect(runOne.slice(0, 2)).toEqual(['a2', 'a3']);
  });

  it('keeps soft window fallback deterministic across repeated FULL_PLAN runs', () => {
    const cycleId = 'cycle-soft';
    const actions = [
      {
        id: 'a1',
        title: 'setup',
        detail: 'setup',
        category: 'Focus',
        estimateMin: 30,
        deps: [],
        topoIndex: 0,
        priority: 1,
      },
      {
        id: 'a2',
        title: 'milestone',
        detail: 'milestone',
        category: 'Focus',
        estimateMin: 30,
        deps: [],
        topoIndex: 1,
        priority: 2,
      },
    ];
    const goalContract = {
      goalId: 'goal-soft',
      startDate: '2026-01-01',
      deadline: { dayKey: '2026-01-20' },
      milestones: [
        {
          id: 'm-soft',
          windowStartDayKey: '2026-01-01',
          windowEndDayKey: '2026-01-02',
          actionIds: ['a2'],
          checkpointActionIds: [],
        },
      ],
      temporalBinding: { daysPerWeek: 7, specificDays: 'mon,tue,wed,thu,fri,sat,sun', sessionDurationMinutes: 30 },
    };
    const state = {
      executionEvents: [],
      suggestedBlocks: [],
      appTime: { activeDayKey: '2026-01-01', timeZone: 'UTC' },
      today: { date: '2026-01-01' },
      planDraft: { routeMinutes: 30 },
      constraints: {},
      actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-soft', actions } },
      cyclesById: {
        [cycleId]: {
          id: cycleId,
          actions,
          goalContract,
          coldPlan: { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } },
        },
      },
      deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [] } },
    };

    let statsOne = null;
    const runOne = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
      captureStats: (stats) => {
        statsOne = stats;
      },
    });
    let statsTwo = null;
    const runTwo = buildDraftScheduleItems(state, cycleId, {
      startDateISO: '2026-01-01',
      actions,
      contract: goalContract,
      timeZone: 'UTC',
      defaults: { routeMinutes: 30, primaryDomain: 'FOCUS', todayKey: '2026-01-01' },
      captureStats: (stats) => {
        statsTwo = stats;
      },
    });

    expect(runOne).toEqual(runTwo);
    expect(statsOne.softWindowFallbackCount).toBe(statsTwo.softWindowFallbackCount);
    expect(statsOne.milestoneWindowConstraintMode).toBe('soft');
  });
});
