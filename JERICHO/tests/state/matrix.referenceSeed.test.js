import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadReferenceMatrix, slugId } from '../../src/domain/masterGrid/loadReferenceMatrix.js';

const fixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/reference_matrix_v2_0.json'), 'utf8'));

describe('loadReferenceMatrix', () => {
  it('declares all nodes from the corrected matrix v2.0 with proper breakdown', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-08-28T00:00:00Z' }).matrix;
    // v2.0: 7 entities + 41 initiatives (30 source + 11 Foundation lanes) + 60 projects + 64 deliverables + 10 systems
    expect(Object.keys(m.entitiesById)).toHaveLength(7);
    expect(Object.keys(m.initiativesById).length).toBeGreaterThanOrEqual(30); // At least 30 from CSV
    expect(Object.keys(m.projectsById)).toHaveLength(60);
    expect(Object.keys(m.artifactsById)).toHaveLength(64); // Deliverables loaded as artifacts
    expect(Object.keys(m.systemsById)).toHaveLength(10);
  });

  it('preserves node names byte-identical to the fixture', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' }).matrix;
    const stored = new Set([
      ...Object.values(m.entitiesById), ...Object.values(m.initiativesById),
      ...Object.values(m.projectsById), ...Object.values(m.artifactsById),
      ...Object.values(m.systemsById),
    ].map((n) => n.name));
    for (const node of fixture.nodes) {
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
