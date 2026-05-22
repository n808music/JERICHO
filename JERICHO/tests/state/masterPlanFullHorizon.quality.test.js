import { describe, expect, it } from 'vitest';

import { auditFullHorizonCoverage } from '../../src/domain/masterPlan/fullHorizonCoverageAudit.js';
import { evaluateFullHorizonPlanQuality } from '../../src/domain/masterPlan/fullHorizonPlanQuality.js';
import { deriveMasterPlanPhaseModel } from '../../src/domain/masterPlan/masterPlanPhaseModel.js';
import { buildOperationEndgameFixtureState } from '../../src/dev/operationEndgameRestore.js';
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
  const { plan, lanes, phaseModel } = buildContext(state);
  const coverageAudit = auditFullHorizonCoverage({
    fullHorizonScheduleBlocks: blocks,
    phaseModel,
    fullHorizonStartDayKey: plan?.horizonStart,
    fullHorizonEndDayKey: plan?.fullHorizonEndDayKey || plan?.horizonEnd,
    laneModel: lanes,
    selectedHorizonMode: state?.selectedHorizonMode || 'full_horizon',
  });
  return evaluateFullHorizonPlanQuality({
    fullHorizonScheduleBlocks: blocks,
    fullHorizonCoverageAudit: coverageAudit,
    phaseModel,
    laneModel: lanes,
    masterPlanContract: plan,
    anchors: plan?.anchors || [],
    successStandard: plan?.successStandard || null,
    outcomeTarget: plan?.outcomeTarget || null,
    constraints: plan?.financialConstraint || plan?.constraints || null,
  });
}

function cloneBlocks(blocks) {
  return JSON.parse(JSON.stringify(blocks || []));
}

describe('master-plan full-horizon quality gate', () => {
  it('keeps the baseline Operation Endgame schedule covered but provisional when P2 milestone density and spacing remain thin', () => {
    const state = buildGeneratedState();
    const quality = state.fullHorizonPlanQuality;

    expect(state.fullHorizonCoverageAudit?.fullHorizonCovered).toBe(true);
    expect(state.fullHorizonCoverageAudit?.fullHorizonQualityTrusted).toBe(false);
    expect(quality?.state).toBe('provisional');
    expect(Number(quality?.score || 0)).toBeGreaterThanOrEqual(80);
    expect(quality?.reasonCodes || []).not.toContain('PHASE_NAMED_MILESTONES_MISSING');
    expect(quality?.reasonCodes || []).not.toContain('PHASE_NAMED_MILESTONES_MISSING_P2');
    expect(quality?.reasonCodes || []).toContain('PHASE_MILESTONE_DENSITY_THIN');
    expect(quality?.reasonCodes || []).toContain('PHASE_MILESTONE_DENSITY_THIN_P2');
    expect(quality?.reasonCodes || []).toContain('PHASE_MILESTONE_TIME_DISTRIBUTION_THIN');
    expect(quality?.reasonCodes || []).toContain('PHASE_MILESTONE_TIME_DISTRIBUTION_THIN_P2');
  });

  it('keeps expectedOutput populated across the trusted baseline schedule', () => {
    const state = buildGeneratedState();

    expect((state.fullHorizonScheduleBlocks || []).every((block) => String(block.expectedOutput || '').trim().length > 0)).toBe(true);
  });

  it('keeps lane/object context populated across the trusted baseline schedule', () => {
    const state = buildGeneratedState();
    const missingContext = (state.fullHorizonScheduleBlocks || []).filter((block) => {
      const title = String(block.title || '');
      return !/(lane|operation endgame|app platform|album release engine|pipeline|system|bridge|thesis|design|development)/i.test(
        title
      );
    });

    expect(missingContext).toEqual([]);
  });

  it('keeps baseline title repetition below the trusted threshold', () => {
    const state = buildGeneratedState();
    const counts = new Map();
    for (const block of state.fullHorizonScheduleBlocks || []) {
      const title = String(block.title || '');
      counts.set(title, (counts.get(title) || 0) + 1);
    }

    expect(Math.max(...counts.values())).toBeLessThanOrEqual(18);
  });

  it('keeps professionalism repetition below the trusted threshold', () => {
    const quality = evaluateForState(buildGeneratedState());

    expect(quality.dimensions.precision.reasonCodes).not.toContain('PRECISION_TEMPLATE_REPETITION');
    expect(quality.dimensions.professionalism.reasonCodes).not.toContain('PROFESSIONALISM_REPETITIVE_BLOCK_PATTERN');
  });

  it('captures P2 conversion-system work in the baseline schedule', () => {
    const quality = evaluateForState(buildGeneratedState());

    expect(quality.dimensions.progression.reasonCodes).not.toContain('PROGRESSION_P2_LACKS_CONVERSION_SYSTEM');
  });

  it('captures P2 operating cadence work in the baseline schedule', () => {
    const quality = evaluateForState(buildGeneratedState());

    expect(quality.dimensions.progression.reasonCodes).not.toContain('PROGRESSION_P2_LACKS_OPERATING_CADENCE');
  });

  it('captures P2 revenue architecture or monetization validation work in the baseline schedule', () => {
    const quality = evaluateForState(buildGeneratedState());

    expect(quality.dimensions.progression.reasonCodes).not.toContain('PROGRESSION_P2_LACKS_REVENUE_ARCHITECTURE');
  });

  it('keeps P2 lane maturation and repeatable loop work in the baseline schedule', () => {
    const state = buildGeneratedState();
    const p2Titles = (state.fullHorizonScheduleBlocks || [])
      .filter((block) => block.phaseLabel === 'P2')
      .map((block) => `${block.title} ${block.expectedOutput || ''}`.toLowerCase());

    expect(p2Titles.some((text) => /repeatable|expansion readiness|operating cadence|conversion/.test(text))).toBe(true);
  });

  it('captures P3 terminal-readiness work in the baseline schedule', () => {
    const quality = evaluateForState(buildGeneratedState());

    expect(quality.dimensions.progression.reasonCodes).not.toContain('PROGRESSION_P3_LACKS_TERMINAL_READINESS');
  });

  it('captures P3 scale-readiness work in the baseline schedule', () => {
    const quality = evaluateForState(buildGeneratedState());

    expect(quality.dimensions.progression.reasonCodes).not.toContain('PROGRESSION_P3_LACKS_SCALE_READINESS');
  });

  it('captures P3 delegation or institutionalization work in the baseline schedule', () => {
    const state = buildGeneratedState();
    const p3Texts = (state.fullHorizonScheduleBlocks || [])
      .filter((block) => block.phaseLabel === 'P3')
      .map((block) => `${block.title} ${block.expectedOutput || ''} ${block.derivationReason || ''}`.toLowerCase());

    expect(p3Texts.some((text) => /delegation|institutional|operating system|coalition|charter/.test(text))).toBe(true);
  });

  it('captures P3 outcome-target gap or evidence review work in the baseline schedule', () => {
    const state = buildGeneratedState();
    const p3Texts = (state.fullHorizonScheduleBlocks || [])
      .filter((block) => block.phaseLabel === 'P3')
      .map((block) => `${block.title} ${block.successCriterionServed || ''}`.toLowerCase());

    expect(p3Texts.some((text) => /outcome target|success standard|terminal-readiness|evidence/.test(text))).toBe(true);
  });

  it('fails precision when vague titles are injected', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks);
    blocks[0].title = 'Review';

    const quality = evaluateForState(state, blocks);
    expect(quality.dimensions.precision.reasonCodes).toContain('PRECISION_VAGUE_TITLE');
  });

  it('fails precision and professionalism when expectedOutput is removed', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks);
    blocks[0].expectedOutput = '';

    const quality = evaluateForState(state, blocks);
    expect(quality.dimensions.precision.reasonCodes).toContain('PRECISION_MISSING_EXPECTED_OUTPUT');
  });

  it('fails professionalism when lineage inputs are removed', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks);
    blocks[0].sourceInputs = [];
    blocks[0].derivationReason = '';

    const quality = evaluateForState(state, blocks);
    expect(quality.dimensions.professionalism.reasonCodes).toContain('PROFESSIONALISM_INSUFFICIENT_LINEAGE');
  });

  it('fails professionalism when template repetition dominates the schedule', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks).map((block) => ({
      ...block,
      title: `Repeat template ${block.phaseLabel}`,
    }));

    const quality = evaluateForState(state, blocks);
    expect(quality.dimensions.professionalism.reasonCodes).toContain('PROFESSIONALISM_REPETITIVE_BLOCK_PATTERN');
  });

  it('fails pacing when quarter and year gaps are introduced', () => {
    const state = buildGeneratedState();
    const blocks = (state.fullHorizonScheduleBlocks || []).filter(
      (block) =>
        String(block.dayKey || '') < '2029-01-01' ||
        String(block.dayKey || '') === '2029-01-01' ||
        String(block.dayKey || '') === '2031-05-11'
    );

    const quality = evaluateForState(state, blocks);
    expect(quality.dimensions.pacing.reasonCodes).toEqual(
      expect.arrayContaining(['PACING_YEAR_GAP', 'PACING_QUARTER_GAP', 'PACING_LATE_HORIZON_DENSITY_COLLAPSE'])
    );
  });

  it('fails pacing when same-day pileups are introduced', () => {
    const state = buildGeneratedState();
    const pileupDay = '2028-07-01';
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks).map((block, index) =>
      index < 24 ? { ...block, dayKey: pileupDay, date: pileupDay } : block
    );

    const quality = evaluateForState(state, blocks);
    expect(quality.dimensions.pacing.reasonCodes).toContain('PACING_SINGLE_DAY_PILEUP');
  });

  it('fails progression when P3 is overwritten with launch-style P1 work', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks).map((block) =>
      block.phaseLabel === 'P3'
        ? {
            ...block,
            title: 'Launch release asset for creative lane',
            expectedOutput: 'Launch artifact shipped',
          }
        : block
    );

    const quality = evaluateForState(state, blocks);
    expect(quality.dimensions.progression.reasonCodes).toContain('PROGRESSION_LATER_PHASE_REPEATS_P1');
  });

  it('keeps the capital lane gated when capital remains zero', () => {
    const state = buildGeneratedState({ capitalAvailable: 0 });
    const capitalBlocks = (state.fullHorizonScheduleBlocks || []).filter((block) =>
      /real estate|capital/i.test(String(block.laneLabel || ''))
    );

    expect(capitalBlocks.length).toBeGreaterThan(0);
    expect(capitalBlocks.every((block) => block.executionEligibility === 'locked')).toBe(true);
    expect(capitalBlocks.every((block) => block.blockType !== 'action')).toBe(true);
  });

  it('narrows institution, civic, and capital expansion when the success standard narrows', () => {
    const baseline = buildGeneratedState();
    const narrowed = buildGeneratedState({
      successStandard: 'Build a single profitable product line with repeatable conversion and no ecosystem expansion.',
    });
    const baselineStrategic = (baseline.fullHorizonScheduleBlocks || []).filter((block) =>
      /institution|civic|district|capital|real estate/i.test(String(block.laneLabel || ''))
    );
    const narrowedStrategic = (narrowed.fullHorizonScheduleBlocks || []).filter((block) =>
      /institution|civic|district|capital|real estate/i.test(String(block.laneLabel || ''))
    );

    expect(narrowedStrategic.length).toBeLessThan(baselineStrategic.length);
    expect(['trusted', 'provisional']).toContain(narrowed.fullHorizonPlanQuality?.state);
  });

  it('moves downstream P2 timing when the first hard anchor moves later while preserving acceptable quality', () => {
    const baseline = buildGeneratedState();
    const delayed = buildGeneratedState({ anchorDate: '2027-03-15' });
    const baselineFirstP2 = (baseline.fullHorizonScheduleBlocks || []).find((block) => block.phaseLabel === 'P2');
    const delayedFirstP2 = (delayed.fullHorizonScheduleBlocks || []).find((block) => block.phaseLabel === 'P2');

    expect(delayedFirstP2.dayKey > baselineFirstP2.dayKey).toBe(true);
    expect(['trusted', 'provisional']).toContain(delayed.fullHorizonPlanQuality?.state);
  });

  it('keeps quality trust false when coverage passes but schedule quality degrades', () => {
    const state = buildGeneratedState();
    const blocks = cloneBlocks(state.fullHorizonScheduleBlocks).map((block, index) => ({
      ...block,
      title: index % 2 === 0 ? 'Review' : block.title,
      expectedOutput: index % 3 === 0 ? '' : block.expectedOutput,
    }));

    const quality = evaluateForState(state, blocks);
    const audit = {
      ...state.fullHorizonCoverageAudit,
      fullHorizonQualityTrusted: quality.state === 'trusted',
    };

    expect(state.fullHorizonCoverageAudit?.fullHorizonCovered).toBe(true);
    expect(quality.state).not.toBe('trusted');
    expect(audit.fullHorizonQualityTrusted).toBe(false);
    expect(quality.reasonCodes).toContain('COVERAGE_PASSED_BUT_QUALITY_DEGRADED');
  });

  it('does not silently trust a major middle phase with zero named milestones', () => {
    const state = buildOperationEndgameFixtureState();
    const plan = state.masterPlansById[state.profilesById[state.activeProfileId].activeMasterPlanId];
    const p2LaneIds = (plan?.laneIds || []).filter((laneId) => {
      const lane = state?.masterPlanLanesById?.[laneId];
      const domain = String(lane?.domain || '').trim().toLowerCase();
      return ['product', 'media', 'brand', 'income'].includes(domain);
    });
    p2LaneIds.forEach((laneId) => {
      const lane = state?.masterPlanLanesById?.[laneId];
      if (!lane) {
        return;
      }
      const remainingIds = [];
      (lane.milestoneIds || []).forEach((milestoneId) => {
        const milestone = state?.masterPlanMilestonesById?.[milestoneId];
        const targetDate = String(milestone?.targetDate || '').trim();
        if (targetDate >= '2027-01-01' && targetDate <= '2028-06-14') {
          delete state.masterPlanMilestonesById[milestoneId];
          return;
        }
        remainingIds.push(milestoneId);
      });
      lane.milestoneIds = remainingIds;
    });
    state.fullHorizonCoverageAudit = null;
    state.fullHorizonPlanQuality = null;
    const recomputed = buildContext(state);
    const coverageAudit = auditFullHorizonCoverage({
      fullHorizonScheduleBlocks: state.fullHorizonScheduleBlocks || [],
      phaseModel: recomputed.phaseModel,
      fullHorizonStartDayKey: plan?.horizonStart,
      fullHorizonEndDayKey: plan?.fullHorizonEndDayKey || plan?.horizonEnd,
      laneModel: recomputed.lanes,
      selectedHorizonMode: state?.selectedHorizonMode || 'full_horizon',
    });
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
    const quality = evaluateFullHorizonPlanQuality({
      fullHorizonScheduleBlocks: state.fullHorizonScheduleBlocks || [],
      fullHorizonCoverageAudit: coverageAudit,
      phaseModel,
      laneModel: lanes,
      masterPlanContract: plan,
      anchors: plan?.anchors || [],
      successStandard: plan?.successStandard || null,
      outcomeTarget: plan?.outcomeTarget || null,
      constraints: plan?.financialConstraint || plan?.constraints || null,
    });

    expect(phaseModel.phases.find((phase) => phase.label === 'P2')?.milestones || []).toHaveLength(0);
    expect(phaseModel.phases.find((phase) => phase.label === 'P2')?.anchorsInPhase || []).toHaveLength(1);
    expect((coverageAudit?.coverageByPhase?.P2?.blockCount || 0)).toBeGreaterThan(0);
    expect(quality.state).toBe('provisional');
    expect(quality.reasonCodes).toContain('PHASE_NAMED_MILESTONES_MISSING');
    expect(quality.reasonCodes).toContain('PHASE_NAMED_MILESTONES_MISSING_P2');
  });

  it('flags active-lane milestone coverage gaps when only a minority of active P2 lanes have named milestones', () => {
    const state = buildOperationEndgameFixtureState();
    const plan = state.masterPlansById[state.profilesById[state.activeProfileId].activeMasterPlanId];
    const p2LaneIds = (plan?.laneIds || []).filter((laneId) => {
      const lane = state?.masterPlanLanesById?.[laneId];
      const domain = String(lane?.domain || '').trim().toLowerCase();
      return ['product', 'creative', 'media', 'brand', 'income'].includes(domain);
    });
    p2LaneIds.forEach((laneId) => {
      const lane = state?.masterPlanLanesById?.[laneId];
      if (!lane) {
        return;
      }
      if (String(lane?.domain || '').trim().toLowerCase() === 'brand') {
        return;
      }
      const remainingIds = [];
      (lane.milestoneIds || []).forEach((milestoneId) => {
        const milestone = state?.masterPlanMilestonesById?.[milestoneId];
        const targetDate = String(milestone?.targetDate || '').trim();
        if (targetDate >= '2027-01-01' && targetDate <= '2028-06-14') {
          delete state.masterPlanMilestonesById[milestoneId];
          return;
        }
        remainingIds.push(milestoneId);
      });
      lane.milestoneIds = remainingIds;
    });

    const planAfter = state.masterPlansById[state.profilesById[state.activeProfileId].activeMasterPlanId];
    const lanes = Array.isArray(planAfter?.laneIds)
      ? planAfter.laneIds.map((laneId) => state?.masterPlanLanesById?.[laneId]).filter(Boolean)
      : [];
    const milestones = lanes.flatMap((lane) =>
      Array.isArray(lane?.milestoneIds)
        ? lane.milestoneIds.map((milestoneId) => state?.masterPlanMilestonesById?.[milestoneId]).filter(Boolean)
        : []
    );
    const phaseModel = deriveMasterPlanPhaseModel({
      plan: planAfter,
      lanes,
      milestones,
      anchors: Array.isArray(planAfter?.anchors) ? planAfter.anchors : [],
      planCycle: null,
      committedBlocks: [],
      criticQuestionsByLane: {},
    });
    const coverageAudit = auditFullHorizonCoverage({
      fullHorizonScheduleBlocks: state.fullHorizonScheduleBlocks || [],
      phaseModel,
      fullHorizonStartDayKey: planAfter?.horizonStart,
      fullHorizonEndDayKey: planAfter?.fullHorizonEndDayKey || planAfter?.horizonEnd,
      laneModel: lanes,
      selectedHorizonMode: state?.selectedHorizonMode || 'full_horizon',
    });
    const quality = evaluateFullHorizonPlanQuality({
      fullHorizonScheduleBlocks: state.fullHorizonScheduleBlocks || [],
      fullHorizonCoverageAudit: coverageAudit,
      phaseModel,
      laneModel: lanes,
      masterPlanContract: planAfter,
      anchors: planAfter?.anchors || [],
      successStandard: planAfter?.successStandard || null,
      outcomeTarget: planAfter?.outcomeTarget || null,
      constraints: planAfter?.financialConstraint || planAfter?.constraints || null,
    });

    expect(quality.reasonCodes).toContain('PHASE_ACTIVE_LANE_MILESTONE_COVERAGE_THIN');
    expect(quality.reasonCodes).toContain('PHASE_ACTIVE_LANE_MILESTONE_COVERAGE_THIN_P2');
  });
});
