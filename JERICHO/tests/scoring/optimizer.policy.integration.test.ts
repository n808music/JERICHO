import { describe, expect, it } from 'vitest';
import { optimizeSchedule } from '../../src/planner/optimize/optimizeSchedule.ts';

const base = [
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

describe('optimizer policy integration', () => {
  it('DEEP_WORK reduces context fragmentation without guardrail regressions', () => {
    const out = optimizeSchedule({ baselineAssignments: base, policyId: 'DEEP_WORK' });
    expect(out.bestScore.components.contextSwitching).toBeLessThanOrEqual(
      out.baselineScore.components.contextSwitching
    );
    expect(out.bestScore.components.deadlineRisk).toBeLessThanOrEqual(out.baselineScore.components.deadlineRisk);
    expect(out.bestScore.components.milestoneRisk).toBeLessThanOrEqual(out.baselineScore.components.milestoneRisk);
  });

  it('DEADLINE_FIRST does not trade milestone safety for context gains', () => {
    const out = optimizeSchedule({ baselineAssignments: base, policyId: 'DEADLINE_FIRST' });
    expect(out.bestScore.components.milestoneRisk).toBeLessThanOrEqual(out.baselineScore.components.milestoneRisk);
  });
});
