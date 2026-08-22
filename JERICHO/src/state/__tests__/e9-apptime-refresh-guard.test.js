import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { identityReducer, DEFAULT_PROFILE_ID } from '../identityStore.js';
import { dayKeyFromISO, APP_TIME_ZONE } from '../time/time.ts';

describe('E9: appTime refresh guard with timeIsPinned', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Case 1: isFollowingNow=true, timeIsPinned unset/false, real clock mocked → refresh happens', () => {
    // Arrange: Mock "real clock" to 2026-07-15 12:00:00
    const fixedNow = new Date('2026-07-15T12:00:00.000Z');
    vi.setSystemTime(fixedNow);

    const baseState = {
      appTime: {
        nowISO: '2026-06-01T12:00:00.000Z', // Old persisted date
        activeDayKey: '2026-06-01',
        timeZone: APP_TIME_ZONE,
        isFollowingNow: true,
        // timeIsPinned is NOT set (should default to false/falsy)
      },
      cyclesById: {},
      executionEvents: [],
      today: { blocks: [] },
      profilesById: { [DEFAULT_PROFILE_ID]: {} },
      activeProfileId: DEFAULT_PROFILE_ID,
    };

    // Act: Call the reducer with TICK_NOW action
    const next = identityReducer(baseState, { type: 'TICK_NOW' });

    // Assert: nowISO should be refreshed to the mocked "real" date
    expect(next.appTime.nowISO).toBe('2026-07-15T12:00:00.000Z');
    expect(next.appTime.activeDayKey).toBe('2026-07-15');
  });

  it('Case 2: isFollowingNow=true, timeIsPinned=true → no change (fixture values preserved)', () => {
    // Arrange: Mock "real clock" to 2026-07-15 (different from fixture)
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));

    const baseState = {
      appTime: {
        nowISO: '2026-06-01T12:00:00.000Z', // Fixture date
        activeDayKey: '2026-06-01',
        timeZone: APP_TIME_ZONE,
        isFollowingNow: true,
        timeIsPinned: true, // Pin is set — should NOT refresh
      },
      cyclesById: {},
      executionEvents: [],
      today: { blocks: [] },
      profilesById: { [DEFAULT_PROFILE_ID]: {} },
      activeProfileId: DEFAULT_PROFILE_ID,
    };

    // Act: Call the reducer with TICK_NOW action
    const next = identityReducer(baseState, { type: 'TICK_NOW' });

    // Assert: appTime should stay exactly as the fixture set it, unaffected by real clock
    expect(next.appTime.nowISO).toBe('2026-06-01T12:00:00.000Z');
    expect(next.appTime.activeDayKey).toBe('2026-06-01');
  });

  it('Case 3: isFollowingNow=false/unset → no change either way, outer condition gates correctly', () => {
    // Arrange: Mock "real clock" to 2026-07-15
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));

    const baseState = {
      appTime: {
        nowISO: '2026-06-01T12:00:00.000Z',
        activeDayKey: '2026-06-01',
        timeZone: APP_TIME_ZONE,
        isFollowingNow: false, // NOT following now
        // timeIsPinned unset, but irrelevant since isFollowingNow is false
      },
      cyclesById: {},
      executionEvents: [],
      today: { blocks: [] },
      profilesById: { [DEFAULT_PROFILE_ID]: {} },
      activeProfileId: DEFAULT_PROFILE_ID,
    };

    // Act: Call the reducer with TICK_NOW action
    const next = identityReducer(baseState, { type: 'TICK_NOW' });

    // Assert: appTime should NOT change (outer gate prevented refresh)
    expect(next.appTime.nowISO).toBe('2026-06-01T12:00:00.000Z');
    expect(next.appTime.activeDayKey).toBe('2026-06-01');
  });

  it('Case 4: timeIsPinned=true + isFollowingNow=true + stale fixture values → pin wins (the critical regression case)', () => {
    // This is the exact case that caused the 81 regressions:
    // - Test fixture sets oldDate (2026-06-21, two months ago)
    // - Real clock is now (2026-08-21, today)
    // - Without the pin guard, refresh would fire and break the test
    // - With timeIsPinned=true, fixture values are preserved

    // Arrange: Simulate production's "real clock" at 2026-08-21 (today)
    vi.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));

    const baseState = {
      appTime: {
        nowISO: '2026-06-21T12:00:00.000Z', // Fixture date from 2 months ago (the test pattern)
        activeDayKey: '2026-06-21',
        timeZone: APP_TIME_ZONE,
        isFollowingNow: true, // Following now (enabled)
        timeIsPinned: true, // PINNED — test is controlling time deliberately
      },
      cyclesById: {},
      executionEvents: [],
      today: { blocks: [] },
      profilesById: { [DEFAULT_PROFILE_ID]: {} },
      activeProfileId: DEFAULT_PROFILE_ID,
    };

    // Act: Call the reducer with TICK_NOW action
    const next = identityReducer(baseState, { type: 'TICK_NOW' });

    // Assert: Despite isFollowingNow=true and a 61-day gap, fixture values are preserved
    // This is the proof that the guard works: old fixture dates are not overwritten
    expect(next.appTime.nowISO).toBe('2026-06-21T12:00:00.000Z');
    expect(next.appTime.activeDayKey).toBe('2026-06-21');
  });
});
