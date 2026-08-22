/**
 * confirmCapacity.test.js
 *
 * CONFIRM_CAPACITY is the lightweight, one-click reconfirm for a capacity row that was
 * carried forward from legacy constraints (or declared directly) — it flips
 * reviewStatus to CONFIRMED with no elicitation-engine survey involved. Part of the
 * 2026-07-13 unified-schedule-generation design (§7.3).
 */

import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const NOW_ISO = '2026-01-10T12:00:00.000Z';

function buildState(capacityRow) {
  return {
    appTime: { nowISO: NOW_ISO, timeZone: 'UTC', activeDayKey: '2026-01-10' },
        timeIsPinned: true,
    activeCycleId: null,
    cyclesById: {},
    matrix: {
      entitiesById: {},
      capacityById: { c1: capacityRow },
    },
  };
}

describe('CONFIRM_CAPACITY', () => {
  it('advances a DRAFT capacity row to CONFIRMED', () => {
    const state = buildState({ id: 'c1', owningEntityId: 'e1', reviewStatus: 'DRAFT' });
    const next = computeDerivedState(state, { type: 'CONFIRM_CAPACITY', payload: { id: 'c1' } });
    expect(next.matrix.capacityById.c1.reviewStatus).toBe('CONFIRMED');
  });

  it('advances a NEEDS_REVIEW capacity row to CONFIRMED', () => {
    const state = buildState({ id: 'c1', owningEntityId: 'e1', reviewStatus: 'NEEDS_REVIEW' });
    const next = computeDerivedState(state, { type: 'CONFIRM_CAPACITY', payload: { id: 'c1' } });
    expect(next.matrix.capacityById.c1.reviewStatus).toBe('CONFIRMED');
  });

  it('is a no-op for an unknown id', () => {
    const state = buildState({ id: 'c1', owningEntityId: 'e1', reviewStatus: 'DRAFT' });
    const next = computeDerivedState(state, { type: 'CONFIRM_CAPACITY', payload: { id: 'does-not-exist' } });
    expect(next.matrix.capacityById.c1.reviewStatus).toBe('DRAFT');
  });

  it('is a no-op when already CONFIRMED (does not touch other fields)', () => {
    const state = buildState({ id: 'c1', owningEntityId: 'e1', reviewStatus: 'CONFIRMED', maxBlocksPerDay: 3 });
    const next = computeDerivedState(state, { type: 'CONFIRM_CAPACITY', payload: { id: 'c1' } });
    expect(next.matrix.capacityById.c1).toEqual({ id: 'c1', owningEntityId: 'e1', reviewStatus: 'CONFIRMED', maxBlocksPerDay: 3 });
  });

  it('does not affect other capacity rows', () => {
    const state = buildState({ id: 'c1', owningEntityId: 'e1', reviewStatus: 'DRAFT' });
    state.matrix.capacityById.c2 = { id: 'c2', owningEntityId: 'e2', reviewStatus: 'DRAFT' };
    const next = computeDerivedState(state, { type: 'CONFIRM_CAPACITY', payload: { id: 'c1' } });
    expect(next.matrix.capacityById.c1.reviewStatus).toBe('CONFIRMED');
    expect(next.matrix.capacityById.c2.reviewStatus).toBe('DRAFT');
  });
});
