/**
 * item6-drill-down-spot-check.test.js — Definition of Done verification (Item 6, Section 5, item 5)
 *
 * Spot-check: pick one real aggregate number the mechanism produces, and show the actual
 * leaf nodes it traces back to, confirming Section 2.1's 'never terminal, always traceable'
 * requirement holds in practice, not just in the type signature.
 *
 * This test uses realistic fixture data (Entity with mixed Initiative/Project children)
 * and verifies end-to-end that:
 * 1. aggregatePhaseRollup produces a displaySummary number (e.g. "3 P1 items")
 * 2. That number traces to specific leafRefs (Project + Deliverable + Artifact)
 * 3. Each leafRef has a leafRefSource entry (traceability metadata)
 * 4. leafRefSources enables drill-down: looking up parent project for each child
 */

import { describe, it, expect } from 'vitest';
import { aggregatePhaseRollup } from '../../src/domain/masterGrid/matrixAggregation.js';
import { computeProjectSpinePhase } from '../../src/domain/masterGrid/projectSpinePhase.js';

describe('Item 6 Drill-Down Spot-Check: Section 2.1 Traceability', () => {
  it('displaySummary number traces to real leaf nodes with full traceability', () => {
    // Fixture: realistic Entity with mixed children
    // Phase boundaries (from E15 spec, Section 3):
    // P1: targetDate < 2028-02-17 (6 months from ~2027-08-23 baseline)
    // P2: 2028-02-17 <= targetDate < 2029-08-17 (6-18 months)
    // P3: targetDate >= 2029-08-17 (>18 months)

    const matrix = {
      entitiesById: {
        'acme-corp': {
          id: 'acme-corp',
          name: 'ACME Corporation',
          purpose: 'Fortune 500 conglomerate',
        },
      },
      initiativesById: {
        'initiative-product-launch': {
          id: 'initiative-product-launch',
          name: 'Q4 Product Launch',
          owningEntityId: 'acme-corp',
        },
        'initiative-infrastructure': {
          id: 'initiative-infrastructure',
          name: 'Data Center Modernization',
          owningEntityId: 'acme-corp',
        },
      },
      projectsById: {
        // P1: before 2028-02-17
        'proj-mobile-app': {
          id: 'proj-mobile-app',
          name: 'Mobile App Launch',
          owningInitiativeId: 'initiative-product-launch',
          owningEntityId: 'acme-corp',
          targetDate: '2028-02-01',
        },
        // P2: 2028-02-17 to 2029-08-17
        'proj-analytics': {
          id: 'proj-analytics',
          name: 'Analytics Platform',
          owningInitiativeId: 'initiative-product-launch',
          owningEntityId: 'acme-corp',
          targetDate: '2029-06-15',
        },
        // P3: after 2029-08-17
        'proj-ai-research': {
          id: 'proj-ai-research',
          name: 'AI Research Lab',
          owningInitiativeId: 'initiative-infrastructure',
          owningEntityId: 'acme-corp',
          targetDate: '2030-02-01',
        },
      },
      deliverablesById: {
        // Two deliverables under proj-mobile-app (P1)
        'deliv-ios-app': {
          id: 'deliv-ios-app',
          name: 'iOS App',
          owningProjectId: 'proj-mobile-app',
          successCriteria: 'App Store release',
        },
        'deliv-android-app': {
          id: 'deliv-android-app',
          name: 'Android App',
          owningProjectId: 'proj-mobile-app',
          successCriteria: 'Google Play release',
        },
      },
      artifactsById: {
        // One artifact under proj-analytics (P2)
        'artifact-analytics-dashboard': {
          id: 'artifact-analytics-dashboard',
          name: 'Live Analytics Dashboard',
          producingProjectId: 'proj-analytics',
          completionEvidence: 'Dashboard URL',
        },
      },
    };

    // Act: compute the rollup
    const rollup = aggregatePhaseRollup(matrix.entitiesById['acme-corp'], matrix);

    // Verify displaySummary produces a human-readable aggregate
    expect(rollup.displaySummary).toContain('3 P1');
    expect(rollup.displaySummary).toContain('P2');
    expect(rollup.displaySummary).toContain('1 P3');

    // DRILL-DOWN VERIFICATION: trace the "3 P1" number back to its leaf nodes
    const p1Leaves = rollup.leafRefs.P1;
    const p1Count = rollup.leafCounts.P1;

    // Assertion 1: count matches refs
    expect(p1Count).toBe(p1Leaves.length);
    expect(p1Count).toBe(3); // proj-mobile-app + deliv-ios-app + deliv-android-app

    // Assertion 2: each leaf is traceable (has a leafRefSource entry)
    p1Leaves.forEach(leafId => {
      expect(rollup.leafRefSources).toHaveProperty(leafId);
    });

    // Assertion 3: leaf identity is correct (plain IDs, no formatting)
    expect(p1Leaves).toContain('proj-mobile-app'); // the Project itself
    expect(p1Leaves).toContain('deliv-ios-app'); // child Deliverable
    expect(p1Leaves).toContain('deliv-android-app'); // child Deliverable

    // Assertion 4: leafRefSources shows the parent linkage
    // proj-mobile-app is a top-level leaf (no parent Project)
    expect(rollup.leafRefSources['proj-mobile-app']).toBe(null);
    // Deliverables came through proj-mobile-app
    expect(rollup.leafRefSources['deliv-ios-app']).toBe('proj-mobile-app');
    expect(rollup.leafRefSources['deliv-android-app']).toBe('proj-mobile-app');

    // SECTION 2.1 VERIFICATION: "never terminal, always traceable"
    // Starting from the aggregate number "3 P1", we can reconstruct the exact leaf nodes:
    const reconstructedFromLeafRefs = p1Leaves.map(leafId => ({
      leafId,
      parent: rollup.leafRefSources[leafId],
      name: matrix.projectsById[leafId]?.name ||
            matrix.deliverablesById[leafId]?.name ||
            matrix.artifactsById[leafId]?.name,
      class: matrix.projectsById[leafId] ? 'Project' :
             matrix.deliverablesById[leafId] ? 'Deliverable' :
             matrix.artifactsById[leafId] ? 'Artifact' : '?',
    }));

    // Verify the reconstruction is complete and correct
    expect(reconstructedFromLeafRefs).toEqual([
      {
        leafId: 'proj-mobile-app',
        parent: null,
        name: 'Mobile App Launch',
        class: 'Project',
      },
      {
        leafId: 'deliv-ios-app',
        parent: 'proj-mobile-app',
        name: 'iOS App',
        class: 'Deliverable',
      },
      {
        leafId: 'deliv-android-app',
        parent: 'proj-mobile-app',
        name: 'Android App',
        class: 'Deliverable',
      },
    ]);

    // SIMILAR DRILL-DOWN FOR P2: verify traceability
    const p2Leaves = rollup.leafRefs.P2;
    const p2Count = rollup.leafCounts.P2;
    expect(p2Count).toBe(p2Leaves.length);

    // Each P2 leaf has traceability metadata
    p2Leaves.forEach(leafId => {
      expect(rollup.leafRefSources).toHaveProperty(leafId);
    });

    // P2 must include proj-analytics (at minimum)
    expect(p2Leaves).toContain('proj-analytics');
    expect(rollup.leafRefSources['proj-analytics']).toBe(null);

    // If there's an artifact, verify its parent linkage
    if (p2Leaves.includes('artifact-analytics-dashboard')) {
      expect(rollup.leafRefSources['artifact-analytics-dashboard']).toBe('proj-analytics');
    }

    // P3 is just the single project
    const p3Leaves = rollup.leafRefs.P3;
    const p3Count = rollup.leafCounts.P3;
    expect(p3Count).toBe(p3Leaves.length);
    expect(p3Leaves).toEqual(['proj-ai-research']);
    expect(rollup.leafRefSources['proj-ai-research']).toBe(null);

    // FINAL CHECK: orphaned Projects are surfaced as visible residuals
    // (none in this fixture, but the structure is there)
    expect(rollup.orphanedProjects).toEqual([]);

    console.log('✅ Drill-down spot-check PASSED');
    console.log(`   Aggregate: "${rollup.displaySummary}"`);
    console.log('   Traced to:');
    console.log(`     P1 (${p1Count}): ${p1Leaves.join(', ')}`);
    console.log(`     P2 (${p2Count}): ${p2Leaves.join(', ')}`);
    console.log(`     P3 (${p3Count}): ${p3Leaves.join(', ')}`);
    console.log('   Traceability: ✅ every leaf has leafRefSources entry');
    console.log('   Section 2.1 "never terminal, always traceable": ✅ VERIFIED');
  });
});
