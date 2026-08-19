import { describe, expect, it } from 'vitest';

import {
  auditFullHorizonRenderTruth,
  applyRenderTruthToCoverageAudit,
} from '../../src/domain/masterPlan/fullHorizonRenderTruthAudit.js';
import { buildOperationEndgameState, setHorizonMode } from '../helpers/masterPlanFullHorizonScenario.js';

function buildState() {
  return setHorizonMode(buildOperationEndgameState(), 'full_horizon');
}

function countYear(blocks = [], year) {
  return (blocks || []).filter((block) => String(block?.dayKey || block?.date || '').slice(0, 4) === year).length;
}

describe('master-plan full horizon render truth', () => {
  it('baseline fullHorizonScheduleBlocks includes blocks in 2030 and 2031', () => {
    const state = buildState();

    expect(countYear(state.fullHorizonScheduleBlocks, '2030')).toBeGreaterThan(0);
    expect(countYear(state.fullHorizonScheduleBlocks, '2031')).toBeGreaterThan(0);
  });

  it('calendarDisplayBlocks retains the same terminal-year block ids in full_horizon mode', () => {
    const state = buildState();
    const substrateTerminalIds = new Set(
      (state.fullHorizonScheduleBlocks || [])
        .filter((block) => ['2030', '2031'].includes(String(block?.dayKey || block?.date || '').slice(0, 4)))
        .map((block) => block.id)
    );
    const calendarTerminalIds = new Set(
      (state.calendarDisplayBlocks || [])
        .filter((block) => ['2030', '2031'].includes(String(block?.dayKey || block?.date || '').slice(0, 4)))
        .map((block) => block.id)
    );

    expect(substrateTerminalIds.size).toBeGreaterThan(0);
    expect(calendarTerminalIds).toEqual(substrateTerminalIds);
  });

  it('today year projection and visible sources retain planned work in 2030 and 2031', () => {
    const state = buildState();
    const renderTruth = auditFullHorizonRenderTruth({ state });

    expect(renderTruth.sources.todayYearProjectionSource.countByYear['2030']).toBeGreaterThan(0);
    expect(renderTruth.sources.todayYearProjectionSource.countByYear['2031']).toBeGreaterThan(0);
    expect(renderTruth.sources.structureDeliverablesSource.countByYear['2030']).toBeGreaterThan(0);
    expect(renderTruth.sources.structureDeliverablesSource.countByYear['2031']).toBeGreaterThan(0);
    expect(renderTruth.sources.planOverviewSource.countByYear['2030']).toBeGreaterThan(0);
    expect(renderTruth.sources.planOverviewSource.countByYear['2031']).toBeGreaterThan(0);
    expect(
      Object.values(renderTruth.todayYearProjection['2030'] || {}).some((plannedCount) => Number(plannedCount || 0) > 0)
    ).toBe(true);
    expect(
      Object.values(renderTruth.todayYearProjection['2031'] || {}).some((plannedCount) => Number(plannedCount || 0) > 0)
    ).toBe(true);
  });

  it('render truth audit emits mismatch codes when visible sources lose terminal years', () => {
    const state = buildState();
    const truncatedCalendarDisplayBlocks = (state.calendarDisplayBlocks || []).filter(
      (block) => String(block?.dayKey || block?.date || '') <= '2029-04-30'
    );

    const renderTruth = auditFullHorizonRenderTruth({
      state: { ...state, calendarDisplayBlocks: truncatedCalendarDisplayBlocks },
      fullHorizonScheduleBlocks: state.fullHorizonScheduleBlocks,
      calendarDisplayBlocks: truncatedCalendarDisplayBlocks,
    });

    expect(renderTruth.reasonCodes).toEqual(
      expect.arrayContaining([
        'COVERAGE_AUDIT_RENDER_SOURCE_MISMATCH',
        'TERMINAL_YEAR_RENDER_GAP',
        'FULL_HORIZON_BADGE_RENDER_CONTRADICTION',
      ])
    );
  });

  it('coverage cannot remain certified when render truth shows terminal-year gaps', () => {
    const state = buildState();
    const renderTruth = {
      reasonCodes: ['TERMINAL_YEAR_RENDER_GAP', 'FULL_HORIZON_BADGE_RENDER_CONTRADICTION'],
    };

    const merged = applyRenderTruthToCoverageAudit(state.fullHorizonCoverageAudit, renderTruth);

    expect(merged.fullHorizonCovered).toBe(false);
    expect(merged.reasonCodes).toEqual(
      expect.arrayContaining(['TERMINAL_YEAR_RENDER_GAP', 'FULL_HORIZON_BADGE_RENDER_CONTRADICTION'])
    );
  });
});
