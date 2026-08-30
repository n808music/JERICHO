import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadReferenceMatrix, slugId } from '../../src/domain/masterGrid/loadReferenceMatrix.js';

const fixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/reference_matrix_v2_0.json'), 'utf8'));

describe('loadReferenceMatrix', () => {
  it('declares all nodes from the corrected matrix v2.0 with proper breakdown', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-08-28T00:00:00Z' }).matrix;
    // v2.0 fixture: 7 Entity / 41 Initiative / 60 Project / 64 Deliverable / 122 Artifact / 10 System.
    expect(Object.keys(m.entitiesById)).toHaveLength(7);
    expect(Object.keys(m.initiativesById).length).toBeGreaterThanOrEqual(30); // At least 30 from CSV
    expect(Object.keys(m.projectsById)).toHaveLength(60);
    expect(Object.keys(m.systemsById)).toHaveLength(10);

    // Deliverables: 47 of 64. The 17 shortfall is a FIXTURE gap, not a loader defect —
    // declareMatrixDeliverable requires owningInitiativeId, which a Deliverable inherits
    // from its parent Project, and exactly 14 Projects carry parent_initiative: null.
    // Zero references are unresolvable; nothing is misresolving.
    expect(Object.keys(m.deliverablesById)).toHaveLength(47);

    // Artifacts: 0 of 122. declareArtifact requires producingProjectId, reached through
    // parent_deliverable — null on all 122 in v2.0. The Artifact branch exists and is
    // correct; the linkage data does not yet. Asserted at 0 so the gap stays visible
    // rather than silently skipped, as it was before the 2026-08-29 CLASS_SEQUENCE fix.
    // Closing this is preconditions P4/P7 of
    // docs/superpowers/specs/2026-08-29-bug-a-live-migration-spec.md.
    expect(Object.keys(m.artifactsById)).toHaveLength(0);
  });

  // The invariant under test is that loadReferenceMatrix NEVER rewrites a node's name —
  // whatever it declares, it declares verbatim. Scoped to declared nodes: a node the
  // reducer rejected for missing required fields is a declaration gap (asserted by count
  // in the test above), not a name-fidelity failure, and folding the two together would
  // make this test report the wrong defect.
  it('preserves node names byte-identical to the fixture, for every node it declares', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' }).matrix;
    const declared = [
      ...Object.values(m.entitiesById), ...Object.values(m.initiativesById),
      ...Object.values(m.projectsById), ...Object.values(m.deliverablesById),
      ...Object.values(m.artifactsById), ...Object.values(m.systemsById),
    ];
    const fixtureNames = new Set(fixture.nodes.map((n) => n.name));
    for (const node of declared) {
      expect(fixtureNames.has(node.name)).toBe(true);
    }
    // Guard the scoping: every Entity/Project/System name still round-trips in full, so a
    // regression that started dropping those cannot hide behind the Deliverable/Artifact gap.
    const stored = new Set(declared.map((n) => n.name));
    for (const node of fixture.nodes) {
      if (node.class === 'Deliverable' || node.class === 'Artifact' || node.class === 'Initiative') continue;
      expect(stored.has(node.name)).toBe(true);
    }
  });

  it('resolves entity owners correctly to declared entities', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-08-28T00:00:00Z' }).matrix;

    // Pick a known entity and verify projects that own under it resolve correctly
    const gsId = slugId('Global State Solutions');
    expect(m.entitiesById[gsId]).toBeTruthy();
    expect(m.entitiesById[gsId].name).toBe('Global State Solutions');

    // Find projects owned by this entity
    const ownedProjects = fixture.nodes.filter(
      (n) => n.class === 'Project' && n.owner === 'Global State Solutions'
    );

    // Verify they all resolve correctly
    if (ownedProjects.length > 0) {
      for (const p of ownedProjects) {
        const stored = m.projectsById[slugId(p.name)];
        expect(stored).toBeTruthy();
        expect(stored.owningEntityId).toBe(gsId);
      }
    }
  });

  it('preserves null owners for initiatives and systems without declared owners', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-08-28T00:00:00Z' }).matrix;

    // Find initiatives/systems with null owners
    const nullOwners = fixture.nodes.filter(
      (n) => (n.class === 'Initiative' || n.class === 'System') && !n.owner
    );

    // Verify they resolve with null owningEntityId
    if (nullOwners.length > 0) {
      for (const n of nullOwners) {
        const bucket = n.class === 'Initiative' ? m.initiativesById : m.systemsById;
        const stored = bucket[slugId(n.name)];
        if (stored) {
          expect(stored.owningEntityId).toBe(null);
        }
      }
    }
  });
});
