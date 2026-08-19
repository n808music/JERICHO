import { describe, expect, it } from 'vitest';

import { projectMonthDays } from '../../src/state/identityCompute.js';
import { projectBlockForDisplay } from '../../src/domain/masterPlan/blockDisplayProjection.js';
import { auditFullHorizonCoverage } from '../../src/domain/masterPlan/fullHorizonCoverageAudit.js';
import { evaluateFullHorizonPlanQuality } from '../../src/domain/masterPlan/fullHorizonPlanQuality.js';
import { deriveMasterPlanPhaseModel } from '../../src/domain/masterPlan/masterPlanPhaseModel.js';
import { buildFullHorizonMultiLaneFixtureState, getActivePlan, setHorizonMode } from '../helpers/masterPlanFullHorizonScenario.js';

function buildGeneratedState(options = {}) {
  return setHorizonMode(buildFullHorizonMultiLaneFixtureState(options), 'full_horizon');
}

function buildQualityContext(state) {
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
  const coverageAudit = auditFullHorizonCoverage({
    fullHorizonScheduleBlocks: state.fullHorizonScheduleBlocks || [],
    phaseModel,
    fullHorizonStartDayKey: plan?.horizonStart,
    fullHorizonEndDayKey: plan?.fullHorizonEndDayKey || plan?.horizonEnd,
    laneModel: lanes,
    selectedHorizonMode: state?.selectedHorizonMode || 'full_horizon',
  });
  return { plan, lanes, phaseModel, coverageAudit };
}

describe('master-plan block display projection', () => {
  it('preserves canonical title while generating a shorter display title', () => {
    const canonicalTitle =
      'Assess product/software onboarding evidence against P2 conversion-readiness criteria for Operation Endgame app platform using first-cohort completion data for the Apr 2027 review window';
    const projected = projectBlockForDisplay({
      id: 'block-1',
      title: canonicalTitle,
      dayKey: '2027-04-16',
      phaseLabel: 'P2',
      laneLabel: 'Product/software',
      commitmentState: 'locked',
    });

    expect(projected.title).toBe(canonicalTitle);
    expect(projected.canonicalTitle).toBe(canonicalTitle);
    expect(projected.detailTitle).toBe(canonicalTitle);
    expect(projected.displayTitle.length).toBeLessThan(canonicalTitle.length);
    expect(projected.displayTitle).toMatch(/Assess product\/software onboarding evidence against P2 conversion criteria/i);
    expect(projected.displayMeta).toMatchObject({
      phaseLabel: 'P2',
      laneLabel: 'Product/software',
      commitmentState: 'locked',
      dayKey: '2027-04-16',
    });
  });

  it('attaches display titles to generated full-horizon blocks without changing canonical titles', () => {
    const state = buildGeneratedState();
    const blocks = state.fullHorizonScheduleBlocks || [];
    const shortened = blocks.find(
      (block) =>
        String(block.canonicalTitle || '').length > 0 &&
        String(block.displayTitle || '').length > 0 &&
        String(block.displayTitle || '').length < String(block.canonicalTitle || '').length
    );

    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every((block) => String(block.canonicalTitle || '').trim().length > 0)).toBe(true);
    expect(blocks.every((block) => String(block.detailTitle || '').trim() === String(block.canonicalTitle || '').trim())).toBe(true);
    expect(shortened).toBeTruthy();
    expect(shortened.title).toBe(shortened.canonicalTitle);
  });

  it('calendar month projection retains display and detail fields for drill-down inspection', () => {
    const state = buildGeneratedState();
    const shortened = (state.calendarDisplayBlocks || []).find(
      (block) => String(block.displayTitle || '').length < String(block.canonicalTitle || '').length && block.dayKey
    );

    expect(shortened).toBeTruthy();
    const monthDays = projectMonthDays({
      monthKey: shortened.dayKey.slice(0, 7),
      blocks: state.calendarDisplayBlocks,
      includePadding: false,
    });
    const day = monthDays.find((entry) => entry.date === shortened.dayKey);
    const projectedBlock = (day?.blocks || []).find((block) => block.id === shortened.id);

    expect(projectedBlock).toMatchObject({
      id: shortened.id,
      canonicalTitle: shortened.canonicalTitle,
      displayTitle: shortened.displayTitle,
      detailTitle: shortened.detailTitle,
      expectedOutput: shortened.expectedOutput,
      derivationReason: shortened.derivationReason,
    });
  });

  it('quality evaluation continues to trust canonical titles even if display titles are compressed further', () => {
    const state = buildGeneratedState();
    const { plan, lanes, phaseModel, coverageAudit } = buildQualityContext(state);
    const blocks = (state.fullHorizonScheduleBlocks || []).map((block) => ({
      ...block,
      displayTitle: 'Review',
    }));

    const quality = evaluateFullHorizonPlanQuality({
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

    expect(quality.state).toBe('trusted');
    expect(quality.reasonCodes || []).toEqual([]);
  });
});
