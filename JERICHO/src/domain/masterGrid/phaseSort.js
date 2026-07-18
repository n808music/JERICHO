// Phase-primary sort for the Master Grid (doctrine v2, 2026-07-14).
//   PRIMARY KEY   — attested phase category (1/2/3), toward the 2031 terminal.
//   SECONDARY KEY — deadline within the phase. A period target ("2026",
//                   "2028-2030") means "due by the END of that period", so its
//                   key is the period's last day. TBD sinks to phase bottom.
//   TERTIARY KEY  — title (deterministic tiebreak).
// Mutual links are annotated as convergence ties on both rows — no precedence
// is invented. Named convergences render as milestone annotations (not ties,
// not sort keys). Residue = TBD dates, cross-tab discrepancies, phantom grid
// duplicates, and unresolved milestone lanes — surfaced, never guessed.
//
// This is the pure gate-layer library, faithful to the proven reference
// (referencePhaseMatrix.js is a fixture; the store adapter feeds real data).

export function normalize(s) {
  return String(s).replace(/"/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
}

export function deadlineKey(target) {
  if (!target || /TBD/i.test(target)) return '9999-12-31';
  const s = String(target);
  // Tolerant extraction (fixture targets can be messy, e.g. "2026-2027 (pt. 1 by 2026-10-17)").
  // Priority: YYYY-YYYY period → end year; full ISO date → itself; bare/leading YYYY → end year.
  // Byte-identical to the strict form on clean inputs ("2026", "2028-2030", "2026-10-17").
  const range = s.match(/(\d{4})\s*[-–]\s*(\d{4})/);
  if (range) return `${range[2]}-12-31`;
  const iso = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const year = s.match(/(\d{4})/);
  if (year) return `${year[1]}-12-31`;
  return s;
}

export function sortByPhase(gridTitles, matrix) {
  const alias = (k) => matrix.aliases?.[k] ?? k;
  const rows = new Map(matrix.rows.map((r) => [normalize(r.title), r]));

  const placed = [];
  const unmatched = [];
  const gridToFixture = new Map();
  for (const g of gridTitles) {
    const key = alias(normalize(g));
    if (rows.has(key)) gridToFixture.set(key, [...(gridToFixture.get(key) ?? []), g]);
    else unmatched.push(g);
  }

  for (const [key, gridNames] of gridToFixture) {
    const r = rows.get(key);
    placed.push({
      fixtureTitle: r.title,
      gridNames,
      phase: r.phase,
      target: r.target,
      targetNote: r.targetNote ?? null,
      deadline: deadlineKey(r.target),
      tbd: /TBD/i.test(r.target ?? 'TBD'),
      links: r.links ?? [],
      crossTab: r.crossTab ?? null,
      provenance: r.provenance,
    });
  }

  // mutual-link detection -> convergence tie annotation
  for (const a of placed) {
    for (const l of a.links) {
      const b = placed.find((p) => normalize(p.fixtureTitle) === normalize(l.to));
      if (b && b.links.some((bl) => normalize(bl.to) === normalize(a.fixtureTitle))) {
        a.tieWith = a.tieWith ?? [];
        if (!a.tieWith.includes(b.fixtureTitle)) a.tieWith.push(b.fixtureTitle);
      }
    }
  }

  // milestone annotation — named convergences. NOT a tie, NOT a sort key:
  // each lane keeps its own deadline; this stamps membership + surfaces a
  // residual question if a named lane isn't in the grid.
  const milestones = (matrix.milestones ?? []).map((m) => ({
    name: m.name,
    date: m.date,
    provenance: m.provenance ?? null,
    lanes: m.lanes.map((laneTitle) => {
      const row = placed.find((p) => normalize(p.fixtureTitle) === normalize(laneTitle));
      if (row) {
        row.milestones = row.milestones ?? [];
        if (!row.milestones.some((x) => x.name === m.name)) row.milestones.push({ name: m.name, date: m.date });
        return { title: row.fixtureTitle, present: true, ownDeadline: row.deadline };
      }
      return { title: laneTitle, present: false, ownDeadline: null };
    }),
  }));

  // Defensive floor (second line behind ingest validation): any row whose phase is not
  // canonical 1/2/3 goes to the residual bucket, never `phases.get(<unknown>).push` — a
  // raw TypeError at render depth is never an acceptable way to discover a data problem.
  const phases = new Map([[1, []], [2, []], [3, []]]);
  const residual = [];
  for (const p of placed) {
    const bucket = phases.get(p.phase);
    if (bucket) bucket.push(p);
    else residual.push(p);
  }
  for (const list of phases.values()) {
    list.sort((a, b) =>
      a.deadline !== b.deadline ? a.deadline.localeCompare(b.deadline) : a.fixtureTitle.localeCompare(b.fixtureTitle));
  }

  const residualSet = new Set(residual);
  const questions = [];
  for (const p of placed) {
    if (residualSet.has(p)) {
      questions.push({
        code: 'RESIDUAL-PHASE',
        probe: `"${p.fixtureTitle}" has no attested phase (raw: ${p.phase === null || p.phase === undefined ? 'absent' : JSON.stringify(p.phase)}). Assign phase 1, 2, or 3, or confirm it stays in the residual bucket.`,
      });
      continue;
    }
    if (p.crossTab) questions.push({
      code: 'FIXTURE-DISCREPANCY',
      probe: `"${p.fixtureTitle}": PROJECTS target is ${p.target}, DELIVERABLES target is ${p.crossTab.deliverablesTarget}. Which does the fixture attest? (${p.provenance})`,
    });
    else if (p.tbd) questions.push({
      code: 'RESIDUAL-DATE',
      probe: `"${p.fixtureTitle}" is phase ${p.phase} with target TBD${p.targetNote ? ` (${p.targetNote})` : ''}. Attest a target or confirm it sorts to phase-${p.phase} bottom.`,
    });
  }
  for (const [key, names] of gridToFixture) {
    if (names.length > 1) questions.push({
      code: 'GRID-PHANTOM',
      probe: `Grid rows ${names.join(' and ')} both resolve to fixture node "${rows.get(key).title}". Reconcile the grid.`,
    });
  }
  for (const m of milestones) {
    for (const lane of m.lanes) {
      if (!lane.present) questions.push({
        code: 'MILESTONE-LANE-MISSING',
        probe: `Milestone "${m.name}" (${m.date}) names lane "${lane.title}" but no grid node resolves to it. Add the node or correct the milestone.`,
      });
    }
  }

  const advisories = [];
  for (const p of placed) {
    if (p.tbd) continue;
    const yr = Number(p.deadline.slice(0, 4));
    if (p.phase === 3 && yr <= 2030) advisories.push(
      `"${p.fixtureTitle}" is phase 3 but dated ${p.target} (inside phase 2's window). Phase category wins; flagged only.`);
    if (p.phase === 2 && yr <= 2027) advisories.push(
      `"${p.fixtureTitle}" is phase 2 but dated ${p.target} (inside phase 1's window). Phase category wins; flagged only.`);
  }

  return { phases, residual, questions, advisories, unmatched, milestones };
}
