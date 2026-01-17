import { describe, expect, it } from 'vitest';
import { buildDraftScheduleItems, filterDraftItemsByDay } from '../../src/state/draftSchedule.js';

describe('Draft schedule builder', () => {
  it('merges suggested and route items deterministically and filters by contract start', () => {
    const suggested = [
      { id: 's1', title: 'Suggested soon', startISO: '2026-01-21T09:00:00.000Z', durationMinutes: 30, domain: 'CREATION' },
      { id: 's2', title: 'Suggested later', startISO: '2026-01-23T10:00:00.000Z', durationMinutes: 45, domain: 'FOCUS' }
    ];
    const route = [
      { dayKey: '2026-01-20', totalBlocks: 2 },
      { dayKey: '2026-01-21', totalBlocks: 1 }
    ];
    const contract = { startDate: '2026-01-21' };
    const items = buildDraftScheduleItems({
      suggestedBlocks: suggested,
      routeSuggestions: route,
      contract,
      defaults: { primaryDomain: 'CREATION' }
    });
    expect(items.every((item) => item.dayKey >= '2026-01-21')).toBe(true);
    expect(items[0].dayKey).toBe('2026-01-21');
    expect(items.some((item) => item.source === 'coldPlan')).toBe(true);
    expect(items.some((item) => item.source === 'suggestedPath')).toBe(true);
  });

  it('filters items for a given day key', () => {
    const items = [
      { dayKey: '2026-01-20', id: 'one' },
      { dayKey: '2026-01-20', id: 'two' },
      { dayKey: '2026-01-21', id: 'three' }
    ];
    const filtered = filterDraftItemsByDay(items, '2026-01-20');
    expect(filtered.map((item) => item.id)).toEqual(['one', 'two']);
  });
});
