import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadReferenceMatrix } from '../../src/domain/masterGrid/loadReferenceMatrix.js';

const fixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/reference_matrix_v1_4.json'), 'utf8'));

describe('loadReferenceMatrix edges + milestone (Gate 5 data layer)', () => {
  const m = loadReferenceMatrix(fixture, { nowISO: '2026-07-15T00:00:00Z' }).matrix;

  it('declares the Oct-17 convergence as a milestone with 4 lanes + a date derived from lane targets', () => {
    const oct = Object.values(m.milestonesById).find((x) => /Oct 17/.test(x.name));
    expect(oct).toBeTruthy();
    expect(oct.laneIds.length).toBe(4);
    expect(oct.date).toBe('2026-10-17'); // latest lane target_date (the convergence anchor)
  });

  it('declares typed relational links (ships_with / soundtrack_of) referencing declared nodes', () => {
    const links = Object.values(m.matrixLinksById);
    expect(links.length).toBeGreaterThan(0);
    const kinds = new Set(links.map((l) => l.kind));
    expect(kinds.has('ships_with')).toBe(true);
    expect(kinds.has('soundtrack_of')).toBe(true);
    const nodeIds = new Set([
      ...Object.keys(m.projectsById), ...Object.keys(m.artifactsById),
      ...Object.keys(m.initiativesById), ...Object.keys(m.entitiesById), ...Object.keys(m.systemsById),
    ]);
    for (const l of links) {
      expect(nodeIds.has(l.fromId)).toBe(true);
      expect(nodeIds.has(l.toId)).toBe(true);
    }
  });
});
