import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';
import { projectSuggestionHistory } from '../suggestionHistory.js';

/*
Invariants locked by this suite:
- Determinism: identical event sequences yield identical projections.
- Idempotence: reapplying calibration does not change suggestions or double-log recompute.
- Round-trip: 3→5→3 returns exact suggested IDs (order included).
- Reserved preservation: accepted/rejected IDs persist across recompute.
- Reject idempotence: repeat reject emits no additional event.
- Preview consistency: preview totals equal derived suggested totals.
- Signal boundedness: correctionSignals remain within [0,1].
- History stability: projection is deterministic for identical inputs.
*/

const FIXED_DAY = '2026-01-08';
const REASONS = ['TOO_LONG', 'WRONG_TIME', 'LOW_ENERGY', 'NOT_RELEVANT', 'MISSING_PREREQ', 'OVERCOMMITTED'];
const CAL_DAYS = [3, 4, 5, 6, 7];

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
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: `${date}T12:00:00.000Z`,
      activeDayKey: date,
      isFollowingNow: true
    }
  };
}

function buildOnboardingState({
  goalText = 'Ship v0',
  horizon = '30d',
  focusAreas = ['Creation', 'Focus'],
  decideLater = true
} = {}) {
  const base = buildBaseState();
  const seeded = computeDerivedState(base, { type: 'SET_VIEW_DATE', date: base.today.date });
  return computeDerivedState(seeded, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: goalText,
      goalText,
      horizon,
      narrative: '',
      focusAreas,
      successDefinition: 'MVP shipped',
      minimumDaysPerWeek: decideLater ? undefined : 4
    }
  });
}

function applyEventSequence(state, events) {
  return events.reduce((acc, event) => computeDerivedState(acc, event), state);
}

function getSuggestedIds(state) {
  return (state.suggestedBlocks || []).filter((s) => s.status === 'suggested').map((s) => s.id);
}

function getCommittedIds(state) {
  return (state.suggestedBlocks || []).filter((s) => s.status === 'accepted').map((s) => s.id);
}

function getRejectedIds(state) {
  return (state.suggestedBlocks || []).filter((s) => s.status === 'rejected').map((s) => s.id);
}

function getPlanPreview(state) {
  return state.planPreview;
}

function getCorrectionSignals(state) {
  return state.correctionSignals;
}

function getHistory(state) {
  const suggestionsById = new Map((state.suggestedBlocks || []).map((s) => [s.id, s]));
  return projectSuggestionHistory({
    suggestionEvents: state.suggestionEvents,
    suggestionsById,
    nowDayKey: FIXED_DAY,
    windowDays: 14,
    timeZone: 'UTC'
  });
}

function snapshotProjections(state) {
  return {
    suggested: state.suggestedBlocks,
    preview: getPlanPreview(state),
    signals: getCorrectionSignals(state),
    history: getHistory(state)
  };
}

function seededRng(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function assertPreviewConsistency(state) {
  const suggested = (state.suggestedBlocks || []).filter((s) => s.status === 'suggested');
  const totalMinutes = suggested.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  expect(state.planPreview.totalBlocks).toBe(suggested.length);
  expect(state.planPreview.totalMinutes).toBe(totalMinutes);
}

function assertSignalsBounded(state) {
  const signals = state.correctionSignals?.signals || {};
  Object.values(signals).forEach((value) => {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  });
}

describe('stress invariants', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('round-trips 3→5→3 with reserved ids preserved', () => {
    const state0 = buildOnboardingState();
    expect(state0.goalExecutionContract?.goalText).toBeTruthy();
    expect(Number.isFinite(state0.goalExecutionContract?.horizonDays)).toBe(true);
    expect(Array.isArray(state0.goalExecutionContract?.domains)).toBe(true);
    expect(state0.goalExecutionContract?.successDefinition).toBeTruthy();
    expect(state0.goalExecutionContract?.startDayKey).toBeTruthy();
    expect(state0.goalExecutionContract?.endDayKey).toBeTruthy();
    const state3a = computeDerivedState(state0, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 3 });
    const ids3a = getSuggestedIds(state3a);
    const acceptedId = ids3a[0];
    const rejectedId = ids3a[1];
    const accepted = computeDerivedState(state3a, { type: 'ACCEPT_SUGGESTED_BLOCK', proposalId: acceptedId });
    const rejected = computeDerivedState(accepted, {
      type: 'REJECT_SUGGESTED_BLOCK',
      proposalId: rejectedId,
      reason: 'OVERCOMMITTED'
    });
    const contractId = rejected.cyclesById?.[rejected.activeCycleId]?.goalGovernanceContract?.contractId;
    const rejectEvent = (rejected.suggestionEvents || []).find((e) => e.type === 'suggestion_rejected');
    expect(contractId).toBeTruthy();
    expect(rejectEvent?.contractId).toBe(contractId);
    const state5 = computeDerivedState(rejected, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 5 });
    const state3b = computeDerivedState(state5, { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 3 });
    const ids3b = getSuggestedIds(state3b);
    const expectedSuggested = ids3a.filter((id) => id !== acceptedId && id !== rejectedId);
    expect(ids3b).toEqual(expectedSuggested);
    expect(getCommittedIds(state3b)).toEqual([acceptedId]);
    expect(getRejectedIds(state3b)).toEqual([rejectedId]);
  });

  it('replay determinism over randomized sequences', () => {
    const rng = seededRng(42);
    for (let seq = 0; seq < 5; seq += 1) {
      let state = buildOnboardingState();
      const events = [];
      const acceptedIds = new Set();
      const rejectedIds = new Set();
      for (let step = 0; step < 10; step += 1) {
        const suggested = (state.suggestedBlocks || []).filter((s) => s.status === 'suggested');
        const actionRoll = rng();
        let event = { type: 'NO_OP' };
        if (actionRoll < 0.4) {
          const daysPerWeek = pick(rng, CAL_DAYS);
          event = { type: 'SET_CALIBRATION_DAYS', daysPerWeek };
        } else if (actionRoll < 0.65 && suggested.length) {
          const pickIdx = Math.floor(rng() * suggested.length);
          const pickId = suggested[pickIdx].id;
          event = { type: 'ACCEPT_SUGGESTED_BLOCK', proposalId: pickId };
          acceptedIds.add(pickId);
        } else if (actionRoll < 0.9 && suggested.length) {
          const pickIdx = Math.floor(rng() * suggested.length);
          const pickId = suggested[pickIdx].id;
          const reason = pick(rng, REASONS);
          event = { type: 'REJECT_SUGGESTED_BLOCK', proposalId: pickId, reason };
        }
        const beforeRejectEvents = (state.suggestionEvents || []).filter((e) => e.type === 'suggestion_rejected').length;
        const beforeSuggestedIds = getSuggestedIds(state);
        const alreadyRejected = event.type === 'REJECT_SUGGESTED_BLOCK' ? rejectedIds.has(event.proposalId) : false;
        state = computeDerivedState(state, event);
        events.push(event);

        assertPreviewConsistency(state);
        assertSignalsBounded(state);
        expect(snapshotProjections(state)).toEqual(snapshotProjections(state));

        if (event.type === 'SET_CALIBRATION_DAYS') {
          const repeat = computeDerivedState(state, event);
          expect(getSuggestedIds(repeat)).toEqual(getSuggestedIds(state));
        }

        if (event.type === 'REJECT_SUGGESTED_BLOCK') {
          const afterRejectEvents = (state.suggestionEvents || []).filter((e) => e.type === 'suggestion_rejected').length;
          if (alreadyRejected || beforeSuggestedIds.indexOf(event.proposalId) === -1) {
            expect(afterRejectEvents).toBe(beforeRejectEvents);
          } else {
            expect(afterRejectEvents).toBeGreaterThanOrEqual(beforeRejectEvents);
          }
          rejectedIds.add(event.proposalId);
        }

        const committed = getCommittedIds(state);
        const rejected = getRejectedIds(state);
        expect(committed.every((id) => acceptedIds.has(id))).toBe(true);
        expect(rejected.every((id) => rejectedIds.has(id))).toBe(true);
      }

      const replayed = applyEventSequence(buildOnboardingState(), events);
      expect(snapshotProjections(replayed)).toEqual(snapshotProjections(state));
    }
  });
});
