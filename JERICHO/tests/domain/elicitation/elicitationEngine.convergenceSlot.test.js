import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  createElicitationEngine,
  CONVERGENCE_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';
import { CONVERGENCE_SLOT } from '../../../src/domain/elicitation/convergenceSlot.ts';
import { hasAuthoredSubstance } from '../../../src/domain/planQuality/hasAuthoredSubstance.ts';
import { probeFor } from '../../../src/domain/elicitation/reprobes.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildBaseState() {
  let state = buildBlankIdentityState({});
  state = computeDerivedState(state, {
    type: 'DECLARE_ENTITY',
    payload: {
      id: 'ent-1',
      name: 'Global State Solutions',
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
      successMetric: '100 users confirmed in TestSource',
      verificationSourceId: 'vs-1',
    },
  });
  return state;
}

function addArtifact(state, id) {
  return computeDerivedState(state, {
    type: 'DECLARE_ARTIFACT',
    payload: {
      id,
      name: id,
      producingProjectId: 'proj-1',
      completionEvidence: `listed in TestSource and confirmed in catalog`,
      verificationSourceId: 'vs-1',
      operatorAttestationMethod: `open TestSource, confirm ${id} exists`,
    },
  });
}

function addSystem(state, id, name) {
  return computeDerivedState(state, {
    type: 'DECLARE_SYSTEM',
    payload: {
      id,
      name: name || id,
      owningEntityId: 'ent-1',
      cycle: 'continuous production cycle',
      activationState: 'running',
    },
  });
}

function runConvergenceScript(script, opts = {}) {
  let state = opts.initialState || buildBlankIdentityState({});
  let engine = createElicitationEngine({
    goalType: opts.goalType || 'generic',
    matrixSnapshot: opts.matrixSnapshot || state.matrix,
    scope: [CONVERGENCE_SLOT_ID],
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

function declareConvergence(state, payload) {
  return computeDerivedState(state, { type: 'DECLARE_CONVERGENCE', payload });
}

// ── 1. Structural ─────────────────────────────────────────────────────────────

describe('Convergence slot: structural', () => {
  it('gate ladder has exactly 7 gates', () => {
    expect(CONVERGENCE_SLOT.gate).toHaveLength(7);
  });

  it('gate codes follow ladder order (destination-first, 2026-07-10; no cycle gate)', () => {
    expect(CONVERGENCE_SLOT.gate.map((g) => g.code)).toEqual([
      'CONVERGENCE_TO_MISSING',
      'CONVERGENCE_TO_UNRESOLVED',
      'CONVERGENCE_FROM_MISSING',
      'CONVERGENCE_FROM_UNRESOLVED',
      'CONVERGENCE_SELF_EDGE',
      'CONVERGENCE_GIVES_MISSING',
      'CONVERGENCE_GIVES_NOT_SUBSTANTIVE',
    ]);
  });

  it('gate field names match gate order', () => {
    expect(CONVERGENCE_SLOT.gate.map((g) => g.fieldName)).toEqual([
      'toNodeId',
      'toNodeId',
      'fromNodeId',
      'fromNodeId',
      'fromNodeId',
      'gives',
      'gives',
    ]);
  });
});

// ── 2. Gate sequence ──────────────────────────────────────────────────────────

describe('Convergence slot: gate sequence', () => {
  it('emits CONVERGENCE_TO_MISSING first on a blank slot (destination is the subject)', () => {
    const engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: buildBlankIdentityState({}).matrix,
      scope: [CONVERGENCE_SLOT_ID],
    });
    const first = engine.openingStep();
    expect(first.probe.code).toBe('CONVERGENCE_TO_MISSING');
    expect(first.probe.fieldName).toBe('toNodeId');
  });

  it('drives the full gate sequence: toNodeId → fromNodeId → gives', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-album');
    state = addArtifact(state, 'art-podcast');
    const { probes } = runConvergenceScript(
      [
        { toNodeId: 'art-podcast' },
        { fromNodeId: 'art-album' },
        { gives: 'creates awareness for the podcast' },
      ],
      { initialState: state }
    );
    expect(probes.map((p) => p.fieldName)).toEqual(['toNodeId', 'fromNodeId', 'gives']);
  });

  it('binds later questions to the destination name (subject binding)', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-album');
    state = addArtifact(state, 'art-podcast');
    let engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: state.matrix,
      scope: [CONVERGENCE_SLOT_ID],
    });
    engine.openingStep();
    const r = engine.consumeAnswer({ toNodeId: 'art-podcast' });
    engine = r.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('fromNodeId');
    expect(step.probe.spine).toContain('art-podcast'); // destination name bound
    expect(step.probe.spine).not.toContain('this destination');
  });

  it('emits CONVERGENCE_FROM_UNRESOLVED for unknown fromNodeId', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-b');
    const engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: state.matrix,
      scope: [CONVERGENCE_SLOT_ID],
    });
    let step = engine.openingStep();
    // Destination-first: answer toNodeId, then the bogus source.
    let r = engine.consumeAnswer({ toNodeId: 'art-b' });
    r = r.engine.refreshMatrix(state.matrix).consumeAnswer({ fromNodeId: 'nonexistent-node' });
    step = r.engine.refreshMatrix(state.matrix).nextStep();
    expect(step.probe.code).toBe('CONVERGENCE_FROM_UNRESOLVED');
  });

  it('emits CONVERGENCE_TO_UNRESOLVED for unknown toNodeId', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-a');
    const engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: state.matrix,
      scope: [CONVERGENCE_SLOT_ID],
    });
    let step = engine.openingStep();
    let r = engine.consumeAnswer({ fromNodeId: 'art-a' });
    step = r.engine.refreshMatrix(state.matrix).nextStep();
    r = r.engine.refreshMatrix(state.matrix).consumeAnswer({ toNodeId: 'does-not-exist' });
    step = r.engine.refreshMatrix(state.matrix).nextStep();
    expect(step.probe.code).toBe('CONVERGENCE_TO_UNRESOLVED');
  });

  it('emits CONVERGENCE_GIVES_MISSING when gives absent', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-a');
    state = addArtifact(state, 'art-b');

    let engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: state.matrix,
      scope: [CONVERGENCE_SLOT_ID],
    });
    let r = engine.consumeAnswer({ fromNodeId: 'art-a' });
    engine = r.engine.refreshMatrix(state.matrix);
    r = engine.consumeAnswer({ toNodeId: 'art-b' });
    engine = r.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();
    expect(step.probe.code).toBe('CONVERGENCE_GIVES_MISSING');
  });
});

// ── 3. allDeclaredNodeOptions — cross-registry ────────────────────────────────

describe('Convergence slot: allDeclaredNodeOptions cross-registry', () => {
  it('pickSet includes nodes from entity, system, and artifact registries', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-album');
    state = addSystem(state, 'sys-jericho', 'Jericho');
    // ent-1 is already declared in buildBaseState

    const engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: state.matrix,
      scope: [CONVERGENCE_SLOT_ID],
    });
    const first = engine.openingStep();
    expect(first.probe.pickSet?.kind).toBe('allDeclaredNodeOptions');
    const ids = first.probe.pickSet.items.map((i) => i.id);
    expect(ids).toContain('ent-1');      // entity
    expect(ids).toContain('sys-jericho'); // system
    expect(ids).toContain('art-album');   // artifact
  });

  it('items carry nodeType labels per registry', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-x');
    state = addSystem(state, 'sys-x', 'System X');

    const engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: state.matrix,
      scope: [CONVERGENCE_SLOT_ID],
    });
    const first = engine.openingStep();
    const items = first.probe.pickSet.items;
    const entityItem = items.find((i) => i.id === 'ent-1');
    const systemItem = items.find((i) => i.id === 'sys-x');
    const artifactItem = items.find((i) => i.id === 'art-x');
    expect(entityItem?.nodeType).toBe('entity');
    expect(systemItem?.nodeType).toBe('system');
    expect(artifactItem?.nodeType).toBe('artifact');
  });

  it('dependencyGap true when no nodes declared', () => {
    const engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: buildBlankIdentityState({}).matrix,
      scope: [CONVERGENCE_SLOT_ID],
    });
    const first = engine.openingStep();
    expect(first.probe.dependencyGap).toBe(true);
  });
});

// ── 4. Self-edge rejection ────────────────────────────────────────────────────

describe('Convergence slot: self-edge rejection', () => {
  it('CONVERGENCE_SELF_EDGE fires when a source equals the destination (via engine)', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-loop');

    const engine = createElicitationEngine({
      goalType: 'generic',
      matrixSnapshot: state.matrix,
      scope: [CONVERGENCE_SLOT_ID],
    });
    let step = engine.openingStep();
    let r = engine.consumeAnswer({ toNodeId: 'art-loop' });
    r = r.engine.refreshMatrix(state.matrix).consumeAnswer({ fromNodeId: 'art-loop' });
    step = r.engine.refreshMatrix(state.matrix).nextStep();
    expect(step.probe.code).toBe('CONVERGENCE_SELF_EDGE');
  });
});

// ── 5. LOOPS ARE LEGAL — the defining Section 8 property ─────────────────────

describe('Convergence slot: loops are legal (inverse of dependency cycle guard)', () => {
  it('2-cycle (A→B and B→A) both succeed via reducer — no cycle guard', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-album');
    state = addArtifact(state, 'art-revenue');

    // Forward: album → gives awareness → revenue
    state = declareConvergence(state, {
      id: 'conv-album-to-revenue',
      fromNodeId: 'art-album',
      toNodeId: 'art-revenue',
      gives: 'creates audience that drives revenue',
    });
    expect(state.matrix.convergenceEdgesById['conv-album-to-revenue']).toBeDefined();
    expect(state.lastPlanError).toBeFalsy();

    // Reverse: revenue → funds → album (closes the loop — MUST be legal)
    state = declareConvergence(state, {
      id: 'conv-revenue-to-album',
      fromNodeId: 'art-revenue',
      toNodeId: 'art-album',
      gives: 'funds the next release',
    });
    expect(state.matrix.convergenceEdgesById['conv-revenue-to-album']).toBeDefined();
    expect(state.lastPlanError).toBeFalsy();
  });

  it('3-cycle (A→B→C→A) all succeed — the master flywheel is valid', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-album');
    state = addArtifact(state, 'art-podcast');
    state = addArtifact(state, 'art-app');

    state = declareConvergence(state, {
      id: 'c1',
      fromNodeId: 'art-album',
      toNodeId: 'art-podcast',
      gives: 'creates awareness',
    });
    state = declareConvergence(state, {
      id: 'c2',
      fromNodeId: 'art-podcast',
      toNodeId: 'art-app',
      gives: 'deepens trust',
    });
    state = declareConvergence(state, {
      id: 'c3',
      fromNodeId: 'art-app',
      toNodeId: 'art-album',
      gives: 'drives revenue that funds the album',
    });

    expect(Object.keys(state.matrix.convergenceEdgesById)).toHaveLength(3);
    expect(state.lastPlanError).toBeFalsy();
  });

  it('mutual (A⇄B) succeeds — bidirectional is valid', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-film');
    state = addArtifact(state, 'art-product');

    state = declareConvergence(state, {
      id: 'c-film-to-product',
      fromNodeId: 'art-film',
      toNodeId: 'art-product',
      gives: 'product placement in the film',
    });
    state = declareConvergence(state, {
      id: 'c-product-to-film',
      fromNodeId: 'art-product',
      toNodeId: 'art-film',
      gives: 'funds the film production',
    });

    expect(state.matrix.convergenceEdgesById['c-film-to-product']).toBeDefined();
    expect(state.matrix.convergenceEdgesById['c-product-to-film']).toBeDefined();
    expect(state.lastPlanError).toBeFalsy();
  });

  it('engine does not emit a cycle gate code for B→A after A→B is declared', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-a');
    state = addArtifact(state, 'art-b');

    // Declare A→B via reducer first
    state = declareConvergence(state, {
      id: 'c-a-to-b',
      fromNodeId: 'art-a',
      toNodeId: 'art-b',
      gives: 'creates awareness for art-b',
    });

    // Now run engine to declare B→A — no cycle gate should fire
    const { probes, dispatchedActions } = runConvergenceScript(
      [
        { fromNodeId: 'art-b' },
        { toNodeId: 'art-a' },
        { gives: 'funds art-a production' },
      ],
      { initialState: state }
    );

    // Should drive: fromNodeId → toNodeId → gives (no cycle code)
    const codes = probes.map((p) => p.code);
    expect(codes).not.toContain('CONVERGENCE_CYCLE');
    expect(dispatchedActions.length).toBeGreaterThan(0);
    expect(dispatchedActions[0].type).toBe('DECLARE_CONVERGENCE');
  });
});

// ── 6. Broken edge — first-class data ─────────────────────────────────────────

describe('Convergence slot: broken edge is first-class', () => {
  it('broken: true with substantive gives succeeds and stores broken: true', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-audience');
    state = addArtifact(state, 'art-email-list');

    state = declareConvergence(state, {
      id: 'c-broken',
      fromNodeId: 'art-audience',
      toNodeId: 'art-email-list',
      gives: 'captured contacts from live audience',
      broken: true,
    });

    const edge = state.matrix.convergenceEdgesById['c-broken'];
    expect(edge).toBeDefined();
    expect(edge.broken).toBe(true);
    expect(state.lastPlanError).toBeFalsy();
  });

  it('broken: true without gives still fails CONVERGENCE_GIVES_MISSING — broken does not exempt gives', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-audience');
    state = addArtifact(state, 'art-email-list');

    state = declareConvergence(state, {
      id: 'c-broken-no-gives',
      fromNodeId: 'art-audience',
      toNodeId: 'art-email-list',
      gives: '',
      broken: true,
    });

    expect(state.matrix.convergenceEdgesById['c-broken-no-gives']).toBeUndefined();
    expect(state.lastPlanError?.code).toBe('CONVERGENCE_INVALID');
  });

  it('broken defaults to false when not specified', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-x');
    state = addArtifact(state, 'art-y');

    state = declareConvergence(state, {
      id: 'c-normal',
      fromNodeId: 'art-x',
      toNodeId: 'art-y',
      gives: 'funds the next release',
    });

    expect(state.matrix.convergenceEdgesById['c-normal']?.broken).toBe(false);
  });
});

// ── 7. gives substance — real hasAuthoredSubstance verdicts ───────────────────

describe('gives substance: real predicate verdicts', () => {
  it('reports verdicts for canonical gives phrases — real and borderline (real predicate is authority)', () => {
    // Real jargon list: 'synergies' (plural) is caught, 'synergy' (singular) is NOT.
    // Lead-verb list: 'facilitates', 'enables', 'leverages', etc. are caught.
    const cases = [
      { gives: 'creates synergy' },                // borderline — 'synergy' singular not in jargon list
      { gives: 'adds value' },                     // borderline — 'value' not in jargon list
      { gives: 'funds the next release' },         // concrete — should pass
      { gives: 'creates awareness' },              // concrete — should pass
      { gives: 'facilitates alignment' },          // junk — 'facilitates' lead-verb + 'alignment' jargon
      { gives: 'drives synergies' },               // junk — 'synergies' plural in JARGON_WORDS_RE
    ];

    const verdicts = cases.map((c) => ({
      gives: c.gives,
      substantive: hasAuthoredSubstance(c.gives),
    }));

    // Report all verdicts so calibration is visible
    console.log('gives substance verdicts (real predicate):', JSON.stringify(verdicts, null, 2));

    // Concrete gives: must pass
    expect(verdicts.find((v) => v.gives === 'funds the next release')?.substantive).toBe(true);
    expect(verdicts.find((v) => v.gives === 'creates awareness')?.substantive).toBe(true);

    // Structural junk: must fail (caught by lead-verb and/or JARGON_WORDS_RE)
    expect(verdicts.find((v) => v.gives === 'facilitates alignment')?.substantive).toBe(false);
    expect(verdicts.find((v) => v.gives === 'drives synergies')?.substantive).toBe(false);

    // Borderline: report, don't lock — predicate calibration may evolve
    const synergy = verdicts.find((v) => v.gives === 'creates synergy')?.substantive;
    const addsValue = verdicts.find((v) => v.gives === 'adds value')?.substantive;
    console.log(`gives: 'creates synergy' → ${synergy ? 'PASS (accepted by predicate)' : 'FAIL (rejected)'}`);
    console.log(`gives: 'adds value' → ${addsValue ? 'PASS (accepted by predicate)' : 'FAIL (rejected)'}`);
  });

  it('CONVERGENCE_GIVES_NOT_SUBSTANTIVE fires for structural jargon gives via gate', () => {
    // 'facilitates' is a lead-mgmt-verb — caught by isAbstractJargon
    const jargonCapture = { fromNodeId: 'x', toNodeId: 'y', gives: 'facilitates alignment' };
    const giveGate = CONVERGENCE_SLOT.gate.find((g) => g.code === 'CONVERGENCE_GIVES_NOT_SUBSTANTIVE');
    expect(giveGate).toBeDefined();
    expect(giveGate.detect(jargonCapture)).toBe(true);
  });

  it('CONVERGENCE_GIVES_NOT_SUBSTANTIVE does not fire for substantive gives', () => {
    const realCapture = { fromNodeId: 'x', toNodeId: 'y', gives: 'funds the next release' };
    const giveGate = CONVERGENCE_SLOT.gate.find((g) => g.code === 'CONVERGENCE_GIVES_NOT_SUBSTANTIVE');
    expect(giveGate.detect(realCapture)).toBe(false);
  });
});

// ── 8. DECLARE_CONVERGENCE reducer ───────────────────────────────────────────

describe('DECLARE_CONVERGENCE reducer', () => {
  it('stores edge in convergenceEdgesById with all fields', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-album');
    state = addArtifact(state, 'art-podcast');

    state = declareConvergence(state, {
      id: 'c-test',
      fromNodeId: 'art-album',
      toNodeId: 'art-podcast',
      gives: 'creates awareness for the podcast',
    });

    const edge = state.matrix.convergenceEdgesById['c-test'];
    expect(edge).toBeDefined();
    expect(edge.fromNodeId).toBe('art-album');
    expect(edge.toNodeId).toBe('art-podcast');
    expect(edge.gives).toBe('creates awareness for the podcast');
    expect(edge.broken).toBe(false);
    expect(edge.declaredAtISO).toBeDefined();
  });

  it('accepts endpoint from entity registry (cross-registry)', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-album');
    // ent-1 is in entitiesById, not artifactsById

    state = declareConvergence(state, {
      id: 'c-entity-endpoint',
      fromNodeId: 'art-album',
      toNodeId: 'ent-1',
      gives: 'funds the entity operations',
    });

    expect(state.matrix.convergenceEdgesById['c-entity-endpoint']).toBeDefined();
    expect(state.lastPlanError).toBeFalsy();
  });

  it('accepts endpoint from system registry (cross-registry)', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-album');
    state = addSystem(state, 'sys-jericho', 'Jericho');

    state = declareConvergence(state, {
      id: 'c-system-endpoint',
      fromNodeId: 'art-album',
      toNodeId: 'sys-jericho',
      gives: 'validates the system with real revenue',
    });

    expect(state.matrix.convergenceEdgesById['c-system-endpoint']).toBeDefined();
    expect(state.lastPlanError).toBeFalsy();
  });

  it('rejects unknown fromNodeId', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-b');

    state = declareConvergence(state, {
      id: 'c-bad',
      fromNodeId: 'ghost-node',
      toNodeId: 'art-b',
      gives: 'funds the release',
    });

    expect(state.matrix.convergenceEdgesById['c-bad']).toBeUndefined();
    expect(state.lastPlanError?.code).toBe('CONVERGENCE_FROM_UNKNOWN');
  });

  it('rejects unknown toNodeId', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-a');

    state = declareConvergence(state, {
      id: 'c-bad',
      fromNodeId: 'art-a',
      toNodeId: 'ghost-node',
      gives: 'funds the release',
    });

    expect(state.matrix.convergenceEdgesById['c-bad']).toBeUndefined();
    expect(state.lastPlanError?.code).toBe('CONVERGENCE_TO_UNKNOWN');
  });

  it('rejects self-edge', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-a');

    state = declareConvergence(state, {
      id: 'c-self',
      fromNodeId: 'art-a',
      toNodeId: 'art-a',
      gives: 'funds itself',
    });

    expect(state.matrix.convergenceEdgesById['c-self']).toBeUndefined();
    expect(state.lastPlanError?.code).toBe('CONVERGENCE_SELF_EDGE');
  });

  it('rejects edge with missing gives', () => {
    let state = buildBaseState();
    state = addArtifact(state, 'art-a');
    state = addArtifact(state, 'art-b');

    state = declareConvergence(state, {
      id: 'c-nogives',
      fromNodeId: 'art-a',
      toNodeId: 'art-b',
      gives: '',
    });

    expect(state.matrix.convergenceEdgesById['c-nogives']).toBeUndefined();
    expect(state.lastPlanError?.code).toBe('CONVERGENCE_INVALID');
  });

  it('no reprobe authored check — all convergence gate codes have reprobes', () => {
    const codes = CONVERGENCE_SLOT.gate.map((g) => g.code);
    for (const code of codes) {
      const probe = probeFor(code, 'generic');
      expect(probe, `No reprobe authored for ${code}`).toBeDefined();
      expect(probe.spine, `Empty spine for ${code}`).toBeTruthy();
    }
  });
});
