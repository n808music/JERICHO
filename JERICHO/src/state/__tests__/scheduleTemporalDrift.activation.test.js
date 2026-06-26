import { describe, expect, it } from 'vitest';
import { computeDerivedState, resolveFirstCycleScheduleStart } from '../identityCompute.js';

function buildAppliedReviewState({
  nowDayKey = '2026-05-26',
  blockDayKey = '2026-05-19',
  generatedAtISO = '2026-05-19T12:00:00.000Z',
} = {}) {
  const cycleId = 'cycle-1';
  const goalId = 'goal-1';
  return {
    today: { date: nowDayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: nowDayKey, days: [] },
    cycle: [],
    executionEvents: [],
    scheduleReviewBlocks: [
      {
        id: 'blk-review-1',
        cycleId,
        goalId,
        title: 'Validate onboarding path',
        label: 'Validate onboarding path',
        start: `${blockDayKey}T09:00:00.000Z`,
        end: `${blockDayKey}T10:00:00.000Z`,
        startISO: `${blockDayKey}T09:00:00.000Z`,
        endISO: `${blockDayKey}T10:00:00.000Z`,
        durationMinutes: 60,
        status: 'planned',
        origin: 'schedule_review',
      },
    ],
    appTime: {
      nowISO: `${nowDayKey}T12:00:00.000Z`,
      activeDayKey: nowDayKey,
      timeZone: 'UTC',
      isFollowingNow: true,
    },
    activeCycleId: cycleId,
    activeGoalId: goalId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        scheduleLifecycle: 'applied_review',
        scheduleReviewBlocks: [
          {
            id: 'blk-review-1',
            cycleId,
            goalId,
            title: 'Validate onboarding path',
            label: 'Validate onboarding path',
            start: `${blockDayKey}T09:00:00.000Z`,
            end: `${blockDayKey}T10:00:00.000Z`,
            startISO: `${blockDayKey}T09:00:00.000Z`,
            endISO: `${blockDayKey}T10:00:00.000Z`,
            durationMinutes: 60,
            status: 'planned',
            origin: 'schedule_review',
          },
        ],
        scheduleGeneratedAtISO: generatedAtISO,
        goalContract: {
          goalId,
          startDayKey: '2026-05-19',
          endDayKey: '2026-06-15',
        },
      },
    },
    goalExecutionContract: {
      goalId,
      startDayKey: '2026-05-19',
      endDayKey: '2026-06-15',
    },
    blockStore: { blocks: {} },
  };
}

describe('schedule temporal drift activation gate', () => {
  it('blocks delayed activation for user investigation when an applied schedule has unverified past work', () => {
    const next = computeDerivedState(
      buildAppliedReviewState({
        nowDayKey: '2026-05-26',
        blockDayKey: '2026-05-19',
        generatedAtISO: '2026-05-19T08:00:00.000Z',
      }),
      { type: 'ACTIVATE_SCHEDULE' }
    );

    next.cyclesById['cycle-1'].scheduleAppliedAtISO = '2026-05-19T13:00:00.000Z';
    const blocked = computeDerivedState(next, { type: 'ACTIVATE_SCHEDULE' });

    expect(blocked.lastPlanError?.code).toBe('ACTIVATION_DELAY_REASSESSMENT_REQUIRED');
    expect(blocked.lastPlanError?.reasonCodes || []).toEqual(
      expect.arrayContaining([
        'ACTIVATION_DELAY_REASSESSMENT_REQUIRED',
        'APPLIED_TO_ACTIVATION_GAP_DETECTED',
        'USER_CONFIRMATION_REQUIRED_FOR_DELAY_WINDOW',
        'DELAY_WINDOW_EXECUTION_UNKNOWN',
      ])
    );
    expect(blocked.cyclesById['cycle-1'].activationDelayAssessment).toMatchObject({
      status: 'requires_user_investigation',
      appliedStartDayKey: '2026-05-19',
      requestedExecutionStartDayKey: '2026-05-26',
      workHappenedDuringDelay: 'unknown',
    });
    expect(blocked.scheduleLifecycle).toBe('applied_review');
  });

  it('blocks activation when review blocks are dated before the activation day', () => {
    const next = computeDerivedState(buildAppliedReviewState(), { type: 'ACTIVATE_SCHEDULE' });

    expect(next.scheduleLifecycle).toBe('applied_review');
    expect(next.cyclesById['cycle-1'].scheduleLifecycle).toBe('applied_review');
    expect(next.lastPlanError?.code).toBe('SCHEDULE_REBASE_REQUIRED');
    expect(next.lastPlanError?.reasonCodes || []).toEqual(
      expect.arrayContaining([
        'PAST_DATED_UNEXECUTED_BLOCKS',
        'ACTIVATION_REANCHOR_REQUIRED',
        'SCHEDULE_REBASE_REQUIRED',
        'GENERATED_SCHEDULE_STALE',
      ])
    );
    expect(next.cyclesById['cycle-1'].temporalStatus).toBe('rebase_required');
    expect(next.cyclesById['cycle-1'].reassessmentStatus).toBe('required');
  });

  it('allows activation when the applied review block is still forward-valid', () => {
    const next = computeDerivedState(
      buildAppliedReviewState({
        nowDayKey: '2026-05-19',
        blockDayKey: '2026-05-19',
        generatedAtISO: '2026-05-19T08:00:00.000Z',
      }),
      { type: 'ACTIVATE_SCHEDULE' }
    );

    expect(next.lastPlanError).toBeNull();
    expect(next.scheduleLifecycle).toBe('active_schedule');
    expect((next.executionEvents || []).some((event) => event?.kind === 'create' && event?.blockId === 'blk-review-1')).toBe(
      true
    );
  });
});

describe('activation-date reassessment and calendar re-anchor (May 19 → May 28)', () => {
  function buildAppliedState519() {
    const state = buildAppliedReviewState({
      nowDayKey: '2026-05-28',
      blockDayKey: '2026-05-19',
      generatedAtISO: '2026-05-19T08:00:00.000Z',
    });
    state.cyclesById['cycle-1'].scheduleAppliedAtISO = '2026-05-19T13:00:00.000Z';
    state.cyclesById['cycle-1'].goalContract = {
      goalId: 'goal-1',
      startDayKey: '2026-05-19',
      endDayKey: '2026-07-01',
      workWindows: { mon: [{ start: '09:00', end: '10:00' }], tue: [{ start: '09:00', end: '10:00' }], wed: [{ start: '09:00', end: '10:00' }], thu: [{ start: '09:00', end: '10:00' }], fri: [{ start: '09:00', end: '10:00' }] },
    };
    return state;
  }

  it('May 19 schedule activated May 28 triggers activation-delay reassessment question', () => {
    const next = computeDerivedState(buildAppliedState519(), { type: 'ACTIVATE_SCHEDULE' });

    expect(next.lastPlanError?.code).toBe('ACTIVATION_DELAY_REASSESSMENT_REQUIRED');
    expect(next.cyclesById['cycle-1'].activationDelayAssessment).toMatchObject({
      status: 'requires_user_investigation',
      appliedStartDayKey: '2026-05-19',
      requestedExecutionStartDayKey: '2026-05-28',
    });
  });

  it('May 19 schedule cannot activate silently on May 28', () => {
    const next = computeDerivedState(buildAppliedState519(), { type: 'ACTIVATE_SCHEDULE' });

    expect(next.scheduleLifecycle).not.toBe('active_schedule');
    expect(next.cyclesById['cycle-1'].scheduleLifecycle).not.toBe('active_schedule');
    expect((next.executionEvents || []).filter((e) => e?.kind === 'create')).toHaveLength(0);
  });

  it('May 19 schedule does not populate pre-activation calendar blocks during delay reassessment', () => {
    const next = computeDerivedState(buildAppliedState519(), { type: 'ACTIVATE_SCHEDULE' });

    const allDays = Array.isArray(next.cycle) ? next.cycle : [];
    const preActivationDays = allDays.filter((day) => day?.date && day.date < '2026-05-28');
    const preActivationBlocks = preActivationDays.flatMap((day) =>
      (day.blocks || []).filter((b) => b?.origin === 'schedule_review' || b?.origin === 'schedule_active')
    );
    expect(preActivationBlocks).toHaveLength(0);
  });

  it('Selecting None happened rebases unexecuted blocks to May 28 or later', () => {
    const blocked = computeDerivedState(buildAppliedState519(), { type: 'ACTIVATE_SCHEDULE' });
    expect(blocked.lastPlanError?.code).toBe('ACTIVATION_DELAY_REASSESSMENT_REQUIRED');

    const rebased = computeDerivedState(blocked, {
      type: 'REBASE_SCHEDULE',
      payload: {
        cycleId: 'cycle-1',
        executionStartDayKey: '2026-05-28',
        activationDelayResolution: 'rebase',
        workHappenedDuringDelay: 'none',
      },
    });

    const reviewBlocks = rebased.cyclesById['cycle-1']?.scheduleReviewBlocks || [];
    expect(reviewBlocks.length).toBeGreaterThan(0);
    const allForward = reviewBlocks.every((b) => {
      const dk = b?.dayKey || (b?.startISO || b?.start || '').slice(0, 10);
      return dk >= '2026-05-28';
    });
    expect(allForward).toBe(true);
    expect(rebased.cyclesById['cycle-1'].activationDelayAssessment?.selectedResolution).toBe('rebase');
  });

  it('After None-happened rebase, cycle remains in applied_review not active', () => {
    const blocked = computeDerivedState(buildAppliedState519(), { type: 'ACTIVATE_SCHEDULE' });

    const rebased = computeDerivedState(blocked, {
      type: 'REBASE_SCHEDULE',
      payload: {
        cycleId: 'cycle-1',
        executionStartDayKey: '2026-05-28',
        activationDelayResolution: 'rebase',
        workHappenedDuringDelay: 'none',
      },
    });

    expect(rebased.scheduleLifecycle).toBe('applied_review');
    expect(rebased.cyclesById['cycle-1'].scheduleLifecycle).toBe('applied_review');
    expect((rebased.executionEvents || []).filter((e) => e?.kind === 'create')).toHaveLength(0);
  });

  it('After rebase and final activation, first executable calendar block is >= May 28', () => {
    const blocked = computeDerivedState(buildAppliedState519(), { type: 'ACTIVATE_SCHEDULE' });

    const rebased = computeDerivedState(blocked, {
      type: 'REBASE_SCHEDULE',
      payload: {
        cycleId: 'cycle-1',
        executionStartDayKey: '2026-05-28',
        activationDelayResolution: 'rebase',
        workHappenedDuringDelay: 'none',
      },
    });

    const activated = computeDerivedState(rebased, { type: 'ACTIVATE_SCHEDULE' });

    expect(activated.scheduleLifecycle).toBe('active_schedule');
    const createEvents = (activated.executionEvents || []).filter((e) => e?.kind === 'create');
    expect(createEvents.length).toBeGreaterThan(0);
    const allOnOrAfter = createEvents.every((e) => {
      const dk = e?.dateISO || (e?.startISO || '').slice(0, 10);
      return dk >= '2026-05-28';
    });
    expect(allOnOrAfter).toBe(true);
  });

  it('final invariant: activated execution events before executionStartDayKey are excluded from calendar projection', () => {
    const staleBlock = {
      id: 'blk-stale-1',
      cycleId: 'cycle-1',
      goalId: 'goal-1',
      start: '2026-05-19T09:00:00.000Z',
      end: '2026-05-19T10:00:00.000Z',
      startISO: '2026-05-19T09:00:00.000Z',
      endISO: '2026-05-19T10:00:00.000Z',
      dayKey: '2026-05-19',
      durationMinutes: 60,
      status: 'planned',
      origin: 'schedule_active',
    };

    const state = {
      ...buildAppliedState519(),
      executionEvents: [
        {
          kind: 'create',
          blockId: 'blk-stale-1',
          cycleId: 'cycle-1',
          goalId: 'goal-1',
          dateISO: '2026-05-19',
          startISO: '2026-05-19T09:00:00.000Z',
          endISO: '2026-05-19T10:00:00.000Z',
          status: 'planned',
          origin: 'schedule_active',
          ...staleBlock,
        },
      ],
    };
    state.cyclesById['cycle-1'].scheduleLifecycle = 'active_schedule';
    state.cyclesById['cycle-1'].scheduleReviewBlocks = [];
    state.cyclesById['cycle-1'].executionStartDayKey = '2026-05-28';
    state.scheduleLifecycle = 'active_schedule';

    const derived = computeDerivedState(state, { type: 'NO_OP' });

    const allBlocks = (derived.cycle || []).flatMap((day) => day?.blocks || []);
    const stale = allBlocks.find((b) => b?.id === 'blk-stale-1');
    expect(stale).toBeUndefined();

    const todayBlocks = derived.today?.blocks || [];
    const staleToday = todayBlocks.find((b) => b?.id === 'blk-stale-1');
    expect(staleToday).toBeUndefined();
  });
});

describe('master-plan occupied cycle start resolution', () => {
  it('does not fall back to the original occupied May start after a later reassessment/generation floor exists', () => {
    const resolution = resolveFirstCycleScheduleStart(
      {
        today: { date: '2026-06-08' },
        appTime: {
          nowISO: '2026-06-08T12:00:00.000Z',
          activeDayKey: '2026-06-08',
          timeZone: 'UTC',
          isFollowingNow: true,
        },
        availabilityPolicy: {
          workWindows: {
            mon: [{ start: '09:00', end: '17:00' }],
            tue: [{ start: '09:00', end: '17:00' }],
            wed: [{ start: '09:00', end: '17:00' }],
            thu: [{ start: '09:00', end: '17:00' }],
            fri: [{ start: '09:00', end: '17:00' }],
            sat: [],
            sun: [],
          },
        },
        profilesById: {},
        masterCalendarsById: {},
      },
      {
        plan: {
          id: 'plan-1',
          horizonStart: '2026-05-19',
          horizonEnd: '2031-05-19',
        },
        cycle: {
          id: 'cycle-1',
          source: 'master_plan',
          scheduleLifecycle: 'active_schedule',
          startedAtDayKey: '2026-05-19',
          reassessmentCompletedAtISO: '2026-06-07T02:29:09.880Z',
          scheduleGeneratedAtISO: '2026-06-07T03:11:21.442Z',
          executionEvents: [
            {
              id: 'evt-stale',
              kind: 'create',
              blockId: 'blk-stale',
              dateISO: '2026-05-19',
              startISO: '2026-05-19T09:00:00.000Z',
              endISO: '2026-05-19T10:00:00.000Z',
            },
          ],
          goalContract: {
            goalId: 'goal-1',
            startDayKey: '2026-05-19',
            endDayKey: '2026-10-17',
          },
        },
        contract: {
          goalId: 'goal-1',
          startDayKey: '2026-05-19',
          endDayKey: '2026-10-17',
        },
      }
    );

    expect(resolution.candidateStartDayKey).toBe('2026-06-08');
    expect(resolution.resolvedStartDayKey).toBe('2026-06-07');
    expect(resolution.reasonCode).toBe('ACTIVE_CYCLE_OCCUPANCY');
  });
});
