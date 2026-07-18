import { describe, expect, it } from 'vitest';

import { buildBlankIdentityState } from '../../src/state/identityStore.js';
import { APP_TIME_ZONE } from '../../src/state/time/time.ts';

describe('identityStore timezone authority', () => {
  it('defaults blank identity state to Chicago when no explicit timezone is provided', () => {
    const state = buildBlankIdentityState({
      nowISO: '2026-06-14T12:00:00.000Z',
    });

    expect(state.appTime.timeZone).toBe(APP_TIME_ZONE);
    expect(state.appTime.activeDayKey).toBe('2026-06-14');
    expect(state.today.date).toBe('2026-06-14');
    expect(state.viewDate).toBe('2026-06-14');
  });
});
