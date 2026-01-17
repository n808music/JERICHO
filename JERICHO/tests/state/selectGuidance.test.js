import { describe, it, expect } from 'vitest';
import { selectGuidance } from '../../src/state/engine/selectGuidance.ts';

const GOAL_ID = 'goal-1';
const NOW_ISO = '2026-01-01T09:00:00.000Z';

function makeItem(overrides = {}) {
  return {
    workItemId: 'w1',
    title: 'Work',
    blocksRemaining: 1,
    mustFinishByISO: null,
    category: 'Focus',
    focusMode: 'shallow',
    energyCost: 'low',
    producesOutput: false,
    unblockType: null,
    dependencies: [],
    ...overrides
  };
}

function makeState(overrides = {}) {
  return {
    goalWorkById: { [GOAL_ID]: [] },
    executionEvents: [],
    ...overrides
  };
}

describe('selectGuidance', () => {
  it('returns NONE when infeasible and no recovery block exists', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [makeItem({ workItemId: 'a', category: 'Focus' })]
      }
    });
    const result = selectGuidance(
      { goalId: GOAL_ID, deadlineISO: '2026-01-02T00:00:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 0 },
      NOW_ISO
    );

    expect(result.status).toBe('NONE');
    expect(result.reasons).toContain('GOAL_INFEASIBLE_ONLY_RECOVERY_ALLOWED');
  });

  it('returns recovery block when infeasible and unblock exists', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [
          makeItem({ workItemId: 'a', category: 'Focus' }),
          makeItem({ workItemId: 'b', category: 'Body', unblockType: 'dependency' })
        ]
      }
    });
    const result = selectGuidance(
      { goalId: GOAL_ID, deadlineISO: '2026-01-02T00:00:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 0 },
      NOW_ISO
    );

    expect(result.status).toBe('PRIMARY');
    expect(result.primary?.workItemId).toBe('b');
  });

  it('returns NONE when directive eligibility is missing', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [makeItem({ workItemId: 'a', category: 'Focus' })]
      },
      directiveEligibilityByGoal: {}
    });
    const result = selectGuidance(
      { goalId: GOAL_ID, deadlineISO: '2026-01-02T23:59:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 2 },
      NOW_ISO
    );

    expect(result.status).toBe('NONE');
    expect(result.primary).toBe(null);
    expect(result.reasons).toContain('MISSING_ENGINE_ARTIFACT');
  });

  it('returns NONE when directive eligibility denies guidance', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [makeItem({ workItemId: 'a', category: 'Focus' })]
      },
      directiveEligibilityByGoal: {
        [GOAL_ID]: { allowed: false, reasons: ['cooldown'] }
      }
    });
    const result = selectGuidance(
      { goalId: GOAL_ID, deadlineISO: '2026-01-02T23:59:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 2 },
      NOW_ISO
    );

    expect(result.status).toBe('NONE');
    expect(result.primary).toBe(null);
    expect(result.reasons).toContain('cooldown');
  });

  it('prioritizes creation output when required pace is behind', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [
          makeItem({ workItemId: 'create', category: 'Creation', producesOutput: true }),
          makeItem({ workItemId: 'focus', category: 'Focus', producesOutput: false })
        ]
      },
      directiveEligibilityByGoal: {
        [GOAL_ID]: { allowed: true, reasons: [] }
      }
    });
    const result = selectGuidance(
      { goalId: GOAL_ID, deadlineISO: '2026-01-02T23:59:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 1 },
      NOW_ISO
    );

    expect(result.primary?.workItemId).toBe('create');
    expect(result.primary?.reasonCodes).toContain('CREATION_CADENCE_BEHIND');
  });

  it('filters by focus mode constraints deterministically', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [
          makeItem({ workItemId: 'deep', focusMode: 'deep', category: 'Creation' }),
          makeItem({ workItemId: 'shallow', focusMode: 'shallow', category: 'Focus' })
        ]
      },
      directiveEligibilityByGoal: {
        [GOAL_ID]: { allowed: true, reasons: [] }
      }
    });
    const result = selectGuidance(
      { goalId: GOAL_ID, deadlineISO: '2026-01-03T23:59:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 2, allowedFocusModes: ['shallow'] },
      NOW_ISO
    );

    expect(result.primary?.workItemId).toBe('shallow');
  });

  it('respects dependency blocking', () => {
    const state = makeState({
      goalWorkById: {
        [GOAL_ID]: [
          makeItem({ workItemId: 'a', dependencies: ['b'] }),
          makeItem({ workItemId: 'b' })
        ]
      },
      directiveEligibilityByGoal: {
        [GOAL_ID]: { allowed: true, reasons: [] }
      }
    });
    const result = selectGuidance(
      { goalId: GOAL_ID, deadlineISO: '2026-01-03T23:59:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 2 },
      NOW_ISO
    );

    expect(result.primary?.workItemId).toBe('b');
  });

  it('blocks guidance when daily limit is reached', () => {
    const state = makeState({
      goalWorkById: { [GOAL_ID]: [makeItem({ workItemId: 'a' })] },
      suggestionHistoryByGoal: {
        [GOAL_ID]: { dailyCountByDate: { '2026-01-01': 1 } }
      }
    });
    const result = selectGuidance(
      { goalId: GOAL_ID, deadlineISO: '2026-01-03T23:59:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 2, cooldowns: { maxSuggestionsPerDay: 1 } },
      NOW_ISO
    );

    expect(result.status).toBe('NONE');
    expect(result.reasons).toContain('DAILY_LIMIT_REACHED');
  });

  it('blocks guidance when cooldown prevents repeat', () => {
    const state = makeState({
      goalWorkById: { [GOAL_ID]: [makeItem({ workItemId: 'a' })] },
      suggestionHistoryByGoal: {
        [GOAL_ID]: { lastSuggestedWorkItemId: 'a', lastSuggestedAtISO: '2026-01-01T08:40:00.000Z' }
      },
      directiveEligibilityByGoal: {
        [GOAL_ID]: { allowed: true, reasons: [] }
      }
    });
    const result = selectGuidance(
      { goalId: GOAL_ID, deadlineISO: '2026-01-03T23:59:00.000Z' },
      state,
      { timezone: 'UTC', maxBlocksPerDay: 2, cooldowns: { resuggestMinutes: 60 } },
      NOW_ISO
    );

    expect(result.status).toBe('NONE');
    expect(result.reasons).toContain('COOLDOWN_BLOCKED');
  });

  it('is deterministic across identical inputs', () => {
    const state = makeState({
      goalWorkById: { [GOAL_ID]: [makeItem({ workItemId: 'a' })] }
    });
    const constraints = { timezone: 'UTC', maxBlocksPerDay: 2 };
    const first = selectGuidance({ goalId: GOAL_ID, deadlineISO: '2026-01-03T23:59:00.000Z' }, state, constraints, NOW_ISO);
    const second = selectGuidance({ goalId: GOAL_ID, deadlineISO: '2026-01-03T23:59:00.000Z' }, state, constraints, NOW_ISO);
    expect(first).toEqual(second);
  });
});
