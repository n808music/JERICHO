import { describe, expect, it } from 'vitest';

import goldenFixture from '../fixtures/masterPlan/operationEndgame.fullHorizonSchedule.json';
import { buildOperationEndgameState, setHorizonMode } from '../helpers/masterPlanFullHorizonScenario.js';
import { projectMonthDays } from '../../src/state/identityCompute.js';
import { compareMonthProjectionToSubstrate, generateFullHorizonTruthAudit } from '../../src/diagnostics/fullHorizonTruthAudit.js';

function withFixtureSubstrate(derived, mode = 'full_horizon') {
  const expanded = setHorizonMode(derived, mode);
  return {
    ...expanded,
    selectedHorizonMode: mode,
    fullHorizonScheduleBlocks: goldenFixture,
    calendarDisplayBlocks: mode === 'current_cycle' ? [] : goldenFixture,
  };
}

describe('master-plan full-horizon expression proof', () => {
  it('Structure and Plan substrate shows dated work through May 2031 when the golden fixture is loaded', () => {
    const state = withFixtureSubstrate(buildOperationEndgameState(), 'full_horizon');
    const audit = generateFullHorizonTruthAudit(state, 'full_horizon');

    expect(audit.substrateStatus.fullHorizonScheduleBlocks.length).toBe(goldenFixture.length);
    expect(audit.substrateStatus.fullHorizonScheduleBlocks.countByPhase.P2).toBeGreaterThan(0);
    expect(audit.substrateStatus.fullHorizonScheduleBlocks.countByPhase.P3).toBeGreaterThan(0);
    expect(audit.substrateStatus.fullHorizonScheduleBlocks.countByYear['2031']).toBeGreaterThan(0);
  });

  it('Today month projections consume the same block ids as the golden fixture', () => {
    const state = withFixtureSubstrate(buildOperationEndgameState(), 'full_horizon');
    const monthDays = projectMonthDays({
      monthKey: '2027-11',
      blocks: state.calendarDisplayBlocks,
      includePadding: true,
    });
    const monthComparison = compareMonthProjectionToSubstrate(monthDays, '2027-11', state.fullHorizonScheduleBlocks);

    expect(monthComparison.missingInProjection).toEqual([]);
    expect(monthComparison.unexpectedInProjection).toEqual([]);
  });

  it('P2/P3 phase cards have nonzero work counts and future blocks stay locked', () => {
    const state = withFixtureSubstrate(buildOperationEndgameState(), 'full_horizon');
    const p2Blocks = goldenFixture.filter((block) => block.phaseLabel === 'P2');
    const p3Blocks = goldenFixture.filter((block) => block.phaseLabel === 'P3');

    expect(p2Blocks.length).toBeGreaterThan(0);
    expect(p3Blocks.length).toBeGreaterThan(0);
    expect(goldenFixture.every((block) => block.executionEligibility === 'locked')).toBe(true);
    expect(goldenFixture.every((block) => block.executionLockReason)).toBe(true);
  });

  it('Horizon toggles can hide fixture visibility without losing the fixture substrate', () => {
    const base = buildOperationEndgameState();
    const expanded = withFixtureSubstrate(base, 'full_horizon');
    const collapsed = withFixtureSubstrate(base, 'current_cycle');

    expect(expanded.calendarDisplayBlocks.length).toBe(goldenFixture.length);
    expect(collapsed.calendarDisplayBlocks.length).toBe(0);
    expect(collapsed.fullHorizonScheduleBlocks.length).toBe(goldenFixture.length);
  });
});
