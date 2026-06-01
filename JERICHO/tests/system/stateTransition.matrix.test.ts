import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { stableParse, stableStringify } from '../../src/utils/stableStringify.ts';
import { buildBaseState, FIXED_DAY, seedScenario } from './_helpers.ts';

function assertNoDuplicateCheckpoints(state: any) {
  const byMilestone = state?.planPreview?.pacingInjectedByMilestone || {};
  Object.values<any>(byMilestone).forEach((entry) => {
    const ids = entry?.ids || [];
    expect(new Set(ids).size).toBe(ids.length);
  });
}

function assertEndedOnlyHistory(state: any) {
  const byId = state.historySignalsByCycleId || {};
  Object.keys(byId).forEach((cycleId) => {
    const cycle = state.cyclesById?.[cycleId];
    if (!cycle) return;
    expect(Boolean(cycle.status === 'ended')).toBe(true);
  });
}

function assertParity(state: any) {
  if ('policySelectionParity' in state) expect(state.policySelectionParity).not.toBe(false);
  if ('scoreParity' in state) expect(state.scoreParity).not.toBe(false);
  if ('pacingParity' in state) expect(state.pacingParity).not.toBe(false);
}

describe('state transition matrix', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FIXED_DAY}T12:00:00.000Z`));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('preserves invariants across core transitions', () => {
    const state0 = seedScenario({
      autoPolicySelection: true,
      enableHistoryPolicySelection: true,
      enableMilestonePacing: true,
    });
    const cycleId = state0.activeCycleId;

    const transitions = [
      { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 5 },
      { type: 'APPLY_DRAFT_SCHEDULE' },
      { type: 'END_CYCLE', cycleId },
      { type: 'START_NEW_CYCLE', payload: { goalText: 'Next cycle', horizonDays: 60 } },
    ] as any[];

    let state = state0;
    const endedSignalsBefore = stableParse(state.historySignalsByCycleId || {});
    transitions.forEach((action) => {
      state = computeDerivedState(state, action);
      assertParity(state);
      assertNoDuplicateCheckpoints(state);
      assertEndedOnlyHistory(state);
    });

    Object.keys(endedSignalsBefore).forEach((id) => {
      if (state.historySignalsByCycleId?.[id]) {
        expect(stableStringify(state.historySignalsByCycleId[id])).toBe(stableStringify(endedSignalsBefore[id]));
      }
    });
  });

  it('covers delete and hard-delete transitions explicitly', () => {
    const seeded = seedScenario({ autoPolicySelection: true, enableHistoryPolicySelection: true });
    const cycleId = seeded.activeCycleId;
    const ended = computeDerivedState(seeded, { type: 'END_CYCLE', cycleId });

    const restarted = computeDerivedState(ended, {
      type: 'START_NEW_CYCLE',
      payload: { goalText: 'Delete path', horizonDays: 60 },
    });
    const deleted = computeDerivedState(restarted, { type: 'DELETE_CYCLE', cycleId });
    assertEndedOnlyHistory(deleted);

    const seeded2 = seedScenario({ autoPolicySelection: true, enableHistoryPolicySelection: true });
    const cycleId2 = seeded2.activeCycleId;
    const ended2 = computeDerivedState(seeded2, { type: 'END_CYCLE', cycleId: cycleId2 });
    const restarted2 = computeDerivedState(ended2, {
      type: 'START_NEW_CYCLE',
      payload: { goalText: 'Hard delete path', horizonDays: 60 },
    });
    const hardDeleted = computeDerivedState(restarted2, { type: 'HARD_DELETE_CYCLE', cycleId: cycleId2 });
    assertEndedOnlyHistory(hardDeleted);
  });

  it('replays an execution log to identical final state', () => {
    const base = computeDerivedState(buildBaseState(), { type: 'SET_VIEW_DATE', date: FIXED_DAY });
    const log: any[] = [
      {
        type: 'COMPLETE_ONBOARDING',
        onboarding: {
          direction: 'Replay',
          goalText: 'Replay',
          horizon: '90d',
          narrative: '',
          focusAreas: ['Creation', 'Focus'],
          successDefinition: 'Replay proof',
        },
      },
      { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 5 },
      { type: 'SET_CALIBRATION_DAYS', daysPerWeek: 5 },
      { type: 'APPLY_DRAFT_SCHEDULE' },
    ];

    const run = () => log.reduce((s, a) => computeDerivedState(s, a), base);
    const finalA = run();
    const finalB = run();

    expect(stableStringify(finalA)).toBe(stableStringify(finalB));
  });
});
