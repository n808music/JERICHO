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
  // Descriptive titles that do NOT match the legacy regex — forces the helper
  // to use lane.domain. If domain-based extraction regresses, this test fails.
  { id: 'lane-product', laneId: 'lane-product', domain: 'product', title: 'Operation Endgame product engine', laneTitle: 'Operation Endgame product engine', activationState: 'active' },
  { id: 'lane-income', laneId: 'lane-income', domain: 'income', title: 'Operation Endgame runway bridge', laneTitle: 'Operation Endgame runway bridge', activationState: 'active' },
  { id: 'lane-capital', laneId: 'lane-capital', domain: 'capital', title: 'Operation Endgame asset stack', laneTitle: 'Operation Endgame asset stack', activationState: 'active' },
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
  const artifactIdToBlock = new Map(
    blocks
      .filter((block) => block.outputArtifactId)
      .map((block) => [block.outputArtifactId, block])
  );

  function hasUpstreamFromLane(block, upstreamLaneId) {
    const consumedIds = block.consumedArtifactIds || [];
    return consumedIds.some((cid) => {
      const upstream = artifactIdToBlock.get(cid);
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

  it('only attaches earlier upstream artifacts and block dependencies', () => {
    const crossLaneConsumers = blocks.filter(
      (block) => Array.isArray(block.consumedArtifactIds) && block.consumedArtifactIds.some((artifactId) => artifactIdToBlock.has(artifactId))
    );
    expect(crossLaneConsumers.length).toBeGreaterThan(0);
    for (const block of crossLaneConsumers) {
      for (const artifactId of block.consumedArtifactIds) {
        const upstream = artifactIdToBlock.get(artifactId);
        if (!upstream) {continue;}
        expect(String(upstream.dayKey || '') <= String(block.dayKey || '')).toBe(true);
      }
      for (const depId of block.dependsOnBlockIds || []) {
        const upstream = idToBlock.get(depId);
        if (!upstream) {continue;}
        expect(String(upstream.dayKey || '') <= String(block.dayKey || '')).toBe(true);
      }
    }
  });
});
