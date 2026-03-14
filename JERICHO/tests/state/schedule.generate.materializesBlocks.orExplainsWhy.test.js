import { beforeEach, describe, expect, it, vi } from 'vitest';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const dayKey = '2026-03-02';
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
    constraints: {
      weeklyWindows: {
        MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        WED: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        THU: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        FRI: [{ startHHMM: '09:00', endHHMM: '12:00' }],
      },
      dayEndAtHHMM: '23:59',
    },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId, startDayKey: dayKey, endDayKey: '2026-03-20' },
        planProof: {},
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: dayKey, endDayKey: '2026-03-20' },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
  };
}

describe('GENERATE_PLAN materializes blocks or explains why', () => {
  beforeEach(() => {
    compileAutoAsanaPlanMock.mockReset();
  });

  it('is non-silent: proposals exist or deterministic NO_PROPOSED_BLOCKS with reasonCodes', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [],
      conflicts: [{ code: 'NO_ALLOWED_WINDOWS' }],
    });

    const next = computeDerivedState(buildState(), { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-1' } });
    expect((next.proposedBlocks || []).filter((b) => b?.status === 'accepted').length).toBe(0);
    expect(next.scheduleApplied).toBe(false);
    expect(next.lastPlanError?.code).toBe('NO_PROPOSED_BLOCKS');
    expect(Array.isArray(next.lastPlanError?.reasonCodes)).toBe(true);
    expect(next.lastPlanError.reasonCodes.length).toBeGreaterThan(0);
  });

  it('materialized proposals clear lastPlanError', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-1',
          title: 'Focus block',
          dayKey: '2026-03-03',
          startISO: '2026-03-03T09:00:00.000Z',
          durationMinutes: 60,
        },
      ],
      conflicts: [],
    });

    const next = computeDerivedState(buildState(), { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-1' } });
    expect((next.proposedBlocks || []).some((b) => b?.status === 'accepted')).toBe(true);
    expect(next.scheduleApplied).toBe(true);
    expect(next.lastPlanError).toBeNull();
  });
});
