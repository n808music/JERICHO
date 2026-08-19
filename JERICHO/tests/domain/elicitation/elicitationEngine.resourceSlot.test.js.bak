import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  createElicitationEngine,
  RESOURCE_PROFILE_SLOT_ID,
  BINDING_CONSTRAINT_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';
import {
  RESOURCE_PROFILE_SLOT,
  BINDING_CONSTRAINT_SLOT,
  isSection9Complete,
  unprofiledInitiatives,
} from '../../../src/domain/elicitation/resourceProfileSlot.ts';
import { RESOURCE_DIMENSIONS, NO_GAP_SENTINEL } from '../../../src/domain/elicitation/resourceDimensions.ts';
import { probeFor } from '../../../src/domain/elicitation/reprobes.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildBaseState() {
  return computeDerivedState(buildBlankIdentityState({}), {
    type: 'DECLARE_ENTITY',
    payload: {
      id: 'ent-1',
      name: 'Test Operator',
      roleTags: ['initiative'],
      purpose: 'Operator entity',
      formationState: 'functioning',
      statusEvidence: 'Operating now',
    },
  });
}

function addInitiative(state, id, name = id) {
  return computeDerivedState(state, {
    type: 'DECLARE_INITIATIVE',
    payload: {
      id,
      name,
      owningEntityId: null,
      purpose: `${name} — test initiative for profiling`,
      classification: 'objective',
      doneWhen: `${name} is complete and delivering results`,
    },
  });
}

// Direct-dispatch helper — bypasses elicitation engine, seeds matrix for coverage tests.
function addProfileDirect(state, initiativeId) {
  return computeDerivedState(state, {
    type: 'DECLARE_RESOURCE_PROFILE',
    payload: {
      id: `rp-${initiativeId}`,
      initiativeId,
      dimensions: {
        money: { need: 'approximately $100 for distribution', gap: null },
        time: { need: '10 hours per week through launch', gap: '5 hrs/wk available now vs 10 needed' },
        skills: { need: 'audio mastering for the deliverable', gap: null },
        tech: { need: 'mastering software and DAW license', gap: 'no license purchased yet' },
      },
    },
  });
}

function runProfileScript(script, opts = {}) {
  let state = opts.initialState || buildBlankIdentityState({});
  let engine = createElicitationEngine({
    goalType: opts.goalType || 'generic',
    matrixSnapshot: opts.matrixSnapshot || state.matrix,
    scope: [RESOURCE_PROFILE_SLOT_ID],
  });
  const probes = [];
  const dispatchedActions = [];
  let step = engine.openingStep();
  let pendingAnswers = [...script];
  let safety = 0;
  while (!step.done) {
    if (safety++ > 60) {throw new Error('Engine safety limit reached');}
    probes.push(step.probe);
    if (pendingAnswers.length === 0) {
      throw new Error(`Out of scripted answers — still asking "${step.probe.fieldName}" (${step.probe.code})`);
    }
    const answer = pendingAnswers.shift();
    const result = engine.consumeAnswer(answer);
    engine = result.engine;
    for (const action of result.dispatches || []) {
      dispatchedActions.push(action);
      state = computeDerivedState(state, action);
    }
    engine = engine.refreshMatrix(opts.matrixSnapshot || state.matrix);
    step = engine.nextStep();
  }
  return { state, probes, dispatchedActions };
}

function runBindingScript(script, opts = {}) {
  let state = opts.initialState || buildBlankIdentityState({});
  let engine = createElicitationEngine({
    goalType: opts.goalType || 'generic',
    matrixSnapshot: opts.matrixSnapshot || state.matrix,
    scope: [BINDING_CONSTRAINT_SLOT_ID],
  });
  const probes = [];
  const dispatchedActions = [];
  let step = engine.openingStep();
  let pendingAnswers = [...script];
  let safety = 0;
  while (!step.done) {
    if (safety++ > 30) {throw new Error('Engine safety limit reached');}
    probes.push(step.probe);
    if (pendingAnswers.length === 0) {break;}
    const answer = pendingAnswers.shift();
    const result = engine.consumeAnswer(answer);
    engine = result.engine;
    for (const action of result.dispatches || []) {
      dispatchedActions.push(action);
      state = computeDerivedState(state, action);
    }
    engine = engine.refreshMatrix(opts.matrixSnapshot || state.matrix);
    step = engine.nextStep();
  }
  return { state, probes, dispatchedActions };
}

// ── 1. Structural ─────────────────────────────────────────────────────────────

describe('Resource profile slot: structural', () => {
  it('gate ladder has exactly 18 gates (2 initiative + 4 dimensions × 4)', () => {
    expect(RESOURCE_PROFILE_SLOT.gate).toHaveLength(18);
  });

  it('gate codes follow initiative-then-dimension order', () => {
    const codes = RESOURCE_PROFILE_SLOT.gate.map((g) => g.code);
    expect(codes[0]).toBe('RESOURCE_INITIATIVE_MISSING');
    expect(codes[1]).toBe('RESOURCE_INITIATIVE_UNRESOLVED');
    expect(codes[2]).toBe('RESOURCE_MONEY_NEED_MISSING');
    expect(codes[3]).toBe('RESOURCE_MONEY_NEED_NOT_SUBSTANTIVE');
    expect(codes[4]).toBe('RESOURCE_MONEY_GAP_MISSING');
    expect(codes[5]).toBe('RESOURCE_MONEY_GAP_NOT_SUBSTANTIVE');
    // TIME follows MONEY
    expect(codes[6]).toBe('RESOURCE_TIME_NEED_MISSING');
    // SKILLS follows TIME
    expect(codes[10]).toBe('RESOURCE_SKILLS_NEED_MISSING');
    // TECH follows SKILLS
    expect(codes[14]).toBe('RESOURCE_TECH_NEED_MISSING');
  });

  it('RESOURCE_DIMENSIONS exports the four canonical dimensions', () => {
    expect(RESOURCE_DIMENSIONS).toEqual(['money', 'time', 'skills', 'tech']);
  });

  it('NO_GAP_SENTINEL is the string "none"', () => {
    expect(NO_GAP_SENTINEL).toBe('none');
  });
});

describe('Binding constraint slot: structural', () => {
  it('gate ladder has exactly 5 gates', () => {
    expect(BINDING_CONSTRAINT_SLOT.gate).toHaveLength(5);
  });

  it('first gate is BINDING_COVERAGE_INCOMPLETE', () => {
    expect(BINDING_CONSTRAINT_SLOT.gate[0].code).toBe('BINDING_COVERAGE_INCOMPLETE');
  });

  it('gate codes follow coverage-then-dimension-then-rationale order', () => {
    const codes = BINDING_CONSTRAINT_SLOT.gate.map((g) => g.code);
    expect(codes).toEqual([
      'BINDING_COVERAGE_INCOMPLETE',
      'BINDING_DIMENSION_MISSING',
      'BINDING_DIMENSION_INVALID',
      'BINDING_RATIONALE_MISSING',
      'BINDING_RATIONALE_NOT_SUBSTANTIVE',
    ]);
  });
});

// ── 2. Per-dimension ladder sequences correctly ───────────────────────────────

describe('Resource profile slot: per-dimension gate sequencing', () => {
  it('asks initiative first, then money need, gap, then time need, gap, then skills, tech', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-music', 'Music Release');

    const { probes } = runProfileScript(
      [
        { initiativeId: 'init-music' },
        { moneyNeed: 'approximately $100 for distribution and filing fees' },
        { moneyGap: 'have $65 cash, need $100, gap of $35' },
        { timeNeed: '10 focused hours per week through the October launch' },
        { timeGap: 'currently have 40 hrs/wk available, need only 10, no gap' },
        { skillsNeed: 'audio mastering skill for the final mix' },
        { skillsGap: NO_GAP_SENTINEL },
        { techNeed: 'mastering software and digital audio workstation' },
        { techGap: 'DAW licensed already, no gap' },
      ],
      { initialState: state }
    );

    const fieldNames = probes.map((p) => p.fieldName);
    expect(fieldNames).toEqual([
      'initiativeId',
      'moneyNeed',
      'moneyGap',
      'timeNeed',
      'timeGap',
      'skillsNeed',
      'skillsGap',
      'techNeed',
      'techGap',
    ]);
  });

  it('re-asks money need when jargon-shell answer given', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-1', 'Initiative One');

    const { probes } = runProfileScript(
      [
        { initiativeId: 'init-1' },
        { moneyNeed: 'Enables alignment and leverages solutions' }, // jargon — fails isAbstractJargon
        { moneyNeed: 'approximately $500 for design work and hosting setup' }, // substantive
        { moneyGap: 'have $65, need $500, gap of $435 to close before launch' },
        { timeNeed: '5 hours per week for six weeks of development work' },
        { timeGap: NO_GAP_SENTINEL },
        { skillsNeed: 'copywriting skill for the landing page content' },
        { skillsGap: NO_GAP_SENTINEL },
        { techNeed: 'email platform subscription for the list' },
        { techGap: NO_GAP_SENTINEL },
      ],
      { initialState: state }
    );

    const codes = probes.map((p) => p.code);
    expect(codes[1]).toBe('RESOURCE_MONEY_NEED_MISSING');
    expect(codes[2]).toBe('RESOURCE_MONEY_NEED_NOT_SUBSTANTIVE');
    expect(codes[3]).toBe('RESOURCE_MONEY_GAP_MISSING');
  });
});

// ── 3. Complete profile dispatches and lands ──────────────────────────────────

describe('Resource profile slot: dispatch and matrix landing', () => {
  it('dispatches DECLARE_RESOURCE_PROFILE after all nine fields captured', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-ofl', 'OFL Initiative');

    const { dispatchedActions } = runProfileScript(
      [
        { initiativeId: 'init-ofl' },
        { moneyNeed: 'approximately $700 for LLC filing across three states' },
        { moneyGap: 'have $65 cash today, need $700, gap of $635 to fund' },
        { timeNeed: '5 hours of research and filing time over two weeks' },
        { timeGap: NO_GAP_SENTINEL },
        { skillsNeed: 'basic legal entity formation knowledge' },
        { skillsGap: 'have templatable knowledge, can use filing service' },
        { techNeed: 'state filing portal access and email account' },
        { techGap: NO_GAP_SENTINEL },
      ],
      { initialState: state }
    );

    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_RESOURCE_PROFILE');
    expect(decl).toBeTruthy();
    expect(decl.payload.initiativeId).toBe('init-ofl');
    expect(decl.payload.id).toBe('rp-init-ofl');
  });

  it('profile lands in matrix.resourceProfilesById keyed by initiativeId', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-jericho', 'Jericho MVP');

    const { state: finalState } = runProfileScript(
      [
        { initiativeId: 'init-jericho' },
        { moneyNeed: 'approximately $0 for MVP since using existing MacBook and stack' },
        { moneyGap: NO_GAP_SENTINEL },
        { timeNeed: '20 hours per week of sustained development focus' },
        { timeGap: '40 hrs available, 20 allocated to this lane; 20 hrs remain for other lanes' },
        { skillsNeed: 'TypeScript and React development skill' },
        { skillsGap: NO_GAP_SENTINEL },
        { techNeed: 'MacBook, Node.js stack, and AI tooling subscription' },
        { techGap: NO_GAP_SENTINEL },
      ],
      { initialState: state }
    );

    expect(finalState.matrix.resourceProfilesById['init-jericho']).toBeDefined();
    const profile = finalState.matrix.resourceProfilesById['init-jericho'];
    expect(profile.initiativeId).toBe('init-jericho');
    expect(profile.dimensions).toBeDefined();
    expect(profile.dimensions.money).toBeDefined();
    expect(profile.dimensions.time).toBeDefined();
    expect(profile.dimensions.skills).toBeDefined();
    expect(profile.dimensions.tech).toBeDefined();
  });
});

// ── 4. NO_GAP_SENTINEL ────────────────────────────────────────────────────────

describe('Resource profile slot: NO_GAP_SENTINEL handling', () => {
  it('sentinel "none" passes the gap substance gate and stores as null', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-tech', 'Tech Initiative');

    const { state: finalState } = runProfileScript(
      [
        { initiativeId: 'init-tech' },
        { moneyNeed: 'no budget required for this initiative at current phase' },
        { moneyGap: NO_GAP_SENTINEL },
        { timeNeed: '2 hours per week for monitoring and maintenance' },
        { timeGap: NO_GAP_SENTINEL },
        { skillsNeed: 'system monitoring and log review skills' },
        { skillsGap: NO_GAP_SENTINEL },
        { techNeed: 'existing monitoring tools already in the stack' },
        { techGap: NO_GAP_SENTINEL },
      ],
      { initialState: state }
    );

    const profile = finalState.matrix.resourceProfilesById['init-tech'];
    expect(profile.dimensions.money.gap).toBeNull();
    expect(profile.dimensions.time.gap).toBeNull();
    expect(profile.dimensions.skills.gap).toBeNull();
    expect(profile.dimensions.tech.gap).toBeNull();
  });

  it('jargon gap (not sentinel) fails substance gate', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-vague', 'Vague Initiative');

    const { probes } = runProfileScript(
      [
        { initiativeId: 'init-vague' },
        { moneyNeed: 'approximately $200 for materials and state registration fees' },
        { moneyGap: 'Enables bandwidth optimization' }, // jargon — fails isAbstractJargon
        { moneyGap: 'need $200 more than the $65 currently available to proceed' }, // substantive fix
        { timeNeed: '8 hours per week of focused creative work on this lane' },
        { timeGap: NO_GAP_SENTINEL },
        { skillsNeed: 'video editing skill for the visual deliverable package' },
        { skillsGap: NO_GAP_SENTINEL },
        { techNeed: 'video editing software license for the project' },
        { techGap: NO_GAP_SENTINEL },
      ],
      { initialState: state }
    );

    const codes = probes.map((p) => p.code);
    expect(codes).toContain('RESOURCE_MONEY_GAP_NOT_SUBSTANTIVE');
  });

  it('jargon gap ("creates synergy") fails substance gate', () => {
    const captured = { moneyGap: 'creates synergy' };
    const gapGate = RESOURCE_PROFILE_SLOT.gate.find((g) => g.code === 'RESOURCE_MONEY_GAP_NOT_SUBSTANTIVE');
    expect(gapGate.detect(captured)).toBe(true);
  });
});

// ── 5. unprofiledInitiativeOptions pickSet shrinks ───────────────────────────

describe('Resource profile slot: unprofiledInitiativeOptions', () => {
  it('returns all initiative ids when none profiled', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-a', 'Initiative A');
    state = addInitiative(state, 'init-b', 'Initiative B');
    state = addInitiative(state, 'init-c', 'Initiative C');

    const remaining = unprofiledInitiatives(state.matrix);
    expect(remaining).toHaveLength(3);
    expect(remaining).toContain('init-a');
    expect(remaining).toContain('init-b');
    expect(remaining).toContain('init-c');
  });

  it('shrinks after one profile: 3 initiatives → 2 remaining after first profile', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-a', 'Initiative A');
    state = addInitiative(state, 'init-b', 'Initiative B');
    state = addInitiative(state, 'init-c', 'Initiative C');
    state = addProfileDirect(state, 'init-a');

    const remaining = unprofiledInitiatives(state.matrix);
    expect(remaining).toHaveLength(2);
    expect(remaining).not.toContain('init-a');
    expect(remaining).toContain('init-b');
    expect(remaining).toContain('init-c');
  });

  it('returns empty when all initiatives profiled', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-a', 'Initiative A');
    state = addProfileDirect(state, 'init-a');

    const remaining = unprofiledInitiatives(state.matrix);
    expect(remaining).toHaveLength(0);
  });
});

// ── 6. Coverage gate — the defining test ─────────────────────────────────────

describe('isSection9Complete: coverage invariant', () => {
  it('returns false when no initiatives exist (empty cannot be complete)', () => {
    const state = buildBlankIdentityState({});
    expect(isSection9Complete(state.matrix)).toBe(false);
  });

  it('returns false when 3 initiatives exist and 0 are profiled', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-a', 'A');
    state = addInitiative(state, 'init-b', 'B');
    state = addInitiative(state, 'init-c', 'C');
    expect(isSection9Complete(state.matrix)).toBe(false);
  });

  it('returns false when 3 initiatives exist and only 2 are profiled', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-a', 'A');
    state = addInitiative(state, 'init-b', 'B');
    state = addInitiative(state, 'init-c', 'C');
    state = addProfileDirect(state, 'init-a');
    state = addProfileDirect(state, 'init-b');

    expect(isSection9Complete(state.matrix)).toBe(false);
  });

  it('returns true when all 3 initiatives are profiled', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-a', 'A');
    state = addInitiative(state, 'init-b', 'B');
    state = addInitiative(state, 'init-c', 'C');
    state = addProfileDirect(state, 'init-a');
    state = addProfileDirect(state, 'init-b');
    state = addProfileDirect(state, 'init-c');

    expect(isSection9Complete(state.matrix)).toBe(true);
  });

  it('transitions from false to true upon profiling the last initiative', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-a', 'A');
    state = addInitiative(state, 'init-b', 'B');
    state = addProfileDirect(state, 'init-a');

    expect(isSection9Complete(state.matrix)).toBe(false);

    state = addProfileDirect(state, 'init-b');
    expect(isSection9Complete(state.matrix)).toBe(true);
  });
});

// ── 7. Binding constraint slot ────────────────────────────────────────────────

describe('Binding constraint slot: gate behavior', () => {
  it('BINDING_COVERAGE_INCOMPLETE fires when no profiles exist (coverage gate blocks binding)', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-a', 'A');
    // No profiles — coverage incomplete

    const coverageGate = BINDING_CONSTRAINT_SLOT.gate.find(
      (g) => g.code === 'BINDING_COVERAGE_INCOMPLETE'
    );
    expect(coverageGate.detect({}, { matrixSnapshot: state.matrix })).toBe(true);
  });

  it('BINDING_COVERAGE_INCOMPLETE does not fire when all initiatives profiled', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-a', 'A');
    state = addProfileDirect(state, 'init-a');

    const coverageGate = BINDING_CONSTRAINT_SLOT.gate.find(
      (g) => g.code === 'BINDING_COVERAGE_INCOMPLETE'
    );
    expect(coverageGate.detect({}, { matrixSnapshot: state.matrix })).toBe(false);
  });

  it('BINDING_DIMENSION_INVALID fires for an unrecognized dimension', () => {
    const dimensionGate = BINDING_CONSTRAINT_SLOT.gate.find(
      (g) => g.code === 'BINDING_DIMENSION_INVALID'
    );
    expect(dimensionGate.detect({ bindingDimension: 'people' })).toBe(true);
    expect(dimensionGate.detect({ bindingDimension: 'capital' })).toBe(true);
  });

  it('BINDING_DIMENSION_INVALID does not fire for valid dimensions', () => {
    const dimensionGate = BINDING_CONSTRAINT_SLOT.gate.find(
      (g) => g.code === 'BINDING_DIMENSION_INVALID'
    );
    for (const dim of RESOURCE_DIMENSIONS) {
      expect(dimensionGate.detect({ bindingDimension: dim })).toBe(false);
    }
  });

  it('BINDING_RATIONALE_NOT_SUBSTANTIVE fires for jargon rationale', () => {
    const rationaleGate = BINDING_CONSTRAINT_SLOT.gate.find(
      (g) => g.code === 'BINDING_RATIONALE_NOT_SUBSTANTIVE'
    );
    // Management-verb shells caught by isAbstractJargon
    expect(rationaleGate.detect({ rationale: 'Drives alignment and value creation' })).toBe(true);
    expect(rationaleGate.detect({ rationale: 'Enables synergy across the lanes' })).toBe(true);
  });
});

describe('Binding constraint slot: dispatch and matrix landing', () => {
  it('dispatches DECLARE_BINDING_CONSTRAINT with valid dimension and substantive rationale', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-a', 'A');
    state = addProfileDirect(state, 'init-a');

    const { dispatchedActions } = runBindingScript(
      [
        { bindingDimension: 'time' },
        {
          rationale:
            'TIME binds Phase 1 because every initiative requires 10+ hours per week and only 40 hours are available; stacking all lanes simultaneously exceeds capacity, forcing serialization in Section 10',
        },
      ],
      { initialState: state }
    );

    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_BINDING_CONSTRAINT');
    expect(decl).toBeTruthy();
    expect(decl.payload.bindingDimension).toBe('time');
  });

  it('binding constraint lands in matrix.bindingConstraint', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-a', 'A');
    state = addProfileDirect(state, 'init-a');

    const { state: finalState } = runBindingScript(
      [
        { bindingDimension: 'time' },
        {
          rationale:
            'TIME is the binding constraint: each P1 lane requires significant weekly hours and 40 hours cannot cover all lanes in parallel without serialization',
        },
      ],
      { initialState: state }
    );

    expect(finalState.matrix.bindingConstraint).toBeDefined();
    expect(finalState.matrix.bindingConstraint).not.toBeNull();
    expect(finalState.matrix.bindingConstraint.bindingDimension).toBe('time');
    expect(typeof finalState.matrix.bindingConstraint.rationale).toBe('string');
    expect(finalState.matrix.bindingConstraint.rationale.length).toBeGreaterThan(10);
  });

  it('engine asks for coverage first when coverage incomplete, blocks binding dimension question', () => {
    let state = buildBaseState();
    state = addInitiative(state, 'init-a', 'A');
    state = addInitiative(state, 'init-b', 'B');
    state = addProfileDirect(state, 'init-a'); // only 1 of 2 profiled

    const { probes } = runBindingScript(
      [], // no answers — just see first probe
      { initialState: state }
    );

    expect(probes.length).toBeGreaterThan(0);
    expect(probes[0].code).toBe('BINDING_COVERAGE_INCOMPLETE');
  });
});

// ── 8. Schema: resourceProfilesById and bindingConstraint exist ───────────────

describe('Schema: Section 9 schema shape', () => {
  it('blank state has resourceProfilesById as empty object', () => {
    const state = buildBlankIdentityState({});
    expect(state.matrix.resourceProfilesById).toBeDefined();
    expect(state.matrix.resourceProfilesById).toEqual({});
  });

  it('blank state has bindingConstraint as null', () => {
    const state = buildBlankIdentityState({});
    expect(state.matrix).toHaveProperty('bindingConstraint');
    expect(state.matrix.bindingConstraint).toBeNull();
  });

  it('old resources.available/needed/gap shape is gone', () => {
    const state = buildBlankIdentityState({});
    expect(state.matrix.resources).toBeUndefined();
  });
});

// ── 9. No reprobe missing ─────────────────────────────────────────────────────

describe('Reprobes: no missing reprobe for any gate code', () => {
  it('every resource profile gate code has an authored reprobe', () => {
    for (const gate of RESOURCE_PROFILE_SLOT.gate) {
      expect(() => probeFor(gate.code, 'generic')).not.toThrow();
    }
  });

  it('every binding constraint gate code has an authored reprobe', () => {
    for (const gate of BINDING_CONSTRAINT_SLOT.gate) {
      expect(() => probeFor(gate.code, 'generic')).not.toThrow();
    }
  });
});
