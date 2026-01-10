import { describe, it, expect } from 'vitest';
import { renderTruthPanel } from '../../src/state/engine/renderTruthPanel.ts';

const GOAL_ID = 'goal-1';
const NOW_ISO = '2026-01-01T09:00:00.000Z';

function makeState(overrides = {}) {
  return {
    activeGoalId: GOAL_ID,
    feasibilityByGoal: {
      [GOAL_ID]: {
        status: 'REQUIRED',
        reasons: ['BEHIND_REQUIRED_PACE'],
        remainingBlocksTotal: 4,
        workableDaysRemaining: 2,
        requiredBlocksPerDay: 2,
        requiredBlocksToday: 1,
        completedBlocksToday: 1,
        delta: { blocksShort: 0 }
      }
    },
    goalDirective: {
      goalId: GOAL_ID,
      workItemId: 'w1',
      title: 'Draft outline'
    },
    directiveEligibilityByGoal: {
      [GOAL_ID]: { allowed: true, reasons: [] }
    },
    probabilityStatusByGoal: {
      [GOAL_ID]: {
        status: 'computed',
        reasons: [],
        requiredEvents: 2,
        evidenceSummary: { totalEvents: 3, completedCount: 2, daysCovered: 2 }
      }
    },
    ...overrides
  };
}

describe('renderTruthPanel', () => {
  it('maps feasibility fields without modification', () => {
    const state = makeState();
    const result = renderTruthPanel(state, NOW_ISO);
    expect(result.sections.feasibility.status).toBe('REQUIRED');
    expect(result.sections.feasibility.requiredBlocksToday).toBe(1);
    expect(result.sections.feasibility.workableDaysRemaining).toBe(2);
    expect(result.sections.feasibility.reasons).toEqual(['BEHIND_REQUIRED_PACE']);
  });

  it('renders directive enabled/disabled from eligibility', () => {
    const state = makeState({
      directiveEligibilityByGoal: {
        [GOAL_ID]: { allowed: false, reasons: ['cooldown'] }
      }
    });
    const result = renderTruthPanel(state, NOW_ISO);
    expect(result.sections.guidance.hasDirective).toBe(true);
    expect(result.sections.guidance.enabled).toBe(false);
    expect(result.sections.guidance.reasons).toEqual(['cooldown']);
  });

  it('maps computed probability to eligible', () => {
    const state = makeState();
    const result = renderTruthPanel(state, NOW_ISO);
    expect(result.sections.probabilityEligibility.status).toBe('eligible');
  });

  it('returns errors when required artifacts are missing', () => {
    const state = makeState({
      feasibilityByGoal: {}
    });
    const result = renderTruthPanel(state, NOW_ISO);
    expect(result.errors).toBeTruthy();
    expect(result.errors[0].code).toBe('MISSING_ENGINE_ARTIFACT');
    expect(result.errors[0].fields).toContain('feasibilityByGoal');
  });

  it('is deterministic across identical inputs', () => {
    const state = makeState();
    const first = renderTruthPanel(state, NOW_ISO);
    const second = renderTruthPanel(state, NOW_ISO);
    expect(first).toEqual(second);
  });
});
