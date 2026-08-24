/**
 * matrixAggregation.test.js — Unit tests for recursive hierarchy rollup functions
 *
 * Tests for aggregatePhaseRollup() and aggregateUrgencyRollup()
 * Covers: normal cases, orphaned nodes, field-name variations, drill-down traceability
 */

import { describe, it, expect } from 'vitest';
import { aggregatePhaseRollup, aggregateUrgencyRollup } from './matrixAggregation.js';

describe('aggregatePhaseRollup', () => {
  // Build a minimal test matrix
  const makeMatrix = (overrides = {}) => ({
    entitiesById: {},
    initiativesById: {},
    projectsById: {},
    deliverablesById: {},
    artifactsById: {},
    ...overrides,
  });

  it('returns empty counts for null node', () => {
    const result = aggregatePhaseRollup(null, makeMatrix());
    expect(result.leafCounts).toEqual({ P1: 0, P2: 0, P3: 0, null: 0 });
    expect(result.leafRefs).toEqual({ P1: [], P2: [], P3: [], null: [] });
    expect(result.orphanedProjects).toEqual([]);
  });

  it('counts Projects under an Initiative, grouped by Phase', () => {
    const matrix = makeMatrix({
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Test Initiative', owningEntityId: 'ent-1' },
      },
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'P1 Project', owningInitiativeId: 'init-1', targetDate: '2028-02-01' }, // P1: before 2028-02-17
        'proj-2': { id: 'proj-2', name: 'P2 Project', owningInitiativeId: 'init-1', targetDate: '2029-06-15' }, // P2: after 2028-02-17, before 2029-08-17
        'proj-3': { id: 'proj-3', name: 'P3 Project', owningInitiativeId: 'init-1', targetDate: '2030-02-01' }, // P3: after 2029-08-17
      },
    });

    const result = aggregatePhaseRollup(matrix.initiativesById['init-1'], matrix);

    expect(result.leafCounts.P1).toBe(1); // P1 project
    expect(result.leafCounts.P2).toBe(1); // P2 project
    expect(result.leafCounts.P3).toBe(1); // P3 project
    expect(result.leafRefs.P1).toContain('proj-1');
    expect(result.leafRefs.P2).toContain('proj-2');
    expect(result.leafRefs.P3).toContain('proj-3');
  });

  it('handles orphaned Projects (owningInitiativeId is invalid)', () => {
    const matrix = makeMatrix({
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Test Initiative', owningEntityId: 'ent-1' },
      },
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'Linked Project', owningInitiativeId: 'init-1', targetDate: '2026-06-01' },
        'proj-2': { id: 'proj-2', name: 'Orphaned Project', owningInitiativeId: 'init-999', targetDate: '2026-07-01' }, // Points to non-existent initiative
      },
    });

    const result = aggregatePhaseRollup(matrix.initiativesById['init-1'], matrix);

    expect(result.leafCounts.P1).toBe(1); // Only proj-1 counted
    expect(result.orphanedProjects).toContain('proj-2'); // proj-2 flagged as orphaned
  });

  it('includes Deliverables in Phase count (inherit parent Project Phase)', () => {
    const matrix = makeMatrix({
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Test Initiative', owningEntityId: 'ent-1' },
      },
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'Test Project', owningInitiativeId: 'init-1', targetDate: '2026-06-01' },
      },
      deliverablesById: {
        'deliv-1': { id: 'deliv-1', name: 'Deliverable 1', owningProjectId: 'proj-1', successCriteria: 'Done' },
        'deliv-2': { id: 'deliv-2', name: 'Deliverable 2', owningProjectId: 'proj-1', successCriteria: 'Done' },
      },
    });

    const result = aggregatePhaseRollup(matrix.initiativesById['init-1'], matrix);

    // Project + 2 Deliverables = 3 items in same Phase
    expect(result.leafCounts.P1).toBe(3); // proj-1 + deliv-1 + deliv-2
    expect(result.displaySummary).toContain('3');
  });

  it('includes Artifacts in Phase count (inherit parent Project Phase)', () => {
    const matrix = makeMatrix({
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Test Initiative', owningEntityId: 'ent-1' },
      },
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'Test Project', owningInitiativeId: 'init-1', targetDate: '2026-06-01' },
      },
      artifactsById: {
        'art-1': { id: 'art-1', name: 'Artifact 1', producingProjectId: 'proj-1', completionEvidence: 'Done' },
      },
    });

    const result = aggregatePhaseRollup(matrix.initiativesById['init-1'], matrix);

    // Project + 1 Artifact = 2 items in same Phase
    expect(result.leafCounts.P1).toBe(2); // proj-1 + art-1
  });

  it('handles Entity-scope rollup (Initiatives → Projects)', () => {
    const matrix = makeMatrix({
      entitiesById: {
        'ent-1': { id: 'ent-1', name: 'Test Entity', purpose: 'Testing' },
      },
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Init 1', owningEntityId: 'ent-1' },
        'init-2': { id: 'init-2', name: 'Init 2', owningEntityId: 'ent-1' },
      },
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'Project 1', owningInitiativeId: 'init-1', targetDate: '2028-02-01' }, // P1
        'proj-2': { id: 'proj-2', name: 'Project 2', owningInitiativeId: 'init-2', targetDate: '2030-02-01' }, // P3
      },
    });

    const result = aggregatePhaseRollup(matrix.entitiesById['ent-1'], matrix);

    expect(result.leafCounts.P1).toBe(1); // proj-1
    expect(result.leafCounts.P3).toBe(1); // proj-2
    expect(result.leafRefs.P1).toContain('proj-1');
    expect(result.leafRefs.P3).toContain('proj-2');
  });

  it('produces displaySummary from leafCounts (not stored independently)', () => {
    const matrix = makeMatrix({
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Test Initiative', owningEntityId: 'ent-1' },
      },
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'P1 Project', owningInitiativeId: 'init-1', targetDate: '2028-02-01' },
        'proj-2': { id: 'proj-2', name: 'P2 Project', owningInitiativeId: 'init-1', targetDate: '2029-06-15' },
      },
    });

    const result = aggregatePhaseRollup(matrix.initiativesById['init-1'], matrix);

    expect(result.displaySummary).toMatch(/1 P1/);
    expect(result.displaySummary).toMatch(/1 P2/);
  });

  it('handles Projects with null targetDate (produces null phase)', () => {
    const matrix = makeMatrix({
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Test Initiative', owningEntityId: 'ent-1' },
      },
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'Undated Project', owningInitiativeId: 'init-1', targetDate: null },
      },
    });

    const result = aggregatePhaseRollup(matrix.initiativesById['init-1'], matrix);

    expect(result.leafCounts.null).toBe(1);
    expect(result.leafRefs.null).toContain('proj-1');
  });

  it('drill-down: leafRefs can be traced back to source (Section 2.1 requirement)', () => {
    const matrix = makeMatrix({
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Test Initiative', owningEntityId: 'ent-1' },
      },
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'Test Project', owningInitiativeId: 'init-1', targetDate: '2026-06-01' },
      },
    });

    const result = aggregatePhaseRollup(matrix.initiativesById['init-1'], matrix);

    // leafRefs must contain traceable IDs, not aggregate summaries
    expect(result.leafRefs.P1[0]).toBe('proj-1');
    expect(typeof result.leafRefs.P1[0]).toBe('string');
    expect(matrix.projectsById[result.leafRefs.P1[0]]).toBeTruthy(); // Can look up the source
  });

  it('handles Initiative with zero Projects/Deliverables/Artifacts (E16 case)', () => {
    const matrix = makeMatrix({
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Empty Initiative', owningEntityId: 'ent-1' },
      },
      projectsById: {},
      deliverablesById: {},
      artifactsById: {},
    });

    const result = aggregatePhaseRollup(matrix.initiativesById['init-1'], matrix);

    // All phase counts should be zero
    expect(result.leafCounts.P1).toBe(0);
    expect(result.leafCounts.P2).toBe(0);
    expect(result.leafCounts.P3).toBe(0);
    expect(result.leafCounts.null).toBe(0);

    // All leaf refs should be empty
    expect(result.leafRefs.P1).toEqual([]);
    expect(result.leafRefs.P2).toEqual([]);
    expect(result.leafRefs.P3).toEqual([]);
    expect(result.leafRefs.null).toEqual([]);

    // Display should show "No items"
    expect(result.displaySummary).toBe('No items');

    // No orphaned projects in scope
    expect(result.orphanedProjects).toEqual([]);
  });
});

describe('aggregateUrgencyRollup', () => {
  const makeMatrix = (overrides = {}) => ({
    entitiesById: {},
    initiativesById: {},
    projectsById: {},
    ...overrides,
  });

  it('returns none urgency for empty scope', () => {
    const matrix = makeMatrix({
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Empty Initiative', owningEntityId: 'ent-1' },
      },
    });

    const result = aggregateUrgencyRollup(matrix.initiativesById['init-1'], matrix, {});

    expect(result.computedUrgency).toBe('none');
    expect(result.compoundingFloor).toBe('none');
    expect(result.effectiveUrgency).toBe('none');
  });

  it('elevates urgency based on item count', () => {
    const matrix = makeMatrix({
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Busy Initiative', owningEntityId: 'ent-1' },
      },
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'P1', owningInitiativeId: 'init-1', targetDate: '2026-06-01' },
        'proj-2': { id: 'proj-2', name: 'P2', owningInitiativeId: 'init-1', targetDate: '2026-06-02' },
        'proj-3': { id: 'proj-3', name: 'P3', owningInitiativeId: 'init-1', targetDate: '2026-06-03' },
        // ... add more to reach threshold
      },
    });

    // Add 18 more projects to exceed watch threshold (>10)
    for (let i = 4; i <= 21; i++) {
      matrix.projectsById[`proj-${i}`] = {
        id: `proj-${i}`,
        name: `Project ${i}`,
        owningInitiativeId: 'init-1',
        targetDate: '2026-06-01',
      };
    }

    const result = aggregateUrgencyRollup(matrix.initiativesById['init-1'], matrix, {});

    expect(result.computedUrgency).toBe('urgent'); // >20 items
  });

  it('compounding floor: child CONSTRAINT forces minimum urgency (Section 2.2)', () => {
    const matrix = makeMatrix({
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Initiative', owningEntityId: 'ent-1' },
      },
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'Constrained Project', owningInitiativeId: 'init-1', targetDate: '2026-06-01' },
      },
    });

    const constraintsByNode = {
      'proj-1': 'CONSTRAINT', // This project is under active escalation
    };

    const result = aggregateUrgencyRollup(matrix.initiativesById['init-1'], matrix, constraintsByNode);

    // Even with few items (computedUrgency = none), compounding floor lifts it to urgent
    expect(result.compoundingFloor).toBe('urgent');
    expect(result.effectiveUrgency).toBe('urgent');
    expect(result.constraintSources).toContain('proj-1');
  });

  it('effective urgency is max of computed and compounding floor', () => {
    const matrix = makeMatrix({
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Initiative', owningEntityId: 'ent-1' },
      },
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'P1', owningInitiativeId: 'init-1', targetDate: '2026-06-01' },
        'proj-2': { id: 'proj-2', name: 'P2', owningInitiativeId: 'init-1', targetDate: '2026-06-02' },
      },
    });

    // Add enough projects to reach watch threshold (>10)
    for (let i = 3; i <= 12; i++) {
      matrix.projectsById[`proj-${i}`] = {
        id: `proj-${i}`,
        name: `P${i}`,
        owningInitiativeId: 'init-1',
        targetDate: '2026-06-01',
      };
    }

    const constraintsByNode = {
      'proj-1': 'CONSTRAINT',
    };

    const result = aggregateUrgencyRollup(matrix.initiativesById['init-1'], matrix, constraintsByNode);

    // computedUrgency = watch (11 items)
    // compoundingFloor = urgent (child CONSTRAINT)
    expect(result.computedUrgency).toBe('watch');
    expect(result.compoundingFloor).toBe('urgent');
    expect(result.effectiveUrgency).toBe('urgent'); // max(watch, urgent)
  });

  it('handles Entity-scope urgency rollup', () => {
    const matrix = makeMatrix({
      entitiesById: {
        'ent-1': { id: 'ent-1', name: 'Entity', purpose: 'Testing' },
      },
      initiativesById: {
        'init-1': { id: 'init-1', name: 'Init 1', owningEntityId: 'ent-1' },
      },
      projectsById: {
        'proj-1': { id: 'proj-1', name: 'P1', owningInitiativeId: 'init-1', targetDate: '2026-06-01' },
      },
    });

    const result = aggregateUrgencyRollup(matrix.entitiesById['ent-1'], matrix, {});

    expect(result.ownNode).toBe('ent-1');
    expect(result.effectiveUrgency).toBe('none'); // Single project
  });
});
