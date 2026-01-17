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
    meta: { version: '1.0.0', onboardingComplete: false },
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
    },
    constraints: {
      maxBlocksPerDay: 4,
      maxBlocksPerWeek: 16
    }
  };
}

describe('generate/apply integration', () => {
  it('generates a plan and applies blocks', () => {
    const base = buildBaseState();
    const onboarded = computeDerivedState(base, {
      type: 'COMPLETE_ONBOARDING',
      onboarding: {
        direction: 'Skill Goal',
        goalText: 'Skill Goal',
        horizon: '30d',
        narrative: '',
        focusAreas: ['Focus'],
        successDefinition: 'Practice complete',
        minimumDaysPerWeek: 4
      }
    });

    const compiled = computeDerivedState(onboarded, {
      type: 'COMPILE_GOAL_EQUATION',
      payload: {
        equation: {
          label: 'Skill Goal',
          family: 'SKILL',
          mechanismClass: 'THROUGHPUT',
          objective: 'PRACTICE_HOURS_TOTAL',
          objectiveValue: 20,
          deadlineDayKey: '2026-02-08',
          deadlineType: 'HARD',
          workingFullTime: true,
          workDaysPerWeek: 4,
          workStartWindow: 'MID',
          workEndWindow: 'MID',
          minSleepHours: 8,
          sleepFixedWindow: false,
          sleepStartWindow: 'LATE',
          sleepEndWindow: 'EARLY',
          hasWeeklyRestDay: true,
          restDay: 0,
          blackoutBlocks: [],
          hasGymAccess: true,
          canCookMostDays: true,
          hasTransportLimitation: false,
          currentlyInjured: false,
          beginnerLevel: false,
          maxDailyWorkMinutes: 120,
          noEveningWork: false,
          noMorningWork: false,
          weekendsAllowed: true,
          travelThisPeriod: 'NONE',
          acceptsDailyMinimum: true,
          acceptsFixedSchedule: true,
          acceptsNoRenegotiation7d: true,
          acceptsAutomaticCatchUp: true
        }
      }
    });

    const planned = computeDerivedState(compiled, { type: 'GENERATE_PLAN' });
    const cycle = planned.cyclesById[planned.activeCycleId];
    expect(cycle.autoAsanaPlan).toBeTruthy();
    expect((planned.suggestedBlocks || []).length).toBeGreaterThan(0);

    const applied = computeDerivedState(planned, { type: 'APPLY_PLAN' });
    const created = (applied.executionEvents || []).filter((e) => e?.kind === 'create' && e?.origin === 'auto_asana');
    expect(created.length).toBeGreaterThan(0);
  });
});
