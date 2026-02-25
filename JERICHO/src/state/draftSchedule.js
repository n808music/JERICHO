import { dayKeyFromISO } from './time/time.ts';
import { getContractStartDayKey, filterSuggestionsByStartDayKey, normalizeSuggestionDayKey } from './suggestionFilters.js';
import { scoreSchedule } from '../planner/scoring/scoreSchedule.ts';
import { optimizeSchedule } from '../planner/optimize/optimizeSchedule.ts';
import { computePolicySelection } from '../planner/scoring/policySelector.ts';
import { injectCheckpoints } from '../planner/milestones/injectCheckpoints.ts';

const ensureISO = (dayKey, time = '09:00') => {
  if (!dayKey) return null;
  return `${dayKey}T${time}:00.000Z`;
};

const sortDraftItems = (items = []) =>
  [...items].sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
    if (a.startISO !== b.startISO) return (a.startISO || '').localeCompare(b.startISO || '');
    return (a.title || '').localeCompare(b.title || '');
  });

const sortAssignments = (assignments = []) =>
  [...assignments].sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if (a.actionId !== b.actionId) return a.actionId.localeCompare(b.actionId);
    return (a.chunkIndex || 0) - (b.chunkIndex || 0);
  });

function minutesFromISO(iso) {
  if (!iso) return 0;
  const parsed = new Date(iso);
  if (!Number.isFinite(parsed.getTime())) return 0;
  return parsed.getUTCHours() * 60 + parsed.getUTCMinutes();
}

function toAssignments(suggestedBlocks = [], timeZone = 'UTC') {
  return sortAssignments(
    (suggestedBlocks || [])
      .filter((s) => s && s.status === 'suggested')
      .map((s, idx) => ({
        actionId: `${s.goalId || 'goal'}:${s.id || idx}`,
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: normalizeSuggestionDayKey(s, timeZone) || dayKeyFromISO(s.startISO, timeZone) || '',
        startMin: minutesFromISO(s.startISO),
        durationMin: Number(s.durationMinutes) || 30,
        category: s.domain || 'FOCUS',
      }))
      .filter((a) => a.dayKey)
  );
}

function clampRatio(num, den) {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
  return Math.max(0, Math.min(1, num / den));
}

function daysBetween(start, end) {
  const s = Date.parse(`${start}T00:00:00.000Z`);
  const e = Date.parse(`${end}T00:00:00.000Z`);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  return Math.max(0, Math.round((e - s) / 86400000));
}

function addDays(dayKey, delta) {
  const ms = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return dayKey;
  return new Date(ms + delta * 86400000).toISOString().slice(0, 10);
}

function buildActionAssignments(actions = [], startDayKey = '', executionHorizonDays = 30) {
  if (!actions.length || !startDayKey) return [];
  const horizon = Math.max(1, executionHorizonDays);
  return sortAssignments(
    actions.map((action, idx) => {
      const dayOffset = idx % horizon;
      const slot = idx % 8;
      return {
        actionId: action.id,
        chunkIndex: 0,
        chunkCount: 1,
        dayKey: addDays(startDayKey, dayOffset),
        startMin: 9 * 60 + slot * 60,
        durationMin: Number(action.estimateMin) || 30,
        category: action.category || 'FOCUS',
        isCheckpoint: Boolean(action.isCheckpoint),
      };
    })
  );
}

function buildPacingDiagnostics({ milestones = [], injected = null, constraints = {} }) {
  const byMilestone = {};
  let infeasible = 0;
  let anchoringMisses = 0;
  let placedRatioSum = 0;
  milestones
    .slice()
    .sort((a, b) => a.milestoneId.localeCompare(b.milestoneId))
    .forEach((m) => {
      const windowDays = daysBetween(m.windowStartDayKey, m.windowEndDayKey) + 1;
      const interval = windowDays <= 120 ? 7 : windowDays <= 240 ? 14 : 28;
      const pacingSegmentCount = Math.max(1, Math.ceil(windowDays / Math.max(1, interval)));
      const checkpointCount = injected?.byMilestone?.[m.milestoneId]?.count || 0;
      const requiredCriticalMinutes = Math.max(0, (m.actionIds || []).length * 45);
      const dayCap = Number(constraints?.maxScheduledMinutesPerDay) || 240;
      const availableWindowMinutes = windowDays * dayCap;
      const pacingSlackRatio = availableWindowMinutes > 0 ? requiredCriticalMinutes / availableWindowMinutes : 0;
      const placedRatio = clampRatio(checkpointCount, pacingSegmentCount);
      const misses = Math.max(0, pacingSegmentCount - checkpointCount);
      if (pacingSlackRatio > 1) infeasible += 1;
      anchoringMisses += misses;
      placedRatioSum += placedRatio;
      byMilestone[m.milestoneId] = {
        pacingSegmentCount,
        pacingRequiredCriticalMinutes: requiredCriticalMinutes,
        pacingAvailableWindowMinutes: availableWindowMinutes,
        pacingSlackRatio: Math.round(pacingSlackRatio * 1000) / 1000,
        checkpointCount,
        anchoringMisses: misses,
      };
    });
  const milestoneCount = milestones.length || 1;
  return {
    pacingByMilestone: byMilestone,
    pacingInfeasibleMilestonesCount: infeasible,
    pacingAnchoringMissCount: anchoringMisses,
    milestonePlacedRatioAvg: Math.round((placedRatioSum / milestoneCount) * 1000) / 1000,
  };
}

export function buildPolicyAndQualityDiagnostics({
  suggestedBlocks = [],
  planDraft = null,
  contract = null,
  timeZone = 'UTC',
  policyState = null,
  historyProfile = null,
}) {
  const suggestedAssignments = toAssignments(suggestedBlocks, timeZone);
  const qualityPolicyIdRequested = planDraft?.qualityPolicyId || 'BALANCED';
  const minPolicyHoldDays = Number.isFinite(planDraft?.minPolicyHoldDays) ? planDraft.minPolicyHoldDays : 7;
  const historyWindowCycles = Number.isFinite(planDraft?.historyWindowCycles) ? Number(planDraft.historyWindowCycles) : 5;
  const historyInfluenceStrength = planDraft?.historyInfluenceStrength || 'standard';
  const milestones = Array.isArray(planDraft?.milestones) ? planDraft.milestones : [];
  const baseActions = Array.isArray(planDraft?.actions) ? planDraft.actions : [];
  const executionHorizonDays = Number(planDraft?.executionHorizonDays || contract?.horizonDays || planDraft?.horizonDays || 30);
  const pacingEnabled = planDraft?.enableMilestonePacing === true;
  const injectedResult =
    pacingEnabled && baseActions.length > 0 && milestones.length > 0
      ? injectCheckpoints({
          actions: baseActions,
          milestones,
          constraints: {
            maxScheduledMinutesPerDay: planDraft?.maxScheduledMinutesPerDay,
            maxScheduledMinutesPerWeek: planDraft?.maxScheduledMinutesPerWeek,
          },
          horizons: {
            startDayKey: contract?.startDayKey || '',
            endDayKey: contract?.endDayKey || '',
          },
          policy: { cadenceMode: planDraft?.pacingCadenceMode || 'adaptive' },
        })
      : null;
  const checkpointActions = injectedResult
    ? injectedResult.actionsWithCheckpoints.filter((a) => a.isCheckpoint)
    : [];
  const checkpointAssignments = buildActionAssignments(
    checkpointActions,
    contract?.startDayKey || '',
    executionHorizonDays
  );
  const assignments = sortAssignments([...suggestedAssignments, ...checkpointAssignments]);

  const unplacedEstimateMinTotal = 0;
  const outsideExecutionHorizonEstimateMinTotal = 0;
  const totalEstimate = assignments.reduce((sum, a) => sum + (a.durationMin || 0), 0);
  const scoreBaselineRequested = scoreSchedule({
    assignments,
    constraints: {
      executionHorizonDays,
      maxScheduledMinutesPerDay: planDraft?.maxScheduledMinutesPerDay,
      maxScheduledMinutesPerWeek: planDraft?.maxScheduledMinutesPerWeek,
    },
    horizons: {
      executionWindowStartDayKey: contract?.startDayKey || '',
      executionWindowEndDayKey: contract?.endDayKey || '',
      feasibilityWindowEndDayKey: contract?.endDayKey || '',
    },
    milestones,
    metricsContext: {
      unplacedMinutes: unplacedEstimateMinTotal,
      outsideExecutionHorizonMinutes: outsideExecutionHorizonEstimateMinTotal,
      goalDeadlineDayKey: contract?.endDayKey || '',
    },
    policyId: qualityPolicyIdRequested,
  });

  const selectionSignals = {
    horizonDays: contract?.horizonDays || planDraft?.horizonDays || executionHorizonDays,
    executionHorizonDays,
    hasMilestones: milestones.length > 0,
    milestoneCount: milestones.length,
    unplacedEstimateMinTotal,
    outsideExecutionHorizonEstimateMinTotal,
    scheduleCoverageRatio: totalEstimate > 0 ? 1 : 0,
    scheduleTruthRatio: totalEstimate > 0 ? 1 : 0,
    capacityPressureRatio: undefined,
    deadlineRisk: scoreBaselineRequested.components.deadlineRisk,
    milestoneRisk: scoreBaselineRequested.components.milestoneRisk,
    dependencyRisk: scoreBaselineRequested.components.dependencyRisk,
    contextSwitching: scoreBaselineRequested.components.contextSwitching,
    loadSmoothness: scoreBaselineRequested.components.loadSmoothness,
    deferralPenalty: scoreBaselineRequested.components.deferralPenalty,
    milestoneAtRiskCount: scoreBaselineRequested.evidence.milestoneAtRiskCount || 0,
    depTightCount: scoreBaselineRequested.evidence.depTightCount || 0,
    contextSwitchCount: scoreBaselineRequested.evidence.contextSwitchCount || 0,
    dailyLoadStdDev: scoreBaselineRequested.evidence.dailyLoadStdDev || 0,
  };

  const policySelectionDecision =
    planDraft?.autoPolicySelection === true
      ? computePolicySelection(selectionSignals, {
          priorPolicyId: policyState?.currentPolicyId,
          priorPolicyAgeDays: policyState?.policyAgeDays,
          minPolicyHoldDays,
          priorSignalsSnapshot: policyState?.priorSignalsSnapshot,
          historyProfile,
          enableHistoryInfluence: planDraft?.enableHistoryPolicySelection === true,
          historyInfluenceStrength,
        })
      : {
          selectedPolicyId: qualityPolicyIdRequested,
          reasonCodes: ['AUTO_SELECTION_DISABLED'],
          signals: selectionSignals,
          hysteresis: {
            priorPolicyId: policyState?.currentPolicyId,
            stickyPolicyId: qualityPolicyIdRequested,
            changed: false,
          },
        };

  const qualityPolicyIdUsed = policySelectionDecision.hysteresis?.stickyPolicyId || policySelectionDecision.selectedPolicyId;

  const scoreBaseline = scoreSchedule({
    assignments,
    constraints: {
      executionHorizonDays,
      maxScheduledMinutesPerDay: planDraft?.maxScheduledMinutesPerDay,
      maxScheduledMinutesPerWeek: planDraft?.maxScheduledMinutesPerWeek,
    },
    horizons: {
      executionWindowStartDayKey: contract?.startDayKey || '',
      executionWindowEndDayKey: contract?.endDayKey || '',
      feasibilityWindowEndDayKey: contract?.endDayKey || '',
    },
    milestones,
    metricsContext: {
      unplacedMinutes: unplacedEstimateMinTotal,
      outsideExecutionHorizonMinutes: outsideExecutionHorizonEstimateMinTotal,
      goalDeadlineDayKey: contract?.endDayKey || '',
    },
    policyId: qualityPolicyIdUsed,
  });

  const optimizationEnabled = planDraft?.enableQualityOptimizer === true;
  const optimizationResult = optimizationEnabled
    ? optimizeSchedule({
        baselineAssignments: assignments,
        policyId: qualityPolicyIdUsed,
        constraints: {
          executionHorizonDays,
          maxScheduledMinutesPerDay: planDraft?.maxScheduledMinutesPerDay,
          maxScheduledMinutesPerWeek: planDraft?.maxScheduledMinutesPerWeek,
        },
        horizons: {
          executionWindowStartDayKey: contract?.startDayKey || '',
          executionWindowEndDayKey: contract?.endDayKey || '',
          feasibilityWindowEndDayKey: contract?.endDayKey || '',
        },
        milestones,
        metricsContext: {
          unplacedMinutes: unplacedEstimateMinTotal,
          outsideExecutionHorizonMinutes: outsideExecutionHorizonEstimateMinTotal,
          goalDeadlineDayKey: contract?.endDayKey || '',
        },
        maxIterations: planDraft?.optimizerMaxIterations || 2,
        maxCandidatesPerIter: planDraft?.optimizerMaxCandidates || 30,
      })
    : null;

  const scoreOptimized = optimizationResult?.bestScore || scoreBaseline;
  const pacing = buildPacingDiagnostics({
    milestones,
    injected: injectedResult?.injected || null,
    constraints: {
      maxScheduledMinutesPerDay: planDraft?.maxScheduledMinutesPerDay,
      maxScheduledMinutesPerWeek: planDraft?.maxScheduledMinutesPerWeek,
    },
  });

  return {
    assignments,
    qualityPolicyIdRequested,
    qualityPolicyIdUsed,
    policySelectionDecision,
    policySelectionReasonCodes: [...(policySelectionDecision.reasonCodes || [])],
    policySelectionSignalsSnapshot: selectionSignals,
    historyProfileSnapshotUsed:
      planDraft?.enableHistoryPolicySelection === true && historyProfile
        ? {
            cycleCount: Number(historyProfile.window?.cycleCount || 0),
            avgCompletionRate: Number(historyProfile.aggregates?.avgCompletionRate || 0),
            avgChurnIndex: Number(historyProfile.aggregates?.avgChurnIndex || 0),
            avgVelocityMinPerDay: Number(historyProfile.aggregates?.avgVelocityMinPerDay || 0),
            minEndDayKey: historyProfile.window?.minEndDayKey || '',
            maxEndDayKey: historyProfile.window?.maxEndDayKey || '',
            usedCycleIds: [...(historyProfile.window?.usedCycleIds || [])],
            historyWindowCycles,
            historyInfluenceStrength,
          }
        : null,
    historyReasonCodes: (policySelectionDecision.reasonCodes || []).filter((code) => code.startsWith('HISTORY_')),
    qualityScoreBaseline: scoreBaseline.total,
    qualityScoreBaselineByComponent: { ...scoreBaseline.components },
    qualityScoreOptimized: scoreOptimized.total,
    qualityScoreOptimizedByComponent: { ...scoreOptimized.components },
    qualityImprovementDelta: optimizationResult ? optimizationResult.improvement.deltaTotal : 0,
    pacingCadenceModeUsed: planDraft?.pacingCadenceMode || 'adaptive',
    pacingInjectedCheckpointCount: injectedResult?.injected?.checkpointCount || 0,
    pacingInjectedByMilestone: injectedResult?.injected?.byMilestone || {},
    pacingSegmentCount: Object.values(pacing.pacingByMilestone).reduce((sum, m) => sum + (m.pacingSegmentCount || 0), 0),
    pacingRequiredCriticalMinutes: Object.values(pacing.pacingByMilestone).reduce(
      (sum, m) => sum + (m.pacingRequiredCriticalMinutes || 0),
      0
    ),
    pacingAvailableWindowMinutes: Object.values(pacing.pacingByMilestone).reduce(
      (sum, m) => sum + (m.pacingAvailableWindowMinutes || 0),
      0
    ),
    pacingSlackRatio:
      Object.values(pacing.pacingByMilestone).reduce((sum, m) => sum + (Number(m.pacingSlackRatio) || 0), 0) /
      Math.max(1, milestones.length),
    pacingInfeasibleMilestonesCount: pacing.pacingInfeasibleMilestonesCount,
    pacingByMilestone: pacing.pacingByMilestone,
    pacingAnchoringMissCount: pacing.pacingAnchoringMissCount,
    milestonePlacedRatioAvg: pacing.milestonePlacedRatioAvg,
    optimizerRejectedCandidatesSummary: optimizationResult
      ? optimizationResult.rejectedCandidatesSummary
      : {
          DEADLINE_GUARDRAIL: 0,
          MILESTONE_GUARDRAIL: 0,
          DEFERRAL_GUARDRAIL: 0,
          DEPENDENCY_GUARDRAIL: 0,
          NO_IMPROVEMENT: 0,
        },
  };
}

export function buildDraftScheduleItems({
  suggestedBlocks = [],
  routeSuggestions = [],
  contract = null,
  timeZone = 'UTC',
  defaults = {},
  contractStartDayKey: contractStartDayKeyOverride = null
} = {}) {
  const startDayKey = contractStartDayKeyOverride || getContractStartDayKey(contract, timeZone);
  const normalizedSuggested = filterSuggestionsByStartDayKey(suggestedBlocks, startDayKey, timeZone);
  const items = [];

  normalizedSuggested.forEach((suggestion) => {
    const dayKey = normalizeSuggestionDayKey(suggestion, timeZone) || defaults.todayKey || '';
    const startISO =
      suggestion.startISO ||
      suggestion.start ||
      ensureISO(dayKey, '09:00') ||
      `${dayKey}T09:00:00.000Z`;
    const minutes = Number(suggestion.durationMinutes) || Number(suggestion.minutes) || 30;
    const title = suggestion.title || suggestion.label || 'Suggested block';
    items.push({
      id: `suggested:${suggestion.id || `${dayKey}-${title}`}`,
      source: 'suggestedPath',
      dayKey,
      startISO,
      minutes,
      domainKey: suggestion.domain || 'FOCUS',
      title,
      detail: suggestion.detail || suggestion.description || '',
      reason: 'Suggested path',
      payload: suggestion
    });
  });

  const route = routeSuggestions.map((entry) => {
    const dayKey = entry?.dayKey || defaults.todayKey || '';
    const total = Number(entry?.totalBlocks) || 0;
    return {
      id: `route:${dayKey}`,
      source: 'coldPlan',
      dayKey,
      startISO: ensureISO(dayKey, '09:00'),
      minutes: defaults.routeMinutes || 30,
      domainKey: defaults.primaryDomain || 'FOCUS',
      title: `${total} forecast block${total !== 1 ? 's' : ''}`,
      detail: entry?.summary || '',
      reason: 'Cold plan',
      payload: entry
    };
  });

  const merged = sortDraftItems([...items, ...route]);
  if (!startDayKey && !contract?.deadline?.dayKey) return merged;
  return merged.filter((item) => {
    if (!item.dayKey) return false;
    if (startDayKey && item.dayKey < startDayKey) return false;
    if (contract?.deadline?.dayKey && contract.deadline.dayKey && item.dayKey > contract.deadline.dayKey) return false;
    return true;
  });
}

export function filterDraftItemsByDay(items = [], dayKey) {
  if (!dayKey) return [];
  return (items || []).filter((item) => item.dayKey === dayKey);
}
