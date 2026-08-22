import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

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
        timeIsPinned: true,
      isFollowingNow: true,
        timeIsPinned: true,
    },
    constraints: {
      maxBlocksPerDay: 4,
      maxBlocksPerWeek: 16,
    },
  };
}

const EQUATION_PAYLOAD = {
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
  acceptsAutomaticCatchUp: true,
};

function buildCompiledState() {
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
      minimumDaysPerWeek: 4,
    },
  });

  return computeDerivedState(onboarded, {
    type: 'COMPILE_GOAL_EQUATION',
    payload: {
      equation: EQUATION_PAYLOAD,
    },
  });
}

describe('generate/apply integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GENERATE_PLAN leaves a pending confirmation boundary in normal flow', () => {
    const compiled = buildCompiledState();
    const createdBeforeGenerate = (compiled.executionEvents || []).filter(
      (e) => e?.kind === 'create' && e?.origin === 'auto_asana'
    ).length;
    const planned = computeDerivedState(compiled, { type: 'GENERATE_PLAN' });

    expect(planned.scheduleApplied).toBe(false);
    expect(planned.pendingPlanConfirmation).toBe(true);
    expect(
      (planned.executionEvents || []).filter((e) => e?.kind === 'create' && e?.origin === 'auto_asana').length
    ).toBe(createdBeforeGenerate);
    expect((planned.proposedBlocks || []).some((b) => b?.status === 'suggested')).toBe(true);

    const cycle = planned.cyclesById[planned.activeCycleId];
    expect(cycle.autoAsanaPlan).toBeTruthy();
  });

  it('RENEGOTIATION_APPLY source preserves preview state - APPLY_PLAN applies review then ACTIVATE_SCHEDULE commits it', () => {
    const compiled = buildCompiledState();
    const previewed = computeDerivedState(compiled, {
      type: 'GENERATE_PLAN',
      payload: { source: 'RENEGOTIATION_APPLY' },
    });

    const cycleAfterPreview = previewed.cyclesById[previewed.activeCycleId];
    expect(cycleAfterPreview.autoAsanaPlan).toBeTruthy();
    expect(previewed.scheduleApplied).toBeFalsy();
    expect(previewed.pendingPlanConfirmation).toBe(true);
    expect((previewed.proposedBlocks || []).some((b) => b?.status === 'suggested')).toBe(true);

    const applied = computeDerivedState(previewed, { type: 'APPLY_PLAN' });
    const createdBeforeApply = (previewed.executionEvents || []).filter((e) => e?.kind === 'create');
    const createdAfterApply = (applied.executionEvents || []).filter((e) => e?.kind === 'create');
    expect(createdAfterApply.length).toBe(createdBeforeApply.length);
    expect(applied.scheduleLifecycle).toBe('applied_review');
    expect(applied.pendingPlanConfirmation).toBe(false);
    expect(applied.scheduleApplied).toBe(true);

    const activated = computeDerivedState(applied, { type: 'ACTIVATE_SCHEDULE' });
    const activatedCreates = (activated.executionEvents || []).filter((e) => e?.kind === 'create');
    expect(activatedCreates.length).toBeGreaterThan(0);
    expect(activated.scheduleLifecycle).toBe('active_schedule');
    expect((activated.scheduleReviewBlocks || []).length).toBe(0);
    expect((activated.cyclesById[activated.activeCycleId]?.scheduleReviewBlocks || []).length).toBe(0);
    expect(
      ((activated.cycle || []).flatMap((day) => day.blocks || []) || []).every(
        (block) => String(block?.origin || '').trim() !== 'schedule_review'
      )
    ).toBe(true);
  });
});
