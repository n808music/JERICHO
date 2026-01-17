import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../../state/identityCompute.js';
import { APP_TIME_ZONE } from '../../state/time/time.ts';

function seededRandom(seed = 0) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function buildMinimalState() {
  return {
    vector: { day: 1, direction: 'Test', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [] }, flow: { streams: [] } },
    today: { date: '2026-01-10', blocks: [] },
    currentWeek: { weekStart: '2026-01-10', days: [] },
    cycle: [],
    templates: { objectives: {} },
    stability: {},
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    lastAdaptedDate: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    planDraft: null,
    planPreview: null,
    planCalibration: null,
    correctionSignals: null,
    cyclesById: {},
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    appTime: { timeZone: APP_TIME_ZONE, nowISO: '2026-01-10T00:00:00.000Z', activeDayKey: '2026-01-10', isFollowingNow: true },
    suggestionHistory: { dayKey: '2026-01-10', count: 0, lastSuggestedAtISO: null, lastSuggestedAtISOByGoal: {}, dailyCountByGoal: {}, denials: [] },
    directiveEligibilityByGoal: {},
    goalDirective: null
  };
}

const actionGenerators = [
  (state, rng) => {
    if (!state.activeCycleId) return null;
    const hour = 8 + Math.floor(rng() * 7);
    return {
      type: 'CREATE_BLOCK',
      payload: {
        start: `2026-01-10T${String(hour).padStart(2, '0')}:00:00.000Z`,
        durationMinutes: 30,
        domain: 'CREATION',
        title: `Block ${hour}`
      }
    };
  },
  (state, rng) => {
    if (!state.activeCycleId) return null;
    const hour = 8 + Math.floor(rng() * 7);
    return {
      type: 'DRAFT_BLOCK_CREATE',
      blockId: `draft-${Math.floor(rng() * 1000)}`,
      startISO: `2026-01-10T${String(hour).padStart(2, '0')}:30:00.000Z`,
      endISO: `2026-01-10T${String(hour + 1).padStart(2, '0')}:00:00.000Z`,
      status: 'planned'
    };
  },
  () => ({ type: 'START_NEW_CYCLE', payload: { goalText: 'Prop test cycle', deadlineDayKey: '2026-02-01' } }),
  (state) => (state.activeCycleId ? { type: 'END_CYCLE', cycleId: state.activeCycleId } : null),
  (state, rng) => (state.activeCycleId ? { type: 'ARCHIVE_AND_CLONE_CYCLE', cycleId: state.activeCycleId, overrides: { narrative: `Archived ${rng()}` } } : null),
  (state) => (state.activeCycleId ? { type: 'DELETE_CYCLE', cycleId: state.activeCycleId } : null)
];

function pickAction(state, rng) {
  for (let attempt = 0; attempt < actionGenerators.length; attempt += 1) {
    const generator = actionGenerators[Math.floor(rng() * actionGenerators.length)];
    const action = generator(state, rng);
    if (action) return action;
  }
  return null;
}

function assertActiveCycleBlocks(state) {
  const activeCycleId = state.activeCycleId;
  if (!activeCycleId) {
    expect(state.today?.blocks?.length || 0).toBe(0);
    return;
  }
  (state.today?.blocks || []).forEach((block) => {
    expect(block?.cycleId).toBe(activeCycleId);
  });
}

function assertOrphanCreates(state) {
  const eventMap = new Map(state.executionEvents?.map((event) => [`${event.kind}:${event.blockId}`, event]));
  (state.today?.blocks || []).forEach((block) => {
    const match = eventMap.get(`create:${block.id}`) || state.executionEvents?.find((event) => event.blockId === block.id && event.kind === 'create');
    expect(match).toBeTruthy();
  });
}

function assertUniqueDraftIds(state) {
  const drafts = (state.executionEvents || []).filter((event) => event.origin === 'draft');
  const ids = drafts.map((event) => event.blockId);
  expect(new Set(ids).size).toBe(ids.length);
}

describe('Cycle boundary property invariants', () => {
  it('remains deterministic and cycle-scoped across action sequences', () => {
    const rng = seededRandom(42);
    for (let run = 0; run < 20; run += 1) {
      let state = computeDerivedState(buildMinimalState(), {
        type: 'COMPLETE_ONBOARDING',
        onboarding: {
          direction: 'Property Test',
          goalText: 'Stability goal',
          horizon: '30d',
          narrative: 'Guard cycles',
          focusAreas: ['Creation'],
          successDefinition: 'Done',
          minimumDaysPerWeek: 2
        }
      });
      const steps = 12;
      for (let step = 0; step < steps; step += 1) {
        const action = pickAction(state, rng);
        if (!action) continue;
        const first = computeDerivedState(state, action);
        const second = computeDerivedState(state, action);
        const sanitizeEvent = ({ kind, startISO, endISO, dateISO, status, placementState, cycleId, origin, minutes }) => ({
          kind,
          startISO,
          endISO,
          dateISO,
          status,
          placementState,
          cycleId,
          origin,
          minutes
        });
        const snapshot = (value) => ({
          executionEvents: (value.executionEvents || []).map(sanitizeEvent),
          todayBlocks: (value.today?.blocks || []).map((block) => ({
            start: block?.start,
            end: block?.end,
            cycleId: block?.cycleId,
            status: block?.status,
            placementState: block?.placementState,
            origin: block?.origin,
            domain: block?.domain
          })),
          currentWeek: (value.currentWeek?.days || []).map((day) => ({
            date: day?.date,
            blockCount: (day?.blocks || []).length
          })),
          activeCycleId: value.activeCycleId
        });
        expect(snapshot(first)).toEqual(snapshot(second));
        assertActiveCycleBlocks(first);
        assertOrphanCreates(first);
        assertUniqueDraftIds(first);
        state = first;
      }
    }
  });
});
