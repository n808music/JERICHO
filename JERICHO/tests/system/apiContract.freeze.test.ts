import { describe, expect, it } from 'vitest';
import { getQualityPolicy } from '../../src/planner/scoring/policy.ts';
import { buildHistoryProfile } from '../../src/planner/scoring/historySignals.ts';
import { injectCheckpoints } from '../../src/planner/milestones/injectCheckpoints.ts';
import { seedScenario } from './_helpers.ts';

function collectPaths(value: any, prefix = ''): string[] {
  if (Array.isArray(value)) {
    const first = value[0];
    if (first === undefined) return [prefix + '[]'];
    return collectPaths(first, `${prefix}[]`);
  }
  if (value && typeof value === 'object') {
    const paths: string[] = [];
    Object.keys(value)
      .sort()
      .forEach((key) => {
        const next = prefix ? `${prefix}.${key}` : key;
        paths.push(next);
        paths.push(...collectPaths(value[key], next));
      });
    return paths;
  }
  return [];
}

describe('api contract freeze', () => {
  it('locks core schema paths (plan draft, diagnostics, policy, history, checkpoints)', () => {
    const seeded = seedScenario({ autoPolicySelection: true, enableHistoryPolicySelection: true, enableMilestonePacing: true });
    const policy = getQualityPolicy('BALANCED');
    const history = buildHistoryProfile(Object.values(seeded.historySignalsByCycleId || {}), { windowCycles: 5 });
    const checkpoints = injectCheckpoints({
      actions: seeded.planDraft.actions || [],
      milestones: seeded.planDraft.milestones || [],
      constraints: {
        maxScheduledMinutesPerDay: seeded.planDraft.maxScheduledMinutesPerDay,
        maxScheduledMinutesPerWeek: seeded.planDraft.maxScheduledMinutesPerWeek,
      },
      horizons: {
        startDayKey: seeded.goalExecutionContract.startDayKey,
        endDayKey: seeded.goalExecutionContract.endDayKey,
      },
      policy: { cadenceMode: seeded.planDraft.pacingCadenceMode || 'adaptive' },
    });

    expect(collectPaths(seeded.planDraft)).toMatchInlineSnapshot(`
      [
        "actions",
        "actions[].category",
        "actions[].dependencies",
        "actions[].dependencies[]",
        "actions[].estimateMin",
        "actions[].id",
        "archetype",
        "autoPolicySelection",
        "blocksPerWeek",
        "createdAtISO",
        "daysPerWeek",
        "enableHistoryPolicySelection",
        "enableMilestonePacing",
        "enableQualityOptimizer",
        "executionHorizonDays",
        "goalId",
        "historyInfluenceStrength",
        "historyWindowCycles",
        "horizonDays",
        "id",
        "maxScheduledMinutesPerDay",
        "maxScheduledMinutesPerWeek",
        "milestones",
        "milestones[].actionIds",
        "milestones[].checkpointActionIds",
        "milestones[].checkpointActionIds[]",
        "milestones[].milestoneId",
        "milestones[].windowEndDayKey",
        "milestones[].windowStartDayKey",
        "minPolicyHoldDays",
        "optimizerMaxCandidates",
        "optimizerMaxIterations",
        "pacingCadenceMode",
        "primaryDomain",
        "qualityPolicyId",
        "status",
        "successDefinition",
        "templates",
        "templates[].domain",
        "templates[].durationMinutes",
        "templates[].frequency",
        "templates[].reason",
        "templates[].title",
        "totalMinutesPerWeek",
      ]
    `);

    expect(collectPaths(seeded.planPreview)).toMatchInlineSnapshot(`
      [
        "historyProfileSnapshotUsed",
        "historyProfileSnapshotUsed.avgChurnIndex",
        "historyProfileSnapshotUsed.avgCompletionRate",
        "historyProfileSnapshotUsed.avgVelocityMinPerDay",
        "historyProfileSnapshotUsed.cycleCount",
        "historyProfileSnapshotUsed.historyInfluenceStrength",
        "historyProfileSnapshotUsed.historyWindowCycles",
        "historyProfileSnapshotUsed.maxEndDayKey",
        "historyProfileSnapshotUsed.minEndDayKey",
        "historyProfileSnapshotUsed.usedCycleIds",
        "historyReasonCodes",
        "horizonDays",
        "optimizerRejectedCandidatesSummary",
        "optimizerRejectedCandidatesSummary.DEADLINE_GUARDRAIL",
        "optimizerRejectedCandidatesSummary.DEFERRAL_GUARDRAIL",
        "optimizerRejectedCandidatesSummary.DEPENDENCY_GUARDRAIL",
        "optimizerRejectedCandidatesSummary.MILESTONE_GUARDRAIL",
        "optimizerRejectedCandidatesSummary.NO_IMPROVEMENT",
        "policySelectionDecision",
        "policySelectionDecision.hysteresis",
        "policySelectionDecision.hysteresis.blockedBy",
        "policySelectionDecision.hysteresis.changed",
        "policySelectionDecision.hysteresis.priorPolicyId",
        "policySelectionDecision.hysteresis.stickyPolicyId",
        "policySelectionDecision.reasonCodes",
        "policySelectionDecision.selectedPolicyId",
        "policySelectionDecision.signals",
        "policySelectionDecision.signals.capacityPressureRatio",
        "policySelectionDecision.signals.contextSwitchCount",
        "policySelectionDecision.signals.contextSwitching",
        "policySelectionDecision.signals.dailyLoadStdDev",
        "policySelectionDecision.signals.deadlineRisk",
        "policySelectionDecision.signals.deferralPenalty",
        "policySelectionDecision.signals.depTightCount",
        "policySelectionDecision.signals.dependencyRisk",
        "policySelectionDecision.signals.executionHorizonDays",
        "policySelectionDecision.signals.hasMilestones",
        "policySelectionDecision.signals.horizonDays",
        "policySelectionDecision.signals.loadSmoothness",
        "policySelectionDecision.signals.milestoneAtRiskCount",
        "policySelectionDecision.signals.milestoneCount",
        "policySelectionDecision.signals.milestoneRisk",
        "policySelectionDecision.signals.outsideExecutionHorizonEstimateMinTotal",
        "policySelectionDecision.signals.scheduleCoverageRatio",
        "policySelectionDecision.signals.scheduleTruthRatio",
        "policySelectionDecision.signals.unplacedEstimateMinTotal",
        "policySelectionReasonCodes",
        "policySelectionSignalsSnapshot",
        "policySelectionSignalsSnapshot.capacityPressureRatio",
        "policySelectionSignalsSnapshot.contextSwitchCount",
        "policySelectionSignalsSnapshot.contextSwitching",
        "policySelectionSignalsSnapshot.dailyLoadStdDev",
        "policySelectionSignalsSnapshot.deadlineRisk",
        "policySelectionSignalsSnapshot.deferralPenalty",
        "policySelectionSignalsSnapshot.depTightCount",
        "policySelectionSignalsSnapshot.dependencyRisk",
        "policySelectionSignalsSnapshot.executionHorizonDays",
        "policySelectionSignalsSnapshot.hasMilestones",
        "policySelectionSignalsSnapshot.horizonDays",
        "policySelectionSignalsSnapshot.loadSmoothness",
        "policySelectionSignalsSnapshot.milestoneAtRiskCount",
        "policySelectionSignalsSnapshot.milestoneCount",
        "policySelectionSignalsSnapshot.milestoneRisk",
        "policySelectionSignalsSnapshot.outsideExecutionHorizonEstimateMinTotal",
        "policySelectionSignalsSnapshot.scheduleCoverageRatio",
        "policySelectionSignalsSnapshot.scheduleTruthRatio",
        "policySelectionSignalsSnapshot.unplacedEstimateMinTotal",
        "primaryDomain",
        "qualityImprovementDelta",
        "qualityPolicyIdRequested",
        "qualityPolicyIdUsed",
        "qualityScoreBaseline",
        "qualityScoreBaselineByComponent",
        "qualityScoreBaselineByComponent.contextSwitching",
        "qualityScoreBaselineByComponent.deadlineRisk",
        "qualityScoreBaselineByComponent.deferralPenalty",
        "qualityScoreBaselineByComponent.dependencyRisk",
        "qualityScoreBaselineByComponent.loadSmoothness",
        "qualityScoreBaselineByComponent.milestoneRisk",
        "qualityScoreOptimized",
        "qualityScoreOptimizedByComponent",
        "qualityScoreOptimizedByComponent.contextSwitching",
        "qualityScoreOptimizedByComponent.deadlineRisk",
        "qualityScoreOptimizedByComponent.deferralPenalty",
        "qualityScoreOptimizedByComponent.dependencyRisk",
        "qualityScoreOptimizedByComponent.loadSmoothness",
        "qualityScoreOptimizedByComponent.milestoneRisk",
        "totalBlocks",
        "totalMinutes",
      ]
    `);

    expect(collectPaths(policy)).toMatchInlineSnapshot(`
      [
        "optimizerGuardrails",
        "optimizerGuardrails.allowDeadlineRiskIncrease",
        "optimizerGuardrails.allowDeferralPenaltyIncrease",
        "optimizerGuardrails.allowDependencyRiskIncrease",
        "optimizerGuardrails.allowMilestoneRiskIncrease",
        "policyId",
        "thresholds",
        "thresholds.deferralOutsideHorizonPenaltyPerHour",
        "thresholds.depTightMarginMin",
        "thresholds.maxContextSwitchesPerDay",
        "thresholds.maxDailyLoadStdDev",
        "thresholds.milestoneAtRiskSlackRatio",
        "weights",
        "weights.contextSwitching",
        "weights.deadlineRisk",
        "weights.deferralPenalty",
        "weights.dependencyRisk",
        "weights.loadSmoothness",
        "weights.milestoneRisk",
      ]
    `);

    expect(collectPaths(history)).toMatchInlineSnapshot(`
      [
        "aggregates",
        "aggregates.avgAnchoringMissCount",
        "aggregates.avgChurnIndex",
        "aggregates.avgCompletionRate",
        "aggregates.avgDeferralMinutes",
        "aggregates.avgDepTightCount",
        "aggregates.avgMilestoneAtRiskCount",
        "aggregates.avgVelocityMinPerDay",
        "trends",
        "trends.churnTrend",
        "trends.completionRateTrend",
        "window",
        "window.cycleCount",
        "window.maxEndDayKey",
        "window.minEndDayKey",
        "window.usedCycleIds",
      ]
    `);

    expect(collectPaths(checkpoints)).toMatchInlineSnapshot(`
      [
        "actionsWithCheckpoints",
        "actionsWithCheckpoints[].category",
        "actionsWithCheckpoints[].dependencies",
        "actionsWithCheckpoints[].dependencies[]",
        "actionsWithCheckpoints[].estimateMin",
        "actionsWithCheckpoints[].id",
        "injected",
        "injected.byMilestone",
        "injected.byMilestone.M01",
        "injected.byMilestone.M01.count",
        "injected.byMilestone.M01.ids",
        "injected.checkpointCount",
      ]
    `);
  });
});
