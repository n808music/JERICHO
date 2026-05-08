import { describe, expect, it } from 'vitest';
import { optimizeSchedule } from '../../src/planner/optimize/optimizeSchedule.ts';

describe('optimizeSchedule', () => {
  it('improves an obviously alternating schedule', () => {
    const baselineAssignments = [
      {
        actionId: 'a1',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 540,
        durationMin: 30,
        category: 'Focus',
      },
      {
        actionId: 'a2',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 570,
        durationMin: 30,
        category: 'Creation',
      },
      {
        actionId: 'a3',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 600,
        durationMin: 30,
        category: 'Focus',
      },
    ];
    const result = optimizeSchedule({
      baselineAssignments,
      frozenReservations: [],
      actionGraph: {
        actions: [
          { id: 'a1', deps: [] },
          { id: 'a2', deps: [] },
          { id: 'a3', deps: [] },
        ],
      },
      constraints: { executionHorizonDays: 7, maxScheduledMinutesPerDay: 300 },
      horizons: {
        executionWindowStartDayKey: '2026-02-01',
        executionWindowEndDayKey: '2026-02-07',
        feasibilityWindowEndDayKey: '2026-03-01',
      },
      maxIterations: 2,
      maxCandidatesPerIter: 20,
    });
    expect(result.improvement.deltaTotal).toBeLessThanOrEqual(0);
  });

  it('no-ops when schedule is already stable and frozen', () => {
    const baselineAssignments = [
      {
        actionId: 'a1',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 540,
        durationMin: 30,
        category: 'Focus',
      },
      {
        actionId: 'a2',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 600,
        durationMin: 30,
        category: 'Focus',
      },
    ];
    const result = optimizeSchedule({
      baselineAssignments,
      frozenReservations: [
        { actionId: 'a1', chunkIndex: 0 },
        { actionId: 'a2', chunkIndex: 0 },
      ],
      actionGraph: {
        actions: [
          { id: 'a1', deps: [] },
          { id: 'a2', deps: [] },
        ],
      },
      constraints: { executionHorizonDays: 7, maxScheduledMinutesPerDay: 300 },
      horizons: {
        executionWindowStartDayKey: '2026-02-01',
        executionWindowEndDayKey: '2026-02-07',
        feasibilityWindowEndDayKey: '2026-03-01',
      },
      maxIterations: 2,
      maxCandidatesPerIter: 20,
    });
    expect(result.bestAssignments).toEqual(baselineAssignments);
    expect(result.improvement.deltaTotal).toBe(0);
  });
});
