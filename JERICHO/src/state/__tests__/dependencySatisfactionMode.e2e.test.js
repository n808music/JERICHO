import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../identityCompute.js';

/**
 * End-to-end verification: dependency satisfactionMode flows from DECLARE_DEPENDENCY
 * through state.matrix.dependenciesById, is readable by calling code.
 * This confirms the data path works (not empty, correctly populated).
 */
describe('Dependency Satisfaction Mode — End-to-End Data Path', () => {
  const NOW_ISO = '2026-08-07T15:30:00Z';

  function buildState(matrix = {}) {
    return {
      appTime: { nowISO: NOW_ISO, timeZone: 'UTC', activeDayKey: '2026-08-07' },
        timeIsPinned: true,
      matrix: {
        projectsById: {},
        initiativesById: {},
        artifactsById: {},
        dependenciesById: {},
        ...matrix,
      },
    };
  }

  it('satisfactionMode is stored in state.matrix.dependenciesById and is readable', () => {
    const state = buildState({
      projectsById: { p1: { id: 'p1', name: 'P1' }, p2: { id: 'p2', name: 'P2' } },
    });

    // Declare dependency with ANY_ONE mode
    const next = computeDerivedState(state, {
      type: 'DECLARE_DEPENDENCY',
      payload: {
        id: 'd1',
        downstreamId: 'p2',
        upstreamId: 'p1',
        type: 'hard_gate',
        satisfactionMode: 'ANY_ONE',
      },
    });

    // Verify it's stored and accessible (not empty, not lost)
    expect(next.matrix.dependenciesById.d1).toBeDefined(
      'Dependency edge must be stored in matrix'
    );
    const edge = next.matrix.dependenciesById.d1;
    expect(edge.satisfactionMode).toBe('ANY_ONE',
      'satisfactionMode must persist through state store (not lost or corrupted)'
    );
    expect(edge.upstreamId).toBe('p1');
    expect(edge.downstreamId).toBe('p2');
  });

  it('default satisfactionMode is ALL when not specified', () => {
    const state = buildState({
      projectsById: { p1: { id: 'p1', name: 'P1' }, p2: { id: 'p2', name: 'P2' } },
    });

    // Declare dependency WITHOUT specifying satisfactionMode
    const next = computeDerivedState(state, {
      type: 'DECLARE_DEPENDENCY',
      payload: {
        id: 'd1',
        downstreamId: 'p2',
        upstreamId: 'p1',
        type: 'hard_gate',
        // satisfactionMode deliberately omitted to test default
      },
    });

    // Verify it defaults to 'ALL'
    const edge = next.matrix.dependenciesById.d1;
    expect(edge.satisfactionMode).toBe('ALL',
      'satisfactionMode must default to ALL for backward compatibility'
    );
  });

  it('dependenciesById is not empty — data flows correctly through reducer', () => {
    const state = buildState({
      projectsById: { p1: { id: 'p1' }, p2: { id: 'p2' }, p3: { id: 'p3' } },
    });

    let next = state;
    // Declare multiple dependencies
    next = computeDerivedState(next, {
      type: 'DECLARE_DEPENDENCY',
      payload: { id: 'd1', upstreamId: 'p1', downstreamId: 'p2', type: 'hard_gate', satisfactionMode: 'ANY_ONE' },
    });
    next = computeDerivedState(next, {
      type: 'DECLARE_DEPENDENCY',
      payload: { id: 'd2', upstreamId: 'p2', downstreamId: 'p3', type: 'directional', satisfactionMode: 'ALL' },
    });

    // Verify both are in state and accessible (proving data wasn't lost in transit)
    expect(Object.keys(next.matrix.dependenciesById).length).toBeGreaterThanOrEqual(2,
      'dependenciesById must contain all declared edges (not empty or incomplete)'
    );
    expect(next.matrix.dependenciesById.d1.satisfactionMode).toBe('ANY_ONE');
    expect(next.matrix.dependenciesById.d2.satisfactionMode).toBe('ALL');
  });
});
