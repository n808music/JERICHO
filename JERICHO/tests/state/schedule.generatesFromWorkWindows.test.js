import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { buildLocalStartISO } from '../../src/state/time/time.ts';

function dayKeyToDow(dayKey) {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[new Date(`${dayKey}T12:00:00.000Z`).getUTCDay()];
}

function buildState() {
  const dayKey = '2026-03-02';
  const cycleId = 'cycle-1';
  const goalId = 'goal-1';
  return {
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: {
          goalId,
          startDayKey: dayKey,
          endDayKey: '2026-03-30',
          workWindows: {
            mon: [{ start: '06:00', end: '08:00' }],
            tue: [],
            wed: [{ start: '14:00', end: '16:00' }],
            thu: [],
            fri: [],
            sat: [],
            sun: [],
          },
        },
        planProof: {
          workableDaysRemaining: 10,
          totalRequiredUnits: 10,
          requiredPacePerDay: 1,
          maxPerDay: 1,
          maxPerWeek: 10,
          slackUnits: 0,
          slackRatio: 0,
          intensityRatio: 0,
        },
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: dayKey, endDayKey: '2026-03-30' },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
  };
}

describe('schedule generation from goalContract.workWindows', () => {
  it('generates blocks only on configured work-window days and uses window start time', () => {
    const next = computeDerivedState(buildState(), { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-1' } });

    const committed = (next.proposedBlocks || []).filter((item) => item?.status === 'accepted');
    expect(committed.length).toBeGreaterThan(0);

    committed.forEach((block) => {
      const dow = dayKeyToDow(block.dayKey || block.startISO?.slice(0, 10));
      expect(['mon', 'wed']).toContain(dow);

      const expectedStart = dow === 'mon' ? '06:00' : '14:00';
      const expectedISO = buildLocalStartISO(block.dayKey, expectedStart, 'UTC').startISO;
      expect(block.startISO).toBe(expectedISO);
    });

    expect(next.scheduleApplied).toBe(true);
    expect(next.lastPlanError).toBeNull();
  });
});
