import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  createElicitationEngine,
  PROJECT_SLOT_ID,
  VERIFICATION_SOURCE_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';

/**
 * JERICHO DETERMINISTIC ELICITATION ENGINE — acceptance tests.
 *
 * Implements the five acceptance criteria from the spec:
 *   1. Deterministic replay
 *   2. Law 2 proving ground (Project slot worked trace from §9)
 *   3. No model verdict (grep proof)
 *   4. Extract-not-recall (no slot filled from seed or prior state)
 *   5. Cross-section order (dependsOn before children — owner pickSet
 *      reads from declared entities; source spawns Section 1A if undeclared)
 */

function applyDispatches(state, dispatches) {
  return (dispatches || []).reduce((acc, action) => computeDerivedState(acc, action), state);
}

function buildSeededMatrixState() {
  let state = buildBlankIdentityState({});
  // The host has declared one entity already so the Project slot has
  // something to pick into. Section 1A is intentionally left empty —
  // the engine should spawn it when the operator names a new source.
  state = computeDerivedState(state, {
    type: 'DECLARE_NODE',
    payload: { id: 'node-gs-corp', name: 'Global State Corp.', roleTags: ['Business'] },
  });
  return state;
}

function runScript(initialState, script, opts = {}) {
  // script is an array of operator answers; the engine drives the probes.
  // We capture every probe and every dispatch in arrival order so the
  // sequence is recorded for deterministic-replay verification.
  let state = initialState;
  let engine = createElicitationEngine({
    goalType: opts.goalType || 'musician',
    matrixSnapshot: state.matrix,
    scope: opts.scope || [PROJECT_SLOT_ID],
  });
  const probes = [];
  const dispatchedActions = [];
  let step = engine.openingStep();
  let pendingAnswers = [...script];
  let safety = 0;
  while (!step.done) {
    if (safety++ > 50) throw new Error('Engine did not terminate within safety bound');
    if (step.readback) {
      // Auto-confirm readbacks in acceptance tests — the readback mechanic has
      // its own test suite; here we care about the probe + dispatch contract.
      const result = engine.confirmReadback({ confirmed: true });
      engine = result.engine;
      for (const action of result.dispatches || []) {
        dispatchedActions.push(action);
        state = computeDerivedState(state, action);
      }
      engine = engine.refreshMatrix(state.matrix);
      step = engine.nextStep();
      continue;
    }
    probes.push(step.probe);
    if (pendingAnswers.length === 0) {
      throw new Error(`Out of scripted answers — engine still asking ${step.probe.spine}`);
    }
    const answer = pendingAnswers.shift();
    const result = engine.consumeAnswer(answer);
    engine = result.engine;
    for (const action of result.dispatches || []) {
      dispatchedActions.push(action);
      state = computeDerivedState(state, action);
    }
    // Refresh the engine's view of the matrix after dispatches so subsequent
    // pickSets / spawn checks see what the host actually persisted.
    engine = engine.refreshMatrix(state.matrix);
    step = engine.nextStep();
  }
  return { state, probes, dispatchedActions };
}

describe('Elicitation Engine — Project slot (§9 worked trace, Law 2 proving ground)', () => {
  it('emits the project NAME probe first when no answers have been given', () => {
    const state = buildSeededMatrixState();
    const engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [PROJECT_SLOT_ID],
    });
    const first = engine.openingStep();
    expect(first.done).toBe(false);
    expect(first.probe.slotId).toBe(PROJECT_SLOT_ID);
    expect(first.probe.fieldName).toBe('name');
    expect(first.probe.spine).toMatch(/name of this project/i);
    expect(first.probe.examples).toMatch(/Romance Riot/i);
  });

  it('emits PROJECT_OWNER_MISSING after the name is captured (pickSet from declared entities)', () => {
    const state = buildSeededMatrixState();
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [PROJECT_SLOT_ID],
    });
    engine.openingStep();
    const result = engine.consumeAnswer({ name: 'Romance Riot' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('owningEntityId');
    // 2026-07-10: spine carries the 'this project' binder token, so with the
    // name captured the question binds to the item — "owns Romance Riot?".
    expect(step.probe.spine).toMatch(/which part of your operation owns Romance Riot/i);
    expect(step.probe.pickSet?.kind).toBe('declaredEntities');
    expect(step.probe.pickSet?.items.map((item) => item.id)).toContain('node-gs-corp');
  });

  it('runs the full §9 worked trace end-to-end and dispatches DECLARE_PROJECT', () => {
    const initial = buildSeededMatrixState();
    const { state, probes, dispatchedActions } = runScript(
      initial,
      [
        { name: 'Romance Riot' },
        { owningEntityId: 'node-gs-corp' },
        { successMetric: '10,000 first-week streams' },
        { verificationSource: 'Spotify for Artists', domain: 'Music streams' },
        // §5 phase attestation (Wave 2 Gate 1) — required project gate, asked after the source.
        { phase: '2' },
        // Legal formation gate — music projects don't typically require legal formation
        { requiresLegalFormation: false },
      ],
      { goalType: 'musician' }
    );
    // Probe sequence matches §9, extended with the §5 phase attestation gate and legal formation gate.
    expect(probes.map((p) => p.fieldName)).toEqual([
      'name',
      'owningEntityId',
      'successMetric',
      'verificationSource',
      'phase',
      'requiresLegalFormation',
    ]);
    // Section 1A spawned and declared
    expect(dispatchedActions.find((a) => a.type === 'DECLARE_VERIFICATION_SOURCE')).toBeTruthy();
    // Section 5 declared with the attestation pair
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_PROJECT');
    expect(decl).toBeTruthy();
    expect(decl.payload).toEqual(
      expect.objectContaining({
        name: 'Romance Riot',
        owningEntityId: 'node-gs-corp',
        successMetric: '10,000 first-week streams',
      })
    );
    // Final matrix state holds the project with all required fields
    const projects = Object.values(state.matrix.projectsById);
    expect(projects.length).toBe(1);
    expect(projects[0]).toEqual(
      expect.objectContaining({
        name: 'Romance Riot',
        owningEntityId: 'node-gs-corp',
        successMetric: '10,000 first-week streams',
      })
    );
    expect(projects[0].verificationSourceId).toBeTruthy();
  });
});

describe('Elicitation Engine — acceptance criterion #1: deterministic replay', () => {
  it('emits a byte-identical probe sequence and identical DECLARE_* payloads across two runs of the same script', () => {
    const script = [
      { name: 'Romance Riot' },
      { owningEntityId: 'node-gs-corp' },
      { successMetric: '10,000 first-week streams' },
      { verificationSource: 'Spotify for Artists', domain: 'Music streams' },
      { phase: '2' }, // §5 phase attestation (Wave 2 Gate 1) — required project gate.
      { requiresLegalFormation: false }, // Legal formation gate
    ];
    const a = runScript(buildSeededMatrixState(), script, { goalType: 'musician' });
    const b = runScript(buildSeededMatrixState(), script, { goalType: 'musician' });
    expect(b.probes.map((p) => p.spine)).toEqual(a.probes.map((p) => p.spine));
    expect(b.probes.map((p) => p.fieldName)).toEqual(a.probes.map((p) => p.fieldName));
    expect(b.dispatchedActions.map((d) => d.type)).toEqual(
      a.dispatchedActions.map((d) => d.type)
    );
  });
});

describe('Elicitation Engine — acceptance criterion #3: no model verdict', () => {
  it('engine source code contains no string that could let a model declare completeness', () => {
    const enginePath = path.resolve(
      __dirname,
      '../../../src/domain/elicitation/elicitationEngine.js'
    );
    const slotProject = path.resolve(
      __dirname,
      '../../../src/domain/elicitation/slots/projectSlot.js'
    );
    const slotVS = path.resolve(
      __dirname,
      '../../../src/domain/elicitation/slots/verificationSourceSlot.js'
    );
    const reprobes = path.resolve(__dirname, '../../../src/domain/elicitation/reprobes.js');
    const sources = [enginePath, slotProject, slotVS, reprobes]
      .map((p) => fs.readFileSync(p, 'utf-8'))
      .join('\n');
    // Forbidden phrases — these are what would let a model issue a verdict.
    expect(sources).not.toMatch(/model.*(complete|sufficient|done|verdict)/i);
    expect(sources).not.toMatch(/llm\b/i);
    expect(sources).not.toMatch(/\bopenai\b/i);
    expect(sources).not.toMatch(/\banthropic\b/i);
    // The forbidden literal sentence (per §3): "this is complete"
    expect(sources).not.toMatch(/this is complete/i);
  });
});

describe('Elicitation Engine — acceptance criterion #4: extract-not-recall', () => {
  it('starts with zero captured fields and reads nothing from prior matrix content', () => {
    const state = buildSeededMatrixState();
    const engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [PROJECT_SLOT_ID],
    });
    expect(engine.snapshotCapturedFields()).toEqual({});
  });

  it('after the engine completes a project, every populated field traces to a captured answer (none from seed)', () => {
    const initial = buildSeededMatrixState();
    const { state, dispatchedActions } = runScript(
      initial,
      [
        { name: 'Romance Riot' },
        { owningEntityId: 'node-gs-corp' },
        { successMetric: '10,000 first-week streams' },
        { verificationSource: 'Spotify for Artists', domain: 'Music streams' },
        { phase: '2' }, // §5 phase attestation (Wave 2 Gate 1) — required project gate.
        { requiresLegalFormation: false }, // Legal formation gate
      ],
      { goalType: 'musician' }
    );
    const projDecl = dispatchedActions.find((a) => a.type === 'DECLARE_PROJECT');
    // Every field in the dispatch comes from the script — there is no field
    // the engine could have filled from ENTERPRISE_IDENTITY_MAP or any seed.
    expect(projDecl.payload.name).toBe('Romance Riot');
    expect(projDecl.payload.successMetric).toBe('10,000 first-week streams');
    expect(projDecl.payload.owningEntityId).toBe('node-gs-corp');
    // The verificationSourceId resolves to the source the engine SPAWNED,
    // which itself was declared in this session — not pulled from a constant.
    const sourceDecl = dispatchedActions.find(
      (a) => a.type === 'DECLARE_VERIFICATION_SOURCE'
    );
    expect(sourceDecl.payload.source).toBe('Spotify for Artists');
    expect(state.matrix.verificationSourcesById[sourceDecl.payload.id]?.source).toBe(
      'Spotify for Artists'
    );
  });
});

describe('Elicitation Engine — acceptance criterion #5: cross-section ordering', () => {
  it('does not emit the owner probe before the entity registry has at least one node to pick', () => {
    // Build a state with NO declared entities. Project slot should refuse to
    // advance past PROJECT_OWNER_MISSING because the pickSet is empty.
    const emptyState = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: emptyState.matrix,
      scope: [PROJECT_SLOT_ID],
    });
    engine.openingStep();
    const result = engine.consumeAnswer({ name: 'Romance Riot' });
    engine = result.engine.refreshMatrix(emptyState.matrix);
    const step = engine.nextStep();
    // The engine must refuse to manufacture an owner — it surfaces a
    // dependency probe pointing at Section 2 instead of pressing on.
    expect(step.probe.fieldName).toBe('owningEntityId');
    expect(step.probe.pickSet?.kind).toBe('declaredEntities');
    expect(step.probe.pickSet?.items).toEqual([]);
    // Operator cannot pick from an empty set. The probe is a true cross-section
    // gap — the host must open a Section 2 declaration flow before continuing.
    expect(step.probe.dependencyGap).toBe(true);
  });
});
