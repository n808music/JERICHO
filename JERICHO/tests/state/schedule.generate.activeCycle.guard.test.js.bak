import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildEndedCycleState() {
  const dayKey = '2026-02-01';
  const cycleId = 'cycle-ended';
  return {
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    viewDate: dayKey,
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    executionEvents: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    constraints: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'Ended',
        goalContract: { goalId: 'goal-ended', startDayKey: dayKey, endDayKey: '2026-03-01' },
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId: 'goal-ended', startDayKey: dayKey, endDayKey: '2026-03-01' },
    goalAdmissionByGoal: { 'goal-ended': { status: 'ADMITTED', reasonCodes: [] } },
  };
}

function buildActiveState() {
  const dayKey = '2026-01-08';
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: dayKey, days: [], metrics: {} },
    cycle: [],
    viewDate: dayKey,
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: {
      version: '1.0.0',
      onboardingComplete: false,
      lastActiveDate: dayKey,
      scenarioLabel: '',
      demoScenarioEnabled: false,
      showHints: false,
    },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
  };
}

describe('schedule generation active-cycle guard', () => {
  it('blocks generate/apply on read-only cycles with deterministic error', () => {
    const ended = buildEndedCycleState();

    const generated = computeDerivedState(ended, { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-ended' } });
    expect(generated.lastPlanError?.code).toBe('CYCLE_READ_ONLY');

    const applied = computeDerivedState(ended, { type: 'APPLY_DRAFT_SCHEDULE', payload: { cycleId: 'cycle-ended' } });
    expect(applied.lastPlanError?.code).toBe('CYCLE_READ_ONLY');
  });

  it('on active cycles, generate produces proposals or a deterministic error (never silent)', () => {
    const base = buildActiveState();
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

    const planned = computeDerivedState(onboarded, {
      type: 'GENERATE_PLAN',
      payload: { cycleId: onboarded.activeCycleId },
    });

    const suggestedCount = (planned.suggestedBlocks || []).filter((s) => s.status === 'suggested').length;
    expect(suggestedCount > 0 || Boolean(planned.lastPlanError?.code)).toBe(true);
  });
});
