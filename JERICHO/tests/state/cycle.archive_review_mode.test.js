import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function makeState() {
  return {
    appTime: { activeDayKey: '2026-01-09', timeZone: 'UTC', nowISO: '2026-01-09T00:00:00.000Z' },
    cyclesById: {
      'cycle-1': { id: 'cycle-1', status: 'active', startedAtDayKey: '2026-01-01', executionEvents: [{ id: 'e1' }] }
    },
    activeCycleId: 'cycle-1',
    today: { date: '2026-01-09', blocks: [{ id: 'b1' }] },
    currentWeek: { days: [{ date: '2026-01-09', blocks: [{ id: 'b1' }] }] },
    cycle: [{ date: '2026-01-09', blocks: [{ id: 'b1' }] }]
  };
}

describe('Cycle archive (end) review mode', () => {
  it('endCycle archives and clears active view but preserves cycle data', () => {
    const state = makeState();
    const next = computeDerivedState(state, { type: 'END_CYCLE', cycleId: 'cycle-1' });
    expect(next.cyclesById['cycle-1'].status).toBe('ended');
    expect(next.activeCycleId).toBe(null);
    // top-level UI projections cleared
    expect(Array.isArray(next.today.blocks)).toBe(true);
    expect(next.today.blocks.length).toBe(0);
    expect(Array.isArray(next.cycle)).toBe(true);
    // calendar may render month grid, but archived cycle should show no active blocks
    expect(next.cycle.every((d) => Array.isArray(d.blocks) && d.blocks.length === 0)).toBe(true);
    // underlying cycle data preserved
    expect(Array.isArray(next.cyclesById['cycle-1'].executionEvents)).toBe(true);
  });
});
