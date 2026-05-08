import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const dayKey = '2026-03-04';
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: dayKey, days: [], metrics: {} },
    cycle: [],
    viewDate: dayKey,
    templates: { objectives: {} },
    meta: { version: '1.0.0', onboardingComplete: false, lastActiveDate: dayKey },
    recurringPatterns: [],
    executionEvents: [],
    suggestionEvents: [],
    ledger: [],
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        goalContract: {
          goalId: 'goal-1',
          workWindows: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
        },
      },
    },
    activeCycleId: 'cycle-1',
    goalExecutionContract: { goalId: 'goal-1' },
    constraints: {},
    proposedBlocks: [],
    suggestedBlocks: [],
    deliverablesByCycleId: {},
    aspirationsByCycleId: {},
    goalAdmissionByGoal: { 'goal-1': { status: 'ADMITTED', reasonCodes: [] } },
  };
}

describe('UPDATE_WORK_WINDOWS reducer', () => {
  it('persists work windows onto target cycle goal contract', () => {
    const state = buildState();
    const windows = {
      mon: [{ start: '06:00', end: '09:00' }],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    };

    const next = computeDerivedState(state, {
      type: 'UPDATE_WORK_WINDOWS',
      payload: { cycleId: 'cycle-1', workWindows: windows },
    });

    expect(next.cyclesById['cycle-1'].goalContract.workWindows).toEqual(windows);
  });
});
