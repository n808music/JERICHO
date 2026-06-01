import { describe, expect, it } from 'vitest';
import { deriveCycleDynamicsProfile } from '../../src/state/engine/cycleDynamics.ts';

describe('cycle dynamics rules', () => {
  it('derives deterministic totals and transition recommendations', () => {
    const nowISO = '2026-03-10T12:00:00.000Z';
    const profile = deriveCycleDynamicsProfile({
      cycleId: 'cycle-tv',
      goalId: 'goal-tv',
      nowISO,
      missedGraceDays: 1,
      blocks: [
        {
          id: 'b-complete',
          status: 'completed',
          startISO: '2026-03-08T09:00:00.000Z',
          endISO: '2026-03-08T10:00:00.000Z',
        },
        {
          id: 'b-overdue',
          status: 'planned',
          startISO: '2026-03-09T09:00:00.000Z',
          endISO: '2026-03-09T10:00:00.000Z',
        },
        {
          id: 'b-due-today',
          status: 'in_progress',
          startISO: '2026-03-10T13:00:00.000Z',
          endISO: '2026-03-10T14:00:00.000Z',
        },
        {
          id: 'b-missed-old',
          status: 'missed',
          missedAtISO: '2026-03-08T08:00:00.000Z',
          endISO: '2026-03-08T09:00:00.000Z',
        },
        {
          id: 'b-missed-recent',
          status: 'missed',
          missedAtISO: '2026-03-10T11:30:00.000Z',
          endISO: '2026-03-10T11:00:00.000Z',
        },
        {
          id: 'b-expired',
          status: 'expired',
          startISO: '2026-03-07T09:00:00.000Z',
          endISO: '2026-03-07T10:00:00.000Z',
        },
        {
          status: 'planned',
          startISO: '2026-03-10T09:00:00.000Z',
          endISO: '2026-03-10T10:00:00.000Z',
        },
      ],
    });

    expect(profile.cycleId).toBe('cycle-tv');
    expect(profile.goalId).toBe('goal-tv');
    expect(profile.generatedAtISO).toBe(nowISO);

    expect(profile.totals).toEqual({
      totalBlocks: 6,
      completed: 1,
      inProgress: 1,
      planned: 1,
      missed: 2,
      expired: 1,
      dueToday: 1,
      overdueUnfinished: 1,
    });

    expect(profile.recommendedTransitions).toEqual([
      {
        blockId: 'b-overdue',
        fromStatus: 'planned',
        toStatus: 'MISSED',
        reasonCode: 'OVERDUE_UNFINISHED',
        effectiveAtISO: nowISO,
      },
      {
        blockId: 'b-missed-old',
        fromStatus: 'missed',
        toStatus: 'EXPIRED',
        reasonCode: 'MISSED_GRACE_ELAPSED',
        effectiveAtISO: nowISO,
      },
    ]);
  });
});
