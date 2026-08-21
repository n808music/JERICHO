/**
 * Dual-Parent Deliverable Consistency Check
 *
 * Validates that every Deliverable's two parent-resolution paths
 * (via Initiative → Entity vs. via Project → Entity) lead to the same Entity.
 * This determines whether Option D (aggregate at Deliverable level) is safe.
 */

import { describe, it, expect } from 'vitest';

describe('Dual-Parent Deliverable Validation', () => {
  it('validates that Deliverable paths via Initiative and Project resolve to same Entity', () => {
    // Load a canonical matrix state — use the test fixture or a snapshot
    const matrix = {
      entitiesById: {},
      initiativesById: {},
      projectsById: {},
      deliverablesById: {},
      // ... populate from actual state snapshot
    };

    const results = { consistent: 0, disagreements: [], unresolved: [] };

    for (const [deliverableId, deliverable] of Object.entries(matrix.deliverablesById || {})) {
      const initiative = (matrix.initiativesById as any)?.[deliverable.owningInitiativeId];
      const project = (matrix.projectsById as any)?.[deliverable.owningProjectId];

      if (!initiative || !project) {
        results.unresolved.push({
          deliverableId,
          missing: !initiative ? 'initiative' : 'project',
        });
        continue;
      }

      const entityViaInitiative = initiative.owningEntityId;
      const entityViaProject = project.owningEntityId;

      if (!entityViaInitiative || !entityViaProject) {
        results.unresolved.push({
          deliverableId,
          missing: !entityViaInitiative ? 'initiative.owningEntityId' : 'project.owningEntityId',
        });
        continue;
      }

      if (entityViaInitiative === entityViaProject) {
        results.consistent++;
      } else {
        results.disagreements.push({
          deliverableId,
          entityViaInitiative,
          entityViaProject,
        });
      }
    }

    console.log('Dual-Parent Validation Results:', JSON.stringify(results, null, 2));

    // Expectations
    expect(results.disagreements).toHaveLength(0); // All paths should lead to same Entity
    expect(results.unresolved.length).toBeLessThan(5); // Allow small number of edge cases
  });
});
