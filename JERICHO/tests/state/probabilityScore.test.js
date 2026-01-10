import { describe, it, expect } from 'vitest';
import { scoreGoalSuccessProbability } from '../../src/state/engine/probabilityScore.ts';

const GOAL_ID = 'goal-1';
const NOW_ISO = '2026-01-03T09:00:00.000Z';

function makeState(overrides = {}) {
  return {
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        definiteGoal: { outcome: 'Test', deadlineDayKey: '2026-01-10' },
        goalGovernanceContract: {
          contractId: 'gov-1',
          version: 1,
          goalId: GOAL_ID,
          activeFromISO: '2026-01-01',
          activeUntilISO: '2026-12-31',
          scope: { domainsAllowed: ['Body', 'Focus', 'Creation', 'Resources'], timeHorizon: 'week', timezone: 'UTC' },
          governance: { probabilityEnabled: true, minEvidenceEvents: 1 }
        }
      }
    },
    goalWorkById: {
      [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 2 }]
    },
    executionEvents: [],
    ...overrides
  };
}

describe('scoreGoalSuccessProbability', () => {
  it('returns capped value when evidence is insufficient', () => {
    const state = makeState({
      cyclesById: {
        'cycle-1': {
          ...makeState().cyclesById['cycle-1'],
          goalGovernanceContract: {
            ...makeState().cyclesById['cycle-1'].goalGovernanceContract,
            governance: { probabilityEnabled: false, minEvidenceEvents: 1 }
          }
        }
      }
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, { timezone: 'UTC', maxBlocksPerDay: 2, scoringWindowDays: 3 }, NOW_ISO);
    // MVP 3.0: returns plan-based estimate even without evidence, capped at max
    expect(typeof result.value).toBe('number');
    expect(result.value).toBeLessThanOrEqual(0.65);
    expect(result.status).toBe('NO_EVIDENCE');
  });

  it('returns 0 when infeasible', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 10 }]
      },
      executionEvents: [{ goalId: GOAL_ID, completed: true, dateISO: '2026-01-03' }]
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, { timezone: 'UTC', maxBlocksPerDay: 0, scoringWindowDays: 3 }, NOW_ISO);
    // MVP 3.0: infeasible returns 0, not null
    expect(result.value).toBe(0);
    expect(result.status).toBe('INFEASIBLE');
    expect(result.reasons).toContain('INFEASIBLE');
  });

  it('handles sigma=0 deterministic outcomes with sufficient evidence', () => {
    // Provide evidence across 7+ days to exceed minEvidenceDays threshold
    const state = makeState({
      goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 1 }] },
      executionEvents: [
        { goalId: GOAL_ID, completed: true, dateISO: '2026-01-03' },
        { goalId: GOAL_ID, completed: true, dateISO: '2026-01-02' },
        { goalId: GOAL_ID, completed: true, dateISO: '2026-01-01' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-31' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-30' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-29' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-28' }
      ]
    });
    const win = scoreGoalSuccessProbability(GOAL_ID, state, { timezone: 'UTC', maxBlocksPerDay: 2, scoringWindowDays: 7 }, NOW_ISO);
    // MVP 3.0: with strong evidence and very few blocks remaining, should reach high probability
    expect(win.value).toBeGreaterThanOrEqual(0.8);

    const loseState = makeState({
      goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 20 }] },
      executionEvents: state.executionEvents
    });
    const lose = scoreGoalSuccessProbability(GOAL_ID, loseState, { timezone: 'UTC', maxBlocksPerDay: 2, scoringWindowDays: 7 }, NOW_ISO);
    expect(lose.value).toBeLessThanOrEqual(0.2);
  });

  it('increases probability with higher mean throughput', () => {
    // Extended to 7+ days to exceed minEvidenceDays threshold
    // Low throughput: 1 block/day, High throughput: 2 blocks/day
    const low = makeState({
      goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 5 }] },
      executionEvents: [
        { goalId: GOAL_ID, completed: true, dateISO: '2026-01-03' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-31' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-29' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-27' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-25' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-23' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-21' }
      ]
    });
    const high = makeState({
      goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 5 }] },
      executionEvents: [
        { goalId: GOAL_ID, completed: true, dateISO: '2026-01-03' },
        { goalId: GOAL_ID, completed: true, dateISO: '2026-01-03' },
        { goalId: GOAL_ID, completed: true, dateISO: '2026-01-02' },
        { goalId: GOAL_ID, completed: true, dateISO: '2026-01-02' },
        { goalId: GOAL_ID, completed: true, dateISO: '2026-01-01' },
        { goalId: GOAL_ID, completed: true, dateISO: '2026-01-01' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-31' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-31' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-30' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-30' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-29' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-29' },
        { goalId: GOAL_ID, completed: true, dateISO: '2025-12-28' }
      ]
    });
    const constraints = { timezone: 'UTC', maxBlocksPerDay: 2, scoringWindowDays: 7 };
    const lowResult = scoreGoalSuccessProbability(GOAL_ID, low, constraints, NOW_ISO);
    const highResult = scoreGoalSuccessProbability(GOAL_ID, high, constraints, NOW_ISO);
    // MVP 3.0: higher throughput should have higher probability
    expect(highResult.value).toBeGreaterThan(lowResult.value || 0);
  });

  it('is deterministic across identical inputs', () => {
    const state = makeState({
      executionEvents: [{ goalId: GOAL_ID, completed: true, dateISO: '2026-01-03' }]
    });
    const constraints = { timezone: 'UTC', maxBlocksPerDay: 2, scoringWindowDays: 3 };
    const first = scoreGoalSuccessProbability(GOAL_ID, state, constraints, NOW_ISO);
    const second = scoreGoalSuccessProbability(GOAL_ID, state, constraints, NOW_ISO);
    expect(first).toEqual(second);
  });
});
