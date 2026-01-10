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

describe('learning updates only from ended cycles', () => {
  it('active cycles do not contribute to profile learning', () => {
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
    const cycleAId = cycleA.activeCycleId;
    const endedA = computeDerivedState(cycleA, { type: 'END_CYCLE', cycleId: cycleAId });
    // MVP 3.0: only CONVERGED cycles contribute to learning; onboarding cycles without goal admission are INCOMPLETE
    expect(endedA.profileLearning?.cycleCount || 0).toBe(0);

    const cycleB = computeDerivedState(endedA, {
      type: 'START_NEW_CYCLE',
      payload: { goalText: 'Goal B', deadlineDayKey: '2026-02-10' }
    });
    // Still 0 because cycleB is active, not ended
    expect(cycleB.profileLearning?.cycleCount || 0).toBe(0);
  });
});
