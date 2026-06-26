import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { resolveBlockPlainLanguage } from '../../src/domain/product/resolveBlockPlainLanguage.js';

/**
 * MATRIX SECTION 1A — VERIFICATION SOURCES
 *
 * Truth Representation contract: every external system the operator can
 * verify against must be declared once in `state.matrix.verificationSourcesById`.
 * Targets elsewhere in the matrix and on generated blocks must reference one of
 * these sources by id (or by exact source label). The molecular gate emits
 * UNDECLARED_VERIFICATION_SOURCE when a block names a source that is not in
 * the registry — but only when the registry has at least one entry (so the
 * gate does not punish blocks on day 1, before the operator has declared
 * any sources).
 *
 * Sections 2-10 (Nodes, Initiatives, Systems, Projects, Artifacts,
 * Dependencies, Convergence, Resources, Bootstrap) will follow this same
 * shape — a {ById} bag on state.matrix, populated by intake actions,
 * enforced by gate codes.
 */

describe('MATRIX — state.matrix shape (skeleton, all 10 sections)', () => {
  it('initializes state.matrix with empty bags for every section', () => {
    const state = buildBlankIdentityState({});
    expect(state.matrix).toBeDefined();
    expect(state.matrix.verificationSourcesById).toEqual({});
    expect(state.matrix.entitiesById).toEqual({});
    expect(state.matrix.initiativesById).toEqual({});
    expect(state.matrix.systemsById).toEqual({});
    expect(state.matrix.projectsById).toEqual({});
    expect(state.matrix.artifactsById).toEqual({});
    expect(state.matrix.dependenciesById).toEqual({});
    expect(state.matrix.convergenceEdgesById).toEqual({});
    expect(state.matrix.resources).toEqual({ available: {}, needed: {}, gap: {} });
    expect(state.matrix.bootstrap).toEqual({ candidates: [], selectedNodeId: null });
  });
});

describe('MATRIX SECTION 1A — DECLARE/UPDATE/REMOVE actions', () => {
  it('DECLARE_VERIFICATION_SOURCE adds a source by id', () => {
    const initial = buildBlankIdentityState({});
    const next = computeDerivedState(initial, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: {
        id: 'src-spotify-for-artists',
        domain: 'Music streams',
        source: 'Spotify for Artists',
        notes: 'Operator confirms stream counts directly on the artist dashboard',
      },
    });
    expect(next.matrix.verificationSourcesById['src-spotify-for-artists']).toEqual(
      expect.objectContaining({
        id: 'src-spotify-for-artists',
        domain: 'Music streams',
        source: 'Spotify for Artists',
        notes: 'Operator confirms stream counts directly on the artist dashboard',
      })
    );
  });

  it('DECLARE_VERIFICATION_SOURCE stamps declaredAtISO automatically', () => {
    const initial = buildBlankIdentityState({});
    const next = computeDerivedState(initial, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: { id: 'src-distrokid', domain: 'Music revenue', source: 'DistroKid dashboard' },
    });
    const stamp = next.matrix.verificationSourcesById['src-distrokid']?.declaredAtISO;
    expect(typeof stamp).toBe('string');
    expect(stamp.length).toBeGreaterThan(0);
  });

  it('DECLARE_VERIFICATION_SOURCE rejects payload without id, domain, and source', () => {
    const initial = buildBlankIdentityState({});
    const next = computeDerivedState(initial, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: { id: 'src-broken' /* missing domain + source */ },
    });
    expect(next.matrix.verificationSourcesById['src-broken']).toBeUndefined();
    expect(next.lastPlanError?.code).toBe('VERIFICATION_SOURCE_INVALID');
  });

  it('UPDATE_VERIFICATION_SOURCE patches an existing source', () => {
    const initial = buildBlankIdentityState({});
    const declared = computeDerivedState(initial, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: { id: 'src-ck', domain: 'Email subscribers', source: 'ConvertKit' },
    });
    const updated = computeDerivedState(declared, {
      type: 'UPDATE_VERIFICATION_SOURCE',
      payload: { id: 'src-ck', notes: 'Operator confirms list size on Subscribers page' },
    });
    expect(updated.matrix.verificationSourcesById['src-ck']?.notes).toBe(
      'Operator confirms list size on Subscribers page'
    );
    // unchanged fields preserved
    expect(updated.matrix.verificationSourcesById['src-ck']?.source).toBe('ConvertKit');
  });

  it('REMOVE_VERIFICATION_SOURCE deletes a source by id', () => {
    const initial = buildBlankIdentityState({});
    const declared = computeDerivedState(initial, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: { id: 'src-uspto', domain: 'Patent status', source: 'USPTO' },
    });
    const removed = computeDerivedState(declared, {
      type: 'REMOVE_VERIFICATION_SOURCE',
      payload: { id: 'src-uspto' },
    });
    expect(removed.matrix.verificationSourcesById['src-uspto']).toBeUndefined();
  });
});

describe('MATRIX SECTION 1A — gate code UNDECLARED_VERIFICATION_SOURCE', () => {
  const ATTEST_HIERARCHY = {
    block: 'Confirm release distribution submission',
    phase: 'P1',
    lane: 'Operation Endgame album release engine',
  };
  function baseBlock(overrides = {}) {
    return {
      id: 'release-confirm',
      title: 'Confirm release distribution submission',
      laneId: 'lane-creative',
      laneLabel: 'Operation Endgame album release engine',
      target: 'Release submitted to primary distributor',
      operatorAttestation: 'Operator confirms submission status and attests completion',
      expectedOutput: 'Distribution submission record',
      producesArtifact: 'Distribution submission record',
      passEvidence: 'Saved confirmation screenshot',
      plainAction: 'Open the distributor and confirm submission status',
      steps: ['Open distributor', 'Confirm status'],
      doneWhen: 'A saved confirmation receipt exists',
      consumedBy: ['masterPlanLane:lane-creative'],
      consumedByRef: { type: 'masterPlanLane', id: 'lane-creative' },
      ...overrides,
    };
  }

  it('does NOT emit UNDECLARED_VERIFICATION_SOURCE when registry is empty (soft mode — day 1)', () => {
    const block = baseBlock({ verificationSource: 'DistroKid dashboard' });
    const result = resolveBlockPlainLanguage(block, {
      hierarchy: ATTEST_HIERARCHY,
      matrix: { verificationSourcesById: {} },
    });
    expect(result.quality?.failureCodes || []).not.toContain('UNDECLARED_VERIFICATION_SOURCE');
  });

  it('does NOT emit UNDECLARED_VERIFICATION_SOURCE when block source matches a declared registry entry by label', () => {
    const block = baseBlock({ verificationSource: 'DistroKid dashboard' });
    const result = resolveBlockPlainLanguage(block, {
      hierarchy: ATTEST_HIERARCHY,
      matrix: {
        verificationSourcesById: {
          'src-distrokid': {
            id: 'src-distrokid',
            domain: 'Music revenue',
            source: 'DistroKid dashboard',
          },
          'src-spotify': {
            id: 'src-spotify',
            domain: 'Music streams',
            source: 'Spotify for Artists',
          },
        },
      },
    });
    expect(result.quality?.failureCodes || []).not.toContain('UNDECLARED_VERIFICATION_SOURCE');
  });

  it('EMITS UNDECLARED_VERIFICATION_SOURCE when block source is not in a non-empty registry', () => {
    const block = baseBlock({ verificationSource: 'Some Random Source' });
    const result = resolveBlockPlainLanguage(block, {
      hierarchy: ATTEST_HIERARCHY,
      matrix: {
        verificationSourcesById: {
          'src-distrokid': {
            id: 'src-distrokid',
            domain: 'Music revenue',
            source: 'DistroKid dashboard',
          },
        },
      },
    });
    expect(result.quality?.failureCodes || []).toContain('UNDECLARED_VERIFICATION_SOURCE');
  });
});
