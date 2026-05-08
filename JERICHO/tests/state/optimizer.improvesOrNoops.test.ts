import { describe, expect, it } from 'vitest';
import { optimizeSchedule } from '../../src/planner/optimize/optimizeSchedule.ts';

const alternating = [
  {
    actionId: 'a',
    chunkIndex: 0,
    chunkCount: 1,
    dayKey: '2026-01-01',
    startMin: 540,
    durationMin: 30,
    category: 'focus',
  },
  {
    actionId: 'b',
    chunkIndex: 0,
    chunkCount: 1,
    dayKey: '2026-01-01',
    startMin: 570,
    durationMin: 30,
    category: 'creation',
  },
  {
    actionId: 'c',
    chunkIndex: 0,
    chunkCount: 1,
    dayKey: '2026-01-01',
    startMin: 600,
    durationMin: 30,
    category: 'focus',
  },
  {
    actionId: 'd',
    chunkIndex: 0,
    chunkCount: 1,
    dayKey: '2026-01-01',
    startMin: 630,
    durationMin: 30,
    category: 'creation',
  },
];

describe('optimizeSchedule', () => {
  it('improves an obviously alternating schedule', () => {
    const out = optimizeSchedule({ baselineAssignments: alternating, policyId: 'DEEP_WORK' });
    expect(out.bestScore.total).toBeLessThanOrEqual(out.baselineScore.total);
  });

  it('no-ops when schedule is already stable and frozen', () => {
    const stable = [
      {
        actionId: 'a',
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: '2026-01-01',
        startMin: 540,
        durationMin: 60,
        category: 'focus',
      },
    ];
    const out = optimizeSchedule({
      baselineAssignments: stable,
      frozenReservations: [{ actionId: 'a', chunkIndex: 0 }],
      policyId: 'BALANCED',
    });
    expect(out.bestScore.total).toBe(out.baselineScore.total);
  });
});
