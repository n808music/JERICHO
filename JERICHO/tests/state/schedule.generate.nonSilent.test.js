import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGoalIntakeContract } from '../../src/domain/goal/GoalIntakeContract.ts';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildCanonicalGeneratedBlock(overrides = {}) {
  return {
    id: 'hb-1',
    title: 'Validate onboarding path for Operation Endgame app platform',
    dayKey: '2026-01-10',
    startISO: '2026-01-10T16:00:00.000Z',
    durationMinutes: 30,
    laneId: 'product',
    laneLabel: 'Operation Endgame app platform',
    entityId: 'global-state-systems',
    entityLabel: 'Global State Systems',
    phaseId: 'P1',
    phaseLabel: 'P1',
    workType: 'Validation',
    producesArtifact: 'Validated onboarding path report',
    passEvidence: 'Saved onboarding validation report with blocker status.',
    consumedBy: ['product:launch-readiness'],
    actionId: 'act-1',
    deliverableId: 'deliv-1',
    ...overrides,
  };
}

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

  it('records debug heartbeat and leaves generated proposals in preview until apply', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [buildCanonicalGeneratedBlock()],
      conflicts: [],
    });

    const next = computeDerivedState(buildState(), { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-1' } });

    const suggestedCount = (next.proposedBlocks || []).filter((s) => s.status === 'suggested').length;
    expect(suggestedCount).toBeGreaterThan(0);
    expect(next.lastPlanError).toBeNull();
    expect(next.scheduleApplied).toBe(false);
    expect(next.pendingPlanConfirmation).toBe(true);
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

  it('emits NO_ADMISSIBLE_PROPOSED_BLOCKS when generated blocks exist but all fail admission', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        buildCanonicalGeneratedBlock({
          id: 'hb-rejected-1',
          title: 'First revenue event',
          dayKey: '2026-01-12',
          startISO: '2026-01-12T16:00:00.000Z',
        }),
      ],
      conflicts: [],
    });

    const next = computeDerivedState(buildState(), { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-1' } });

    expect((next.proposedBlocks || []).length).toBeGreaterThan(0);
    expect((next.proposedBlocks || []).every((block) => block?.status === 'rejected')).toBe(true);
    expect(next.lastPlanError?.code).toBe('NO_ADMISSIBLE_PROPOSED_BLOCKS');
    expect(next.lastPlanError?.reasonCodes || []).toContain('MILESTONE_RENDERED_AS_EXECUTION_BLOCK');
    expect(next.debug?.lastGenerateResult?.proposedBlocksCount).toBe(0);
    expect(next.debug?.lastGenerateResult?.lastPlanErrorCode).toBe('NO_ADMISSIBLE_PROPOSED_BLOCKS');
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

  it('permits recovery generation when an active cycle has no visible canonical blocks', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [buildCanonicalGeneratedBlock({ id: 'hb-recovery-1' })],
      conflicts: [],
    });

    const state = buildState();
    state.cyclesById['cycle-1'].scheduleLifecycle = 'active_schedule';
    state.cyclesById['cycle-1'].scheduleReviewBlocks = [];
    state.scheduleLifecycle = 'active_schedule';
    state.scheduleReviewBlocks = [];
    state.blockStore = { blocks: {} };

    const next = computeDerivedState(state, { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-1' } });

    expect(next.lastPlanError).toBeNull();
    expect(next.scheduleLifecycle).toBe('draft_schedule_ready');
    expect((next.proposedBlocks || []).filter((s) => s.status === 'suggested')).toHaveLength(1);
    expect(next.debug?.lastGenerateResult?.proposedBlocksCount).toBeGreaterThan(0);
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

  it('blocks ambiguous podcast intake before compileAutoAsanaPlan runs', () => {
    const intakeContract = buildGoalIntakeContract({
      goalId: 'goal-1',
      rawGoalText: 'Create 6 episodes to publish by deadline',
      verificationCriteria: '6 episodes produced',
      executionType: 'CreativeProduction',
    });
    const next = computeDerivedState(
      {
        ...buildState(),
        cyclesById: {
          'cycle-1': {
            ...buildState().cyclesById['cycle-1'],
            goalContract: {
              ...buildState().cyclesById['cycle-1'].goalContract,
              goalIntakeContract: intakeContract,
            },
          },
        },
      },
      { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-1' } }
    );

    expect(next.lastPlanError?.code).toBe('INTAKE_BOUNDARY_AMBIGUOUS');
    expect(compileAutoAsanaPlanMock).not.toHaveBeenCalled();
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

  it('passes the live runtime floor to the scheduler instead of a stale persisted May 19 contract start', () => {
    // Freeze time to 2026-06-21 so that when E9 staleness fix refreshes appTime,
    // it gets the expected date (not dependent on actual wall-clock date)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-21T12:00:00.000Z'));

    try {
      compileAutoAsanaPlanMock.mockReturnValue({
        horizonBlocks: [
          buildCanonicalGeneratedBlock({
            id: 'hb-live-floor-1',
            title: 'Validate live runtime floor handling for Operation Endgame app platform',
            dayKey: '2026-06-21',
            startISO: '2026-06-21T16:00:00.000Z',
          }),
        ],
        conflicts: [],
      });

      const state = buildState();
      state.appTime = {
        timeZone: 'America/Chicago',
        nowISO: '2026-05-19T12:00:00.000Z',
        activeDayKey: '2026-06-15',
        isFollowingNow: true,
      };
      state.today = { ...state.today, date: '2026-05-19', blocks: [] };
      state.cyclesById['cycle-1'].goalContract.startDayKey = '2026-05-19';
      state.goalExecutionContract.startDayKey = '2026-05-19';

      const next = computeDerivedState(state, {
        type: 'GENERATE_PLAN',
        payload: { cycleId: 'cycle-1', anchorDayKey: '2026-05-19' },
      });

      expect(compileAutoAsanaPlanMock).toHaveBeenCalledTimes(1);
      const compileInput = compileAutoAsanaPlanMock.mock.calls[0][0];
      expect(compileInput.nowISO).toBe('2026-06-21T12:00:00.000Z');
      expect(compileInput.constraints.cycleStartDayKey).toBe('2026-06-21');
      expect((next.proposedBlocks || []).map((block) => block?.dayKey)).toContain('2026-06-21');
      expect((next.proposedBlocks || []).some((block) => String(block?.dayKey || '').startsWith('2026-05-19'))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
