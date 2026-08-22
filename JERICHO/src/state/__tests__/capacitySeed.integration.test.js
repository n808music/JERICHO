/**
 * capacitySeed.integration.test.js
 *
 * Confirms ensureCapacitySeed (identityCompute.js) actually fires inside the real
 * computeDerivedState pipeline: an active cycle with legacy goalContract.workWindows
 * data gets a DRAFT matrix.capacityById row seeded automatically, once, without the
 * operator entering anything new — per the 2026-07-13 unified-schedule-generation
 * design (§7.3).
 */

import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const NOW_ISO = '2026-01-10T12:00:00.000Z';

function buildState({ workWindows = null, matrix = {} } = {}) {
  const cycleId = 'cycle-1';
  return {
    appTime: { nowISO: NOW_ISO, timeZone: 'UTC', activeDayKey: '2026-01-10' },
        timeIsPinned: true,
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'Active',
        startedAtDayKey: '2026-01-10',
        goalContract: workWindows ? { workWindows } : {},
      },
    },
    cycleOrder: [cycleId],
    matrix: {
      entitiesById: { e1: { id: 'e1', name: 'Global State Corp.', reviewStatus: 'CONFIRMED' } },
      ...matrix,
    },
  };
}

describe('ensureCapacitySeed — wired into computeDerivedState', () => {
  it('seeds a DRAFT capacity row from goalContract.workWindows on any state change', () => {
    const workWindows = {
      mon: [{ start: '09:00', end: '12:00' }],
      tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
    };
    const state = buildState({ workWindows });
    const next = computeDerivedState(state, { type: 'NO_OP' });

    const rows = Object.values(next.matrix.capacityById || {});
    expect(rows).toHaveLength(1);
    expect(rows[0].owningEntityId).toBe('e1');
    expect(rows[0].workWindows).toEqual(workWindows);
    expect(rows[0].reviewStatus).toBe('DRAFT');
  });

  it('does not reseed (or overwrite) once a capacity row already exists for the entity', () => {
    const workWindows = { mon: [{ start: '09:00', end: '12:00' }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
    const existing = {
      c1: { id: 'c1', owningEntityId: 'e1', reviewStatus: 'CONFIRMED', workWindows: { mon: [{ start: '06:00', end: '07:00' }] } },
    };
    const state = buildState({ workWindows, matrix: { capacityById: existing } });
    const next = computeDerivedState(state, { type: 'NO_OP' });

    const rows = Object.values(next.matrix.capacityById || {});
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('c1');
    expect(rows[0].reviewStatus).toBe('CONFIRMED'); // untouched, not clobbered by the seed
  });

  it('leaves capacityById empty when there is nothing to carry forward', () => {
    const state = buildState({});
    const next = computeDerivedState(state, { type: 'NO_OP' });
    expect(Object.keys(next.matrix.capacityById || {})).toHaveLength(0);
  });
});
