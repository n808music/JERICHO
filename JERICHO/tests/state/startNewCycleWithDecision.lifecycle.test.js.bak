import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';

const FIXED_DAY = '2026-01-08';

function buildBaseState() {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: {
      date: FIXED_DAY,
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
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
      showHints: false,
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
      isFollowingNow: true,
    },
  };
}

describe('startNewCycleWithDecision lifecycle safety', () => {
  it('creates a new valid cycle when delete mode replaces the active cycle', () => {
    const onboarded = computeDerivedState(buildBaseState(), {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'Goal A',
        goalText: 'Goal A',
        horizon: '30d',
        narrative: '',
        focusAreas: ['Creation'],
        successDefinition: 'Done',
        minimumDaysPerWeek: 4,
      },
    });

    const previousCycleId = onboarded.activeCycleId;
    const next = computeDerivedState(onboarded, {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'delete' },
    });

    expect(next.activeCycleId).toBeTruthy();
    expect(next.activeCycleId).not.toBe(previousCycleId);
    expect(next.cyclesById[next.activeCycleId]).toBeTruthy();
    expect(next.cyclesById[next.activeCycleId].status).toBe('active');
    expect(next.cyclesById[previousCycleId]).toBeUndefined();
  });

  it('creates a new valid cycle when no active cycle exists yet', () => {
    const next = computeDerivedState(buildBaseState(), {
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });

    expect(next.activeCycleId).toBeTruthy();
    expect(next.cyclesById[next.activeCycleId]).toBeTruthy();
    expect(next.cyclesById[next.activeCycleId].status).toBe('active');
  });
});
