import { describe, it, expect } from 'vitest';
import {
  deriveProjectPhasesFromDependencies,
  deriveEffectiveProjectPhases,
  buildPhaseReorganizationRecommendations,
} from './phaseFromDependencies.js';

function project(id, overrides = {}) {
  return { id, name: overrides.name || id, reviewStatus: 'CONFIRMED', ...overrides };
}

function edge(id, upstreamId, downstreamId, type = 'hard_gate') {
  return { id, upstreamId, downstreamId, type };
}

function initiative(id, overrides = {}) {
  return { id, name: overrides.name || id, reviewStatus: 'CONFIRMED', ...overrides };
}

describe('deriveProjectPhasesFromDependencies', () => {
  it('returns {} for an empty matrix', () => {
    expect(deriveProjectPhasesFromDependencies({})).toEqual({});
  });

  it('returns {} when CONFIRMED projects exist but have no dependency edges', () => {
    const matrix = { projectsById: { p1: project('p1'), p2: project('p2') } };
    expect(deriveProjectPhasesFromDependencies(matrix)).toEqual({});
  });

  it('derives beginning/middle/end for a 3-step chain', () => {
    const matrix = {
      projectsById: { p1: project('p1'), p2: project('p2'), p3: project('p3') },
      dependenciesById: {
        d1: edge('d1', 'p1', 'p2'), // p2 requires p1
        d2: edge('d2', 'p2', 'p3'), // p3 requires p2
      },
    };
    expect(deriveProjectPhasesFromDependencies(matrix)).toEqual({ p1: 1, p2: 2, p3: 3 });
  });

  it('groups parallel projects at the same layer into the same phase', () => {
    const matrix = {
      projectsById: { p1: project('p1'), p2: project('p2'), p3: project('p3') },
      dependenciesById: {
        d1: edge('d1', 'p1', 'p3'), // p3 requires p1
        d2: edge('d2', 'p2', 'p3'), // p3 requires p2
      },
    };
    const result = deriveProjectPhasesFromDependencies(matrix);
    expect(result.p1).toBe(result.p2); // same layer (no prereqs) -> same phase
    expect(result.p3).toBeGreaterThan(result.p1);
  });

  it('ignores edges where either side is not a CONFIRMED project', () => {
    const matrix = {
      projectsById: { p1: project('p1'), p2: project('p2', { reviewStatus: 'DRAFT' }) },
      dependenciesById: { d1: edge('d1', 'p1', 'p2') },
    };
    expect(deriveProjectPhasesFromDependencies(matrix)).toEqual({});
  });

  it('ignores informational edges (annotation only, no ordering)', () => {
    const matrix = {
      projectsById: { p1: project('p1'), p2: project('p2') },
      dependenciesById: { d1: edge('d1', 'p1', 'p2', 'informational') },
    };
    expect(deriveProjectPhasesFromDependencies(matrix)).toEqual({});
  });

  it('defends against a cycle by excluding the unresolvable nodes rather than looping forever', () => {
    const matrix = {
      projectsById: { p1: project('p1'), p2: project('p2') },
      dependenciesById: {
        d1: edge('d1', 'p1', 'p2'), // p2 requires p1
        d2: edge('d2', 'p2', 'p1'), // p1 requires p2 (cycle — capture-time guard would normally block this)
      },
    };
    const result = deriveProjectPhasesFromDependencies(matrix);
    expect(result).toEqual({});
  });
});

describe('deriveEffectiveProjectPhases', () => {
  it('returns {} for an empty matrix', () => {
    expect(deriveEffectiveProjectPhases({})).toEqual({});
  });

  it('prefers the dependency-derived phase when one exists, even if the project or its initiative also has a phase set', () => {
    const matrix = {
      projectsById: {
        p1: project('p1', { owningInitiativeId: 'i1', phase: '3' }),
        p2: project('p2', { owningInitiativeId: 'i1', phase: '3' }),
      },
      initiativesById: { i1: initiative('i1', { phase: '1' }) },
      dependenciesById: { d1: edge('d1', 'p1', 'p2') },
    };
    const result = deriveEffectiveProjectPhases(matrix);
    // p1 has no prereqs (layer 0 -> phase 1), p2 requires p1 (layer 1 -> phase 3, single span
    // bucketing) — dependency signal wins over both the hand-typed '3' and initiative '1'.
    expect(result.p1).toBe(1);
    expect(result.p2).toBe(3);
  });

  it('falls back to the raw project.phase field when no dependency signal exists', () => {
    const matrix = {
      projectsById: { p1: project('p1', { owningInitiativeId: 'i1', phase: '2' }) },
      initiativesById: { i1: initiative('i1', { phase: '1' }) },
    };
    expect(deriveEffectiveProjectPhases(matrix)).toEqual({ p1: '2' });
  });

  // E16 (2026-08-23): the initiative-inheritance tier is gone. Kept as a negative guard rather
  // than deleted — a stray initiative.phase must NOT resurrect the fallback if one is ever
  // hand-seeded into a fixture or an old persisted blob.
  it('does NOT fall back to an owning initiative phase — Initiatives have no Phase (E16)', () => {
    const matrix = {
      projectsById: { p1: project('p1', { owningInitiativeId: 'i1', phase: null }) },
      initiativesById: { i1: initiative('i1', { phase: '2' }) },
    };
    expect(deriveEffectiveProjectPhases(matrix)).toEqual({});
  });

  it('leaves a project with no signal at all out of the result (no guessing)', () => {
    const matrix = {
      projectsById: { p1: project('p1', { owningInitiativeId: 'i1', phase: null }) },
      initiativesById: { i1: initiative('i1', { phase: null }) },
    };
    expect(deriveEffectiveProjectPhases(matrix)).toEqual({});
  });

  it('leaves a project with no owning initiative and no other signal out of the result', () => {
    const matrix = {
      projectsById: { p1: project('p1', { owningInitiativeId: null, phase: null }) },
    };
    expect(deriveEffectiveProjectPhases(matrix)).toEqual({});
  });

  // E16 (2026-08-23): was "groups sibling projects under the same phase-declared initiative
  // together, even with no pairwise dependencies". Initiative phase no longer exists, so sibling
  // grouping via the initiative is gone — each project must carry its own signal (a dependency
  // edge, its own phase, or, once Sites 1/4 land, its own target date). Projects with none are
  // left out rather than guessed, and surface via NO_DECLARED_SEQUENCE.
  it('does NOT group sibling projects via a shared initiative phase (E16)', () => {
    const matrix = {
      projectsById: {
        p1: project('p1', { owningInitiativeId: 'i1', phase: null, name: 'OUR FEARLESS LEADER 3' }),
        p2: project('p2', { owningInitiativeId: 'i1', phase: null, name: 'OUR FEARLESS LEADER 7' }),
        p3: project('p3', { owningInitiativeId: 'i2', phase: null, name: 'I AM THE STATE' }),
      },
      initiativesById: {
        i1: initiative('i1', { phase: '1', name: 'OFL Franchise' }),
        i2: initiative('i2', { phase: '2', name: 'State Franchise' }),
      },
    };
    const result = deriveEffectiveProjectPhases(matrix);
    expect(result).toEqual({});
  });

  it('only considers CONFIRMED projects', () => {
    const matrix = {
      projectsById: { p1: project('p1', { owningInitiativeId: 'i1', phase: null, reviewStatus: 'DRAFT' }) },
      initiativesById: { i1: initiative('i1', { phase: '1' }) },
    };
    expect(deriveEffectiveProjectPhases(matrix)).toEqual({});
  });
});

describe('buildPhaseReorganizationRecommendations', () => {
  it('returns [] for an empty matrix', () => {
    expect(buildPhaseReorganizationRecommendations({})).toEqual([]);
  });

  it('flags a CONFIRMED project with no declared relationship to anything as NO_DECLARED_SEQUENCE', () => {
    const matrix = { projectsById: { p1: project('p1', { name: 'Solo Project' }) } };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    expect(recs).toHaveLength(1);
    expect(recs[0].code).toBe('NO_DECLARED_SEQUENCE');
    expect(recs[0].message).toContain('Solo Project');
  });

  it('does not flag projects that participate in a declared sequence', () => {
    const matrix = {
      projectsById: { p1: project('p1'), p2: project('p2') },
      dependenciesById: { d1: edge('d1', 'p1', 'p2') },
    };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    expect(recs.filter((r) => r.code === 'NO_DECLARED_SEQUENCE')).toHaveLength(0);
  });

  it('flags a manually-declared phase that contradicts the dependency-derived phase', () => {
    const matrix = {
      projectsById: {
        p1: project('p1', { phase: '1' }),
        p2: project('p2', { phase: '1', name: 'Mislabeled' }), // manually says phase 1, but requires p1
        p3: project('p3', { phase: '3' }),
      },
      dependenciesById: {
        d1: edge('d1', 'p1', 'p2'),
        d2: edge('d2', 'p2', 'p3'),
      },
    };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    const contradiction = recs.find((r) => r.code === 'DECLARED_PHASE_CONTRADICTS_DEPENDENCIES');
    expect(contradiction).toBeDefined();
    expect(contradiction.projectId).toBe('p2');
    expect(contradiction.message).toContain('Mislabeled');
  });

  it('does not flag a declared phase that matches the derived phase', () => {
    const matrix = {
      projectsById: { p1: project('p1', { phase: '1' }), p2: project('p2', { phase: '3' }) },
      dependenciesById: { d1: edge('d1', 'p1', 'p2') },
    };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    expect(recs.filter((r) => r.code === 'DECLARED_PHASE_CONTRADICTS_DEPENDENCIES')).toHaveLength(0);
  });

  it('flags an unresolvable (cyclic) chain as UNRESOLVABLE_SEQUENCE', () => {
    const matrix = {
      projectsById: { p1: project('p1'), p2: project('p2') },
      dependenciesById: {
        d1: edge('d1', 'p1', 'p2'),
        d2: edge('d2', 'p2', 'p1'),
      },
    };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    const codes = recs.map((r) => r.code);
    expect(codes).toContain('UNRESOLVABLE_SEQUENCE');
    expect(recs.filter((r) => r.code === 'UNRESOLVABLE_SEQUENCE')).toHaveLength(2);
  });

  // E16 (2026-08-23) reverses the 2026-07-13 follow-up: an Initiative phase can no longer excuse
  // a Project from having a sequencing signal, because there is no Initiative phase. A Project
  // with zero pairwise dependencies is a real gap again.
  it('flags NO_DECLARED_SEQUENCE even when the owning initiative carries a stray phase (E16)', () => {
    const matrix = {
      projectsById: { p1: project('p1', { owningInitiativeId: 'i1', name: 'OUR FEARLESS LEADER 3' }) },
      initiativesById: { i1: initiative('i1', { phase: '1', name: 'OFL Franchise' }) },
    };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    expect(recs.filter((r) => r.code === 'NO_DECLARED_SEQUENCE')).toHaveLength(1);
  });

  it('still flags NO_DECLARED_SEQUENCE for a project with no dependencies AND no initiative phase (nor initiative at all)', () => {
    const matrix = {
      projectsById: { p1: project('p1', { owningInitiativeId: null, name: 'Solo Project' }) },
    };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    expect(recs.filter((r) => r.code === 'NO_DECLARED_SEQUENCE')).toHaveLength(1);
  });

  // E16 (2026-08-23): PROJECT_PHASE_CONTRADICTS_INITIATIVE is deleted — there is no Initiative
  // phase for a Project to contradict. Kept as a negative guard against the exact matrix shape
  // that used to emit it, so a hand-seeded initiative.phase can't bring the gate back.
  it('never emits PROJECT_PHASE_CONTRADICTS_INITIATIVE, even for a contradicting matrix (E16)', () => {
    const matrix = {
      projectsById: {
        p1: project('p1', { owningInitiativeId: 'i1' }),
        p2: project('p2', { owningInitiativeId: 'i1', name: 'Contradicted' }),
      },
      initiativesById: { i1: initiative('i1', { phase: '1' }) },
      dependenciesById: { d1: edge('d1', 'p1', 'p2') }, // p2 requires p1 -> derived phase 3, initiative says 1
    };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    expect(recs.filter((r) => r.code === 'PROJECT_PHASE_CONTRADICTS_INITIATIVE')).toHaveLength(0);
  });

  it('does not flag PROJECT_PHASE_CONTRADICTS_INITIATIVE when the dependency-derived phase agrees with the initiative phase', () => {
    const matrix = {
      projectsById: {
        p1: project('p1', { owningInitiativeId: null }),
        p2: project('p2', { owningInitiativeId: 'i1' }),
      },
      initiativesById: { i1: initiative('i1', { phase: '3' }) },
      dependenciesById: { d1: edge('d1', 'p1', 'p2') }, // p2 requires p1 -> p2's derived phase is 3
    };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    expect(recs.filter((r) => r.code === 'PROJECT_PHASE_CONTRADICTS_INITIATIVE')).toHaveLength(0);
  });

  // E16 (2026-08-23): INITIATIVE_NO_PHASE_DECLARED is deleted. It fired for every Initiative
  // owning a CONFIRMED project and instructed the operator to set a phase on it — an action that
  // no longer exists. This is the negative guard for the exact matrix that used to trigger it.
  it('never emits INITIATIVE_NO_PHASE_DECLARED — an Initiative has no Phase to declare (E16)', () => {
    const matrix = {
      projectsById: { p1: project('p1', { owningInitiativeId: 'i1', name: 'Orphaned Under Initiative' }) },
      initiativesById: { i1: initiative('i1', { phase: null, name: 'Undeclared Initiative' }) },
    };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    expect(recs.filter((r) => r.code === 'INITIATIVE_NO_PHASE_DECLARED')).toHaveLength(0);
  });

  it('does not flag INITIATIVE_NO_PHASE_DECLARED once the initiative has a phase set', () => {
    const matrix = {
      projectsById: { p1: project('p1', { owningInitiativeId: 'i1' }) },
      initiativesById: { i1: initiative('i1', { phase: '1' }) },
    };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    expect(recs.filter((r) => r.code === 'INITIATIVE_NO_PHASE_DECLARED')).toHaveLength(0);
  });

  it('does not flag INITIATIVE_NO_PHASE_DECLARED for an initiative with no CONFIRMED projects at all', () => {
    const matrix = {
      projectsById: { p1: project('p1', { owningInitiativeId: 'i1', reviewStatus: 'DRAFT' }) },
      initiativesById: { i1: initiative('i1', { phase: null }) },
    };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    expect(recs.filter((r) => r.code === 'INITIATIVE_NO_PHASE_DECLARED')).toHaveLength(0);
  });

  it('flags corrupted phases with PHASE_DATA_CORRUPTED rather than crashing (advisory never blocks)', () => {
    const matrix = {
      projectsById: {
        p1: project('p1', { name: 'Valid', phase: '2', owningInitiativeId: 'i2' }),
        p2: project('p2', { name: 'Corrupted', phase: '7', owningInitiativeId: 'i2' }), // invalid phase, participates via edge
        p3: project('p3', { name: 'Also Valid', phase: '1', owningInitiativeId: 'i2' }),
      },
      initiativesById: {
        i1: initiative('i1', { name: 'Bad Initiative', phase: 'banana' }), // invalid phase
        i2: initiative('i2', { name: 'Valid Initiative', phase: '2' }),
      },
      dependenciesById: {
        d1: edge('d1', 'p1', 'p2'), // p2 requires p1 — makes both participate
      },
    };
    const recs = buildPhaseReorganizationRecommendations(matrix);
    const corrupted = recs.filter((r) => r.code === 'PHASE_DATA_CORRUPTED');
    expect(corrupted).toHaveLength(1);
    expect(corrupted[0].projectName).toBe('Corrupted');
    // The corruption flag names the node and raw bad value
    expect(corrupted[0].message).toContain('7');
    // Other valid phases still generate recommendations (advisory never blocks)
    expect(recs.filter((r) => r.code !== 'PHASE_DATA_CORRUPTED').length).toBeGreaterThan(0);
  });
});
