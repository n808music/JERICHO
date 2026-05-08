import { describe, expect, it } from 'vitest';
import { scoreSchedule } from '../../src/planner/scoring/scoreSchedule.ts';
import { getQualityPolicy } from '../../src/planner/scoring/policy.ts';

const assignments = [
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
];

describe('quality policy tuning', () => {
  it('defaults to BALANCED deterministically', () => {
    expect(getQualityPolicy().policyId).toBe('BALANCED');
  });

  it('DEADLINE_FIRST amplifies deadline pressure over BALANCED', () => {
    const balanced = scoreSchedule({ assignments, policyId: 'BALANCED', metricsContext: { unplacedMinutes: 180 } });
    const deadlineFirst = scoreSchedule({
      assignments,
      policyId: 'DEADLINE_FIRST',
      metricsContext: { unplacedMinutes: 180 },
    });
    expect(deadlineFirst.components.deferralPenalty).toBeGreaterThanOrEqual(balanced.components.deferralPenalty);
    expect(deadlineFirst.components.deadlineRisk).toBeGreaterThanOrEqual(balanced.components.deadlineRisk);
  });

  it('DEEP_WORK amplifies context switching pressure over BALANCED', () => {
    const balanced = scoreSchedule({ assignments, policyId: 'BALANCED' });
    const deepWork = scoreSchedule({ assignments, policyId: 'DEEP_WORK' });
    expect(deepWork.total).toBeGreaterThanOrEqual(balanced.total);
  });

  it('DEPENDENCY_SAFETY amplifies dependency tightness risk', () => {
    const metricsContext = { depMarginsByActionId: { a: 10, b: 15, c: 20 } };
    const balanced = scoreSchedule({ assignments, policyId: 'BALANCED', metricsContext });
    const depSafe = scoreSchedule({ assignments, policyId: 'DEPENDENCY_SAFETY', metricsContext });
    expect(depSafe.total).toBeGreaterThanOrEqual(balanced.total);
  });
});
