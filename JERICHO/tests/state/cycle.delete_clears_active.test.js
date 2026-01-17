import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function makeState() {
  const state = {
    appTime: { activeDayKey: '2026-01-09', timeZone: 'UTC', nowISO: '2026-01-09T00:00:00.000Z' },
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        startedAtDayKey: '2026-01-01',
        executionEvents: [{ id: 'e1' }],
        suggestionEvents: [{ id: 's1' }],
        suggestedBlocks: [{ id: 'blk-s1' }]
      }
    },
    activeCycleId: 'cycle-1',
    today: { date: '2026-01-09', blocks: [{ id: 'b1' }] },
    currentWeek: { days: [{ date: '2026-01-09', blocks: [{ id: 'b1' }] }] },
    cycle: [{ date: '2026-01-09', blocks: [{ id: 'b1' }] }],
    suggestedBlocks: [{ id: 'blk-s1' }],
    suggestionEvents: [{ id: 's1' }],
    executionEvents: [{ id: 'e1' }],
    suggestionHistory: { dayKey: '2026-01-09', count: 1 }
  };
  return state;
}

describe('Cycle deletion clearing active', () => {
  it('delete active cycle clears activeCycleId and UI projections', () => {
    const state = makeState();
    const next = computeDerivedState(state, { type: 'DELETE_CYCLE', cycleId: 'cycle-1' });
    expect(next.activeCycleId).toBe(null);
    expect(Array.isArray(next.today.blocks)).toBe(true);
    expect(next.today.blocks.length).toBe(0);
    expect(Array.isArray(next.cycle)).toBe(true);
    // calendar may render month grid, but all days should contain zero blocks
    expect(next.cycle.every((d) => Array.isArray(d.blocks) && d.blocks.length === 0)).toBe(true);
    expect(Array.isArray(next.suggestedBlocks)).toBe(true);
    expect(next.suggestedBlocks.length).toBe(0);
  });
});
