import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeDerivedState } from '../state/identityCompute.js';
import {
  materializeBlocksFromEvents,
  resetExecutionEventIdFactory,
  setExecutionEventIdFactory,
} from '../state/engine/todayAuthority.ts';
import { generateTemplateActionsForGoal } from '../domain/actions/actionTemplates.ts';
import { evaluateStressInvariants, summarizeViolationsByClass, type InvariantViolation } from './invariants.ts';
import { computeStressMetrics } from './metrics.ts';
import {
  loadStressScenario,
  type StressAction,
  type StressScenarioFixture,
  type StressScenarioId,
} from './fixturesLoader.ts';

type StressInputs = {
  writeReport?: boolean;
  scenarioOverride?: Partial<StressScenarioFixture>;
  determinismBaseline?: {
    proposedSchedulePreview: any[];
    committedEvents: any[];
    materializedSchedule: any[];
  };
};

export type StressRunResult = {
  scenarioId: StressScenarioId;
  inferredGraphSummary: {
    source: string;
    snapshotVersion: string;
    inferredCount: number;
    snapshotCount: number;
    inferenceUsed: boolean;
    inferenceDriftDetected: boolean;
    driftSummary: string;
  };
  proposedSchedulePreview: any[];
  committedEvents: any[];
  materializedSchedule: any[];
  diagnostics: Record<string, unknown>;
  scenarioExpectation: {
    requireAtLeastOneViolation: boolean;
    requireDeterminism: boolean;
    requireParity: boolean;
  };
  violationSummary: {
    determinism: number;
    parity: number;
    realism: number;
  };
  metrics: ReturnType<typeof computeStressMetrics>;
  invariantViolations: InvariantViolation[];
};

function normalizeAction(action: StressAction, scenario: StressScenarioFixture): StressAction {
  return {
    id: action.id,
    title: action.title,
    detail: action.detail || '',
    estimateMin: Number(action.estimateMin) || scenario.availability.routeMinutesDefault || 30,
    category: action.category || 'Focus',
    deps: Array.isArray(action.deps) ? [...action.deps] : [],
    topoIndex: Number.isFinite(action.topoIndex) ? action.topoIndex : Number.MAX_SAFE_INTEGER,
    priority: Number.isFinite(action.priority) ? action.priority : Number.MAX_SAFE_INTEGER,
    status: action.status || 'todo',
  };
}

function stableSortActions(actions: StressAction[] = []) {
  return [...actions].sort((a, b) => {
    const topoA = Number.isFinite(a.topoIndex) ? Number(a.topoIndex) : Number.MAX_SAFE_INTEGER;
    const topoB = Number.isFinite(b.topoIndex) ? Number(b.topoIndex) : Number.MAX_SAFE_INTEGER;
    if (topoA !== topoB) return topoA - topoB;
    const prA = Number.isFinite(a.priority) ? Number(a.priority) : Number.MAX_SAFE_INTEGER;
    const prB = Number.isFinite(b.priority) ? Number(b.priority) : Number.MAX_SAFE_INTEGER;
    if (prA !== prB) return prA - prB;
    return `${a.id}`.localeCompare(`${b.id}`);
  });
}

function dayDiffInclusive(startDayKey: string, endDayKey: string) {
  const start = Date.parse(`${startDayKey}T00:00:00.000Z`);
  const end = Date.parse(`${endDayKey}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function buildStressState(scenario: StressScenarioFixture, actions: StressAction[]) {
  const cycleId = `cycle:${scenario.scenarioId}`;
  const goalId = `goal:${scenario.scenarioId}`;
  const nowISO = `${scenario.horizon.startDayKey}T08:00:00.000Z`;
  const normalizedActions = stableSortActions(actions).map((action) => ({
    ...action,
    cycleId,
    goalId,
    brief: action.detail || '',
    definitionOfDone: `Complete ${action.title}.`,
  }));

  const state: any = {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: scenario.goalText, horizon: '90d' },
      pattern: { dailyTargets: [] },
      flow: { streams: [] },
    },
    today: { date: scenario.horizon.startDayKey, blocks: [], completionRate: 0, loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: scenario.horizon.startDayKey, days: [], metrics: {} },
    cycle: [],
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    ledger: [],
    executionEvents: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    constraints: {
      maxBlocksPerDay: scenario.availability.maxBlocksPerDay,
      maxScheduledMinutesPerDay: scenario.realismConstraints?.maxScheduledMinutesPerDay,
      maxScheduledMinutesPerWeek: scenario.realismConstraints?.maxScheduledMinutesPerWeek,
      energyWindows: scenario.energyWindows || [],
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    profileLearning: {},
    appTime: { timeZone: 'UTC', nowISO, activeDayKey: scenario.horizon.startDayKey, isFollowingNow: true },
    activeCycleId: cycleId,
    activeGoalId: goalId,
    actionsByCycleId: {
      [cycleId]: { cycleId, goalId, actions: normalizedActions },
    },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        startedAtDayKey: scenario.horizon.startDayKey,
        goalContract: {
          goalId,
          goalLabel: scenario.goalText,
          terminalOutcome: { text: scenario.goalText },
          startDate: scenario.horizon.startDayKey,
          deadline: { dayKey: scenario.horizon.endDayKey },
          milestones: scenario.milestones || [],
          temporalBinding: {
            startDayKey: scenario.horizon.startDayKey,
            daysPerWeek: scenario.availability.daysPerWeek,
            specificDays: scenario.availability.specificDays,
            sessionDurationMinutes: scenario.availability.routeMinutesDefault,
          },
        },
        coldPlan: {
          forecastByDayKey: {},
          dailyProjection: { forecastByDayKey: {} },
        },
        actions: normalizedActions,
        summary: { completionCount: 0, completionRate: 0 },
      },
    },
    goalExecutionContract: null,
    goalDirective: { goalId, directiveId: `dir:${scenario.scenarioId}` },
    directiveEligibilityByGoal: { [goalId]: { eligible: true } },
    planDraft: {
      blocksPerWeek: scenario.availability.maxBlocksPerDay * Math.max(1, scenario.availability.daysPerWeek),
      daysPerWeek: scenario.availability.daysPerWeek,
      primaryDomain: 'CREATION',
      minutesPerDay: scenario.availability.routeMinutesDefault * scenario.availability.maxBlocksPerDay,
      routeMinutes: scenario.availability.routeMinutesDefault,
      executionHorizonDays: Number(scenario.planDraft?.executionHorizonDays) || 90,
      enableQualityOptimizer: Boolean(scenario.planDraft?.enableQualityOptimizer),
      optimizerMaxIterations: Number(scenario.planDraft?.optimizerMaxIterations || 2),
      optimizerMaxCandidates: Number(scenario.planDraft?.optimizerMaxCandidates || 30),
      fullPlanMaxHorizonDays: Math.max(1, dayDiffInclusive(scenario.horizon.startDayKey, scenario.horizon.endDayKey)),
    },
    planCalibration: null,
    correctionSignals: null,
    draftScheduleItemsByCycleId: {},
    draftScheduleDiagnosticsByCycleId: {},
  };

  return { state, cycleId, goalId };
}

function stableSortSchedule(items: any[] = []) {
  return [...items].sort((a, b) => {
    const dayA = a.dayKey || a.dateISO || (a.startISO || a.start || '').slice(0, 10) || '';
    const dayB = b.dayKey || b.dateISO || (b.startISO || b.start || '').slice(0, 10) || '';
    if (dayA !== dayB) return dayA.localeCompare(dayB);
    const startA = a.startISO || a.start || '';
    const startB = b.startISO || b.start || '';
    if (startA !== startB) return startA.localeCompare(startB);
    if ((a.actionId || '') !== (b.actionId || '')) return (a.actionId || '').localeCompare(b.actionId || '');
    return `${a.id || ''}`.localeCompare(`${b.id || ''}`);
  });
}

function summarizeInference(scenario: StressScenarioFixture) {
  const goalForInference = {
    goalText: scenario.goalText,
    terminalOutcome: { text: scenario.goalText },
    deliverables: [],
  };
  const inferred = generateTemplateActionsForGoal(goalForInference, `goal:${scenario.scenarioId}`) || [];
  const snapshot = scenario.inferredGraph.actions || [];
  const inferredIds = inferred.map((action) => action.id);
  const snapshotIds = snapshot.map((action) => action.id);
  const inferenceDriftDetected =
    inferred.length > 0 &&
    (inferred.length !== snapshot.length || JSON.stringify(inferredIds) !== JSON.stringify(snapshotIds));

  return {
    source: scenario.inferredGraph.source,
    snapshotVersion: scenario.inferredGraph.snapshotVersion,
    inferredCount: inferred.length,
    snapshotCount: snapshot.length,
    inferenceUsed: inferred.length > 0,
    inferenceDriftDetected,
    driftSummary:
      inferred.length <= 0
        ? 'No template inference available; fixture snapshot used as authority.'
        : inferenceDriftDetected
          ? 'Template inference drift detected against stored snapshot.'
          : 'Template inference matches stored snapshot.',
  };
}

function applyPreCompletedStatus(actions: StressAction[], preCompletedIds: string[] = []) {
  const completed = new Set(preCompletedIds || []);
  return actions.map((action) => ({
    ...action,
    status: completed.has(action.id) ? 'completed' : action.status || 'todo',
  }));
}

function collectMaterializedForCycle(state: any, cycleId: string) {
  const materialized = materializeBlocksFromEvents(state.executionEvents || [], { todayISO: state.today?.date });
  const merged = [
    ...(materialized.todayBlocks || []),
    ...(materialized.days || []).flatMap((day: any) => day?.blocks || []),
  ];
  return stableSortSchedule(merged.filter((block: any) => block?.cycleId === cycleId));
}

function reportPathForScenario(scenarioId: StressScenarioId) {
  const base = resolve(dirname(fileURLToPath(import.meta.url)), '../../artifacts/stressReports');
  mkdirSync(base, { recursive: true });
  return resolve(base, `${scenarioId}.json`);
}

function printSummary(result: StressRunResult) {
  const topViolations =
    result.invariantViolations
      .slice(0, 3)
      .map((v) => v.code)
      .join(', ') || 'none';
  // eslint-disable-next-line no-console
  console.log(
    `[stress] ${result.scenarioId} actions=${result.metrics.actionCount} placed=${result.metrics.placedBlockCount} ` +
      `unplaced=${result.metrics.unplacedActionCount} truth=${result.metrics.scheduleTruthRatio} ` +
      `coverage=${result.metrics.scheduleCoverageRatio} violations=${result.invariantViolations.length} top=${topViolations}`
  );
}

export function runStressScenario(scenarioId: StressScenarioId, inputs: StressInputs = {}): StressRunResult {
  const baseFixture = loadStressScenario(scenarioId);
  const fixture: StressScenarioFixture = {
    ...baseFixture,
    ...(inputs.scenarioOverride || {}),
    inferredGraph: {
      ...baseFixture.inferredGraph,
      ...((inputs.scenarioOverride?.inferredGraph as any) || {}),
    },
  };

  const inferenceSummary = summarizeInference(fixture);
  const seededActions = applyPreCompletedStatus(
    stableSortActions((fixture.inferredGraph.actions || []).map((action) => normalizeAction(action, fixture))),
    fixture.preCompletedActionIds || []
  );

  const { state: rawState, cycleId } = buildStressState(fixture, seededActions);

  let eventCounter = 0;
  setExecutionEventIdFactory(() => `stress:${scenarioId}:event:${String(eventCounter++).padStart(6, '0')}`);
  let previewItems: any[] = [];
  let rebuildPreviewItems: any[] = [];
  let committedEvents: any[] = [];
  let materializedSchedule: any[] = [];
  let appliedState: any = rawState;
  try {
    const seededState = computeDerivedState(rawState, { type: 'NO_OP' });
    const rebuiltState = computeDerivedState(seededState, { type: 'REBUILD_SCHEDULE', payload: { cycleId } });
    previewItems = stableSortSchedule(rebuiltState?.draftScheduleItemsByCycleId?.[cycleId] || []);

    const rebuiltTwiceState = computeDerivedState(rebuiltState, { type: 'REBUILD_SCHEDULE', payload: { cycleId } });
    rebuildPreviewItems = stableSortSchedule(rebuiltTwiceState?.draftScheduleItemsByCycleId?.[cycleId] || []);

    appliedState = computeDerivedState(rebuiltState, { type: 'APPLY_DRAFT_SCHEDULE_FULL', payload: { cycleId } });
    committedEvents = stableSortSchedule(
      (appliedState.executionEvents || []).filter(
        (event: any) => event?.cycleId === cycleId && event?.kind === 'create'
      )
    );
    materializedSchedule = collectMaterializedForCycle(appliedState, cycleId);
  } finally {
    resetExecutionEventIdFactory();
  }
  const scenarioExpectation = {
    requireAtLeastOneViolation: Boolean(fixture.expectedRealityProfile?.requireAtLeastOneViolation),
    requireDeterminism: true,
    requireParity: true,
  };

  const draftDiagnostics = appliedState?.draftScheduleDiagnosticsByCycleId?.[cycleId] || {};
  const metrics = computeStressMetrics({
    fixture,
    actions: seededActions,
    previewItems,
    materializedBlocks: materializedSchedule,
    rebuildPreviewItems,
    diagnostics: draftDiagnostics,
  });

  const invariantViolations = evaluateStressInvariants({
    fixture,
    cycleId,
    previewItems,
    rebuildPreviewItems,
    committedEvents,
    materializedBlocks: materializedSchedule,
    finalState: appliedState,
    determinismBaseline: inputs.determinismBaseline
      ? {
          previewItems: inputs.determinismBaseline.proposedSchedulePreview,
          committedEvents: inputs.determinismBaseline.committedEvents,
          materializedBlocks: inputs.determinismBaseline.materializedSchedule,
        }
      : undefined,
  });
  const violationSummary = summarizeViolationsByClass(invariantViolations);
  const topRealismViolations = [...invariantViolations]
    .filter((entry) => entry.severity === 'realism')
    .sort((a, b) => a.code.localeCompare(b.code))
    .slice(0, 3);
  const diagnostics = {
    ...draftDiagnostics,
    diagnosticsInsights: [
      `reasonCode:${String(draftDiagnostics?.reasonCode || 'none')}`,
      `unplacedActionCount:${Math.max(0, seededActions.length - new Set(materializedSchedule.map((b: any) => b.actionId).filter(Boolean)).size)}`,
      `depCheckCoverage:${metrics.depCheckCoverage.checkedActions}/${metrics.depCheckCoverage.eligibleActions}`,
      `milestoneWindowMissCount:${metrics.milestoneWindowMissCount}`,
      `placementAnchoringMissCount:${metrics.placementAnchoringMissCount}`,
      `anchoringMissDelta:${metrics.anchoringMissDelta}`,
      `depWindowBlockedCount:${metrics.depWindowBlockedCount}`,
      `depWindowBlockedByMilestone:${JSON.stringify(metrics.depWindowBlockedByMilestone)}`,
      `depBufferBlockedCount:${metrics.depBufferBlockedCount}`,
      `depBufferBlockedByMilestone:${JSON.stringify(metrics.depBufferBlockedByMilestone)}`,
      `outsideExecutionHorizonCount:${metrics.outsideExecutionHorizonCount}`,
      `outsideExecutionHorizonEstimateMinTotal:${metrics.outsideExecutionHorizonEstimateMinTotal}`,
      `qualityScorePreview:${metrics.qualityScorePreview}`,
      `qualityScoreApplied:${metrics.qualityScoreApplied}`,
      `qualityScoreParity:${String(metrics.qualityScoreParity)}`,
      `qualityScoreTotal:${metrics.qualityScoreTotal}`,
      `contextSwitchCount:${metrics.contextSwitchCount}`,
      `dailyLoadStdDev:${metrics.dailyLoadStdDev}`,
      `milestoneAtRiskCount:${metrics.milestoneAtRiskCount}`,
      `depTightCount:${metrics.depTightCount}`,
      `preservedChunkCount:${metrics.preservedChunkCount}`,
      `movedChunkCount:${metrics.movedChunkCount}`,
      `droppedChunkCount:${metrics.droppedChunkCount}`,
      `churnMovedMinutesTotal:${metrics.churnMovedMinutesTotal}`,
      `churnReasonsCount:${JSON.stringify(metrics.churnReasonsCount)}`,
      `prescriptionsCount:${metrics.prescriptionsCount}`,
      `prescriptionsPrimaryConstraint:${metrics.prescriptionsPrimaryConstraint}`,
      `prescriptionsCodes:${JSON.stringify(metrics.prescriptionsCodes)}`,
      `milestonePlacedRatioMin:${metrics.milestonePlacedRatio.min}`,
      `milestoneSlackRatioMin:${metrics.milestoneWindowSlack.slackRatioMin}`,
      `milestoneInfeasibleCount:${metrics.milestoneWindowSlack.infeasibleMilestonesCount}`,
      `capacityOverageDaysCount:${metrics.capacityOverageDaysCount}`,
      `scheduleTruthRatio:${metrics.scheduleTruthRatio}`,
      `scheduleCoverageRatio:${metrics.scheduleCoverageRatio}`,
      `unplacedEstimateMinTotal:${metrics.unplacedEstimateMinTotal}`,
      `unplacedEstimateMinByCategory:${JSON.stringify(metrics.unplacedEstimateMinByCategory)}`,
    ],
    topRealismViolations: topRealismViolations.map((violation) => ({
      code: violation.code,
      message: violation.message,
      details: violation.details || {},
    })),
  };

  const result: StressRunResult = {
    scenarioId,
    inferredGraphSummary: inferenceSummary,
    proposedSchedulePreview: previewItems,
    committedEvents,
    materializedSchedule,
    diagnostics,
    scenarioExpectation,
    violationSummary,
    metrics,
    invariantViolations,
  };

  if (inputs.writeReport !== false) {
    const path = reportPathForScenario(scenarioId);
    writeFileSync(path, JSON.stringify(result, null, 2) + '\n');
  }
  printSummary(result);
  return result;
}
