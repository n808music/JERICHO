import { beforeEach, describe, expect, it, vi } from 'vitest';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildAdmittedState() {
  const cycleId = 'cycle-accepted-1';
  const goalId = 'goal-accepted-1';
  const dayKey = '2026-03-10';
  return {
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: dayKey, days: [], metrics: {} },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    planDraft: null,
    constraints: {
      weeklyWindows: {
        MON: [{ startHHMM: '13:00', endHHMM: '14:00' }],
      },
      dayEndAtHHMM: '23:59',
    },
    deliverablesByCycleId: {
      [cycleId]: {
        cycleId,
        deliverables: [{ id: 'deliv-1', title: 'D1', estimateMin: 60 }],
        suggestionLinks: {},
        lastUpdatedAtISO: `${dayKey}T12:00:00.000Z`,
      },
    },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: {
          goalId,
          startDayKey: '2026-03-10',
          endDayKey: '2026-03-31',
          workWindows: {
            mon: [{ start: '08:00', end: '10:00' }],
            tue: [],
            wed: [],
            thu: [],
            fri: [],
            sat: [],
            sun: [],
          },
        },
        planProof: {},
        actions: [{ id: 'act-1', title: 'A1', estimateMin: 60 }],
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-10', endDayKey: '2026-03-31' },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    lastPlanError: null,
  };
}

describe('accepted-state work windows canonical chain', () => {
  beforeEach(() => {
    compileAutoAsanaPlanMock.mockReset();
  });

  it('UPDATE_WORK_WINDOWS persists canonical windows and generate reads canonical over stale state windows', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-1',
          title: 'Canonical window block',
          dayKey: '2026-03-10',
          startISO: '2026-03-10T08:00:00.000Z',
          durationMinutes: 60,
        },
      ],
      conflicts: [],
    });

    const saved = computeDerivedState(buildAdmittedState(), {
      type: 'UPDATE_WORK_WINDOWS',
      payload: {
        cycleId: 'cycle-accepted-1',
        workWindows: {
          mon: [{ start: '07:00', end: '09:00' }],
          tue: [],
          wed: [],
          thu: [],
          fri: [],
          sat: [],
          sun: [],
        },
      },
    });

    expect(saved.cyclesById['cycle-accepted-1'].goalContract.workWindows.mon).toEqual([
      { start: '07:00', end: '09:00' },
    ]);
    expect(saved.goalExecutionContract.workWindows.mon).toEqual([{ start: '07:00', end: '09:00' }]);

    const generated = computeDerivedState(saved, {
      type: 'GENERATE_PLAN',
      payload: { cycleId: 'cycle-accepted-1' },
    });

    expect(compileAutoAsanaPlanMock).toHaveBeenCalledTimes(1);
    const compileInput = compileAutoAsanaPlanMock.mock.calls[0][0];
    expect(compileInput.constraints.weeklyWindows.MON).toEqual([{ startHHMM: '07:00', endHHMM: '09:00' }]);
    expect((generated.proposedBlocks || []).filter((b) => b?.status === 'suggested').length).toBeGreaterThan(0);
    expect(generated.scheduleApplied).toBe(false);
    expect(generated.pendingPlanConfirmation).toBe(true);
    expect(generated.scheduleLifecycle).toBe('draft_schedule_ready');
    expect(generated.lastPlanError).toBeNull();
  });

  it('GENERATE_PLAN leaves canonical proposed blocks in preview until apply', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-accepted-1',
          title: 'Accepted flow block',
          dayKey: '2026-03-10',
          startISO: '2026-03-10T08:00:00.000Z',
          durationMinutes: 60,
        },
      ],
      conflicts: [],
    });

    const generated = computeDerivedState(buildAdmittedState(), {
      type: 'GENERATE_PLAN',
      payload: { cycleId: 'cycle-accepted-1' },
    });
    const suggested = (generated.proposedBlocks || []).find((b) => b?.id === 'hb-accepted-1');
    expect(suggested?.status).toBe('suggested');
    expect(
      (generated.executionEvents || []).some(
        (event) => event?.kind === 'create' && event?.cycleId === 'cycle-accepted-1'
      )
    ).toBe(false);
    expect(generated.scheduleApplied).toBe(false);
    expect(generated.pendingPlanConfirmation).toBe(true);

    const applied = computeDerivedState(generated, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-accepted-1' },
    });
    const accepted = (applied.proposedBlocks || []).find((b) => b?.id === 'hb-accepted-1');
    expect(accepted?.status).toBe('accepted');
    expect(
      (applied.executionEvents || []).some((event) => event?.kind === 'create' && event?.cycleId === 'cycle-accepted-1')
    ).toBe(false);
    expect(applied.scheduleApplied).toBe(true);

    const activated = computeDerivedState(applied, {
      type: 'ACTIVATE_SCHEDULE',
      payload: { cycleId: 'cycle-accepted-1' },
    });
    expect(activated.scheduleLifecycle).toBe('active_schedule');
    expect(
      (activated.executionEvents || []).some(
        (event) => event?.kind === 'create' && event?.cycleId === 'cycle-accepted-1'
      )
    ).toBe(true);
  });

  it('falls back to deterministic no-proposal error when cycle goalId cannot bind proposals', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [],
      conflicts: [],
    });
    const state = buildAdmittedState();
    state.cyclesById['cycle-accepted-1'].goalContract.goalId = null;
    state.goalExecutionContract = null;
    state.goalAdmissionByGoal = {};

    const generated = computeDerivedState(state, {
      type: 'GENERATE_PLAN',
      payload: { cycleId: 'cycle-accepted-1' },
    });

    expect(generated.lastPlanError?.code).toBe('NO_PROPOSED_BLOCKS');
    expect((generated.proposedBlocks || []).length).toBe(0);
  });
});
