import { describe, expect, it } from 'vitest';
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

describe('suggestion accept idempotence', () => {
  it('accepting the same suggestion twice creates one committed block', () => {
    const base = buildBaseState();
    const seeded = computeDerivedState(base, {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'Goal A',
        goalText: 'Goal A',
        horizon: '30d',
        narrative: '',
        focusAreas: ['Creation'],
        successDefinition: 'Ship',
        minimumDaysPerWeek: 4
      }
    });
    const suggestionId = (seeded.suggestedBlocks || []).find((s) => s.status === 'suggested')?.id;
    expect(suggestionId).toBeTruthy();

    const acceptedOnce = computeDerivedState(seeded, { type: 'ACCEPT_SUGGESTED_BLOCK', proposalId: suggestionId });
    const acceptedTwice = computeDerivedState(acceptedOnce, { type: 'ACCEPT_SUGGESTED_BLOCK', proposalId: suggestionId });

    const createEvents = (acceptedTwice.executionEvents || []).filter(
      (event) => event?.kind === 'create' && event?.suggestionId === suggestionId
    );
    expect(createEvents.length).toBe(1);
    const acceptedEvents = (acceptedTwice.suggestionEvents || []).filter(
      (event) => event?.type === 'suggested_block_accepted' && event?.proposalId === suggestionId
    );
    expect(acceptedEvents.length).toBe(1);
  });
});
