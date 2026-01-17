import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { dayKeyFromISO } from '../../src/state/time/time.ts';

function buildBaseState(date = '2026-01-09', timeZone = 'UTC') {
  const nowISO = `${date}T12:00:00.000Z`;
  return {
    vector: { day: 1, direction: 'Test', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [] }, flow: { streams: [] } },
    today: { date, blocks: [] },
    currentWeek: { weekStart: date, days: [] },
    cycle: [],
    viewDate: date,
    templates: { objectives: {} },
    stability: {},
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    lastAdaptedDate: null,
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

describe('timezone consistency', () => {
  it('uses payload timeZone for day bucketing', () => {
    const base = buildBaseState();
    const startISO = '2026-01-09T01:30:00.000Z';
    const next = computeDerivedState(base, {
      type: 'CREATE_BLOCK',
      payload: {
        start: startISO,
        durationMinutes: 30,
        domain: 'FOCUS',
        title: 'UTC Anchor',
        timeZone: 'UTC'
      }
    });

    const expectedDayKey = dayKeyFromISO(startISO, 'UTC');
    const cycleDay = (next.cycle || []).find((day) => day.date === expectedDayKey);
    expect(cycleDay).toBeTruthy();
  });
});
