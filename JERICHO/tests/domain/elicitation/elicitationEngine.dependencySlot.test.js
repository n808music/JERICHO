import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  createElicitationEngine,
  DEPENDENCY_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';
import { DEPENDENCY_SLOT, reaches } from '../../../src/domain/elicitation/dependencySlot.ts';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildBaseState() {
  let state = buildBlankIdentityState({});
  state = computeDerivedState(state, {
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
  state = computeDerivedState(state, {
    type: 'DECLARE_VERIFICATION_SOURCE',
    payload: { id: 'vs-1', source: 'TestSource', domain: 'Testing' },
  });
  state = computeDerivedState(state, {
    type: 'DECLARE_PROJECT',
    payload: {
      id: 'proj-1',
      name: 'Test Project',
      owningEntityId: 'ent-1',
      description: '100 users confirmed in TestSource',
      verificationSourceId: 'vs-1',
    },
  });
  return state;
}

function addArtifact(state, artId) {
  return computeDerivedState(state, {
    type: 'DECLARE_ARTIFACT',
    payload: {
      id: artId,
      name: artId,
      producingProjectId: 'proj-1',
      completionEvidence: `listed in TestSource and confirmed in catalog`,
      verificationSourceId: 'vs-1',
      operatorAttestationMethod: `open TestSource, confirm ${artId} exists`,
    },
  });
}

function buildSeededState(...artifactIds) {
  let state = buildBaseState();
  for (const id of artifactIds) {
    state = addArtifact(state, id);
  }
  return state;
}

// Custom matrix bypasses reducers — used for cycle guard tests where we need
// pre-seeded dependenciesById without going through the full dispatch chain.
function buildCustomMatrix(artifactIds, depEdges = []) {
  const blankMatrix = buildBlankIdentityState({}).matrix;
  const artifactsById = Object.fromEntries(artifactIds.map((id) => [id, { id, name: id }]));
  const dependenciesById = Object.fromEntries(depEdges.map((e) => [e.id, e]));
  return { ...blankMatrix, artifactsById, dependenciesById };
}

function runDependencyScript(script, opts = {}) {
  let state = opts.initialState || buildBlankIdentityState({});
  let engine = createElicitationEngine({
    goalType: opts.goalType || 'generic',
    matrixSnapshot: opts.matrixSnapshot || state.matrix,
    scope: [DEPENDENCY_SLOT_ID],
  });
  const probes = [];
  const dispatchedActions = [];
  let step = engine.openingStep();
  let pendingAnswers = [...script];
  let safety = 0;
  while (!step.done) {
    if (safety++ > 40) throw new Error('Engine did not terminate within safety bound');
    probes.push(step.probe);
    if (pendingAnswers.length === 0) {
      throw new Error(
        `Out of scripted answers — engine still asking "${step.probe.fieldName}" (${step.probe.code})`
      );
    }
    const answer = pendingAnswers.shift();
    const result = engine.consumeAnswer(answer);
    engine = result.engine;
    for (const action of result.dispatches || []) {
      dispatchedActions.push(action);
      state = computeDerivedState(state, action);
    }
    const snap = opts.matrixSnapshot || state.matrix;
    engine = engine.refreshMatrix(snap);
    step = engine.nextStep();
  }
  return { state, probes, dispatchedActions };
}

// ── 1. Structural ─────────────────────────────────────────────────────────────

describe('Dependency slot: structural', () => {
  it('gate ladder has exactly 7 gates', () => {
    expect(DEPENDENCY_SLOT.gate).toHaveLength(7);
  });

  it('gate field names follow gate order', () => {
    expect(DEPENDENCY_SLOT.gate.map((g) => g.fieldName)).toEqual([
      'downstreamId',
      'downstreamId',
      'upstreamId',
      'upstreamId',
      'upstreamId',
      'upstreamId',
      'type',
    ]);
  });

  it('gate codes follow gate order', () => {
    expect(DEPENDENCY_SLOT.gate.map((g) => g.code)).toEqual([
      'DEPENDENCY_DOWNSTREAM_MISSING',
      'DEPENDENCY_DOWNSTREAM_UNRESOLVED',
      'DEPENDENCY_UPSTREAM_MISSING',
      'DEPENDENCY_SELF_EDGE',
      'DEPENDENCY_UPSTREAM_UNRESOLVED',
      'DEPENDENCY_CYCLE',
      'DEPENDENCY_TYPE_MISSING',
    ]);
  });
});

// ── 2. Gate sequence ──────────────────────────────────────────────────────────

describe('Dependency slot: gate sequence', () => {
  it('emits DEPENDENCY_DOWNSTREAM_MISSING first on a blank slot', () => {
    const engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: buildBlankIdentityState({}).matrix,
      scope: [DEPENDENCY_SLOT_ID],
    });
    const first = engine.openingStep();
    expect(first.probe.code).toBe('DEPENDENCY_DOWNSTREAM_MISSING');
    expect(first.probe.fieldName).toBe('downstreamId');
  });

  it('drives the full gate sequence: downstreamId → upstreamId → type', () => {
    const state = buildSeededState('art-a', 'art-b');
    const { probes } = runDependencyScript(
      [
        { downstreamId: 'art-b' },
        { upstreamId: 'art-a' },
        { type: 'hard_gate' },
      ],
      { initialState: state }
    );
    expect(probes.map((p) => p.fieldName)).toEqual(['downstreamId', 'upstreamId', 'type']);
  });
});

// ── 3. declaredNodeOptions pickSet ────────────────────────────────────────────

describe('Dependency slot: declaredNodeOptions pickSet', () => {
  it('contains declared artifacts with nodeType: artifact', () => {
    const state = buildSeededState('art-a', 'art-b');
    const engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: state.matrix,
      scope: [DEPENDENCY_SLOT_ID],
    });
    const first = engine.openingStep();
    expect(first.probe.pickSet?.kind).toBe('declaredNodeOptions');
    const ids = first.probe.pickSet.items.map((i) => i.id);
    expect(ids).toContain('art-a');
    expect(ids).toContain('art-b');
    expect(first.probe.pickSet.items.every((i) => i.nodeType === 'artifact')).toBe(true);
  });

  it('surfaces dependencyGap: true when artifactsById is empty', () => {
    const engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: buildBlankIdentityState({}).matrix,
      scope: [DEPENDENCY_SLOT_ID],
    });
    const first = engine.openingStep();
    expect(first.probe.dependencyGap).toBe(true);
    expect(first.probe.pickSet.items).toHaveLength(0);
  });
});

// ── 4. Unresolved endpoint gates ──────────────────────────────────────────────

describe('Dependency slot: unresolved endpoint gates', () => {
  it('fires DEPENDENCY_DOWNSTREAM_UNRESOLVED for an id not in artifactsById', () => {
    const state = buildSeededState('art-a');
    let engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: state.matrix,
      scope: [DEPENDENCY_SLOT_ID],
    });
    engine.openingStep();
    const r = engine.consumeAnswer({ downstreamId: 'art-nonexistent' });
    engine = r.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();
    expect(step.probe.code).toBe('DEPENDENCY_DOWNSTREAM_UNRESOLVED');
  });

  it('fires DEPENDENCY_UPSTREAM_UNRESOLVED for an upstream id not in artifactsById', () => {
    const state = buildSeededState('art-a');
    const matrix = buildCustomMatrix(['art-a', 'art-b']);
    let engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: matrix,
      scope: [DEPENDENCY_SLOT_ID],
    });
    engine.openingStep();
    for (const answer of [{ downstreamId: 'art-b' }]) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(matrix);
    }
    const r2 = engine.consumeAnswer({ upstreamId: 'art-ghost' });
    engine = r2.engine.refreshMatrix(matrix);
    const step = engine.nextStep();
    expect(step.probe.code).toBe('DEPENDENCY_UPSTREAM_UNRESOLVED');
  });
});

// ── 5. Self-edge gate ─────────────────────────────────────────────────────────

describe('Dependency slot: self-edge gate', () => {
  it('fires DEPENDENCY_SELF_EDGE when downstreamId === upstreamId', () => {
    const matrix = buildCustomMatrix(['art-a']);
    let engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: matrix,
      scope: [DEPENDENCY_SLOT_ID],
    });
    engine.openingStep();
    const r = engine.consumeAnswer({ downstreamId: 'art-a' });
    engine = r.engine.refreshMatrix(matrix);
    const r2 = engine.consumeAnswer({ upstreamId: 'art-a' });
    engine = r2.engine.refreshMatrix(matrix);
    const step = engine.nextStep();
    expect(step.probe.code).toBe('DEPENDENCY_SELF_EDGE');
  });
});

// ── 6. Cycle guard — the critical mechanic ────────────────────────────────────

describe('Dependency slot: cycle guard (transitive reachability)', () => {
  // reaches() unit tests — prove the BFS algorithm directly.
  it('reaches(): detects direct 2-cycle', () => {
    // Edge: B REQUIRES A. Adding A REQUIRES B would create a 2-cycle.
    // Cycle check call: reaches(upstreamId='B', downstreamId='A', edges).
    const edges = [{ id: 'e1', downstreamId: 'B', upstreamId: 'A' }];
    expect(reaches('B', 'A', edges)).toBe(true);
  });

  it('reaches(): detects transitive depth-2 cycle (A→B→C→A)', () => {
    const edges = [
      { id: 'e1', downstreamId: 'B', upstreamId: 'A' },
      { id: 'e2', downstreamId: 'C', upstreamId: 'B' },
    ];
    // Adding C→A would close A→B→C→A. Check: reaches(C, A)?
    expect(reaches('C', 'A', edges)).toBe(true);
  });

  it('reaches(): detects transitive depth-4 cycle', () => {
    const edges = [
      { id: 'e1', downstreamId: 'B', upstreamId: 'A' },
      { id: 'e2', downstreamId: 'C', upstreamId: 'B' },
      { id: 'e3', downstreamId: 'D', upstreamId: 'C' },
      { id: 'e4', downstreamId: 'E', upstreamId: 'D' },
    ];
    // Adding A→E would close E→D→C→B→A→E. Check: reaches(E, A)?
    expect(reaches('E', 'A', edges)).toBe(true);
  });

  it('reaches(): allows legal DAG edge (D→A, no back-path from A to D)', () => {
    const edges = [
      { id: 'e1', downstreamId: 'B', upstreamId: 'A' },
      { id: 'e2', downstreamId: 'C', upstreamId: 'B' },
    ];
    // D→A: D is new, A has no path back to D.
    expect(reaches('A', 'D', edges)).toBe(false);
  });

  it('reaches(): allows diamond shortcut (shared dependency, not a cycle)', () => {
    // A→B, A→C, B→D, C→D. Adding A→D (shortcut): is D→A reachable? No.
    const edges = [
      { id: 'e1', downstreamId: 'A', upstreamId: 'B' },
      { id: 'e2', downstreamId: 'A', upstreamId: 'C' },
      { id: 'e3', downstreamId: 'B', upstreamId: 'D' },
      { id: 'e4', downstreamId: 'C', upstreamId: 'D' },
    ];
    // Check: reaches(D, A)? D has no outgoing downstream edges → false.
    expect(reaches('D', 'A', edges)).toBe(false);
  });

  // Engine-level cycle gate test — proves context injection is wired correctly.
  // If firstFailingGate passes no ctx, existingEdges = [] and DEPENDENCY_CYCLE
  // never fires. This test would fail if ctx wiring is missing.
  it('DEPENDENCY_CYCLE fires for transitive cycle via engine (A→B→C, attempt C→A)', () => {
    const matrix = buildCustomMatrix(['art-a', 'art-b', 'art-c'], [
      { id: 'dep-a-b', downstreamId: 'art-b', upstreamId: 'art-a', type: 'hard_gate' },
      { id: 'dep-b-c', downstreamId: 'art-c', upstreamId: 'art-b', type: 'hard_gate' },
    ]);
    let engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: matrix,
      scope: [DEPENDENCY_SLOT_ID],
    });
    engine.openingStep();
    // Attempt: art-a REQUIRES art-c (would close art-a→art-b→art-c→art-a)
    let r = engine.consumeAnswer({ downstreamId: 'art-a' });
    engine = r.engine.refreshMatrix(matrix);
    r = engine.consumeAnswer({ upstreamId: 'art-c' });
    engine = r.engine.refreshMatrix(matrix);
    const step = engine.nextStep();
    expect(step.probe.code).toBe('DEPENDENCY_CYCLE');
  });

  it('DEPENDENCY_CYCLE allows a legal DAG edge after existing chain (D→A, A→B→C exists)', () => {
    const matrix = buildCustomMatrix(['art-a', 'art-b', 'art-c', 'art-d'], [
      { id: 'dep-a-b', downstreamId: 'art-b', upstreamId: 'art-a', type: 'hard_gate' },
      { id: 'dep-b-c', downstreamId: 'art-c', upstreamId: 'art-b', type: 'hard_gate' },
    ]);
    let engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: matrix,
      scope: [DEPENDENCY_SLOT_ID],
    });
    engine.openingStep();
    // art-d REQUIRES art-a: D is new, no path from A back to D.
    let r = engine.consumeAnswer({ downstreamId: 'art-d' });
    engine = r.engine.refreshMatrix(matrix);
    r = engine.consumeAnswer({ upstreamId: 'art-a' });
    engine = r.engine.refreshMatrix(matrix);
    const step = engine.nextStep();
    // Should NOT be DEPENDENCY_CYCLE — should advance to type gate.
    expect(step.probe.code).toBe('DEPENDENCY_TYPE_MISSING');
  });

  it('DEPENDENCY_CYCLE allows diamond shortcut via engine', () => {
    // A→B, A→C, B→D, C→D exist. Adding A→D shortcut: legal.
    const matrix = buildCustomMatrix(['art-a', 'art-b', 'art-c', 'art-d'], [
      { id: 'e1', downstreamId: 'art-a', upstreamId: 'art-b', type: 'hard_gate' },
      { id: 'e2', downstreamId: 'art-a', upstreamId: 'art-c', type: 'hard_gate' },
      { id: 'e3', downstreamId: 'art-b', upstreamId: 'art-d', type: 'hard_gate' },
      { id: 'e4', downstreamId: 'art-c', upstreamId: 'art-d', type: 'hard_gate' },
    ]);
    let engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: matrix,
      scope: [DEPENDENCY_SLOT_ID],
    });
    engine.openingStep();
    // art-a REQUIRES art-d (shortcut): D reaches A? No → allowed.
    let r = engine.consumeAnswer({ downstreamId: 'art-a' });
    engine = r.engine.refreshMatrix(matrix);
    r = engine.consumeAnswer({ upstreamId: 'art-d' });
    engine = r.engine.refreshMatrix(matrix);
    const step = engine.nextStep();
    expect(step.probe.code).toBe('DEPENDENCY_TYPE_MISSING');
  });
});

// ── 7. Type gate ──────────────────────────────────────────────────────────────

describe('Dependency slot: type gate', () => {
  it('fires DEPENDENCY_TYPE_MISSING after both endpoints are resolved', () => {
    const matrix = buildCustomMatrix(['art-a', 'art-b']);
    let engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: matrix,
      scope: [DEPENDENCY_SLOT_ID],
    });
    engine.openingStep();
    for (const answer of [{ downstreamId: 'art-b' }, { upstreamId: 'art-a' }]) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.code).toBe('DEPENDENCY_TYPE_MISSING');
    expect(step.probe.pickSet?.kind).toBe('dependencyTypeOptions');
  });
});

// ── 8. DECLARE_DEPENDENCY dispatch ───────────────────────────────────────────

describe('Dependency slot: DECLARE_DEPENDENCY dispatch', () => {
  it('dispatches DECLARE_DEPENDENCY with correct payload fields', () => {
    const state = buildSeededState('art-a', 'art-b');
    const { dispatchedActions } = runDependencyScript(
      [
        { downstreamId: 'art-b' },
        { upstreamId: 'art-a' },
        { type: 'hard_gate' },
      ],
      { initialState: state }
    );
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_DEPENDENCY');
    expect(decl).toBeTruthy();
    expect(decl.payload.downstreamId).toBe('art-b');
    expect(decl.payload.upstreamId).toBe('art-a');
    expect(decl.payload.type).toBe('hard_gate');
  });

  it('auto-generates id as dep-{upstream}-to-{downstream}', () => {
    const state = buildSeededState('art-a', 'art-b');
    const { dispatchedActions } = runDependencyScript(
      [{ downstreamId: 'art-b' }, { upstreamId: 'art-a' }, { type: 'hard_gate' }],
      { initialState: state }
    );
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_DEPENDENCY');
    expect(decl.payload.id).toBe('dep-art-a-to-art-b');
  });

  it('label defaults to null when not provided', () => {
    const state = buildSeededState('art-a', 'art-b');
    const { dispatchedActions } = runDependencyScript(
      [{ downstreamId: 'art-b' }, { upstreamId: 'art-a' }, { type: 'hard_gate' }],
      { initialState: state }
    );
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_DEPENDENCY');
    expect(decl.payload.label).toBeNull();
  });
});

// ── 9. Matrix landing ─────────────────────────────────────────────────────────

describe('Dependency slot: matrix landing', () => {
  it('edge lands in matrix.dependenciesById with all required fields', () => {
    const state = buildSeededState('art-a', 'art-b');
    const { state: finalState } = runDependencyScript(
      [{ downstreamId: 'art-b' }, { upstreamId: 'art-a' }, { type: 'directional' }],
      { initialState: state }
    );
    const edges = Object.values(finalState.matrix.dependenciesById);
    expect(edges).toHaveLength(1);
    expect(edges[0]).toEqual(
      expect.objectContaining({
        id: 'dep-art-a-to-art-b',
        downstreamId: 'art-b',
        upstreamId: 'art-a',
        type: 'directional',
        label: null,
      })
    );
  });
});

// ── 10. Reducer direct cycle rejection ────────────────────────────────────────

describe('Dependency slot: reducer cycle guard (last-line-of-defense)', () => {
  it('reducer rejects a direct cycle via DEPENDENCY_CYCLE in lastPlanError', () => {
    let state = buildSeededState('art-a', 'art-b');
    state = computeDerivedState(state, {
      type: 'DECLARE_DEPENDENCY',
      payload: { id: 'dep-a-b', downstreamId: 'art-b', upstreamId: 'art-a', type: 'hard_gate' },
    });
    // Adding B→A would close the cycle.
    const after = computeDerivedState(state, {
      type: 'DECLARE_DEPENDENCY',
      payload: { id: 'dep-b-a', downstreamId: 'art-a', upstreamId: 'art-b', type: 'hard_gate' },
    });
    expect(after.lastPlanError?.code).toBe('DEPENDENCY_CYCLE');
    // Edge must NOT have landed.
    expect(after.matrix.dependenciesById['dep-b-a']).toBeUndefined();
  });

  it('reducer rejects a transitive cycle (A→B→C, attempt C→A)', () => {
    let state = buildSeededState('art-a', 'art-b', 'art-c');
    state = computeDerivedState(state, {
      type: 'DECLARE_DEPENDENCY',
      payload: { id: 'dep-a-b', downstreamId: 'art-b', upstreamId: 'art-a', type: 'hard_gate' },
    });
    state = computeDerivedState(state, {
      type: 'DECLARE_DEPENDENCY',
      payload: { id: 'dep-b-c', downstreamId: 'art-c', upstreamId: 'art-b', type: 'hard_gate' },
    });
    // Attempt C→A (would close A→B→C→A).
    const after = computeDerivedState(state, {
      type: 'DECLARE_DEPENDENCY',
      payload: { id: 'dep-c-a', downstreamId: 'art-a', upstreamId: 'art-c', type: 'hard_gate' },
    });
    expect(after.lastPlanError?.code).toBe('DEPENDENCY_CYCLE');
    expect(after.matrix.dependenciesById['dep-c-a']).toBeUndefined();
  });

  it('reducer rejects self-edge', () => {
    const state = buildSeededState('art-a');
    const after = computeDerivedState(state, {
      type: 'DECLARE_DEPENDENCY',
      payload: { id: 'dep-self', downstreamId: 'art-a', upstreamId: 'art-a', type: 'hard_gate' },
    });
    expect(after.lastPlanError?.code).toBe('DEPENDENCY_SELF_EDGE');
  });

  it('reducer accepts a valid legal edge', () => {
    const state = buildSeededState('art-a', 'art-b');
    const after = computeDerivedState(state, {
      type: 'DECLARE_DEPENDENCY',
      payload: { id: 'dep-a-b', downstreamId: 'art-b', upstreamId: 'art-a', type: 'hard_gate' },
    });
    expect(after.lastPlanError?.code).not.toBe('DEPENDENCY_CYCLE');
    expect(after.matrix.dependenciesById['dep-a-b']).toBeDefined();
  });
});
