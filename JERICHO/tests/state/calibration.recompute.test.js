import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

const FIXED_DAY = '2026-01-02';

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
      onboardingComplete: false,
      lastActiveDate: date,
      scenarioLabel: '',
      demoScenarioEnabled: false,
      showHints: false
    },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: []
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

describe('calibration recompute', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is idempotent when setting the same days/week twice', () => {
    const state0 = seedOnboardingState();
    const state1 = computeDerivedState(state0, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 5 });
    const state2 = computeDerivedState(state1, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 5 });

    expect(state2.suggestedBlocks).toEqual(state1.suggestedBlocks);
    expect(state2.suggestedBlocks.map((s) => s.id)).toEqual(state1.suggestedBlocks.map((s) => s.id));

    const recomputeEvents1 = (state1.suggestionEvents || []).filter((e) => e.type === 'suggestions_recomputed');
    const recomputeEvents2 = (state2.suggestionEvents || []).filter((e) => e.type === 'suggestions_recomputed');
    expect(recomputeEvents2.length).toBe(recomputeEvents1.length);
  });

  it('does not mutate accepted/rejected suggestions when recalibrating', () => {
    const state0 = seedOnboardingState();
    const first = state0.suggestedBlocks[0];
    const second = state0.suggestedBlocks[1];
    const accepted = computeDerivedState(state0, { type: 'ACCEPT_SUGGESTED_BLOCK', proposalId: first.id });
    const rejected = computeDerivedState(accepted, {
      type: 'REJECT_SUGGESTED_BLOCK',
      proposalId: second.id,
      reason: 'no_time'
    });

    const acceptedBefore = rejected.suggestedBlocks.find((s) => s.id === first.id);
    const rejectedBefore = rejected.suggestedBlocks.find((s) => s.id === second.id);
    const recalibrated = computeDerivedState(rejected, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 6 });
    const acceptedAfter = recalibrated.suggestedBlocks.find((s) => s.id === first.id);
    const rejectedAfter = recalibrated.suggestedBlocks.find((s) => s.id === second.id);

    expect(acceptedAfter).toEqual(acceptedBefore);
    expect(rejectedAfter).toEqual(rejectedBefore);
  });

  it('emits recompute event with deterministic prev/next ids and reason', () => {
    const state0 = seedOnboardingState();
    const prevIds = state0.suggestedBlocks.filter((s) => s.status === 'suggested').map((s) => s.id);
    const state1 = computeDerivedState(state0, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 6 });
    const nextIds = state1.suggestedBlocks.filter((s) => s.status === 'suggested').map((s) => s.id);
    const recompute = (state1.suggestionEvents || []).find((e) => e.type === 'suggestions_recomputed');

    expect(recompute?.reason).toBe('capacity_calibration');
    expect(recompute?.prevSuggestionIds).toEqual(prevIds);
    expect(recompute?.nextSuggestionIds).toEqual(nextIds);
  });

  it('keeps plan preview totals consistent with suggested blocks', () => {
    const state0 = seedOnboardingState();
    const suggested0 = state0.suggestedBlocks.filter((s) => s.status === 'suggested');
    const totalMinutes0 = suggested0.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    expect(state0.planPreview.totalBlocks).toBe(suggested0.length);
    expect(state0.planPreview.totalMinutes).toBe(totalMinutes0);
    expect(state0.planPreview.primaryDomain).toBe(state0.planDraft.primaryDomain);
    expect(state0.planPreview.horizonDays).toBe(state0.goalExecutionContract.horizonDays);

    const state1 = computeDerivedState(state0, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 5, uncertain: true });
    const suggested1 = state1.suggestedBlocks.filter((s) => s.status === 'suggested');
    const totalMinutes1 = suggested1.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    expect(state1.planPreview.totalBlocks).toBe(suggested1.length);
    expect(state1.planPreview.totalMinutes).toBe(totalMinutes1);
    expect(state1.planPreview.primaryDomain).toBe(state0.planPreview.primaryDomain);
    expect(state1.planPreview.horizonDays).toBe(state0.planPreview.horizonDays);
  });

  it('round-trips suggestion ids across 3→5→3 and preserves reserved ids', () => {
    const getSuggestedIds = (state) =>
      state.suggestedBlocks.filter((s) => s.status === 'suggested').map((s) => s.id);

    const state0 = seedOnboardingState();
    const state3a = computeDerivedState(state0, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 3 });
    const ids3a = getSuggestedIds(state3a);
    expect(ids3a.length).toBeGreaterThan(0);

    const acceptedId = ids3a[0];
    const rejectedId = ids3a[1];
    const accepted = computeDerivedState(state3a, { type: 'ACCEPT_SUGGESTED_BLOCK', proposalId: acceptedId });
    const rejected = computeDerivedState(accepted, {
      type: 'REJECT_SUGGESTED_BLOCK',
      proposalId: rejectedId,
      reason: 'no_time'
    });
    const expectedSuggested3a = ids3a.filter((id) => id !== acceptedId && id !== rejectedId);

    const state5 = computeDerivedState(rejected, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 5 });
    const ids5 = getSuggestedIds(state5);
    expect(ids5.length).toBeGreaterThan(0);

    const state3b = computeDerivedState(state5, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 3 });
    const ids3b = getSuggestedIds(state3b);
    expect(ids3b).toEqual(expectedSuggested3a);
    const suggested3b = state3b.suggestedBlocks.filter((s) => s.status === 'suggested');
    const minutes3b = suggested3b.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    expect(state3b.planPreview.totalBlocks).toBe(suggested3b.length);
    expect(state3b.planPreview.totalMinutes).toBe(minutes3b);
    expect(state3b.planPreview.primaryDomain).toBe(state3a.planPreview.primaryDomain);
    expect(state3b.planPreview.horizonDays).toBe(state3a.planPreview.horizonDays);

    const acceptedAfter = state3b.suggestedBlocks.find((s) => s.id === acceptedId);
    const rejectedAfter = state3b.suggestedBlocks.find((s) => s.id === rejectedId);
    expect(acceptedAfter?.status).toBe('accepted');
    expect(rejectedAfter?.status).toBe('rejected');
  });

  it('reject sets reason, emits event, and is idempotent', () => {
    const state0 = seedOnboardingState();
    const suggestionId = state0.suggestedBlocks[0].id;
    const rejected = computeDerivedState(state0, {
      type: 'REJECT_SUGGESTED_BLOCK',
      proposalId: suggestionId,
      reason: 'TOO_LONG'
    });
    const rejectedItem = rejected.suggestedBlocks.find((s) => s.id === suggestionId);
    expect(rejectedItem?.status).toBe('rejected');
    expect(rejectedItem?.rejectedReason).toBe('TOO_LONG');
    const rejectEvents = (rejected.suggestionEvents || []).filter((e) => e.type === 'suggestion_rejected');
    expect(rejectEvents.length).toBe(1);
    expect(rejectEvents[0].suggestionId).toBe(suggestionId);
    expect(rejectEvents[0].reason).toBe('TOO_LONG');

    const rejectedAgain = computeDerivedState(rejected, {
      type: 'REJECT_SUGGESTED_BLOCK',
      proposalId: suggestionId,
      reason: 'WRONG_TIME'
    });
    const rejectEventsAfter = (rejectedAgain.suggestionEvents || []).filter((e) => e.type === 'suggestion_rejected');
    expect(rejectEventsAfter.length).toBe(1);
    const suggestedCount = rejectedAgain.suggestedBlocks.filter((s) => s.status === 'suggested').length;
    expect(rejectedAgain.planPreview.totalBlocks).toBe(suggestedCount);
  });
});
