import { describe, it, expect } from 'vitest';
import { projectSuggestionHistory } from '../../src/state/suggestionHistory.js';

describe('projectSuggestionHistory', () => {
  it('orders deterministically and enforces 14-day windowing (inclusive)', () => {
    const nowDayKey = '2026-01-08';
    const suggestionEvents = [
      {
        id: 'e1',
        type: 'suggested_block_created',
        proposalId: 's1',
        dayKey: '2026-01-07',
        atISO: '2026-01-07T10:00:00.000Z'
      },
      {
        id: 'e2',
        type: 'suggestion_rejected',
        suggestionId: 's2',
        reason: 'OVERCOMMITTED',
        dayKey: '2026-01-08',
        atISO: '2026-01-08T09:00:00.000Z'
      },
      {
        id: 'e3',
        type: 'suggested_block_accepted',
        proposalId: 's1',
        dayKey: '2026-01-08',
        atISO: '2026-01-08T08:00:00.000Z'
      },
      {
        id: 'e4',
        type: 'suggested_block_created',
        proposalId: 's3',
        dayKey: '2025-12-30',
        atISO: '2025-12-30T12:00:00.000Z'
      },
      {
        id: 'e5',
        type: 'suggestion_rejected',
        suggestionId: 's3',
        reason: 'TOO_LONG',
        dayKey: '2025-12-20',
        atISO: '2025-12-20T12:00:00.000Z'
      }
    ];
    const suggestionsById = new Map([
      ['s1', { id: 's1', title: 'Deep work sprint', domain: 'Creation' }]
    ]);

    const rows = projectSuggestionHistory({
      suggestionEvents,
      suggestionsById,
      nowDayKey,
      windowDays: 14
    });

    expect(rows.map((r) => r.id)).toEqual(['e3', 'e2', 'e1', 'e4']);
    expect(rows.find((r) => r.id === 'e2')?.archived).toBe(true);
    expect(rows.find((r) => r.id === 'e3')?.archived).toBe(false);
  });

  it('applies filters without mutating inputs', () => {
    const nowDayKey = '2026-01-08';
    const suggestionEvents = [
      {
        id: 'e1',
        type: 'suggested_block_created',
        proposalId: 's1',
        dayKey: '2026-01-07',
        atISO: '2026-01-07T10:00:00.000Z'
      },
      {
        id: 'e2',
        type: 'suggestion_rejected',
        suggestionId: 's2',
        reason: 'OVERCOMMITTED',
        dayKey: '2026-01-08',
        atISO: '2026-01-08T09:00:00.000Z'
      }
    ];
    const suggestionsById = { s1: { id: 's1', title: 'Sprint', domain: 'Creation' } };
    const before = JSON.stringify({ suggestionEvents, suggestionsById });

    const rows = projectSuggestionHistory({
      suggestionEvents,
      suggestionsById,
      nowDayKey,
      windowDays: 14,
      filters: { types: ['REJECTED'] }
    });
    const after = JSON.stringify({ suggestionEvents, suggestionsById });

    expect(rows.map((r) => r.id)).toEqual(['e2']);
    expect(before).toBe(after);
  });
});
