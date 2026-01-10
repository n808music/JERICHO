import { describe, it, expect } from 'vitest';
import { rehydrateSuggestionRejections } from '../../src/state/identityCompute.js';

describe('rehydrateSuggestionRejections', () => {
  it('applies suggestion_rejected events deterministically', () => {
    const suggestions = [
      { id: 's1', status: 'suggested', rejectedReason: null, title: 'One' },
      { id: 's2', status: 'suggested', rejectedReason: null, title: 'Two' },
      { id: 's3', status: 'suggested', rejectedReason: null, title: 'Three' }
    ];
    const events = [
      {
        type: 'suggestion_rejected',
        suggestionId: 's2',
        reason: 'OVERCOMMITTED',
        dayKey: '2026-01-02',
        contractId: 'gov-1',
        planId: 'plan-1',
        atISO: '2026-01-02T12:00:00.000Z'
      }
    ];
    const next = rehydrateSuggestionRejections(suggestions, events);
    expect(next).toEqual([
      { id: 's1', status: 'suggested', rejectedReason: null, title: 'One' },
      { id: 's2', status: 'rejected', rejectedReason: 'OVERCOMMITTED', title: 'Two' },
      { id: 's3', status: 'suggested', rejectedReason: null, title: 'Three' }
    ]);
    const again = rehydrateSuggestionRejections(next, events);
    expect(again).toEqual(next);
  });

  it('handles multiple rejection events and ignores non-rejection events', () => {
    const suggestions = [
      { id: 'a', status: 'suggested', rejectedReason: null },
      { id: 'b', status: 'suggested', rejectedReason: null },
      { id: 'c', status: 'suggested', rejectedReason: null }
    ];
    const events = [
      {
        type: 'suggestion_rejected',
        suggestionId: 'a',
        reason: 'TOO_LONG',
        dayKey: '2026-01-02',
        contractId: 'gov-1',
        planId: 'plan-1',
        atISO: '2026-01-02T12:00:00.000Z'
      },
      {
        type: 'suggestion_rejected',
        suggestionId: 'c',
        reason: 'WRONG_TIME',
        dayKey: '2026-01-03',
        contractId: 'gov-1',
        planId: 'plan-1',
        atISO: '2026-01-03T12:00:00.000Z'
      },
      {
        type: 'calibration_days_per_week_set',
        daysPerWeek: 4,
        dayKey: '2026-01-03',
        contractId: 'gov-1',
        planId: 'plan-1',
        atISO: '2026-01-03T12:00:00.000Z'
      }
    ];
    const next = rehydrateSuggestionRejections(suggestions, events);
    expect(next).toEqual([
      { id: 'a', status: 'rejected', rejectedReason: 'TOO_LONG' },
      { id: 'b', status: 'suggested', rejectedReason: null },
      { id: 'c', status: 'rejected', rejectedReason: 'WRONG_TIME' }
    ]);
  });
});
