import { describe, expect, it } from 'vitest';
import { generateCandidates } from '../../src/planner/optimize/generateCandidates.ts';

const inputs = {
  baselineAssignments: [
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
  ],
  frozenReservations: [{ actionId: 'a1', chunkIndex: 0 }],
  actionGraph: {
    actions: [
      { id: 'a1', deps: [] },
      { id: 'a2', deps: [] },
      { id: 'a3', deps: [] },
    ],
  },
  constraints: { maxScheduledMinutesPerDay: 300 },
  horizons: { executionWindowStartDayKey: '2026-02-01', executionWindowEndDayKey: '2026-02-03' },
  maxCandidates: 20,
};

describe('generateCandidates determinism', () => {
  it('returns stable candidate order/content across runs', () => {
    const first = generateCandidates(inputs);
    const second = generateCandidates(inputs);
    expect(first).toEqual(second);
  });

  it('deduplicates equivalent candidates', () => {
    const candidates = generateCandidates(inputs);
    const hashes = new Set(
      candidates.map((rows) =>
        rows
          .map((row) => `${row.actionId}:${row.chunkIndex}:${row.dayKey}:${row.startMin}`)
          .sort()
          .join('|')
      )
    );
    expect(hashes.size).toBe(candidates.length);
  });
});
