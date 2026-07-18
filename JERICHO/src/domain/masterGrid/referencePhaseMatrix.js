// Reference transcription of Global_State_Enterprise_Reference_v1_4 (PROJECTS +
// DELIVERABLES tabs). A FIXTURE, not an authored seed: every row maps to a
// visible workbook row. The live store adapter supersedes this at runtime; this
// exists as the byte-for-byte regression baseline for phaseSort and as a
// fallback data source. Phase 1/2/3 = attested coarse category toward the 2031
// terminal; target date orders within a phase. Milestones = attested `converges`
// edges (named, dated) — annotations, not ties or sort keys.

export const REFERENCE_PHASE_MATRIX = {
  meta: { terminalDeadline: '2031', source: 'Global_State_Enterprise_Reference_v1_4, transcribed 2026-07-14' },
  rows: [
    { title: 'OUR FEARLESS LEADER 3: ROMANCE RIOT', phase: 1, target: '2026-10-17',
      links: [{ kind: 'ships_with', to: 'STATE OF CONTROL PTS. 1-5' }], provenance: 'PROJECTS row 2' },
    { title: 'OUR FEARLESS LEADER 4: PAINKILLERS', phase: 1, target: '2026',
      links: [{ kind: 'ships_with', to: 'STATE OF CONTROL PTS. 1-5' }], provenance: 'PROJECTS row 3' },
    { title: 'OUR FEARLESS LEADER 5: CORONATION', phase: 1, target: '2027',
      links: [{ kind: 'ships_with', to: 'STATE OF CONTROL PTS. 1-5' }], provenance: 'PROJECTS row 4' },
    { title: 'OUR FEARLESS LEADER 6: SAVIOR', phase: 1, target: '2027',
      links: [{ kind: 'ships_with', to: 'STATE OF CONTROL PTS. 1-5' }], provenance: 'PROJECTS row 5' },
    { title: 'OUR FEARLESS LEADER 7: SACRIFICE', phase: 1, target: '2027',
      links: [{ kind: 'ships_with', to: 'STATE OF CONTROL PTS. 1-5' }], provenance: 'PROJECTS row 6' },
    { title: 'STATE OF CONTROL PTS. 1-5', phase: 1, target: '2026-2027', targetNote: 'pt. 1 by 2026-10-17',
      links: [{ kind: 'ships_with', to: 'OUR FEARLESS LEADER 3: ROMANCE RIOT' }], provenance: 'PROJECTS row 7' },
    { title: 'MAX CLOUT TRILOGY', phase: 2, target: '2028-2030',
      links: [{ kind: 'soundtrack_of', to: 'SEEDS OF DESTRUCTION TRILOGY' }, { kind: 'promo_convergence', to: 'ENERGY GUM' }],
      provenance: 'PROJECTS row 8' },
    { title: 'SEEDS OF DESTRUCTION TRILOGY', phase: 2, target: '2028-2030',
      links: [{ kind: 'soundtrack_of', to: 'MAX CLOUT TRILOGY' }], provenance: 'PROJECTS row 9' },
    { title: 'DESIREE', phase: 3, target: '2031',
      links: [{ kind: 'contribution', to: 'I AM THE STATE' }], provenance: 'PROJECTS row 10' },
    { title: 'I AM THE STATE', phase: 3, target: '2031',
      links: [{ kind: 'contribution', to: 'DESIREE' }], provenance: 'PROJECTS row 11' },
    { title: 'JERICHO 1.0', phase: 1, target: '2026-10-17', links: [], provenance: 'PROJECTS row 12' },
    { title: 'HYS BROADCAST - SEASON 1', phase: 1, target: '2026-08-08', links: [], provenance: 'PROJECTS row 13' },
    { title: 'ENERGY GUM', phase: 2, target: 'TBD',
      crossTab: { deliverablesTarget: '2029', note: 'PROJECTS says TBD; DELIVERABLES row 14 says 2029 — unresolved discrepancy' },
      links: [{ kind: 'promo_convergence', to: 'MAX CLOUT TRILOGY' }], provenance: 'PROJECTS row 14 + DELIVERABLES row 14' },
    { title: 'ALTERNATIVE SMOKE PENS', phase: 3, target: 'TBD', links: [], provenance: 'PROJECTS row 15' },
    { title: 'EMAIL-CAPTURE CONTAINER', phase: 1, target: '2026-08-08', links: [], provenance: 'PROJECTS row 16' },
    { title: 'FIRST BUILDING (79TH STREET) - HQ + ACADEMY', phase: 3, target: '2028',
      links: [{ kind: 'occupancy', to: 'ACADEMY #1 LAUNCH' }], provenance: 'PROJECTS row 17' },
    { title: 'ACADEMY #1 LAUNCH', phase: 3, target: 'TBD', targetNote: 'post-2028 acquisition',
      links: [{ kind: 'depends_on', to: 'FIRST BUILDING (79TH STREET) - HQ + ACADEMY' }], provenance: 'PROJECTS row 18' },
    { title: 'BEHAVIORAL EXECUTION ENGINE PATENT', phase: 1, target: '2026-09-11',
      targetNote: 'provisional expires November 2026 (month precision — no day attested)',
      links: [{ kind: 'child_of', to: 'JERICHO 1.0' }], provenance: 'DELIVERABLES row 12' },
  ],
  milestones: [
    { name: 'Oct 17 2026 Convergence', date: '2026-10-17',
      lanes: ['OUR FEARLESS LEADER 3: ROMANCE RIOT', 'JERICHO 1.0', 'HYS BROADCAST - SEASON 1', 'BEHAVIORAL EXECUTION ENGINE PATENT'],
      provenance: 'canonical_edges: converges (four lanes, one date)' },
  ],
  aliases: {
    'NON-PROVISONAL PATENT SUBMISSION': 'BEHAVIORAL EXECUTION ENGINE PATENT',
    'NON-PROVISIONAL PATENT SUBMISSION': 'BEHAVIORAL EXECUTION ENGINE PATENT',
    'OUR FEARLESS LEADER 4: PAIN KILLERS': 'OUR FEARLESS LEADER 4: PAINKILLERS',
    'HELP YOURSELF BROADCAST': 'HYS BROADCAST - SEASON 1',
    'F8 ENERGY GUM': 'ENERGY GUM',
    'EMAIL CAPTURE CONTAINER': 'EMAIL-CAPTURE CONTAINER',
    'STATE OF CONTROL': 'STATE OF CONTROL PTS. 1-5',
    'HEAD QUARTERS': 'FIRST BUILDING (79TH STREET) - HQ + ACADEMY',
    'FIRST ACADEMY BUILDING': 'ACADEMY #1 LAUNCH',
  },
};

// The 18 Master Grid titles as they appear in the grid (drift preserved).
export const REFERENCE_GRID_TITLES = [
  '"OUR FEARLESS LEADER 3: ROMANCE RIOT"', '"OUR FEARLESS LEADER 4: PAIN KILLERS"',
  '"OUR FEARLESS LEADER 5: CORONATION"', '"OUR FEARLESS LEADER 6: SAVIOR"',
  '"OUR FEARLESS LEADER 7: SACRIFICE"', '"STATE OF CONTROL"',
  '"SEEDS OF DESTRUCTION TRILOGY"', '"MAX CLOUT TRILOGY"', '"I AM THE STATE"',
  '"DESIREE"', '"JERICHO 1.0"', '"Non-Provisonal Patent Submission"',
  '"HELP YOURSELF BROADCAST"', '"F8 ENERGY GUM"', '"Alternative smoke pens"',
  '"email capture container"', '"Head Quarters"', '"First academy building"',
];
