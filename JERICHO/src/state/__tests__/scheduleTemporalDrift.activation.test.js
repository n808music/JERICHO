import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

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
