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

function summarizeP3FamilyRatios(blocks = []) {
  const byLane = blocks.reduce((acc, block) => {
    if (block?.phaseLabel !== 'P3' || !block?.laneId) {
      return acc;
    }
    acc[block.laneId] = acc[block.laneId] || { laneLabel: block.laneLabel, blocks: [] };
    acc[block.laneId].blocks.push(block);
    return acc;
  }, {});

  return Object.values(byLane).map(({ laneLabel, blocks: laneBlocks }) => {
    const familyCounts = laneBlocks.reduce((acc, block) => {
      const key = String(block?.titleFamily || block?.title || '').trim();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const largestFamilyCount = Math.max(...Object.values(familyCounts), 0);
    return {
      laneLabel,
      total: laneBlocks.length,
      uniqueFamilies: Object.keys(familyCounts).length,
      duplicateRatio: laneBlocks.length > 0 ? largestFamilyCount / laneBlocks.length : 0,
    };
  });
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

  it('keeps at least four distinct P3 title families per heavy lane without one family dominating above 40%', () => {
    const state = buildGeneratedState();
    const familyRows = summarizeP3FamilyRatios(state.fullHorizonScheduleBlocks || []).filter((row) => row.total >= 12);

    expect(familyRows.length).toBeGreaterThan(0);
    familyRows.forEach((row) => {
      expect(row.uniqueFamilies).toBeGreaterThanOrEqual(4);
      expect(row.duplicateRatio).toBeLessThanOrEqual(0.4);
    });
  });

  it('flags weak or vague titles', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks);
    blocks[0].title = 'Review';

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('BLOCK_TITLE_NOT_ACTIONABLE');
  });

  it('accepts object-specific review and validation titles', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks);
    const blockId = blocks[0].id;
    blocks[0].title = 'Validate terminal revenue evidence packet against 2031 success standard';

    const quality = evaluateForState(state, blocks);
    const titleIssues = quality.issues.filter(
      (issue) => issue.blockId === blockId && ['BLOCK_TITLE_NOT_ACTIONABLE', 'BLOCK_OBJECT_UNSPECIFIED'].includes(issue.code)
    );

    expect(titleIssues).toHaveLength(0);
  });

  it('flags missing expected outputs', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks);
    blocks[0].expectedOutput = '';

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('BLOCK_OUTPUT_MISSING');
  });

  it('requires expectedOutput on terminal-readiness blocks', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks);
    const terminalBlock = blocks.find((block) => block.phaseLabel === 'P3' && block.blockType === 'terminal-readiness');
    expect(terminalBlock).toBeTruthy();
    terminalBlock.expectedOutput = '';

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('BLOCK_OUTPUT_MISSING');
    expect(quality.state).not.toBe('trusted');
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

  it('keeps generated P3 blocks owned and output-contracted', () => {
    const state = buildGeneratedState();
    const p3Blocks = (state.fullHorizonScheduleBlocks || []).filter((block) => block.phaseLabel === 'P3');

    expect(p3Blocks.length).toBeGreaterThan(0);
    p3Blocks.forEach((block) => {
      expect(String(block.expectedOutput || '').trim()).not.toBe('');
      expect(String(block.laneId || '').trim()).not.toBe('');
      expect(String(block.laneLabel || '').trim()).not.toBe('');
      expect(String(block.phaseLabel || '').trim()).toBe('P3');
    });
  });

  it('withholds trust for future phase execution leakage', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks).map((block) =>
      block.phaseLabel === 'P2' ? { ...block, executionEligibility: 'ready' } : block
    );

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('FUTURE_PHASE_EXECUTION_LEAK');
    expect(quality.state).toBe('withheld');
  });

  it('flags terminal year workload compression', () => {
    const state = buildGeneratedState();
    let keptTerminalYear = false;
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks).filter((block) => {
      const year = String(block.dayKey || '').slice(0, 4);
      if (year !== '2031') {
        return true;
      }
      if (!keptTerminalYear) {
        keptTerminalYear = true;
        return true;
      }
      return false;
    });

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('PHASE_WORKLOAD_COMPRESSION');
  });

  it('flags thin unlock criteria on P2/P3 blocks', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks).map((block) =>
      ['P2', 'P3'].includes(block.phaseLabel) ? { ...block, dependsOn: [], dependencyStatus: '' } : block
    );

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('PHASE_UNLOCK_CRITERIA_THIN');
  });

  it('flags compressed P2→P3 handoff under 7 days for a lane', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks);
    const laneId = blocks.find((block) => block.phaseLabel === 'P2')?.laneId;
    const p2Blocks = blocks
      .filter((block) => block.phaseLabel === 'P2' && block.laneId === laneId)
      .sort((a, b) => String(a.dayKey || '').localeCompare(String(b.dayKey || '')));
    const p3Blocks = blocks
      .filter((block) => block.phaseLabel === 'P3' && block.laneId === laneId)
      .sort((a, b) => String(a.dayKey || '').localeCompare(String(b.dayKey || '')));

    if (p2Blocks.length > 0 && p3Blocks.length > 0) {
      const lastP2 = p2Blocks[p2Blocks.length - 1];
      const compressedDate = new Date(`${lastP2.dayKey}T12:00:00.000Z`);
      compressedDate.setUTCDate(compressedDate.getUTCDate() + 5);
      p3Blocks[0].dayKey = compressedDate.toISOString().slice(0, 10);
    }

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('PHASE_TRANSITION_COMPRESSED');
  });

  it('flags duplicate title ratio by lane-phase above 40%', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks);
    const laneId = blocks.find((block) => block.phaseLabel === 'P3')?.laneId;
    const p3Blocks = blocks.filter((block) => block.phaseLabel === 'P3' && block.laneId === laneId);
    const repeatedTitle = 'Terminal readiness review';

    p3Blocks.slice(0, Math.ceil(p3Blocks.length * 0.5)).forEach((block) => {
      block.title = repeatedTitle;
      block.titleFamily = 'repeated-terminal-family';
    });

    const quality = evaluateForState(state, blocks);
    expect(quality.reasonCodes).toContain('DUPLICATE_FORECAST_BLOCK_TITLE_BY_LANE_PHASE');
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
