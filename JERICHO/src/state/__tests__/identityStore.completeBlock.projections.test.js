import { describe, expect, it } from 'vitest';
import { identityReducer } from '../identityStore.js';

function buildState() {
  const cycleId = 'cycle-1';
  const block = {
    id: 'blk-1',
    cycleId,
    goalId: 'goal-1',
    title: 'Validate onboarding path',
    label: 'Validate onboarding path',
    start: '2026-05-19T09:00:00.000Z',
    end: '2026-05-19T10:00:00.000Z',
    status: 'planned',
    origin: 'schedule_active',
    requiredSystemBlock: true,
  };

  return {
    today: { date: '2026-05-19', blocks: [{ ...block }] },
    currentWeek: { weekStart: '2026-05-19', days: [{ date: '2026-05-19', blocks: [{ ...block }] }] },
    cycle: [{ date: '2026-05-19', blocks: [{ ...block }] }],
    executionEvents: [],
    ledger: [],
    appTime: {
      nowISO: '2026-05-19T12:00:00.000Z',
      activeDayKey: '2026-05-19',
        timeIsPinned: true,
      timeZone: 'UTC',
      isFollowingNow: true,
        timeIsPinned: true,
    },
    activeCycleId: cycleId,
    activeGoalId: 'goal-1',
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        scheduleLifecycle: 'active_schedule',
        goalContract: { goalId: 'goal-1', startDayKey: '2026-05-19', endDayKey: '2026-06-19' },
        scheduleReviewBlocks: [{ ...block, origin: 'schedule_review' }],
      },
    },
    scheduleReviewBlocks: [{ ...block, origin: 'schedule_review' }],
    blockStore: { blocks: { 'blk-1': { ...block } } },
  };
}

describe('identityStore COMPLETE_BLOCK projection sync', () => {
  it('updates canonical and review projections when completing a block', () => {
    const next = identityReducer(buildState(), { type: 'COMPLETE_BLOCK', id: 'blk-1' });

    expect(next.today.blocks[0].status).toBe('completed');
    expect((next.scheduleReviewBlocks || []).find((block) => block?.id === 'blk-1')?.status).toBe('completed');
    expect((next.cyclesById['cycle-1'].scheduleReviewBlocks || []).find((block) => block?.id === 'blk-1')?.status).toBe(
      'completed'
    );
    expect(next.blockStore.blocks['blk-1'].status).toBe('completed');
    expect((next.executionEvents || []).some((event) => event?.kind === 'complete' && event?.blockId === 'blk-1')).toBe(true);
  });
});
