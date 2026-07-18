import { describe, it, expect } from 'vitest';
import { sortByPhase, deadlineKey, normalize } from './phaseSort.js';
import { REFERENCE_PHASE_MATRIX, REFERENCE_GRID_TITLES } from './referencePhaseMatrix.js';

// Regression baseline: the in-repo sorter must reproduce the proven demoV2 output
// byte-for-byte from the reference matrix — this is acceptance property (c).
describe('phaseSort (phase-primary, deadline-within-phase)', () => {
  const r = sortByPhase(REFERENCE_GRID_TITLES, REFERENCE_PHASE_MATRIX);

  it('matches every grid title (18/18, zero unmatched)', () => {
    expect(r.unmatched).toEqual([]);
    const total = r.phases.get(1).length + r.phases.get(2).length + r.phases.get(3).length;
    expect(total).toBe(18);
  });

  it('phase 1 order is byte-identical to the demoV2 baseline', () => {
    expect(r.phases.get(1).map((p) => p.fixtureTitle)).toEqual([
      'EMAIL-CAPTURE CONTAINER',
      'HYS BROADCAST - SEASON 1',
      'BEHAVIORAL EXECUTION ENGINE PATENT',
      'JERICHO 1.0',
      'OUR FEARLESS LEADER 3: ROMANCE RIOT',
      'OUR FEARLESS LEADER 4: PAINKILLERS',
      'OUR FEARLESS LEADER 5: CORONATION',
      'OUR FEARLESS LEADER 6: SAVIOR',
      'OUR FEARLESS LEADER 7: SACRIFICE',
      'STATE OF CONTROL PTS. 1-5',
    ]);
  });

  it('phase 2 and phase 3 orders match the baseline', () => {
    expect(r.phases.get(2).map((p) => p.fixtureTitle)).toEqual([
      'MAX CLOUT TRILOGY', 'SEEDS OF DESTRUCTION TRILOGY', 'ENERGY GUM',
    ]);
    expect(r.phases.get(3).map((p) => p.fixtureTitle)).toEqual([
      'FIRST BUILDING (79TH STREET) - HQ + ACADEMY', 'DESIREE', 'I AM THE STATE',
      'ACADEMY #1 LAUNCH', 'ALTERNATIVE SMOKE PENS',
    ]);
  });

  it('mutual links render as ties, not precedence (Seeds <-> Max Clout, no IATS edge)', () => {
    const seeds = r.phases.get(2).find((p) => /SEEDS/.test(p.fixtureTitle));
    expect(seeds.tieWith).toEqual(['MAX CLOUT TRILOGY']);
  });

  it('Oct-17 milestone annotates its four lanes without collapsing their deadlines', () => {
    const oct17 = r.milestones.find((m) => /Oct 17/.test(m.name));
    expect(oct17.lanes.every((l) => l.present)).toBe(true);
    expect(Object.fromEntries(oct17.lanes.map((l) => [l.title, l.ownDeadline]))).toEqual({
      'OUR FEARLESS LEADER 3: ROMANCE RIOT': '2026-10-17',
      'JERICHO 1.0': '2026-10-17',
      'HYS BROADCAST - SEASON 1': '2026-08-08',
      'BEHAVIORAL EXECUTION ENGINE PATENT': '2026-09-11',
    });
  });

  it('residual = Energy Gum cross-tab + 2 TBDs; a non-lane row carries no milestone', () => {
    const codes = r.questions.map((q) => q.code).sort();
    expect(codes).toEqual(['FIXTURE-DISCREPANCY', 'RESIDUAL-DATE', 'RESIDUAL-DATE']);
    const ofl4 = r.phases.get(1).find((p) => /PAINKILLERS/.test(p.fixtureTitle));
    expect(ofl4.milestones).toBeUndefined();
  });

  it('deadlineKey reads a period target as its last day; TBD sinks', () => {
    expect(deadlineKey('2026')).toBe('2026-12-31');
    expect(deadlineKey('2028-2030')).toBe('2030-12-31');
    expect(deadlineKey('2026-10-17')).toBe('2026-10-17');
    expect(deadlineKey('TBD')).toBe('9999-12-31');
    expect(normalize('"Head Quarters"')).toBe('HEAD QUARTERS');
  });
});

// Off-canonical phase resilience (2026-07-16 ruling). render depth 10 is never an
// acceptable place to discover a data problem. sortByPhase must route any row whose
// phase is not 1/2/3 into a residual bucket — a legitimate absent phase (the two-gap
// model made visible) OR a defensive catch for corruption that slipped past ingest —
// never a raw TypeError from phases.get(<unknown>).push.
describe('phaseSort — off-canonical phase never crashes render (residual floor)', () => {
  it('absent phase (undefined) → residual group + RESIDUAL-PHASE question, no throw', () => {
    const matrix = { rows: [{ title: 'Unphased Node', phase: undefined, target: '2026' }], milestones: [], aliases: {} };
    const r = sortByPhase(['Unphased Node'], matrix);
    expect(r.residual.map((p) => p.fixtureTitle)).toEqual(['Unphased Node']);
    expect(r.phases.get(1).length + r.phases.get(2).length + r.phases.get(3).length).toBe(0);
    expect(r.questions.map((q) => q.code)).toContain('RESIDUAL-PHASE');
  });

  it('defensive floor: a non-canonical phase key (7) reaching sort → residual, never a TypeError', () => {
    const matrix = { rows: [{ title: 'Corrupt Node', phase: 7, target: '2027' }], milestones: [], aliases: {} };
    const r = sortByPhase(['Corrupt Node'], matrix);
    expect(r.residual.map((p) => p.fixtureTitle)).toEqual(['Corrupt Node']);
    expect(r.questions.map((q) => q.code)).toContain('RESIDUAL-PHASE');
  });

  it('canonical rows are unaffected — residual stays empty', () => {
    const matrix = {
      rows: [{ title: 'Real Node', phase: 1, target: '2026' }],
      milestones: [], aliases: {},
    };
    const r = sortByPhase(['Real Node'], matrix);
    expect(r.residual).toEqual([]);
    expect(r.phases.get(1).map((p) => p.fixtureTitle)).toEqual(['Real Node']);
  });
});
