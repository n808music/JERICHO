/**
 * constraintsByNodeDerivation.test.js — Unit tests for buildConstraintsByNode()
 *
 * Tests the derivation of constraintsByNode map from backlog state.
 */

import { describe, it, expect } from 'vitest';
import { buildConstraintsByNode } from './constraintsByNodeDerivation.js';

describe('buildConstraintsByNode', () => {
  it('returns empty map when no backlog blocks exist', () => {
    const matrix = {};
    const backlogBlocks = [];

    const result = buildConstraintsByNode(matrix, backlogBlocks);

    expect(result).toEqual({});
  });

  it('returns empty map when no blocks have CONSTRAINT tag', () => {
    const matrix = {};
    const backlogBlocks = [
      { id: 'block-1', projectId: 'proj-1', constraintTag: 'ADVISORY' },
      { id: 'block-2', projectId: 'proj-2', constraintTag: null },
      { id: 'block-3', projectId: 'proj-3', constraintTag: 'INTENT' },
    ];

    const result = buildConstraintsByNode(matrix, backlogBlocks);

    expect(result).toEqual({});
  });

  it('maps CONSTRAINT-tagged blocks to their owning Projects', () => {
    const matrix = {};
    const backlogBlocks = [
      { id: 'block-1', projectId: 'proj-1', constraintTag: 'CONSTRAINT' },
      { id: 'block-2', projectId: 'proj-2', constraintTag: 'ADVISORY' },
      { id: 'block-3', projectId: 'proj-3', constraintTag: 'CONSTRAINT' },
    ];

    const result = buildConstraintsByNode(matrix, backlogBlocks);

    expect(result).toEqual({
      'proj-1': 'CONSTRAINT',
      'proj-3': 'CONSTRAINT',
    });
  });

  it('handles multiple CONSTRAINT blocks for the same Project', () => {
    const matrix = {};
    const backlogBlocks = [
      { id: 'block-1', projectId: 'proj-1', constraintTag: 'CONSTRAINT' },
      { id: 'block-2', projectId: 'proj-1', constraintTag: 'CONSTRAINT' }, // duplicate project
      { id: 'block-3', projectId: 'proj-2', constraintTag: 'CONSTRAINT' },
    ];

    const result = buildConstraintsByNode(matrix, backlogBlocks);

    // Both should be marked as CONSTRAINT (last one wins, but value is the same)
    expect(result['proj-1']).toBe('CONSTRAINT');
    expect(result['proj-2']).toBe('CONSTRAINT');
  });

  it('ignores blocks without projectId', () => {
    const matrix = {};
    const backlogBlocks = [
      { id: 'block-1', projectId: null, constraintTag: 'CONSTRAINT' },
      { id: 'block-2', projectId: undefined, constraintTag: 'CONSTRAINT' },
      { id: 'block-3', projectId: 'proj-1', constraintTag: 'CONSTRAINT' },
    ];

    const result = buildConstraintsByNode(matrix, backlogBlocks);

    expect(result).toEqual({
      'proj-1': 'CONSTRAINT',
    });
  });

  it('handles null/undefined inputs gracefully', () => {
    expect(buildConstraintsByNode(null, null)).toEqual({});
    expect(buildConstraintsByNode({}, null)).toEqual({});
    expect(buildConstraintsByNode(undefined, undefined)).toEqual({});
  });
});
