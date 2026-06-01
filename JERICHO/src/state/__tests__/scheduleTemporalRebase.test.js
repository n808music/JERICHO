import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

function buildAppliedReviewState({
  nowDayKey = '2026-05-26',
  blocks = [],
  executionEvents = [],
  generatedAtISO = '2026-05-19T12:00:00.000Z',
  endDayKey = '2026-06-15',
  workWindows = {
    mon: [{ start: '09:00', end: '11:00' }],
    tue: [{ start: '09:00', end: '11:00' }],
    wed: [{ start: '09:00', end: '11:00' }],
    thu: [{ start: '09:00', end: '11:00' }],
    fri: [{ start: '09:00', end: '11:00' }],
    sat: [],
    sun: [],
  },
  strategyConstraints = { maxBlocksPerDay: 2, maxBlocksPerWeek: 10 },
} = {}) {
  const cycleId = 'cycle-1';
  const goalId = 'goal-1';
  const reviewBlocks = blocks.map((block) => ({
    cycleId,
    goalId,
    status: 'planned',
    origin: 'schedule_review',
    ...block,
  }));
  return {
    today: { date: nowDayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: nowDayKey, days: [] },
    cycle: [],
    executionEvents,
    scheduleReviewBlocks: reviewBlocks,
    appTime: {
      nowISO: `${nowDayKey}T12:00:00.000Z`,
      activeDayKey: nowDayKey,
      timeZone: 'UTC',
      isFollowingNow: true,
    },
    activeCycleId: cycleId,
    activeGoalId: goalId,
    constraints: strategyConstraints,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        scheduleLifecycle: 'applied_review',
        scheduleReviewBlocks: reviewBlocks.map((block) => ({ ...block })),
        scheduleAppliedAtISO: '2026-05-19T13:00:00.000Z',
        scheduleGeneratedAtISO: generatedAtISO,
        goalContract: {
          goalId,
          startDayKey: '2026-05-19',
          endDayKey,
          workWindows,
        },
        strategy: {
          constraints: strategyConstraints,
        },
      },
    },
    goalExecutionContract: {
      goalId,
      startDayKey: '2026-05-19',
      endDayKey,
      workWindows,
    },
    blockStore: { blocks: {} },
  };
}

describe('schedule temporal rebase', () => {
  it('moves past unexecuted blocks forward and keeps the cycle in applied review', () => {
    const next = computeDerivedState(
      buildAppliedReviewState({
        blocks: [
          {
            id: 'blk-review-1',
            title: 'Past block A',
            start: '2026-05-19T09:00:00.000Z',
            end: '2026-05-19T10:00:00.000Z',
            startISO: '2026-05-19T09:00:00.000Z',
            endISO: '2026-05-19T10:00:00.000Z',
            durationMinutes: 60,
          },
          {
            id: 'blk-review-2',
            title: 'Past block B',
            start: '2026-05-20T09:00:00.000Z',
            end: '2026-05-20T10:00:00.000Z',
            startISO: '2026-05-20T09:00:00.000Z',
            endISO: '2026-05-20T10:00:00.000Z',
            durationMinutes: 60,
          },
          {
            id: 'blk-review-3',
            title: 'Future anchor block',
            start: '2026-05-30T09:00:00.000Z',
            end: '2026-05-30T10:00:00.000Z',
            startISO: '2026-05-30T09:00:00.000Z',
            endISO: '2026-05-30T10:00:00.000Z',
            durationMinutes: 60,
          },
        ],
      }),
      { type: 'REBASE_SCHEDULE', payload: { cycleId: 'cycle-1', executionStartDayKey: '2026-05-26' } }
    );

    expect(next.lastPlanError).toBeNull();
    expect(next.scheduleLifecycle).toBe('applied_review');
    expect(next.cyclesById['cycle-1'].scheduleLifecycle).toBe('applied_review');
    expect(next.cyclesById['cycle-1'].temporalStatus).toBe('rebased');
    expect(next.cyclesById['cycle-1'].rebaseRequired).toBe(false);
    expect(next.cyclesById['cycle-1'].temporalReasonCodes || []).toEqual(
      expect.arrayContaining(['SCHEDULE_REBASED_FROM_TEMPORAL_DRIFT'])
    );
    expect((next.executionEvents || []).some((event) => event?.kind === 'create')).toBe(false);
    const unexecutedPastBlocks = (next.cyclesById['cycle-1'].scheduleReviewBlocks || []).filter((block) => {
      const dayKey = String(block?.dayKey || block?.startISO || '').slice(0, 10);
      return dayKey && dayKey < '2026-05-26';
    });
    expect(unexecutedPastBlocks).toHaveLength(0);
    expect(typeof next.cyclesById['cycle-1'].compressionDelta).toBe('number');
  });

  it('records the none-happened delay resolution when rebasing from delayed activation reassessment', () => {
    const next = computeDerivedState(
      buildAppliedReviewState({
        blocks: [
          {
            id: 'blk-review-1',
            title: 'Past block A',
            start: '2026-05-19T09:00:00.000Z',
            end: '2026-05-19T10:00:00.000Z',
            startISO: '2026-05-19T09:00:00.000Z',
            endISO: '2026-05-19T10:00:00.000Z',
            durationMinutes: 60,
          },
        ],
      }),
      {
        type: 'REBASE_SCHEDULE',
        payload: {
          cycleId: 'cycle-1',
          executionStartDayKey: '2026-05-26',
          activationDelayResolution: 'rebase',
          workHappenedDuringDelay: 'none',
        },
      }
    );

    expect(next.lastPlanError).toBeNull();
    expect(next.cyclesById['cycle-1'].scheduleLifecycle).toBe('applied_review');
    expect(next.cyclesById['cycle-1'].activationDelayAssessment).toMatchObject({
      status: 'ready_to_rebase',
      selectedResolution: 'rebase',
      workHappenedDuringDelay: 'none',
    });
    expect(next.cyclesById['cycle-1'].activationDelayAssessment?.reasonCodes || []).toEqual(
      expect.arrayContaining(['DELAY_WINDOW_REBASE_SELECTED'])
    );
    expect(next.cyclesById['cycle-1'].temporalReasonCodes || []).toEqual(
      expect.arrayContaining(['SCHEDULE_REBASED_FROM_TEMPORAL_DRIFT', 'DELAY_WINDOW_REBASE_SELECTED'])
    );
    expect((next.executionEvents || []).some((event) => event?.kind === 'create')).toBe(false);
  });

  it('preserves historical execution evidence while rebasing only unexecuted work', () => {
    const next = computeDerivedState(
      buildAppliedReviewState({
        blocks: [
          {
            id: 'blk-review-1',
            title: 'Completed historical block',
            start: '2026-05-19T09:00:00.000Z',
            end: '2026-05-19T10:00:00.000Z',
            startISO: '2026-05-19T09:00:00.000Z',
            endISO: '2026-05-19T10:00:00.000Z',
            durationMinutes: 60,
            status: 'completed',
          },
          {
            id: 'blk-review-2',
            title: 'Portable block',
            start: '2026-05-20T09:00:00.000Z',
            end: '2026-05-20T10:00:00.000Z',
            startISO: '2026-05-20T09:00:00.000Z',
            endISO: '2026-05-20T10:00:00.000Z',
            durationMinutes: 60,
          },
        ],
        executionEvents: [{ kind: 'complete', blockId: 'blk-review-1' }],
      }),
      { type: 'REBASE_SCHEDULE', payload: { cycleId: 'cycle-1', executionStartDayKey: '2026-05-26' } }
    );

    const completedBlock = (next.cyclesById['cycle-1'].scheduleReviewBlocks || []).find((block) => block?.id === 'blk-review-1');
    const portableBlock = (next.cyclesById['cycle-1'].scheduleReviewBlocks || []).find((block) => block?.id === 'blk-review-2');

    expect(completedBlock?.dayKey || completedBlock?.startISO?.slice(0, 10)).toBe('2026-05-19');
    expect(String(portableBlock?.dayKey || '').localeCompare('2026-05-26')).toBeGreaterThanOrEqual(0);
    expect(next.cyclesById['cycle-1'].lastTemporalAudit?.temporalReasonCodes || []).toEqual(
      expect.arrayContaining(['PAST_DATED_UNEXECUTED_BLOCKS', 'SCHEDULE_REBASE_REQUIRED'])
    );
  });

  it('fails explicitly when displaced work cannot fit future capacity', () => {
    const next = computeDerivedState(
      buildAppliedReviewState({
        blocks: [
          {
            id: 'blk-review-1',
            title: 'Past block A',
            start: '2026-05-19T09:00:00.000Z',
            end: '2026-05-19T10:00:00.000Z',
            startISO: '2026-05-19T09:00:00.000Z',
            endISO: '2026-05-19T10:00:00.000Z',
            durationMinutes: 60,
          },
          {
            id: 'blk-review-2',
            title: 'Past block B',
            start: '2026-05-20T09:00:00.000Z',
            end: '2026-05-20T10:00:00.000Z',
            startISO: '2026-05-20T09:00:00.000Z',
            endISO: '2026-05-20T10:00:00.000Z',
            durationMinutes: 60,
          },
        ],
        endDayKey: '2026-05-26',
        workWindows: {
          mon: [{ start: '09:00', end: '10:00' }],
          tue: [{ start: '09:00', end: '10:00' }],
          wed: [],
          thu: [],
          fri: [],
          sat: [],
          sun: [],
        },
        strategyConstraints: { maxBlocksPerDay: 1, maxBlocksPerWeek: 1 },
      }),
      { type: 'REBASE_SCHEDULE', payload: { cycleId: 'cycle-1', executionStartDayKey: '2026-05-26' } }
    );

    expect(next.lastPlanError?.code).toBe('INSUFFICIENT_CAPACITY_FOR_TEMPORAL_REBASE');
    expect(next.cyclesById['cycle-1'].rebaseRequired).toBe(true);
    expect(next.cyclesById['cycle-1'].temporalStatus).toBe('rebase_required');
    expect(next.lastPlanError?.reasonCodes || []).toEqual(
      expect.arrayContaining(['INSUFFICIENT_CAPACITY_FOR_TEMPORAL_REBASE'])
    );
  });
});
