import { describe, expect, it } from 'vitest';
import {
  filterSuggestedBlocksByStartDate,
  filterSuggestionsByStartDayKey,
  isBeforeStartDate
} from '../../src/state/suggestionFilters.js';

describe('suggestion filters', () => {
  it('drops suggestions before the start date', () => {
    const startISO = '2026-01-20T00:00:00.000Z';
    const blocks = [
      { id: 'before', startISO: '2026-01-19T08:00:00.000Z' },
      { id: 'during', startISO: '2026-01-20T09:00:00.000Z' },
      { id: 'after', startISO: '2026-01-21T10:00:00.000Z' }
    ];
    const result = filterSuggestedBlocksByStartDate(blocks, startISO, 'UTC');
    expect(result.map((b) => b.id)).toEqual(['during', 'after']);
    expect(isBeforeStartDate('2026-01-19', startISO)).toBe(true);
    expect(isBeforeStartDate('2026-01-20', startISO)).toBe(false);
  });

  it('keeps suggestions on or after the start day key', () => {
    const startDayKey = '2026-01-20';
    const suggestions = [
      { id: 'pre', dayKey: '2026-01-19' },
      { id: 'start', dayKey: '2026-01-20' },
      { id: 'post', dayKey: '2026-01-21' },
      { id: 'unknown' }
    ];
    const filtered = filterSuggestionsByStartDayKey(suggestions, startDayKey, 'UTC');
    expect(filtered.map((s) => s.id)).toEqual(['start', 'post', 'unknown']);
  });
});
