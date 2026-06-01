import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function baseState() {
  const dayKey = '2026-03-10';
  const cycleId = 'cycle-tv';
  const goalId = 'goal-tv';
  return {
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-05-09' },
        executionEvents: [
          {
            id: 'evt:create:blk-overdue',
            blockId: 'blk-overdue',
            dateISO: '2026-03-09',
            minutes: 60,
            rawLabel: 'Overdue',
            domain: 'Focus',
            cycleId,
            goalId,
            completed: false,
            kind: 'create',
            startISO: '2026-03-09T09:00:00.000Z',
            endISO: '2026-03-09T10:00:00.000Z',
            status: 'planned',
          },
          {
            id: 'evt:create:blk-complete',
            blockId: 'blk-complete',
            dateISO: '2026-03-10',
            minutes: 60,
            rawLabel: 'Complete',
            domain: 'Focus',
            cycleId,
            goalId,
            completed: true,
            kind: 'create',
            startISO: '2026-03-10T09:00:00.000Z',
            endISO: '2026-03-10T10:00:00.000Z',
            status: 'completed',
          },
        ],
      },
    },
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-05-09' },
    activeCycleId: cycleId,
    executionEvents: [
      {
        id: 'evt:create:blk-overdue',
        blockId: 'blk-overdue',
        dateISO: '2026-03-09',
        minutes: 60,
        rawLabel: 'Overdue',
        domain: 'Focus',
        cycleId,
        goalId,
        completed: false,
        kind: 'create',
        startISO: '2026-03-09T09:00:00.000Z',
        endISO: '2026-03-09T10:00:00.000Z',
        status: 'planned',
      },
      {
        id: 'evt:create:blk-complete',
        blockId: 'blk-complete',
        dateISO: '2026-03-10',
        minutes: 60,
        rawLabel: 'Complete',
        domain: 'Focus',
        cycleId,
        goalId,
        completed: true,
        kind: 'create',
        startISO: '2026-03-10T09:00:00.000Z',
        endISO: '2026-03-10T10:00:00.000Z',
        status: 'completed',
      },
    ],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: {},
    cycleDynamicsByCycleId: {},
  };
}

describe('cycle dynamics reducer integration', () => {
  it('stores active-cycle dynamics profile and mirrors it on cycle object', () => {
    const next = computeDerivedState(baseState(), { type: 'NO_OP' });
    const profile = next?.cycleDynamicsByCycleId?.['cycle-tv'];

    expect(profile).toBeTruthy();
    expect(profile.cycleId).toBe('cycle-tv');
    expect(profile.goalId).toBe('goal-tv');
    expect(profile.totals.totalBlocks).toBe(2);
    expect(profile.totals.overdueUnfinished).toBe(1);
    expect(Array.isArray(profile.recommendedTransitions)).toBe(true);
    expect(profile.recommendedTransitions.some((t) => t.blockId === 'blk-overdue' && t.toStatus === 'MISSED')).toBe(
      true
    );
    expect(next.cyclesById['cycle-tv'].cycleDynamics).toEqual(profile);
  });
});
