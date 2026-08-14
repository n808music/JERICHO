import { describe, it, expect } from 'vitest';
import { resolveConvergenceBuffers } from '../resolveConvergenceBuffers';

describe('resolveConvergenceBuffers — Gap 3 Convergence buffer resolution', () => {
  it('returns empty map for matrix with no convergence edges', () => {
    const matrix = {};
    const result = resolveConvergenceBuffers(matrix);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
  });

  it('returns empty map for edges without buffer specs', () => {
    const matrix = {
      convergenceEdgesById: {
        'conv-1': {
          id: 'conv-1',
          fromNodeIds: ['p1', 'p2'],
          toNodeId: 'p3',
          targetDate: '2026-12-17',
          // No bufferType or bufferDays
        },
      },
    };
    const result = resolveConvergenceBuffers(matrix);
    expect(result.size).toBe(0);
  });

  it('computes sequential buffer: preceding project offset by bufferDays, following at targetDate', () => {
    const matrix = {
      convergenceEdgesById: {
        'conv-seq': {
          id: 'conv-seq',
          fromNodeIds: ['p1', 'p2'],
          toNodeId: 'p3',
          targetDate: '2026-12-17',
          bufferType: 'sequential',
          bufferDays: 5,
          precedingProjectId: 'p1',
          followingProjectId: 'p2',
        },
      },
    };
    const result = resolveConvergenceBuffers(matrix);

    // Preceding project should be 5 days before targetDate
    expect(result.get('p1')).toBe('2026-12-12');
    // Following project should be at targetDate
    expect(result.get('p2')).toBe('2026-12-17');
  });

  it('computes parallel buffer: all sources sync to targetDate', () => {
    const matrix = {
      convergenceEdgesById: {
        'conv-par': {
          id: 'conv-par',
          fromNodeIds: ['p1', 'p2', 'p3'],
          toNodeId: 'p4',
          targetDate: '2026-12-17',
          bufferType: 'parallel',
          toleranceDays: 2,
        },
      },
    };
    const result = resolveConvergenceBuffers(matrix);

    // All sources should sync to targetDate
    expect(result.get('p1')).toBe('2026-12-17');
    expect(result.get('p2')).toBe('2026-12-17');
    expect(result.get('p3')).toBe('2026-12-17');
  });

  it('handles multiple convergence edges independently', () => {
    const matrix = {
      convergenceEdgesById: {
        'conv-1': {
          id: 'conv-1',
          fromNodeIds: ['p1', 'p2'],
          toNodeId: 'p3',
          targetDate: '2026-12-17',
          bufferType: 'sequential',
          bufferDays: 3,
          precedingProjectId: 'p1',
          followingProjectId: 'p2',
        },
        'conv-2': {
          id: 'conv-2',
          fromNodeIds: ['p4', 'p5'],
          toNodeId: 'p6',
          targetDate: '2026-12-20',
          bufferType: 'sequential',
          bufferDays: 7,
          precedingProjectId: 'p4',
          followingProjectId: 'p5',
        },
      },
    };
    const result = resolveConvergenceBuffers(matrix);

    // First convergence
    expect(result.get('p1')).toBe('2026-12-14'); // 3 days before
    expect(result.get('p2')).toBe('2026-12-17');

    // Second convergence
    expect(result.get('p4')).toBe('2026-12-13'); // 7 days before
    expect(result.get('p5')).toBe('2026-12-20');
  });

  it('ignores edges with missing precedingProjectId or followingProjectId for sequential buffers', () => {
    const matrix = {
      convergenceEdgesById: {
        'conv-incomplete': {
          id: 'conv-incomplete',
          fromNodeIds: ['p1', 'p2'],
          toNodeId: 'p3',
          targetDate: '2026-12-17',
          bufferType: 'sequential',
          bufferDays: 5,
          // Missing precedingProjectId and followingProjectId
        },
      },
    };
    const result = resolveConvergenceBuffers(matrix);
    expect(result.size).toBe(0);
  });

  it('handles buffer spanning month boundaries', () => {
    const matrix = {
      convergenceEdgesById: {
        'conv-boundary': {
          id: 'conv-boundary',
          fromNodeIds: ['p1', 'p2'],
          toNodeId: 'p3',
          targetDate: '2026-01-05',
          bufferType: 'sequential',
          bufferDays: 10,
          precedingProjectId: 'p1',
          followingProjectId: 'p2',
        },
      },
    };
    const result = resolveConvergenceBuffers(matrix);

    // Should properly handle month boundary
    expect(result.get('p1')).toBe('2025-12-26');
    expect(result.get('p2')).toBe('2026-01-05');
  });
});
