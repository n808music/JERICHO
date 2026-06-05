import { describe, it, expect } from 'vitest';
import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';
import { COMMERCIAL_PIPELINE_STAGES } from './commercialPipelineStages.js';

const HORIZON_START = '2026-06-01';
const HORIZON_END = '2031-05-19';

const PLAN = {
  id: 'commercial-depth-test',
  successStandard: 'Active scaling commercial engine by 2031',
  outcomeTarget: 'Active scaling commercial engine by 2031-05-19',
  coreMission: 'Build commercial engine',
};

const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: HORIZON_START, endBoundary: '2026-12-31', phaseObjective: 'Found' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31', phaseObjective: 'Operate' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: HORIZON_END, phaseObjective: 'Scale' },
  ],
};

const LANES = [
  { id: 'lane-income', laneId: 'lane-income', domain: 'income', title: 'Services Revenue', laneTitle: 'Services Revenue', activationState: 'active' },
  { id: 'lane-capital', laneId: 'lane-capital', domain: 'capital', title: 'Capital Real Estate', laneTitle: 'Capital Real Estate', activationState: 'active' },
  { id: 'lane-institution', laneId: 'lane-institution', domain: 'institution', title: 'Institution Education', laneTitle: 'Institution Education', activationState: 'active' },
  { id: 'lane-civic', laneId: 'lane-civic', domain: 'civic', title: 'Civic Development', laneTitle: 'Civic Development', activationState: 'active' },
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

describe('Commercial / capital / BD lanes — pipeline stage coverage', () => {
  const blocks = runExpansion();

  it('income_stream covers at least 10 distinct commercial pipeline stages', () => {
    const incomeBlocks = blocks.filter((b) => b.laneId === 'lane-income');
    const stages = new Set(incomeBlocks.map((b) => b.commercialStage).filter(Boolean));
    const canonicalCovered = COMMERCIAL_PIPELINE_STAGES.filter((s) => stages.has(s));
    expect(canonicalCovered.length).toBeGreaterThanOrEqual(10);
  });

  it('income_stream P1 includes segment_definition, lead_sourcing, outreach_send, qualification, discovery_call, proposal_prep, close_decision', () => {
    const incomeBlocks = blocks.filter((b) => b.laneId === 'lane-income' && b.phaseLabel === 'P1');
    const stages = new Set(incomeBlocks.map((b) => b.commercialStage).filter(Boolean));
    for (const required of ['segment_definition', 'lead_sourcing', 'outreach_send', 'qualification', 'discovery_call', 'proposal_prep', 'close_decision']) {
      expect(stages.has(required)).toBe(true);
    }
  });

  it('capital_real_estate covers at least 8 commercial pipeline stages across the horizon', () => {
    const capitalBlocks = blocks.filter((b) => b.laneId === 'lane-capital');
    const stages = new Set(capitalBlocks.map((b) => b.commercialStage).filter(Boolean));
    const canonicalCovered = COMMERCIAL_PIPELINE_STAGES.filter((s) => stages.has(s));
    expect(canonicalCovered.length).toBeGreaterThanOrEqual(8);
  });

  it('institution_education includes segment_definition, qualification, proposal_prep across the horizon', () => {
    const instBlocks = blocks.filter((b) => b.laneId === 'lane-institution');
    const stages = new Set(instBlocks.map((b) => b.commercialStage).filter(Boolean));
    expect(stages.has('segment_definition')).toBe(true);
    expect(stages.has('qualification')).toBe(true);
    expect(stages.has('proposal_prep')).toBe(true);
  });

  it('every commercial-stage block carries an outputArtifact and passEvidence/evidenceRequired', () => {
    const staged = blocks.filter((b) => b.commercialStage);
    expect(staged.length).toBeGreaterThan(0);
    for (const b of staged) {
      expect(b.outputArtifact || b.outputArtifactId).toBeTruthy();
      expect(b.passEvidence || b.evidenceRequired).toBeTruthy();
    }
  });
});
