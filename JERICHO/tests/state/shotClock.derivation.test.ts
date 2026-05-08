import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { deriveSystemShotClock } from '../../src/state/engine/shotClock.ts';

const GOAL_ID = 'goal-shot-clock';
const CYCLE_ID = 'cycle-shot-clock';

function makeBlock({
  id,
  dayKey = '2026-05-01',
  start = '09:00',
  end = '10:00',
  status = 'planned',
  deadlineTime = null,
  deadlineDateTime = null,
  deadlineLabel = null,
} = {}) {
  return {
    id,
    goalId: GOAL_ID,
    cycleId: CYCLE_ID,
    title: deadlineLabel || `Block ${id}`,
    label: deadlineLabel || `Block ${id}`,
    start: `${dayKey}T${start}:00.000Z`,
    end: `${dayKey}T${end}:00.000Z`,
    status,
    ...(deadlineTime ? { deadlineTime } : {}),
    ...(deadlineDateTime ? { deadlineDateTime } : {}),
    ...(deadlineLabel ? { deadlineLabel } : {}),
  };
}

describe('system shot clock derivation', () => {
  it('derives active-horizon timing and completion ratio from canonical execution events, not block status alone', () => {
    const blockA = makeBlock({ id: 'blk-a', status: 'completed' });
    const blockB = makeBlock({ id: 'blk-b' });
    const blockC = makeBlock({ id: 'blk-c' });
    const state = computeDerivedState(
      {
        appTime: {
          nowISO: '2026-05-01T12:00:00.000Z',
          activeDayKey: '2026-05-01',
          timeZone: 'UTC',
          isFollowingNow: true,
        },
        today: { date: '2026-05-01', blocks: [blockA, blockB, blockC] },
        currentWeek: { weekStart: '2026-05-01', days: [{ date: '2026-05-01', blocks: [blockA, blockB, blockC] }] },
        cycle: [{ date: '2026-05-01', blocks: [blockA, blockB, blockC] }],
        blockStore: { blocks: { 'blk-a': blockA, 'blk-b': blockB, 'blk-c': blockC } },
        executionEvents: [
          {
            id: 'evt-complete-blk-b',
            blockId: 'blk-b',
            goalId: GOAL_ID,
            cycleId: CYCLE_ID,
            dateISO: '2026-05-01',
            completedAtISO: '2026-05-01T12:00:00.000Z',
            minutes: 60,
            rawLabel: 'Block blk-b',
            completed: true,
            kind: 'complete',
            status: 'completed',
          },
        ],
        cyclesById: {
          [CYCLE_ID]: {
            id: CYCLE_ID,
            status: 'active',
            goalContract: {
              goalId: GOAL_ID,
              startDayKey: '2026-04-21',
              endDayKey: '2026-07-30',
            },
          },
        },
        activeCycleId: CYCLE_ID,
        goalExecutionContract: {
          goalId: GOAL_ID,
          startDayKey: '2026-04-21',
          endDayKey: '2026-07-30',
        },
      } as any,
      { type: 'NO_OP' }
    );

    const shotClock = state.systemShotClockByGoal?.[GOAL_ID];
    expect(shotClock).toBeTruthy();
    expect(shotClock.scheduledBlockCount).toBe(3);
    expect(shotClock.completedBlockCount).toBe(1);
    expect(shotClock.completionRatio).toBeCloseTo(1 / 3, 5);
    expect(shotClock.paceState).not.toBe('insufficient_evidence');
  });

  it('derives before-start state without consuming elapsed horizon', () => {
    const result = deriveSystemShotClock({
      goalId: GOAL_ID,
      cycleId: CYCLE_ID,
      contract: { startDayKey: '2026-05-10', endDayKey: '2026-06-10' },
      nowISO: '2026-05-01T12:00:00.000Z',
      timeZone: 'UTC',
      blocks: [makeBlock({ id: 'blk-before', dayKey: '2026-05-12' })],
      executionEvents: [],
    });

    expect(result.totalHorizonDays).toBe(31);
    expect(result.elapsedDays).toBe(0);
    expect(result.remainingDays).toBe(31);
    expect(result.elapsedRatio).toBe(0);
    expect(result.paceState).toBe('insufficient_evidence');
  });

  it('classifies timed deadlines across upcoming, due soon, due now, missed candidate, and completed late states', () => {
    const blocks = [
      makeBlock({
        id: 'blk-upcoming',
        deadlineDateTime: '2026-05-01T18:00:00.000Z',
        deadlineLabel: 'Future filing',
      }),
      makeBlock({
        id: 'blk-soon',
        deadlineDateTime: '2026-05-01T17:00:00.000Z',
        deadlineLabel: 'Soon filing',
      }),
      makeBlock({
        id: 'blk-now',
        deadlineDateTime: '2026-05-01T15:10:00.000Z',
        deadlineLabel: 'Immediate filing',
      }),
      makeBlock({
        id: 'blk-missed',
        deadlineDateTime: '2026-05-01T14:30:00.000Z',
        deadlineLabel: 'Expired filing',
      }),
      makeBlock({
        id: 'blk-completed',
        deadlineDateTime: '2026-05-01T14:45:00.000Z',
        deadlineLabel: 'Completed filing',
      }),
    ];
    const executionEvents = [
      {
        id: 'evt-complete-blk-completed',
        blockId: 'blk-completed',
        goalId: GOAL_ID,
        cycleId: CYCLE_ID,
        dateISO: '2026-05-01',
        completedAtISO: '2026-05-01T15:05:00.000Z',
        minutes: 30,
        rawLabel: 'Completed filing',
        completed: true,
        kind: 'complete',
        status: 'completed',
      },
    ];

    const result = deriveSystemShotClock({
      goalId: GOAL_ID,
      cycleId: CYCLE_ID,
      contract: { startDayKey: '2026-04-21', endDayKey: '2026-07-30' },
      nowISO: '2026-05-01T15:00:00.000Z',
      timeZone: 'UTC',
      blocks,
      executionEvents,
    });

    const byId = Object.fromEntries(result.timedDeadlines.map((item) => [item.blockId, item]));
    expect(byId['blk-upcoming'].deadlineState).toBe('upcoming');
    expect(byId['blk-soon'].deadlineState).toBe('due_soon');
    expect(byId['blk-now'].deadlineState).toBe('due_now');
    expect(byId['blk-missed'].deadlineState).toBe('missed_candidate');
    expect(byId['blk-completed'].deadlineState).toBe('completed');
    expect(byId['blk-completed'].completedLate).toBe(true);
  });
});
