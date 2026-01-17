import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function baseState() {
  return {
    appTime: { activeDayKey: '2026-01-09', timeZone: 'UTC', nowISO: '2026-01-09T00:00:00.000Z' },
    cyclesById: {
      'cycle-old': { id: 'cycle-old', status: 'active', startedAtDayKey: '2025-12-01' }
    },
    activeCycleId: 'cycle-old',
    today: { date: '2026-01-09', blocks: [{ id: 'b1' }] },
    currentWeek: { days: [{ date: '2026-01-09', blocks: [{ id: 'b1' }] }] },
    cycle: [{ date: '2026-01-09', blocks: [{ id: 'b1' }] }]
  };
}

describe('Start new cycle resets UI and requires intake', () => {
  it('startNewCycle creates a new activeCycle and clears calendar data', () => {
    const state = baseState();
    const next = computeDerivedState(state, { type: 'START_NEW_CYCLE', payload: { goalText: '', deadlineDayKey: '' } });
    // New active cycle created
    expect(next.activeCycleId).not.toBe(null);
    expect(next.activeCycleId).not.toBe('cycle-old');
    // UI projections cleared
    expect(Array.isArray(next.today.blocks)).toBe(true);
    expect(next.today.blocks.length).toBe(0);
    expect(Array.isArray(next.cycle)).toBe(true);
    // month grid may exist; ensure no blocks are present after starting a new cycle
    expect(next.cycle.every((d) => Array.isArray(d.blocks) && d.blocks.length === 0)).toBe(true);
  });
});
