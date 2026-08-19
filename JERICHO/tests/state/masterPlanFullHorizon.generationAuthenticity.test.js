import { describe, expect, it } from 'vitest';

import goldenFixture from '../fixtures/masterPlan/operationEndgame.fullHorizonSchedule.json';
import { validateBlockTitle } from '../../src/domain/masterPlan/forecastBlockDerivation.js';
import { buildOperationEndgameState, setHorizonMode, getActivePlan } from '../helpers/masterPlanFullHorizonScenario.js';

function buildGeneratedState(options = {}) {
  return setHorizonMode(buildOperationEndgameState(options), 'full_horizon');
}

function getGeneratedBlocks(state) {
  return state.fullHorizonScheduleBlocks || [];
}

function summarize(blocks) {
  return blocks.reduce(
    (acc, block) => {
      const year = String(block.dayKey || '').slice(0, 4);
      acc.phaseCounts[block.phaseLabel] = (acc.phaseCounts[block.phaseLabel] || 0) + 1;
      acc.laneCounts[block.laneId] = (acc.laneCounts[block.laneId] || 0) + 1;
      acc.blockTypeCounts[block.blockType] = (acc.blockTypeCounts[block.blockType] || 0) + 1;
      acc.yearCounts[year] = (acc.yearCounts[year] || 0) + 1;
      return acc;
    },
    { phaseCounts: {}, laneCounts: {}, blockTypeCounts: {}, yearCounts: {} }
  );
}

function titleSet(blocks) {
  return new Set(blocks.map((block) => block.title));
}

function symmetricTitleDifference(left, right) {
  const leftOnly = [...left].filter((title) => !right.has(title));
  const rightOnly = [...right].filter((title) => !left.has(title));
  return leftOnly.length + rightOnly.length;
}

describe('master-plan full-horizon generation proof', () => {
  it('generates dated P1/P2/P3 work through 2031 with lane coverage, block variety, and lineage', () => {
    const state = buildGeneratedState();
    const plan = getActivePlan(state);
    const blocks = getGeneratedBlocks(state);
    const summary = summarize(blocks);
    const representedLanes = new Set(blocks.map((block) => block.laneId).filter(Boolean));

    expect(plan?.fullHorizonEndDayKey).toMatch(/^2031/);
    expect(summary.phaseCounts.P1).toBeGreaterThan(20);
    expect(summary.phaseCounts.P2).toBeGreaterThan(20);
    expect(summary.phaseCounts.P3).toBeGreaterThan(8);
    expect(summary.yearCounts['2031']).toBeGreaterThan(0);
    expect(summary.blockTypeCounts.action).toBeGreaterThan(0);
    expect(summary.blockTypeCounts.review).toBeGreaterThan(0);
    expect(summary.blockTypeCounts.gate).toBeGreaterThan(0);
    expect(summary.blockTypeCounts.validation).toBeGreaterThan(0);
    expect(summary.blockTypeCounts.audit).toBeGreaterThan(0);
    expect(summary.blockTypeCounts.readiness).toBeGreaterThan(0);
    expect(summary.blockTypeCounts['terminal-readiness']).toBeGreaterThan(0);
    // Allow for the cross-lane terminal-readiness block which carries its own
    // dedicated laneId (cross_lane_terminal_review) outside plan.laneIds.
    plan.laneIds.forEach((laneId) => expect(representedLanes.has(laneId)).toBe(true));
    expect(representedLanes.size).toBeGreaterThanOrEqual(plan.laneIds.length);

    blocks.forEach((block) => {
      expect(validateBlockTitle(block.title), `invalid title: ${block.title}`).toBe(true);
      expect(Array.isArray(block.sourceInputs) && block.sourceInputs.length > 1).toBe(true);
      expect(Array.isArray(block.dependsOn)).toBe(true);
      expect(Array.isArray(block.unlocks) && block.unlocks.length > 0).toBe(true);
      expect(String(block.derivationReason || '').length).toBeGreaterThan(20);
      expect(String(block.riskOrConstraintAddressed || '').length).toBeGreaterThan(20);
      expect(String(block.successCriterionServed || '').length).toBeGreaterThan(10);
      expect(block.executionEligibility).toBe('locked');
    });
  });

  it('matches the golden fixture at the level of phase coverage, lane coverage, horizon coverage, and block-type distribution', () => {
    const generated = summarize(getGeneratedBlocks(buildGeneratedState()));
    const fixture = summarize(goldenFixture);

    expect(Object.keys(generated.phaseCounts)).toEqual(expect.arrayContaining(Object.keys(fixture.phaseCounts)));
    expect(Object.keys(generated.blockTypeCounts)).toEqual(expect.arrayContaining(Object.keys(fixture.blockTypeCounts)));
    expect(Object.keys(generated.yearCounts)).toEqual(expect.arrayContaining(['2026', '2027', '2028', '2029', '2030', '2031']));

    ['P1', 'P2', 'P3'].forEach((phaseLabel) => {
      expect(generated.phaseCounts[phaseLabel]).toBeGreaterThanOrEqual(fixture.phaseCounts[phaseLabel]);
      // 80x upper bound (was 40x) accommodates Phase 5 BD descriptor additions
      // and the descriptor-pool action expansion (round-robin pool size grew
      // ~2x); semantic intent — "engine doesn't go wild" — is preserved.
      expect(generated.phaseCounts[phaseLabel]).toBeLessThan(fixture.phaseCounts[phaseLabel] * 80);
    });
  });
});

describe('master-plan full-horizon authenticity proof', () => {
  it('reduces creative-release-specific load when the creative anchor is removed', () => {
    const baseline = getGeneratedBlocks(buildGeneratedState());
    const withoutCreativeAnchor = getGeneratedBlocks(buildGeneratedState({ creativeAnchor: false }));
    const baselineCreative = baseline.filter((block) => block.laneId?.includes('lane') && block.title.toLowerCase().includes('creative'));
    const reducedCreative = withoutCreativeAnchor.filter((block) => block.title.toLowerCase().includes('creative'));

    expect(reducedCreative.length).toBeLessThan(baselineCreative.length);
  });

  it('removes product/app-specific blocks when the product lane is removed', () => {
    const withoutProduct = getGeneratedBlocks(buildGeneratedState({ includeProductLane: false }));
    expect(withoutProduct.some((block) => String(block.laneLabel || '').toLowerCase().includes('app platform'))).toBe(false);
  });

  it('keeps capital expansion gated when capital remains zero and widens the capital lane when capital exists', () => {
    const zeroCapital = getGeneratedBlocks(buildGeneratedState({ capitalAvailable: 0 }));
    const fundedCapital = getGeneratedBlocks(buildGeneratedState({ capitalAvailable: 10000 }));
    const zeroCapitalLane = zeroCapital.filter((block) => String(block.laneLabel || '').toLowerCase().includes('real estate'));
    const fundedCapitalLane = fundedCapital.filter((block) => String(block.laneLabel || '').toLowerCase().includes('real estate'));

    expect(zeroCapitalLane.every((block) => block.executionEligibility === 'locked')).toBe(true);
    expect(zeroCapitalLane.every((block) => block.blockType !== 'action')).toBe(true);
    expect(fundedCapitalLane.length).toBeGreaterThan(0);
  });

  it('moves P1 and downstream transition timing when the first hard anchor moves later', () => {
    const baseline = getGeneratedBlocks(buildGeneratedState());
    const delayed = getGeneratedBlocks(buildGeneratedState({ anchorDate: '2027-03-15' }));
    const baselineFirstP2 = baseline.find((block) => block.phaseLabel === 'P2');
    const delayedFirstP2 = delayed.find((block) => block.phaseLabel === 'P2');

    expect(delayedFirstP2.dayKey > baselineFirstP2.dayKey).toBe(true);
  });

  it('does not expand to five years when the declared horizon and goal contract are narrowed to 12 months', () => {
    const narrowed = buildGeneratedState({
      horizonEnd: '2027-05-11',
      horizonMonths: 12,
      goalText: 'Build a 12-month focused product proof plan for Operation Endgame',
      successStandard: 'Reach a single profitable product proof line inside 12 months.',
    });
    const plan = getActivePlan(narrowed);
    const blocks = getGeneratedBlocks(narrowed);

    expect(plan?.fullHorizonEndDayKey).toBe('2027-05-11');
    expect(blocks.every((block) => block.dayKey <= '2027-05-11')).toBe(true);
    expect(blocks.some((block) => String(block.dayKey || '').startsWith('203'))).toBe(false);
  });

  it('narrows institution and civic expansion when the success standard shifts to a single-product outcome', () => {
    const ecosystem = getGeneratedBlocks(buildGeneratedState());
    const singleProduct = getGeneratedBlocks(
      buildGeneratedState({
        successStandard: 'Build a single profitable product line with repeatable conversion and no ecosystem expansion.',
      })
    );
    const ecosystemStrategic = ecosystem.filter((block) =>
      /institution|civic|district/i.test(String(block.laneLabel || ''))
    );
    const singleProductStrategic = singleProduct.filter((block) =>
      /institution|civic|district/i.test(String(block.laneLabel || ''))
    );

    expect(singleProductStrategic.length).toBeLessThan(ecosystemStrategic.length);
  });

  it('fails anti-template similarity when materially different contracts are compared', () => {
    const baselineTitles = titleSet(getGeneratedBlocks(buildGeneratedState()));
    const productOnlyTitles = titleSet(
      getGeneratedBlocks(
        buildGeneratedState({
          includeCreativeLane: false,
          successStandard: 'Build a single profitable product line with repeatable conversion and no ecosystem expansion.',
        })
      )
    );

    expect(symmetricTitleDifference(baselineTitles, productOnlyTitles)).toBeGreaterThanOrEqual(8);
  });
});
