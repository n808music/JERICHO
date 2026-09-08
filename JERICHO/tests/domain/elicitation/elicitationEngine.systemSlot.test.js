import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  createElicitationEngine,
  SYSTEM_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';
import { SYSTEM_OWNER_ENTITY_LESS, SYSTEM_SLOT } from '../../../src/domain/elicitation/systemSlot.ts';

// Step 4 (2026-09-05) replaced the System intake ladder. The slot now gates
// name → owner → mechanism → feeds_converges_into. `cycle` became `mechanism`,
// and `activationState` / `activationCondition` were removed outright — a
// System carries no run-state field, so there is nothing to probe for.
//
// The operator answers `owner` with an entity id from systemOwnerOptions or
// with the 'Cross-cutting' sentinel; the reducer resolves that to
// owningEntityId (null for cross-cutting) at declaration time.

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

// Two entities: one [system]-capable, one NOT — for role-tag backfill proof.
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
  // NOT [system]-capable — must STILL appear in systemOwnerOptions
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

// Real Operation Endgame system: Release Pipeline (owned by an entity)
const RELEASE_PIPELINE_SCRIPT = (owner) => [
  { name: 'release pipeline system' },
  { owner },
  { mechanism: 'Create → Produce → Art and Metadata → Distribute → Promote → Analyze → repeat' },
  { feeds_converges_into: 'OFL 7 release schedule, distribution pipeline, audience funnel' },
];

// Real Operation Endgame system: Audience Capture (cross-cutting, entity-less)
const AUDIENCE_CAPTURE_SCRIPT = [
  { name: 'audience capture and activation system' },
  { owner: SYSTEM_OWNER_ENTITY_LESS },
  { mechanism: 'Capture email or SMS → Nurture → Activate on each release → Measure → repeat' },
  { feeds_converges_into: 'OFL 7 release schedule, tour announcement cycle' },
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

  it('MECHANISM_MISSING (not DONEWHEN_MISSING) is what fails an incomplete system', () => {
    let state = buildMixedEntityState();
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [SYSTEM_SLOT_ID],
    });
    engine.openingStep();
    const answers = [
      { name: 'release pipeline system' },
      { owner: 'ent-gs-corp' },
      { mechanism: '' },  // blank mechanism — should fail
    ];
    for (const answer of answers) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('mechanism');
    expect(step.probe.code).toBe('SYSTEM_MECHANISM_MISSING');
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

  it('drives the full gate sequence name→owner→mechanism→feeds_converges_into', () => {
    const state = buildMixedEntityState();
    const { probes } = runSystemScript(
      RELEASE_PIPELINE_SCRIPT('ent-gs-corp'),
      { initialState: state }
    );
    expect(probes.map((p) => p.fieldName)).toEqual([
      'name',
      'owner',
      'mechanism',
      'feeds_converges_into',
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

  it('fires SYSTEM_FEEDS_MISSING when the downstream feed is left blank', () => {
    let state = buildMixedEntityState();
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [SYSTEM_SLOT_ID],
    });
    engine.openingStep();
    const answers = [
      { name: 'release pipeline system' },
      { owner: 'ent-gs-corp' },
      { mechanism: 'Create → Produce → Distribute → repeat' },
      { feeds_converges_into: '' },  // blank feed — should fail
    ];
    for (const answer of answers) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('feeds_converges_into');
    expect(step.probe.code).toBe('SYSTEM_FEEDS_MISSING');
  });

  it('fires SYSTEM_MECHANISM_NOT_SUBSTANTIVE for a jargon shell', () => {
    let state = buildMixedEntityState();
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [SYSTEM_SLOT_ID],
    });
    engine.openingStep();
    const answers = [
      { name: 'release pipeline system' },
      { owner: 'ent-gs-corp' },
      { mechanism: 'leverage synergies' },  // jargon, not a loop
    ];
    for (const answer of answers) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('mechanism');
    expect(step.probe.code).toBe('SYSTEM_MECHANISM_NOT_SUBSTANTIVE');
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

    expect(step.probe.fieldName).toBe('owner');
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

  // The sentinel's VALUE is load-bearing, not just its presence: declareSystem
  // branches on `owner !== 'Cross-cutting'` by exact match, and the v3.0
  // fixture carries that literal verbatim. A drifted sentinel would route
  // every cross-cutting system into SYSTEM_OWNER_UNRESOLVED instead.
  it('the cross-cutting sentinel is the exact literal the reducer matches', () => {
    expect(SYSTEM_OWNER_ENTITY_LESS).toBe('Cross-cutting');
  });

  it('declaring a system under an untagged owner backfills its [system] role tag', () => {
    let state = buildMixedEntityState();
    expect(state.matrix.entitiesById['ent-ofl-initiative'].roleTags).not.toContain('system');
    state = computeDerivedState(state, {
      type: 'DECLARE_SYSTEM',
      payload: {
        id: 'system-backfill-proof',
        name: 'Backfill proof system',
        owner: 'ent-ofl-initiative',
        mechanism: 'Draft → review → publish → repeat',
        feeds_converges_into: 'OFL 7 release schedule',
      },
    });
    expect(state.matrix.systemsById['system-backfill-proof']).toBeTruthy();
    expect(state.matrix.entitiesById['ent-ofl-initiative'].roleTags).toContain('system');
    expect(state.matrix.entitiesById['ent-ofl-initiative'].roleTags).toContain('initiative');
  });
});

// ── 4. DECLARE_SYSTEM dispatch and matrix landing ─────────────────────────────

describe('Elicitation Engine — System slot: DECLARE_SYSTEM dispatch', () => {
  it('entity-less sentinel normalizes to owningEntityId: null', () => {
    const { state, dispatchedActions } = runSystemScript(AUDIENCE_CAPTURE_SCRIPT);
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_SYSTEM');
    expect(decl).toBeTruthy();
    // The payload carries the sentinel; the reducer resolves it to null.
    expect(decl.payload.owner).toBe(SYSTEM_OWNER_ENTITY_LESS);
    expect(state.matrix.systemsById[decl.payload.id].owningEntityId).toBeNull();
  });

  it('named owner resolves to that entity id on the stored record', () => {
    const initial = buildMixedEntityState();
    const { state, dispatchedActions } = runSystemScript(
      RELEASE_PIPELINE_SCRIPT('ent-gs-corp'),
      { initialState: initial }
    );
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_SYSTEM');
    expect(decl.payload.owner).toBe('ent-gs-corp');
    expect(state.matrix.systemsById[decl.payload.id].owningEntityId).toBe('ent-gs-corp');
  });

  it('system lands in matrix.systemsById with all required fields', () => {
    const { state } = runSystemScript(AUDIENCE_CAPTURE_SCRIPT);
    const systems = Object.values(state.matrix.systemsById);
    expect(systems.length).toBe(1);
    expect(systems[0]).toEqual(
      expect.objectContaining({
        name: 'audience capture and activation system',
        owningEntityId: null,
        mechanism: 'Capture email or SMS → Nurture → Activate on each release → Measure → repeat',
        feeds_converges_into: 'OFL 7 release schedule; tour announcement cycle',
        source: 'operator_declared',
      })
    );
    // No doneWhen in the stored record — confirmed absent
    expect(systems[0].doneWhen).toBeUndefined();
    // No run-state fields survive the Step 4 ladder
    expect(systems[0].cycle).toBeUndefined();
    expect(systems[0].activationState).toBeUndefined();
    expect(systems[0].activationCondition).toBeUndefined();
  });
});
