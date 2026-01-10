import { describe, it, expect } from 'vitest';
import { computeFeasibility } from '../../src/state/engine/feasibility.ts';

const GOAL_ID = 'goal-1';

function makeState(overrides = {}) {
  return {
    goalWorkById: { [GOAL_ID]: [] },
    executionEvents: [],
    ...overrides
  };
}

describe('computeFeasibility', () => {
  it('returns INFEASIBLE when deadline passed with remaining work', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 2 }]
      }
    });
    const result = computeFeasibility(
      { goalId: GOAL_ID, deadlineISO: '2026-01-01T00:00:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 2 },
      '2026-01-02T00:00:00.000Z'
    );

    expect(result.status).toBe('INFEASIBLE');
    expect(result.reasons).toContain('DEADLINE_PASSED');
  });

  it('returns INFEASIBLE when remaining capacity is insufficient', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 5 }]
      }
    });
    const result = computeFeasibility(
      { goalId: GOAL_ID, deadlineISO: '2026-01-03T23:59:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 1 },
      '2026-01-01T09:00:00.000Z'
    );

    expect(result.status).toBe('INFEASIBLE');
    expect(result.reasons).toContain('INSUFFICIENT_CAPACITY');
    expect(result.delta.blocksShort).toBeGreaterThan(0);
  });

  it('marks REQUIRED when today is behind required pace', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 4 }]
      },
      executionEvents: []
    });
    const result = computeFeasibility(
      { goalId: GOAL_ID, deadlineISO: '2026-01-02T23:59:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 4 },
      '2026-01-01T09:00:00.000Z'
    );

    expect(result.status).toBe('REQUIRED');
    expect(result.requiredBlocksToday).toBeGreaterThan(0);
    expect(result.reasons).toContain('BEHIND_REQUIRED_PACE');
  });

  it('marks FEASIBLE when today requirement is met', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 4 }]
      },
      executionEvents: [
        { id: 'e1', goalId: GOAL_ID, completed: true, dateISO: '2026-01-01' },
        { id: 'e2', goalId: GOAL_ID, completed: true, dateISO: '2026-01-01' }
      ]
    });
    const result = computeFeasibility(
      { goalId: GOAL_ID, deadlineISO: '2026-01-02T23:59:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 4 },
      '2026-01-01T09:00:00.000Z'
    );

    expect(result.status).toBe('FEASIBLE');
    expect(result.requiredBlocksToday).toBe(0);
    expect(result.reasons).toContain('OK');
  });

  it('respects blackout dates when building capacity schedule', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 2 }]
      }
    });
    const result = computeFeasibility(
      { goalId: GOAL_ID, deadlineISO: '2026-01-02T23:59:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 2, blackoutDates: ['2026-01-01'] },
      '2026-01-01T09:00:00.000Z'
    );

    expect(result.debug.dailyCapacitySchedule['2026-01-01']).toBe(0);
    expect(result.reasons).toContain('TODAY_NOT_WORKABLE');
  });

  it('is deterministic across identical inputs', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 3 }]
      }
    });
    const input = {
      goal: { goalId: GOAL_ID, deadlineISO: '2026-01-03T23:59:00.000Z' },
      constraints: { timezone: 'UTC', maxBlocksPerDay: 2 },
      nowISO: '2026-01-01T09:00:00.000Z'
    };
    const first = computeFeasibility(input.goal, state, input.constraints, input.nowISO);
    const second = computeFeasibility(input.goal, state, input.constraints, input.nowISO);
    expect(first).toEqual(second);
  });
});
