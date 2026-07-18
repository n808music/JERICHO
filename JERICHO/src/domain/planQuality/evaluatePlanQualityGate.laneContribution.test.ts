import { describe, expect, it } from 'vitest';

import { expandFullHorizonSchedule } from '../masterPlan/fullHorizonScheduleExpansion.js';
import { evaluatePlanQualityGate } from './evaluatePlanQualityGate';

const GOAL_TEXT = 'Build a multi-lane product and media system that compounds into durable growth';
const VERIFICATION_TEXT = 'Product and media lanes produce durable evidence tied to the long-horizon outcome';

function makeLane(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lane-product',
    label: 'Product lane',
    laneOutcome: 'Validated onboarding conversion system',
    ...overrides,
  };
}

function makeExecBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'block-exec-1',
    title: 'Build onboarding conversion instrumentation for first-user activation',
    deliverableId: 'masterplan-deliverable:lane-product',
    blockType: 'action',
    owner: 'executor',
    durationMinutes: 60,
    producesArtifact: 'Onboarding conversion instrumentation package with activation event map',
    consumedBy: ['phase:P2'],
    consumedByRef: { type: 'phaseObjective', id: 'P2' },
    passEvidence: 'Instrumentation test run and activation event log reviewed against launch criteria',
    phaseLabel: 'P1',
    laneId: 'lane-product',
    laneLabel: 'Product lane',
    dayKey: '2026-02-01',
    ...overrides,
  };
}

function makeReviewBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'block-review-1',
    title: 'Review onboarding conversion readiness for Product lane',
    deliverableId: 'masterplan-deliverable:lane-product',
    blockType: 'review',
    owner: 'reviewer',
    consumedBy: ['phase:P2'],
    consumedByRef: { type: 'phaseObjective', id: 'P2' },
    laneId: 'lane-product',
    laneLabel: 'Product lane',
    phaseLabel: 'P1',
    dayKey: '2026-02-01',
    ...overrides,
  };
}

function runGate({
  lanes,
  blocks = [],
}: {
  lanes?: Record<string, unknown>[];
  blocks?: Record<string, unknown>[];
}) {
  return evaluatePlanQualityGate({
    goalText: GOAL_TEXT,
    verificationText: VERIFICATION_TEXT,
    proposedBlocks: blocks as any,
    committedBlocks: [],
    lanes: lanes as any,
  });
}

describe('Lane Contribution Authenticity', () => {
  it('does not fail when input.lanes is missing', () => {
    const result = runGate({ blocks: [makeExecBlock()] });
    expect(result.failureCodes).not.toContain('MISSING_LANE_OUTCOME');
    expect(result.failureCodes).not.toContain('VAGUE_LANE_OUTCOME');
    expect(result.failureCodes).not.toContain('LANE_WITHOUT_EXECUTION_WORK');
    expect(result.failureCodes).not.toContain('LANE_OUTCOME_WITHOUT_PHASE_OR_MISSION_SUPPORT');
  });

  it('does not fail when lanes array is empty', () => {
    const result = runGate({ lanes: [], blocks: [makeExecBlock()] });
    expect(result.failureCodes).not.toContain('MISSING_LANE_OUTCOME');
    expect(result.failureCodes).not.toContain('VAGUE_LANE_OUTCOME');
    expect(result.failureCodes).not.toContain('LANE_WITHOUT_EXECUTION_WORK');
    expect(result.failureCodes).not.toContain('LANE_OUTCOME_WITHOUT_PHASE_OR_MISSION_SUPPORT');
  });

  it('fails when laneOutcome is missing', () => {
    const result = runGate({ lanes: [makeLane({ laneOutcome: '' })], blocks: [makeExecBlock()] });
    expect(result.failureCodes).toContain('MISSING_LANE_OUTCOME');
    expect(result.meta?.lanesWithMissingOutcome).toContain('Product lane');
  });

  it('fails when laneOutcome is vague', () => {
    const result = runGate({ lanes: [makeLane({ laneOutcome: 'Build momentum' })], blocks: [makeExecBlock()] });
    expect(result.failureCodes).toContain('VAGUE_LANE_OUTCOME');
    expect(result.meta?.lanesWithVagueOutcome).toContain('Product lane');
  });

  it('fails when a lane has only review-class blocks', () => {
    const result = runGate({ lanes: [makeLane()], blocks: [makeReviewBlock()] });
    expect(result.failureCodes).toContain('LANE_WITHOUT_EXECUTION_WORK');
    expect(result.meta?.lanesWithoutExecution).toContain('Product lane');
  });

  it('fails when a lane has no blocks', () => {
    const result = runGate({ lanes: [makeLane()], blocks: [] });
    expect(result.failureCodes).not.toContain('LANE_WITHOUT_EXECUTION_WORK');
  });

  it('passes when a lane has an execution block and a concrete outcome', () => {
    const result = runGate({ lanes: [makeLane()], blocks: [makeExecBlock()] });
    expect(result.failureCodes).not.toContain('MISSING_LANE_OUTCOME');
    expect(result.failureCodes).not.toContain('VAGUE_LANE_OUTCOME');
    expect(result.failureCodes).not.toContain('LANE_WITHOUT_EXECUTION_WORK');
    expect(result.failureCodes).not.toContain('LANE_OUTCOME_WITHOUT_PHASE_OR_MISSION_SUPPORT');
  });

  it('fails when a lane has execution work but no contribution path', () => {
    const result = runGate({
      lanes: [makeLane()],
      blocks: [makeExecBlock({ consumedByRef: null, consumedBy: ['unknown'] })],
    });
    expect(result.failureCodes).toContain('LANE_OUTCOME_WITHOUT_PHASE_OR_MISSION_SUPPORT');
    expect(result.meta?.lanesWithoutSupport).toContain('Product lane');
  });

  it('passes when contribution uses laneOutcome reference', () => {
    const result = runGate({
      lanes: [makeLane()],
      blocks: [
        makeExecBlock({
          consumedBy: ['lane:lane-product:conversion-readiness'],
          consumedByRef: { type: 'laneOutcome', id: 'lane-product:conversion-readiness' },
        }),
      ],
    });
    expect(result.failureCodes).not.toContain('LANE_OUTCOME_WITHOUT_PHASE_OR_MISSION_SUPPORT');
  });

  it('passes when contribution uses phaseObjective reference', () => {
    const result = runGate({
      lanes: [makeLane()],
      blocks: [makeExecBlock({ consumedByRef: { type: 'phaseObjective', id: 'P2' } })],
    });
    expect(result.failureCodes).not.toContain('LANE_OUTCOME_WITHOUT_PHASE_OR_MISSION_SUPPORT');
  });

  it('accepts existing generated full-horizon blocks when lanes are passed', () => {
    const lanes = [
      {
        id: 'lane-product',
        title: 'App platform',
        domain: 'product',
      },
    ];
    const phaseModel = {
      phases: [
        {
          id: 'phase-p1',
          label: 'P1',
          startBoundary: '2026-01-01',
          endBoundary: '2026-02-01',
          laneParticipation: [{ laneId: 'lane-product', status: 'active' }],
        },
      ],
    };
    const blocks = expandFullHorizonSchedule({
      plan: { id: 'plan-1', anchors: [], successStandard: 'Validated product outcome' },
      phaseModel,
      horizonStartDayKey: '2026-01-01',
      horizonEndDayKey: '2026-02-01',
      lanes,
      committedBlocks: [],
      existingForecastBlocks: [],
      workDays: [],
    });

    const result = runGate({
      lanes: [makeLane({ id: 'lane-product', label: 'App platform', laneOutcome: 'Validated onboarding conversion system' })],
      blocks,
    });
    expect(result.failureCodes).not.toContain('LANE_WITHOUT_EXECUTION_WORK');
    expect(result.failureCodes).not.toContain('LANE_OUTCOME_WITHOUT_PHASE_OR_MISSION_SUPPORT');
  });
});
