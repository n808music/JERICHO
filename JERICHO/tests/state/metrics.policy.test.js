import { describe, it, expect } from 'vitest';
import { computeWindowMetrics, normalizeBlocks, addDays, groupPracticeLoad } from '../../src/state/metrics.js';
import { PlanSource, UNKNOWN_KEY } from '../../src/state/metricsPolicy.js';

function iso(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00.000Z`;
}

function makeBlock({ id, start, end, practice = 'Focus', status = 'planned' }) {
  return { id, start, end, practice, status };
}

describe('metrics policy (planSource + unknown treatment)', () => {
  it('planSource TARGETS does not override scheduled planned minutes when scheduled > 0', () => {
    const blocks = normalizeBlocks([
      makeBlock({ id: 'b1', start: iso('2025-12-01', '10:00'), end: iso('2025-12-01', '11:00'), practice: 'Body' })
    ]);
    const window = { kind: 'day', startDayKey: '2025-12-01', endDayKeyExclusive: addDays('2025-12-01', 1) };
    const patternTargets = { Body: 120, Resources: 0, Creation: 0, Focus: 0 };

    const m = computeWindowMetrics({ blocks, window, planSource: PlanSource.TARGETS, patternTargets });
    expect(Math.round(m.plannedMinutes)).toBe(60); // scheduled wins
    expect(m.provenance.planSource).toBe(PlanSource.TARGETS);
  });

  it('planSource TARGETS supplies planned minutes when scheduled is zero', () => {
    const blocks = normalizeBlocks([]);
    const window = { kind: 'week', startDayKey: '2025-12-01', endDayKeyExclusive: addDays('2025-12-01', 7) };
    const patternTargets = { Body: 30, Resources: 30, Creation: 0, Focus: 0 }; // 60 per day

    const m = computeWindowMetrics({ blocks, window, planSource: PlanSource.TARGETS, patternTargets });
    // 7 days * 60 minutes
    expect(Math.round(m.plannedMinutes)).toBe(420);
    expect(m.completedMinutes).toBe(0);
    expect(m.cr).toBe(0);
    expect(m.provenance.planSource).toBe(PlanSource.TARGETS);
  });

  it('unknown practice contributes to overall planned but not per-practice buckets', () => {
    const blocks = normalizeBlocks([
      makeBlock({ id: 'u', start: iso('2025-12-01', '10:00'), end: iso('2025-12-01', '11:00'), practice: 'N/A' })
    ]);
    const window = { kind: 'day', startDayKey: '2025-12-01', endDayKeyExclusive: addDays('2025-12-01', 1) };
    const m = computeWindowMetrics({ blocks, window });

    expect(Math.round(m.plannedMinutes)).toBe(60);
    expect(m.provenance.summary?.unknownBlocks).toBe(1);
    expect(Math.round(m.provenance.summary?.unknownPlannedMinutes || 0)).toBe(60);

    const load = groupPracticeLoad(blocks);
    // Unknown should not appear in Body/Resources/Creation/Focus buckets
    expect(load.Body || 0).toBe(0);
    expect(load.Resources || 0).toBe(0);
    expect(load.Creation || 0).toBe(0);
    expect(load.Focus || 0).toBe(0);
    // Unknown minutes still tracked separately
    expect(load.unknownPlannedMinutes).toBeGreaterThan(0);
  });
});
