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

  it('JUMP_TO_TODAY: unpinned + fresh clock → sets fresh time', () => {
    // JUMP_TO_TODAY always sets fresh time (it's an explicit user action).
    // Unpinned state: dates should refresh (normal behavior).
    vi.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));

    const baseState = {
      appTime: {
        nowISO: '2026-06-21T12:00:00.000Z', // Stale persisted date
        activeDayKey: '2026-06-21',
        timeZone: APP_TIME_ZONE,
        isFollowingNow: true,
        timeIsPinned: false, // Not pinned
      },
      cyclesById: {},
      executionEvents: [],
      today: { blocks: [] },
      profilesById: { [DEFAULT_PROFILE_ID]: {} },
      activeProfileId: DEFAULT_PROFILE_ID,
    };

    const next = identityReducer(baseState, { type: 'JUMP_TO_TODAY' });

    // User clicked "Jump to Today" → should show today's date, not stale date
    expect(next.appTime.nowISO).toBe('2026-08-21T12:00:00.000Z');
    expect(next.appTime.activeDayKey).toBe('2026-08-21');
  });

  it('JUMP_TO_TODAY: pinned + fresh clock → overrides pin (explicit action)', () => {
    // Design decision: JUMP_TO_TODAY is an explicit, deliberate user action.
    // It always sets fresh time, overriding timeIsPinned.
    // Rationale: the pin protects against *automatic* refresh (TICK_NOW).
    // It does not neuter an explicit button press.
    vi.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));

    const baseState = {
      appTime: {
        nowISO: '2026-06-21T12:00:00.000Z', // Test fixture date
        activeDayKey: '2026-06-21',
        timeZone: APP_TIME_ZONE,
        isFollowingNow: true,
        timeIsPinned: true, // Test explicitly pinned the time
      },
      cyclesById: {},
      executionEvents: [],
      today: { blocks: [] },
      profilesById: { [DEFAULT_PROFILE_ID]: {} },
      activeProfileId: DEFAULT_PROFILE_ID,
    };

    const next = identityReducer(baseState, { type: 'JUMP_TO_TODAY' });

    // User explicitly clicked the button → shows today, not the test's pinned date.
    // If test needs the pinned date to survive, the test should not dispatch JUMP_TO_TODAY.
    expect(next.appTime.nowISO).toBe('2026-08-21T12:00:00.000Z');
    expect(next.appTime.activeDayKey).toBe('2026-08-21');
  });
});
