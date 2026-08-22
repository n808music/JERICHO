import { computeDerivedState, getAllBlocks } from '../../state/identityCompute.js';
import { derivePlanProof } from '../../state/engine/planProof.ts';
import { measureWithMemory, measure } from './perfUtils.ts';
import { buildPolicyAndQualityDiagnostics } from '../../state/draftSchedule.js';
import { optimizeSchedule } from '../../planner/optimize/optimizeSchedule.ts';
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
    appTime: {
      timeZone: 'UTC',
      nowISO: `${date}T12:00:00.000Z`,
      activeDayKey: date,
      isFollowingNow: true,
      timeIsPinned: true,
    },
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
  const goalEquation = {
    objective: 'PRACTICE_HOURS_TOTAL' as const,
    objectiveValue: Math.max(1, config.actions.count),
    deadlineDayKey: scenario.goalContractInputs.endDayKey,
    workDaysPerWeek: 7,
    maxDailyWorkMinutes: Number(config.maxScheduledMinutesPerDay || 480),
    weekendAllowed: true,
  };
  const planProof = derivePlanProof(goalEquation, {
    nowDayKey: scenario.goalContractInputs.startDayKey,
    timeZone: 'UTC',
  });
  const schedulingCaps = {
    maxBlocksPerDay: planProof.maxPerDay,
    maxBlocksPerWeek: planProof.maxPerWeek,
  };
  const canonicalContract = {
    ...scenario.goalContractInputs,
    startDayKey: scenario.goalContractInputs.startDayKey,
    endDayKey: scenario.goalContractInputs.endDayKey,
  };
  const seeded = {
    ...onboarded,
    constraints: {
      ...(onboarded.constraints || {}),
      ...schedulingCaps,
    },
    planDraft: null,
    suggestedBlocks: [],
    proposedBlocks: [],
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
        goalContract: { ...(cycle.goalContract || {}), ...canonicalContract },
        goalEquation,
        planProof,
        strategy: {
          ...(cycle.strategy || {}),
          constraints: {
            ...(cycle.strategy?.constraints || {}),
            ...schedulingCaps,
          },
        },
        actions: scenario.planDraft.actions,
        planDraft: { ...scenario.planDraft },
        proposedBlocks: [],
        suggestedBlocks: [],
        suggestionEvents: [],
        coldPlan: { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } },
      },
    },
  };

  return { seeded };
}

function disableOptimizerForPerfState(state: any) {
  const cycleId = state.activeCycleId;
  const cycle = cycleId ? state.cyclesById?.[cycleId] : null;
  const nextPlanDraft = state.planDraft ? { ...state.planDraft, enableQualityOptimizer: false } : state.planDraft;
  return {
    ...state,
    planDraft: nextPlanDraft,
    cyclesById:
      cycleId && cycle
        ? {
            ...state.cyclesById,
            [cycleId]: {
              ...cycle,
              planDraft: cycle.planDraft ? { ...cycle.planDraft, enableQualityOptimizer: false } : cycle.planDraft,
            },
          }
        : state.cyclesById,
  };
}

function trimStateForApplyPerf(state: any) {
  const cycleId = state.activeCycleId;
  const cycle = cycleId ? state.cyclesById?.[cycleId] : null;
  if (!cycleId || !cycle) return state;
  const trimmedPlanDraft = state.planDraft
    ? {
        ...state.planDraft,
        actions: [],
        milestones: [],
      }
    : state.planDraft;
  return {
    ...state,
    proposedBlocks: [],
    suggestedBlocks: [],
    planDraft: null,
    cyclesById: {
      ...state.cyclesById,
      [cycleId]: {
        ...cycle,
        actions: [],
        llmActionGraph: null,
        goalEquation: null,
        planProof: null,
        autoAsanaPlan: null,
        coldPlan: { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } },
        suggestedBlocks: [],
        planDraft: cycle.planDraft
          ? {
              ...cycle.planDraft,
              actions: [],
              milestones: [],
            }
          : cycle.planDraft,
      },
    },
  };
}

function trimStateForMaterializePerf(state: any) {
  const cycleId = state.activeCycleId;
  const cycle = cycleId ? state.cyclesById?.[cycleId] : null;
  if (!cycleId || !cycle) return state;
  return {
    ...state,
    proposedBlocks: [],
    suggestedBlocks: [],
    suggestionEvents: [],
    planPreview: null,
    planDraft: null,
    cyclesById: {
      ...state.cyclesById,
      [cycleId]: {
        ...cycle,
        proposedBlocks: [],
        suggestedBlocks: [],
        suggestionEvents: [],
        planDraft: null,
        planPreview: null,
        autoAsanaPlan: null,
        coldPlan: { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } },
        actions: [],
        llmActionGraph: null,
        goalEquation: null,
        planProof: null,
      },
    },
  };
}

export function runPerfScenario(config: ScaleScenarioConfig) {
  const previousTraceFlag = process.env.JERICHO_DISABLE_GENERATE_TRACE;
  const previousPerfFlag = process.env.JERICHO_DEBUG_PERF_ACTIONS;
  process.env.JERICHO_DISABLE_GENERATE_TRACE = '1';
  process.env.JERICHO_DEBUG_PERF_ACTIONS = '1';

  try {
    const { seeded } = buildSeededState(config);
    const beforeBlocks = getAllBlocks(seeded).length;
    const perfSeeded = disableOptimizerForPerfState(seeded);
    const rebuildMeasured = measureWithMemory('rebuildPreview', () =>
      computeDerivedState(perfSeeded, {
        type: 'GENERATE_PLAN',
        payload: { source: 'RENEGOTIATION_APPLY' },
      })
    );
    const previewState: any = rebuildMeasured.value;

    const optimizeBaseline =
      config.optimizerMode === 'on'
        ? buildPolicyAndQualityDiagnostics({
            suggestedBlocks: previewState.proposedBlocks || previewState.suggestedBlocks,
            planDraft: {
              ...previewState.planDraft,
              enableQualityOptimizer: false,
              enableMilestonePacing: false,
              actions: [],
            },
            contract: previewState.goalExecutionContract,
            policyState: previewState.cyclesById?.[previewState.activeCycleId]?.policyState || null,
            timeZone: previewState.appTime?.timeZone || 'UTC',
          })
        : null;
    const optimizeMeasured =
      config.optimizerMode === 'on' && optimizeBaseline
        ? measure('optimizeOnly', () =>
            optimizeSchedule({
              baselineAssignments: optimizeBaseline.assignments || [],
              policyId: optimizeBaseline.qualityPolicyIdUsed || 'BALANCED',
              constraints: {
                executionHorizonDays: Number(
                  previewState.planDraft?.executionHorizonDays ||
                    previewState.goalExecutionContract?.horizonDays ||
                    previewState.planDraft?.horizonDays ||
                    30
                ),
                maxScheduledMinutesPerDay: previewState.planDraft?.maxScheduledMinutesPerDay,
                maxScheduledMinutesPerWeek: previewState.planDraft?.maxScheduledMinutesPerWeek,
              },
              horizons: {
                executionWindowStartDayKey: previewState.goalExecutionContract?.startDayKey || '',
                executionWindowEndDayKey: previewState.goalExecutionContract?.endDayKey || '',
                feasibilityWindowEndDayKey: previewState.goalExecutionContract?.endDayKey || '',
              },
              milestones: previewState.planDraft?.milestones || [],
              metricsContext: {
                unplacedMinutes: 0,
                outsideExecutionHorizonMinutes: 0,
                goalDeadlineDayKey: previewState.goalExecutionContract?.endDayKey || '',
              },
              maxIterations: previewState.planDraft?.optimizerMaxIterations || 2,
              maxCandidatesPerIter: previewState.planDraft?.optimizerMaxCandidates || 30,
            })
          )
        : null;
    const applySeed = trimStateForApplyPerf(previewState);
    const applyMeasured = measureWithMemory('applyCommit', () =>
      computeDerivedState(applySeed, {
        type: 'APPLY_DRAFT_SCHEDULE',
      })
    );
    const appliedState: any = applyMeasured.value;

    const materializeSeed = trimStateForMaterializePerf(appliedState);
    const materializeMeasured = measure('materialize', () => computeDerivedState(materializeSeed, { type: 'NO_OP' }));
    const materializedState: any = materializeMeasured.value;

    const afterBlocks = getAllBlocks(appliedState).length;
    const previewBlocks = Number(previewState.planPreview?.totalBlocks || 0);
    const placedDelta = Math.max(0, afterBlocks - beforeBlocks);
    const cycleBlocksCount = Array.isArray(appliedState.cyclesById?.[previewState.activeCycleId]?.scheduleReviewBlocks)
      ? appliedState.cyclesById[previewState.activeCycleId].scheduleReviewBlocks.length
      : 0;
    const scheduleApplied = Boolean(appliedState.draftScheduleAppliedAtISO);
    const rebuildReducerMs =
      previewState.debug?.lastPerfAction?.type === 'GENERATE_PLAN'
        ? Number(previewState.debug.lastPerfAction.totalMs || 0)
        : null;
    const applyReducerMs =
      appliedState.debug?.lastPerfAction?.type === 'APPLY_DRAFT_SCHEDULE'
        ? Number(appliedState.debug.lastPerfAction.totalMs || 0)
        : null;
    const materializeReducerMs =
      materializedState.debug?.lastPerfAction?.type === 'NO_OP'
        ? Number(materializedState.debug.lastPerfAction.totalMs || 0)
        : null;

    return {
      sizes: {
        actionCount: config.actions.count,
        chunkCountPlaced: Math.max(0, afterBlocks - beforeBlocks),
        dayCountInExecutionHorizon: config.executionHorizonDays,
        unplacedActionCount: Math.max(0, config.actions.count - previewBlocks),
        unplacedEstimateMinTotal: Number(
          previewState.planPreview?.policySelectionSignalsSnapshot?.unplacedEstimateMinTotal || 0
        ),
      },
      perf: {
        rebuildPreviewMs:
          Number.isFinite(rebuildReducerMs) && rebuildReducerMs > 0 ? rebuildReducerMs : rebuildMeasured.ms,
        applyCommitMs: Number.isFinite(applyReducerMs) && applyReducerMs > 0 ? applyReducerMs : applyMeasured.ms,
        materializeMs:
          Number.isFinite(materializeReducerMs) && materializeReducerMs > 0
            ? materializeReducerMs
            : materializeMeasured.ms,
        optimizeMs: optimizeMeasured?.ms,
        heapDeltaBytesRebuild: rebuildMeasured.heapDeltaBytes,
        heapDeltaBytesApply: applyMeasured.heapDeltaBytes,
        generatePlanBreakdown: previewState.debug?.generatePlanPhases || null,
        reducerApplyBreakdown: appliedState.debug?.lastPerfAction || null,
        optimizerBreakdown: optimizeMeasured?.value?.perf || null,
      },
      parity: {
        scheduleParity:
          scheduleApplied &&
          placedDelta <= previewBlocks &&
          (previewBlocks === 0 ? cycleBlocksCount === 0 : cycleBlocksCount > 0),
        feasibilityCleanliness: appliedState.lastPlanError == null,
        scoreParity: Boolean(appliedState.scoreParity),
        policyParity: Boolean(appliedState.policySelectionParity),
      },
      quality: {
        qualityScoreBaselineTotal: Number(previewState.planPreview?.qualityScoreBaseline || 0),
        qualityScoreOptimizedTotal:
          config.optimizerMode === 'on'
            ? Number(optimizeMeasured?.value?.bestScore?.total || previewState.planPreview?.qualityScoreOptimized || 0)
            : undefined,
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
  } finally {
    if (previousTraceFlag == null) {
      delete process.env.JERICHO_DISABLE_GENERATE_TRACE;
    } else {
      process.env.JERICHO_DISABLE_GENERATE_TRACE = previousTraceFlag;
    }
    if (previousPerfFlag == null) {
      delete process.env.JERICHO_DEBUG_PERF_ACTIONS;
    } else {
      process.env.JERICHO_DEBUG_PERF_ACTIONS = previousPerfFlag;
    }
  }
}
