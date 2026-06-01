import { describe, expect, it } from 'vitest';
import { scoreSchedule } from '../../src/planner/scoring/scoreSchedule.ts';

function base(assignments: any[]) {
  return scoreSchedule({
    assignments,
    actionGraph: {
      actions: [
        { id: 'a1', estimateMin: 60, category: 'Focus', deps: [] },
        { id: 'a2', estimateMin: 60, category: 'Creation', deps: ['a1'] },
        { id: 'a3', estimateMin: 60, category: 'Body', deps: [] },
      ],
    },
    constraints: { executionHorizonDays: 7, maxScheduledMinutesPerDay: 240 },
    horizons: {
      executionWindowStartDayKey: '2026-02-01',
      executionWindowEndDayKey: '2026-02-07',
      feasibilityWindowEndDayKey: '2026-03-01',
    },
    metricsContext: {
      unplacedEstimateMinTotal: 0,
      outsideExecutionHorizonEstimateMinTotal: 0,
      outsideExecutionHorizonCount: 0,
    },
  });
}

describe('scoreSchedule components', () => {
  it('increases context switching penalty with alternating categories', () => {
    const low = base([
      {
        actionId: 'a1',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 540,
        durationMin: 60,
        category: 'Focus',
      },
      {
        actionId: 'a1',
        chunkIndex: 1,
        chunkCount: 2,
        dayKey: '2026-02-01',
        startMin: 630,
        durationMin: 60,
        category: 'Focus',
      },
    ]);
    const high = base([
      {
        actionId: 'a1',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 540,
        durationMin: 60,
        category: 'Focus',
      },
      {
        actionId: 'a2',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 630,
        durationMin: 60,
        category: 'Creation',
      },
      {
        actionId: 'a3',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 720,
        durationMin: 60,
        category: 'Body',
      },
    ]);
    expect(high.components.contextSwitching).toBeGreaterThan(low.components.contextSwitching);
  });

  it('increases load smoothness penalty for spiky load', () => {
    const smooth = base([
      {
        actionId: 'a1',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 540,
        durationMin: 60,
        category: 'Focus',
      },
      {
        actionId: 'a2',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-02',
        startMin: 540,
        durationMin: 60,
        category: 'Creation',
      },
      {
        actionId: 'a3',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-03',
        startMin: 540,
        durationMin: 60,
        category: 'Body',
      },
    ]);
    const spiky = base([
      {
        actionId: 'a1',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 540,
        durationMin: 180,
        category: 'Focus',
      },
      {
        actionId: 'a2',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 750,
        durationMin: 120,
        category: 'Creation',
      },
    ]);
    expect(spiky.components.loadSmoothness).toBeGreaterThan(smooth.components.loadSmoothness);
  });

  it('increases dependency risk when margin shrinks', () => {
    const loose = base([
      {
        actionId: 'a1',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 540,
        durationMin: 60,
        category: 'Focus',
      },
      {
        actionId: 'a2',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 720,
        durationMin: 60,
        category: 'Creation',
      },
    ]);
    const tight = base([
      {
        actionId: 'a1',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 540,
        durationMin: 60,
        category: 'Focus',
      },
      {
        actionId: 'a2',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-02-01',
        startMin: 605,
        durationMin: 60,
        category: 'Creation',
      },
    ]);
    expect(tight.components.dependencyRisk).toBeGreaterThan(loose.components.dependencyRisk);
  });
});
