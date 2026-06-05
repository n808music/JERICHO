import { describe, it, expect } from 'vitest';
import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';
import { SDLC_STAGES } from './sdlcStages.js';

const HORIZON_START = '2026-06-01';
const HORIZON_END = '2031-05-19';

const PLAN = {
  id: 'sdlc-depth-test',
  successStandard: 'Active scaling product by 2031',
  outcomeTarget: 'Active scaling product by 2031-05-19',
  coreMission: 'Build product engine',
};

const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: HORIZON_START, endBoundary: '2026-12-31', phaseObjective: 'Found' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31', phaseObjective: 'Operate' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: HORIZON_END, phaseObjective: 'Scale' },
  ],
};

const LANES = [
  {
    id: 'lane-product',
    laneId: 'lane-product',
    domain: 'product',
    title: 'Core Product',
    laneTitle: 'Core Product',
    activationState: 'active',
  },
];

function runExpansion() {
  return expandFullHorizonSchedule({
    plan: PLAN,
    phaseModel: PHASE_MODEL,
    horizonStartDayKey: HORIZON_START,
    horizonEndDayKey: HORIZON_END,
    lanes: LANES,
    existingForecastBlocks: [],
    committedBlocks: [],
    workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    weeklyCapacityMinutes: 30 * 60,
  });
}

describe('Product/software lane — SDLC stage coverage', () => {
  const blocks = runExpansion();
  const productBlocks = blocks.filter((b) => b.laneId === 'lane-product');

  it('covers at least 8 distinct SDLC stages across the horizon', () => {
    const stagesPresent = new Set(productBlocks.map((b) => b.lifecycleStage).filter(Boolean));
    const coveredCanonicalStages = SDLC_STAGES.filter((s) => stagesPresent.has(s));
    expect(coveredCanonicalStages.length).toBeGreaterThanOrEqual(8);
  });

  it('includes requirements_clarification, technical_design, qa_validation, deployment, telemetry_monitoring', () => {
    const stagesPresent = new Set(productBlocks.map((b) => b.lifecycleStage).filter(Boolean));
    expect(stagesPresent.has('requirements_clarification')).toBe(true);
    expect(stagesPresent.has('technical_design')).toBe(true);
    expect(stagesPresent.has('qa_validation')).toBe(true);
    expect(stagesPresent.has('deployment')).toBe(true);
    expect(stagesPresent.has('telemetry_monitoring')).toBe(true);
  });

  it('every product block with lifecycleStage carries an outputArtifact', () => {
    const staged = productBlocks.filter((b) => b.lifecycleStage);
    expect(staged.length).toBeGreaterThan(0);
    for (const b of staged) {
      expect(b.outputArtifact || b.outputArtifactId).toBeTruthy();
    }
  });

  it('every product block has a passEvidence or evidenceRequired field', () => {
    for (const b of productBlocks) {
      const hasEvidence = b.passEvidence || b.evidenceRequired;
      expect(hasEvidence).toBeTruthy();
    }
  });
});
