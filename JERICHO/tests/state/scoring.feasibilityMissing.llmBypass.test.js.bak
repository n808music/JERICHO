import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const dayKey = '2026-03-10';
  return {
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: {},
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        goalContract: { goalId: 'goal-1' },
        planPreview: { confidenceBand: 'MEDIUM' },
        planGenerationSource: 'LLM',
        metrics: {},
      },
    },
    activeCycleId: 'cycle-1',
    goalExecutionContract: { goalId: 'goal-1' },
    goalAdmissionByGoal: { 'goal-1': { status: 'ADMITTED', reasonCodes: [] } },
    lastPlanError: null,
  };
}

describe('scoring feasibility missing bypass for LLM source', () => {
  it('does not emit FEASIBILITY_MISSING_FOR_PLAN when source is LLM', () => {
    const next = computeDerivedState(buildState(), { type: 'NO_OP' });
    expect(next.lastPlanError?.code).not.toBe('FEASIBILITY_MISSING_FOR_PLAN');
    expect(next.cyclesById?.['cycle-1']?.metrics?.posScore).toBeNull();
  });
});
