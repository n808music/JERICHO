import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  computeBootstrapCandidates,
  bindingGapForArtifact,
  BOOTSTRAP_SLOT,
  BOOTSTRAP_SLOT_ID,
} from '../../../src/domain/elicitation/bootstrapSlot';
import { probeFor } from '../../../src/domain/elicitation/reprobes.js';

// ─── matrix builder (bypasses reducers — like buildCustomMatrix in dep tests) ─
// Used for graph traversal tests. Avoids the full prerequisite validation chain.

function blankMatrix() {
  return buildBlankIdentityState({}).matrix;
}

function matrixWith({ artifacts = {}, dependencies = {}, bindingConstraint = null, resourceProfiles = {}, projects = {} } = {}) {
  return {
    ...blankMatrix(),
    artifactsById: artifacts,
    dependenciesById: dependencies,
    bindingConstraint,
    resourceProfilesById: resourceProfiles,
    projectsById: projects,
  };
}

function art(id, name = id, producingProjectId = null) {
  return { id, name, producingProjectId };
}

function hardGate(id, upstreamId, downstreamId) {
  return { id, upstreamId, downstreamId, type: 'hard_gate' };
}

function directional(id, upstreamId, downstreamId) {
  return { id, upstreamId, downstreamId, type: 'directional' };
}

function informational(id, upstreamId, downstreamId) {
  return { id, upstreamId, downstreamId, type: 'informational' };
}

function bindingConstraint(dimension) {
  return { bindingDimension: dimension, rationale: 'Available hours are the bottleneck' };
}

function profile(initiativeId, timeDimGap) {
  return {
    id: `profile-${initiativeId}`,
    initiativeId,
    dimensions: {
      money: { need: 'Startup capital', gap: null },
      time: { need: '20 hours/week', gap: timeDimGap },
      skills: { need: 'Production skills', gap: null },
      tech: { need: 'DAW software', gap: null },
    },
  };
}

// ─── reducer-chain helpers (for dispatch/gate tests only) ────────────────────
// Mirrors the working pattern from elicitationEngine.dependencySlot.test.js

function buildBaseState() {
  let s = buildBlankIdentityState({});
  s = computeDerivedState(s, {
    type: 'DECLARE_ENTITY',
    payload: {
      id: 'ent-1',
      name: 'Test Co',
      roleTags: ['business'],
      purpose: 'Testing',
      formationState: 'functioning',
      statusEvidence: 'Active and operating',
    },
  });
  s = computeDerivedState(s, {
    type: 'DECLARE_VERIFICATION_SOURCE',
    payload: { id: 'vs-1', source: 'TestSource', domain: 'Testing' },
  });
  s = computeDerivedState(s, {
    type: 'DECLARE_PROJECT',
    payload: {
      id: 'proj-1',
      name: 'Test Project',
      owningEntityId: 'ent-1',
      description: '100 confirmed users in TestSource',
      verificationSourceId: 'vs-1',
    },
  });
  return s;
}

function addArtifact(state, id) {
  return computeDerivedState(state, {
    type: 'DECLARE_ARTIFACT',
    payload: {
      id,
      name: id,
      producingProjectId: 'proj-1',
      completionEvidence: 'Listed in TestSource and confirmed in catalog',
      verificationSourceId: 'vs-1',
      operatorAttestationMethod: `Open TestSource, confirm ${id} exists`,
    },
  });
}

function addHardGate(state, upstreamId, downstreamId) {
  return computeDerivedState(state, {
    type: 'DECLARE_DEPENDENCY',
    payload: { upstreamId, downstreamId, type: 'hard_gate' },
  });
}

// ─── 1. hard_gate-only blocking ───────────────────────────────────────────────

describe('bootstrap candidates — hard_gate-only blocking', () => {
  it('excludes artifacts downstream of hard_gate edges', () => {
    // A: hard_gate downstream (blocked)
    // B: upstream of hard_gate to A (not blocked)
    // C: directional downstream of B (not blocked)
    // D: standalone (not blocked)
    const matrix = matrixWith({
      artifacts: {
        'art-a': art('art-a'),
        'art-b': art('art-b'),
        'art-c': art('art-c'),
        'art-d': art('art-d'),
      },
      dependencies: {
        'dep-hg': hardGate('dep-hg', 'art-b', 'art-a'),    // A is hard_gate downstream
        'dep-dir': directional('dep-dir', 'art-b', 'art-c'), // C is directional downstream
      },
    });

    const candidates = computeBootstrapCandidates(matrix);
    const ids = candidates.map((c) => c.artifactId);

    expect(ids).not.toContain('art-a'); // hard_gate blocks candidacy
    expect(ids).toContain('art-b');     // upstream is always a candidate
    expect(ids).toContain('art-c');     // directional does NOT block
    expect(ids).toContain('art-d');     // standalone — always candidate
  });

  it('informational edges do not block candidacy', () => {
    const matrix = matrixWith({
      artifacts: {
        'art-up': art('art-up'),
        'art-info': art('art-info'),
      },
      dependencies: {
        'dep-inf': informational('dep-inf', 'art-up', 'art-info'),
      },
    });

    const candidates = computeBootstrapCandidates(matrix);
    const ids = candidates.map((c) => c.artifactId);
    expect(ids).toContain('art-info');
    expect(ids).toContain('art-up');
  });

  it('multiple hard_gate downstreams all excluded', () => {
    const matrix = matrixWith({
      artifacts: {
        'root': art('root'),
        'child-1': art('child-1'),
        'child-2': art('child-2'),
      },
      dependencies: {
        'd1': hardGate('d1', 'root', 'child-1'),
        'd2': hardGate('d2', 'root', 'child-2'),
      },
    });

    const candidates = computeBootstrapCandidates(matrix);
    const ids = candidates.map((c) => c.artifactId);
    expect(ids).toContain('root');
    expect(ids).not.toContain('child-1');
    expect(ids).not.toContain('child-2');
  });
});

// ─── 2. binding-constraint ordering ───────────────────────────────────────────

describe('bootstrap candidates — binding-constraint ordering', () => {
  it('ranks no-gap candidate before gap candidate when time binds', () => {
    const matrix = matrixWith({
      artifacts: {
        'art-nogap': art('art-nogap', 'No Gap Artifact', 'proj-ng'),
        'art-gap':   art('art-gap',   'Gap Artifact',    'proj-g'),
      },
      projects: {
        'proj-ng': { id: 'proj-ng', owningInitiativeId: 'init-ng' },
        'proj-g':  { id: 'proj-g',  owningInitiativeId: 'init-g' },
      },
      resourceProfiles: {
        'init-ng': profile('init-ng', null),              // time.gap = null → no-gap
        'init-g':  profile('init-g',  'Need 40 more hrs'), // time.gap = string → gap
      },
      bindingConstraint: bindingConstraint('time'),
    });

    const candidates = computeBootstrapCandidates(matrix);
    const ids = candidates.map((c) => c.artifactId);
    const nogapIdx = ids.indexOf('art-nogap');
    const gapIdx   = ids.indexOf('art-gap');

    expect(nogapIdx).toBeGreaterThanOrEqual(0);
    expect(gapIdx).toBeGreaterThanOrEqual(0);
    expect(nogapIdx).toBeLessThan(gapIdx); // no-gap first
  });

  it('reports correct bindingStatus for each candidate', () => {
    const matrix = matrixWith({
      artifacts: { 'art-a': art('art-a', 'A', 'proj-a') },
      projects:  { 'proj-a': { id: 'proj-a', owningInitiativeId: 'init-a' } },
      resourceProfiles: { 'init-a': profile('init-a', null) }, // no-gap
      bindingConstraint: bindingConstraint('time'),
    });

    const candidates = computeBootstrapCandidates(matrix);
    const found = candidates.find((c) => c.artifactId === 'art-a');
    expect(found?.bindingStatus).toBe('no-gap');
    expect(found?.tier).toBe(0);
  });

  it('gap candidate has tier 2', () => {
    const matrix = matrixWith({
      artifacts: { 'art-a': art('art-a', 'A', 'proj-a') },
      projects:  { 'proj-a': { id: 'proj-a', owningInitiativeId: 'init-a' } },
      resourceProfiles: { 'init-a': profile('init-a', 'Need 30 more hrs') }, // gap
      bindingConstraint: bindingConstraint('time'),
    });

    const candidates = computeBootstrapCandidates(matrix);
    const found = candidates.find((c) => c.artifactId === 'art-a');
    expect(found?.bindingStatus).toBe('gap');
    expect(found?.tier).toBe(2);
  });
});

// ─── 3. graceful degradation ──────────────────────────────────────────────────

describe('bootstrap candidates — graceful degradation', () => {
  it('includes artifact with null owningInitiativeId as unknown (not excluded)', () => {
    const matrix = matrixWith({
      artifacts: { 'art-orphan': art('art-orphan', 'Orphan', 'proj-no-init') },
      projects:  { 'proj-no-init': { id: 'proj-no-init', owningInitiativeId: null } },
      bindingConstraint: bindingConstraint('time'),
    });

    const candidates = computeBootstrapCandidates(matrix);
    const found = candidates.find((c) => c.artifactId === 'art-orphan');
    expect(found).toBeDefined();
    expect(found?.bindingStatus).toBe('unknown');
  });

  it('includes artifact whose initiative has no resource profile as unknown', () => {
    const matrix = matrixWith({
      artifacts: { 'art-up': art('art-up', 'Unprofiled', 'proj-up') },
      projects:  { 'proj-up': { id: 'proj-up', owningInitiativeId: 'init-unprofiled' } },
      resourceProfiles: {}, // no profile for init-unprofiled
      bindingConstraint: bindingConstraint('time'),
    });

    const candidates = computeBootstrapCandidates(matrix);
    const found = candidates.find((c) => c.artifactId === 'art-up');
    expect(found).toBeDefined();
    expect(found?.bindingStatus).toBe('unknown');
  });

  it('unknown ranks between no-gap and gap (tier 0 < 1 < 2)', () => {
    const matrix = matrixWith({
      artifacts: {
        'art-ng':  art('art-ng',  'No Gap',  'proj-ng'),
        'art-unk': art('art-unk', 'Unknown', 'proj-unk'),
        'art-g':   art('art-g',   'Gap',     'proj-g'),
      },
      projects: {
        'proj-ng':  { id: 'proj-ng',  owningInitiativeId: 'init-ng' },
        'proj-unk': { id: 'proj-unk', owningInitiativeId: null },
        'proj-g':   { id: 'proj-g',   owningInitiativeId: 'init-g' },
      },
      resourceProfiles: {
        'init-ng': profile('init-ng', null),
        'init-g':  profile('init-g',  'Needs 30 more hrs'),
      },
      bindingConstraint: bindingConstraint('time'),
    });

    const candidates = computeBootstrapCandidates(matrix);
    const ids = candidates.map((c) => c.artifactId);
    const ngIdx  = ids.indexOf('art-ng');
    const unkIdx = ids.indexOf('art-unk');
    const gIdx   = ids.indexOf('art-g');

    expect(ngIdx).toBeLessThan(unkIdx);
    expect(unkIdx).toBeLessThan(gIdx);
  });

  it('bindingGapForArtifact returns unknown for nonexistent artifact', () => {
    const matrix = matrixWith({});
    expect(bindingGapForArtifact('nonexistent', matrix, 'time')).toBe('unknown');
  });

  it('bindingGapForArtifact returns unknown when no bindingDim', () => {
    const matrix = matrixWith({
      artifacts: { 'a': art('a', 'A', 'proj-a') },
      projects: { 'proj-a': { id: 'proj-a', owningInitiativeId: 'init-a' } },
    });
    expect(bindingGapForArtifact('a', matrix, null)).toBe('unknown');
  });
});

// ─── 4. DAG guarantee ─────────────────────────────────────────────────────────

describe('bootstrap candidates — DAG guarantee', () => {
  it('returns non-empty candidates when artifacts exist and graph is a valid DAG', () => {
    const matrix = matrixWith({
      artifacts: {
        'art-1': art('art-1'),
        'art-2': art('art-2'),
      },
      dependencies: {
        'dep-1': hardGate('dep-1', 'art-1', 'art-2'), // art-1 is a root
      },
    });

    const candidates = computeBootstrapCandidates(matrix);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates.some((c) => c.artifactId === 'art-1')).toBe(true);
  });

  it('returns empty candidates when no artifacts exist', () => {
    const matrix = matrixWith({});
    expect(computeBootstrapCandidates(matrix)).toEqual([]);
  });

  it('standalone artifact (no deps) is always a candidate', () => {
    const matrix = matrixWith({
      artifacts: { 'solo': art('solo') },
    });
    const candidates = computeBootstrapCandidates(matrix);
    expect(candidates.length).toBe(1);
    expect(candidates[0].artifactId).toBe('solo');
  });
});

// ─── 5. selection dispatch and landing ────────────────────────────────────────

describe('bootstrap — DECLARE_BOOTSTRAP reducer', () => {
  it('stores selectedNodeId and candidates in matrix.bootstrap', () => {
    let s = buildBaseState();
    s = addArtifact(s, 'art-x');

    const candidates = computeBootstrapCandidates(s.matrix).map((c) => c.artifactId);
    expect(candidates).toContain('art-x');

    const next = computeDerivedState(s, {
      type: 'DECLARE_BOOTSTRAP',
      payload: { selectedNodeId: 'art-x', candidates },
    });

    expect(next.matrix.bootstrap.selectedNodeId).toBe('art-x');
    expect(next.matrix.bootstrap.candidates).toEqual(candidates);
  });

  it('rejects selectedNodeId absent from candidates', () => {
    // The reducer validates selectedNodeId against the candidates array in the payload.
    // Provide a candidates list that does not include the submitted selection.
    let s = buildBaseState();
    s = addArtifact(s, 'art-free');
    const next = computeDerivedState(s, {
      type: 'DECLARE_BOOTSTRAP',
      payload: { selectedNodeId: 'art-blocked', candidates: ['art-free'] },
    });
    expect(next.lastPlanError?.code).toBe('BOOTSTRAP_SELECTION_NOT_CANDIDATE');
  });

  it('rejects missing selectedNodeId', () => {
    const s = buildBaseState();
    const next = computeDerivedState(s, {
      type: 'DECLARE_BOOTSTRAP',
      payload: { selectedNodeId: '', candidates: [] },
    });
    expect(next.lastPlanError?.code).toBe('BOOTSTRAP_INVALID');
  });
});

// ─── 6. gate predicate: BOOTSTRAP_SELECTION_NOT_CANDIDATE via ctx.matrixSnapshot

describe('bootstrap gate — BOOTSTRAP_SELECTION_NOT_CANDIDATE uses ctx.matrixSnapshot', () => {
  // Test the gate predicate directly; avoids needing the engine conversation API.
  const notCandidateGate = BOOTSTRAP_SLOT.gate.find(
    (g) => g.code === 'BOOTSTRAP_SELECTION_NOT_CANDIDATE',
  );

  it('gate fires when captured selectedNodeId is hard-blocked in matrixSnapshot', () => {
    const matrix = matrixWith({
      artifacts: { 'art-free': art('art-free'), 'art-hard': art('art-hard') },
      dependencies: { 'd1': hardGate('d1', 'art-free', 'art-hard') },
    });
    const captured = { selectedNodeId: 'art-hard' };
    expect(notCandidateGate.detect(captured, { matrixSnapshot: matrix })).toBe(true);
  });

  it('gate does not fire when captured selectedNodeId is a valid candidate', () => {
    const matrix = matrixWith({
      artifacts: { 'art-free': art('art-free'), 'art-hard': art('art-hard') },
      dependencies: { 'd1': hardGate('d1', 'art-free', 'art-hard') },
    });
    const captured = { selectedNodeId: 'art-free' };
    expect(notCandidateGate.detect(captured, { matrixSnapshot: matrix })).toBe(false);
  });

  it('gate does not fire when no selectedNodeId captured yet', () => {
    const matrix = matrixWith({
      artifacts: { 'art-free': art('art-free') },
    });
    // First gate (MISSING) handles the absent-selection case; NOT_CANDIDATE must not double-fire
    expect(notCandidateGate.detect({}, { matrixSnapshot: matrix })).toBe(false);
  });
});

// ─── 7. reprobe coverage ──────────────────────────────────────────────────────

describe('bootstrap reprobe coverage', () => {
  it('has authored reprobe for BOOTSTRAP_SELECTION_MISSING', () => {
    const p = probeFor('BOOTSTRAP_SELECTION_MISSING', 'generic');
    expect(p.spine).toBeTruthy();
    expect(p.pickSet).toBe('bootstrapCandidateOptions');
  });

  it('has authored reprobe for BOOTSTRAP_SELECTION_NOT_CANDIDATE', () => {
    const p = probeFor('BOOTSTRAP_SELECTION_NOT_CANDIDATE', 'generic');
    expect(p.spine).toBeTruthy();
    expect(p.pickSet).toBe('bootstrapCandidateOptions');
  });
});
