import { describe, expect, it } from 'vitest';

import fixture from '../fixtures/masterPlan/operationEndgame.fullHorizonSchedule.json';

function groupCountByYear(blocks = []) {
  return blocks.reduce((acc, block) => {
    const year = String(block?.dayKey || block?.date || '').slice(0, 4);
    if (!year) {return acc;}
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {});
}

function dedupeById(blocks = []) {
  return Array.from(new Map(blocks.map((block) => [block.id, block])).values());
}

describe('long-horizon calendar-block count stability', () => {
  it('deduping overlapping horizon inputs preserves one block per stable id', () => {
    const sample = fixture.slice(0, 4);
    const overlapped = [...sample, ...sample.map((block) => ({ ...block }))];
    expect(overlapped.length).toBe(sample.length * 2);
    expect(dedupeById(overlapped)).toHaveLength(sample.length);
  });

  it('fixture ids are already stable and unique before any transform', () => {
    const ids = fixture.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('fixture retains non-trivial density across 2027-2031 without clipping', () => {
    const counts = groupCountByYear(fixture);
    for (const year of ['2027', '2028', '2029', '2030', '2031']) {
      expect(counts[year] || 0).toBeGreaterThanOrEqual(2);
    }
  });
});
