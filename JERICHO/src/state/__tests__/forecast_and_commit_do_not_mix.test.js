import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const FIXED_DAY = '2026-01-08';
const NOW_ISO = `${FIXED_DAY}T12:00:00.000Z`;

const EQUATION_PAYLOAD = {
  label: 'Goal A',
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
  acceptsAutomaticCatchUp: true,
};

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
      nowISO: NOW_ISO,
      activeDayKey: FIXED_DAY,
        timeIsPinned: true,
      isFollowingNow: true,
        timeIsPinned: true,
    },
  };
}

function buildPreviewState() {
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
      minimumDaysPerWeek: 4,
    },
  });

  const compiled = computeDerivedState(onboarded, {
    type: 'COMPILE_GOAL_EQUATION',
    payload: { equation: EQUATION_PAYLOAD },
  });

  const preview = computeDerivedState(compiled, {
    type: 'GENERATE_PLAN',
    payload: { source: 'RENEGOTIATION_APPLY' },
  });

  return { compiled, preview };
}

describe('forecast vs commit separation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generating a plan produces suggestions without committed blocks', () => {
    const { compiled, preview } = buildPreviewState();
    const beforeEvents = (compiled.executionEvents || []).length;
    const beforeTodayBlocks = (compiled.today?.blocks || []).length;

    expect(preview.executionEvents.length).toBe(beforeEvents);
    expect((preview.proposedBlocks || []).some((block) => block?.status === 'suggested')).toBe(true);
    expect((preview.today?.blocks || []).length).toBe(beforeTodayBlocks);

    const first = (preview.proposedBlocks || []).find((block) => block?.status === 'suggested');
    expect(first).toBeTruthy();

    const accepted = computeDerivedState(preview, { type: 'ACCEPT_SUGGESTED_BLOCK', proposalId: first.id });
    const created = (accepted.executionEvents || []).find(
      (event) => event?.kind === 'create' && event?.suggestionId === first.id
    );
    expect(Boolean(created)).toBe(true);
  });
});
