import { describe, it, expect } from 'vitest';
import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';

const HORIZON_START = '2026-06-01';
const HORIZON_END = '2031-05-19';

const PLAN = {
  id: 'cross-lane-test',
  successStandard: 'Active ecosystem by 2031',
  outcomeTarget: 'Active ecosystem by 2031-05-19',
  coreMission: 'Build ecosystem',
};

const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: HORIZON_START, endBoundary: '2026-12-31', phaseObjective: 'Found' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31', phaseObjective: 'Operate' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: HORIZON_END, phaseObjective: 'Scale' },
  ],
};

const LANES = [
  { id: 'lane-product', laneId: 'lane-product', domain: 'product', title: 'Core Product', laneTitle: 'Core Product', activationState: 'active' },
  { id: 'lane-income', laneId: 'lane-income', domain: 'income', title: 'Services Revenue', laneTitle: 'Services Revenue', activationState: 'active' },
  { id: 'lane-capital', laneId: 'lane-capital', domain: 'capital', title: 'Capital Real Estate', laneTitle: 'Capital Real Estate', activationState: 'active' },
];

function runExpansion() {
  return expandFullHorizonSchedule({
    plan: PLAN,
    phaseModel: PHASE_MODEL,
    horizonStartDayKey: HORIZON_START,
    horizonEndDayKey: HORIZON_END,
    lanes: LANES,
    existingForecastBlocks: [],
    committedBlocks: [],
    workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    weeklyCapacityMinutes: 30 * 60,
  });
}

describe('Cross-lane semantic artifact dependency', () => {
  const blocks = runExpansion();
  const idToBlock = new Map(blocks.map((b) => [b.id, b]));

  function hasUpstreamFromLane(block, upstreamLaneId) {
    const consumedIds = block.consumedArtifactIds || [];
    return consumedIds.some((cid) => {
      const upstream = idToBlock.get(cid);
      return upstream && upstream.laneId === upstreamLaneId;
    });
  }

  it('income_stream outreach_asset blocks consume product release_prep artifacts', () => {
    const outreachAssetBlocks = blocks.filter(
      (b) => b.laneId === 'lane-income' && b.commercialStage === 'outreach_asset',
    );
    expect(outreachAssetBlocks.length).toBeGreaterThan(0);
    const withCrossLane = outreachAssetBlocks.filter((b) => hasUpstreamFromLane(b, 'lane-product'));
    expect(withCrossLane.length).toBeGreaterThan(0);
  });

  it('capital_real_estate segment_definition blocks consume income close_decision artifacts', () => {
    const capitalSegmentBlocks = blocks.filter(
      (b) => b.laneId === 'lane-capital' && b.commercialStage === 'segment_definition',
    );
    expect(capitalSegmentBlocks.length).toBeGreaterThan(0);
    const withCrossLane = capitalSegmentBlocks.filter((b) => hasUpstreamFromLane(b, 'lane-income'));
    expect(withCrossLane.length).toBeGreaterThan(0);
  });

  it('product_software iteration_backlog_grooming blocks consume income discovery_call artifacts', () => {
    const productBacklogBlocks = blocks.filter(
      (b) => b.laneId === 'lane-product' && b.lifecycleStage === 'iteration_backlog_grooming',
    );
    expect(productBacklogBlocks.length).toBeGreaterThan(0);
    const withCrossLane = productBacklogBlocks.filter((b) => hasUpstreamFromLane(b, 'lane-income'));
    expect(withCrossLane.length).toBeGreaterThan(0);
  });
});
