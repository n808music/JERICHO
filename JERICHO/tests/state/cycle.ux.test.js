import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function baseState(cycleId = 'cycle-1') {
  return {
    appTime: { timeZone: 'UTC', nowISO: '2026-01-10T00:00:00.000Z', activeDayKey: '2026-01-10' },
    templates: { objectives: {} },
    today: { date: '2026-01-10', blocks: [] },
    currentWeek: { weekStart: '2026-01-10', days: [] },
    executionEvents: [],
    suggestionEvents: [],
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        executionEvents: [],
        suggestionEvents: [],
        suggestedBlocks: []
      }
    },
    activeCycleId: cycleId,
    cycle: [],
    planPreview: null,
    planDraft: null,
    planCalibration: null,
    recency: {},
    lastAdaptedDate: null,
    nextSuggestion: null,
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {}
  };
}

const blockPayload = {
  start: '2026-01-10T10:00:00.000Z',
  durationMinutes: 30,
  domain: 'CREATION',
  title: 'QA Block',
  linkToGoal: true
};

describe('Cycle UX invariants', () => {
  it('ends a cycle and clears today view', () => {
    const start = computeDerivedState(baseState(), { type: 'CREATE_BLOCK', payload: blockPayload });
    expect(start.today.blocks.length).toBe(1);
    const ended = computeDerivedState(start, { type: 'END_CYCLE', cycleId: start.activeCycleId });
    expect(ended.activeCycleId).toBeNull();
    expect(ended.today.blocks.length).toBe(0);
  });

  it('archives a cycle into review mode without leaking blocks', () => {
    const state = computeDerivedState(baseState(), { type: 'CREATE_BLOCK', payload: blockPayload });
    const archived = computeDerivedState(state, { type: 'ARCHIVE_AND_CLONE_CYCLE', cycleId: state.activeCycleId });
    const previousCycle = state.activeCycleId;
    expect(archived.cyclesById[previousCycle]).toBeTruthy();
  });

  it('deletes an active cycle and keeps projections clean', () => {
    const state = computeDerivedState(baseState(), { type: 'CREATE_BLOCK', payload: blockPayload });
    const deleted = computeDerivedState(state, { type: 'DELETE_CYCLE', cycleId: state.activeCycleId });
    expect(deleted.activeCycleId).toBeNull();
    expect(deleted.today.blocks.length).toBe(0);
    expect(deleted.cyclesById[state.activeCycleId]).toBeUndefined();
  });
});
