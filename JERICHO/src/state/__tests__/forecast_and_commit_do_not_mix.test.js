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

describe('forecast vs commit separation', () => {
  it('generating a plan produces suggestions without committed blocks', () => {
    const base = buildBaseState();
    const onboarded = computeDerivedState(base, {
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

    const beforeEvents = onboarded.executionEvents.length;
    const planned = computeDerivedState(onboarded, { type: 'GENERATE_PLAN' });

    expect(planned.executionEvents.length).toBe(beforeEvents);
    expect((planned.suggestedBlocks || []).some((s) => s.status === 'suggested')).toBe(true);
    expect((planned.today?.blocks || []).length).toBe(0);

    const first = (planned.suggestedBlocks || []).find((s) => s.status === 'suggested');
    const accepted = computeDerivedState(planned, { type: 'ACCEPT_SUGGESTED_BLOCK', proposalId: first.id });
    const created = (accepted.executionEvents || []).find((e) => e.kind === 'create' && e.blockId === `blk-${first.id}`);
    expect(Boolean(created)).toBe(true);
  });
});
