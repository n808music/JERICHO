import { describe, it, expect } from 'vitest';
import { buildDraftScheduleItems } from '../draftSchedule.js';

function makeContract({ startDayKey = '2026-01-20', deadlineDayKey = '2026-01-25' } = {}) {
  return {
    startDate: startDayKey,
    deadline: {
      dayKey: deadlineDayKey,
      isHardDeadline: true
    }
  };
}

describe('buildDraftScheduleItems bounds', () => {
  it('filters out draft items before start date and after deadline', () => {
    const contract = makeContract();
    const suggested = [
      { dayKey: '2026-01-18', startISO: '2026-01-18T09:00:00.000Z', title: 'Pre-start', domain: 'Creation', id: 'pre' },
      { dayKey: '2026-01-20', startISO: '2026-01-20T09:00:00.000Z', title: 'In-range', domain: 'Focus', id: 'mid' }
    ];
    const route = [
      { dayKey: '2026-01-26', totalBlocks: 1, summary: 'Post', byDeliverable: {} },
      { dayKey: '2026-01-23', totalBlocks: 1, summary: 'Good', byDeliverable: {} }
    ];

    const items = buildDraftScheduleItems({
      suggestedBlocks: suggested,
      routeSuggestions: route,
      contract,
      timeZone: 'UTC',
      defaults: { todayKey: '2026-01-20', primaryDomain: 'Creation', routeMinutes: 60 }
    });

    expect(items.every((item) => item.dayKey >= '2026-01-20' && item.dayKey <= '2026-01-25')).toBe(true);
    expect(items.map((item) => item.dayKey)).toEqual(['2026-01-20', '2026-01-23']);
  });
});
