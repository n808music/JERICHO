import { describe, it, expect } from 'vitest';
import { scoreGoalSuccessProbability } from '../engine/probabilityScore.ts';

const NOW_ISO = '2026-01-15T12:00:00.000Z';
const GOAL_ID = 'goal-1';

function buildStateWithEvidence(days) {
  const executionEvents = days.map((dayKey, idx) => ({
    id: `evt-${idx}`,
    goalId: GOAL_ID,
    kind: 'complete',
    completed: true,
    dateISO: dayKey,
    minutes: 60
  }));
  return {
    goalExecutionContract: { goalId: GOAL_ID, startDayKey: '2026-01-01', endDayKey: '2026-02-01' },
    cyclesById: {
      'cycle-1': {
        goalGovernanceContract: {
          contractId: 'gov-1',
          version: 1,
          goalId: GOAL_ID,
          activeFromISO: '2026-01-01',
          activeUntilISO: '2026-02-01',
          scope: { domainsAllowed: ['Focus'], timeHorizon: 'week', timezone: 'UTC' },
          governance: { suggestionsEnabled: true, probabilityEnabled: true, minEvidenceEvents: 0 }
        },
        definiteGoal: { deadlineDayKey: '2026-02-01' },
        goalPlan: {
          planProof: {
            workableDaysRemaining: 20,
            totalRequiredUnits: 10,
            requiredPacePerDay: 1,
            maxPerDay: 4,
            maxPerWeek: 20,
            slackUnits: 50,
            slackRatio: 0.5,
            intensityRatio: 0.2,
            feasibilityStatus: 'FEASIBLE',
            feasibilityReasons: []
          },
          scheduleBlocks: [],
          generatedAtISO: NOW_ISO
        }
      }
    },
    goalWorkById: {
      [GOAL_ID]: [{ workItemId: 'work-1', blocksRemaining: 10, category: 'Focus', focusMode: 'deep', energyCost: 'low', producesOutput: true }]
    },
    executionEvents
  };
}

describe('probability evidence updates', () => {
  it('stays ineligible under minimum evidence window', () => {
    const state = buildStateWithEvidence(['2026-01-10', '2026-01-11', '2026-01-12']);
    const result = scoreGoalSuccessProbability(GOAL_ID, state, { timezone: 'UTC', maxBlocksPerDay: 4 }, NOW_ISO);
    expect(result.status).toBe('INELIGIBLE');
    expect(result.value).toBeLessThanOrEqual(0.65);
  });

  it('becomes eligible after minimum window', () => {
    const state = buildStateWithEvidence([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07'
    ]);
    const result = scoreGoalSuccessProbability(GOAL_ID, state, { timezone: 'UTC', maxBlocksPerDay: 4 }, NOW_ISO);
    expect(result.status).toBe('ELIGIBLE');
    expect(result.capApplied).toBe(false);
  });
});
