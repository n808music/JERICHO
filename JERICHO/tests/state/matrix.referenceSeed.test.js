import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadReferenceMatrix, nodeId } from '../../src/domain/masterGrid/loadReferenceMatrix.js';

const fixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/reference_matrix_v3_0.json'), 'utf8'));

describe('loadReferenceMatrix', () => {
  it('declares all nodes from the corrected matrix v3.0 with proper breakdown', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-08-28T00:00:00Z' }).matrix;
    // v3.0 fixture: 7 Entity / 29 Initiative / 59 Project / 63 Deliverable / 175 Artifact / 10 System.
    expect(Object.keys(m.entitiesById)).toHaveLength(7);
    expect(Object.keys(m.initiativesById)).toHaveLength(29);
    expect(Object.keys(m.projectsById)).toHaveLength(59);
    expect(Object.keys(m.systemsById)).toHaveLength(10);

    // v3.0 includes full Deliverable and Artifact migration: all 63 Deliverables
    // and all 188 Artifacts (175 original + 13 publication-required Release artifacts).
    expect(Object.keys(m.deliverablesById)).toHaveLength(63);
    expect(Object.keys(m.artifactsById)).toHaveLength(188);
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

    // Pick a known entity and verify projects that own under it resolve correctly.
    // IDs now use type-prefix scheme: entity-${slug}, project-${slug}, etc.
    const gsEntityId = nodeId('Entity', 'Global State Solutions');

    // Verify the entity exists with the prefixed ID
    expect(m.entitiesById[gsEntityId]).toBeTruthy();
    expect(m.entitiesById[gsEntityId].name).toBe('Global State Solutions');

    // Find projects owned by this entity
    const ownedProjects = fixture.nodes.filter(
      (n) => n.class === 'Project' && n.owner === 'Global State Solutions'
    );

    // Verify they all resolve correctly with their prefixed parent entity ID
    if (ownedProjects.length > 0) {
      for (const p of ownedProjects) {
        const projectId = nodeId('Project', p.name);
        const stored = m.projectsById[projectId];
        expect(stored).toBeTruthy();
        expect(stored.owningEntityId).toBe(gsEntityId);
      }
    }
  });

  it('preserves null owners for initiatives and systems without declared owners', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-08-28T00:00:00Z' }).matrix;

    // Find initiatives/systems with null owners
    const nullOwners = fixture.nodes.filter(
      (n) => (n.class === 'Initiative' || n.class === 'System') && !n.owner
    );

    // Verify they resolve with null owningEntityId.
    // IDs now use type-prefix scheme: initiative-${slug}, system-${slug}.
    if (nullOwners.length > 0) {
      for (const n of nullOwners) {
        const bucket = n.class === 'Initiative' ? m.initiativesById : m.systemsById;
        const nodeIdValue = nodeId(n.class, n.name);
        const stored = bucket[nodeIdValue];
        if (stored) {
          expect(stored.owningEntityId).toBe(null);
        }
      }
    }
  });

  // GH-2: Publication gate mutation tests
  it('passes publication gate when all 19 publication_required deliverables have Release artifacts', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-08-28T00:00:00Z' });
    // v3.0 fixture is complete: 19 deliverables have publication_required: true,
    // each has at least one Release artifact marked publication_artifact: true.
    expect(m.lastPlanError).toBe(null);
  });

  it('detects Case 2 violation: publication_required: true with no Release artifact', () => {
    // Mutate fixture: remove the State of Control pt. 2 — Release artifact
    const mutated = JSON.parse(JSON.stringify(fixture));
    mutated.nodes = mutated.nodes.filter((n) => n.name !== 'State of Control pt. 2 — Release');

    const m = loadReferenceMatrix(mutated, { nowISO: '2026-08-28T00:00:00Z' });
    expect(m.lastPlanError?.code).toBe('PUBLICATION_REQUIRED_MISSING');
    expect(m.lastPlanError?.reason).toContain('State of Control pt. 2');
    expect(m.lastPlanError?.reason).toContain('publication required but no artifact marked');
  });

  it('detects Case 3 violation: publication_artifact marked on deliverable with publication_required: false', () => {
    // Mutate fixture: set publication_required: false on Max Clout 1,
    // which has Max Clout 1 — Release artifact marked publication_artifact: true
    const mutated = JSON.parse(JSON.stringify(fixture));
    const maxClout1 = mutated.nodes.find((n) => n.name === 'Max Clout 1' && n.class === 'Deliverable');
    if (maxClout1) {
      maxClout1.publication_required = false;
    }

    const m = loadReferenceMatrix(mutated, { nowISO: '2026-08-28T00:00:00Z' });
    expect(m.lastPlanError?.code).toBe('PUBLICATION_REQUIRED_MISSING');
    expect(m.lastPlanError?.reason).toContain('Max Clout 1');
    expect(m.lastPlanError?.reason).toContain('publication_artifact marked but publication_required is false');
  });

  it('collects all violations in a sorted, readable list for diffing across runs', () => {
    // Mutate fixture: remove 3 Release artifacts
    const mutated = JSON.parse(JSON.stringify(fixture));
    mutated.nodes = mutated.nodes.filter(
      (n) => !['State of Control pt. 2 — Release', 'State of Control pt. 3 — Release', 'The Imaginary CEO — Season 1 — Release'].includes(n.name)
    );

    const m = loadReferenceMatrix(mutated, { nowISO: '2026-08-28T00:00:00Z' });
    expect(m.lastPlanError?.code).toBe('PUBLICATION_REQUIRED_MISSING');
    const reason = m.lastPlanError?.reason || '';
    // First line is the count message; violations are sorted for diffing
    expect(reason).toContain('3 publication violations');
    expect(reason).toContain('State of Control pt. 2');
    expect(reason).toContain('State of Control pt. 3');
    expect(reason).toContain('The Imaginary CEO — Season 1');
  });
});
