import { describe, it, expect } from 'vitest';
import { identityReducer } from '../../src/state/identityStore.js';

function baseState() {
  return {
    vector: { day: 1, direction: 'Test goal', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: 'Aim', horizon: '90d' },
      pattern: {
        dailyTargets: [
          { name: 'Body', minutes: 10 },
          { name: 'Resources', minutes: 20 },
          { name: 'Creation', minutes: 30 },
          { name: 'Focus', minutes: 40 }
        ]
      },
      flow: { streams: [] }
    },
    activeCycleId: null,
    cyclesById: {},
    history: { cycles: [] },
    today: { date: '2025-12-09', blocks: [] },
    currentWeek: { weekStart: '2025-12-09', days: [] },
    cycle: [],
    meta: { version: '1.0.0' },
    ledger: []
  };
}

function getActiveCycle(state) {
  return state.activeCycleId ? state.cyclesById[state.activeCycleId] : null;
}

function withActiveCycle(state) {
  const cycleId = 'cycle-1';
  return {
    ...state,
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        startedAtDayKey: state.today?.date || '2025-12-09',
        definiteGoal: { outcome: 'Test goal', deadlineDayKey: '2025-12-31' },
        pattern: { dailyTargets: state.lenses?.pattern?.dailyTargets || [] }
      }
    }
  };
}

describe('identityReducer cycle semantics', () => {
  it('updates the current cycle contract on SET_DEFINITE_GOAL', () => {
    const state0 = withActiveCycle(baseState());
    const state1 = identityReducer(state0, {
      type: 'SET_DEFINITE_GOAL',
      outcome: 'Definite goal',
      deadlineDayKey: '2025-12-31'
    });

    expect(state1.activeCycleId).toBe(state0.activeCycleId);
    const cycle = getActiveCycle(state1);
    expect(cycle.definiteGoal.outcome).toBe('Definite goal');
    expect(cycle.definiteGoal.deadlineDayKey).toBe('2025-12-31');
    expect(state1.history.cycles.length).toBe(0);
  });

  it('SET_AIM updates aim without changing cycle', () => {
    const state0 = withActiveCycle(baseState());
    const idBefore = state0.activeCycleId;

    const state1 = identityReducer(state0, { type: 'SET_AIM', text: 'New aim' });
    expect(state1.activeCycleId).toBe(idBefore);
    expect(getActiveCycle(state1).aim?.text).toBe('New aim');
    expect(state1.history.cycles.length).toBe(0);
  });

  it('SET_PATTERN_TARGETS sanitizes and keeps all 4 domains', () => {
    const state0 = withActiveCycle(baseState());
    const state1 = identityReducer(state0, {
      type: 'SET_PATTERN_TARGETS',
      dailyTargets: [
        { name: 'Body', minutes: 15 },
        { name: 'Resources', minutes: -5 },
        { name: 'Creation', minutes: 'abc' },
        { name: 'Focus', minutes: 25 }
      ]
    });

    const targets = getActiveCycle(state1).pattern.dailyTargets;
    const map = Object.fromEntries(targets.map((t) => [t.name, t.minutes]));
    expect(map.Body).toBe(15);
    expect(map.Resources).toBe(0);
    expect(map.Creation).toBe(0);
    expect(map.Focus).toBe(25);
  });
});
