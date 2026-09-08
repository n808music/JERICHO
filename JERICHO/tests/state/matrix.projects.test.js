import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { resolveBlockPlainLanguage } from '../../src/domain/product/resolveBlockPlainLanguage.js';

/**
 * MATRIX SECTION 5 — PROJECTS (finite outcomes)
 *
 * Section 5 is the only section named in BOTH laws:
 *   Law 1 — produces-nouns (this is what the project ships)
 *   Law 2 — attestation pair {target, verificationSource}
 *
 * The attestation contract has nowhere to live until Section 5 exists, so
 * Section 5's declaration shape must enforce both laws at the matrix level:
 *
 *   DECLARE_PROJECT requires:
 *     - id
 *     - name
 *     - owningEntityId        (cross-section integrity: must be in entitiesById)
 *     - description         (Law 2 — the target the operator can verify)
 *     - verificationSourceId  (cross-section integrity: must be in
 *                              verificationSourcesById)
 *
 * Without the {target, source} pair the project is rejected — there is no
 * downstream block, milestone, or artifact that can later add it on the
 * operator's behalf, because Jericho is never the verifier.
 */

function seededState() {
  let state = buildBlankIdentityState({});
  // Seed the cross-section dependencies the project will reference.
  state = computeDerivedState(state, {
    type: 'DECLARE_VERIFICATION_SOURCE',
    payload: { id: 'src-spotify', domain: 'Music streams', source: 'Spotify for Artists' },
  });
  state = computeDerivedState(state, {
    type: 'DECLARE_VERIFICATION_SOURCE',
    payload: { id: 'src-distrokid', domain: 'Music revenue', source: 'DistroKid dashboard' },
  });
  state = computeDerivedState(state, {
    type: 'DECLARE_NODE',
    payload: {
      id: 'node-gs-corp',
      name: 'Global State Corp.',
      roleTags: ['Business'],
    },
  });
  return state;
}

const PROJECT_RR = {
  id: 'project-romance-riot',
  name: 'Romance Riot',
  owningEntityId: 'node-gs-corp',
  status: 'active',
  desiredOutcome: '10,000 first-week streams of Romance Riot',
  targetDate: '2026-10-17',
  description: '≥10,000 streams during first week post-release',
  verificationSourceId: 'src-spotify',
  evidenceProduced: 'Spotify for Artists weekly streams export with date filter',
};

describe('MATRIX SECTION 5 — DECLARE / UPDATE / REMOVE PROJECT', () => {
  it('DECLARE_PROJECT adds a project when all required fields are present and cross-references resolve', () => {
    const initial = seededState();
    const next = computeDerivedState(initial, { type: 'DECLARE_PROJECT', payload: PROJECT_RR });
    expect(next.matrix.projectsById[PROJECT_RR.id]).toEqual(
      expect.objectContaining({
        id: PROJECT_RR.id,
        name: PROJECT_RR.name,
        owningEntityId: PROJECT_RR.owningEntityId,
        description: PROJECT_RR.description,
        verificationSourceId: PROJECT_RR.verificationSourceId,
      })
    );
    expect(typeof next.matrix.projectsById[PROJECT_RR.id]?.declaredAtISO).toBe('string');
  });

  it('DECLARE_PROJECT rejects payload missing description (Law 2 enforced at matrix level)', () => {
    const initial = seededState();
    const broken = computeDerivedState(initial, {
      type: 'DECLARE_PROJECT',
      payload: { ...PROJECT_RR, description: '' },
    });
    expect(broken.matrix.projectsById[PROJECT_RR.id]).toBeUndefined();
    expect(broken.lastPlanError?.code).toBe('PROJECT_INVALID');
  });

  it('DECLARE_PROJECT rejects payload missing verificationSourceId (Law 2 enforced at matrix level)', () => {
    const initial = seededState();
    const broken = computeDerivedState(initial, {
      type: 'DECLARE_PROJECT',
      payload: { ...PROJECT_RR, verificationSourceId: '' },
    });
    expect(broken.matrix.projectsById[PROJECT_RR.id]).toBeUndefined();
    expect(broken.lastPlanError?.code).toBe('PROJECT_INVALID');
  });

  it('DECLARE_PROJECT rejects payload whose owningEntityId is not in entitiesById', () => {
    const initial = seededState();
    const broken = computeDerivedState(initial, {
      type: 'DECLARE_PROJECT',
      payload: { ...PROJECT_RR, owningEntityId: 'node-ghost' },
    });
    expect(broken.matrix.projectsById[PROJECT_RR.id]).toBeUndefined();
    expect(broken.lastPlanError?.code).toBe('PROJECT_OWNING_ENTITY_UNKNOWN');
  });

  it('DECLARE_PROJECT rejects payload whose verificationSourceId is not in verificationSourcesById', () => {
    const initial = seededState();
    const broken = computeDerivedState(initial, {
      type: 'DECLARE_PROJECT',
      payload: { ...PROJECT_RR, verificationSourceId: 'src-ghost' },
    });
    expect(broken.matrix.projectsById[PROJECT_RR.id]).toBeUndefined();
    expect(broken.lastPlanError?.code).toBe('PROJECT_VERIFICATION_SOURCE_UNKNOWN');
  });

  it('UPDATE_PROJECT patches an existing project but cannot dangle owningEntityId', () => {
    const initial = seededState();
    const declared = computeDerivedState(initial, { type: 'DECLARE_PROJECT', payload: PROJECT_RR });
    const renamed = computeDerivedState(declared, {
      type: 'UPDATE_PROJECT',
      payload: { id: PROJECT_RR.id, name: 'Romance Riot (Deluxe Edition)' },
    });
    expect(renamed.matrix.projectsById[PROJECT_RR.id]?.name).toBe('Romance Riot (Deluxe Edition)');

    const danglingOwner = computeDerivedState(declared, {
      type: 'UPDATE_PROJECT',
      payload: { id: PROJECT_RR.id, owningEntityId: 'node-ghost' },
    });
    // Original owner preserved; error recorded
    expect(danglingOwner.matrix.projectsById[PROJECT_RR.id]?.owningEntityId).toBe(PROJECT_RR.owningEntityId);
    expect(danglingOwner.lastPlanError?.code).toBe('PROJECT_OWNING_ENTITY_UNKNOWN');
  });

  it('REMOVE_PROJECT deletes a project by id', () => {
    const initial = seededState();
    const declared = computeDerivedState(initial, { type: 'DECLARE_PROJECT', payload: PROJECT_RR });
    const removed = computeDerivedState(declared, {
      type: 'REMOVE_PROJECT',
      payload: { id: PROJECT_RR.id },
    });
    expect(removed.matrix.projectsById[PROJECT_RR.id]).toBeUndefined();
  });
});

describe('MATRIX SECTION 5 — gate code UNDECLARED_PROJECT', () => {
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

  it('does NOT emit UNDECLARED_PROJECT when block has no projectId (soft mode)', () => {
    const result = resolveBlockPlainLanguage(block(), {
      hierarchy: HIERARCHY,
      matrix: {
        projectsById: { 'project-romance-riot': { id: 'project-romance-riot' } },
      },
    });
    expect(result.quality?.failureCodes || []).not.toContain('UNDECLARED_PROJECT');
  });

  it('does NOT emit UNDECLARED_PROJECT when the registry is empty (day 1)', () => {
    const result = resolveBlockPlainLanguage(block({ projectId: 'project-anything' }), {
      hierarchy: HIERARCHY,
      matrix: { projectsById: {} },
    });
    expect(result.quality?.failureCodes || []).not.toContain('UNDECLARED_PROJECT');
  });

  it('does NOT emit UNDECLARED_PROJECT when block.projectId IS in the registry', () => {
    const result = resolveBlockPlainLanguage(block({ projectId: 'project-romance-riot' }), {
      hierarchy: HIERARCHY,
      matrix: {
        projectsById: { 'project-romance-riot': { id: 'project-romance-riot' } },
      },
    });
    expect(result.quality?.failureCodes || []).not.toContain('UNDECLARED_PROJECT');
  });

  it('EMITS UNDECLARED_PROJECT when block.projectId is not in a non-empty registry', () => {
    const result = resolveBlockPlainLanguage(block({ projectId: 'project-ghost' }), {
      hierarchy: HIERARCHY,
      matrix: {
        projectsById: { 'project-romance-riot': { id: 'project-romance-riot' } },
      },
    });
    expect(result.quality?.failureCodes || []).toContain('UNDECLARED_PROJECT');
  });
});
