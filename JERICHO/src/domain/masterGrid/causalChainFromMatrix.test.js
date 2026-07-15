import { describe, it, expect } from 'vitest';
import { buildCausalChainStepsFromMatrix } from './causalChainFromMatrix.js';

describe('buildCausalChainStepsFromMatrix', () => {
  it('returns [] for an empty matrix (preserves generic fallback)', () => {
    expect(buildCausalChainStepsFromMatrix({})).toEqual([]);
    expect(buildCausalChainStepsFromMatrix(undefined)).toEqual([]);
  });

  it('returns [] when projects exist but none are CONFIRMED', () => {
    const matrix = {
      projectsById: {
        p1: { id: 'p1', name: 'Draft Project', reviewStatus: 'DRAFT' },
        p2: { id: 'p2', name: 'Needs Review Project', reviewStatus: 'NEEDS_REVIEW' },
      },
    };
    expect(buildCausalChainStepsFromMatrix(matrix)).toEqual([]);
  });

  it('emits one sequential step per CONFIRMED project, sequence starting at 1', () => {
    const matrix = {
      projectsById: {
        p1: { id: 'p1', name: 'Ship MVP', reviewStatus: 'CONFIRMED', phase: '1' },
        p2: { id: 'p2', name: 'Harden Auth', reviewStatus: 'CONFIRMED', phase: '2' },
      },
    };
    expect(buildCausalChainStepsFromMatrix(matrix)).toEqual([
      { sequence: 1, description: 'Ship MVP', projectId: 'p1' },
      { sequence: 2, description: 'Harden Auth', projectId: 'p2' },
    ]);
  });

  it('excludes DRAFT/NEEDS_REVIEW projects while including CONFIRMED ones from the same matrix', () => {
    const matrix = {
      projectsById: {
        p1: { id: 'p1', name: 'Confirmed Work', reviewStatus: 'CONFIRMED', phase: '1' },
        p2: { id: 'p2', name: 'Draft Work', reviewStatus: 'DRAFT', phase: '2' },
      },
    };
    expect(buildCausalChainStepsFromMatrix(matrix)).toEqual([
      { sequence: 1, description: 'Confirmed Work', projectId: 'p1' },
    ]);
  });

  it('sorts by numeric-aware project phase (10 after 2, not before)', () => {
    const matrix = {
      projectsById: {
        p10: { id: 'p10', name: 'Phase Ten', reviewStatus: 'CONFIRMED', phase: '10' },
        p2: { id: 'p2', name: 'Phase Two', reviewStatus: 'CONFIRMED', phase: '2' },
        p1: { id: 'p1', name: 'Phase One', reviewStatus: 'CONFIRMED', phase: '1' },
      },
    };
    expect(buildCausalChainStepsFromMatrix(matrix).map((s) => s.description)).toEqual([
      'Phase One',
      'Phase Two',
      'Phase Ten',
    ]);
  });

  it('projects with no own phase inherit their owning initiative\'s declared phase (2026-07-13 phasing-scalability follow-up); projects with neither sort last', () => {
    const matrix = {
      initiativesById: {
        i1: { id: 'i1', name: 'Initiative Early', phase: '1' },
        i2: { id: 'i2', name: 'Initiative Late', phase: '2' },
      },
      projectsById: {
        pNoPhase: { id: 'pNoPhase', name: 'No Phase Project', reviewStatus: 'CONFIRMED', phase: null },
        pPhased: { id: 'pPhased', name: 'Phased Project', reviewStatus: 'CONFIRMED', phase: '1' },
        pLateInitiative: {
          id: 'pLateInitiative',
          name: 'Late Initiative Project',
          reviewStatus: 'CONFIRMED',
          phase: null,
          owningInitiativeId: 'i2',
        },
        pEarlyInitiative: {
          id: 'pEarlyInitiative',
          name: 'Early Initiative Project',
          reviewStatus: 'CONFIRMED',
          phase: null,
          owningInitiativeId: 'i1',
        },
      },
    };
    const descriptions = buildCausalChainStepsFromMatrix(matrix).map((s) => s.description);
    // pPhased (own phase '1') and pEarlyInitiative (inherited phase '1' from initiative i1)
    // are now equally "phase 1" — Projects inherit their initiative's declared phase by
    // default, per the operator-confirmed design. Both sort ahead of phase 2 and no-signal.
    expect(new Set(descriptions.slice(0, 2))).toEqual(new Set(['Phased Project', 'Early Initiative Project']));
    expect(descriptions[2]).toBe('Late Initiative Project');
    expect(descriptions[3]).toBe('No Phase Project');
  });

  it('ties within the same phase break alphabetically by verbatim project name', () => {
    const matrix = {
      projectsById: {
        pZ: { id: 'pZ', name: 'Zebra Project', reviewStatus: 'CONFIRMED', phase: '1' },
        pA: { id: 'pA', name: 'Alpha Project', reviewStatus: 'CONFIRMED', phase: '1' },
      },
    };
    expect(buildCausalChainStepsFromMatrix(matrix).map((s) => s.description)).toEqual([
      'Alpha Project',
      'Zebra Project',
    ]);
  });

  it('carries projectId through each step so a ScheduledBlock builder can trace back to the owning Project', () => {
    const matrix = {
      projectsById: {
        pAlpha: { id: 'pAlpha', name: 'Alpha', reviewStatus: 'CONFIRMED', phase: '1' },
        pBeta: { id: 'pBeta', name: 'Beta', reviewStatus: 'CONFIRMED', phase: '2' },
      },
    };
    const steps = buildCausalChainStepsFromMatrix(matrix);
    expect(steps.map((s) => s.projectId)).toEqual(['pAlpha', 'pBeta']);
  });

  it('is deterministic: same matrix produces identical output across calls', () => {
    const matrix = {
      projectsById: {
        p1: { id: 'p1', name: 'Ship MVP', reviewStatus: 'CONFIRMED', phase: '1' },
        p2: { id: 'p2', name: 'Harden Auth', reviewStatus: 'CONFIRMED', phase: '2' },
      },
    };
    expect(buildCausalChainStepsFromMatrix(matrix)).toEqual(buildCausalChainStepsFromMatrix(matrix));
  });

  it('prefers the dependency-derived phase over the raw (near-always-null) phase field', () => {
    const matrix = {
      projectsById: {
        p1: { id: 'p1', name: 'Foundation Work', reviewStatus: 'CONFIRMED', phase: null },
        p2: { id: 'p2', name: 'Middle Work', reviewStatus: 'CONFIRMED', phase: null },
        p3: { id: 'p3', name: 'Final Work', reviewStatus: 'CONFIRMED', phase: null },
      },
      dependenciesById: {
        d1: { id: 'd1', upstreamId: 'p1', downstreamId: 'p2', type: 'hard_gate' },
        d2: { id: 'd2', upstreamId: 'p2', downstreamId: 'p3', type: 'hard_gate' },
      },
    };
    // With every raw phase null, the old behavior would fall through to alphabetical:
    // Final Work, Foundation Work, Middle Work — structurally meaningless. The dependency
    // graph gives a real beginning/middle/end order instead.
    expect(buildCausalChainStepsFromMatrix(matrix).map((s) => s.description)).toEqual([
      'Foundation Work',
      'Middle Work',
      'Final Work',
    ]);
  });

  it('falls back to the raw phase field for a project with no dependency signal', () => {
    const matrix = {
      projectsById: {
        p1: { id: 'p1', name: 'Sequenced First', reviewStatus: 'CONFIRMED', phase: null },
        p2: { id: 'p2', name: 'Sequenced Second', reviewStatus: 'CONFIRMED', phase: null },
        pStandalone: { id: 'pStandalone', name: 'Hand-labeled Standalone', reviewStatus: 'CONFIRMED', phase: '1' },
      },
      dependenciesById: {
        d1: { id: 'd1', upstreamId: 'p1', downstreamId: 'p2', type: 'hard_gate' },
      },
    };
    const descriptions = buildCausalChainStepsFromMatrix(matrix).map((s) => s.description);
    // pStandalone has no dependency edges, so it keeps its manually-declared phase '1' and
    // sorts alongside the beginning of the sequenced chain rather than being dropped last.
    expect(descriptions.indexOf('Hand-labeled Standalone')).toBeLessThan(descriptions.indexOf('Sequenced Second'));
  });
});
