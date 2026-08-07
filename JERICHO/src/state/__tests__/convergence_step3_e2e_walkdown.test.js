/**
 * Convergence Step 3: Real End-to-End Test
 *
 * Demonstrates actual convergence edge creation with:
 * 1. Sources validated (must exist, no sequential dependencies)
 * 2. Edge created with name and targetDate
 * 3. Schema shows new Step 3 fields populated correctly
 */

import { describe, it, expect } from 'vitest';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';

describe('Convergence Step 3: Real End-to-End Declaration', () => {
  it('declares convergence edge with name and targetDate, validates sources correctly', () => {
    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    // Create verification source
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: {
        id: 'vs-1',
        name: 'Manual Verification',
        method: 'manual',
      },
    });

    // Create entity for artifacts
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'e-creator',
        name: 'Creator Entity',
        roleTags: ['creator'],
        purpose: 'Create content',
        formationState: 'founded',
        statusEvidence: 'Active',
      },
    });

    // Create source artifact 1
    state = computeDerivedState(state, {
      type: 'DECLARE_ARTIFACT',
      payload: {
        id: 'art-album',
        name: 'Album Released',
        producingProjectId: 'proj-music', // Will fail but won't block artifact creation
        completionEvidence: 'Album is live',
        verificationSourceId: 'vs-1',
        operatorAttestationMethod: 'Check streaming',
      },
    });

    // Create destination entity
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'e-audience',
        name: 'Audience Growth',
        roleTags: ['metrics'],
        purpose: 'Build audience',
        formationState: 'founded',
        statusEvidence: '100k followers',
      },
    });

    // ========== STEP 3: DECLARE CONVERGENCE ==========
    const targetDate = '2026-09-15';
    const edgeName = 'Album Release → Audience Growth';

    state = computeDerivedState(state, {
      type: 'DECLARE_CONVERGENCE',
      payload: {
        id: 'conv-test-1',
        fromNodeId: 'art-album',
        toNodeId: 'e-audience',
        gives: 'album creates awareness and drives audience growth',
        name: edgeName,
        targetDate,
      },
    });

    // ========== VERIFICATION: Edge Created ==========
    const edge = state.matrix.convergenceEdgesById['conv-test-1'];

    if (!edge) {
      console.error('Edge not created. Error:', state.lastPlanError);
    }

    expect(edge).toBeDefined();
    expect(edge.name).toBe(edgeName);
    expect(edge.targetDate).toBe(targetDate);
    expect(edge.status).toBe('PENDING');
    expect(edge.fromNodeId).toBe('art-album');
    expect(edge.fromNodeIds).toEqual(['art-album']);
    expect(edge.toNodeId).toBe('e-audience');
    expect(edge.gives).toBe('album creates awareness and drives audience growth');
    expect(edge.declaredAtISO).toBeDefined();
    expect(edge.supersedes).toBeNull();
    expect(edge.supersededBy).toBeNull();
    expect(edge.broken).toBe(false);

    // Step 3: sourceDeliverableIds and sourceArtifactIds are now part of the schema
    expect(edge.sourceDeliverableIds).toBeDefined();
    expect(Array.isArray(edge.sourceDeliverableIds)).toBe(true);
    expect(edge.sourceArtifactIds).toBeDefined();
    expect(Array.isArray(edge.sourceArtifactIds)).toBe(true);

    console.log('✅ Step 3 Convergence Declaration Verified:');
    console.log('  ✓ Edge created:', { id: edge.id, name: edge.name });
    console.log('  ✓ TargetDate assigned:', edge.targetDate);
    console.log('  ✓ Status initialized:', edge.status);
    console.log('  ✓ New Step 3 schema fields present');
  });

  it('hard-blocks convergence with sequential dependencies', () => {
    let state = buildBlankIdentityState();
    state.appTime = { nowISO: '2026-08-06T10:00:00Z' };

    // Create verification source
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: {
        id: 'vs-2',
        name: 'Verification',
        method: 'manual',
      },
    });

    // Create entity
    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'e-work',
        name: 'Work Entity',
        roleTags: ['work'],
        purpose: 'Work',
        formationState: 'founded',
        statusEvidence: 'Active',
      },
    });

    // Create two artifacts
    state = computeDerivedState(state, {
      type: 'DECLARE_ARTIFACT',
      payload: {
        id: 'art-draft',
        name: 'Draft Complete',
        producingProjectId: 'proj-1',
        completionEvidence: 'Draft done',
        verificationSourceId: 'vs-2',
        operatorAttestationMethod: 'Check',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_ARTIFACT',
      payload: {
        id: 'art-published',
        name: 'Published',
        producingProjectId: 'proj-1',
        completionEvidence: 'Live',
        verificationSourceId: 'vs-2',
        operatorAttestationMethod: 'Check',
      },
    });

    // Create dependency: draft → published
    state = computeDerivedState(state, {
      type: 'DECLARE_DEPENDENCY',
      payload: {
        id: 'dep-draft-pub',
        upstreamId: 'art-draft',
        downstreamId: 'art-published',
        type: 'hard_gate',
      },
    });

    // Try to declare convergence with both as sources
    // Should fail because they're sequentially dependent
    state = computeDerivedState(state, {
      type: 'DECLARE_CONVERGENCE',
      payload: {
        id: 'conv-bad',
        fromNodeIds: ['art-draft', 'art-published'],
        toNodeId: 'e-work',
        gives: 'parallel work',
        name: 'Bad Convergence - Sequential Sources',
        targetDate: '2026-09-15',
      },
    });

    // Should have been rejected
    expect(state.lastPlanError?.code).toBe('CONVERGENCE_SOURCES_SEQUENTIAL');
    expect(state.lastPlanError?.meta?.violatingPair).toEqual(['art-draft', 'art-published']);
    expect(state.matrix.convergenceEdgesById['conv-bad']).toBeUndefined();

    console.log('✅ Sequential Dependency Hard Block Works:');
    console.log('  ✓ Error code:', state.lastPlanError?.code);
    console.log('  ✓ Violating pair:', state.lastPlanError?.meta?.violatingPair);
  });
});
