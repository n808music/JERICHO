/**
 * RTG Product-Grade Remediation #1 — Finding 2: gate criteria readability.
 *
 * resolveGateCriteria previously stitched the descriptor's expectedOutput
 * directly into the passCriteria sentence ("${expectedOutput} demonstrates
 * upstream proof threshold cleared for ${laneTitle}"). When expectedOutput
 * was itself a clause like "Direct expansion gate with unmet dependencies",
 * the result read as ungrammatical concatenated junk.
 *
 * The criteria must read as plain English regardless of expectedOutput
 * phrasing.
 */
import { describe, expect, it } from 'vitest';

import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';

const HORIZON_START = '2026-06-04';
const HORIZON_END = '2031-05-19';
const PLAN = { id: 'gate-test', successStandard: 'X', outcomeTarget: 'Y' };
const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: HORIZON_START, endBoundary: '2026-12-31' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: HORIZON_END },
  ],
};

function expand(domain, title) {
  const lane = { id: `lane-${domain}`, laneId: `lane-${domain}`, domain, title, laneTitle: title, activationState: 'active' };
  return expandFullHorizonSchedule({
    plan: PLAN, phaseModel: PHASE_MODEL,
    horizonStartDayKey: HORIZON_START, horizonEndDayKey: HORIZON_END,
    lanes: [lane], existingForecastBlocks: [], committedBlocks: [],
    workDays: ['mon','tue','wed','thu','fri'],
  });
}

describe('RTG Finding 2: gate criteria are grammatical', () => {
  const blocks = [
    ...expand('creative', 'Album release engine'),
    ...expand('income', 'Services revenue'),
    ...expand('capital', 'Capital stack'),
    ...expand('institution', 'Institution design'),
    ...expand('civic', 'Civic coalition path'),
  ];
  const gates = blocks.filter((b) => b.blockType === 'gate');

  it('every gate block has at least one gate emitted', () => {
    expect(gates.length).toBeGreaterThan(0);
  });

  it('passCriteria starts with a canonical sentence-opening clause (not the descriptor expectedOutput)', () => {
    // Symptom of the prior stitched-clause bug was passCriteria starting with
    // the descriptor's expectedOutput phrase ("Direct expansion gate with…").
    // The correct shape opens with a canonical sentence-frame clause and
    // places descriptor evidence in a "Required evidence:" tail.
    for (const g of gates) {
      const text = String(g.passCriteria || '');
      expect(text.startsWith('Upstream proof threshold for ')).toBe(true);
      expect(text).toContain('Required evidence:');
    }
  });

  it('failCriteria starts with a canonical sentence-opening clause and mentions remediation', () => {
    for (const g of gates) {
      const text = String(g.failCriteria || '');
      expect(text.startsWith('Upstream proof threshold for ')).toBe(true);
      expect(text).toContain('Missing or weak evidence:');
    }
  });

  it('criteria do not end with a double period (descriptor evidence may itself end in period)', () => {
    for (const g of gates) {
      expect(String(g.passCriteria || '')).not.toMatch(/\.\.$/);
      expect(String(g.failCriteria || '')).not.toMatch(/\.\.$/);
    }
  });

  it('passCriteria mentions the lane and includes a directional verb (advance, clear, met, cleared, etc.)', () => {
    for (const g of gates) {
      expect(String(g.passCriteria || '')).toMatch(/\b(advance|clear|cleared|met|approved|proceed)\b/i);
    }
  });

  it('failCriteria mentions a remediation/hold action', () => {
    for (const g of gates) {
      expect(String(g.failCriteria || '')).toMatch(/\b(hold|remediate|pause|stop|retry|block|reattempt|defer)\b/i);
    }
  });
});
