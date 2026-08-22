/**
 * setInitiativePhase.test.js
 *
 * SET_INITIATIVE_PHASE is the coarse-grained phasing follow-up (2026-07-13): declare a
 * beginning/middle/end phase once per Initiative instead of via pairwise Project
 * dependency declarations, which the operator confirmed don't scale at real portfolio
 * size (18 unrelated CONFIRMED Projects across 10 Initiatives). A direct one-field set,
 * mirroring CONFIRM_CAPACITY's simplicity — no survey, no graph edge.
 */

import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const NOW_ISO = '2026-01-10T12:00:00.000Z';

function buildState(initiative) {
  return {
    appTime: { nowISO: NOW_ISO, timeZone: 'UTC', activeDayKey: '2026-01-10' },
        timeIsPinned: true,
    activeCycleId: null,
    cyclesById: {},
    matrix: {
      entitiesById: {},
      initiativesById: { i1: initiative },
    },
  };
}

describe('SET_INITIATIVE_PHASE', () => {
  it('sets phase on an initiative that has none', () => {
    const state = buildState({ id: 'i1', name: 'Launch Initiative', phase: null });
    const next = computeDerivedState(state, {
      type: 'SET_INITIATIVE_PHASE',
      payload: { id: 'i1', phase: '1' },
    });
    expect(next.matrix.initiativesById.i1.phase).toBe('1');
  });

  it('overwrites an existing phase', () => {
    const state = buildState({ id: 'i1', name: 'Launch Initiative', phase: '1' });
    const next = computeDerivedState(state, {
      type: 'SET_INITIATIVE_PHASE',
      payload: { id: 'i1', phase: '3' },
    });
    expect(next.matrix.initiativesById.i1.phase).toBe('3');
  });

  it('clears phase back to null when payload.phase is null', () => {
    const state = buildState({ id: 'i1', name: 'Launch Initiative', phase: '2' });
    const next = computeDerivedState(state, {
      type: 'SET_INITIATIVE_PHASE',
      payload: { id: 'i1', phase: null },
    });
    expect(next.matrix.initiativesById.i1.phase).toBeNull();
  });

  it('does not touch any other field on the initiative', () => {
    const state = buildState({ id: 'i1', name: 'Launch Initiative', purpose: 'Ship it', phase: null });
    const next = computeDerivedState(state, {
      type: 'SET_INITIATIVE_PHASE',
      payload: { id: 'i1', phase: '2' },
    });
    expect(next.matrix.initiativesById.i1.name).toBe('Launch Initiative');
    expect(next.matrix.initiativesById.i1.purpose).toBe('Ship it');
  });

  it('is a no-op (with lastPlanError) for an unknown initiative id', () => {
    const state = buildState({ id: 'i1', name: 'Launch Initiative', phase: null });
    const next = computeDerivedState(state, {
      type: 'SET_INITIATIVE_PHASE',
      payload: { id: 'does-not-exist', phase: '1' },
    });
    expect(next.matrix.initiativesById.i1.phase).toBeNull();
    expect(next.lastPlanError?.code).toBe('INITIATIVE_UNKNOWN');
  });

  it('is a no-op (with lastPlanError) for a missing id', () => {
    const state = buildState({ id: 'i1', name: 'Launch Initiative', phase: null });
    const next = computeDerivedState(state, {
      type: 'SET_INITIATIVE_PHASE',
      payload: { phase: '1' },
    });
    expect(next.lastPlanError?.code).toBe('INITIATIVE_PHASE_INVALID');
  });
});
