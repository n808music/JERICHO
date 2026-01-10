import { describe, it, expect } from 'vitest';
import { computeTodayDomainInstrumentation, normalizeBlocks } from '../../src/state/metrics.js';

const iso = (d, t) => `${d}T${t}:00.000Z`;

describe('computeTodayDomainInstrumentation', () => {
  it('computes target/scheduled/completed/gap per domain', () => {
    const blocks = normalizeBlocks([
      { id: 'a', practice: 'Body', start: iso('2025-12-09', '10:00'), end: iso('2025-12-09', '11:00'), status: 'planned' },
      { id: 'b', practice: 'Body', start: iso('2025-12-09', '12:00'), end: iso('2025-12-09', '13:00'), status: 'completed' },
      { id: 'c', practice: 'Creation', start: iso('2025-12-09', '14:00'), end: iso('2025-12-09', '15:30'), status: 'completed' }
    ]);

    const targets = { Body: 90, Resources: 0, Creation: 60, Focus: 0 };
    const res = computeTodayDomainInstrumentation({
      dayKey: '2025-12-09',
      normalizedBlocks: blocks,
      patternTargets: targets
    });

    expect(res.Body.target).toBe(90);
    expect(Math.round(res.Body.scheduled)).toBe(120); // two 60m blocks
    expect(Math.round(res.Body.completed)).toBe(60);
    expect(res.Body.gap).toBe(Math.max(0, 90 - 60));

    expect(res.Creation.target).toBe(60);
    expect(Math.round(res.Creation.completed)).toBe(90); // 1.5h
    expect(res.Creation.gap).toBe(0);
  });

  it('ignores blocks outside the day and unknown practice', () => {
    const blocks = normalizeBlocks([
      { id: 'a', practice: 'Body', start: iso('2025-12-08', '10:00'), end: iso('2025-12-08', '11:00'), status: 'completed' },
      { id: 'b', practice: 'Unknown', start: iso('2025-12-09', '10:00'), end: iso('2025-12-09', '11:00'), status: 'completed' }
    ]);
    const res = computeTodayDomainInstrumentation({
      dayKey: '2025-12-09',
      normalizedBlocks: blocks,
      patternTargets: { Body: 30, Resources: 0, Creation: 0, Focus: 0 }
    });

    expect(res.Body.completed).toBe(0);
    expect(res.Body.scheduled).toBe(0);
  });
});
