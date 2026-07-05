import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  createElicitationEngine,
  INITIATIVE_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';
import { INITIATIVE_OWNER_ENTITY_LESS } from '../../../src/domain/elicitation/initiativeSlot.ts';

// Initiative slot has no readback step.
function runInitiativeScript(script, opts = {}) {
  let state = opts.initialState || buildBlankIdentityState({});
  let engine = createElicitationEngine({
    goalType: opts.goalType || 'founder',
    matrixSnapshot: state.matrix,
    scope: [INITIATIVE_SLOT_ID],
  });
  const probes = [];
  const dispatchedActions = [];
  let step = engine.openingStep();
  let pendingAnswers = [...script];
  let safety = 0;
  while (!step.done) {
    if (safety++ > 30) throw new Error('Engine did not terminate within safety bound');
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

// Seed a matrix with two entities: one [initiative]-capable, one NOT.
// Used to prove the role-tag filter is load-bearing.
function buildMixedEntityState() {
  let state = buildBlankIdentityState({});
  // [initiative]-capable entity — should appear in initiativeOwnerOptions
  state = computeDerivedState(state, {
    type: 'DECLARE_ENTITY',
    payload: {
      id: 'ent-gs-corp',
      name: 'Global State Corp.',
      roleTags: ['business', 'initiative'],
      purpose: 'Energy and focus supplement company, a healthier alternative to energy drinks',
      formationState: 'named-only',
      statusEvidence: 'Brand name only, formula and product not yet developed',
    },
  });
  // NOT [initiative]-capable — should be ABSENT from initiativeOwnerOptions
  state = computeDerivedState(state, {
    type: 'DECLARE_ENTITY',
    payload: {
      id: 'ent-f8-system',
      name: 'F8 Distribution System',
      roleTags: ['system'],           // no 'initiative' tag
      purpose: 'The internal logistics and distribution infrastructure for F8 Energy Co.',
      formationState: 'conceptual',
      statusEvidence: 'Concept only, no infrastructure or contracts in place',
    },
  });
  return state;
}

// Real Operation Endgame initiative: OFL release spine (owned)
const OFL_SCRIPT = (owningEntityId) => [
  { name: 'OFL release spine' },
  { owningEntityId },
  { purpose: '7 tapes released building audience to the terminal album and industry positioning' },
  { classification: 'objective' },
  { doneWhen: '7 tapes produced and released under the OFL catalog' },
];

// Real Operation Endgame initiative: business funding (entity-less, constraint)
const FUNDING_SCRIPT = [
  { name: 'business funding' },
  { owningEntityId: INITIATIVE_OWNER_ENTITY_LESS },
  { purpose: 'Secure the capital needed to activate the capital-heavy lanes of the plan' },
  { classification: 'constraint' },
  { doneWhen: 'Funding closed and available in the bank account' },
];

// ── 1. Gate ladder ────────────────────────────────────────────────────────────

describe('Elicitation Engine — Initiative slot: gate ladder', () => {
  it('emits the name probe first on a blank slot', () => {
    const engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: buildBlankIdentityState({}).matrix,
      scope: [INITIATIVE_SLOT_ID],
    });
    const first = engine.openingStep();
    expect(first.done).toBe(false);
    expect(first.probe.slotId).toBe(INITIATIVE_SLOT_ID);
    expect(first.probe.fieldName).toBe('name');
    expect(first.probe.code).toBe('INITIATIVE_NAME_MISSING');
  });

  it('drives the full gate sequence name→owner→purpose→classification→doneWhen', () => {
    const state = buildMixedEntityState();
    const { probes } = runInitiativeScript(
      OFL_SCRIPT('ent-gs-corp'),
      { initialState: state }
    );
    expect(probes.map((p) => p.fieldName)).toEqual([
      'name',
      'owningEntityId',
      'purpose',
      'classification',
      'doneWhen',
    ]);
  });

  it('fires INITIATIVE_NAME_NOT_HOLDABLE when name is an imperative phrase', () => {
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [INITIATIVE_SLOT_ID],
    });
    engine.openingStep();
    // "complete the OFL release" is imperative verb + determiner — isHoldableNoun rejects it
    const result = engine.consumeAnswer({ name: 'complete the OFL release' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('name');
    expect(step.probe.code).toBe('INITIATIVE_NAME_NOT_HOLDABLE');
  });
});

// ── 2. Role-tag owner filter (the load-bearing new mechanic) ─────────────────

describe('Elicitation Engine — Initiative slot: role-tag owner filter', () => {
  it('initiativeOwnerOptions contains ONLY [initiative]-capable entities plus entity-less sentinel', () => {
    const state = buildMixedEntityState();
    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [INITIATIVE_SLOT_ID],
    });
    engine.openingStep();
    const result = engine.consumeAnswer({ name: 'OFL release spine' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();

    expect(step.probe.fieldName).toBe('owningEntityId');
    expect(step.probe.pickSet?.kind).toBe('initiativeOwnerOptions');

    const ids = step.probe.pickSet.items.map((i) => i.id);

    // [initiative]-capable entity IS present
    expect(ids).toContain('ent-gs-corp');

    // [system]-only entity is ABSENT — filter is load-bearing
    expect(ids).not.toContain('ent-f8-system');

    // entity-less sentinel is always appended
    expect(ids).toContain(INITIATIVE_OWNER_ENTITY_LESS);

    // exactly: one capable entity + sentinel = 2 items
    expect(ids).toHaveLength(2);
  });

  it('entity-less sentinel resolves the owner gate — fires once then does not re-fire', () => {
    const { probes } = runInitiativeScript(FUNDING_SCRIPT);
    // The owner probe fires once (the initial ask). After the sentinel is provided
    // the gate passes and must not fire again — only one occurrence in the sequence.
    const ownerProbes = probes.filter((p) => p.code === 'INITIATIVE_OWNER_UNRESOLVED');
    expect(ownerProbes).toHaveLength(1);
    // And the probe that follows owner is purpose — not another owner probe
    const ownerIdx = probes.findIndex((p) => p.code === 'INITIATIVE_OWNER_UNRESOLVED');
    expect(probes[ownerIdx + 1]?.fieldName).toBe('purpose');
  });
});

// ── 3. classificationOptions pickSet ─────────────────────────────────────────

describe('Elicitation Engine — Initiative slot: classificationOptions pickSet', () => {
  it('classificationOptions returns objective and constraint with human-readable labels', () => {
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [INITIATIVE_SLOT_ID],
    });
    engine.openingStep();
    for (const answer of [
      { name: 'the seed round' },
      { owningEntityId: INITIATIVE_OWNER_ENTITY_LESS },
      { purpose: 'Prove the product with 100 paying users before the runway ends' },
    ]) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('classification');
    expect(step.probe.pickSet?.kind).toBe('classificationOptions');
    const items = step.probe.pickSet.items;
    expect(items.map((i) => i.id)).toEqual(['objective', 'constraint']);
    expect(items.find((i) => i.id === 'objective')?.label).toMatch(/toward/i);
    expect(items.find((i) => i.id === 'constraint')?.label).toMatch(/around/i);
  });
});

// ── 4. Mandatory doneWhen (the lower-tier rule) ───────────────────────────────

describe('Elicitation Engine — Initiative slot: mandatory doneWhen', () => {
  it('fires INITIATIVE_DONEWHEN_MISSING when doneWhen is absent', () => {
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [INITIATIVE_SLOT_ID],
    });
    engine.openingStep();
    const answers = [
      { name: 'the seed round' },
      { owningEntityId: INITIATIVE_OWNER_ENTITY_LESS },
      { purpose: 'Prove the product with 100 paying users before the runway ends' },
      { classification: 'objective' },
      // doneWhen intentionally omitted — empty string is absent
      { doneWhen: '' },
    ];
    for (const answer of answers) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('doneWhen');
    expect(step.probe.code).toBe('INITIATIVE_DONEWHEN_MISSING');
  });

  it('fires INITIATIVE_DONEWHEN_NOT_VERIFIABLE for attestation breach', () => {
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'founder',
      matrixSnapshot: state.matrix,
      scope: [INITIATIVE_SLOT_ID],
    });
    engine.openingStep();
    const answers = [
      { name: 'the seed round' },
      { owningEntityId: INITIATIVE_OWNER_ENTITY_LESS },
      { purpose: 'Prove the product with 100 paying users before the runway ends' },
      { classification: 'objective' },
      { doneWhen: 'Marked complete by the team' },
    ];
    for (const answer of answers) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('doneWhen');
    expect(step.probe.code).toBe('INITIATIVE_DONEWHEN_NOT_VERIFIABLE');
  });
});

// ── 5. DECLARE_INITIATIVE dispatch and matrix landing ─────────────────────────

describe('Elicitation Engine — Initiative slot: DECLARE_INITIATIVE dispatch', () => {
  it('dispatches DECLARE_INITIATIVE with null owner for entity-less initiative', () => {
    const { dispatchedActions } = runInitiativeScript(FUNDING_SCRIPT);
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_INITIATIVE');
    expect(decl).toBeTruthy();
    // Sentinel must normalize to null — not the sentinel string
    expect(decl.payload.owningEntityId).toBeNull();
    expect(decl.payload.classification).toBe('constraint');
  });

  it('dispatches DECLARE_INITIATIVE with real owner id for owned initiative', () => {
    const state = buildMixedEntityState();
    const { dispatchedActions } = runInitiativeScript(
      OFL_SCRIPT('ent-gs-corp'),
      { initialState: state }
    );
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_INITIATIVE');
    expect(decl).toBeTruthy();
    expect(decl.payload.owningEntityId).toBe('ent-gs-corp');
    expect(decl.payload.classification).toBe('objective');
  });

  it('initiative lands in matrix.initiativesById with all required fields', () => {
    const { state } = runInitiativeScript(FUNDING_SCRIPT);
    const initiatives = Object.values(state.matrix.initiativesById);
    expect(initiatives.length).toBe(1);
    expect(initiatives[0]).toEqual(
      expect.objectContaining({
        name: 'business funding',
        owningEntityId: null,
        purpose: 'Secure the capital needed to activate the capital-heavy lanes of the plan',
        classification: 'constraint',
        doneWhen: 'Funding closed and available in the bank account',
        source: 'operator_declared',
      })
    );
  });

  it('populated initiativesById from entity-less (constraint) and owned (objective) coexist', () => {
    const state = buildMixedEntityState();
    // Run funding (entity-less, constraint) then OFL (owned, objective) in sequence
    let matState = state;
    for (const script of [FUNDING_SCRIPT, OFL_SCRIPT('ent-gs-corp')]) {
      let engine = createElicitationEngine({
        goalType: 'founder',
        matrixSnapshot: matState.matrix,
        scope: [INITIATIVE_SLOT_ID],
      });
      let step = engine.openingStep();
      for (const answer of script) {
        if (step.done) break;
        const r = engine.consumeAnswer(answer);
        engine = r.engine;
        for (const action of r.dispatches || []) {
          matState = computeDerivedState(matState, action);
        }
        engine = engine.refreshMatrix(matState.matrix);
        step = engine.nextStep();
      }
    }
    const all = Object.values(matState.matrix.initiativesById);
    expect(all.length).toBe(2);
    const constraint = all.find((i) => i.classification === 'constraint');
    const objective = all.find((i) => i.classification === 'objective');
    expect(constraint?.owningEntityId).toBeNull();
    expect(objective?.owningEntityId).toBe('ent-gs-corp');
  });
});
