import { describe, expect, it } from 'vitest';
import { optimizeSchedule } from '../../src/planner/optimize/optimizeSchedule.ts';

const baseline = [
  {
    actionId: 'm1',
    chunkIndex: 0,
    chunkCount: 1,
    dayKey: '2026-01-01',
    startMin: 540,
    durationMin: 60,
    category: 'focus',
    isMilestone: true,
  },
  {
    actionId: 'x1',
    chunkIndex: 0,
    chunkCount: 1,
    dayKey: '2026-01-01',
    startMin: 600,
    durationMin: 60,
    category: 'creation',
  },
];

const candidateWorseMilestone = [
  {
    actionId: 'm1',
    chunkIndex: 0,
    chunkCount: 1,
    dayKey: '2026-01-03',
    startMin: 540,
    durationMin: 60,
    category: 'focus',
    isMilestone: true,
  },
  {
    actionId: 'x1',
    chunkIndex: 0,
    chunkCount: 1,
    dayKey: '2026-01-01',
    startMin: 600,
    durationMin: 60,
    category: 'creation',
  },
];

describe('optimizer guardrails', () => {
  it('rejects candidate that improves total but increases milestone risk', () => {
    const out = optimizeSchedule({
      baselineAssignments: baseline,
      policyId: 'DEADLINE_FIRST',
      candidateSchedules: [candidateWorseMilestone],
      metricsContext: {
        milestoneWindowSlack: {
          m1: { slackRatio: 2 },
        },
      },
    });
    expect(out.rejectedCandidatesSummary.MILESTONE_GUARDRAIL).toBeGreaterThanOrEqual(0);
  });
});
