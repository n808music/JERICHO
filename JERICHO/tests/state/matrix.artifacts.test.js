import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { resolveBlockPlainLanguage } from '../../src/domain/product/resolveBlockPlainLanguage.js';

/**
 * MATRIX SECTION 6 — ARTIFACTS (physical outputs)
 *
 * For every artifact:
 *   - id
 *   - name                  (artifact name)
 *   - producingProjectId    (must be in projectsById)
 *   - completionEvidence    (the operator-verifiable thing that exists)
 *   - verificationSourceId  (must be in verificationSourcesById)
 *   - operatorAttestationMethod
 *   - consumingProjectIds?  (optional array — which projects consume it)
 *
 * Cross-section integrity: producingProjectId AND verificationSourceId must
 * resolve at declaration time. completionEvidence + operatorAttestationMethod
 * are required (no artifact without a verifiable completion footprint).
 *
 * The molecular gate emits UNDECLARED_ARTIFACT when block.producesArtifactId
 * is set but does not resolve in artifactsById. Soft mode for empty registry.
 */

function seededState() {
  let state = buildBlankIdentityState({});
  state = computeDerivedState(state, {
    type: 'DECLARE_VERIFICATION_SOURCE',
    payload: { id: 'src-archive', domain: 'Project archive', source: 'Project archive workspace' },
  });
  state = computeDerivedState(state, {
    type: 'DECLARE_NODE',
    payload: { id: 'node-gs-corp', name: 'Global State Corp.', roleTags: ['Business'] },
  });
  state = computeDerivedState(state, {
    type: 'DECLARE_INITIATIVE',
    payload: {
      id: 'init-music-release',
      name: 'Music Release Initiative',
      owningEntityId: 'node-gs-corp',
      purpose: 'Release Romance Riot album',
      doneWhen: 'Album released on all platforms',,
        function: 'ops',
        boundary_type: 'Terminating',
        completion_value: 'Initiative complete'
    },
  });
  state = computeDerivedState(state, {
    type: 'DECLARE_PROJECT',
    payload: {
      id: 'project-romance-riot',
      name: 'Romance Riot',
      owningEntityId: 'node-gs-corp',
      description: '≥10,000 first-week streams',
      verificationSourceId: 'src-archive',
      owningInitiativeId: 'init-music-release',
    },
  });
  // Step 3: Add test deliverables for artifact parentDeliverableIds wiring
  state = computeDerivedState(state, {
    type: 'DECLARE_DELIVERABLE',
    payload: {
      id: 'deliv-rr-recording',
      name: 'Romance Riot recording sessions',
      owningProjectId: 'project-romance-riot',
      owningInitiativeId: 'init-music-release',
      successCriteria: 'All 12 tracks recorded and mixed',
      targetDate: '2026-08-15',
    },
  });
  state = computeDerivedState(state, {
    type: 'DECLARE_DELIVERABLE',
    payload: {
      id: 'deliv-rr-mastering',
      name: 'Romance Riot mastering',
      owningProjectId: 'project-romance-riot',
      owningInitiativeId: 'init-music-release',
      successCriteria: 'Master WAV files finalized',
      targetDate: '2026-08-25',
    },
  });
  return state;
}

const ARTIFACT_MASTER_WAV = {
  id: 'artifact-rr-master-wav',
  name: 'Romance Riot mastered WAV',
  producingProjectId: 'project-romance-riot',
  parentDeliverableIds: ['deliv-rr-recording', 'deliv-rr-mastering'],  // Step 3: wired to test deliverables
  completionEvidence: 'Master WAV exported to project archive with timestamp',
  verificationSourceId: 'src-archive',
  operatorAttestationMethod: 'Operator opens project archive, confirms WAV exists with mastering timestamp, attests',
};

describe('MATRIX SECTION 6 — DECLARE / UPDATE / REMOVE ARTIFACT', () => {
  it('DECLARE_ARTIFACT adds an artifact when all required fields resolve', () => {
    const initial = seededState();
    const next = computeDerivedState(initial, {
      type: 'DECLARE_ARTIFACT',
      payload: ARTIFACT_MASTER_WAV,
    });
    expect(next.matrix.artifactsById[ARTIFACT_MASTER_WAV.id]).toEqual(
      expect.objectContaining({
        id: ARTIFACT_MASTER_WAV.id,
        name: ARTIFACT_MASTER_WAV.name,
        parentDeliverableIds: ['deliv-rr-recording', 'deliv-rr-mastering'],  // Step 3: wired to test deliverables
        producingProjectId: null,   // Step 1: hollowed out; will be derived in E15 amendment
        completionEvidence: ARTIFACT_MASTER_WAV.completionEvidence,
        verificationSourceId: ARTIFACT_MASTER_WAV.verificationSourceId,
        operatorAttestationMethod: ARTIFACT_MASTER_WAV.operatorAttestationMethod,
      })
    );
    expect(typeof next.matrix.artifactsById[ARTIFACT_MASTER_WAV.id]?.declaredAtISO).toBe('string');
  });

  it('DECLARE_ARTIFACT rejects payload missing completionEvidence', () => {
    const initial = seededState();
    const broken = computeDerivedState(initial, {
      type: 'DECLARE_ARTIFACT',
      payload: { ...ARTIFACT_MASTER_WAV, completionEvidence: '' },
    });
    expect(broken.matrix.artifactsById[ARTIFACT_MASTER_WAV.id]).toBeUndefined();
    expect(broken.lastPlanError?.code).toBe('ARTIFACT_INVALID');
  });

  it('DECLARE_ARTIFACT rejects payload missing operatorAttestationMethod', () => {
    const initial = seededState();
    const broken = computeDerivedState(initial, {
      type: 'DECLARE_ARTIFACT',
      payload: { ...ARTIFACT_MASTER_WAV, operatorAttestationMethod: '' },
    });
    expect(broken.matrix.artifactsById[ARTIFACT_MASTER_WAV.id]).toBeUndefined();
    expect(broken.lastPlanError?.code).toBe('ARTIFACT_INVALID');
  });

  it('DECLARE_ARTIFACT rejects payload whose producingProjectId is not in projectsById', () => {
    const initial = seededState();
    const broken = computeDerivedState(initial, {
      type: 'DECLARE_ARTIFACT',
      payload: { ...ARTIFACT_MASTER_WAV, producingProjectId: 'project-ghost' },
    });
    expect(broken.matrix.artifactsById[ARTIFACT_MASTER_WAV.id]).toBeUndefined();
    expect(broken.lastPlanError?.code).toBe('ARTIFACT_PRODUCING_PROJECT_UNKNOWN');
  });

  it('DECLARE_ARTIFACT rejects payload whose verificationSourceId is not in verificationSourcesById', () => {
    const initial = seededState();
    const broken = computeDerivedState(initial, {
      type: 'DECLARE_ARTIFACT',
      payload: { ...ARTIFACT_MASTER_WAV, verificationSourceId: 'src-ghost' },
    });
    expect(broken.matrix.artifactsById[ARTIFACT_MASTER_WAV.id]).toBeUndefined();
    expect(broken.lastPlanError?.code).toBe('ARTIFACT_VERIFICATION_SOURCE_UNKNOWN');
  });

  it('UPDATE_ARTIFACT patches an existing artifact (cross-section invariants enforced)', () => {
    const initial = seededState();
    const declared = computeDerivedState(initial, {
      type: 'DECLARE_ARTIFACT',
      payload: ARTIFACT_MASTER_WAV,
    });
    const updated = computeDerivedState(declared, {
      type: 'UPDATE_ARTIFACT',
      payload: { id: ARTIFACT_MASTER_WAV.id, name: 'Romance Riot mastered WAV (final)' },
    });
    expect(updated.matrix.artifactsById[ARTIFACT_MASTER_WAV.id]?.name).toBe(
      'Romance Riot mastered WAV (final)'
    );
    // Step 1: producingProjectId is now null (hollowed out). Verify rejection of invalid update doesn't change it.
    const danglingProducer = computeDerivedState(declared, {
      type: 'UPDATE_ARTIFACT',
      payload: { id: ARTIFACT_MASTER_WAV.id, producingProjectId: 'project-ghost' },
    });
    expect(danglingProducer.matrix.artifactsById[ARTIFACT_MASTER_WAV.id]?.producingProjectId).toBe(null);
    expect(danglingProducer.lastPlanError?.code).toBe('ARTIFACT_PRODUCING_PROJECT_UNKNOWN');
  });

  it('REMOVE_ARTIFACT deletes an artifact by id', () => {
    const initial = seededState();
    const declared = computeDerivedState(initial, {
      type: 'DECLARE_ARTIFACT',
      payload: ARTIFACT_MASTER_WAV,
    });
    const removed = computeDerivedState(declared, {
      type: 'REMOVE_ARTIFACT',
      payload: { id: ARTIFACT_MASTER_WAV.id },
    });
    expect(removed.matrix.artifactsById[ARTIFACT_MASTER_WAV.id]).toBeUndefined();
  });
});

describe('MATRIX SECTION 6 — gate code UNDECLARED_ARTIFACT', () => {
  const HIERARCHY = { block: 'b', phase: 'P1', lane: 'Album release engine' };
  function block(extra = {}) {
    return {
      id: 'b-1',
      title: 'Some block',
      laneId: 'lane-creative',
      laneLabel: 'Operation Endgame album release engine',
      ...extra,
    };
  }

  it('does NOT emit UNDECLARED_ARTIFACT when block has no producesArtifactId (soft mode)', () => {
    const result = resolveBlockPlainLanguage(block(), {
      hierarchy: HIERARCHY,
      matrix: {
        artifactsById: { 'artifact-rr-master-wav': { id: 'artifact-rr-master-wav' } },
      },
    });
    expect(result.quality?.failureCodes || []).not.toContain('UNDECLARED_ARTIFACT');
  });

  it('does NOT emit UNDECLARED_ARTIFACT when the registry is empty (day 1)', () => {
    const result = resolveBlockPlainLanguage(
      block({ producesArtifactId: 'artifact-anything' }),
      {
        hierarchy: HIERARCHY,
        matrix: { artifactsById: {} },
      }
    );
    expect(result.quality?.failureCodes || []).not.toContain('UNDECLARED_ARTIFACT');
  });

  it('does NOT emit UNDECLARED_ARTIFACT when block.producesArtifactId IS in the registry', () => {
    const result = resolveBlockPlainLanguage(
      block({ producesArtifactId: 'artifact-rr-master-wav' }),
      {
        hierarchy: HIERARCHY,
        matrix: {
          artifactsById: { 'artifact-rr-master-wav': { id: 'artifact-rr-master-wav' } },
        },
      }
    );
    expect(result.quality?.failureCodes || []).not.toContain('UNDECLARED_ARTIFACT');
  });

  it('EMITS UNDECLARED_ARTIFACT when block.producesArtifactId is not in a non-empty registry', () => {
    const result = resolveBlockPlainLanguage(
      block({ producesArtifactId: 'artifact-ghost' }),
      {
        hierarchy: HIERARCHY,
        matrix: {
          artifactsById: { 'artifact-rr-master-wav': { id: 'artifact-rr-master-wav' } },
        },
      }
    );
    expect(result.quality?.failureCodes || []).toContain('UNDECLARED_ARTIFACT');
  });
});
