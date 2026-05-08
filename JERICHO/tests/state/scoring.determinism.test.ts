import { describe, expect, it } from 'vitest';
import { scoreSchedule } from '../../src/planner/scoring/scoreSchedule.ts';

const assignments = [
  {
    actionId: 'a',
    chunkIndex: 0,
    chunkCount: 1,
    dayKey: '2026-01-01',
    startMin: 540,
    durationMin: 60,
    category: 'focus',
  },
  {
    actionId: 'b',
    chunkIndex: 0,
    chunkCount: 1,
    dayKey: '2026-01-01',
    startMin: 660,
    durationMin: 30,
    category: 'creation',
  },
];

describe('scoreSchedule determinism', () => {
  it('returns exact same breakdown for same input', () => {
    const one = scoreSchedule({ assignments, policyId: 'BALANCED' });
    const two = scoreSchedule({ assignments, policyId: 'BALANCED' });
    expect(two).toEqual(one);
  });

  it('keeps preview/apply parity for identical assignments', () => {
    const preview = scoreSchedule({ assignments, policyId: 'DEEP_WORK' });
    const applied = scoreSchedule({ assignments, policyId: 'DEEP_WORK' });
    expect(applied.total).toBe(preview.total);
    expect(applied.components).toEqual(preview.components);
  });
});
