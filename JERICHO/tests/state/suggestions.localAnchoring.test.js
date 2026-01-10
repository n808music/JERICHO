import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { dayKeyFromISO } from '../../src/state/time/time.ts';

const FIXED_DAY = '2026-01-09';

function buildBaseState(date = FIXED_DAY, timeZone = 'UTC') {
  const nowISO = `${date}T12:00:00.000Z`;
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] }
    },
    today: { date, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: date, days: [], metrics: {} },
    cycle: [],
    viewDate: date,
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
      timeZone,
      nowISO,
      activeDayKey: date,
      isFollowingNow: true
    },
    directiveEligibilityByGoal: {},
    goalDirective: null
  };
}

function seedOnboardingState() {
  const base = buildBaseState();
  const seeded = computeDerivedState(base, { type: 'SET_VIEW_DATE', date: base.today.date });
  return computeDerivedState(seeded, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Ship v0',
      goalText: 'Ship v0',
      horizon: '30d',
      narrative: '',
      focusAreas: ['Creation', 'Focus'],
      successDefinition: 'MVP shipped'
    }
  });
}

describe('suggestions local anchoring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps suggestion dayKey aligned with startISO in local tz', () => {
    const state = seedOnboardingState();
    const timeZone = state.appTime?.timeZone || 'UTC';
    const suggested = state.suggestedBlocks || [];

    expect(suggested.length).toBeGreaterThan(0);
    suggested.forEach((s) => {
      const key = dayKeyFromISO(s.startISO, timeZone);
      expect(key).toBe(s.dayKey);
    });
  });
});
