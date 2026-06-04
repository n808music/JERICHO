/**
 * RTG Product-Grade Remediation #1 — Finding 1: incubating-lane activation path.
 *
 * Mission-named lanes that are currently incubating must still receive
 * readiness/activation-path work (draft memos, build lists, map stakeholders,
 * draft proposals, send discovery meeting requests). They must NOT receive
 * commitment-flavored work (close acquisitions, execute deployments, finalize
 * binding contracts, launch live pilots).
 *
 * The Plan Quality gate prevents fake execution; RTG prevents permanent
 * passive monitoring.
 */
import { describe, expect, it } from 'vitest';

import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';

const HORIZON_START = '2026-06-04';
const HORIZON_END = '2031-05-19';
const PLAN = { id: 'rtg-test', successStandard: 'X', outcomeTarget: 'Y' };
const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: HORIZON_START, endBoundary: '2026-12-31' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: HORIZON_END },
  ],
};

function incubatingLane(id, domain, title) {
  return { id: `lane-${id}`, laneId: `lane-${id}`, domain, title, laneTitle: title, activationState: 'incubating' };
}

function expand(lane) {
  return expandFullHorizonSchedule({
    plan: PLAN, phaseModel: PHASE_MODEL,
    horizonStartDayKey: HORIZON_START, horizonEndDayKey: HORIZON_END,
    lanes: [lane], existingForecastBlocks: [], committedBlocks: [],
    workDays: ['mon','tue','wed','thu','fri'],
  });
}

// Title pattern signals readiness-flavor (preparation, discovery, map, draft,
// build list) — these should always run, even on incubating lanes.
const READINESS_FLAVOR_PATTERNS = [
  /\bdraft\b/i,
  /\bbuild\b.*\b(list|prospect)\b/i,
  /\bmap\b/i,
  /\bdiscovery\b/i,
  /\bsubmit (meeting|outreach|discovery)\b/i,
  /\bprepare\b/i,
  /\b(preliminary|prospect) (capital |budget )?memo\b/i,
];

// Title pattern signals commitment-flavor — these should be stripped on
// incubating lanes.
const COMMITMENT_FLAVOR_PATTERNS = [
  /\b(execute|deploy|launch) (capital deployment|institution program|civic scale)\b/i,
  /\bfinalize first acquisition\b/i,
  /\bfinalize partnership terms\b/i,
  /\bclose (first |acquisition)\b/i,
];

function isReadinessFlavor(title) {
  return READINESS_FLAVOR_PATTERNS.some((rx) => rx.test(title));
}
function isCommitmentFlavor(title) {
  return COMMITMENT_FLAVOR_PATTERNS.some((rx) => rx.test(title));
}

describe('RTG Finding 1: incubating capital lane', () => {
  const blocks = expand(incubatingLane('capital', 'capital', 'Operation Endgame capital stack'));

  it('has at least one readiness-flavored BD block (draft memo, build list, map stakeholders, etc.)', () => {
    const readiness = blocks.filter((b) => isReadinessFlavor(String(b.title || '')));
    expect(readiness.length).toBeGreaterThan(0);
  });

  it('contains no commitment-flavored BD blocks (no Execute / Finalize first / Close acquisition)', () => {
    const commitment = blocks.filter((b) => isCommitmentFlavor(String(b.title || '')));
    expect(commitment).toEqual([]);
  });

  it('produces at least one block whose producesArtifact references budget amount or unknown-budget flag', () => {
    const pattern = /\$\s*\d|\b\d+\s*(?:k|m|b)\b|\bbudget\s+(?:range|amount)\b|\bunknown[- ]budget\b/i;
    expect(blocks.some((b) => pattern.test(String(b.producesArtifact || '')))).toBe(true);
  });
});

describe('RTG Finding 1: incubating institution lane', () => {
  const blocks = expand(incubatingLane('institution', 'institution', 'Operation Endgame institution design'));

  it('has at least one readiness-flavored BD block', () => {
    expect(blocks.some((b) => isReadinessFlavor(String(b.title || '')))).toBe(true);
  });

  it('contains no commitment-flavored BD blocks', () => {
    expect(blocks.filter((b) => isCommitmentFlavor(String(b.title || '')))).toEqual([]);
  });
});

describe('RTG Finding 1: incubating civic lane', () => {
  const blocks = expand(incubatingLane('civic', 'civic', 'Operation Endgame civic coalition path'));

  it('has at least one readiness-flavored BD block', () => {
    expect(blocks.some((b) => isReadinessFlavor(String(b.title || '')))).toBe(true);
  });

  it('contains no commitment-flavored BD blocks', () => {
    expect(blocks.filter((b) => isCommitmentFlavor(String(b.title || '')))).toEqual([]);
  });
});

describe('RTG Finding 1: active capital lane retains all BD descriptors', () => {
  // Sanity check — active lanes must still see commitment work.
  const lane = { id: 'lane-capital', laneId: 'lane-capital', domain: 'capital', title: 'Active capital', laneTitle: 'Active capital', activationState: 'active' };
  const blocks = expandFullHorizonSchedule({
    plan: PLAN, phaseModel: PHASE_MODEL,
    horizonStartDayKey: HORIZON_START, horizonEndDayKey: HORIZON_END,
    lanes: [lane], existingForecastBlocks: [], committedBlocks: [],
    workDays: ['mon','tue','wed','thu','fri'],
  });

  it('contains commitment-flavored blocks (Execute capital deployment, Finalize first acquisition)', () => {
    expect(blocks.some((b) => isCommitmentFlavor(String(b.title || '')))).toBe(true);
  });
});
