import { describe, it, expect, beforeEach } from 'vitest';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';

/**
 * Step 3, Item 3 — Artifact intake enforcement in the declareArtifact reducer.
 *
 * The slot gates in src/domain/elicitation/artifactSlot.ts guard the interview.
 * They do not guard the matrix: anything dispatching DECLARE_ARTIFACT directly —
 * the fixture loader, a restore, a future caller — bypasses them entirely. These
 * tests pin the reducer's own enforcement, which is the only layer that actually
 * decides what lands in state.matrix.artifactsById.
 *
 * Companion unit tests for the slot gates live in
 * src/domain/elicitation/artifactSlot.test.ts.
 */
describe('Artifact Intake Step 3: reducer enforcement', () => {
  let state;

  beforeEach(() => {
    state = buildBlankIdentityState({ nowISO: '2026-09-04T12:00:00Z' });
    state.appTime = { nowISO: '2026-09-04T12:00:00Z' };
  });

  // Minimal matrix an artifact needs before its own intake fields are reached:
  // a verification source, an owning + executing entity, an initiative, and a
  // project to produce it.
  const setupMatrix = () => {
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: { id: 'vs-test', domain: 'test', source: 'unit_test' },
    });
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-owner',
        name: 'Owner Entity',
        roleTags: ['owner'],
        purpose: 'test',
        formationState: 'formed',
        statusEvidence: 'test',
      },
    });
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-executor',
        name: 'Executor Entity',
        roleTags: ['executor'],
        purpose: 'test',
        formationState: 'formed',
        statusEvidence: 'test',
      },
    });
    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'initiative-test',
        name: 'Test Initiative',
        owningEntityId: 'entity-owner',
        purpose: 'test',
        doneWhen: 'test',
        function: 'ops',
        boundary_type: 'Terminating',
        completion_value: 'Initiative complete',
      },
    });
    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'project-test',
        name: 'Test Project',
        owningEntityId: 'entity-owner',
        description: 'test',
        verificationSourceId: 'vs-test',
        executing_entity: 'entity-executor',
        parent_initiative: 'initiative-test',
        boundary_type: 'Terminating',
        terminal_date: '2026-12-31',
      },
    });
  };

  // A payload that clears every gate ahead of the intake gates, so each test
  // below varies exactly one intake field and nothing else.
  const validArtifact = (overrides = {}) => ({
    id: 'artifact-test',
    name: 'Test Artifact',
    producingProjectId: 'project-test',
    completionEvidence: 'Published and downloadable at the public URL',
    verificationSourceId: 'vs-test',
    operatorAttestationMethod: 'I opened the public URL and downloaded the file',
    satisfaction_mode: 'AND',
    targetDate: '2099-12-31',
    ...overrides,
  });

  const declare = (overrides) => {
    state = computeDerivedState(state, {
      type: 'DECLARE_ARTIFACT',
      payload: validArtifact(overrides),
    });
    return state;
  };

  describe('setup sanity', () => {
    beforeEach(setupMatrix);

    it('the shared valid payload actually lands, so later rejections are attributable', () => {
      // If this regresses, every rejection test below becomes meaningless — they
      // would pass for the wrong reason.
      declare({});
      expect(state.lastPlanError).toBeFalsy();
      expect(state.matrix.artifactsById['artifact-test']).toBeDefined();
    });
  });

  describe('ARTIFACT_INTAKE_INCOMPLETE', () => {
    beforeEach(setupMatrix);

    it('rejects a missing satisfaction_mode — the artifact could never be called done', () => {
      declare({ satisfaction_mode: undefined });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_INTAKE_INCOMPLETE');
      expect(state.matrix.artifactsById['artifact-test']).toBeUndefined();
    });

    it('rejects a missing targetDate — the artifact would carry no deadline', () => {
      declare({ targetDate: undefined });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_INTAKE_INCOMPLETE');
      expect(state.matrix.artifactsById['artifact-test']).toBeUndefined();
    });

    it('rejects whitespace-only intake values rather than storing blanks', () => {
      declare({ satisfaction_mode: '   ' });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_INTAKE_INCOMPLETE');
      expect(state.matrix.artifactsById['artifact-test']).toBeUndefined();
    });

    it('reports which field was absent so the operator is not left guessing', () => {
      declare({ targetDate: undefined });
      expect(state.lastPlanError?.meta).toMatchObject({
        hasSatisfactionMode: true,
        hasTargetDate: false,
      });
    });
  });

  describe('ARTIFACT_SATISFACTION_MODE_NOT_YET_SUPPORTED', () => {
    beforeEach(setupMatrix);

    // satisfaction_mode is frozen to the single literal 'AND'. These tests pin
    // the constant, not an enum. The value of pinning something this trivial is
    // that the freeze is deliberate and documented: when multi-parent artifacts
    // arrive, these tests fail and force the thaw to be an explicit decision
    // rather than a silently widened compare.

    it("accepts 'AND', the only currently supported mode", () => {
      declare({ satisfaction_mode: 'AND' });
      expect(state.lastPlanError).toBeFalsy();
      expect(state.matrix.artifactsById['artifact-test'].satisfaction_mode).toBe('AND');
    });

    it("rejects 'OR' — deferred until artifacts have more than one parent deliverable", () => {
      // Not invalid in principle; unsupported today. As of fixture v3.0 every
      // artifact has parentDeliverableIds.length === 0, so OR would describe a
      // choice among parents that do not exist.
      declare({ satisfaction_mode: 'OR' });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_SATISFACTION_MODE_NOT_YET_SUPPORTED');
      expect(state.matrix.artifactsById['artifact-test']).toBeUndefined();
    });

    it('rejects any other mode', () => {
      declare({ satisfaction_mode: 'MAYBE' });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_SATISFACTION_MODE_NOT_YET_SUPPORTED');
      expect(state.matrix.artifactsById['artifact-test']).toBeUndefined();
    });

    it('is case-sensitive: "and" is not AND', () => {
      // Deliberate. A permissive compare here would let the fixture loader admit
      // casing variants that then read inconsistently downstream.
      declare({ satisfaction_mode: 'and' });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_SATISFACTION_MODE_NOT_YET_SUPPORTED');
    });

    it('explains the deferral in the error, so the reader is not left guessing', () => {
      declare({ satisfaction_mode: 'OR' });
      expect(state.lastPlanError?.reason).toMatch(/parentDeliverableIds\.length > 1/);
    });

    it('runs only after presence, so a blank mode reports INCOMPLETE not UNSUPPORTED', () => {
      declare({ satisfaction_mode: '' });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_INTAKE_INCOMPLETE');
    });

    // Guards the freeze itself: if someone later flips the literal (say to 'OR')
    // instead of widening the compare deliberately, this fails.
    it("the frozen literal is 'AND' and nothing else round-trips", () => {
      ['OR', 'ALL', 'ANY_ONE', 'and', 'And', ''].forEach((mode) => {
        state = buildBlankIdentityState({ nowISO: '2026-09-04T12:00:00Z' });
        state.appTime = { nowISO: '2026-09-04T12:00:00Z' };
        setupMatrix();
        declare({ satisfaction_mode: mode });
        expect(state.matrix.artifactsById['artifact-test']).toBeUndefined();
      });
    });
  });

  describe('ARTIFACT_TARGET_DATE_INVALID', () => {
    beforeEach(setupMatrix);

    it('rejects a past date — an elapsed deadline cannot be scheduled against', () => {
      declare({ targetDate: '2020-01-01' });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_TARGET_DATE_INVALID');
      expect(state.matrix.artifactsById['artifact-test']).toBeUndefined();
    });

    it('rejects an unparseable date rather than storing NaN downstream', () => {
      declare({ targetDate: 'whenever' });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_TARGET_DATE_INVALID');
      expect(state.matrix.artifactsById['artifact-test']).toBeUndefined();
    });

    it('accepts a future date', () => {
      declare({ targetDate: '2099-12-31' });
      expect(state.lastPlanError).toBeFalsy();
      expect(state.matrix.artifactsById['artifact-test'].targetDate).toBe('2099-12-31');
    });
  });

  describe('ARTIFACT_BUFFER_BINDING_MISMATCH', () => {
    beforeEach(setupMatrix);

    it('accepts an artifact with neither buffer field — buffers are optional', () => {
      declare({});
      expect(state.lastPlanError).toBeFalsy();
      expect(state.matrix.artifactsById['artifact-test'].buffer_anchor).toBeNull();
      expect(state.matrix.artifactsById['artifact-test'].buffer_binding).toBeNull();
    });

    it('accepts an artifact with both buffer fields', () => {
      declare({ buffer_anchor: 'deliv-mastering', buffer_binding: 'hard' });
      expect(state.lastPlanError).toBeFalsy();
      expect(state.matrix.artifactsById['artifact-test']).toMatchObject({
        buffer_anchor: 'deliv-mastering',
        buffer_binding: 'hard',
      });
    });

    it('rejects an anchor without a binding — a buffer with no rule to apply', () => {
      declare({ buffer_anchor: 'deliv-mastering' });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_BUFFER_BINDING_MISMATCH');
      expect(state.matrix.artifactsById['artifact-test']).toBeUndefined();
    });

    it('rejects a binding without an anchor — a rule with nothing to anchor to', () => {
      declare({ buffer_binding: 'hard' });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_BUFFER_BINDING_MISMATCH');
      expect(state.matrix.artifactsById['artifact-test']).toBeUndefined();
    });

    it('treats a whitespace-only binding as absent, so " " cannot fake a pairing', () => {
      declare({ buffer_anchor: 'deliv-mastering', buffer_binding: '   ' });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_BUFFER_BINDING_MISMATCH');
    });
  });

  describe('intake ladder ordering (first failure wins)', () => {
    beforeEach(setupMatrix);

    it('reports ARTIFACT_INVALID before intake gates when base fields are absent', () => {
      // Intake questions are only meaningful for an artifact that is otherwise
      // well-formed; reporting a missing satisfaction_mode on a nameless
      // artifact would send the operator to the wrong repair.
      declare({ name: undefined, satisfaction_mode: undefined });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_INVALID');
    });

    it('reports INTAKE_INCOMPLETE before SATISFACTION_MODE_INVALID', () => {
      declare({ satisfaction_mode: undefined, targetDate: undefined });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_INTAKE_INCOMPLETE');
    });

    it('reports SATISFACTION_MODE_NOT_YET_SUPPORTED before TARGET_DATE_INVALID', () => {
      declare({ satisfaction_mode: 'MAYBE', targetDate: '2020-01-01' });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_SATISFACTION_MODE_NOT_YET_SUPPORTED');
    });

    it('reports TARGET_DATE_INVALID before BUFFER_BINDING_MISMATCH', () => {
      declare({ targetDate: '2020-01-01', buffer_anchor: 'deliv-mastering' });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_TARGET_DATE_INVALID');
    });
  });

  describe('storage', () => {
    beforeEach(setupMatrix);

    it('persists all four intake fields onto the stored artifact', () => {
      // The gates are worthless if the values they protect are dropped at write.
      declare({
        satisfaction_mode: 'AND',
        targetDate: '2099-06-30',
        buffer_anchor: 'deliv-mastering',
        buffer_binding: 'advisory',
      });
      expect(state.lastPlanError).toBeFalsy();
      expect(state.matrix.artifactsById['artifact-test']).toMatchObject({
        satisfaction_mode: 'AND',
        targetDate: '2099-06-30',
        buffer_anchor: 'deliv-mastering',
        buffer_binding: 'advisory',
      });
    });
  });
});
