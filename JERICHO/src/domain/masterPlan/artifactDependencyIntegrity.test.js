import { describe, expect, it } from 'vitest';

import { buildFullHorizonScheduleExport } from './exportFullHorizonSchedule.js';
import { summarizeArtifactDependencyIntegrity } from './artifactDependencyIntegrity.js';
import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';

const PLAN = {
  id: 'artifact-integrity-plan',
  profileId: 'profile-1',
  title: 'Operation Endgame',
  status: 'active',
  horizonStart: '2026-06-01',
  horizonEnd: '2031-05-19',
  successStandard: 'Reach terminal execution readiness with evidence.',
  outcomeTarget: 'Cross-lane scale readiness.',
};

const PHASE_MODEL = {
  phases: [
    { id: 'p1', label: 'P1', startBoundary: '2026-06-01', endBoundary: '2026-12-31' },
    { id: 'p2', label: 'P2', startBoundary: '2027-01-01', endBoundary: '2028-12-31' },
    { id: 'p3', label: 'P3', startBoundary: '2029-01-01', endBoundary: '2031-05-19' },
  ],
  horizonVisibility: {
    horizonStart: '2026-06-01',
    currentCycleEnd: '2026-06-30',
  },
};

const LANES = [
  {
    id: 'lane-product',
    laneId: 'lane-product',
    domain: 'product',
    title: 'Core App',
    laneTitle: 'Core App',
    activationState: 'active',
  },
  {
    id: 'lane-income',
    laneId: 'lane-income',
    domain: 'income',
    title: 'Services Engine',
    laneTitle: 'Services Engine',
    activationState: 'active',
  },
  {
    id: 'lane-capital',
    laneId: 'lane-capital',
    domain: 'capital',
    title: 'Capital Stack',
    laneTitle: 'Capital Stack',
    activationState: 'active',
    dependsOnLaneIds: ['lane-product'],
  },
];

function expand() {
  return expandFullHorizonSchedule({
    plan: PLAN,
    phaseModel: PHASE_MODEL,
    horizonStartDayKey: '2026-06-01',
    horizonEndDayKey: '2031-05-19',
    lanes: LANES,
    existingForecastBlocks: [],
    committedBlocks: [],
    workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    workWindows: {
      mon: [{ start: '09:00', end: '15:00' }],
      tue: [{ start: '09:00', end: '15:00' }],
      wed: [{ start: '09:00', end: '15:00' }],
      thu: [{ start: '09:00', end: '15:00' }],
      fri: [{ start: '09:00', end: '15:00' }],
    },
    timeZone: 'America/Chicago',
  });
}

describe('artifact dependency integrity', () => {
  it('attaches output artifacts to required block classes and resolves consumed artifacts to producer block IDs', () => {
    const blocks = expand();
    const required = blocks.filter((block) => ['action', 'readiness', 'validation', 'review', 'gate'].includes(block.blockType));
    expect(required.length).toBeGreaterThan(0);
    for (const block of required) {
      expect(block.outputArtifact?.artifactId).toBeTruthy();
    }

    const consuming = blocks.filter((block) => Array.isArray(block.consumedArtifactIds) && block.consumedArtifactIds.length > 0);
    expect(consuming.length).toBeGreaterThan(0);
    for (const block of consuming) {
      expect(block.dependsOnBlockIds.length).toBe(block.consumedArtifactIds.length);
      expect(block.dependsOnBlockIds.every(Boolean)).toBe(true);
    }
  });

  it('removes decorative using claims when no upstream produced artifact exists yet', () => {
    const blocks = expand();
    const firstProductBlock = blocks.find((block) => block.laneId === 'lane-product');
    expect(firstProductBlock).toBeDefined();
    expect(String(firstProductBlock.title || '')).not.toContain(' using ');
    expect(String(firstProductBlock.title || '')).toContain('focused on');
  });

  it('adds structured gate criteria and recognizable SDLC/commercial stage sequences', () => {
    const blocks = expand();
    const gateBlocks = blocks.filter((block) => block.blockType === 'gate' || block.blockType === 'terminal-readiness');
    expect(gateBlocks.length).toBeGreaterThan(0);
    for (const block of gateBlocks) {
      expect(block.gateCriteria?.metricName).toBeTruthy();
      expect(block.gateCriteria?.threshold).toBeTruthy();
      expect(block.gateCriteria?.evidenceArtifactId).toBeTruthy();
      expect(block.gateCriteria?.passBranch).toBeTruthy();
      expect(block.gateCriteria?.failBranch).toBeTruthy();
    }

    const productStages = new Set(
      blocks
        .filter((block) => block.laneId === 'lane-product')
        .map((block) => block.lifecycleStage)
        .filter(Boolean)
    );
    expect(productStages.has('implementation')).toBe(true);
    expect(productStages.has('qa')).toBe(true);
    expect(productStages.has('release_prep')).toBe(true);
    expect(productStages.has('post_release_review')).toBe(true);

    const commercialStages = new Set(
      blocks
        .filter((block) => block.laneId === 'lane-income' || block.laneId === 'lane-capital')
        .map((block) => block.commercialStage)
        .filter(Boolean)
    );
    expect(commercialStages.has('target_list')).toBe(true);
    expect(commercialStages.has('outreach_batch')).toBe(true);
    expect(commercialStages.has('discovery')).toBe(true);
    expect(commercialStages.has('proposal_terms')).toBe(true);
  });
});

describe('full-horizon export contract includes artifact integrity bundle', () => {
  it('projects registry, phase exit criteria, and block-level truth fields', () => {
    const identityState = {
      masterPlansById: { [PLAN.id]: PLAN },
      masterPlanLanesById: Object.fromEntries(LANES.map((lane) => [lane.id, lane])),
      masterPlanMilestonesById: {},
      appTime: { timeZone: 'America/Chicago', nowISO: '2026-06-04T12:00:00.000Z' },
      goalExecutionContract: {
        workWindows: {
          mon: [{ start: '09:00', end: '15:00' }],
          tue: [{ start: '09:00', end: '15:00' }],
          wed: [{ start: '09:00', end: '15:00' }],
          thu: [{ start: '09:00', end: '15:00' }],
          fri: [{ start: '09:00', end: '15:00' }],
        },
      },
    };

    const result = buildFullHorizonScheduleExport(identityState);
    expect(result).not.toBeNull();
    expect(Object.keys(result.artifactRegistry).length).toBeGreaterThan(0);
    expect(result.integrityReport.unresolvedConsumedArtifacts).toBe(0);
    expect(result.integrityReport.gateCriteriaCoverage).toBe('complete');
    expect(result.integrityReport.phaseExitCriteriaCoverage).toBe('complete');
    expect(result.phaseExitCriteriaByPhase.P1.length).toBeGreaterThan(0);
    expect(result.phaseExitCriteriaByPhase.P2.length).toBeGreaterThan(0);
    expect(result.phaseExitCriteriaByPhase.P3.length).toBeGreaterThan(0);

    const sample = result.blocks.find((block) => block.outputArtifactId);
    expect(sample?.id).toBeTruthy();
    expect(sample?.outputArtifact?.artifactId).toBeTruthy();
    expect(Array.isArray(sample?.consumedArtifactIds)).toBe(true);
  });

  it('flags future block and artifact references after cross-lane style dependencies are attached', () => {
    const summary = summarizeArtifactDependencyIntegrity([
      {
        id: 'consumer',
        dayKey: '2026-06-25',
        startISO: '2026-06-25T09:00:00.000Z',
        title: 'Consume future proof',
        blockType: 'action',
        phaseLabel: 'P1',
        laneId: 'lane-income',
        owner: 'Revenue Lead',
        outputArtifactId: 'artifact:consumer',
        outputArtifact: { artifactId: 'artifact:consumer', artifactName: 'Consumer output' },
        consumedArtifactIds: ['artifact:future-platform'],
        dependsOnBlockIds: ['future-platform'],
      },
      {
        id: 'future-platform',
        dayKey: '2026-07-21',
        startISO: '2026-07-21T09:00:00.000Z',
        title: 'Future platform proof',
        blockType: 'action',
        phaseLabel: 'P1',
        laneId: 'lane-product',
        owner: 'Product Lead',
        outputArtifactId: 'artifact:future-platform',
        outputArtifact: { artifactId: 'artifact:future-platform', artifactName: 'Future platform proof' },
        consumedArtifactIds: [],
        dependsOnBlockIds: [],
      },
    ]);

    expect(summary.integrityReport.dependencyAudit.status).toBe('FAIL');
    expect(summary.integrityReport.dependencyAudit.failureCounts.FUTURE_BLOCK_DEPENDENCY).toBe(1);
    expect(summary.integrityReport.dependencyAudit.failureCounts.FUTURE_ARTIFACT_CONSUMPTION).toBe(1);
  });
});
