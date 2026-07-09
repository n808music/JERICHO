import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadReferenceMatrix } from '../../src/domain/masterGrid/loadReferenceMatrix.js';

const fixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/reference_matrix_v1_4.json'), 'utf8'));

describe('loadReferenceMatrix', () => {
  it('declares all 53 nodes with the 7/11/17/12/6 breakdown', () => {
    const m = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' }).matrix;
    expect(Object.keys(m.entitiesById)).toHaveLength(7);
    expect(Object.keys(m.initiativesById)).toHaveLength(11);
    expect(Object.keys(m.projectsById)).toHaveLength(17);
    expect(Object.keys(m.artifactsById)).toHaveLength(12);
    expect(Object.keys(m.systemsById)).toHaveLength(6);
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
});
