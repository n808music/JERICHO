import { beforeEach, describe, expect, it, vi } from 'vitest';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState({ status = 'active', withPlanProof = true } = {}) {
  const dayKey = '2026-01-10';
  const cycleId = 'cycle-1';
  const goalId = 'goal-1';
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
    constraints: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status,
        goalContract: { goalId, startDayKey: dayKey, endDayKey: '2026-02-15' },
        planProof: withPlanProof ? {} : null,
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: dayKey, endDayKey: '2026-02-15' },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
  };
}

describe('schedule generation non-silent deterministic behavior', () => {
  beforeEach(() => {
    compileAutoAsanaPlanMock.mockReset();
  });

  it('records debug heartbeat and clears error when generation yields proposals', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-1',
          title: 'Focus session',
          dayKey: '2026-01-10',
          startISO: '2026-01-10T16:00:00.000Z',
          durationMinutes: 30,
        },
      ],
      conflicts: [],
    });

    const next = computeDerivedState(buildState(), { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-1' } });

    const proposedCount = (next.proposedBlocks || []).filter((s) => s.status === 'suggested').length;
    expect(proposedCount).toBeGreaterThan(0);
    expect(next.lastPlanError).toBeNull();
    expect(next.debug?.lastGenerateClickCycleId).toBe('cycle-1');
    expect(next.debug?.lastGenerateResult?.proposedBlocksCount).toBeGreaterThan(0);
    expect(next.debug?.lastGenerateResult?.lastPlanErrorCode).toBeNull();
  });

  it('emits NO_PROPOSED_BLOCKS when generation yields zero suggestions', () => {
    compileAutoAsanaPlanMock.mockReturnValue({ horizonBlocks: [], conflicts: [] });

    const next = computeDerivedState(buildState(), { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-1' } });

    expect(next.lastPlanError?.code).toBe('NO_PROPOSED_BLOCKS');
    expect(next.lastPlanError?.reasonCodes).toContain('UNSCHEDULABLE');
    expect(next.debug?.lastGenerateResult?.proposedBlocksCount).toBe(0);
    expect(next.debug?.lastGenerateResult?.lastPlanErrorCode).toBe('NO_PROPOSED_BLOCKS');
  });

  it('emits CYCLE_READ_ONLY for ended/archived cycle targets', () => {
    const next = computeDerivedState(buildState({ status: 'ended' }), {
      type: 'GENERATE_PLAN',
      payload: { cycleId: 'cycle-1' },
    });

    expect(next.lastPlanError?.code).toBe('CYCLE_READ_ONLY');
    expect(next.lastPlanError?.cycleId).toBe('cycle-1');
    expect(next.debug?.lastGenerateResult?.lastPlanErrorCode).toBe('CYCLE_READ_ONLY');
  });

  it('emits CYCLE_TARGET_INVALID when target cycle cannot be resolved', () => {
    const next = computeDerivedState(buildState(), { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-missing' } });

    expect(next.lastPlanError?.code).toBe('CYCLE_TARGET_INVALID');
    expect(next.debug?.lastGenerateResult?.lastPlanErrorCode).toBe('CYCLE_TARGET_INVALID');
  });

  it('uses NO_ACTION_GRAPH reason when no plan proof is present', () => {
    compileAutoAsanaPlanMock.mockReturnValue({ horizonBlocks: [], conflicts: [] });
    const next = computeDerivedState(buildState({ withPlanProof: false }), {
      type: 'GENERATE_PLAN',
      payload: { cycleId: 'cycle-1' },
    });

    expect(next.lastPlanError?.code).toBe('NO_ACTION_GRAPH');
    expect(next.lastPlanError?.reasonCodes).toContain('NO_ACTION_GRAPH');
  });

  it('updates debug heartbeat on each generate click', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [],
      conflicts: [{ code: 'NO_ALLOWED_WINDOWS' }],
    });
    const first = computeDerivedState(buildState(), { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-1' } });
    expect(first.debug?.lastGenerateClickAtISO).toBe('2026-01-10T12:00:00.000Z');
    expect(first.debug?.lastGenerateResult?.lastPlanErrorCode).toBe('NO_PROPOSED_BLOCKS');
    expect(first.debug?.lastGenerateResult?.proposedBlocksCount).toBe(0);

    const secondState = {
      ...first,
      appTime: { ...first.appTime, nowISO: '2026-01-11T12:00:00.000Z', activeDayKey: '2026-01-11' },
    };
    const second = computeDerivedState(secondState, { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-1' } });
    expect(second.debug?.lastGenerateClickAtISO).toBe('2026-01-11T12:00:00.000Z');
    expect(second.debug?.lastGenerateClickCycleId).toBe('cycle-1');
  });
});
