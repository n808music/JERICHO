import React, { useEffect, useMemo, useState } from 'react';
import BlockColumn from './zion/BlockColumn.jsx';
import PlanningPanel from './zion/PlanningPanel.jsx';
import BlockDetailsPanel from './zion/BlockDetailsPanel.jsx';
import Workspace from './zion/Workspace.jsx';
import AssistantPanel from './zion/AssistantPanel.jsx';
import DiagnosticsPanel from './DiagnosticsPanel.jsx';
import MissionSetupFlow from './zion/MissionSetupFlow.jsx';
import { StructurePageConsolidated } from './zion/StructurePageConsolidated.jsx';
import CycleTransitionModal from './zion/CycleTransitionModal.jsx';
import { REDUCE_UI } from '../ui/reduceUIConfig.js';
import ZionWeekView from './zion/views/ZionWeekView.jsx';
import ZionMonthView from './zion/views/ZionMonthView.jsx';
import ZionQuarterView from './zion/views/ZionQuarterView.jsx';
import ZionYearView from './zion/views/ZionYearView.jsx';
import { useIdentityStore } from '../state/identityStore.js';
import { computeStability, getAllBlocks, projectMonthDays } from '../state/identityCompute.js';
import { computeDayMetricsMap, normalizeBlocks } from '../state/metrics.js';
import { localStartFromDayAndTime } from './zion/timeUtils.js';
import { addDays, dayKeyFromISO, isValidISO, assertValidISO, nowDayKey } from '../state/time/time.ts';
import { formatProbabilityWindowLabel, getProbabilityWindowSpec } from '../state/engine/probabilityWindow.ts';
import { projectCyclesIndex } from '../state/engine/cycleIndex.ts';
import { deriveWhatMovedToday } from '../state/whatMovedToday.ts';
import {
  getCanonicalCycleContract,
  getCanonicalCycleDeliverables,
  getCanonicalProposedBlocks
} from '../state/cycleSelectors.js';
import {
  getContractStartDayKey,
  getContractDeadlineDayKey
} from '../state/suggestionFilters.js';
import { traceAction, traceNoop } from '../dev/uiWiringTrace.ts';
import {
  buildWindowSpec,
  formatWindowLabel,
  getMonthDayKeys,
  getQuarterMonths,
  getWeekDayKeys,
  getYearMonths,
  shiftAnchorDayKey
} from '../state/time/window.ts';
import { getDayStats, getMonthStats, getQuarterStats } from '../state/time/viewAggregates.ts';
import { buildStabilityEndToEndSummary } from '../state/contracts/stabilityEndToEndVerification';

const DOMAIN_ENUM = ['BODY', 'RESOURCES', 'CREATION', 'FOCUS'];

const TAB_CONFIG = [
  { key: 'structure', label: 'Structure', tagline: 'Contract' },
  { key: 'today', label: 'Today', tagline: 'Execution' },
  { key: 'stability', label: 'Stability', tagline: 'Signals' }
];
const ZION_VIEW_TABS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' }
];

const POS_REASON_LABELS = {
  POS_NO_PLAN: 'No plan available',
  POS_THROUGHPUT_MODEL_MISSING: 'Throughput model missing',
  POS_FEASIBILITY_INPUT_MISSING: 'Feasibility input missing',
  POS_UNSCHEDULABLE: 'Unschedulable',
  POS_TRAJECTORY_ON_TRACK: 'Trajectory on track',
  POS_TRAJECTORY_RECOVERABLE_DRIFT: 'Recoverable drift detected',
  POS_TRAJECTORY_AT_RISK: 'Trajectory at risk',
  POS_TRAJECTORY_INFEASIBLE: 'Infeasible trajectory',
  POS_REQUIRED_WEEKLY_THROUGHPUT_UP: 'Required weekly throughput increased',
  POS_TERMINAL_DRIFT_EXPIRED: 'Expired blocks indicate terminal drift',
  POS_DOWN_MISSED_WORK: 'Missed work increased',
  POS_DOWN_LATE_COMPLETION: 'Late completions increased',
  POS_UP_ON_TIME_COMPLETION: 'On-time completions increased',
  POS_UP_EARLY_RESCHEDULE: 'Early reschedules increased',
  POS_DOWN_LATE_RESCHEDULE: 'Late reschedules increased',
  POS_NEUTRAL_CANCELLATION: 'Cancellations recorded',
  POS_DOWN_FEASIBILITY_DECREASE: 'Feasibility decreased',
  POS_UP_FEASIBILITY_INCREASE: 'Feasibility increased',
};

const CONTRACT_FAILURE_LABELS = {
  ON_TRACK: 'On track',
  RECOVERABLE_DRIFT: 'Recoverable drift',
  OVERLOADED_CURRENT_CONTRACT: 'Overloaded current contract',
  INFEASIBLE_CURRENT_CONTRACT: 'Infeasible current contract',
  DEADLINE_FAILED_RENEGOTIATION_REQUIRED: 'Deadline failed, renegotiation required',
};

const RECOVERY_STATE_LABELS = {
  RECOVERY_WITHIN_CONTRACT: 'Recovery fits current contract',
  RECOVERY_RENEGOTIATION_REQUIRED: 'Recovery requires renegotiation',
};
// Dev note: activeDayKey is the only anchor for UI dates; avoid new Date/Date.now for display-critical state.

function useZionState() {
  const {
    today,
    currentWeek,
    cycle,
    lastPlanError,
    proposedBlocks,
    suggestedBlocks,
    deliverablesByCycleId,
    goalAdmissionByGoal,
    appTime,
    goalWorkById,
    constraints,
    debug,
    cyclesById,
    activeCycleId,
    goalExecutionContract,
    probabilityByGoal,
    feasibilityByGoal,
    profileLearning,
    planRecovery,
    pendingPlanConfirmation,
    setActiveCycle,
    deleteCycle,
    startNewCycle,
    startNewCycleWithDecision,
    generateScheduleForActiveCycle,
    generatePlanWithLLM,
    completeBlock,
    setDefiniteGoal,
    setPatternTargets,
    createBlock,
    updateBlock,
    deleteBlock,
    rescheduleBlock,
    setActiveDayKey,
    jumpToToday,
    tickNow,
    acceptSuggestedBlock,
    acceptSuggestedBlockWithPlacement,
    rejectSuggestedBlock,
    ignoreSuggestedBlock,
    dismissSuggestedBlock,
    createDeliverable,
    updateDeliverable,
    deleteDeliverable,
    createCriterion,
    toggleCriterionDone,
    deleteCriterion,
    linkBlockToDeliverable,
    assignSuggestionLink,
    generatePlan,
    commitPreviewItems,
    applyPlan,
    applyRenegotiationOption
  } = useIdentityStore();
  return {
    today,
    currentWeek,
    cycle,
    lastPlanError,
    proposedBlocks,
    suggestedBlocks,
    deliverablesByCycleId,
    goalAdmissionByGoal,
    appTime,
    goalWorkById,
    constraints,
    debug,
    cyclesById,
    activeCycleId,
    probabilityByGoal,
    feasibilityByGoal,
    planRecovery,
    pendingPlanConfirmation,
    actions: {
      completeBlock,
      setDefiniteGoal,
      setPatternTargets,
      createBlock,
      updateBlock,
      deleteBlock,
      rescheduleBlock,
      setActiveDayKey,
      jumpToToday,
      tickNow,
      acceptSuggestedBlock,
      acceptSuggestedBlockWithPlacement,
      rejectSuggestedBlock,
      ignoreSuggestedBlock,
      dismissSuggestedBlock,
      setActiveCycle,
      deleteCycle,
      startNewCycle,
      startNewCycleWithDecision,
      generateScheduleForActiveCycle,
      generatePlanWithLLM,
      createDeliverable,
      updateDeliverable,
      deleteDeliverable,
      createCriterion,
      toggleCriterionDone,
      deleteCriterion,
      linkBlockToDeliverable,
      assignSuggestionLink,
      generatePlan,
      commitPreviewItems,
      applyPlan,
      applyRenegotiationOption
    }
  };
}

export default function ZionDashboard({
  onBackHome,
  commandContext,
  assistantOpen = false,
  assistantInitialPrompt = null,
  onAssistantClose,
  initialView = null,
  initialZionView = 'day',
  initialAnchorDayKey = null
}) {
  const {
    today,
    currentWeek,
    cycle,
    proposedBlocks,
    suggestedBlocks,
    deliverablesByCycleId,
    goalAdmissionByGoal,
    appTime,
    goalWorkById,
    constraints,
    debug,
    lastPlanError,
    cyclesById,
    activeCycleId,
    goalExecutionContract,
    probabilityByGoal,
    feasibilityByGoal,
    profileLearning,
    planRecovery,
    pendingPlanConfirmation,
    actions
  } = useZionState();
  const activeCycle = activeCycleId && cyclesById ? cyclesById[activeCycleId] : null;
  const canonicalContract = getCanonicalCycleContract(activeCycle, goalExecutionContract);
  const goalId = canonicalContract?.goalId || null;
  const renderGoalId =
    goalId ||
    activeCycle?.goalContract?.goalId ||
    activeCycle?.goalGovernanceContract?.goalId ||
    activeCycle?.contract?.goalId ||
    null;
  const admissionRecord = goalId ? goalAdmissionByGoal?.[goalId] || activeCycle?.goalAdmission : activeCycle?.goalAdmission;
  const hasAdmittedGoal = Boolean(activeCycle?.goalContract);
  const normalizedAdmissionStatus = String(admissionRecord?.status || '').trim().toUpperCase();
  const isGoalAdmitted =
    hasAdmittedGoal &&
    (!admissionRecord || !normalizedAdmissionStatus || normalizedAdmissionStatus === 'ADMITTED' || normalizedAdmissionStatus === 'ACTIVE');

  function emitAction(name, payload, fn) {
    if (!fn) {
      traceNoop(name, 'handler missing');
      return;
    }
    traceAction(name, payload);
    fn(payload);
  }
  const normalizedCycleStatus = String(activeCycle?.status || activeCycle?.state || '')
    .trim()
    .toLowerCase();
  const cycleMode = normalizedCycleStatus === 'active' ? 'active' : 'review';
  const isCycleReadOnly = cycleMode !== 'active';
  const deliverables = useMemo(
    () => getCanonicalCycleDeliverables(deliverablesByCycleId, activeCycleId, activeCycle),
    [deliverablesByCycleId, activeCycleId, activeCycle]
  );
  const deliverablesWorkspace = useMemo(
    () => (activeCycleId && deliverablesByCycleId ? deliverablesByCycleId[activeCycleId] : null),
    [activeCycleId, deliverablesByCycleId]
  );
  const criteriaByDeliverable = useMemo(() => {
    const map = {};
    deliverables.forEach((d) => {
      map[d.id] = d.criteria || [];
    });
    return map;
  }, [deliverables]);
  const activeDayKey = appTime?.activeDayKey || today?.date || nowDayKey(appTime?.timeZone);
  const timeZone = appTime?.timeZone;
  const whatMovedToday = useMemo(
    () => deriveWhatMovedToday({ deliverableWorkspace: deliverablesWorkspace, dayKey: activeDayKey }),
    [deliverablesWorkspace, activeDayKey]
  );
  const cyclesIndex = useMemo(
    () =>
      projectCyclesIndex({
        cyclesById: cyclesById || {},
        goalWorkById: goalWorkById || {},
        constraints: constraints || {}
      }),
    [cyclesById, goalWorkById, constraints]
  );
  const readOnlyCycleEntry = isCycleReadOnly
    ? cyclesIndex?.find((entry) => entry.state !== 'Active' && entry.cycleId) || null
    : null;
  const readOnlyCycle = isCycleReadOnly
    ? activeCycle || (readOnlyCycleEntry ? cyclesById?.[readOnlyCycleEntry.cycleId] : null)
    : null;
  const readOnlySummaryStats =
    (readOnlyCycle?.summary && {
      completionCount: readOnlyCycle.summary.completionCount,
      completionRate: readOnlyCycle.summary.completionRate
    }) ||
    readOnlyCycleEntry?.summaryStats ||
    null;
  const summaryText = readOnlySummaryStats
    ? `Completion rate ${Math.round((readOnlySummaryStats.completionRate || 0) * 100)}% · ${readOnlySummaryStats.completionCount || 0} completions`
    : 'Summary pending';
  const startDayKey =
    readOnlyCycle?.startedAtDayKey || (readOnlyCycleEntry?.startISO || '').slice(0, 10) || null;
  const endDayKey =
    readOnlyCycle?.endedAtDayKey || (readOnlyCycleEntry?.endISO || '').slice(0, 10) || null;
  const rangeText = startDayKey
    ? endDayKey
      ? `${formatDayKeyLabel(startDayKey)} → ${formatDayKeyLabel(endDayKey)}`
      : `Started ${formatDayKeyLabel(startDayKey)}`
    : 'Dates pending';
  const learningUpdatesCount = profileLearning?.cycleCount ?? 0;
  const learningUpdatedAt = readOnlyCycle?.convergenceReport?.updatedAtISO || 'Pending';
  const bannerTitle =
    readOnlyCycle?.status === 'ended' || readOnlyCycleEntry?.state === 'Ended'
      ? 'Cycle ended — Read only'
      : 'Review Mode — Read only';
  const alternateActiveEntry = cyclesIndex?.find(
    (entry) => entry.state === 'Active' && entry.cycleId && entry.cycleId !== readOnlyCycle?.id
  );
  const canReturnToActive = Boolean(alternateActiveEntry);
  const cycleLabel =
    readOnlyCycle?.goalContract?.goalText ||
    readOnlyCycleEntry?.goalTitle ||
    (readOnlyCycle && readOnlyCycle.id) ||
    'Cycle';
  const DEV_TIME_DEBUG =
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    (localStorage.getItem('JERICHO_TIME_DEBUG') === '1' || localStorage.getItem('JERICHO_TIME_DEBUG') === 'true');
  const [view, setView] = useState(() => {
    if (initialView !== null && initialView !== undefined) return initialView;
    return 'today';
  });
  useEffect(() => {
    const errorCode = String(lastPlanError?.code || '').trim().toUpperCase();
    const requiredRecovery = String(planRecovery?.required || '').trim().toUpperCase();
    if (errorCode === 'MISSING_GOAL_DRAFT' || requiredRecovery === 'GOAL_DRAFT_CONTEXT') {
      setView('structure');
    }
  }, [lastPlanError?.code, planRecovery?.required]);
  // If there is no active cycle, route the UI to Structure for goal intake
  useEffect(() => {
    if (!activeCycleId) {
      setView('structure');
    }
  }, [activeCycleId]);
  // Sync hash changes to view state (e.g., when user navigates via URL)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncHashToView = () => {
      const currentHash = window.location.hash || '';
      if (currentHash.startsWith('#/structure')) {
        setView('structure');
      } else if (currentHash.startsWith('#/today')) {
        setView('today');
      } else if (currentHash.startsWith('#/stability')) {
        setView('stability');
      }
    };

    // Sync on mount
    syncHashToView();

    // Listen for hash changes (clicking back/forward, manual URL edits, etc.)
    window.addEventListener('hashchange', syncHashToView);

    return () => {
      window.removeEventListener('hashchange', syncHashToView);
    };
  }, []);
  const [assistantVisible, setAssistantVisible] = useState(assistantOpen);
  const [isCycleTransitionModalOpen, setCycleTransitionModalOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [zionView, setZionView] = useState(() => initialZionView || 'day');
  const [anchorDayKey, setAnchorDayKey] = useState(() => initialAnchorDayKey || activeDayKey);
  useEffect(() => {
    setAssistantVisible(assistantOpen);
  }, [assistantOpen]);
  const changeView = React.useCallback((mode) => {
    traceAction(`tabs.${mode}`, { mode });
    setView(mode);
  }, []);

  const primaryObjectiveId = today?.primaryObjectiveId || null;
  useEffect(() => {
    if (zionView === 'day') setAnchorDayKey(activeDayKey);
  }, [activeDayKey, zionView]);
  const normalizeDayKeyValue = (value) => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return dayKeyFromISO(value, timeZone);
  };
  const viewDayKey = zionView === 'day' ? anchorDayKey : null;
  const contractStartDateValue =
    activeCycle?.startedAtDayKey ||
    activeCycle?.goalGovernanceContract?.activeFromISO ||
    activeCycle?.goalContract?.startDayKey ||
    activeCycle?.goalContract?.startDateISO ||
    activeCycle?.goalContract?.startDate ||
    activeCycle?.goalContract?.temporalBinding?.startDayKey ||
    goalExecutionContract?.startDateISO ||
    goalExecutionContract?.startDate ||
    goalExecutionContract?.temporalBinding?.startDayKey ||
    null;
  const contractStartDayKey = normalizeDayKeyValue(contractStartDateValue);
  const suppressSuggestionsForPreStartDay =
    Boolean(contractStartDayKey && viewDayKey && viewDayKey < contractStartDayKey);
  const suppressDrafts = suppressSuggestionsForPreStartDay;
  const canGenerateSchedule = Boolean(!isCycleReadOnly && !suppressDrafts && hasAdmittedGoal && isGoalAdmitted);
  const allRenderedBlocks = useMemo(() => {
    const rawBlocks = getAllBlocks({ today, currentWeek, cycle });
    return normalizeBlocks(rawBlocks);
  }, [today, currentWeek, cycle]);
  const normalizedBlocks = useMemo(() => {
    if (!activeCycleId || !isGoalAdmitted) return [];
    const filtered = (allRenderedBlocks || []).filter(
      (block) =>
        block?.cycleId === activeCycleId &&
        (!renderGoalId || !block?.goalId || block?.goalId === renderGoalId)
    );
    return filtered;
  }, [allRenderedBlocks, activeCycleId, renderGoalId, isGoalAdmitted]);
  const dayBlocksMap = useMemo(() => {
    const map = new Map();
    (normalizedBlocks || []).forEach((b) => {
      const key = b.date || dayKeyFromISO(b.start || '', timeZone);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(b);
    });
    return map;
  }, [normalizedBlocks, timeZone]);
  const selectedDayBlocks = dayBlocksMap.get(activeDayKey) || [];
  const anchorISO = anchorDayKey ? `${anchorDayKey}T12:00:00.000Z` : appTime?.nowISO || '';
  const windowSpec = buildWindowSpec(zionView, anchorISO, timeZone);
  const windowLabel = formatWindowLabel(windowSpec, timeZone);
  const monthDays = useMemo(() => {
    const anchor = activeDayKey || today?.date || currentWeek?.weekStart || nowDayKey(timeZone);
    return projectMonthDays({ monthKey: anchor, blocks: normalizedBlocks, includePadding: true });
  }, [today, currentWeek, activeDayKey, timeZone, normalizedBlocks]);
  const scheduleSource = getCanonicalProposedBlocks(proposedBlocks, suggestedBlocks);
  const suggestedActive = useMemo(
    () =>
      (scheduleSource || []).filter((s) => {
        if (!s || s.status !== 'suggested') return false;
        if (!activeCycleId || !isGoalAdmitted) return false;
        if (s?.cycleId && s.cycleId !== activeCycleId) return false;
        if (!renderGoalId || !s?.goalId) return true;
        return s?.goalId === renderGoalId;
      }),
    [scheduleSource, activeCycleId, renderGoalId, isGoalAdmitted]
  );
  const deliverableTitleById = useMemo(() => {
    const map = new Map();
    deliverables.forEach((d) => {
      if (d?.id) map.set(d.id, d.title || d.id);
    });
    return map;
  }, [deliverables]);
  const criterionTextById = useMemo(() => {
    const map = new Map();
    deliverables.forEach((d) => {
      (d.criteria || []).forEach((c) => {
        map.set(c.id, c.text || c.id);
      });
    });
    return map;
  }, [deliverables]);
  const contract = canonicalContract;
  const deadlineDayKey = getContractDeadlineDayKey(contract);
  const proposedScheduleItemsAll = useMemo(() => {
    const items = (suggestedActive || []).filter((item) => {
      const dayKey = item?.dayKey || dayKeyFromISO(item?.startISO || '', timeZone);
      if (!dayKey) return false;
      if (contractStartDayKey && dayKey < contractStartDayKey) return false;
      if (deadlineDayKey && dayKey > deadlineDayKey) return false;
      return true;
    });
    return items;
  }, [suggestedActive, contractStartDayKey, deadlineDayKey, timeZone]);
  const proposedScheduleItems = useMemo(() => {
    if (!viewDayKey) return proposedScheduleItemsAll;
    return proposedScheduleItemsAll.filter((item) => {
      const dayKey = item?.dayKey || dayKeyFromISO(item?.startISO || '', timeZone);
      return dayKey === viewDayKey;
    });
  }, [proposedScheduleItemsAll, viewDayKey, timeZone]);
  const proposedScheduleItemsGrouped = useMemo(
    () =>
      Object.entries(
        proposedScheduleItemsAll.reduce((acc, item) => {
          const dayKey = item?.dayKey || dayKeyFromISO(item?.startISO || item?.start || item?.date || '', timeZone);
          if (!dayKey) return acc;
          if (!acc[dayKey]) acc[dayKey] = [];
          acc[dayKey].push(item);
          return acc;
        }, {})
      ).sort(([a], [b]) => (a < b ? -1 : 1)),
    [proposedScheduleItemsAll, timeZone]
  );
  const [pendingPlacement, setPendingPlacement] = useState(null);
  const [addBlockError, setAddBlockError] = useState('');
  const [strictProgressMode, setStrictProgressMode] = useState(true);
  const [renegotiationFeedback, setRenegotiationFeedback] = useState('');

  function addMinutesToISO(iso, minutes) {
    const startMs = Date.parse(iso);
    const duration = Number.isFinite(minutes) ? minutes : 0;
    if (!Number.isFinite(startMs)) return null;
    return new Date(startMs + duration * 60 * 1000).toISOString();
  }

  const confirmPlacement = () => {
    if (isCycleReadOnly) return;
    if (!pendingPlacement?.suggestionId) return;
    if (
      strictProgressMode &&
      pendingPlacement.isProgress &&
      !pendingPlacement.criterionId
    ) {
      setAddBlockError('Strict mode: progress blocks need a linked criterion.');
      return;
    }
    const startISO = buildStartISO(pendingPlacement.date, pendingPlacement.time);
    if (!startISO) {
      setAddBlockError('Invalid time format. Use HH:MM or HH:MM AM/PM.');
      return;
    }
    const endISO = addMinutesToISO(startISO, pendingPlacement.durationMinutes);
    if (DEV_TIME_DEBUG) {
      console.log('ACCEPT_SUGGESTION_PLACEMENT', {
        activeDayKey,
        selectedDayKey: pendingPlacement.date,
        selectedTime: pendingPlacement.time,
        startISO,
        resolvedDayKey: dayKeyFromISO(startISO, timeZone)
      });
    }
    setAddBlockError('');
    emitAction('suggestedPath.assignPlacement', {
      cycleId: activeCycleId,
      suggestionId: pendingPlacement.suggestionId,
      deliverableId: pendingPlacement.isProgress ? (pendingPlacement.deliverableId || null) : null,
      criterionId: pendingPlacement.isProgress ? (pendingPlacement.criterionId || null) : null
    }, actions.assignSuggestionLink);
    if (actions.acceptSuggestedBlockWithPlacement) {
      traceAction('suggestedPath.accept', { suggestionId: pendingPlacement.suggestionId, cycleId: activeCycleId });
      actions.acceptSuggestedBlockWithPlacement(pendingPlacement.suggestionId, {
        start: startISO,
        durationMinutes: pendingPlacement.durationMinutes,
        domain: applyDomainEnum(pendingPlacement.domain),
        title: pendingPlacement.title || 'Untitled task',
        surface: 'today',
        timeZone,
        deliverableId: pendingPlacement.isProgress ? (pendingPlacement.deliverableId || null) : null,
        criterionId: pendingPlacement.isProgress ? (pendingPlacement.criterionId || null) : null
      });
      if (endISO) {
        traceAction('blocks.reschedule', { blockId: `blk-${pendingPlacement.suggestionId}`, startISO, endISO });
        actions.rescheduleBlock?.(`blk-${pendingPlacement.suggestionId}`, startISO, endISO);
      }
    } else {
      const blockId = `blk-${pendingPlacement.suggestionId}`;
      traceAction('suggestedPath.accept', { suggestionId: pendingPlacement.suggestionId, cycleId: activeCycleId });
      actions.acceptSuggestedBlock?.(pendingPlacement.suggestionId);
      if (endISO) {
        traceAction('blocks.reschedule', { blockId, startISO, endISO });
        actions.rescheduleBlock?.(blockId, startISO, endISO);
      } else {
        traceAction('blocks.update', { blockId, startISO });
        actions.updateBlock?.({
          id: blockId,
          start: startISO,
          durationMinutes: pendingPlacement.durationMinutes,
          domain: applyDomainEnum(pendingPlacement.domain),
          title: pendingPlacement.title || 'Untitled task',
          surface: 'today',
          timeZone
        });
      }
    }
    emitAction('today.nav.selectDay', { dayKey: pendingPlacement.date }, actions.setActiveDayKey);
    setPendingPlacement(null);
  };

  const handleCloseLinkedCriterion = (block) => {
    if (!block?.deliverableId || !block?.criterionId) return;
    emitAction('deliverables.toggleCriterion', {
      cycleId: activeCycleId,
      deliverableId: block.deliverableId,
      criterionId: block.criterionId,
      isDone: true
    }, actions.toggleCriterionDone);
  };

  const monthDayMetrics = useMemo(() => computeDayMetricsMap({ blocks: normalizedBlocks, dayKeys: (monthDays || []).map((d) => d.date) }), [normalizedBlocks, monthDays]);
  const monthDaysWithMetrics = useMemo(
    () =>
      (monthDays || []).map((d) => {
        const m = monthDayMetrics[d.date];
        if (!m) return d;
        return {
          ...d,
          plannedMinutes: m.plannedMinutes,
          completedMinutes: m.completedMinutes,
          completionRate: m.cr
        };
      }),
    [monthDays, monthDayMetrics]
  );

  const stabilityView = useMemo(() => computeStability({ monthDays: monthDaysWithMetrics }), [monthDaysWithMetrics]);

  const applyDomainEnum = (value) => {
    if (!value) return 'FOCUS';
    const upper = value.toString().trim().toUpperCase();
    return DOMAIN_ENUM.includes(upper) ? upper : 'FOCUS';
  };

  const buildStartISO = (dateKey, timeStr) => {
    const day = dateKey || activeDayKey || nowDayKey(timeZone);
    const result = localStartFromDayAndTime(day, timeStr, timeZone);
    if (!result?.ok) {
      if (DEV_TIME_DEBUG) {
        console.warn('Time parsing failed', { day, timeStr, reason: result?.reason });
      }
      return null;
    }
    assertValidISO('startISO', result.startISO, { day, timeStr });
    return isValidISO(result.startISO) ? result.startISO : null;
  };


  const handleCreateForDate = (dateKey, { title, domain, durationMinutes, time, linkToGoal, deliverableId, criterionId, isProgress }) => {
    if (isCycleReadOnly) return;
    if (
      strictProgressMode &&
      isProgress &&
      !criterionId
    ) {
      setAddBlockError('Strict mode: progress blocks need a linked criterion.');
      return;
    }
    const startISO = buildStartISO(dateKey, time);
    if (!startISO) {
      setAddBlockError('Invalid time format. Use HH:MM or HH:MM AM/PM.');
      return;
    }
    if (DEV_TIME_DEBUG) {
      console.log('ADD_BLOCK', {
        activeDayKey,
        selectedDayKey: dateKey,
        selectedTime: time,
        startISO,
        resolvedDayKey: dayKeyFromISO(startISO, timeZone)
      });
    }
    setAddBlockError('');
    traceAction('addBlock.submit', {
      date: dateKey,
      time,
      durationMinutes: durationMinutes || 30,
      domain,
      title,
      linkToGoal,
      deliverableId,
      criterionId,
      isProgress
    });
    actions.createBlock({
      timeZone,
      date: dateKey,
      start: startISO,
      durationMinutes: durationMinutes || 30,
      domain: applyDomainEnum(domain),
      title: title || 'Untitled task',
      surface: 'today',
      origin: 'manual',
      goalId: linkToGoal === false ? null : goalId || null,
      linkToGoal,
      deliverableId: isProgress ? (deliverableId || null) : null,
      criterionId: isProgress ? (criterionId || null) : null
    });
    emitAction('today.nav.selectDay', { dayKey: dateKey }, actions.setActiveDayKey);
  };

  const handleEditBlock = (id, patch) => {
    if (isCycleReadOnly) return;
    traceAction('blocks.edit', { blockId: id, patch });
    const target = (normalizedBlocks || []).find((b) => b.id === id);
    if (target?.lockedUntilDayKey && target?.start) {
      const blockDayKey = target.start.slice(0, 10);
      if (blockDayKey && blockDayKey <= target.lockedUntilDayKey) {
        setAddBlockError('Locked block: cannot edit during the first 7 days.');
        return;
      }
    }
    const dateKey = patch?.date || (target?.start ? dayKeyFromISO(target.start, timeZone) : activeDayKey);
    const timeValue = patch?.time || (target?.start ? target.start.slice(11, 16) : '09:00');
    const startISO = buildStartISO(dateKey, timeValue);
    if (!startISO) {
      setAddBlockError('Invalid time format. Use HH:MM or HH:MM AM/PM.');
      return;
    }
    const durationMinutes = patch?.durationMinutes;
    const endISO = durationMinutes ? addMinutesToISO(startISO, durationMinutes) : null;
    if (endISO) {
      traceAction('blocks.reschedule', { blockId: id, startISO, endISO });
      actions.rescheduleBlock?.(id, startISO, endISO);
    }
    traceAction('blocks.update', { blockId: id });
    actions.updateBlock?.({
      id,
      domain: applyDomainEnum(patch.domain || target?.domain || target?.practice),
      title: patch?.title,
      surface: 'today'
    });
    setAddBlockError('');
    if (patch?.date) actions.setActiveDayKey?.(patch.date);
  };

  const handleDeleteBlock = (id) => {
    if (isCycleReadOnly) return;
    const target = (normalizedBlocks || []).find((b) => b.id === id);
    if (target?.lockedUntilDayKey && target?.start) {
      const blockDayKey = target.start.slice(0, 10);
      if (blockDayKey && blockDayKey <= target.lockedUntilDayKey) {
        setAddBlockError('Locked block: cannot delete during the first 7 days.');
        return;
      }
    }
    traceAction('blocks.delete', { blockId: id });
    actions.deleteBlock?.(id);
  };

  const handleCompleteBlock = (id) => {
    if (isCycleReadOnly) return;
    traceAction('blocks.complete', { blockId: id });
    actions.completeBlock?.(id);
  };

  const handleDrillToDay = (dayKey) => {
    if (!dayKey) return;
    traceAction('today.nav.selectDay', { dayKey });
    setZionView('day');
    actions.setActiveDayKey?.(dayKey);
  };

  const shiftAnchor = (delta) => {
    const nextKey = shiftAnchorDayKey(anchorISO, zionView, delta, timeZone);
    if (!nextKey) return;
    traceAction(delta > 0 ? 'today.nav.next' : 'today.nav.prev', { dayKey: nextKey, view: zionView });
    if (zionView === 'day') {
      actions.setActiveDayKey?.(nextKey);
    } else {
      setAnchorDayKey(nextKey);
    }
  };

  const jumpToAnchorToday = () => {
    const todayKey = appTime?.activeDayKey || dayKeyFromISO(appTime?.nowISO || '', timeZone);
    if (todayKey) setAnchorDayKey(todayKey);
    traceAction('today.nav.today', { dayKey: todayKey, view: zionView });
    actions.jumpToToday?.();
  };

  const handleGenerateSchedule = () => {
    if (isCycleReadOnly || suppressDrafts) return;
    const cycleId = activeCycleId || null;
    if (!hasAdmittedGoal || !isGoalAdmitted) {
      traceAction('schedule.generate.blocked.missing-goal', { cycleId, goalId: goalId || null });
      setView('structure');
      return;
    }
    traceAction('schedule.generate.click', { cycleId });
    if (typeof actions.generateScheduleForActiveCycle === 'function') {
      actions.generateScheduleForActiveCycle();
      return;
    }
    if (typeof actions.generatePlanWithLLM === 'function') {
      actions.generatePlanWithLLM({ cycleId });
      return;
    }
    actions.generatePlan?.({ cycleId });
  };

  const handleApplySchedule = () => {
    if (isCycleReadOnly || suppressDrafts || proposedScheduleItemsAll.length === 0) return;
    const cycleId = activeCycleId || null;
    traceAction('schedule.apply.click', { cycleId, count: proposedScheduleItemsAll.length });
    if (typeof actions.applyPlan === 'function') {
      actions.applyPlan({ cycleId });
      const firstBlock = proposedScheduleItemsAll
        .slice()
        .sort((a, b) => {
          const left = a?.startISO || a?.start || a?.date || '';
          const right = b?.startISO || b?.start || b?.date || '';
          return left < right ? -1 : 1;
        })[0];
      if (firstBlock) {
        const firstDayKey = dayKeyFromISO(firstBlock?.startISO || firstBlock?.start || firstBlock?.date || '', timeZone);
        if (firstDayKey) {
          setAnchorDayKey(firstDayKey);
          if (zionView === 'day') {
            setZionView('week');
          }
        }
      }
      return;
    }
    actions.commitPreviewItems?.({
      cycleId,
      items: proposedScheduleItemsAll.map((item) => ({
        id: item.id,
        dayKey: item.dayKey || dayKeyFromISO(item.startISO || '', timeZone),
        startISO: item.startISO,
        minutes: item.durationMinutes,
        title: item.title,
        domainKey: item.domain
      }))
    });
  };

  const handleApplyRenegotiationOption = (option, index) => {
    if (isCycleReadOnly || !option) return;
    const optionType = String(option?.type || '').trim().toUpperCase();
    const isSupported = optionType === 'EXTEND_DEADLINE' || optionType === 'INCREASE_THROUGHPUT';
    if (!isSupported) {
      setRenegotiationFeedback(`Option ${optionType || 'UNKNOWN'} is analysis-only in this build.`);
      return;
    }
    setRenegotiationFeedback(`Applying ${optionType}...`);
    traceAction('renegotiation.apply', {
      cycleId: activeCycleId,
      goalId,
      optionType,
      optionIndex: index,
      delta: Number.isFinite(Number(option?.delta)) ? Number(option.delta) : null,
    });
    actions.applyRenegotiationOption?.({
      cycleId: activeCycleId,
      goalId,
      optionType,
      optionIndex: Number.isInteger(index) ? index : null,
      option,
    });
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '1') changeView('today');
      if (e.key === '2') changeView('structure');
      if (e.key === '3') changeView('stability');
      if (e.key === 'Escape') return;
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [changeView]);

  const probability = goalId ? probabilityByGoal?.[goalId] : null;
  const feasibility = goalId ? feasibilityByGoal?.[goalId] : null;
  const cycleStartKey = canonicalContract?.startDayKey || null;
  const cycleEndKey = canonicalContract?.endDayKey || null;
  const daysToDeadline = cycleEndKey ? dayKeyDistance(activeDayKey, cycleEndKey, timeZone) : null;
  const fallbackNowISO = activeDayKey ? `${activeDayKey}T12:00:00.000Z` : '';
  const probabilityWindowSpec = getProbabilityWindowSpec({
    activeContract: canonicalContract,
    nowISO: appTime?.nowISO || fallbackNowISO,
    timeZone,
    scoringWindowDays: probability?.scoringSummary?.K
  });
  const probabilityWindowLabel = formatProbabilityWindowLabel(probabilityWindowSpec);
  const cycleMetrics = activeCycle?.metrics || {};
  const posScore = Number.isFinite(cycleMetrics.posScore) ? Number(cycleMetrics.posScore) : null;
  const feasibilityScore =
    Number.isFinite(cycleMetrics.feasibilityScore) ? Number(cycleMetrics.feasibilityScore) : null;
  const integrityScoreCycle =
    Number.isFinite(cycleMetrics.integrityScore) ? Number(cycleMetrics.integrityScore) : null;
  const safeStability = stabilityView || {};
  const stabilityE2E = useMemo(() => buildStabilityEndToEndSummary(), []);
  const stabilityRecoverySummary = useMemo(() => {
    const lanes = stabilityE2E?.laneVerifications || [];
    return {
      withSignals: lanes.filter((lane) => lane.recovery.signalCount > 0).length,
      noRecoveryNeeded: lanes.filter((lane) => lane.recovery.signalCount === 0).length,
      confirmationRequired: lanes.filter((lane) => lane.recovery.recommendation.confirmationRequired).length,
    };
  }, [stabilityE2E]);
  const stabilityScoreRaw = Math.min(
    Number.isFinite(safeStability.completionRate) ? safeStability.completionRate : 0,
    Number.isFinite(safeStability.driftScore) ? safeStability.driftScore : 0,
    Number.isFinite(safeStability.streakScore) ? safeStability.streakScore : 0,
    Number.isFinite(safeStability.momentumScore) ? safeStability.momentumScore : 0
  );
  const stabilityScore = Math.max(0, Math.min(100, Math.round(stabilityScoreRaw * 100)));
  const stabilityBand = stabilityScore >= 80 ? 'High' : stabilityScore >= 50 ? 'Moderate' : 'Low';
  const posValue =
    posScore !== null
      ? Math.round(posScore * 100)
      : feasibilityScore !== null
      ? Math.round(Math.max(0, Math.min(1, feasibilityScore)) * 100)
      : null;
  const shouldShowPosDash = posScore === null && feasibilityScore === null;
  const posFallbackZero = posScore === null && feasibilityScore === 0;
  const missingPosWithFeasibility = posScore === null && feasibilityScore !== null && feasibilityScore !== 0;
  const shouldRenderFeasibilityWarning = hasAdmittedGoal && missingPosWithFeasibility;
  const posExplanation = cycleMetrics?.posExplanation || null;
  const posReasons = Array.isArray(posExplanation?.reasons) ? posExplanation.reasons : [];
  const hasNoPlanReason = posReasons.some((reason) => reason?.code === 'POS_NO_PLAN');
  const hasThroughputModelMissingReason = posReasons.some((reason) => reason?.code === 'POS_THROUGHPUT_MODEL_MISSING');
  const hasFeasibilityInputMissingReason = posReasons.some((reason) => reason?.code === 'POS_FEASIBILITY_INPUT_MISSING');
  const hasUnschedulableReason = posReasons.some((reason) => reason?.code === 'POS_UNSCHEDULABLE');
  const unschedulableConflicts = Array.isArray(posExplanation?.conflicts)
    ? posExplanation.conflicts.slice(0, 2)
    : [];
  const shouldRenderWhyChanged =
    Boolean(posExplanation) &&
    (posExplanation?.delta !== null || hasNoPlanReason || hasUnschedulableReason || posReasons.length > 0);
  const probabilityStatusLabel = (() => {
    if (probability?.status === 'INFEASIBLE' || feasibility?.status === 'INFEASIBLE') return 'Infeasible';
    if (probability?.status === 'UNSCHEDULABLE') return 'Unschedulable';
    if (probability?.status === 'ELIGIBLE') return 'Eligible';
    if (probability?.status === 'INELIGIBLE') return 'Ineligible';
    if (probability?.status === 'NO_EVIDENCE') return 'No evidence';
    return 'Unknown';
  })();
  const probabilityExplanation = (() => {
    if (probability?.status === 'INFEASIBLE' || feasibility?.status === 'INFEASIBLE') {
      return 'Feasibility gate indicates current constraints cannot meet the deadline.';
    }
    if (probability?.status === 'UNSCHEDULABLE') return 'Horizon schedule is not placeable under current constraints.';
    if (probability?.status === 'INELIGIBLE') return 'Evidence window is below the minimum required to update probability.';
    if (probability?.status === 'ELIGIBLE') return 'Forecast uses workable days remaining and required weekly throughput vs your average.';
    if (probability?.status === 'NO_EVIDENCE') return 'No completion evidence yet; showing initial forecast cap.';
    return 'Insufficient data to compute probability yet.';
  })();
  const requiredPerWeek = Number.isFinite(cycleMetrics?.requiredWeeklyThroughput)
    ? cycleMetrics.requiredWeeklyThroughput
    : feasibility?.requiredBlocksPerDay
      ? feasibility.requiredBlocksPerDay * 7
      : null;
  const avgPerWeek = probability?.scoringSummary?.mu ? probability.scoringSummary.mu * 7 : null;
  const workableDaysRemaining = Number.isFinite(cycleMetrics?.workableDaysRemaining)
    ? cycleMetrics.workableDaysRemaining
    : feasibility?.workableDaysRemaining;
  const contractFailureState = String(cycleMetrics?.contractFailureState || '').trim().toUpperCase() || null;
  const contractFailureLabel = contractFailureState
    ? CONTRACT_FAILURE_LABELS[contractFailureState] || contractFailureState
    : null;
  const contractFailureReasons = Array.isArray(cycleMetrics?.contractFailureReasons)
    ? cycleMetrics.contractFailureReasons
    : [];
  const contractRenegotiationRequired = Boolean(cycleMetrics?.contractRenegotiationRequired);
  const recoveryState = String(cycleMetrics?.recoveryState || '').trim().toUpperCase() || null;
  const recoveryStateLabel = recoveryState ? RECOVERY_STATE_LABELS[recoveryState] || recoveryState : null;
  const recoveryReasons = Array.isArray(cycleMetrics?.recoveryReasons) ? cycleMetrics.recoveryReasons : [];
  const recoveryMetrics = cycleMetrics?.recoveryMetrics || {};
  const recoveryOptions = Array.isArray(cycleMetrics?.renegotiationOptions) ? cycleMetrics.renegotiationOptions : [];
  const recoveryRenegotiationRequired = Boolean(cycleMetrics?.renegotiationRequired);
  const renegotiationApplyResult = cycleMetrics?.renegotiationApplyResult || null;
  const lastRenegotiationApplied = activeCycle?.lastRenegotiationApplied || null;

  useEffect(() => {
    if (!renegotiationApplyResult?.status) return;
    if (renegotiationApplyResult.status === 'APPLIED') {
      setRenegotiationFeedback(`Renegotiation applied: ${renegotiationApplyResult.optionType || 'OPTION'}.`);
      return;
    }
    if (renegotiationApplyResult.status === 'UNSUPPORTED') {
      setRenegotiationFeedback(renegotiationApplyResult.reason || 'Renegotiation option is analysis-only.');
    }
  }, [renegotiationApplyResult?.status, renegotiationApplyResult?.optionType, renegotiationApplyResult?.reason]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.mode = 'zion';
    }
  }, []);

  return (
    <div className="space-y-5 relative bg-white text-jericho-text">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.key}
              onClick={() => changeView(tab.key)}
              className={`px-3 py-2 rounded-lg border text-left ${
                view === tab.key
                  ? 'border-jericho-accent text-jericho-accent font-semibold'
                  : 'border-line/60 text-muted'
              }`}
            >
              <span className="block">{tab.label}</span>
              <span className="block text-[11px] text-muted">{tab.tagline}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {!REDUCE_UI ? (
            <button
              className="text-xs text-muted hover:text-jericho-accent"
              onClick={() => setAssistantVisible(true)}
            >
              Assistant
            </button>
          ) : null}
          {onBackHome ? (
            <button className="text-xs text-muted hover:text-jericho-accent" onClick={onBackHome}>
              Home
            </button>
          ) : null}
        </div>
      </div>

      {isCycleReadOnly ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-amber-700">{bannerTitle}</p>
              <p className="text-lg font-semibold text-jericho-text">{cycleLabel}</p>
              <p className="text-[11px] text-muted">{rangeText}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-full border border-jericho-accent px-3 py-1 text-xs font-semibold text-jericho-accent hover:bg-jericho-accent/10"
                onClick={() => {
                  setCycleTransitionModalOpen(true);
                }}
              >
                Start new cycle
              </button>
              {canReturnToActive ? (
                <button
                  className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent disabled:opacity-50"
                  disabled={!alternateActiveEntry}
                  onClick={() => alternateActiveEntry && actions.setActiveCycle?.(alternateActiveEntry.cycleId)}
                >
                  Back to active cycle
                </button>
              ) : null}
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-xs text-muted">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Cycle Summary</p>
              <p className="text-sm text-jericho-text">{summaryText}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Ended at</p>
              <p className="text-sm text-jericho-text">
                {endDayKey ? formatDayKeyLabel(endDayKey) : 'Pending'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Learning updates</p>
              <p className="text-sm text-jericho-text">Captured {learningUpdatesCount} update(s)</p>
              <p className="text-[11px] text-muted">
                {learningUpdatedAt === 'Pending'
                  ? 'Pending'
                  : `Last updated ${new Date(learningUpdatedAt).toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`mt-2 grid gap-8 ${assistantVisible ? 'grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-1'}`}>
        <div className="space-y-5">
          {view !== 'structure' ? (
            <div>
              <span className="text-xs uppercase tracking-[0.14em] text-muted">System Loop</span>
              <p className="text-[11px] text-muted mt-1">Identity → Discipline → Project Management → Data Analysis</p>
            </div>
          ) : null}

          {view === 'today' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-2">
                  {ZION_VIEW_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setZionView(tab.key)}
                      className={`px-3 py-2 rounded-lg border text-left ${
                        zionView === tab.key
                          ? 'border-jericho-accent text-jericho-accent font-semibold'
                          : 'border-line/60 text-muted'
                      }`}
                    >
                      <span className="block text-xs">{tab.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
                  onClick={() => shiftAnchor(-1)}
                >
                  Prev
                </button>
                <div className="text-center">
                  <p className="text-lg font-semibold" data-window-label>
                    {zionView === 'day' ? formatDayKeyLabel(activeDayKey) : windowLabel}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                    {zionView === 'day' ? 'Today' : zionView}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
                    onClick={jumpToAnchorToday}
                  >
                    Today
                  </button>
                  <button
                    className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
                    onClick={() => shiftAnchor(1)}
                  >
                    Next
                  </button>
                </div>
              </div>

              {zionView === 'day' ? (
                <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
                  <div className="space-y-3">
                    <BlockColumn
                      dateLabel={activeDayKey}
                      blocks={selectedDayBlocks}
                      drafts={[]}
                      primaryObjectiveId={primaryObjectiveId}
                      chainTaskId={primaryObjectiveId}
                      onBlockClick={(id) => setSelectedBlockId(id)}
                    />
                    <div className="rounded-md border border-line/60 bg-jericho-surface/90 px-3 py-3 text-xs space-y-3">
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Draft schedule</p>
                        <p className="text-[11px] text-muted">
                          Preview only. Nothing is scheduled until you apply to the control room.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/10"
                          onClick={handleGenerateSchedule}
                          disabled={!canGenerateSchedule}
                        >
                          Generate schedule
                        </button>
                        <button
                          className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
                          onClick={handleApplySchedule}
                          disabled={isCycleReadOnly || proposedScheduleItemsAll.length === 0 || suppressDrafts}
                        >
                          Apply schedule
                        </button>
                      </div>
                      {pendingPlanConfirmation ? (
                        <p className="text-[11px] text-amber-600">
                          Proposed schedule is awaiting confirmation. Review the draft, then apply to commit it.
                        </p>
                      ) : null}
                      {isCycleReadOnly ? (
                        <p className="text-[11px] text-amber-600">Cycle ended/read-only. Generate and apply are disabled.</p>
                      ) : !hasAdmittedGoal || !isGoalAdmitted ? (
                        <p className="text-[11px] text-amber-600">
                          Complete goal setup in Structure before generating a schedule.
                        </p>
                      ) : null}
                      {suppressDrafts && contractStartDayKey ? (
                        <p className="text-[11px] text-amber-600">
                          Drafts begin on {formatDayKeyLabel(contractStartDayKey)}. Nothing before that date.
                        </p>
                      ) : proposedScheduleItemsAll.length > 0 && proposedScheduleItems.length === 0 ? (
                        <div className="space-y-3">
                          <p className="text-xs text-muted">
                            {proposedScheduleItemsAll.length} block(s) proposed across your plan window. Showing full
                            schedule preview:
                          </p>
                          {proposedScheduleItemsGrouped.map(([dayKey, items]) => (
                            <div key={dayKey} className="space-y-2">
                              <p className="text-[11px] font-semibold text-muted">{formatDayKeyLabel(dayKey)}</p>
                              {items.map((item) => (
                                <div
                                  key={item.id || item.blockId}
                                  className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2 text-[11px] space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-jericho-text">{item.title}</span>
                                    <span className="text-muted">
                                      {item.durationMinutes || 30}m
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted">
                                    {formatTime(item.startISO)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : lastPlanError?.code ? (
                        <p className="text-[11px] text-red-600">
                          Generate failed: {lastPlanError.code}
                          {lastPlanError?.reasonCodes?.length ? ` (${lastPlanError.reasonCodes.join(', ')})` : ''}
                        </p>
                      ) : proposedScheduleItems.length ? (
                        proposedScheduleItems.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2 text-[11px] space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-jericho-text">{item.title}</span>
                              <span className="text-muted">
                                {item.durationMinutes || 30}m
                              </span>
                            </div>
                            <p className="text-[11px] text-muted">
                              {formatTime(item.startISO)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted">No proposed schedule blocks yet. Generate schedule first.</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <PlanningPanel
                      surface="today"
                      selectedDayKey={activeDayKey}
                      onSelectedDayKeyChange={actions.setActiveDayKey}
                      blocks={selectedDayBlocks}
                      selectedBlockId={selectedBlockId}
                      onSelectBlock={setSelectedBlockId}
                      onAddBlock={(day, payload) => handleCreateForDate(day, payload)}
                      errorMessage={addBlockError}
                      timeZone={timeZone}
                      onDeleteBlock={handleDeleteBlock}
                      onComplete={handleCompleteBlock}
                      onEdit={handleEditBlock}
                      onLinkCriterion={(block) => handleCloseLinkedCriterion(block)}
                      deliverables={deliverables}
                      criteriaByDeliverable={criteriaByDeliverable}
                      whatMovedToday={whatMovedToday}
                      strictMode={strictProgressMode}
                      criterionLabelById={Object.fromEntries(criterionTextById)}
                      readOnly={isCycleReadOnly}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {zionView === 'week' ? (
                    <ZionWeekView
                      days={getWeekDayKeys(anchorISO, timeZone).map((dayKey) => {
                        const stats = getDayStats(dayKey, dayBlocksMap);
                        return {
                          dayKey,
                          label: formatDayKeyLabel(dayKey),
                          ...stats
                        };
                      })}
                      onSelectDay={handleDrillToDay}
                      onSelectBlock={setSelectedBlockId}
                    />
                  ) : null}
                  {zionView === 'month' ? (
                    <ZionMonthView
                      days={getMonthDayKeys(anchorISO, timeZone).map((dayKey) => {
                        const stats = getDayStats(dayKey, dayBlocksMap);
                        const titles = (stats.blocks || [])
                          .slice(0, 2)
                          .map((b) => b.title || b.label || 'Untitled task');
                        return {
                          date: dayKey,
                          dayNumber: Number(dayKey.slice(8, 10)),
                          inMonth: dayKey.slice(0, 7) === windowSpec.startDayKey.slice(0, 7),
                          plannedCount: stats.plannedCount,
                          completedCount: stats.completedCount,
                          completionRate: stats.completionRate,
                          titles,
                          moreCount: Math.max(0, (stats.blocks || []).length - titles.length)
                        };
                      })}
                      onSelectDay={handleDrillToDay}
                    />
                  ) : null}
                  {zionView === 'quarter' ? (
                    <ZionQuarterView
                      months={getQuarterMonths(anchorISO, timeZone).map((monthKey) => {
                        const monthDays = getMonthDayKeys(monthKey, timeZone).filter((dayKey) => dayKey.slice(0, 7) === monthKey.slice(0, 7));
                        const stats = getMonthStats(monthDays, dayBlocksMap);
                        return {
                          anchorDayKey: monthKey,
                          label: formatWindowLabel(buildWindowSpec('month', `${monthKey}T12:00:00.000Z`, timeZone), timeZone),
                          plannedCount: stats.plannedCount,
                          completedCount: stats.completedCount,
                          completionRate: stats.completionRate
                        };
                      })}
                      summary={(() => {
                        const monthStats = getQuarterMonths(anchorISO, timeZone).map((monthKey) => {
                          const monthDays = getMonthDayKeys(monthKey, timeZone).filter((dayKey) => dayKey.slice(0, 7) === monthKey.slice(0, 7));
                          return getMonthStats(monthDays, dayBlocksMap);
                        });
                        return getQuarterStats(monthStats);
                      })()}
                      onSelectMonth={(monthKey) => {
                        setAnchorDayKey(monthKey);
                        setZionView('month');
                      }}
                    />
                  ) : null}
                  {zionView === 'year' ? (
                    <ZionYearView
                      months={getYearMonths(anchorISO, timeZone).map((monthKey) => {
                        const monthDays = getMonthDayKeys(monthKey, timeZone).filter((dayKey) => dayKey.slice(0, 7) === monthKey.slice(0, 7));
                        const stats = getMonthStats(monthDays, dayBlocksMap);
                        return {
                          anchorDayKey: monthKey,
                          label: formatWindowLabel(buildWindowSpec('month', `${monthKey}T12:00:00.000Z`, timeZone), timeZone),
                          plannedCount: stats.plannedCount,
                          completedCount: stats.completedCount,
                          completionRate: stats.completionRate
                        };
                      })}
                      onSelectMonth={(monthKey) => {
                        setAnchorDayKey(monthKey);
                        setZionView('month');
                      }}
                    />
                  ) : null}
                  {selectedBlockId ? (
                    <BlockDetailsPanel
                      blockId={selectedBlockId}
                      blocks={normalizedBlocks}
                      surface="today"
                      onComplete={handleCompleteBlock}
                      onDelete={handleDeleteBlock}
                      onEdit={handleEditBlock}
                      timeZone={timeZone}
                      readOnly={isCycleReadOnly}
                    />
                  ) : null}
                </div>
              )}

            </div>
          ) : null}

          {view === 'structure' && (
            <StructurePageConsolidated
              onStartNewCycleRequest={() => setCycleTransitionModalOpen(true)}
              onOpenToday={() => {
                setView('today');
                setZionView('day');
              }}
            />
          )}

          {view === 'stability' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted">Probability of Success</p>
                  <p className="text-sm text-muted">
                    Probability estimates goal success by deadline; Stability measures execution integrity to date.
                  </p>
                </div>
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-3xl font-semibold text-jericho-text">
                      {posValue !== null ? `${posValue}%` : posFallbackZero ? '0%' : shouldShowPosDash ? '—' : '—'}
                    </p>
                    <p className="text-xs text-muted">Status: {probabilityStatusLabel}</p>
                    {contractFailureLabel ? (
                      <p className="text-xs text-muted">Contract state: {contractFailureLabel}</p>
                    ) : null}
                    {contractRenegotiationRequired ? (
                      <p className="text-[11px] text-amber-600">Renegotiation required</p>
                    ) : null}
                    {recoveryStateLabel ? (
                      <p className="text-xs text-muted">Recovery: {recoveryStateLabel}</p>
                    ) : null}
                    {recoveryRenegotiationRequired ? (
                      <p className="text-[11px] text-amber-600">Recovery renegotiation required</p>
                    ) : null}
                    {shouldRenderFeasibilityWarning ? (
                      <p className="text-[11px] text-amber-600">FEASIBILITY_MISSING_FOR_PLAN</p>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted">
                    {probabilityExplanation}
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-3 text-xs text-muted">
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Feasibility score</p>
                    <p className="text-sm text-jericho-text">
                      {feasibilityScore !== null ? `${Math.round(feasibilityScore * 100)}%` : '—'}
                    </p>
                  </div>
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Workable days remaining</p>
                    <p className="text-sm text-jericho-text">
                      {Number.isFinite(workableDaysRemaining) ? workableDaysRemaining : '—'}
                    </p>
                  </div>
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Required weekly throughput</p>
                    <p className="text-sm text-jericho-text">
                      {Number.isFinite(requiredPerWeek) ? `${requiredPerWeek} blocks/week` : '—'}
                    </p>
                  </div>
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Actual avg per week</p>
                    <p className="text-sm text-jericho-text">
                      {Number.isFinite(avgPerWeek) ? `${avgPerWeek.toFixed(1)} blocks/week` : '—'}
                    </p>
                  </div>
                </div>
                {shouldRenderWhyChanged ? (
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2 space-y-2 text-xs text-muted">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Why it changed</p>
                    {hasNoPlanReason ? (
                      <p>Generate a plan to see P.O.S.</p>
                    ) : hasThroughputModelMissingReason ? (
                      <p>Throughput model missing; set required work and capacity to compute P.O.S.</p>
                    ) : hasFeasibilityInputMissingReason ? (
                      <p>Feasibility inputs are missing; refresh plan and deadline inputs.</p>
                    ) : hasUnschedulableReason ? (
                      <div className="space-y-1">
                        <p>Unschedulable under current windows.</p>
                        {unschedulableConflicts.length > 0 ? (
                          <p>Conflicts: {unschedulableConflicts.join(', ')}</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {posReasons.slice(0, 3).map((reason, idx) => {
                          const code = String(reason?.code || '');
                          const label = POS_REASON_LABELS[code] || code;
                          const direction = String(reason?.direction || 'NEUTRAL');
                          const evidence = String(reason?.evidence || '').trim();
                          return (
                            <p key={`pos-reason-${idx}-${code}`}>
                              {label} · {direction}
                              {evidence ? ` · ${evidence}` : ''}
                            </p>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
                {contractFailureReasons.length > 0 ? (
                  <div className="text-[11px] text-muted">
                    Contract reasons: {contractFailureReasons.slice(0, 3).join(', ')}
                  </div>
                ) : null}
                {recoveryReasons.length > 0 ? (
                  <div className="text-[11px] text-muted">
                    Recovery reasons: {recoveryReasons.slice(0, 3).join(', ')}
                  </div>
                ) : null}
                {recoveryState ? (
                  <div className="grid md:grid-cols-3 gap-3 text-xs text-muted">
                    <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                      <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Recovery burden</p>
                      <p className="text-sm text-jericho-text">
                        {Number.isFinite(recoveryMetrics.remainingRequiredBurden)
                          ? `${recoveryMetrics.remainingRequiredBurden} blocks`
                          : '—'}
                      </p>
                    </div>
                    <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                      <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Projected slack</p>
                      <p className="text-sm text-jericho-text">
                        {Number.isFinite(recoveryMetrics.projectedSlackAfterRecovery)
                          ? `${recoveryMetrics.projectedSlackAfterRecovery} blocks`
                          : '—'}
                      </p>
                    </div>
                    <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                      <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Required/week after recovery</p>
                      <p className="text-sm text-jericho-text">
                        {Number.isFinite(recoveryMetrics.requiredWeeklyThroughputAfterRecovery)
                          ? `${recoveryMetrics.requiredWeeklyThroughputAfterRecovery} blocks/week`
                          : '—'}
                      </p>
                    </div>
                  </div>
                ) : null}
                {recoveryOptions.length > 0 ? (
                  <div className="space-y-2 text-[11px] text-muted">
                    <p>Recovery options</p>
                    <div className="space-y-1">
                      {recoveryOptions.slice(0, 3).map((option, index) => {
                        const optionType = String(option?.type || '').trim().toUpperCase();
                        const isSupported = optionType === 'EXTEND_DEADLINE' || optionType === 'INCREASE_THROUGHPUT';
                        return (
                          <div key={`recovery-option-${optionType}-${index}`} className="rounded-md border border-line/50 px-2 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>{option?.summary || optionType}</span>
                              <button
                                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                  isSupported
                                    ? 'border-jericho-accent text-jericho-accent hover:bg-jericho-accent/10'
                                    : 'border-line/60 text-muted cursor-not-allowed'
                                }`}
                                disabled={!isSupported || isCycleReadOnly}
                                onClick={() => handleApplyRenegotiationOption(option, index)}
                              >
                                {isSupported ? 'Apply' : 'Unsupported'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {renegotiationFeedback ? (
                  <div className="text-[11px] text-muted">{renegotiationFeedback}</div>
                ) : null}
                {lastRenegotiationApplied?.status === 'APPLIED' ? (
                  <div className="text-[11px] text-muted">
                    Last renegotiation: {lastRenegotiationApplied.optionType} at{' '}
                    {lastRenegotiationApplied.atISO ? new Date(lastRenegotiationApplied.atISO).toLocaleString() : '—'}
                  </div>
                ) : null}
                <div className="text-[11px] text-muted">
                  {probabilityWindowLabel}
                  {cycleEndKey ? ` · Deadline in ${daysToDeadline ?? '—'} days (${cycleEndKey})` : ''}
                </div>
              </div>

              <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted">Stability Score</p>
                    <p className="text-sm text-muted">Integrity and consistency across the active cycle.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-jericho-text">{stabilityScore}</p>
                    <p className="text-xs text-muted">{stabilityBand}</p>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-line/40 overflow-hidden">
                  <div className="h-full bg-jericho-accent" style={{ width: `${stabilityScore}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Low 0–49</span>
                  <span>Moderate 50–79</span>
                  <span>High 80–100</span>
                </div>
                <div className="grid md:grid-cols-2 gap-3 text-xs text-muted">
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Integrity rate</p>
                    <p className="text-sm text-jericho-text">
                      {Math.round(((integrityScoreCycle ?? safeStability.completionRate ?? 0) || 0) * 100)}%
                    </p>
                  </div>
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Mix drift</p>
                    <p className="text-sm text-jericho-text">{Math.round((safeStability.driftScore || 0) * 100)}%</p>
                  </div>
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Consistency</p>
                    <p className="text-sm text-jericho-text">{Math.round((safeStability.streakScore || 0) * 100)}%</p>
                  </div>
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Momentum</p>
                    <p className="text-sm text-jericho-text">{Math.round((safeStability.momentumScore || 0) * 100)}%</p>
                  </div>
                </div>
              </div>

              <DiagnosticsPanel
                drift={Math.round((safeStability.driftScore || 0) * 100)}
                risks={recoveryReasons || []}
                metrics={{
                  completionRate: Math.round((safeStability.completionRate || 0) * 100),
                  streak: Math.round((safeStability.streakScore || 0) * 100),
                  driftIndex: Math.round((safeStability.driftScore || 0) * 100),
                }}
                traceLog={debug?.traceLog || []}
              />

              <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted">1.0 End-to-End Validation</p>
                    <p className="text-sm text-muted">
                      Goal input to Stability trace coverage across all canonical subtype lanes.
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-jericho-text">{stabilityE2E.totalLanes} lanes</p>
                </div>
                <div className="grid md:grid-cols-4 gap-3 text-xs text-muted">
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Pass</p>
                    <p className="text-sm text-jericho-text">{stabilityE2E.passCount}</p>
                  </div>
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Warn</p>
                    <p className="text-sm text-jericho-text">{stabilityE2E.warnCount}</p>
                  </div>
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Fail</p>
                    <p className="text-sm text-jericho-text">{stabilityE2E.failCount}</p>
                  </div>
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Context coverage</p>
                    <p className="text-sm text-jericho-text">
                      {stabilityE2E.contextCoverage.authoredLaneCount}/{stabilityE2E.contextCoverage.canonicalLaneCount}
                    </p>
                  </div>
                </div>
                <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2 text-xs text-muted space-y-1">
                  <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Weakest dimensions</p>
                  <p>
                    Output: {stabilityE2E.weakestDimensions.outputQuality.length} · Action:{' '}
                    {stabilityE2E.weakestDimensions.actionQuality.length} · Schedule:{' '}
                    {stabilityE2E.weakestDimensions.scheduleQuality.length}
                  </p>
                  <p>
                    Correction: {stabilityE2E.weakestDimensions.correctionQuality.length} · Progress:{' '}
                    {stabilityE2E.weakestDimensions.progressTrackingQuality.length}
                  </p>
                </div>
                <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2 text-xs text-muted space-y-1">
                  <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Recovery status</p>
                  <p>
                    No recovery needed: {stabilityRecoverySummary.noRecoveryNeeded} · Drift detected:{' '}
                    {stabilityRecoverySummary.withSignals}
                  </p>
                  <p>Confirmation required: {stabilityRecoverySummary.confirmationRequired}</p>
                </div>
                <details className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2 text-[11px] text-muted">
                  <summary className="cursor-pointer uppercase tracking-[0.12em] text-[10px] text-muted">
                    Lane confirmations (all {stabilityE2E.totalLanes})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {stabilityE2E.laneVerifications.map((lane) => (
                      <div key={lane.laneKey} className="rounded-md border border-line/60 px-2 py-2 space-y-1">
                        <p className="text-jericho-text">
                          {lane.archetype} · {lane.subtype} · {lane.quality.overall.toUpperCase()}
                        </p>
                        <p>
                          Admission: {lane.admission.detectedArchetype} / {lane.admission.detectedSubtype} · confidence {lane.admission.confidence}
                        </p>
                        <p>
                          Context: required asked {lane.context.requiredQuestionsAsked} · answers {lane.context.answersProvided} · defaults {lane.context.defaultsApplied} · confirmation{' '}
                          {lane.context.confirmationRequired ? 'required' : 'not required'}
                        </p>
                        <p>
                          Compile: canonical {lane.compilation.canonicalPathUsed ? 'yes' : 'no'} · outputs {lane.compilation.outputCount} ({lane.compilation.outputTypes.join(', ') || 'none'}) · actions{' '}
                          {lane.compilation.actionCount} · sessions {lane.compilation.estimatedSessionCount} · schedule {lane.compilation.scheduleGenerationStatus}
                        </p>
                        <p>
                          Runtime: fallback {lane.runtimeIntegrity.fallbackUsed ? 'used' : 'none'} · missing fields{' '}
                          {lane.runtimeIntegrity.missingFields.length > 0 ? lane.runtimeIntegrity.missingFields.join(', ') : 'none'} · issues{' '}
                          {lane.runtimeIntegrity.issues.length > 0 ? lane.runtimeIntegrity.issues.join(', ') : 'none'}
                        </p>
                        <p>
                          Recovery: signals {lane.recovery.signalCount} · failure class {lane.recovery.primaryFailureClass || 'NONE'} · confirmation{' '}
                          {lane.recovery.recommendation.confirmationRequired ? 'required' : 'not required'}
                        </p>
                        <p>Recovery adjustment: {lane.recovery.recommendation.proposedAdjustment}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          ) : null}
        </div>

        {pendingPlacement ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-xl border border-line/60 bg-jericho-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-jericho-text">Place suggestion</p>
                <button
                  className="text-xs text-muted hover:text-jericho-accent"
                  onClick={() => setPendingPlacement(null)}
                >
                  Close
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <input
                  className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
                  value={pendingPlacement.title}
                  onChange={(e) => setPendingPlacement((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Title"
                />
                <label className="flex items-center gap-2 text-[11px] text-muted">
                  <input
                    type="checkbox"
                    checked={pendingPlacement.isProgress}
                    onChange={(e) =>
                      setPendingPlacement((prev) => ({
                        ...prev,
                        isProgress: e.target.checked,
                        deliverableId: e.target.checked ? prev.deliverableId : '',
                        criterionId: e.target.checked ? prev.criterionId : ''
                      }))
                    }
                  />
                  Progress block {strictProgressMode ? '(criterion required)' : ''}
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    className="rounded border border-line/60 bg-transparent px-2 py-1"
                    value={pendingPlacement.date}
                    onChange={(e) => setPendingPlacement((prev) => ({ ...prev, date: e.target.value }))}
                  />
                  <input
                    type="time"
                    className="rounded border border-line/60 bg-transparent px-2 py-1"
                    value={pendingPlacement.time}
                    onChange={(e) => setPendingPlacement((prev) => ({ ...prev, time: e.target.value }))}
                  />
                  <input
                    type="number"
                    className="w-20 rounded border border-line/60 bg-transparent px-2 py-1"
                    value={pendingPlacement.durationMinutes}
                    min={1}
                    onChange={(e) => setPendingPlacement((prev) => ({ ...prev, durationMinutes: Math.max(1, Number(e.target.value) || 1) }))}
                  />
                </div>
                {deliverables.length ? (
                  <div className="flex flex-wrap gap-2 items-center text-[11px] text-muted">
                    <label className="flex items-center gap-2">
                      <span>Deliverable</span>
                      <select
                        className="rounded border border-line/60 bg-transparent px-2 py-1"
                        value={pendingPlacement.deliverableId}
                        onChange={(e) =>
                          setPendingPlacement((prev) => ({
                            ...prev,
                            deliverableId: e.target.value,
                            criterionId: ''
                          }))
                        }
                        disabled={!pendingPlacement.isProgress}
                      >
                        <option value="">None</option>
                        {deliverables.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title || d.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2">
                      <span>Criterion</span>
                      <select
                        className="rounded border border-line/60 bg-transparent px-2 py-1"
                        value={pendingPlacement.criterionId}
                        onChange={(e) => setPendingPlacement((prev) => ({ ...prev, criterionId: e.target.value }))}
                        disabled={!pendingPlacement.isProgress || !pendingPlacement.deliverableId}
                      >
                        <option value="">None</option>
                        {(criteriaByDeliverable[pendingPlacement.deliverableId] || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.text || c.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end gap-2 text-xs">
                <button
                  className="rounded-full border border-line/60 px-3 py-1 text-muted hover:text-jericho-accent"
                  onClick={() => setPendingPlacement(null)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/10"
                  onClick={confirmPlacement}
                >
                  Place block
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <CycleTransitionModal
          open={isCycleTransitionModalOpen}
          onArchive={() => {
            actions.startNewCycleWithDecision?.({ mode: 'archive' });
            setCycleTransitionModalOpen(false);
            setView('structure');
            setZionView('day');
          }}
          onDelete={() => {
            actions.startNewCycleWithDecision?.({ mode: 'delete' });
            setCycleTransitionModalOpen(false);
            setView('structure');
            setZionView('day');
          }}
          onCancel={() => setCycleTransitionModalOpen(false)}
        />

        {!REDUCE_UI && assistantVisible ? (
          <div className="border-l border-line/60 pl-4">
            <AssistantPanel
              isOpen={true}
              onClose={() => {
                setAssistantVisible(false);
                onAssistantClose?.();
              }}
              initialPrompt={assistantInitialPrompt}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatDayKeyLabel(dayKey = '') {
  if (!dayKey) return '—';
  const [year, month, day] = dayKey.split('-');
  const monthIndex = Number(month) - 1;
  const dayNum = Number(day);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!Number.isFinite(monthIndex) || !Number.isFinite(dayNum) || !months[monthIndex]) return dayKey;
  return `${months[monthIndex]} ${dayNum}`;
}

function dayKeyDistance(startKey, endKey, timeZone) {
  if (!startKey || !endKey) return null;
  if (endKey < startKey) return 0;
  if (endKey === startKey) return 0;
  let cursor = startKey;
  let count = 0;
  while (cursor !== endKey && count < 4000) {
    cursor = addDays(cursor, 1, timeZone);
    count += 1;
  }
  return cursor === endKey ? count : null;
}

function formatTime(iso = '') {
  if (!iso) return '--:--';
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
