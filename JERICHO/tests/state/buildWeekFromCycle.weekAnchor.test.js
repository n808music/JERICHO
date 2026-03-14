import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const anchorDay = '2026-02-10';
  const midWeekDay = '2026-02-11';
  const block = {
    id: 'blk-midweek',
    practice: 'Focus',
    label: 'Midweek block',
    start: `${midWeekDay}T14:00:00.000Z`,
    end: `${midWeekDay}T15:00:00.000Z`,
    status: 'planned',
  };
  return {
    vector: { day: 1, direction: 'Test', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: 'Test', horizon: '90d' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    activeCycleId: 'cycle-1',
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        startedAtDayKey: '2026-02-01',
        pattern: { dailyTargets: [] },
      },
    },
    today: { date: anchorDay, blocks: [block], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: anchorDay, days: [], metrics: {} },
    cycle: [
      { date: '2026-02-11', blocks: [block], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    ],
    templates: { objectives: {} },
    meta: { version: '1.0.0', onboardingComplete: false },
    recurringPatterns: [],
    ledger: [],
    appTime: { timeZone: 'UTC', nowISO: `${anchorDay}T12:00:00.000Z`, activeDayKey: anchorDay, isFollowingNow: true },
    viewDate: anchorDay,
  };
}

describe('buildWeekFromCycle week anchoring', () => {
  it('anchors currentWeek to the Monday of the week containing viewDate', () => {
    const next = computeDerivedState(buildState(), { type: 'REBALANCE_TODAY' });

    expect(next.currentWeek.weekStart).toBe('2026-02-09');
    expect((next.currentWeek.days || []).map((day) => day.date)).toEqual([
      '2026-02-09',
      '2026-02-10',
      '2026-02-11',
      '2026-02-12',
      '2026-02-13',
      '2026-02-14',
      '2026-02-15',
    ]);
  });

  it('includes blocks from the anchored mid-month week rather than the first week of the month', () => {
    const next = computeDerivedState(buildState(), { type: 'REBALANCE_TODAY' });

    const wrongFirstWeek = (next.currentWeek.days || []).find((day) => day.date === '2026-02-01');
    expect(wrongFirstWeek).toBeUndefined();

    const midWeekDay = (next.currentWeek.days || []).find((day) => day.date === '2026-02-11');
    expect(midWeekDay).toBeTruthy();
    expect((midWeekDay.blocks || []).some((block) => block.id === 'blk-midweek')).toBe(true);
  });
});
