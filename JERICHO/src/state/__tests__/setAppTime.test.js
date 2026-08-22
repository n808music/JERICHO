import { describe, it, expect } from 'vitest';
import { setAppTime } from '../time/setAppTime.js';

describe('setAppTime() helper', () => {
  it('should set nowISO when provided', () => {
    const state = {
      appTime: {
        nowISO: '2026-06-01T12:00:00.000Z',
        activeDayKey: '2026-06-01',
        timeZone: 'UTC',
        isFollowingNow: true,
      },
    };

    const newNow = '2026-08-15T14:30:00.000Z';
    setAppTime(state, { nowISO: newNow });

    expect(state.appTime.nowISO).toBe(newNow);
  });

  it('should set activeDayKey when provided', () => {
    const state = {
      appTime: {
        nowISO: '2026-06-01T12:00:00.000Z',
        activeDayKey: '2026-06-01',
        timeZone: 'UTC',
        isFollowingNow: true,
      },
    };

    const newDayKey = '2026-08-15';
    setAppTime(state, { activeDayKey: newDayKey });

    expect(state.appTime.activeDayKey).toBe(newDayKey);
  });

  it('should set both nowISO and activeDayKey together', () => {
    const state = {
      appTime: {
        nowISO: '2026-06-01T12:00:00.000Z',
        activeDayKey: '2026-06-01',
        timeZone: 'UTC',
        isFollowingNow: true,
      },
    };

    const newNow = '2026-08-15T14:30:00.000Z';
    const newDayKey = '2026-08-15';
    setAppTime(state, { nowISO: newNow, activeDayKey: newDayKey });

    expect(state.appTime.nowISO).toBe(newNow);
    expect(state.appTime.activeDayKey).toBe(newDayKey);
  });

  it('should guard: timeIsPinned=true prevents update', () => {
    const state = {
      appTime: {
        nowISO: '2026-06-01T12:00:00.000Z',
        activeDayKey: '2026-06-01',
        timeZone: 'UTC',
        isFollowingNow: true,
        timeIsPinned: true, // PIN IS SET
      },
    };

    const originalNow = state.appTime.nowISO;
    const originalDayKey = state.appTime.activeDayKey;

    const newNow = '2026-08-15T14:30:00.000Z';
    setAppTime(state, { nowISO: newNow, respectPin: true });

    // Values should remain unchanged
    expect(state.appTime.nowISO).toBe(originalNow);
    expect(state.appTime.activeDayKey).toBe(originalDayKey);
  });

  it('should allow update when timeIsPinned=false', () => {
    const state = {
      appTime: {
        nowISO: '2026-06-01T12:00:00.000Z',
        activeDayKey: '2026-06-01',
        timeZone: 'UTC',
        isFollowingNow: true,
        timeIsPinned: false,
      },
    };

    const newNow = '2026-08-15T14:30:00.000Z';
    setAppTime(state, { nowISO: newNow, respectPin: true });

    expect(state.appTime.nowISO).toBe(newNow);
  });

  it('should allow update when timeIsPinned unset (defaults to allow)', () => {
    const state = {
      appTime: {
        nowISO: '2026-06-01T12:00:00.000Z',
        activeDayKey: '2026-06-01',
        timeZone: 'UTC',
        isFollowingNow: true,
        // timeIsPinned is NOT set
      },
    };

    const newNow = '2026-08-15T14:30:00.000Z';
    setAppTime(state, { nowISO: newNow, respectPin: true });

    expect(state.appTime.nowISO).toBe(newNow);
  });

  it('should ignore pin guard when respectPin=false', () => {
    const state = {
      appTime: {
        nowISO: '2026-06-01T12:00:00.000Z',
        activeDayKey: '2026-06-01',
        timeZone: 'UTC',
        isFollowingNow: true,
        timeIsPinned: true,
      },
    };

    const newNow = '2026-08-15T14:30:00.000Z';
    setAppTime(state, { nowISO: newNow, respectPin: false });

    // Pin is ignored, so update should succeed
    expect(state.appTime.nowISO).toBe(newNow);
  });

  it('should handle undefined state gracefully (no-op)', () => {
    expect(() => {
      setAppTime(undefined, { nowISO: '2026-08-15T14:30:00.000Z' });
    }).not.toThrow();
  });

  it('should handle missing appTime gracefully (no-op)', () => {
    const state = {};
    expect(() => {
      setAppTime(state, { nowISO: '2026-08-15T14:30:00.000Z' });
    }).not.toThrow();
  });

  it('should derive activeDayKey from nowISO if only nowISO provided', () => {
    const state = {
      appTime: {
        nowISO: '2026-06-01T12:00:00.000Z',
        activeDayKey: '2026-06-01',
        timeZone: 'UTC',
        isFollowingNow: true,
      },
    };

    const newNow = '2026-08-15T14:30:00.000Z';
    setAppTime(state, { nowISO: newNow });

    expect(state.appTime.nowISO).toBe(newNow);
    expect(state.appTime.activeDayKey).toBe('2026-08-15');
  });

  it('should use provided timeZone for derivation', () => {
    const state = {
      appTime: {
        nowISO: '2026-06-01T12:00:00.000Z',
        activeDayKey: '2026-06-01',
        timeZone: 'UTC',
        isFollowingNow: true,
      },
    };

    const newNow = '2026-08-15T14:30:00.000Z';
    setAppTime(state, { nowISO: newNow, timeZone: 'America/New_York' });

    expect(state.appTime.nowISO).toBe(newNow);
    // Derivation should use the provided timezone
    expect(state.appTime.activeDayKey).toBeDefined();
  });
});
