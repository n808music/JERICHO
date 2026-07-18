import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildBlankIdentityState, identityReducer } from '../../src/state/identityStore.js';
import { dayKeyFromISO } from '../../src/state/time/time.ts';

function buildState({ dayKey = '2026-06-16', nowISO = '2026-06-16T12:00:00.000Z' } = {}) {
  const state = buildBlankIdentityState({
    activeProfileId: 'profile-local-default',
    todayDate: dayKey,
    nowISO,
    timeZone: 'America/Chicago',
  });
  state.viewDate = dayKey;
  return state;
}

describe('identityStore calendar authority', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('SET_VIEW_DATE changes selected day without mutating live app day', () => {
    const initial = buildState();

    const next = identityReducer(initial, { type: 'SET_VIEW_DATE', date: '2026-06-15' });

    expect(next.viewDate).toBe('2026-06-15');
    expect(next.appTime.activeDayKey).toBe('2026-06-16');
    expect(next.today.date).toBe('2026-06-16');
    expect(next.appTime.nowISO).toBe('2026-06-16T12:00:00.000Z');
  });

  it('JUMP_TO_TODAY sets selected day to the live day key', () => {
    const initial = buildState();
    const navigated = identityReducer(initial, { type: 'SET_VIEW_DATE', date: '2026-06-15' });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-14T18:30:00.000Z'));

    const next = identityReducer(navigated, { type: 'JUMP_TO_TODAY' });

    const liveDayKey = dayKeyFromISO(next.appTime.nowISO, next.appTime.timeZone);
    expect(liveDayKey).toBe('2026-06-14');
    expect(next.viewDate).toBe(liveDayKey);
    expect(next.today.date).toBe(liveDayKey);
    expect(next.appTime.activeDayKey).toBe(liveDayKey);
  });

  it('SET_ACTIVE_CYCLE uses the visible executable floor instead of stale cycle start', () => {
    const initial = buildState();
    initial.cyclesById = {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        startedAtDayKey: '2026-05-19',
        executionStartDayKey: '2026-06-15',
        scheduleGeneratedAtISO: '2026-06-14T12:00:00.000Z',
        goalContract: {
          goalId: 'goal-1',
          startDayKey: '2026-05-19',
          endDayKey: '2026-10-17',
        },
      },
    };

    const next = identityReducer(initial, { type: 'SET_ACTIVE_CYCLE', cycleId: 'cycle-1' });

    expect(next.viewDate).toBe('2026-06-15');
    expect(next.appTime.activeDayKey).toBe('2026-06-15');
  });
});
