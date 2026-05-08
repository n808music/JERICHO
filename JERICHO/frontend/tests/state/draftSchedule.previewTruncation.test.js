import { describe, expect, it } from 'vitest';
import { selectVisibleDraftItems } from '../../src/state/suggestionFilters.js';

function buildItems(count) {
  return Array.from({ length: count }).map((_, index) => ({
    id: `d-${index + 1}`,
    dayKey: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
    startISO: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T09:00:00.000Z`,
    title: `Draft ${index + 1}`,
  }));
}

describe('draft schedule preview truncation', () => {
  it('caps visible draft rows at 20 by default', () => {
    const visible = selectVisibleDraftItems({
      cycle: {
        goalContract: {
          startDate: '2026-01-01',
          deadline: { dayKey: '2026-12-31' },
        },
      },
      draftItems: buildItems(40),
      timeZone: 'UTC',
    });

    expect(visible).toHaveLength(20);
  });
});
