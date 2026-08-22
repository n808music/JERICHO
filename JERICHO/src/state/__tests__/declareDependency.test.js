/**
 * declareDependency.test.js
 *
 * DECLARE_DEPENDENCY originally only linked Artifacts. 2026-07-13 (phase/sequencing
 * design): generalized to also accept Project and Initiative ids — same edge shape,
 * same cycle guard — because phase derivation needs "what must happen before what" at
 * the Project/Initiative level, and the existing dependency concept was scoped one
 * abstraction level too low (artifact-to-artifact only) to ever answer that.
 */

import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

const NOW_ISO = '2026-01-10T12:00:00.000Z';

function buildState(matrix) {
  return {
    appTime: { nowISO: NOW_ISO, timeZone: 'UTC', activeDayKey: '2026-01-10' },
        timeIsPinned: true,
    activeCycleId: null,
    cyclesById: {},
    matrix,
  };
}

function declare(state, payload) {
  return computeDerivedState(state, { type: 'DECLARE_DEPENDENCY', payload });
}

describe('DECLARE_DEPENDENCY — generalized to Project/Initiative nodes', () => {
  it('still supports artifact-to-artifact edges (unchanged regression)', () => {
    const state = buildState({
      artifactsById: { a1: { id: 'a1', name: 'A1' }, a2: { id: 'a2', name: 'A2' } },
    });
    const next = declare(state, { id: 'd1', downstreamId: 'a2', upstreamId: 'a1', type: 'hard_gate' });
    expect(next.matrix.dependenciesById.d1).toBeDefined();
    expect(next.lastPlanError).toBeNull();
  });

  it('accepts a Project-to-Project dependency edge', () => {
    const state = buildState({
      projectsById: { p1: { id: 'p1', name: 'P1' }, p2: { id: 'p2', name: 'P2' } },
    });
    const next = declare(state, { id: 'd1', downstreamId: 'p2', upstreamId: 'p1', type: 'hard_gate' });
    expect(next.matrix.dependenciesById.d1).toEqual({
      id: 'd1',
      downstreamId: 'p2',
      upstreamId: 'p1',
      type: 'hard_gate',
      label: null,
      satisfactionMode: 'ALL',
      declaredAtISO: NOW_ISO,
    });
  });

  it('accepts an Initiative-to-Initiative dependency edge', () => {
    const state = buildState({
      initiativesById: { i1: { id: 'i1', name: 'I1' }, i2: { id: 'i2', name: 'I2' } },
    });
    const next = declare(state, { id: 'd1', downstreamId: 'i2', upstreamId: 'i1', type: 'directional' });
    expect(next.matrix.dependenciesById.d1).toBeDefined();
  });

  it('still rejects an unknown downstreamId/upstreamId across all three slices', () => {
    const state = buildState({ projectsById: { p1: { id: 'p1', name: 'P1' } } });
    const next = declare(state, { id: 'd1', downstreamId: 'does-not-exist', upstreamId: 'p1', type: 'hard_gate' });
    expect(next.matrix.dependenciesById.d1).toBeUndefined();
    expect(next.lastPlanError.code).toBe('DEPENDENCY_DOWNSTREAM_UNKNOWN');
  });

  it('still rejects a self-edge and still detects cycles across Project-level edges', () => {
    const state = buildState({
      projectsById: { p1: { id: 'p1', name: 'P1' }, p2: { id: 'p2', name: 'P2' } },
    });
    let next = declare(state, { id: 'd1', downstreamId: 'p2', upstreamId: 'p1', type: 'hard_gate' });
    next = declare(next, { id: 'd2', downstreamId: 'p1', upstreamId: 'p2', type: 'hard_gate' });
    expect(next.matrix.dependenciesById.d2).toBeUndefined();
    expect(next.lastPlanError.code).toBe('DEPENDENCY_CYCLE');
  });
});
