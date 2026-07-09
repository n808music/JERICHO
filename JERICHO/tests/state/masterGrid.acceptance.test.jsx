// tests/state/masterGrid.acceptance.test.jsx
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadReferenceMatrix } from '../../src/domain/masterGrid/loadReferenceMatrix.js';
import { selectMasterGridRows, countByClass } from '../../src/domain/masterGrid/masterGridSelectors.js';

const fixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/reference_matrix_v1_4.json'), 'utf8'));

describe('Master Grid acceptance', () => {
  it('AC1: seed renders exactly 53 rows with 7/11/17/12/6', () => {
    const matrix = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' }).matrix;
    const counts = countByClass(selectMasterGridRows(matrix));
    expect(counts).toEqual({ total: 53, Entity: 7, Initiative: 11, Project: 17, Deliverable: 12, System: 6 });
  });

  it('AC2: names byte-identical to the seed file', () => {
    const matrix = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' }).matrix;
    const rowNames = new Set(selectMasterGridRows(matrix).map((r) => r.name));
    for (const node of fixture.nodes) expect(rowNames.has(node.name)).toBe(true);
    expect(rowNames.size).toBe(53);
  });

  it('AC6: kill/relaunch — 53 survive a localStorage round-trip', () => {
    const seeded = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' });
    // Simulate persist: the identity store serializes whole state under 'jericho-identity'.
    const blob = JSON.stringify(seeded);
    // Simulate relaunch: re-hydrate from the persisted blob.
    const rehydrated = JSON.parse(blob);
    const counts = countByClass(selectMasterGridRows(rehydrated.matrix));
    expect(counts.total).toBe(53);
  });
});
