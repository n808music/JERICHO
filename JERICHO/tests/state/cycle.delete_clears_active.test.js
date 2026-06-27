import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function makeState() {
  const state = {
    appTime: { activeDayKey: '2026-01-09', timeZone: 'UTC', nowISO: '2026-01-09T00:00:00.000Z' },
    goalsById: { 'goal-1': { id: 'goal-1' } },
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        startedAtDayKey: '2026-01-01',
        executionEvents: [{ id: 'e1' }],
        suggestionEvents: [{ id: 's1' }],
        suggestedBlocks: [{ id: 'blk-s1' }],
        goalContract: { goalId: 'goal-1' },
      },
    },
    activeCycleId: 'cycle-1',
    today: { date: '2026-01-09', blocks: [{ id: 'b1' }] },
    currentWeek: { days: [{ date: '2026-01-09', blocks: [{ id: 'b1' }] }] },
    cycle: [{ date: '2026-01-09', blocks: [{ id: 'b1' }] }],
    suggestedBlocks: [{ id: 'blk-s1', cycleId: 'cycle-1', goalId: 'goal-1' }],
    proposedBlocks: [{ id: 'blk-p1', cycleId: 'cycle-1', goalId: 'goal-1' }],
    proposedBlocksByCycleId: { 'cycle-1': [{ id: 'blk-p1', cycleId: 'cycle-1', goalId: 'goal-1' }] },
    suggestionEvents: [{ id: 's1', cycleId: 'cycle-1' }],
    executionEvents: [{ id: 'e1', cycleId: 'cycle-1', goalId: 'goal-1' }],
    blockStore: {
      blocks: {
        'old-active': { id: 'old-active', cycleId: 'cycle-1', goalId: 'goal-1', title: 'Old May Block' },
        survivor: { id: 'survivor', cycleId: 'cycle-2', goalId: 'goal-2', title: 'Other Cycle Block' },
      },
    },
    suggestionHistory: { dayKey: '2026-01-09', count: 1 },
  };
  return state;
}

describe('Cycle deletion clearing active', () => {
  it('delete active cycle clears activeCycleId and UI projections', () => {
    const state = makeState();
    const next = computeDerivedState(state, { type: 'DELETE_CYCLE', cycleId: 'cycle-1' });
    expect(next.activeCycleId).toBeTruthy();
    expect(next.activeCycleId).not.toBe('cycle-1');
    expect(next.cyclesById['cycle-1']).toBeUndefined();
    expect(Array.isArray(next.today.blocks)).toBe(true);
    expect(next.today.blocks.length).toBe(0);
    expect(Array.isArray(next.cycle)).toBe(true);
    // calendar may render month grid, but all days should contain zero blocks
    expect(next.cycle.every((d) => Array.isArray(d.blocks) && d.blocks.length === 0)).toBe(true);
    expect(Array.isArray(next.suggestedBlocks)).toBe(true);
    expect(next.suggestedBlocks.length).toBe(0);
    expect(Array.isArray(next.executionEvents)).toBe(true);
    expect(next.executionEvents.every((event) => event?.cycleId !== 'cycle-1')).toBe(true);
    expect(Array.isArray(next.proposedBlocks)).toBe(true);
    expect(next.proposedBlocks.every((block) => block?.cycleId !== 'cycle-1')).toBe(true);
    expect(next.proposedBlocksByCycleId?.['cycle-1']).toBeUndefined();
    expect(next.blockStore?.blocks?.['old-active']).toBeUndefined();
    expect(next.blockStore?.blocks?.survivor).toBeTruthy();
    const replacement = next.cyclesById[next.activeCycleId];
    expect(replacement).toBeTruthy();
    expect(replacement.goalContract).toBeNull();
  });
});
