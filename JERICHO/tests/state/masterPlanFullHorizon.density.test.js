import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { deriveMasterPlanPhaseModel } from '../../src/domain/masterPlan/masterPlanPhaseModel.js';
import { buildOperationEndgameState } from '../helpers/masterPlanFullHorizonScenario.js';

function countBlocksByYear(blocks) {
  return blocks.reduce((counts, block) => {
    const year = String(block?.dayKey || '').slice(0, 4);
    if (!year) return counts;
    counts[year] = (counts[year] || 0) + 1;
    return counts;
  }, {});
}

function getLaneGapDays(blocks) {
  const byLane = blocks.reduce((acc, block) => {
    if (!block?.laneId || !block?.dayKey) return acc;
    acc[block.laneId] = acc[block.laneId] || [];
    acc[block.laneId].push(block.dayKey);
    return acc;
  }, {});

  const dayKeyToDate = (key) => new Date(`${key}T12:00:00.000Z`);
  return Object.values(byLane).reduce((maxGap, laneDays) => {
    const sorted = laneDays
      .map(dayKeyToDate)
      .sort((a, b) => a - b);
    const laneMax = sorted.slice(1).reduce((laneGap, date, index) => {
      const previous = sorted[index];
      const gap = Math.round((date - previous) / (1000 * 60 * 60 * 24));
      return Math.max(laneGap, gap);
    }, 0);
    return Math.max(maxGap, laneMax);
  }, 0);
}

function countFinal12Months(blocks, horizonEndDayKey) {
  const endDate = new Date(`${horizonEndDayKey}T12:00:00.000Z`);
  const startDate = new Date(endDate);
  startDate.setUTCMonth(startDate.getUTCMonth() - 12);
  return blocks.filter((block) => {
    if (!block?.dayKey) return false;
    const date = new Date(`${block.dayKey}T12:00:00.000Z`);
    return date >= startDate && date <= endDate;
  });
}

function getActivePlan(derived) {
  return Object.values(derived.masterPlansById || {})[0] || null;
}

function setFullHorizonMode(derived) {
  return computeDerivedState(derived, { type: 'SET_SELECTED_HORIZON_MODE', mode: 'full_horizon' });
}

describe('master-plan full-horizon density correction', () => {
  it('keeps terminal year density above 35% of the plan peak year', () => {
    const derived = setFullHorizonMode(buildOperationEndgameState());
    const blocks = Array.isArray(derived.fullHorizonScheduleBlocks) ? derived.fullHorizonScheduleBlocks : [];
    const counts = countBlocksByYear(blocks);
    const peakYearCount = Math.max(...Object.values(counts), 0);
    const terminalYearCount = counts['2031'] || 0;

    expect(peakYearCount).toBeGreaterThan(0);
    expect(terminalYearCount / peakYearCount).toBeGreaterThanOrEqual(0.35);
  });

  it('keeps P3 starting before the final 12 months so it is not only a terminal review tail', () => {
    const derived = setFullHorizonMode(buildOperationEndgameState());
    const plan = getActivePlan(derived);
    const blocks = Array.isArray(derived.fullHorizonScheduleBlocks) ? derived.fullHorizonScheduleBlocks : [];
    const lanes = (plan?.laneIds || []).map((id) => derived.masterPlanLanesById?.[id]).filter(Boolean);
    const milestones = lanes.flatMap((lane) => (lane.milestoneIds || []).map((id) => derived.masterPlanMilestonesById?.[id]).filter(Boolean));
    const phaseModel = deriveMasterPlanPhaseModel({ plan, lanes, milestones, anchors: plan?.anchors || [], planCycle: null, committedBlocks: [], criticQuestionsByLane: {} });
    const p3 = phaseModel?.phases?.find((phase) => phase.label === 'P3');

    expect(p3).toBeTruthy();
    expect(p3?.startBoundary <= '2030-05-11').toBe(true);
    expect(blocks.filter((block) => block.phaseLabel === 'P3').length).toBeGreaterThan(0);
  });

  it('avoids active primary lane gaps beyond 45 days in the restored agenda', () => {
    const derived = setFullHorizonMode(buildOperationEndgameState());
    const plan = getActivePlan(derived);
    const laneIds = Array.isArray(plan?.laneIds) ? plan.laneIds : [];
    const blocks = Array.isArray(derived.fullHorizonScheduleBlocks) ? derived.fullHorizonScheduleBlocks : [];
    const relevantBlocks = blocks.filter((block) => laneIds.includes(block?.laneId));

    expect(getLaneGapDays(relevantBlocks)).toBeLessThanOrEqual(45);
  });

  it('does not create executable future forecast blocks in full-horizon agenda', () => {
    const derived = setFullHorizonMode(buildOperationEndgameState());
    const blocks = Array.isArray(derived.fullHorizonScheduleBlocks) ? derived.fullHorizonScheduleBlocks : [];

    expect(blocks.every((block) => block?.executionEligibility === 'locked' || block?.executionEligibility === false || block?.executionEligibility == null)).toBe(true);
  });

  it('keeps P3 as a meaningful phase with a substantial duration and lane coverage', () => {
    const derived = setFullHorizonMode(buildOperationEndgameState());
    const plan = getActivePlan(derived);
    const blocks = Array.isArray(derived.fullHorizonScheduleBlocks) ? derived.fullHorizonScheduleBlocks : [];
    const lanes = (plan?.laneIds || []).map((id) => derived.masterPlanLanesById?.[id]).filter(Boolean);
    const milestones = lanes.flatMap((lane) => (lane.milestoneIds || []).map((id) => derived.masterPlanMilestonesById?.[id]).filter(Boolean));
    const phaseModel = deriveMasterPlanPhaseModel({ plan, lanes, milestones, anchors: plan?.anchors || [], planCycle: null, committedBlocks: [], criticQuestionsByLane: {} });
    const p3 = phaseModel?.phases?.find((phase) => phase.label === 'P3');
    const totalDays = Math.max(1, Math.round((new Date(`${plan.fullHorizonEndDayKey}T12:00:00.000Z`) - new Date(`${plan.horizonStart}T12:00:00.000Z`)) / (1000 * 60 * 60 * 24)) + 1);
    const p3Days = p3 ? Math.max(1, Math.round((new Date(`${p3.endBoundary}T12:00:00.000Z`) - new Date(`${p3.startBoundary}T12:00:00.000Z`)) / (1000 * 60 * 60 * 24)) + 1) : 0;
    const p3Blocks = blocks.filter((block) => block.phaseLabel === 'P3');
    const p3Lanes = new Set(p3Blocks.map((block) => block.laneId).filter(Boolean));

    expect(plan.fullHorizonEndDayKey).toBe('2031-05-11');
    expect(p3).toBeTruthy();
    expect(p3Days / totalDays).toBeGreaterThanOrEqual(0.20);
    expect(p3Blocks.length).toBeGreaterThanOrEqual(120);
    expect(p3Lanes.size).toBeGreaterThanOrEqual(6);
  });

  it('keeps a real P2 to P3 handoff buffer so scale is not just a next-day tail', () => {
    const derived = setFullHorizonMode(buildOperationEndgameState());
    const plan = getActivePlan(derived);
    const lanes = (plan?.laneIds || []).map((id) => derived.masterPlanLanesById?.[id]).filter(Boolean);
    const milestones = lanes.flatMap((lane) => (lane.milestoneIds || []).map((id) => derived.masterPlanMilestonesById?.[id]).filter(Boolean));
    const phaseModel = deriveMasterPlanPhaseModel({ plan, lanes, milestones, anchors: plan?.anchors || [], planCycle: null, committedBlocks: [], criticQuestionsByLane: {} });
    const p2 = phaseModel?.phases?.find((phase) => phase.label === 'P2');
    const p3 = phaseModel?.phases?.find((phase) => phase.label === 'P3');
    const p2End = new Date(`${p2?.endBoundary}T12:00:00.000Z`);
    const p3Start = new Date(`${p3?.startBoundary}T12:00:00.000Z`);
    const bufferDays = Math.round((p3Start - p2End) / (1000 * 60 * 60 * 24)) - 1;

    expect(p2).toBeTruthy();
    expect(p3).toBeTruthy();
    expect(bufferDays).toBeGreaterThanOrEqual(7);
  });
});
