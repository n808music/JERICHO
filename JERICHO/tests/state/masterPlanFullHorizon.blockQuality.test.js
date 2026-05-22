import { describe, expect, it } from 'vitest';

import { evaluateFullHorizonBlockQuality } from '../../src/domain/masterPlan/fullHorizonBlockQuality.js';
import { deriveMasterPlanPhaseModel } from '../../src/domain/masterPlan/masterPlanPhaseModel.js';
import { buildOperationEndgameState, getActivePlan, setHorizonMode } from '../helpers/masterPlanFullHorizonScenario.js';

function buildGeneratedState(options = {}) {
  return setHorizonMode(buildOperationEndgameState(options), 'full_horizon');
}

function buildContext(state = buildGeneratedState()) {
  const plan = getActivePlan(state);
  const lanes = Array.isArray(plan?.laneIds)
    ? plan.laneIds.map((laneId) => state?.masterPlanLanesById?.[laneId]).filter(Boolean)
    : [];
  const milestones = lanes.flatMap((lane) =>
    Array.isArray(lane?.milestoneIds)
      ? lane.milestoneIds.map((milestoneId) => state?.masterPlanMilestonesById?.[milestoneId]).filter(Boolean)
      : []
  );
  const phaseModel = deriveMasterPlanPhaseModel({
    plan,
    lanes,
    milestones,
    anchors: Array.isArray(plan?.anchors) ? plan.anchors : [],
    planCycle: null,
    committedBlocks: [],
    criticQuestionsByLane: {},
  });
  return { state, plan, lanes, phaseModel };
}

function evaluateForState(state = buildGeneratedState(), blocks = state.fullHorizonScheduleBlocks || []) {
  const { phaseModel } = buildContext(state);
  return evaluateFullHorizonBlockQuality({
    fullHorizonScheduleBlocks: blocks,
    phaseModel,
  });
}

function cloneBlocks(blocks) {
  return JSON.parse(JSON.stringify(blocks || []));
}

describe('master-plan full-horizon block quality audit', () => {
  it('returns a block-quality result for the restored Operation Endgame baseline', () => {
    const state = buildGeneratedState();
    const quality = state.fullHorizonBlockQuality;

    expect(quality).toBeTruthy();
    expect(['trusted', 'provisional', 'degraded']).toContain(quality.state);
    expect(quality.summary.totalBlocks).toBeGreaterThan(0);
    expect(quality.summary.byPhase.P1).toBeGreaterThan(0);
    expect(quality.summary.byPhase.P2).toBeGreaterThan(0);
    expect(quality.summary.byPhase.P3).toBeGreaterThan(0);
  });

  it('can be provisional while strategic coverage remains covered', () => {
    const state = buildGeneratedState();

    expect(state.fullHorizonCoverageAudit?.fullHorizonCovered).toBe(true);
    expect(['trusted', 'provisional', 'degraded']).toContain(state.fullHorizonBlockQuality?.state);
  });

  it('flags weak or vague titles', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks);
    blocks[0].title = 'Review';

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('BLOCK_TITLE_NOT_ACTIONABLE');
  });

  it('flags missing expected outputs', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks);
    blocks[0].expectedOutput = '';

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('BLOCK_OUTPUT_MISSING');
  });

  it('flags duplicate forecast block titles', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks).map((block) => ({
      ...block,
      title: 'Repeatable system review',
    }));

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('DUPLICATE_FORECAST_BLOCK_TITLE');
  });

  it('flags missing lane and phase ownership', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks);
    blocks[0].laneId = null;
    blocks[0].laneLabel = '';
    blocks[0].phaseLabel = '';

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('BLOCK_LANE_MISSING');
    expect(quality.reasonCodes).toContain('BLOCK_PHASE_MISSING');
  });

  it('flags future phase execution leakage', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks).map((block) =>
      block.phaseLabel === 'P2' ? { ...block, executionEligibility: 'ready' } : block
    );

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('FUTURE_PHASE_EXECUTION_LEAK');
  });

  it('flags a long temporal gap inside a phase', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks).filter((block) => {
      if (block.phaseLabel !== 'P2') {
        return true;
      }
      return String(block.dayKey || '') < '2027-08-01' || String(block.dayKey || '') > '2028-05-01';
    });

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('LONG_HORIZON_TEMPORAL_GAP');
  });
});
