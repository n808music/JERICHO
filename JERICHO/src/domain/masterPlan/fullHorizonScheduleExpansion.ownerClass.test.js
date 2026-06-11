/**
 * Owner-class mapping (Phase 3 — Execution Professionalism Remediation).
 *
 * Execution-class blocks must carry an explicit professional owner label.
 * Cross-lane / gate / review / terminal blocks still remain explicitly owned
 * rather than falling back to raw authority-class tokens.
 */
import { describe, expect, it } from 'vitest';

import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';
import { deriveForecastBlocks } from './forecastBlockDerivation.js';

const PLAN = {
  id: 'phase3-test-plan',
  successStandard: 'SaaS product with paying users',
  outcomeTarget: 'paying user base by horizon end',
};

const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: '2026-06-01', endBoundary: '2026-12-31' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: '2031-05-19' },
  ],
};

function expandForLane(lane) {
  return expandFullHorizonSchedule({
    plan: PLAN,
    phaseModel: PHASE_MODEL,
    horizonStartDayKey: '2026-06-01',
    horizonEndDayKey: '2031-05-19',
    lanes: [lane],
    existingForecastBlocks: [],
    committedBlocks: [],
    workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  });
}

const LANE_FAMILY_TO_OWNER = [
  { domain: 'product', expected: 'Product Lead', label: 'product/software lane' },
  { domain: 'creative', title: 'Album release engine', expected: 'Creative Lead', label: 'creative_media' },
  { domain: 'media', expected: 'Media Lead', label: 'media_channel' },
  { domain: 'brand', title: 'Operations system', expected: 'Operations Lead', label: 'company_operations' },
  { domain: 'income', expected: 'Revenue Lead', label: 'income_stream' },
  { domain: 'capital', expected: 'Capital Lead', label: 'capital_real_estate' },
  { domain: 'institution', expected: 'Institution Lead', label: 'institution_education' },
  { domain: 'civic', expected: 'Civic Lead', label: 'civic_development' },
];

describe('owner-class mapping for execution blocks', () => {
  for (const { domain, title, expected, label } of LANE_FAMILY_TO_OWNER) {
    it(`maps ${label} (domain=${domain}) actionable blocks to ${expected}`, () => {
      const lane = { id: `lane-${domain}`, laneId: `lane-${domain}`, domain, title: title || `${domain} lane`, laneTitle: title || `${domain} lane` };
      const blocks = expandForLane(lane);
      const actionable = blocks.filter(
        (b) => b.blockType === 'action' || b.blockType === 'validation' || b.blockType === 'readiness',
      );
      expect(actionable.length).toBeGreaterThan(0);
      for (const block of actionable) {
        expect(block.owner).toBe(expected);
      }
    });
  }

  it('assigns explicit ownership to review and audit blocks', () => {
    const lane = { id: 'lane-product', laneId: 'lane-product', domain: 'product', title: 'Product lane', laneTitle: 'Product lane' };
    const blocks = expandForLane(lane);
    const reviewers = blocks.filter((b) => b.blockType === 'review' || b.blockType === 'audit');
    expect(reviewers.length).toBeGreaterThan(0);
    for (const block of reviewers) {
      expect(block.owner).toBe('Product Lead');
    }
  });

  it('assigns explicit ownership to gate blocks', () => {
    const lane = { id: 'lane-product', laneId: 'lane-product', domain: 'product', title: 'Product lane', laneTitle: 'Product lane' };
    const blocks = expandForLane(lane);
    const gates = blocks.filter((b) => b.blockType === 'gate');
    if (gates.length > 0) {
      for (const block of gates) {
        expect(block.owner).toBe('Product Lead');
      }
    }
  });

  it('assigns Operator to the cross-lane terminal block', () => {
    const lane = { id: 'lane-product', laneId: 'lane-product', domain: 'product', title: 'Product lane', laneTitle: 'Product lane' };
    const blocks = expandForLane(lane);
    const terminal = blocks.find((b) => b.laneId === 'cross_lane_terminal_review');
    expect(terminal).toBeDefined();
    expect(terminal.owner).toBe('Operator');
  });

  it('falls back to explicit ownership for cross-lane / general blocks', () => {
    const blocks = expandFullHorizonSchedule({
      plan: PLAN,
      phaseModel: PHASE_MODEL,
      horizonStartDayKey: '2026-06-01',
      horizonEndDayKey: '2031-05-19',
      lanes: [],
      existingForecastBlocks: [],
      committedBlocks: [],
      workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    });
    // With no lanes, P3-only blocks may emit; ensure no actionable block carries the generic 'executor'.
    const actionable = blocks.filter(
      (b) => b.blockType === 'action' || b.blockType === 'validation' || b.blockType === 'readiness',
    );
    for (const block of actionable) {
      expect(block.owner).not.toBe('executor');
      expect(block.owner).not.toBe('founder');
      expect(block.owner).toBeTruthy();
    }
  });
});

describe('forecast blocks carry full execution substrate', () => {
  const lane = { id: 'lane-product', laneId: 'lane-product', domain: 'product', title: 'Product lane', laneTitle: 'Product lane' };
  const phase = { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31', commitmentState: 'forecast', phaseObjective: 'Operate' };

  it('every actionable forecast block has owner, durationMinutes, producesArtifact, consumedBy, consumedByRef, passEvidence', () => {
    const blocks = deriveForecastBlocks({
      plan: { id: 'phase3-test-plan' },
      phase,
      horizonEndDayKey: '2031-05-19',
      cycleEndDayKey: null,
    });
    const actionable = blocks.filter(
      (b) => b.blockType === 'action' || b.blockType === 'validation' || b.blockType === 'readiness',
    );
    // Forecast emission may produce zero actionable blocks for some phases; check the contract on whatever it emits.
    for (const block of actionable) {
      expect(block.owner).toBeTruthy();
      expect(typeof block.durationMinutes).toBe('number');
      expect(block.durationMinutes).toBeGreaterThan(0);
      expect(block.producesArtifact).toBeTruthy();
      expect(Array.isArray(block.consumedBy)).toBe(true);
      expect(block.consumedBy.length).toBeGreaterThan(0);
      expect(block.consumedByRef).toBeTruthy();
      expect(block.consumedByRef.id).toBeTruthy();
      expect(block.passEvidence).toBeTruthy();
    }
  });
});
