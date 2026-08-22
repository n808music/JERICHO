import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { identityReducer, DEFAULT_PROFILE_ID } from '../identityStore.js';
import { APP_TIME_ZONE } from '../time/time.ts';

describe('E9-Site3: JUMP_TO_TODAY staleness bug (unguarded mutation)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('FAILS: timeIsPinned=true + JUMP_TO_TODAY → fixture dates are overwritten (BUG REPRODUCTION)', () => {
    // Arrange: Fixture sets time to 2026-06-21 (61 days ago)
    // Real clock mocked to 2026-08-21 (today)
    vi.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));

    const baseState = {
      appTime: {
        nowISO: '2026-06-21T12:00:00.000Z', // Fixture time, pinned
        activeDayKey: '2026-06-21',
        timeZone: APP_TIME_ZONE,
        isFollowingNow: true,
        timeIsPinned: true, // Test is explicitly pinning this time
      },
      cyclesById: {},
      executionEvents: [],
      today: { blocks: [] },
      profilesById: { [DEFAULT_PROFILE_ID]: {} },
      activeProfileId: DEFAULT_PROFILE_ID,
    };

    // Act: User triggers JUMP_TO_TODAY action (e.g., clicked button in ZionDashboard)
    const next = identityReducer(baseState, { type: 'JUMP_TO_TODAY' });

    // Assert: EXPECTED behavior (what SHOULD happen if Site 3 were guarded):
    // Fixture dates should be preserved because timeIsPinned=true
    // expect(next.appTime.nowISO).toBe('2026-06-21T12:00:00.000Z');
    // expect(next.appTime.activeDayKey).toBe('2026-06-21');

    // ACTUAL behavior (current bug):
    // Site 3 overwrites fixture dates with fresh time, ignoring timeIsPinned
    expect(next.appTime.nowISO).toBe('2026-08-21T12:00:00.000Z'); // ← WRONG, should be '2026-06-21'
    expect(next.appTime.activeDayKey).toBe('2026-08-21'); // ← WRONG, should be '2026-06-21'
  });

  it('EXPECTED (after fix): timeIsPinned=true + JUMP_TO_TODAY → fixture dates preserved', () => {
    // This test documents the expected behavior once Site 3 is fixed with setAppTime guard
    // Currently this test would fail, proving the fix is needed.
    vi.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));

    const baseState = {
      appTime: {
        nowISO: '2026-06-21T12:00:00.000Z',
        activeDayKey: '2026-06-21',
        timeZone: APP_TIME_ZONE,
        isFollowingNow: true,
        timeIsPinned: true,
      },
      cyclesById: {},
      executionEvents: [],
      today: { blocks: [] },
      profilesById: { [DEFAULT_PROFILE_ID]: {} },
      activeProfileId: DEFAULT_PROFILE_ID,
    };

    const next = identityReducer(baseState, { type: 'JUMP_TO_TODAY' });

    // This should pass once JUMP_TO_TODAY is guarded
    // Skip for now since the bug is unguarded
    expect(next.appTime.nowISO).toBe('2026-06-21T12:00:00.000Z');
    expect(next.appTime.activeDayKey).toBe('2026-06-21');
  });
});
