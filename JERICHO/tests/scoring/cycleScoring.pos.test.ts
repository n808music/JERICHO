import { describe, expect, it } from 'vitest';
import { computeCyclePOS } from '../../src/domain/scoring/cycleScoring.ts';

describe('cycleScoring pos', () => {
  it('uses start-state integrity so pos equals feasibility when no past blocks exist', () => {
    const result = computeCyclePOS({
      cycleId: 'cycle-1',
      nowISO: '2026-03-10T12:00:00.000Z',
      feasibilityScore: 0.8,
      blocks: [],
    });

    expect(result.integrity).toBe(1);
    expect(result.pos).toBeCloseTo(0.8, 8);
  });

  it('applies integrity penalty with alpha=1.5', () => {
    const result = computeCyclePOS({
      cycleId: 'cycle-1',
      nowISO: '2026-03-10T12:00:00.000Z',
      feasibilityScore: 0.8,
      blocks: [
        {
          id: 'm1',
          cycleId: 'cycle-1',
          start: '2026-03-09T09:00:00.000Z',
          end: '2026-03-09T10:00:00.000Z',
          durationMinutes: 60,
          outcome: 'MISSED',
        },
        {
          id: 'm2',
          cycleId: 'cycle-1',
          start: '2026-03-09T10:00:00.000Z',
          end: '2026-03-09T11:00:00.000Z',
          durationMinutes: 60,
          outcome: 'COMPLETED_ON_TIME',
        },
      ],
    });

    const expected = 0.8 * Math.pow(0.5, 1.5);
    expect(result.integrity).toBeCloseTo(0.5, 8);
    expect(result.pos).toBeCloseTo(expected, 8);
  });

  it('clamps boundary outcomes', () => {
    const zero = computeCyclePOS({
      cycleId: 'cycle-1',
      nowISO: '2026-03-10T12:00:00.000Z',
      feasibilityScore: 0,
      blocks: [],
    });
    const one = computeCyclePOS({
      cycleId: 'cycle-1',
      nowISO: '2026-03-10T12:00:00.000Z',
      feasibilityScore: 1,
      blocks: [],
    });

    expect(zero.pos).toBe(0);
    expect(one.pos).toBe(1);
  });
});
