// tests/state/masterGrid.acceptance.test.jsx
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadReferenceMatrix, slugId } from '../../src/domain/masterGrid/loadReferenceMatrix.js';
import { selectMasterGridRows, countByClass } from '../../src/domain/masterGrid/masterGridSelectors.js';
import { buildPersistableIdentityState, rehydratePersistedState } from '../../src/state/identityStore.js';

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
    // Persist: route through the real projection written to localStorage['jericho-identity'].
    const blob = JSON.stringify(buildPersistableIdentityState(seeded));
    // Relaunch: route through the real version-gated rehydrate on reload.
    const rehydrated = rehydratePersistedState(JSON.parse(blob));
    const counts = countByClass(selectMasterGridRows(rehydrated.matrix));
    expect(counts.total).toBe(53);
  });

  // AC7 (2026-07-16 seed-fidelity gate): the per-profile store built from the reference matrix
  // must carry EVERY node's canonical phase attestation verbatim — no silent loss. A dropped
  // phase (as happened when a seed builder nulled raw phase) makes the resolver fall through to
  // inheritance and render a phase that contradicts canon. This node-by-node diff is the cheap
  // standing guard that surfaces such loss at the boundary instead of by eye on a screenshot.
  it('AC7: seed fidelity — every reference node phase is carried verbatim into the store', () => {
    const { matrix } = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' });
    const byId = {
      ...matrix.entitiesById, ...matrix.initiativesById, ...matrix.projectsById,
      ...matrix.artifactsById, ...matrix.systemsById,
    };
    const mismatches = [];
    for (const node of fixture.nodes) {
      const stored = byId[slugId(node.name)];
      const canonPhase = node.phase ?? null;
      const storedPhase = stored ? stored.phase ?? null : '(node missing)';
      if (String(storedPhase) !== String(canonPhase)) {
        mismatches.push(`${node.name}: canon=${JSON.stringify(canonPhase)} stored=${JSON.stringify(storedPhase)}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
