import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { projectSuggestionHistory } from '../suggestionHistory.js';

const FIXED_DAY = '2026-01-08';

function buildBaseState(date = FIXED_DAY) {
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
    meta: {
      version: '1.0.0',
      onboardingComplete: true,
      lastActiveDate: date,
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
      nowISO: `${date}T12:00:00.000Z`,
      activeDayKey: date,
      isFollowingNow: true
    }
  };
}

describe('stress scale', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('projects history and signals deterministically at scale', () => {
    const suggestionEvents = [];
    for (let i = 0; i < 2000; i += 1) {
      const dayOffset = i % 30;
      const dayKey = new Date(`2026-01-01T12:00:00.000Z`);
      dayKey.setDate(dayKey.getDate() + dayOffset);
      const dayKeyStr = dayKey.toISOString().slice(0, 10);
      suggestionEvents.push({
        id: `e-${i}`,
        type: i % 3 === 0 ? 'suggested_block_created' : i % 3 === 1 ? 'suggested_block_accepted' : 'suggestion_rejected',
        proposalId: `s-${i % 500}`,
        suggestionId: `s-${i % 500}`,
        reason: i % 3 === 2 ? 'OVERCOMMITTED' : undefined,
        dayKey: dayKeyStr,
        atISO: `${dayKeyStr}T${String(i % 24).padStart(2, '0')}:00:00.000Z`
      });
    }

    const suggestionsById = new Map(
      Array.from({ length: 500 }).map((_, idx) => [
        `s-${idx}`,
        { id: `s-${idx}`, title: `Suggestion ${idx}`, domain: idx % 2 ? 'Creation' : 'Focus' }
      ])
    );

    const start = Date.now();
    const rows = projectSuggestionHistory({
      suggestionEvents,
      suggestionsById,
      nowDayKey: FIXED_DAY,
      windowDays: 14,
      timeZone: 'UTC'
    });
    const duration = Date.now() - start;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(2000);

    const base = buildBaseState();
    const state = computeDerivedState({ ...base, suggestionEvents }, { type: 'NO_OP' });
    const stateAgain = computeDerivedState({ ...base, suggestionEvents }, { type: 'NO_OP' });
    expect(state.correctionSignals).toEqual(stateAgain.correctionSignals);
  });
});
