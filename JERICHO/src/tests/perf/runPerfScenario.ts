import { computeDerivedState, getAllBlocks } from '../../state/identityCompute.js';
import { measureWithMemory, measure } from './perfUtils.ts';
import { buildPolicyAndQualityDiagnostics } from '../../state/draftSchedule.js';
import type { ScaleScenarioConfig } from './scaleScenarioFactory.ts';
import { buildScaleScenario } from './scaleScenarioFactory.ts';

function buildBaseState(date = '2026-01-02') {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: { date, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: date, days: [], metrics: {} },
    cycle: [],
    viewDate: date,
    templates: { objectives: {} },
    meta: { version: '1.0.0', onboardingComplete: false },
    recurringPatterns: [],
    executionEvents: [],
    ledger: [],
  };
}

function addDays(dayKey: string, delta: number) {
  const ms = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return dayKey;
  return new Date(ms + delta * 86400000).toISOString().slice(0, 10);
}

function buildSeededState(config: ScaleScenarioConfig) {
  const scenario = buildScaleScenario(config);
  const base = buildBaseState(config.horizon.startDayKey);
  const withView = computeDerivedState(base, { type: 'SET_VIEW_DATE', date: config.horizon.startDayKey });
  const onboarded = computeDerivedState(withView, {
    type: 'COMPLETE_ONBOARDING',
    onboarding: {
      direction: scenario.goalContractInputs.goalText,
      goalText: scenario.goalContractInputs.goalText,
      horizon: '90d',
      narrative: '',
      focusAreas: ['Creation', 'Focus'],
      successDefinition: scenario.goalContractInputs.successDefinition,
    },
  });

  const cycleId = onboarded.activeCycleId;
  const cycle = onboarded.cyclesById[cycleId];
  const seeded = {
    ...onboarded,
    goalExecutionContract: { ...onboarded.goalExecutionContract, ...scenario.goalContractInputs },
    planDraft: { ...scenario.planDraft },
    suggestedBlocks: [],
    suggestionEvents: [],
    planPreview: null,
    historySignalsByCycleId:
      scenario.planDraft.enableHistoryPolicySelection === true
        ? {
            h1: {
              cycleId: 'h1',
              startDayKey: '2025-08-01',
              endDayKey: '2025-09-01',
              scheduledMinutesTotal: 1000,
              completedMinutesTotal: 420,
              completionRate: 0.42,
              completionVelocityMinPerDay: 38,
              movedMinutesTotal: 60,
              droppedMinutesTotal: 20,
              churnIndex: 18,
              rescheduleCount: 4,
              overCapDaysCount: 0,
              avgDailyScheduledMin: 96,
              maxDailyScheduledMin: 180,
              depTightCount: 2,
              depWindowBlockedCount: 0,
              milestoneAtRiskCount: 0,
              placementAnchoringMissCount: 1,
              outsideExecutionHorizonMinutes: 200,
              unplacedEstimateMinTotal: 80,
            },
          }
        : {},
    cyclesById: {
      ...onboarded.cyclesById,
      [cycleId]: {
        ...cycle,
        contract: { ...onboarded.goalExecutionContract, ...scenario.goalContractInputs },
        planDraft: { ...scenario.planDraft },
        suggestedBlocks: [],
        suggestionEvents: [],
        coldPlan: { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } },
      },
    },
  };

  return { seeded };
}

export function runPerfScenario(config: ScaleScenarioConfig) {
  const { seeded } = buildSeededState(config);
  const beforeBlocks = getAllBlocks(seeded).length;

  const rebuildMeasured = measureWithMemory('rebuildPreview', () =>
    computeDerivedState(seeded, {
      type: 'GENERATE_PLAN',
    })
  );
  const previewState: any = rebuildMeasured.value;

  const optimizeMeasured =
    config.optimizerMode === 'on'
      ? measure('optimizeOnly', () =>
          buildPolicyAndQualityDiagnostics({
            suggestedBlocks: previewState.suggestedBlocks,
            planDraft: { ...previewState.planDraft, enableQualityOptimizer: true },
            contract: previewState.goalExecutionContract,
            policyState: previewState.cyclesById?.[previewState.activeCycleId]?.policyState || null,
            timeZone: previewState.appTime?.timeZone || 'UTC',
          })
        )
      : null;

  const applyMeasured = measureWithMemory('applyCommit', () =>
    computeDerivedState(previewState, {
      type: 'APPLY_DRAFT_SCHEDULE',
    })
  );
  const appliedState: any = applyMeasured.value;

  const materializeMeasured = measure('materialize', () => computeDerivedState(appliedState, { type: 'NO_OP' }));
  const materializedState: any = materializeMeasured.value;

  const afterBlocks = getAllBlocks(appliedState).length;
  const previewBlocks = Number(previewState.planPreview?.totalBlocks || 0);
  const placedDelta = Math.max(0, afterBlocks - beforeBlocks);

  return {
    sizes: {
      actionCount: config.actions.count,
      chunkCountPlaced: Math.max(0, afterBlocks - beforeBlocks),
      dayCountInExecutionHorizon: config.executionHorizonDays,
      unplacedActionCount: Math.max(0, config.actions.count - previewBlocks),
      unplacedEstimateMinTotal: Number(previewState.planPreview?.policySelectionSignalsSnapshot?.unplacedEstimateMinTotal || 0),
    },
    perf: {
      rebuildPreviewMs: rebuildMeasured.ms,
      applyCommitMs: applyMeasured.ms,
      materializeMs: materializeMeasured.ms,
      optimizeMs: optimizeMeasured?.ms,
      heapDeltaBytesRebuild: rebuildMeasured.heapDeltaBytes,
      heapDeltaBytesApply: applyMeasured.heapDeltaBytes,
    },
    parity: {
      scheduleParity:
        appliedState.lastPlanError == null &&
        placedDelta <= previewBlocks,
      scoreParity: Boolean(appliedState.scoreParity),
      policyParity: Boolean(appliedState.policySelectionParity),
    },
    quality: {
      qualityScoreBaselineTotal: Number(previewState.planPreview?.qualityScoreBaseline || 0),
      qualityScoreOptimizedTotal:
        config.optimizerMode === 'on' ? Number(previewState.planPreview?.qualityScoreOptimized || 0) : undefined,
    },
    policy: {
      qualityPolicyIdUsed: previewState.planPreview?.qualityPolicyIdUsed || 'BALANCED',
      policySelectionChanged: Boolean(previewState.planPreview?.policySelectionDecision?.hysteresis?.changed),
    },
    checkpoints: {
      preview: {
        count: Number(previewState.planPreview?.pacingInjectedCheckpointCount || 0),
        byMilestone: previewState.planPreview?.pacingInjectedByMilestone || {},
      },
      applied: {
        count: Number(materializedState.pacingInjectedCheckpointCountApplied || 0),
        byMilestone: materializedState.pacingInjectedByMilestoneApplied || {},
      },
    },
  };
}
