import { describe, it, expect } from 'vitest';
import {
  validateConvergenceDates,
  validateConvergenceSources,
  validateArtifactParents,
  validateNamingConsistency,
  validateCrossReferenceIntegrity,
  registerReferenceResolver,
} from '../crossReferenceIntegrityValidator.js';

describe('Cross-Reference Integrity Validator', () => {
  describe('Pattern 1: Convergence Date Consistency', () => {
    it('detects date mismatches between Convergence and source Projects', () => {
      const state = {
        matrix: {
          convergenceEdgesById: {
            'conv-001': {
              id: 'conv-001',
              name: 'Academy Launch',
              sourceProjectIds: ['proj-001', 'proj-002'],
              expectedTerminalDate: '2026-12-17',
            },
          },
          projectsById: {
            'proj-001': {
              id: 'proj-001',
              name: 'Foundation',
              terminalDate: '2026-12-17', // Matches
            },
            'proj-002': {
              id: 'proj-002',
              name: '79th St Campaign',
              terminalDate: '2026-12-20', // Mismatches
            },
          },
        },
      };

      const issues = validateConvergenceDates(state);

      expect(issues).toHaveLength(1);
      expect(issues[0].pattern).toBe('convergence-date-consistency');
      expect(issues[0].expectedDate).toBe('2026-12-17');
      expect(issues[0].mismatchedSources).toHaveLength(1);
      expect(issues[0].mismatchedSources[0].projectName).toBe('79th St Campaign');
    });

    it('returns empty when all dates match', () => {
      const state = {
        matrix: {
          convergenceEdgesById: {
            'conv-001': {
              id: 'conv-001',
              name: 'Academy Launch',
              sourceProjectIds: ['proj-001', 'proj-002'],
              expectedTerminalDate: '2026-12-17',
            },
          },
          projectsById: {
            'proj-001': { id: 'proj-001', name: 'Foundation', terminalDate: '2026-12-17' },
            'proj-002': { id: 'proj-002', name: '79th St Campaign', terminalDate: '2026-12-17' },
          },
        },
      };

      const issues = validateConvergenceDates(state);

      expect(issues).toHaveLength(0);
    });
  });

  describe('Pattern 2: Convergence Source Reference Validity', () => {
    it('detects broken Project references in Convergence', () => {
      const state = {
        matrix: {
          convergenceEdgesById: {
            'conv-001': {
              id: 'conv-001',
              name: 'Academy Launch',
              sourceProjectIds: ['proj-001', 'proj-999'],
            },
          },
          projectsById: {
            'proj-001': { id: 'proj-001', name: 'Foundation' },
            // proj-999 does not exist
          },
        },
      };

      const issues = validateConvergenceSources(state);

      expect(issues).toHaveLength(1);
      expect(issues[0].pattern).toBe('convergence-source-reference-validity');
      expect(issues[0].brokenReferences).toHaveLength(1);
      expect(issues[0].brokenReferences[0].projectId).toBe('proj-999');
    });

    it('returns empty when all source references exist', () => {
      const state = {
        matrix: {
          convergenceEdgesById: {
            'conv-001': {
              id: 'conv-001',
              name: 'Academy Launch',
              sourceProjectIds: ['proj-001', 'proj-002'],
            },
          },
          projectsById: {
            'proj-001': { id: 'proj-001', name: 'Foundation' },
            'proj-002': { id: 'proj-002', name: '79th St Campaign' },
          },
        },
      };

      const issues = validateConvergenceSources(state);

      expect(issues).toHaveLength(0);
    });
  });

  describe('Pattern 3: Deliverable↔Artifact Parent Integrity', () => {
    it('detects broken parent Deliverable references in Artifacts', () => {
      const state = {
        matrix: {
          artifactsById: {
            'art-001': {
              id: 'art-001',
              name: 'Brand Guide',
              parentDeliverableId: 'del-001',
            },
            'art-002': {
              id: 'art-002',
              name: 'Product Spec',
              parentDeliverableId: 'del-999',
            },
          },
          projectsById: {
            'del-001': { id: 'del-001', name: 'Branding' },
            // del-999 does not exist
          },
        },
      };

      const issues = validateArtifactParents(state);

      expect(issues).toHaveLength(1);
      expect(issues[0].pattern).toBe('artifact-parent-integrity');
      expect(issues[0].artifactName).toBe('Product Spec');
      expect(issues[0].parentId).toBe('del-999');
    });

    it('ignores artifacts without parent references', () => {
      const state = {
        matrix: {
          artifactsById: {
            'art-001': {
              id: 'art-001',
              name: 'Brand Guide',
              parentDeliverableId: null,
            },
          },
          projectsById: {},
        },
      };

      const issues = validateArtifactParents(state);

      expect(issues).toHaveLength(0);
    });
  });

  describe('Pattern 4: Cross-Tab Naming Consistency', () => {
    it('detects Project names referenced by Convergence that no longer exist', () => {
      const state = {
        matrix: {
          convergenceEdgesById: {
            'conv-001': {
              id: 'conv-001',
              name: 'Desiree Convergence',
              sourceProjectNames: ['Desiree v1', 'Desiree v2'],
            },
          },
          projectsById: {
            'proj-001': { id: 'proj-001', name: 'Desiree v1' },
            'proj-002': { id: 'proj-002', name: 'Desiree Marketing' }, // Name changed
          },
        },
      };

      const issues = validateNamingConsistency(state);

      expect(issues).toHaveLength(1);
      expect(issues[0].pattern).toBe('cross-tab-naming-consistency');
      expect(issues[0].missingNames).toContain('Desiree v2');
    });

    it('returns empty when all referenced names exist', () => {
      const state = {
        matrix: {
          convergenceEdgesById: {
            'conv-001': {
              id: 'conv-001',
              name: 'Desiree Convergence',
              sourceProjectNames: ['Desiree v1', 'Desiree v2'],
            },
          },
          projectsById: {
            'proj-001': { id: 'proj-001', name: 'Desiree v1' },
            'proj-002': { id: 'proj-002', name: 'Desiree v2' },
          },
        },
      };

      const issues = validateNamingConsistency(state);

      expect(issues).toHaveLength(0);
    });
  });

  describe('Master Validator: All Patterns', () => {
    it('combines issues from all four patterns', () => {
      const state = {
        matrix: {
          convergenceEdgesById: {
            'conv-001': {
              id: 'conv-001',
              name: 'Test Conv',
              sourceProjectIds: ['proj-001', 'proj-999'],
              sourceProjectNames: ['Project A', 'Missing Name'],
              expectedTerminalDate: '2026-12-17',
            },
          },
          projectsById: {
            'proj-001': { id: 'proj-001', name: 'Project A', terminalDate: '2026-12-20' },
          },
          artifactsById: {
            'art-001': { id: 'art-001', name: 'Artifact', parentDeliverableId: 'del-999' },
          },
        },
      };

      const result = validateCrossReferenceIntegrity(state);

      expect(result.isConsistent).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);

      const patterns = result.issues.map((i) => i.pattern);
      expect(patterns).toContain('convergence-date-consistency');
      expect(patterns).toContain('convergence-source-reference-validity');
      expect(patterns).toContain('cross-tab-naming-consistency');
      expect(patterns).toContain('artifact-parent-integrity');
    });

    it('returns isConsistent true when all validations pass', () => {
      const state = {
        matrix: {
          convergenceEdgesById: {},
          projectsById: {},
          artifactsById: {},
        },
      };

      const result = validateCrossReferenceIntegrity(state);

      expect(result.isConsistent).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('Resolver Registry Extensibility', () => {
    it('allows registering new reference resolvers', () => {
      const customResolver = (state, refId) => state.custom?.[refId] || null;

      expect(() => {
        registerReferenceResolver('custom-reference', customResolver);
      }).not.toThrow();
    });

    it('throws error when registering non-function resolver', () => {
      expect(() => {
        registerReferenceResolver('bad-resolver', 'not a function');
      }).toThrow('Resolver must be a function');
    });
  });
});
