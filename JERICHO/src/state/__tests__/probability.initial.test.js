import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { scoreGoalSuccessProbability } from '../engine/probabilityScore.ts';

const FIXED_DAY = '2026-01-08';
const NOW_ISO = `${FIXED_DAY}T12:00:00.000Z`;

function buildBaseState() {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] }
    },
    today: { date: FIXED_DAY, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: FIXED_DAY, days: [], metrics: {} },
    cycle: [],
    viewDate: FIXED_DAY,
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: false },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: NOW_ISO,
      activeDayKey: FIXED_DAY,
      isFollowingNow: true
    },
    constraints: {
      maxBlocksPerDay: 4
    }
  };
}

function seedOnboarding(state) {
  return computeDerivedState(state, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Goal A',
      goalText: 'Goal A',
      horizon: '30d',
      narrative: '',
      focusAreas: ['Creation'],
      successDefinition: 'Ship A',
      minimumDaysPerWeek: 4
    }
  });
}

describe('probability initial report', () => {
  it('returns 0 when infeasible', () => {
    const base = seedOnboarding(buildBaseState());
    const goalId = base.goalExecutionContract?.goalId;
    const cycleId = base.activeCycleId;
    base.goalWorkById = {
      [goalId]: [{ workItemId: 'work-1', blocksRemaining: 10, category: 'Focus', focusMode: 'deep', energyCost: 'low', producesOutput: true }]
    };
    base.cyclesById[cycleId].goalPlan = {
      planProof: {
        workableDaysRemaining: 5,
        totalRequiredUnits: 10,
        requiredPacePerDay: 2,
        maxPerDay: 0,
        maxPerWeek: 0,
        slackUnits: -10,
        slackRatio: 0,
        intensityRatio: 1,
        feasibilityStatus: 'INFEASIBLE',
        feasibilityReasons: ['MAX_PER_DAY_ZERO']
      },
      scheduleBlocks: [],
      generatedAtISO: NOW_ISO
    };

    const result = scoreGoalSuccessProbability(goalId, base, { timezone: 'UTC', maxBlocksPerDay: 4 }, NOW_ISO);
    expect(result.status).toBe('INFEASIBLE');
    expect(result.value).toBe(0);
  });

  it('caps day-one probability when feasible and no evidence', () => {
    const base = seedOnboarding(buildBaseState());
    const goalId = base.goalExecutionContract?.goalId;
    const cycleId = base.activeCycleId;
    base.goalWorkById = {
      [goalId]: [{ workItemId: 'work-2', blocksRemaining: 10, category: 'Focus', focusMode: 'deep', energyCost: 'low', producesOutput: true }]
    };
    base.cyclesById[cycleId].goalPlan = {
      planProof: {
        workableDaysRemaining: 20,
        totalRequiredUnits: 10,
        requiredPacePerDay: 0.5,
        maxPerDay: 4,
        maxPerWeek: 20,
        slackUnits: 70,
        slackRatio: 0.5,
        intensityRatio: 0.2,
        feasibilityStatus: 'FEASIBLE',
        feasibilityReasons: []
      },
      scheduleBlocks: [],
      generatedAtISO: NOW_ISO
    };

    const result = scoreGoalSuccessProbability(goalId, base, { timezone: 'UTC', maxBlocksPerDay: 4 }, NOW_ISO);
    expect(result.status).toBe('NO_EVIDENCE');
    expect(result.value).not.toBeNull();
    expect(result.value).toBeLessThanOrEqual(0.65);
    expect(result.capApplied).toBe(true);
  });
});
