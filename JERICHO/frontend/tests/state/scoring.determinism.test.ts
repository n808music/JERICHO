import { describe, expect, it } from 'vitest';
import { scoreSchedule } from '../../src/planner/scoring/scoreSchedule.ts';

const inputs = {
  assignments: [
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
  ],
  actionGraph: {
    actions: [
      { id: 'a1', estimateMin: 60, category: 'Focus', deps: [] },
      { id: 'a2', estimateMin: 60, category: 'Creation', deps: ['a1'] },
    ],
  },
  constraints: { executionHorizonDays: 7, maxScheduledMinutesPerDay: 300 },
  horizons: {
    executionWindowStartDayKey: '2026-02-01',
    executionWindowEndDayKey: '2026-02-07',
    feasibilityWindowEndDayKey: '2026-02-28',
  },
  metricsContext: {
    unplacedEstimateMinTotal: 0,
    outsideExecutionHorizonEstimateMinTotal: 0,
    outsideExecutionHorizonCount: 0,
  },
};

describe('scoreSchedule determinism', () => {
  it('returns exact same breakdown for same input', () => {
    const lhs = scoreSchedule(inputs);
    const rhs = scoreSchedule(inputs);
    expect(lhs).toEqual(rhs);
  });

  it('keeps preview/apply parity for identical assignments', () => {
    const preview = scoreSchedule(inputs);
    const applied = scoreSchedule({ ...inputs, assignments: [...inputs.assignments] });
    expect(preview.total).toBe(applied.total);
    expect(preview.components).toEqual(applied.components);
  });
});
