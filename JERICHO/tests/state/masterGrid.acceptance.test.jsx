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
  //
  // NARROWED 2026-08-23 (E16): Initiative is excluded, because an Initiative now has no Phase by
  // doctrine — the v1.4 workbook's 11 attested Initiative phases are deliberately not stored.
  // That exclusion was checked, not assumed: for the 9 of 11 Initiatives that own at least one
  // Project, the "earliest computed sub-unit Phase" rollup over owned Projects reproduces the
  // workbook's attested value EXACTLY (9/9, zero mismatches), so nothing is lost by dropping the
  // stored field. The 2 that own no Projects — "The Imaginary CEO" and "Oct 17 2026 Convergence",
  // both attested 1 — have no derivable source and become genuine residuals. That is the intended
  // behaviour (an Initiative with no work under it should surface as an open question, not a
  // confident P1), and it is the full extent of the information given up here.
  it('AC7: seed fidelity — every non-Initiative reference node phase is carried verbatim', () => {
    const { matrix } = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' });
    const byId = {
      ...matrix.entitiesById, ...matrix.initiativesById, ...matrix.projectsById,
      ...matrix.artifactsById, ...matrix.systemsById,
    };
    const mismatches = [];
    for (const node of fixture.nodes) {
      if (node.class === 'Initiative') continue;
      const stored = byId[slugId(node.name)];
      const canonPhase = node.phase ?? null;
      const storedPhase = stored ? stored.phase ?? null : '(node missing)';
      if (String(storedPhase) !== String(canonPhase)) {
        mismatches.push(`${node.name}: canon=${JSON.stringify(canonPhase)} stored=${JSON.stringify(storedPhase)}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  // The other half of the narrowed AC7: dropping Initiative phase must be enforced, not merely
  // un-asserted. The v1.4 fixture attests a phase on all 11 Initiatives and loadReferenceMatrix
  // still passes `phase` through its shared `common` payload, so this is a live write attempt on
  // every seed load — exactly the path that must stay closed (E16).
  it('AC7b: no Initiative carries a phase, even though the seed attests one for all 11', () => {
    const { matrix } = loadReferenceMatrix(fixture, { nowISO: '2026-07-08T00:00:00Z' });
    const seedAttested = fixture.nodes.filter((n) => n.class === 'Initiative' && n.phase != null);
    expect(seedAttested.length).toBe(11);
    const leaked = Object.values(matrix.initiativesById).filter((i) => 'phase' in i);
    expect(leaked.map((i) => i.name)).toEqual([]);
  });
});
