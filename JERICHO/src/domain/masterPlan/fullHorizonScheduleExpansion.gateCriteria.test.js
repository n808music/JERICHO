/**
 * Gate criteria + failure-branch contract (Phase 4 — Execution Professionalism
 * Remediation). Every gate block must carry gateName, passCriteria,
 * failCriteria, evidenceRequired, decisionAuthority, passBranch, and failBranch
 * — and the plan quality gate must refuse a generated plan whose gates lack
 * these fields.
 */
import { describe, expect, it } from 'vitest';

import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';
import { deriveForecastBlocks } from './forecastBlockDerivation.js';

const PLAN = { id: 'phase4-test-plan', successStandard: 'X', outcomeTarget: 'Y' };
const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: '2026-06-01', endBoundary: '2026-12-31' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: '2031-05-19' },
  ],
};
const PRODUCT_LANE = {
  id: 'lane-product',
  laneId: 'lane-product',
  domain: 'product',
  title: 'Product lane',
  laneTitle: 'Product lane',
};

// creative_media descriptor pool contains "Gate additional creative spend…" — use
// this lane to guarantee gate-block emission for the expansion-engine test.
const CREATIVE_LANE = {
  id: 'lane-creative',
  laneId: 'lane-creative',
  domain: 'creative',
  title: 'Album release engine',
  laneTitle: 'Album release engine',
};

function expandWithLane(lane = CREATIVE_LANE) {
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

describe('expansion-engine gate blocks carry full criteria substrate', () => {
  it('every gate block carries gateName, passCriteria, failCriteria, evidenceRequired, decisionAuthority, passBranch, failBranch', () => {
    const blocks = expandWithLane();
    const gates = blocks.filter((b) => b.blockType === 'gate');
    expect(gates.length).toBeGreaterThan(0);
    for (const gate of gates) {
      expect(gate.gateName).toBeTruthy();
      expect(gate.passCriteria).toBeTruthy();
      expect(gate.failCriteria).toBeTruthy();
      expect(gate.evidenceRequired).toBeTruthy();
      expect(gate.decisionAuthority).toBeTruthy();
      expect(gate.passBranch).toBeTruthy();
      expect(gate.failBranch).toBeTruthy();
      expect(gate.gateCriteria?.metricName).toBeTruthy();
      expect(gate.gateCriteria?.threshold).toBeTruthy();
      expect(gate.gateCriteria?.evidenceArtifactId).toBeTruthy();
    }
  });
});

describe('forecast-emitter gate blocks carry full criteria substrate', () => {
  it('every gate block from deriveForecastBlocks has criteria fields', () => {
    const phase = {
      id: 'p1',
      label: 'P1',
      startBoundary: '2026-06-01',
      endBoundary: '2026-12-31',
      commitmentState: 'forecast',
      phaseObjective: 'Foundation',
    };
    const blocks = deriveForecastBlocks({
      plan: { id: 'phase4-test-plan' },
      phase,
      horizonEndDayKey: '2031-05-19',
      cycleEndDayKey: '2026-06-30',
    });
    const gates = blocks.filter((b) => b.blockType === 'gate');
    // P1 post-cycle derivation emits a P1-to-P2 readiness gate
    for (const gate of gates) {
      expect(gate.gateName).toBeTruthy();
      expect(gate.passCriteria).toBeTruthy();
      expect(gate.failCriteria).toBeTruthy();
      expect(gate.evidenceRequired).toBeTruthy();
      expect(gate.decisionAuthority).toBeTruthy();
      expect(gate.passBranch).toBeTruthy();
      expect(gate.failBranch).toBeTruthy();
    }
  });
});
