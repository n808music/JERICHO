import { beforeEach, describe, expect, it, vi } from 'vitest';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const cycleId = 'cycle-actions-1';
  const dayKey = '2026-03-10';
  return {
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: {
      weeklyWindows: { MON: [{ startHHMM: '09:00', endHHMM: '11:00' }] },
      dayEndAtHHMM: '23:59',
    },
    deliverablesByCycleId: {
      [cycleId]: {
        cycleId,
        deliverables: [{ id: 'd1', title: 'D1', estimateMin: 60 }],
        suggestionLinks: {},
        lastUpdatedAtISO: `${dayKey}T12:00:00.000Z`,
      },
    },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId: 'goal-1', startDayKey: dayKey, endDayKey: '2026-04-10' },
        planProof: {},
        actions: [{ id: 'act-canonical', title: 'Canonical Action', estimateMin: 60 }],
        llmActionGraph: { actions: [{ id: 'act-mirror', title: 'Mirror Action', estimateMin: 60 }] },
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId: 'goal-1', startDayKey: dayKey, endDayKey: '2026-04-10' },
    goalAdmissionByGoal: { 'goal-1': { status: 'ADMITTED', reasonCodes: [] } },
    lastPlanError: null,
  };
}

describe('GENERATE_PLAN canonical action precedence', () => {
  beforeEach(() => {
    compileAutoAsanaPlanMock.mockReset();
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-1',
          title: 'Canonical Action',
          dayKey: '2026-03-11',
          startISO: '2026-03-11T09:00:00.000Z',
          durationMinutes: 60,
        },
      ],
      conflicts: [],
    });
  });

  it('passes cycle.actions as canonical actionSequence when both action sources exist', () => {
    const next = computeDerivedState(buildState(), { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-actions-1' } });

    expect(compileAutoAsanaPlanMock).toHaveBeenCalledTimes(1);
    const input = compileAutoAsanaPlanMock.mock.calls[0][0];
    expect(input.actionSequence[0].id).toBe('act-canonical');
    expect(input.actionSequence[0].title).toBe('Canonical Action');
    expect(next.lastPlanError).toBeNull();
    expect((next.proposedBlocks || []).some((b) => b?.title === 'Canonical Action')).toBe(true);
  });

  it('preserves concrete materialized block titles over broad canonical action titles', () => {
    compileAutoAsanaPlanMock.mockReturnValueOnce({
      horizonBlocks: [
        {
          id: 'hb-1',
          title: 'Compare manufacturer MOQ, lead time, certifications, and sample cost',
          dayKey: '2026-03-11',
          startISO: '2026-03-11T09:00:00.000Z',
          durationMinutes: 60,
          actionId: 'act-canonical',
          deliverableId: 'd1',
          sessionIndex: 0,
        },
      ],
      conflicts: [],
    });

    const state = buildState();
    state.cyclesById['cycle-actions-1'].actions = [
      {
        id: 'act-canonical',
        title: 'Resolve gum formula, sample, and packaging readiness',
        estimateMin: 60,
        deliverableId: 'd1',
      },
    ];

    const next = computeDerivedState(state, { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-actions-1' } });

    expect(next.proposedBlocks[0].title).toBe('Compare manufacturer MOQ, lead time, certifications, and sample cost');
    expect(next.proposedBlocks[0].lineageTitle).toBe('Resolve gum formula, sample, and packaging readiness');
  });

  it('uses canonical cycle.goalContract over goalExecutionContract mirror during generation', () => {
    const state = buildState();
    state.cyclesById['cycle-actions-1'].goalContract.goalId = 'goal-canonical';
    state.goalExecutionContract.goalId = 'goal-mirror';

    const next = computeDerivedState(state, { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-actions-1' } });

    expect(compileAutoAsanaPlanMock).toHaveBeenCalledTimes(1);
    const input = compileAutoAsanaPlanMock.mock.calls[0][0];
    expect(input.goalId).toBe('goal-canonical');
    expect((next.proposedBlocks || []).every((block) => block?.goalId === 'goal-canonical')).toBe(true);
  });

  it('normalizes slash-format contract deadline into full-horizon generation window', () => {
    const state = buildState();
    state.cyclesById['cycle-actions-1'].goalContract = {
      goalId: 'goal-1',
      startDayKey: '2026-03-10',
      deadline: '06/30/2026',
    };
    state.goalExecutionContract = {
      goalId: 'goal-1',
      startDayKey: '2026-03-10',
      deadline: '06/30/2026',
    };

    computeDerivedState(state, { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-actions-1' } });

    expect(compileAutoAsanaPlanMock).toHaveBeenCalledTimes(1);
    const input = compileAutoAsanaPlanMock.mock.calls[0][0];
    expect(input.constraints.cycleEndDayKey).toBe('2026-06-30');
    expect(input.horizonDays).toBeGreaterThan(14);
  });

  it('uses long fallback horizon when deadline cannot be resolved', () => {
    const state = buildState();
    state.cyclesById['cycle-actions-1'].goalContract = {
      goalId: 'goal-1',
      startDayKey: '2026-03-10',
    };
    state.goalExecutionContract = {
      goalId: 'goal-1',
      startDayKey: '2026-03-10',
    };

    computeDerivedState(state, { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-actions-1' } });

    expect(compileAutoAsanaPlanMock).toHaveBeenCalledTimes(1);
    const input = compileAutoAsanaPlanMock.mock.calls[0][0];
    expect(input.constraints.cycleEndDayKey).toBeFalsy();
    expect(input.horizonDays).toBeGreaterThanOrEqual(90);
  });
});
