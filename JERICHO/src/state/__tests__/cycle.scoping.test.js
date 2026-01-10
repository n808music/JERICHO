import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const FIXED_DAY = '2026-01-08';

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
    meta: {
      version: '1.0.0',
      onboardingComplete: false,
      lastActiveDate: FIXED_DAY,
      scenarioLabel: '',
      demoScenarioEnabled: false,
      showHints: false
    },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: `${FIXED_DAY}T12:00:00.000Z`,
      activeDayKey: FIXED_DAY,
      isFollowingNow: true
    }
  };
}

describe('cycle scoping', () => {
  it('starts a new cycle with a fresh slate and isolates evidence', () => {
    const base = buildBaseState();
    const cycleA = computeDerivedState(base, {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'Goal A',
        goalText: 'Goal A',
        horizon: '30d',
        narrative: '',
        focusAreas: ['Creation'],
        successDefinition: 'A shipped',
        minimumDaysPerWeek: 4
      }
    });

    const goalAId = cycleA.goalExecutionContract?.goalId;
    const cycleAId = cycleA.activeCycleId;
    const withEvents = {
      ...cycleA,
      cyclesById: {
        ...cycleA.cyclesById,
        [cycleAId]: {
          ...cycleA.cyclesById[cycleAId],
          executionEvents: [
            { goalId: goalAId, dateISO: FIXED_DAY, completed: true, kind: 'complete', minutes: 30 }
          ]
        }
      }
    };
    const hydratedA = computeDerivedState(withEvents, { type: 'NO_OP' });

    const cycleB = computeDerivedState(hydratedA, {
      type: 'START_NEW_CYCLE',
      payload: { goalText: 'Goal B', deadlineDayKey: '2026-02-10' }
    });

    expect(cycleB.activeCycleId).not.toBe(cycleAId);
    expect(cycleB.executionEvents.length).toBe(0);
    expect((cycleB.today?.blocks || []).length).toBe(0);

    const oldCycle = cycleB.cyclesById[cycleAId];
    expect((oldCycle?.executionEvents || []).length).toBe(1);

    const goalBId = cycleB.goalExecutionContract?.goalId;
    const probabilityB = cycleB.probabilityByGoal?.[goalBId];
    expect(probabilityB?.evidenceSummary?.totalEvents || 0).toBe(0);
  });
});
