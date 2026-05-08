import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const FIXED_DAY = '2026-01-08';
const NOW_ISO = `${FIXED_DAY}T12:00:00.000Z`;

const EQUATION_PAYLOAD = {
  label: 'Idempotence Goal',
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
    meta: { version: '1.0.0', onboardingComplete: false },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: NOW_ISO,
      activeDayKey: FIXED_DAY,
      isFollowingNow: true,
    },
    constraints: { maxBlocksPerDay: 4, maxBlocksPerWeek: 16 },
  };
}

function buildPreviewState() {
  const base = buildBaseState();

  const onboarded = computeDerivedState(base, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: 'Idempotence Goal',
      goalText: 'Idempotence Goal',
      horizon: '30d',
      narrative: '',
      focusAreas: ['Focus'],
      successDefinition: 'Practice complete',
      minimumDaysPerWeek: 4,
    },
  });

  const compiled = computeDerivedState(onboarded, {
    type: 'COMPILE_GOAL_EQUATION',
    payload: { equation: EQUATION_PAYLOAD },
  });

  return computeDerivedState(compiled, {
    type: 'GENERATE_PLAN',
    payload: { source: 'RENEGOTIATION_APPLY' },
  });
}

describe('suggestion accept idempotence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepting the same suggestion twice creates one committed block', () => {
    const preview = buildPreviewState();
    const suggested = (preview.proposedBlocks || []).filter((block) => block?.status === 'suggested');
    expect(suggested.length).toBeGreaterThan(0);

    const first = suggested[0];
    expect(first).toBeTruthy();
    const proposalId = first.id;

    const once = computeDerivedState(preview, {
      type: 'ACCEPT_SUGGESTED_BLOCK',
      proposalId,
    });

    const createsAfterFirst = (once.executionEvents || []).filter(
      (event) => event?.kind === 'create' && event?.suggestionId === proposalId
    );
    expect(createsAfterFirst.length).toBe(1);

    const twice = computeDerivedState(once, {
      type: 'ACCEPT_SUGGESTED_BLOCK',
      proposalId,
    });

    const createsAfterSecond = (twice.executionEvents || []).filter(
      (event) => event?.kind === 'create' && event?.suggestionId === proposalId
    );
    expect(createsAfterSecond.length).toBe(1);

    const committed = (twice.today?.blocks || []).find((block) => block?.suggestionId === proposalId);
    expect(committed).toBeTruthy();
  });
});
