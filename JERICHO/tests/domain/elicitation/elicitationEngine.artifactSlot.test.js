import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../../src/state/identityStore.js';
import { computeDerivedState } from '../../../src/state/identityCompute.js';
import {
  createElicitationEngine,
  ARTIFACT_SLOT_ID,
} from '../../../src/domain/elicitation/elicitationEngine.js';
import { ARTIFACT_SLOT } from '../../../src/domain/elicitation/artifactSlot.ts';

function runArtifactScript(script, opts = {}) {
  let state = opts.initialState || buildBlankIdentityState({});
  let engine = createElicitationEngine({
    goalType: opts.goalType || 'musician',
    matrixSnapshot: state.matrix,
    scope: [ARTIFACT_SLOT_ID],
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
    engine = engine.refreshMatrix(state.matrix);
    step = engine.nextStep();
  }
  return { state, probes, dispatchedActions };
}

// declareProject requires a declared entity (owningEntityId must exist in entitiesById).
// Seed order: entity → VS → project.
function buildSeededState() {
  let state = buildBlankIdentityState({});
  state = computeDerivedState(state, {
    type: 'DECLARE_ENTITY',
    payload: {
      id: 'ent-ofl',
      name: 'OFL Music Group',
      roleTags: ['business'],
      purpose: 'The entity behind all OFL releases and catalog',
      formationState: 'functioning',
      statusEvidence: 'Operating across music and film verticals with 2 tapes released',
    },
  });
  state = computeDerivedState(state, {
    type: 'DECLARE_VERIFICATION_SOURCE',
    payload: { id: 'vs-distrokid', source: 'DistroKid', domain: 'Music distribution' },
  });
  state = computeDerivedState(state, {
    type: 'DECLARE_PROJECT',
    payload: {
      id: 'proj-ofl-3',
      name: 'Romance Riot',
      owningEntityId: 'ent-ofl',
      description: '10,000 streams in the first 30 days',
      verificationSourceId: 'vs-distrokid',
    },
  });
  return state;
}

// completionEvidence and operatorAttestationMethod use comma form to trigger
// hasAuthoredSubstance's concrete-rescue path (/,\s*\S+\s+\S+/).
const HAPPY_PATH_SCRIPT = [
  { name: 'Romance Riot tape' },
  { producingProjectId: 'proj-ofl-3' },
  { completionEvidence: 'mastered WAV listed on DistroKid and in the Spotify catalog' },
  { verificationSourceId: 'vs-distrokid' },
  {
    operatorAttestationMethod:
      'open Spotify for Artists, confirm the release is live in catalog',
  },
];

// ── 1. Structural ─────────────────────────────────────────────────────────────

describe('Elicitation Engine — Artifact slot: structural', () => {
  it('gate ladder has exactly 8 gates', () => {
    expect(ARTIFACT_SLOT.gate).toHaveLength(8);
  });

  it('no gate has fieldName doneWhen or activationState', () => {
    const fieldNames = ARTIFACT_SLOT.gate.map((g) => g.fieldName);
    expect(fieldNames).not.toContain('doneWhen');
    expect(fieldNames).not.toContain('activationState');
  });

  it('gate fieldNames follow reducer-derived order', () => {
    const fieldNames = ARTIFACT_SLOT.gate.map((g) => g.fieldName);
    expect(fieldNames).toEqual([
      'name',
      'name',
      'producingProjectId',
      'completionEvidence',
      'completionEvidence',
      'verificationSourceId',
      'operatorAttestationMethod',
      'operatorAttestationMethod',
    ]);
  });
});

// ── 2. Gate sequence ──────────────────────────────────────────────────────────

describe('Elicitation Engine — Artifact slot: gate sequence', () => {
  it('emits name probe first on a blank slot', () => {
    const engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: buildBlankIdentityState({}).matrix,
      scope: [ARTIFACT_SLOT_ID],
    });
    const first = engine.openingStep();
    expect(first.probe.fieldName).toBe('name');
    expect(first.probe.code).toBe('ARTIFACT_NAME_MISSING');
  });

  it('drives the full gate sequence: name → producingProjectId → completionEvidence → verificationSourceId → operatorAttestationMethod', () => {
    const state = buildSeededState();
    const { probes } = runArtifactScript(HAPPY_PATH_SCRIPT, { initialState: state });
    expect(probes.map((p) => p.fieldName)).toEqual([
      'name',
      'producingProjectId',
      'completionEvidence',
      'verificationSourceId',
      'operatorAttestationMethod',
    ]);
  });
});

// ── 3. Name holdable check ────────────────────────────────────────────────────

describe('Elicitation Engine — Artifact slot: name holdable check', () => {
  it('fires ARTIFACT_NAME_NOT_HOLDABLE for an imperative phrase', () => {
    let state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [ARTIFACT_SLOT_ID],
    });
    engine.openingStep();
    const result = engine.consumeAnswer({ name: 'complete the tape' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('name');
    expect(step.probe.code).toBe('ARTIFACT_NAME_NOT_HOLDABLE');
  });

  it('accepts a holdable noun name and advances to producingProjectId', () => {
    const state = buildSeededState();
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [ARTIFACT_SLOT_ID],
    });
    engine.openingStep();
    const result = engine.consumeAnswer({ name: 'Romance Riot tape' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('producingProjectId');
  });
});

// ── 4. producingProjectOptions pickSet ───────────────────────────────────────

describe('Elicitation Engine — Artifact slot: producingProjectOptions pickSet', () => {
  it('contains only declared projects and no VS records', () => {
    const state = buildSeededState();
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [ARTIFACT_SLOT_ID],
    });
    engine.openingStep();
    const result = engine.consumeAnswer({ name: 'Romance Riot tape' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();

    expect(step.probe.fieldName).toBe('producingProjectId');
    expect(step.probe.pickSet?.kind).toBe('producingProjectOptions');
    const ids = step.probe.pickSet.items.map((i) => i.id);
    expect(ids).toContain('proj-ofl-3');
    expect(ids).not.toContain('vs-distrokid');
  });

  it('surfaces dependencyGap: true when projectsById is empty', () => {
    const state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [ARTIFACT_SLOT_ID],
    });
    engine.openingStep();
    const result = engine.consumeAnswer({ name: 'Romance Riot tape' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();

    expect(step.probe.fieldName).toBe('producingProjectId');
    expect(step.probe.dependencyGap).toBe(true);
    expect(step.probe.pickSet.items).toHaveLength(0);
  });
});

// ── 5. declaredSources pickSet ────────────────────────────────────────────────

describe('Elicitation Engine — Artifact slot: declaredSources pickSet', () => {
  it('contains only declared verification sources and no project records', () => {
    const state = buildSeededState();
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [ARTIFACT_SLOT_ID],
    });
    engine.openingStep();
    for (const answer of [
      { name: 'Romance Riot tape' },
      { producingProjectId: 'proj-ofl-3' },
      { completionEvidence: 'mastered WAV listed on DistroKid and in the Spotify catalog' },
    ]) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();

    expect(step.probe.fieldName).toBe('verificationSourceId');
    expect(step.probe.pickSet?.kind).toBe('declaredSources');
    const ids = step.probe.pickSet.items.map((i) => i.id);
    expect(ids).toContain('vs-distrokid');
    expect(ids).not.toContain('proj-ofl-3');
  });

  it('surfaces dependencyGap: true when verificationSourcesById is empty', () => {
    // Build a snapshot that has a project but no verification sources.
    // Use direct matrix construction to avoid the circular dependency
    // (declareProject requires a VS to exist, so we bypass the reducer here).
    const blankMatrix = buildBlankIdentityState({}).matrix;
    const customMatrix = {
      ...blankMatrix,
      projectsById: { 'proj-ofl-3': { id: 'proj-ofl-3', name: 'Romance Riot' } },
      verificationSourcesById: {},
    };
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: customMatrix,
      scope: [ARTIFACT_SLOT_ID],
    });
    engine.openingStep();
    for (const answer of [
      { name: 'Romance Riot tape' },
      { producingProjectId: 'proj-ofl-3' },
      { completionEvidence: 'mastered WAV listed on DistroKid and in the Spotify catalog' },
    ]) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(customMatrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('verificationSourceId');
    expect(step.probe.dependencyGap).toBe(true);
  });
});

// ── 6. Both pickSets gappable simultaneously ──────────────────────────────────

describe('Elicitation Engine — Artifact slot: both pickSets gappable', () => {
  it('first-failure-wins: producingProjectId gaps first when both registries are empty', () => {
    const state = buildBlankIdentityState({});
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [ARTIFACT_SLOT_ID],
    });
    engine.openingStep();
    const result = engine.consumeAnswer({ name: 'Romance Riot tape' });
    engine = result.engine.refreshMatrix(state.matrix);
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('producingProjectId');
    expect(step.probe.dependencyGap).toBe(true);
  });
});

// ── 7. Substance gates ────────────────────────────────────────────────────────

describe('Elicitation Engine — Artifact slot: substance gates', () => {
  it('fires ARTIFACT_COMPLETION_EVIDENCE_NOT_VERIFIABLE for a jargon shell', () => {
    const state = buildSeededState();
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [ARTIFACT_SLOT_ID],
    });
    engine.openingStep();
    for (const answer of [
      { name: 'Romance Riot tape' },
      { producingProjectId: 'proj-ofl-3' },
      { completionEvidence: 'leverage deliverable synergies' },
    ]) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('completionEvidence');
    expect(step.probe.code).toBe('ARTIFACT_COMPLETION_EVIDENCE_NOT_VERIFIABLE');
  });

  it('fires ARTIFACT_ATTESTATION_METHOD_NOT_SUBSTANTIVE for a jargon shell', () => {
    const state = buildSeededState();
    let engine = createElicitationEngine({
      goalType: 'musician',
      matrixSnapshot: state.matrix,
      scope: [ARTIFACT_SLOT_ID],
    });
    engine.openingStep();
    for (const answer of [
      { name: 'Romance Riot tape' },
      { producingProjectId: 'proj-ofl-3' },
      { completionEvidence: 'mastered WAV listed on DistroKid and in the Spotify catalog' },
      { verificationSourceId: 'vs-distrokid' },
      { operatorAttestationMethod: 'leverage synergies' },
    ]) {
      const r = engine.consumeAnswer(answer);
      engine = r.engine.refreshMatrix(state.matrix);
    }
    const step = engine.nextStep();
    expect(step.probe.fieldName).toBe('operatorAttestationMethod');
    expect(step.probe.code).toBe('ARTIFACT_ATTESTATION_METHOD_NOT_SUBSTANTIVE');
  });
});

// ── 8. Optional fields ────────────────────────────────────────────────────────

describe('Elicitation Engine — Artifact slot: optional fields', () => {
  it('dispatches without consumingProjectIds or notes (reducer defaults apply)', () => {
    const state = buildSeededState();
    const { dispatchedActions } = runArtifactScript(HAPPY_PATH_SCRIPT, { initialState: state });
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_ARTIFACT');
    expect(decl).toBeTruthy();
    expect(decl.payload.consumingProjectIds).toEqual([]);
    expect(decl.payload.notes).toBeNull();
  });
});

// ── 9. DECLARE_ARTIFACT dispatch ──────────────────────────────────────────────

describe('Elicitation Engine — Artifact slot: DECLARE_ARTIFACT dispatch', () => {
  it('dispatches with type DECLARE_ARTIFACT and all 6 required payload fields', () => {
    const state = buildSeededState();
    const { dispatchedActions } = runArtifactScript(HAPPY_PATH_SCRIPT, { initialState: state });
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_ARTIFACT');
    expect(decl).toBeTruthy();
    expect(decl.payload.name).toBe('Romance Riot tape');
    expect(decl.payload.producingProjectId).toBe('proj-ofl-3');
    expect(decl.payload.completionEvidence).toBe(
      'mastered WAV listed on DistroKid and in the Spotify catalog'
    );
    expect(decl.payload.verificationSourceId).toBe('vs-distrokid');
    expect(decl.payload.operatorAttestationMethod).toBe(
      'open Spotify for Artists, confirm the release is live in catalog'
    );
  });

  it('auto-generates an id from the name as a slug', () => {
    const state = buildSeededState();
    const { dispatchedActions } = runArtifactScript(HAPPY_PATH_SCRIPT, { initialState: state });
    const decl = dispatchedActions.find((a) => a.type === 'DECLARE_ARTIFACT');
    expect(decl.payload.id).toBe('romance-riot-tape');
  });
});

// ── 10. Matrix landing ────────────────────────────────────────────────────────

describe('Elicitation Engine — Artifact slot: matrix landing', () => {
  it('artifact lands in matrix.artifactsById with all required fields', () => {
    const state = buildSeededState();
    const { state: finalState } = runArtifactScript(HAPPY_PATH_SCRIPT, { initialState: state });
    const artifacts = Object.values(finalState.matrix.artifactsById);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toEqual(
      expect.objectContaining({
        id: 'romance-riot-tape',
        name: 'Romance Riot tape',
        producingProjectId: 'proj-ofl-3',
        verificationSourceId: 'vs-distrokid',
        completionEvidence: 'mastered WAV listed on DistroKid and in the Spotify catalog',
        operatorAttestationMethod:
          'open Spotify for Artists, confirm the release is live in catalog',
        consumingProjectIds: [],
      })
    );
    // declareArtifact stores notes as null when absent
    expect(artifacts[0].notes).toBeNull();
  });
});
