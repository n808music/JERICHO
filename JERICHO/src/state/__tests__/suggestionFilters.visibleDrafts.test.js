import { describe, it, expect } from 'vitest';
import { selectVisibleDraftItems } from '../suggestionFilters.js';

describe('selectVisibleDraftItems', () => {
  const cycle = {
    goalContract: {
      startDate: '2026-01-20',
      deadline: { dayKey: '2026-01-25' }
    }
  };

  const draftItems = [
    { dayKey: '2026-01-19', title: 'Pre-start' },
    { dayKey: '2026-01-20', title: 'Outline work' },
    { dayKey: '2026-01-26', title: 'After deadline' }
  ];

  it('filters items outside bounds', () => {
    const visible = selectVisibleDraftItems({ cycle, draftItems });
    expect(visible.map((item) => item.dayKey)).toEqual(['2026-01-20']);
  });

  it('returns empty list when no contract', () => {
    const visible = selectVisibleDraftItems({ cycle: null, draftItems });
    expect(visible).toEqual([]);
  });
});
