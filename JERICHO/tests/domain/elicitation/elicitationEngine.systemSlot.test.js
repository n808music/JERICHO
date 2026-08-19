import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  createElicitationEngine,
  SYSTEM_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';
import { SYSTEM_OWNER_ENTITY_LESS, SYSTEM_SLOT } from '../../../src/domain/elicitation/systemSlot.ts';

function runSystemScript(script, opts = {}) {
  let state = opts.initialState || buildBlankIdentityState({});
  let engine = createElicitationEngine({
    goalType: opts.goalType || 'musician',
    matrixSnapshot: state.matrix,
    scope: [SYSTEM_SLOT_ID],
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

// Two entities: one [system]-capable, one NOT — for role-tag filter proof.
function buildMixedEntityState() {
  let state = buildBlankIdentityState({});
  // [system]-capable — should appear in systemOwnerOptions
  state = computeDerivedState(state, {
    type: 'DECLARE_ENTITY',
    payload: {
      id: 'ent-gs-corp',
      name: 'Global State Corp.',
      roleTags: ['business', 'system'],
      purpose: 'The holding entity for all Global State enterprises and IP',
      formationState: 'functioning',
      statusEvidence: 'Operating across music, film, and broadcast verticals',
    },
  });
  // NOT [system]-capable — must be ABSENT from systemOwnerOptions
  state = computeDerivedState(state, {
    type: 'DECLARE_ENTITY',
    payload: {
      id: 'ent-ofl-initiative',
      name: 'OFL Initiative',
      roleTags: ['initiative'],     // no 'system' tag
      purpose: '7 tapes building to the terminal album',
      formationState: 'in-development',
      statusEvidence: 'Tapes 1-2 released, 5 remaining',
    },
  });
  return state;
}

// Real Operation Endgame system: Release Pipeline (running, owned)
const RELEASE_PIPELINE_SCRIPT = (owningEntityId) => [
  { name: 'release pipeline system' },
  { owningEntityId },
  { cycle: 'Create → Produce → Art and Metadata → Distribute → Promote → Analyze → repeat' },
  { activationState: 'running' },
];

// Real Operation Endgame system: Audience Capture (missing, entity-less, with activationCondition).
// activationCondition is optional — volunteered alongside activationState (same answer, merged
// by the zero-model engine), so the gate can validate it before the slot completes.
const AUDIENCE_CAPTURE_SCRIPT = [
  { name: 'audience capture and activation system' },
  { owningEntityId: SYSTEM_OWNER_ENTITY_LESS },
  { cycle: 'Capture email or SMS → Nurture → Activate on each release → Measure → repeat' },
  { activationState: 'missing', activationCondition: 'Email list infrastructure and a first release to activate against' },
];

// ── 1. Structural: no done-when in the system slot ───────────────────────────

describe('Elicitation Engine — System slot: no done-when (structural absence)', () => {
  it('SYSTEM_SLOT gate ladder contains no doneWhen gate', () => {
    const doneWhenGates = SYSTEM_SLOT.gate.filter((g) => g.fieldName === 'doneWhen');
    expect(doneWhenGates).toHaveLength(0);
  });

  it('a complete system with no doneWhen passes all gates and dispatches', () => {
    const state = buildMixedEntityState();
    const { dispatchedActions, probes } = runSystemScript(
      RELEASE_PIPELINE_SCRIPT('ent-gs-corp'),
      { initialState: state }
    );
    // No probe ever asked for doneWhen
    expect(probes.map((p) => p.fieldName)).not.toContain('doneWhen');
    // DECLARE_SYSTEM was dispatched — engine completed
    expect(dispatchedActions.find((a) => a.type === 'DECLARE_SYSTEM')).toBeTruthy();
  });

  it('CYCLE_MISSING (not DONEWHEN_MISSING) is what fails an incomplete system', () => {
    let state = buildMixedEntityState();
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [SYSTEM_SLOT_ID],
    });
    engine.openingStep();
    const answers = [
      { name: 'release pipeline system' },
      { owningEntityId: 'ent-gs-corp' },
      { cycle: '' },  // blank cycle — should fail
    ];
    for (const answer of answers) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('cycle');
    expect(step.probe.code).toBe('SYSTEM_CYCLE_MISSING');
  });
});

// ── 2. Gate ladder ────────────────────────────────────────────────────────────

describe('Elicitation Engine — System slot: gate ladder', () => {
  it('emits the name probe first on a blank slot', () => {
    const engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: buildBlankIdentityState({}).matrix,
      scope: [SYSTEM_SLOT_ID],
    });
    const first = engine.openingStep();
    expect(first.probe.fieldName).toBe('name');
    expect(first.probe.code).toBe('SYSTEM_NAME_MISSING');
  });

  it('drives the full gate sequence name→owner→cycle→activationState', () => {
    const state = buildMixedEntityState();
    const { probes } = runSystemScript(
      RELEASE_PIPELINE_SCRIPT('ent-gs-corp'),
      { initialState: state }
    );
    expect(probes.map((p) => p.fieldName)).toEqual([
      'name',
      'owningEntityId',
      'cycle',
      'activationState',
    ]);
  });

  it('fires SYSTEM_NAME_NOT_HOLDABLE for an imperative phrase', () => {
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [SYSTEM_SLOT_ID],
    });
    engine.openingStep();
    // "build the release pipeline" is imperative verb + determiner — isHoldableNoun rejects it
    const result = engine.consumeAnswer({ name: 'build the release pipeline' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('name');
    expect(step.probe.code).toBe('SYSTEM_NAME_NOT_HOLDABLE');
  });
});

// ── 3. Owner options (unfiltered, 2026-07-10) ────────────────────────────────

describe('Elicitation Engine — System slot: owner options (unfiltered)', () => {
  it('systemOwnerOptions offers EVERY declared entity plus the cross-cutting sentinel', () => {
    const state = buildMixedEntityState();
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [SYSTEM_SLOT_ID],
    });
    engine.openingStep();
    const result = engine.consumeAnswer({ name: 'release pipeline system' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();

    expect(step.probe.fieldName).toBe('owningEntityId');
    expect(step.probe.pickSet?.kind).toBe('systemOwnerOptions');

    const ids = step.probe.pickSet.items.map((i) => i.id);

    // [system]-tagged entity IS present
    expect(ids).toContain('ent-gs-corp');

    // Untagged entity ALSO present — §2 under-tag must not hide an entity
    // from ownership; declareSystem backfills the [system] tag instead.
    expect(ids).toContain('ent-ofl-initiative');

    // cross-cutting sentinel always appended
    expect(ids).toContain(SYSTEM_OWNER_ENTITY_LESS);

    // exactly: both entities + sentinel = 3 items
    expect(ids).toHaveLength(3);
  });

  it('declaring a system under an untagged owner backfills its [system] role tag', () => {
    let state = buildMixedEntityState();
    expect(state.matrix.entitiesById['ent-ofl-initiative'].roleTags).not.toContain('system');
    state = computeDerivedState(state, {
      type: 'DECLARE_SYSTEM',
      payload: {
        id: 'system-backfill-proof',
        name: 'Backfill proof system',
        owningEntityId: 'ent-ofl-initiative',
        cycle: 'weekly',
        activationState: 'planned',
      },
    });
    expect(state.matrix.systemsById['system-backfill-proof']).toBeTruthy();
    expect(state.matrix.entitiesById['ent-ofl-initiative'].roleTags).toContain('system');
    expect(state.matrix.entitiesById['ent-ofl-initiative'].roleTags).toContain('initiative');
  });
});

// ── 4. activationStateOptions pickSet ────────────────────────────────────────

describe('Elicitation Engine — System slot: activationStateOptions pickSet', () => {
  it('returns running, missing, planned with human-readable labels', () => {
    const state = buildMixedEntityState();
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [SYSTEM_SLOT_ID],
    });
    engine.openingStep();
    for (const answer of [
      { name: 'release pipeline system' },
      { owningEntityId: 'ent-gs-corp' },
      { cycle: 'Create → Produce → Distribute → repeat' },
    ]) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('activationState');
    expect(step.probe.pickSet?.kind).toBe('activationStateOptions');
    const items = step.probe.pickSet.items;
    expect(items.map((i) => i.id)).toEqual(['running', 'missing', 'planned']);
    expect(items.find((i) => i.id === 'running')?.label).toBeTruthy();
    expect(items.find((i) => i.id === 'missing')?.label).toBeTruthy();
    expect(items.find((i) => i.id === 'planned')?.label).toBeTruthy();
  });
});

// ── 5. Optional activationCondition ──────────────────────────────────────────

describe('Elicitation Engine — System slot: optional activationCondition', () => {
  it('passes with no activationCondition (optional field absent)', () => {
    const state = buildMixedEntityState();
    const { dispatchedActions } = runSystemScript(
      RELEASE_PIPELINE_SCRIPT('ent-gs-corp'),
      { initialState: state }
    );
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_SYSTEM');
    expect(decl).toBeTruthy();
    expect(decl.payload.activationCondition).toBeUndefined();
  });

  it('passes with a substantive activationCondition and includes it in payload', () => {
    const { dispatchedActions } = runSystemScript(AUDIENCE_CAPTURE_SCRIPT);
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_SYSTEM');
    expect(decl).toBeTruthy();
    expect(decl.payload.activationCondition).toBe(
      'Email list infrastructure and a first release to activate against'
    );
  });

  it('fires SYSTEM_ACTIVATION_CONDITION_NOT_SUBSTANTIVE for a jargon shell', () => {
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [SYSTEM_SLOT_ID],
    });
    engine.openingStep();
    // Volunteer jargon activationCondition in the same answer as activationState so the
    // gate sees it before the slot completes (optional field, no presence gate).
    const answers = [
      { name: 'release pipeline system' },
      { owningEntityId: SYSTEM_OWNER_ENTITY_LESS },
      { cycle: 'Create → Produce → Distribute → repeat' },
      { activationState: 'planned', activationCondition: 'leverage synergies' },
    ];
    for (const answer of answers) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('activationCondition');
    expect(step.probe.code).toBe('SYSTEM_ACTIVATION_CONDITION_NOT_SUBSTANTIVE');
  });
});

// ── 6. DECLARE_SYSTEM dispatch and matrix landing ─────────────────────────────

describe('Elicitation Engine — System slot: DECLARE_SYSTEM dispatch', () => {
  it('entity-less sentinel normalizes to owningEntityId: null', () => {
    const { dispatchedActions } = runSystemScript(AUDIENCE_CAPTURE_SCRIPT);
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_SYSTEM');
    expect(decl).toBeTruthy();
    expect(decl.payload.owningEntityId).toBeNull();
  });

  it('named owner is preserved as-is in the payload', () => {
    const state = buildMixedEntityState();
    const { dispatchedActions } = runSystemScript(
      RELEASE_PIPELINE_SCRIPT('ent-gs-corp'),
      { initialState: state }
    );
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_SYSTEM');
    expect(decl.payload.owningEntityId).toBe('ent-gs-corp');
  });

  it('system lands in matrix.systemsById with all required fields', () => {
    const { state } = runSystemScript(AUDIENCE_CAPTURE_SCRIPT);
    const systems = Object.values(state.matrix.systemsById);
    expect(systems.length).toBe(1);
    expect(systems[0]).toEqual(
      expect.objectContaining({
        name: 'audience capture and activation system',
        owningEntityId: null,
        cycle: 'Capture email or SMS → Nurture → Activate on each release → Measure → repeat',
        activationState: 'missing',
        activationCondition: 'Email list infrastructure and a first release to activate against',
        source: 'operator_declared',
      })
    );
    // No doneWhen in the stored record — confirmed absent
    expect(systems[0].doneWhen).toBeUndefined();
  });
});
