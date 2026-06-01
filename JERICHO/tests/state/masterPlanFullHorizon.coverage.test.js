import { describe, expect, it } from 'vitest';

import {
  auditFullHorizonCoverage,
  getFullHorizonCoverageLabel,
} from '../../src/domain/masterPlan/fullHorizonCoverageAudit.js';
import { deriveMasterPlanPhaseModel } from '../../src/domain/masterPlan/masterPlanPhaseModel.js';
import { buildOperationEndgameState, getActivePlan, setHorizonMode } from '../helpers/masterPlanFullHorizonScenario.js';

function buildBaselineExpandedState() {
  return setHorizonMode(buildOperationEndgameState(), 'full_horizon');
}

function buildAudit(blocks, state = buildBaselineExpandedState()) {
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
  return auditFullHorizonCoverage({
    fullHorizonScheduleBlocks: blocks,
    phaseModel,
    fullHorizonStartDayKey: plan?.horizonStart,
    fullHorizonEndDayKey: plan?.fullHorizonEndDayKey || plan?.horizonEnd,
    laneModel: lanes,
    selectedHorizonMode: 'full_horizon',
  });
}

describe('master-plan full-horizon coverage audit', () => {
  it('fails fullHorizonCovered when the horizon resolves to May 2031 but work stops in April 2029', () => {
    const state = buildBaselineExpandedState();
    const truncated = (state.fullHorizonScheduleBlocks || []).filter((block) => String(block.dayKey || '') <= '2029-04-30');
    const audit = buildAudit(truncated, state);

    expect(audit.horizonResolved).toBe(true);
    expect(audit.horizonExpanded).toBe(true);
    expect(audit.fullHorizonCovered).toBe(false);
    expect(audit.lastMeaningfulWorkDate).toBe('2029-04-14');
    expect(audit.reasonCodes).toEqual(expect.arrayContaining(['FULL_HORIZON_WORK_STOPS_BEFORE_TERMINAL_DATE']));
  });

  it('lets terminal-stop failures still pass horizonResolved and horizonExpanded', () => {
    const state = buildBaselineExpandedState();
    const truncated = (state.fullHorizonScheduleBlocks || []).filter((block) => String(block.dayKey || '') <= '2029-04-30');
    const audit = buildAudit(truncated, state);

    expect(audit.horizonResolved).toBe(true);
    expect(audit.horizonExpanded).toBe(true);
  });

  it('emits terminal-work-stop reason codes when 2029-2031 are empty', () => {
    const state = buildBaselineExpandedState();
    const early = (state.fullHorizonScheduleBlocks || []).filter((block) => String(block.dayKey || '') < '2029-01-01');
    const audit = buildAudit(early, state);

    expect(audit.reasonCodes).toEqual(
      expect.arrayContaining(['FULL_HORIZON_WORK_STOPS_BEFORE_TERMINAL_DATE', 'YEAR_COVERAGE_GAP'])
    );
  });

  it('emits P3 terminal underpopulation when P3 is reduced to one terminal marker', () => {
    const state = buildBaselineExpandedState();
    const p3Minimal = (state.fullHorizonScheduleBlocks || []).filter(
      (block) => block.phaseLabel !== 'P3' || block.blockType === 'terminal-readiness'
    );
    const audit = buildAudit(p3Minimal, state);

    expect(audit.reasonCodes).toEqual(expect.arrayContaining(['P3_TERMINAL_HORIZON_UNDERPOPULATED']));
  });

  it('emits late-horizon density collapse when counts taper into near-zero before terminal horizon', () => {
    const state = buildBaselineExpandedState();
    const collapsed = (state.fullHorizonScheduleBlocks || []).filter((block) => {
      const year = String(block.dayKey || '').slice(0, 4);
      if (year === '2031') {
        return String(block.dayKey || '') === '2031-05-11';
      }
      if (year === '2030') {
        return String(block.dayKey || '').endsWith('-01');
      }
      return true;
    });
    const audit = buildAudit(collapsed, state);

    expect(audit.reasonCodes).toEqual(expect.arrayContaining(['LATE_HORIZON_DENSITY_COLLAPSE']));
  });

  it('passes fullHorizonCovered when meaningful work reaches through May 2031', () => {
    const state = buildBaselineExpandedState();
    const audit = buildAudit(state.fullHorizonScheduleBlocks || [], state);

    expect(audit.lastMeaningfulWorkDate).toBe('2031-05-11');
    expect(audit.fullHorizonCovered).toBe(true);
  });

  it('reports lastMeaningfulWorkDate explicitly', () => {
    const state = buildBaselineExpandedState();
    const audit = buildAudit(state.fullHorizonScheduleBlocks || [], state);

    expect(audit.lastMeaningfulWorkDate).toBeDefined();
    expect(audit.expectedTerminalDate).toBe('2031-05-11');
  });

  it('does not expose Full horizon covered label unless fullHorizonCovered is true', () => {
    const state = buildBaselineExpandedState();
    const truncated = (state.fullHorizonScheduleBlocks || []).filter((block) => String(block.dayKey || '') <= '2029-04-30');
    const incompleteAudit = buildAudit(truncated, state);
    const completeAudit = buildAudit(state.fullHorizonScheduleBlocks || [], state);

    expect(getFullHorizonCoverageLabel(incompleteAudit)).not.toBe('Full horizon covered');
    expect(getFullHorizonCoverageLabel(completeAudit)).toBe('Full horizon quality trusted');
  });

  it('keeps quality trust false until coverage passes first', () => {
    const state = buildBaselineExpandedState();
    const truncated = (state.fullHorizonScheduleBlocks || []).filter((block) => String(block.dayKey || '') <= '2029-04-30');
    const incompleteAudit = buildAudit(truncated, state);
    const completeAudit = buildAudit(state.fullHorizonScheduleBlocks || [], state);

    expect(incompleteAudit.fullHorizonQualityTrusted).toBe(false);
    expect(completeAudit.fullHorizonQualityTrusted).toBe(true);
  });
});
