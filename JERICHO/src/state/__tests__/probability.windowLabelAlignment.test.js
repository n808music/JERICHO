import { describe, it, expect } from 'vitest';
import { scoreGoalSuccessProbability } from '../engine/probabilityScore.ts';
import { formatProbabilityWindowLabel, getProbabilityWindowSpec } from '../engine/probabilityWindow.ts';

function buildBaseState(goalId, deadlineDayKey) {
  return {
    goalExecutionContract: null,
    cyclesById: {
      'cycle-1': {
        goalGovernanceContract: {
          contractId: 'gov-1',
          version: 1,
          goalId,
          activeFromISO: '2026-01-01',
          activeUntilISO: deadlineDayKey,
          scope: { domainsAllowed: ['Body'], timeHorizon: 'week', timezone: 'UTC' },
          governance: { suggestionsEnabled: true, probabilityEnabled: true, minEvidenceEvents: 0 }
        },
        definiteGoal: { deadlineDayKey }
      }
    },
    goalWorkById: {
      [goalId]: [{ workItemId: `${goalId}-body`, blocksRemaining: 4 }]
    },
    executionEvents: []
  };
}

describe('probability window label alignment', () => {
  it('cycle-to-date spec matches scoring window', () => {
    const goalId = 'goal-1';
    const nowISO = '2026-01-08';
    const activeContract = { goalId, startDayKey: '2026-01-05', endDayKey: '2026-02-01' };
    const state = buildBaseState(goalId, activeContract.endDayKey);
    state.goalExecutionContract = activeContract;

    const spec = getProbabilityWindowSpec({ activeContract, nowISO, timeZone: 'UTC' });
    const label = formatProbabilityWindowLabel(spec);

    expect(spec.mode).toBe('cycle_to_date');
    expect(label).toBe('Active cycle to date (2026-01-05 → 2026-01-08)');

    const result = scoreGoalSuccessProbability(goalId, state, { timezone: 'UTC', maxBlocksPerDay: 4 }, nowISO);
    expect(result.scoringSummary?.K).toBe(4);
  });

  it('rolling spec matches scoring window size', () => {
    const goalId = 'goal-2';
    const nowISO = '2026-01-08';
    const activeContract = { goalId, startDayKey: '2026-01-01', endDayKey: '2026-02-01', windowMode: 'rolling' };
    const state = buildBaseState(goalId, activeContract.endDayKey);
    state.goalExecutionContract = activeContract;

    const spec = getProbabilityWindowSpec({ activeContract, nowISO, timeZone: 'UTC', scoringWindowDays: 7 });
    const label = formatProbabilityWindowLabel(spec);

    expect(spec.mode).toBe('rolling');
    expect(label).toBe('Last 7 workable days');

    const result = scoreGoalSuccessProbability(
      goalId,
      state,
      { timezone: 'UTC', maxBlocksPerDay: 4, scoringWindowDays: 7 },
      nowISO
    );
    expect(result.scoringSummary?.K).toBe(7);
    expect(spec.windowDays).toBe(7);
  });
});
