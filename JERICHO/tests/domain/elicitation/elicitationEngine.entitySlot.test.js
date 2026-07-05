import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  createElicitationEngine,
  ENTITY_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';

// Entity slot has no readback step — dispatches immediately when all gates pass.
function runEntityScript(script, opts = {}) {
  let state = buildBlankIdentityState({});
  let engine = createElicitationEngine({
    goalType: opts.goalType || 'founder',
    matrixSnapshot: state.matrix,
    scope: [ENTITY_SLOT_ID],
  });
  const probes = [];
  const dispatchedActions = [];
  let step = engine.openingStep();
  let pendingAnswers = [...script];
  let safety = 0;
  while (!step.done) {
    if (safety++ > 50) throw new Error('Engine did not terminate within safety bound');
    probes.push(step.probe);
    if (pendingAnswers.length === 0) {
      throw new Error(`Out of scripted answers — engine still asking about "${step.probe.fieldName}" (${step.probe.code})`);
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

// Real F8 Energy Co. entity from Operation Endgame canonical matrix.
const F8_SCRIPT = [
  { name: 'F8 Energy Co.' },
  { roleTags: ['business', 'system'] },
  { purpose: 'Energy and focus supplement company, a healthier alternative to energy drinks' },
  { formationState: 'named-only' },
  { statusEvidence: 'Brand name only, formula and product not yet developed' },
];

// ── 1. Gate ladder ────────────────────────────────────────────────────────────

describe('Elicitation Engine — Entity slot: gate ladder', () => {
  it('emits the name probe first on a blank slot', () => {
    const engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: buildBlankIdentityState({}).matrix,
      scope: [ENTITY_SLOT_ID],
    });
    const first = engine.openingStep();
    expect(first.done).toBe(false);
    expect(first.probe.slotId).toBe(ENTITY_SLOT_ID);
    expect(first.probe.fieldName).toBe('name');
    expect(first.probe.code).toBe('ENTITY_NAME_MISSING');
  });

  it('drives the full gate sequence name→roleTags→purpose→formationState→statusEvidence', () => {
    const { probes } = runEntityScript(F8_SCRIPT);
    expect(probes.map((p) => p.fieldName)).toEqual([
      'name',
      'roleTags',
      'purpose',
      'formationState',
      'statusEvidence',
    ]);
  });

  it('fires ENTITY_NAME_NOT_HOLDABLE when name is an imperative phrase', () => {
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [ENTITY_SLOT_ID],
    });
    engine.openingStep();
    // "Build the company" is an imperative verb + determiner — isHoldableNoun rejects it
    const result = engine.consumeAnswer({ name: 'Build the company' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('name');
    expect(step.probe.code).toBe('ENTITY_NAME_NOT_HOLDABLE');
  });
});

// ── 2. PickSet resolution ─────────────────────────────────────────────────────

describe('Elicitation Engine — Entity slot: pickSet resolution', () => {
  it('roleTagOptions pickSet returns the five canonical role tags', () => {
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [ENTITY_SLOT_ID],
    });
    engine.openingStep();
    const result = engine.consumeAnswer({ name: 'F8 Energy Co.' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('roleTags');
    expect(step.probe.pickSet?.kind).toBe('roleTagOptions');
    expect(step.probe.pickSet?.items.map((i) => i.id)).toEqual([
      'business',
      'initiative',
      'project',
      'system',
      'function',
    ]);
    expect(step.probe.dependencyGap).toBe(false);
  });

  it('formationStateOptions pickSet returns the seven formation states', () => {
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [ENTITY_SLOT_ID],
    });
    engine.openingStep();
    // Drive past name, roleTags, purpose
    const answers = [
      { name: 'F8 Energy Co.' },
      { roleTags: ['business'] },
      { purpose: 'Energy and focus supplement company, a healthier alternative to energy drinks' },
    ];
    for (const answer of answers) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('formationState');
    expect(step.probe.pickSet?.kind).toBe('formationStateOptions');
    expect(step.probe.pickSet?.items.map((i) => i.id)).toEqual([
      'not-formed',
      'named-only',
      'conceptual',
      'half-built',
      'in-development',
      'functioning',
      'legally-formed',
    ]);
    expect(step.probe.dependencyGap).toBe(false);
  });
});

// ── 3. Optional doneWhen path ─────────────────────────────────────────────────

describe('Elicitation Engine — Entity slot: optional doneWhen', () => {
  it('completes without asking for doneWhen when it is not supplied', () => {
    const { probes } = runEntityScript(F8_SCRIPT);
    // doneWhen is optional — no probe should ask for it
    expect(probes.map((p) => p.fieldName)).not.toContain('doneWhen');
  });

  it('dispatches DECLARE_ENTITY without doneWhen when not supplied', () => {
    const { dispatchedActions } = runEntityScript(F8_SCRIPT);
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_ENTITY');
    expect(decl).toBeTruthy();
    expect(decl.payload.doneWhen).toBeUndefined();
  });

  it('accepts a valid doneWhen and includes it in the dispatch payload', () => {
    const scriptWithDoneWhen = [
      { name: 'F8 Energy Co.' },
      { roleTags: ['business', 'system'] },
      { purpose: 'Energy and focus supplement company, a healthier alternative to energy drinks' },
      { formationState: 'named-only' },
      // doneWhen volunteered alongside statusEvidence — engine merges all fields
      { statusEvidence: 'Brand name only, formula and product not yet developed',
        doneWhen: 'Gum manufactured, on shelves, generating recurring revenue' },
    ];
    const { probes, dispatchedActions } = runEntityScript(scriptWithDoneWhen);
    // Engine must not ask for doneWhen — it was valid, gate never fired
    expect(probes.map((p) => p.fieldName)).not.toContain('doneWhen');
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_ENTITY');
    expect(decl.payload.doneWhen).toBe('Gum manufactured, on shelves, generating recurring revenue');
  });

  it('fires ENTITY_DONEWHEN_NOT_VERIFIABLE when doneWhen is an attestation breach', () => {
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [ENTITY_SLOT_ID],
    });
    engine.openingStep();
    const answers = [
      { name: 'F8 Energy Co.' },
      { roleTags: ['business'] },
      { purpose: 'Energy and focus supplement company, a healthier alternative to energy drinks' },
      { formationState: 'named-only' },
      // "Marked complete" is an attestation breach — isExternallyVerifiable rejects it
      { statusEvidence: 'Brand name only, formula and product not yet developed',
        doneWhen: 'Marked complete' },
    ];
    for (const answer of answers) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('doneWhen');
    expect(step.probe.code).toBe('ENTITY_DONEWHEN_NOT_VERIFIABLE');
  });
});

// ── 4. DECLARE_ENTITY dispatch and matrix landing ─────────────────────────────

describe('Elicitation Engine — Entity slot: DECLARE_ENTITY dispatch', () => {
  it('dispatches DECLARE_ENTITY when all required gates pass', () => {
    const { dispatchedActions } = runEntityScript(F8_SCRIPT);
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_ENTITY');
    expect(decl).toBeTruthy();
    expect(decl.payload).toEqual(
      expect.objectContaining({
        name: 'F8 Energy Co.',
        roleTags: ['business', 'system'],
        purpose: 'Energy and focus supplement company, a healthier alternative to energy drinks',
        formationState: 'named-only',
        statusEvidence: 'Brand name only, formula and product not yet developed',
      }),
    );
  });

  it('entity lands in matrix.entitiesById with all required fields', () => {
    const { state } = runEntityScript(F8_SCRIPT);
    const entities = Object.values(state.matrix.entitiesById);
    expect(entities.length).toBe(1);
    expect(entities[0]).toEqual(
      expect.objectContaining({
        name: 'F8 Energy Co.',
        roleTags: ['business', 'system'],
        purpose: 'Energy and focus supplement company, a healthier alternative to energy drinks',
        formationState: 'named-only',
        statusEvidence: 'Brand name only, formula and product not yet developed',
      }),
    );
    // Declared via elicitation — not via canonical seed
    expect(entities[0].source).toBe('operator_declared');
    // doneWhen omitted when not authored
    expect(entities[0].doneWhen).toBeUndefined();
  });

  it('populated entitiesById satisfies the project-slot declaredEntities pickSet', () => {
    // The structural payoff: after entity intake, the project slot can pick an owner.
    const { state } = runEntityScript(F8_SCRIPT);
    const entityEntries = Object.values(state.matrix.entitiesById);
    expect(entityEntries.length).toBeGreaterThan(0);
    // The pickSet builder reads entitiesById and produces { id, label } items.
    // Verify the declared entity would appear as a valid pick option.
    expect(entityEntries[0].id).toBeTruthy();
    expect(entityEntries[0].name).toBe('F8 Energy Co.');
  });
});
