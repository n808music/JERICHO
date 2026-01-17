import { describe, expect, it } from 'vitest';
import { getActiveGoalOutcomes } from '../../src/state/cycleSelectors.js';

describe('cycle selectors', () => {
  it('returns terminal outcomes only for active cycles', () => {
    const cycles = {
      'cycle-a': {
        id: 'cycle-a',
        status: 'active',
        goalContract: { terminalOutcome: { text: 'Complete the album' } },
      },
      'cycle-b': {
        id: 'cycle-b',
        status: 'ended',
        goalContract: { terminalOutcome: { text: 'Complete the proposal' } },
      },
      'cycle-c': {
        id: 'cycle-c',
        status: 'active',
        goalContract: { goalText: 'Finish the book' },
      },
    };
    const outcomes = getActiveGoalOutcomes(cycles);
    expect(outcomes).toContain('Complete the album');
    expect(outcomes).toContain('Finish the book');
    expect(outcomes).not.toContain('Complete the proposal');
  });

  it('returns an empty array when no active cycles exist', () => {
    const cycles = {
      'cycle-x': { id: 'cycle-x', status: 'ended', goalContract: { terminalOutcome: { text: 'Legacy goal' } } },
    };
    expect(getActiveGoalOutcomes(cycles)).toEqual([]);
  });
});
