import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadReferenceMatrix, slugId } from './loadReferenceMatrix.js';
import { selectGridNodes, phaseGridFromStore } from './phaseGridFromStore.js';
import { sortByPhase } from './phaseSort.js';

const fixture = JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/reference_matrix_v1_4.json'), 'utf8'));
const matrix = () => loadReferenceMatrix(fixture, { nowISO: '2026-07-15T00:00:00Z' }).matrix;

describe('selectGridNodes — grid default-tier rule (allProjects ∪ promoted lane deliverables)', () => {
  it('derives exactly 18 from the reference store: 17 projects + the Patent deliverable', () => {
    const nodes = selectGridNodes(matrix());
    expect(nodes.length).toBe(18);
    expect(nodes.filter((n) => n.primaryClass === 'Project').length).toBe(17);
    const promoted = nodes.filter((n) => n.primaryClass === 'Deliverable');
    expect(promoted.map((n) => n.name)).toEqual(['Behavioral Execution Engine Patent']);
  });

  it('CAUSALITY: Patent is in the grid BECAUSE it is a lane whose parent is already claimed', () => {
    const m = matrix();
    const patentId = slugId('Behavioral Execution Engine Patent');
    // with Patent as a lane → present
    expect(selectGridNodes(m).some((n) => n.id === patentId)).toBe(true);
    // remove Patent from the Oct-17 milestone lanes → parent Jericho 1.0 no longer double-claimed → Patent NOT promoted → drops
    for (const ms of Object.values(m.milestonesById)) ms.laneIds = ms.laneIds.filter((id) => id !== patentId);
    const after = selectGridNodes(m);
    expect(after.some((n) => n.id === patentId)).toBe(false);
    expect(after.length).toBe(17);
  });

  it('a non-lane deliverable is absent (grid is not a hand list of all deliverables)', () => {
    const nonLaneDeliverable = slugId('State of Control pt. 3'); // a deliverable, not a milestone lane
    expect(selectGridNodes(matrix()).some((n) => n.id === nonLaneDeliverable)).toBe(false);
  });
});

// ③ acceptance: store-sourced phase groups byte-match demoV2 ORDER with FIXTURE-CANONICAL
// verbatim titles (operator ruling). Order is the invariant demoV2 encodes; casing is
// canonicalized to the source of truth. Titles are guarded against the fixture (condition 2:
// no independently-typed third copy of these strings).
describe('phaseGridFromStore → sortByPhase (③④⑤ from canonical store)', () => {
  const r = sortByPhase(...(({ gridTitles, matrix: mtx }) => [gridTitles, mtx])(phaseGridFromStore(matrix())));
  const P1 = r.phases.get(1).map((p) => p.fixtureTitle);
  const P2 = r.phases.get(2).map((p) => p.fixtureTitle);
  const P3 = r.phases.get(3).map((p) => p.fixtureTitle);

  it('③ phase 1 — demoV2 order, canonical titles', () => {
    expect(P1).toEqual([
      'email-capture container',
      'HYS Broadcast — Season 1',
      'Behavioral Execution Engine Patent',
      'Jericho 1.0 build',
      'OUR FEARLESS LEADER 3: Romance Riot',
      'OUR FEARLESS LEADER 4: PAINKILLERS',
      'OUR FEARLESS LEADER 5: CORONATION',
      'OUR FEARLESS LEADER 6: SAVIOR',
      'OUR FEARLESS LEADER 7: SACRIFICE',
      'State of Control pts. 1–5',
    ]);
  });

  it('③ phase 2 + phase 3 — demoV2 order, canonical titles', () => {
    expect(P2).toEqual(['MAX CLOUT trilogy', 'SEEDS OF DESTRUCTION TRILOGY', 'Energy Gum']);
    expect(P3).toEqual([
      'First Building (79th Street) — HQ + Academy', 'Desiree', 'I AM THE STATE (album)',
      'Academy #1 launch', 'Alternative Smoke Pens',
    ]);
  });

  it('⑤ the Oct-17 milestone stars exactly its four lanes', () => {
    const starred = r.phases.get(1).filter((p) => p.milestones).map((p) => p.fixtureTitle).sort();
    expect(starred).toEqual([
      'Behavioral Execution Engine Patent', 'HYS Broadcast — Season 1',
      'Jericho 1.0 build', 'OUR FEARLESS LEADER 3: Romance Riot',
    ]);
  });

  it('④ residual = exactly 3 TBD questions (Energy Gum, Smoke Pens, Academy #1)', () => {
    expect(r.questions.map((q) => q.code)).toEqual(['RESIDUAL-DATE', 'RESIDUAL-DATE', 'RESIDUAL-DATE']);
  });

  it('guard: every asserted ③ title exists verbatim in the fixture (no third-copy drift)', () => {
    const fixtureNames = new Set(fixture.nodes.map((n) => n.name));
    for (const t of [...P1, ...P2, ...P3]) expect(fixtureNames.has(t)).toBe(true);
  });
});
