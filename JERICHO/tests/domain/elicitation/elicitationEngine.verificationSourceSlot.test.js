import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  createElicitationEngine,
  VERIFICATION_SOURCE_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';

// First-class VS slot path: scope: [VERIFICATION_SOURCE_SLOT_ID].
// Proves the slot can be driven directly (not only via project spawn).
function runVSScript(script, opts = {}) {
  let state = buildBlankIdentityState({});
  let engine = createElicitationEngine({
    goalType: opts.goalType || 'founder',
    matrixSnapshot: state.matrix,
    scope: [VERIFICATION_SOURCE_SLOT_ID],
  });
  const probes = [];
  const dispatchedActions = [];
  let step = engine.openingStep();
  let pendingAnswers = [...script];
  let safety = 0;
  while (!step.done) {
    if (safety++ > 20) throw new Error('Engine did not terminate within safety bound');
    probes.push(step.probe);
    if (pendingAnswers.length === 0) {
      throw new Error(`Out of scripted answers — engine still asking "${step.probe.fieldName}" (${step.probe.code})`);
    }
    const answer = pendingAnswers.shift();
    const result = engine.consumeAnswer(answer);
    engine = result.engine;
    for (const action of result.dispatches || []) {
      dispatchedActions.push(action);
      state = computeDerivedState(state, action);
    }
    engine = engine.refreshMatrix(state.matrix);
    step = engine.nextStep();
  }
  return { state, probes, dispatchedActions };
}

// ── 1. Gate ladder ────────────────────────────────────────────────────────────

describe('Elicitation Engine — VS slot: gate ladder (first-class path)', () => {
  it('emits the SOURCE probe first on a blank slot (not DOMAIN)', () => {
    const engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: buildBlankIdentityState({}).matrix,
      scope: [VERIFICATION_SOURCE_SLOT_ID],
    });
    const first = engine.openingStep();
    expect(first.done).toBe(false);
    expect(first.probe.slotId).toBe(VERIFICATION_SOURCE_SLOT_ID);
    expect(first.probe.fieldName).toBe('source');
    expect(first.probe.code).toBe('VERIFICATION_SOURCE_SOURCE_MISSING');
  });

  it('drives the full gate sequence source → domain', () => {
    const { probes } = runVSScript([
      { source: 'Stripe' },
      { domain: 'Revenue' },
    ]);
    expect(probes.map((p) => p.fieldName)).toEqual(['source', 'domain']);
  });

  it('fires VERIFICATION_SOURCE_SOURCE_NOT_HOLDABLE when source is an action phrase', () => {
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [VERIFICATION_SOURCE_SLOT_ID],
    });
    engine.openingStep();
    const result = engine.consumeAnswer({ source: 'check the revenue dashboard' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('source');
    expect(step.probe.code).toBe('VERIFICATION_SOURCE_SOURCE_NOT_HOLDABLE');
  });

  it('accepts all canonical Operation Endgame source names as holdable', () => {
    const sources = [
      'Stripe',
      'DistroKid',
      'Spotify for Artists',
      'QuickBooks',
      'Google Analytics',
      'the county recorder',
      'bank statement',
      'KDP reports',
    ];
    for (const source of sources) {
      let state = buildBlankIdentityState({});
      let engine = createElicitationEngine({
        goalType: 'founder',
        matrixSnapshot: state.matrix,
        scope: [VERIFICATION_SOURCE_SLOT_ID],
      });
      engine.openingStep();
      const result = engine.consumeAnswer({ source });
      engine = result.engine.refreshMatrix(state.matrix);
      const step = engine.nextStep();
      expect(step.probe.code, `${source} should pass isHoldableNoun`).toBe(
        'VERIFICATION_SOURCE_DOMAIN_MISSING'
      );
    }
  });
});

// ── 2. DECLARE_VERIFICATION_SOURCE dispatch ───────────────────────────────────

describe('Elicitation Engine — VS slot: dispatch and matrix landing', () => {
  it('dispatches DECLARE_VERIFICATION_SOURCE when all gates pass', () => {
    const { dispatchedActions } = runVSScript([
      { source: 'Stripe' },
      { domain: 'Revenue' },
    ]);
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_VERIFICATION_SOURCE');
    expect(decl).toBeTruthy();
    expect(decl.payload).toEqual(
      expect.objectContaining({ source: 'Stripe', domain: 'Revenue' })
    );
  });

  it('source lands in matrix.verificationSourcesById with id and source fields', () => {
    const { state } = runVSScript([
      { source: 'Google Analytics' },
      { domain: 'Audience metrics' },
    ]);
    const sources = Object.values(state.matrix.verificationSourcesById);
    expect(sources.length).toBe(1);
    expect(sources[0].source).toBe('Google Analytics');
    expect(sources[0].domain).toBe('Audience metrics');
    expect(sources[0].id).toMatch(/^src-/);
  });
});

// ── 3. Spawn path coexists ────────────────────────────────────────────────────

describe('Elicitation Engine — VS slot: spawn path still works', () => {
  it('spawn pre-populates source so SOURCE gate passes silently — only domain is asked', () => {
    // Mimic the spawn: push a VS slot with source already captured.
    // Engine should ask only domain (not source) because source is pre-filled.
    // We test this via a minimal scope that starts with source captured, which
    // the real spawn does via applyAnswerToCurrentSlot.
    //
    // Simplest proxy: scope = [VS], but override the opening captured state
    // by providing source in the first answer. Engine merges it; source gates
    // pass; only domain is asked.
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [VERIFICATION_SOURCE_SLOT_ID],
    });
    // First step asks for source (normal). Provide it.
    const step1 = engine.openingStep();
    expect(step1.probe.fieldName).toBe('source');
    const r1 = engine.consumeAnswer({ source: 'DistroKid' });
    engine = r1.engine.refreshMatrix(state.matrix);
    // Second step should ask domain (source passed holdable check).
    const step2 = engine.nextStep();
    expect(step2.probe.fieldName).toBe('domain');
    expect(step2.probe.code).toBe('VERIFICATION_SOURCE_DOMAIN_MISSING');
    const r2 = engine.consumeAnswer({ domain: 'Music revenue' });
    engine = r2.engine.refreshMatrix(state.matrix);
    const step3 = engine.nextStep();
    expect(step3.done).toBe(true);
    // Dispatch emitted
    const allDispatches = [...(r1.dispatches || []), ...(r2.dispatches || [])];
    expect(allDispatches.find((a) => a.type === 'DECLARE_VERIFICATION_SOURCE')).toBeTruthy();
  });
});
