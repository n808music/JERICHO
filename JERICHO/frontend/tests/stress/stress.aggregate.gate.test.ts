import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { runStressScenario } from '../../src/stress/stressRunner.ts';
import { loadStressScenario, type StressScenarioId } from '../../src/stress/fixturesLoader.ts';

function summarize(result: ReturnType<typeof runStressScenario>) {
  return {
    scenarioId: result.scenarioId,
    hard: result.invariantViolations
      .filter((violation) => violation.severity === 'hard')
      .map((violation) => violation.code),
    realism: result.invariantViolations
      .filter((violation) => violation.severity === 'realism')
      .map((violation) => violation.code)
      .sort(),
  };
}

describe('stress aggregate gate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enforces hard invariants and scenario-specific realism policy', () => {
    const scenarioIds: StressScenarioId[] = ['podcast_30d', 'doctor_10y', 'doctor_10y_tight_capacity'];
    const results = scenarioIds.map((scenarioId) => {
      const baseline = runStressScenario(scenarioId);
      const run = runStressScenario(scenarioId, {
        determinismBaseline: {
          proposedSchedulePreview: baseline.proposedSchedulePreview,
          committedEvents: baseline.committedEvents,
          materializedSchedule: baseline.materializedSchedule,
        },
      });
      return { scenarioId, run, fixture: loadStressScenario(scenarioId) };
    });

    const assertRange = (value: number, range: { min?: number; max?: number }, message: string) => {
      if (typeof range.min === 'number') expect(value, message).toBeGreaterThanOrEqual(range.min);
      if (typeof range.max === 'number') expect(value, message).toBeLessThanOrEqual(range.max);
    };

    results.forEach(({ run, fixture }) => {
      const hard = run.invariantViolations.filter((violation) => violation.severity === 'hard');
      const realism = run.invariantViolations.filter((violation) => violation.severity === 'realism');
      const targets = fixture.expectedTargets || {};
      const summary = JSON.stringify(summarize(run), null, 2);

      expect(hard, summary).toEqual([]);
      if (typeof targets.hard?.maxHardViolations === 'number') {
        expect(hard.length, summary).toBeLessThanOrEqual(targets.hard.maxHardViolations);
      }

      if (targets.realism?.podcastMustBeClean) {
        expect(realism, summary).toEqual([]);
      }
      if (targets.realism?.requireAtLeastOneViolation) {
        expect(realism.length, summary).toBeGreaterThan(0);
      }
      if ((targets.realism?.requiredSignalsAnyOf || []).length > 0) {
        expect(
          realism.some((violation) => (targets.realism?.requiredSignalsAnyOf || []).includes(violation.code)),
          summary
        ).toBe(true);
      }

      const metricTargets = targets.metrics || {};
      if (metricTargets.scheduleTruthRatio) {
        assertRange(run.metrics.scheduleTruthRatio, metricTargets.scheduleTruthRatio, summary);
      }
      if (metricTargets.scheduleCoverageRatio) {
        assertRange(run.metrics.scheduleCoverageRatio, metricTargets.scheduleCoverageRatio, summary);
      }
      if (metricTargets.milestoneWindowMissCount) {
        assertRange(run.metrics.milestoneWindowMissCount, metricTargets.milestoneWindowMissCount, summary);
      }
      if (metricTargets.capacityOverageDaysCount) {
        assertRange(run.metrics.capacityOverageDaysCount, metricTargets.capacityOverageDaysCount, summary);
      }
      if (metricTargets.depCheckedActions) {
        assertRange(run.metrics.depCheckCoverage.checkedActions, metricTargets.depCheckedActions, summary);
      }
      if (metricTargets.depEligibleActions) {
        assertRange(run.metrics.depCheckCoverage.eligibleActions, metricTargets.depEligibleActions, summary);
      }
      if (metricTargets.churnIndex) {
        assertRange(run.metrics.churnIndex, metricTargets.churnIndex, summary);
      }
      if (metricTargets.unplacedEstimateMinTotal) {
        assertRange(run.metrics.unplacedEstimateMinTotal, metricTargets.unplacedEstimateMinTotal, summary);
      }
      if (metricTargets.milestonePlacedRatioMin) {
        assertRange(run.metrics.milestonePlacedRatio.min, metricTargets.milestonePlacedRatioMin, summary);
      }
      if (metricTargets.milestonePlacedRatioAvg) {
        assertRange(run.metrics.milestonePlacedRatio.avg, metricTargets.milestonePlacedRatioAvg, summary);
      }
      if (metricTargets.placementAnchoringMissCount) {
        assertRange(run.metrics.placementAnchoringMissCount, metricTargets.placementAnchoringMissCount, summary);
      }
      if (metricTargets.anchoringMissDelta) {
        assertRange(run.metrics.anchoringMissDelta, metricTargets.anchoringMissDelta, summary);
      }
      if (metricTargets.depWindowBlockedCount) {
        assertRange(run.metrics.depWindowBlockedCount, metricTargets.depWindowBlockedCount, summary);
      }
      if (metricTargets.depBufferBlockedCount) {
        assertRange(run.metrics.depBufferBlockedCount, metricTargets.depBufferBlockedCount, summary);
      }
      if (metricTargets.preservedChunkCount) {
        assertRange(run.metrics.preservedChunkCount, metricTargets.preservedChunkCount, summary);
      }
      if (metricTargets.movedChunkCount) {
        assertRange(run.metrics.movedChunkCount, metricTargets.movedChunkCount, summary);
      }
      if (metricTargets.droppedChunkCount) {
        assertRange(run.metrics.droppedChunkCount, metricTargets.droppedChunkCount, summary);
      }
      if (metricTargets.churnMovedMinutesTotal) {
        assertRange(run.metrics.churnMovedMinutesTotal, metricTargets.churnMovedMinutesTotal, summary);
      }
      if (metricTargets.outsideExecutionHorizonCount) {
        assertRange(run.metrics.outsideExecutionHorizonCount, metricTargets.outsideExecutionHorizonCount, summary);
      }
      if (metricTargets.outsideExecutionHorizonEstimateMinTotal) {
        assertRange(
          run.metrics.outsideExecutionHorizonEstimateMinTotal,
          metricTargets.outsideExecutionHorizonEstimateMinTotal,
          summary
        );
      }
      if (metricTargets.milestoneWindowSlackRatioMin) {
        assertRange(
          run.metrics.milestoneWindowSlack.slackRatioMin,
          metricTargets.milestoneWindowSlackRatioMin,
          summary
        );
      }
      if (metricTargets.infeasibleMilestonesCount) {
        assertRange(
          run.metrics.milestoneWindowSlack.infeasibleMilestonesCount,
          metricTargets.infeasibleMilestonesCount,
          summary
        );
      }
      if (metricTargets.prescriptionsCount) {
        assertRange(run.metrics.prescriptionsCount, metricTargets.prescriptionsCount, summary);
      }
      if (metricTargets.qualityScoreTotal) {
        assertRange(run.metrics.qualityScoreTotal, metricTargets.qualityScoreTotal, summary);
      }
      if (metricTargets.contextSwitchCount) {
        assertRange(run.metrics.contextSwitchCount, metricTargets.contextSwitchCount, summary);
      }
      if (metricTargets.dailyLoadStdDev) {
        assertRange(run.metrics.dailyLoadStdDev, metricTargets.dailyLoadStdDev, summary);
      }
      if (metricTargets.milestoneAtRiskCount) {
        assertRange(run.metrics.milestoneAtRiskCount, metricTargets.milestoneAtRiskCount, summary);
      }
      if (metricTargets.depTightCount) {
        assertRange(run.metrics.depTightCount, metricTargets.depTightCount, summary);
      }
      expect(run.metrics.qualityScoreParity, summary).toBe(true);
      if (targets.prescriptions?.primaryConstraint) {
        expect(run.metrics.prescriptionsPrimaryConstraint, summary).toBe(targets.prescriptions.primaryConstraint);
      }
      if ((targets.prescriptions?.mustIncludeCodes || []).length > 0) {
        const required = targets.prescriptions?.mustIncludeCodes || [];
        expect(
          required.some((code) => run.metrics.prescriptionsCodes.includes(code)),
          summary
        ).toBe(true);
      }
    });
  });
});
