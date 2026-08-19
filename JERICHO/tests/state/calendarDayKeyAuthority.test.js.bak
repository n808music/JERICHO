import { describe, expect, it } from 'vitest';

import { getBlockDayKey, projectMonthDays } from '../../src/state/identityCompute.js';

describe('calendar day-key authority', () => {
  it('prefers app-local startISO day over stale explicit date fields', () => {
    const block = {
      id: 'blk-1',
      date: '2026-06-16',
      dayKey: '2026-06-16',
      startISO: '2026-06-17T14:00:00.000Z',
      title: 'Canonical June 17 block',
    };

    expect(getBlockDayKey(block)).toBe('2026-06-17');
  });

  it('projects a Chicago June 17 block onto June 17, not June 16', () => {
    const block = {
      id: 'blk-1',
      date: '2026-06-16',
      dayKey: '2026-06-16',
      startISO: '2026-06-17T14:00:00.000Z',
      title: 'Canonical June 17 block',
    };

    const days = projectMonthDays({
      monthKey: '2026-06-01',
      blocks: [block],
      includePadding: false,
    });

    const june16 = days.find((day) => day.date === '2026-06-16');
    const june17 = days.find((day) => day.date === '2026-06-17');

    expect(june16?.blocks || []).toHaveLength(0);
    expect(june17?.blocks || []).toHaveLength(1);
    expect(june17?.blocks?.[0]?.title).toBe('Canonical June 17 block');
  });
});
