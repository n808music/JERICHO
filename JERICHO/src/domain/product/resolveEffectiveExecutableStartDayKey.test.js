import { describe, expect, it } from 'vitest';

import { resolveEffectiveExecutableStartDayKey } from './resolveEffectiveExecutableStartDayKey.js';

describe('resolveEffectiveExecutableStartDayKey', () => {
  it('prefers the explicit live execution floor over an earlier contract start', () => {
    expect(
      resolveEffectiveExecutableStartDayKey({
        executionStartDayKey: '2026-06-08',
        fallbackStartDayKey: '2026-05-19',
      })
    ).toBe('2026-06-08');
  });

  it('uses the generated schedule day as the floor when no execution floor exists yet', () => {
    expect(
      resolveEffectiveExecutableStartDayKey({
        scheduleGeneratedAtISO: '2026-06-07T03:11:21.442Z',
        fallbackStartDayKey: '2026-05-19',
      })
    ).toBe('2026-06-07');
  });

  it('does not move the floor earlier than the canonical contract start', () => {
    expect(
      resolveEffectiveExecutableStartDayKey({
        reassessmentCompletedAtISO: '2026-06-07T02:29:09.880Z',
        fallbackStartDayKey: '2026-10-17',
      })
    ).toBe('2026-10-17');
  });
});
