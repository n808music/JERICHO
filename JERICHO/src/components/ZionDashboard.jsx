import React, { useEffect, useMemo, useState } from 'react';
import BlockColumn from './zion/BlockColumn.jsx';
import PlanningPanel from './zion/PlanningPanel.jsx';
import BlockDetailsPanel from './zion/BlockDetailsPanel.jsx';
import Workspace from './zion/Workspace.jsx';
import { PatternLens } from './zion/Workspace.jsx';
import IdentityBar from './zion/IdentityBar.jsx';
import AssistantPanel from './zion/AssistantPanel.jsx';
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
import { projectSuggestionHistory } from '../state/suggestionHistory.js';
import { projectCyclesIndex } from '../state/engine/cycleIndex.ts';
import { DELIVERABLE_DOMAINS, getDeliverablesForCycle, getSuggestionLinkForCycle } from '../state/deliverables.ts';
import { deriveWhatMovedToday } from '../state/whatMovedToday.ts';
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

const DOMAINS = ['Body', 'Resources', 'Creation', 'Focus'];
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
// Dev note: activeDayKey is the only anchor for UI dates; avoid new Date/Date.now for display-critical state.

function useZionState() {
  const {
    vector,
    today,
    currentWeek,
    cycle,
    planDraft,
    planCalibration,
    correctionSignals,
    suggestionEvents,
    suggestedBlocks,
    deliverablesByCycleId,
    goalAdmissionByGoal,
    appTime,
    goalWorkById,
    constraints,
    cyclesById,
    activeCycleId,
    goalExecutionContract,
    probabilityByGoal,
    feasibilityByGoal,
    setActiveCycle,
    deleteCycle,
    startNewCycle,
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
    setCalibrationDays,
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
    applyPlan
  } = useIdentityStore();
  return {
    vector,
    today,
    currentWeek,
    cycle,
    planDraft,
    planCalibration,
    correctionSignals,
    suggestionEvents,
    suggestedBlocks,
    deliverablesByCycleId,
    goalAdmissionByGoal,
    appTime,
    goalWorkById,
    constraints,
    cyclesById,
    activeCycleId,
    goalExecutionContract,
    probabilityByGoal,
    feasibilityByGoal,
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
      setCalibrationDays,
      acceptSuggestedBlock,
      acceptSuggestedBlockWithPlacement,
      rejectSuggestedBlock,
      ignoreSuggestedBlock,
      dismissSuggestedBlock,
      setActiveCycle,
      deleteCycle,
      startNewCycle,
      createDeliverable,
      updateDeliverable,
      deleteDeliverable,
      createCriterion,
      toggleCriterionDone,
      deleteCriterion,
      linkBlockToDeliverable,
      assignSuggestionLink,
      generatePlan,
      applyPlan
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
    vector,
    today,
    currentWeek,
    cycle,
    planDraft,
    planCalibration,
    correctionSignals,
    suggestionEvents,
    suggestedBlocks,
    deliverablesByCycleId,
    goalAdmissionByGoal,
    appTime,
    goalWorkById,
    constraints,
    cyclesById,
    activeCycleId,
    goalExecutionContract,
    probabilityByGoal,
    feasibilityByGoal,
    actions
  } = useZionState();
  const activeCycle = activeCycleId && cyclesById ? cyclesById[activeCycleId] : null;
  const goalId = goalExecutionContract?.goalId || activeCycle?.goalContract?.goalId || null;
  const admissionRecord = goalId ? goalAdmissionByGoal?.[goalId] || activeCycle?.goalAdmission : activeCycle?.goalAdmission;
  const isGoalAdmitted = !admissionRecord || admissionRecord.status === 'ADMITTED';
  const admissionReason = admissionRecord && admissionRecord.status !== 'ADMITTED'
    ? (admissionRecord.reasonCodes || []).join(', ') || admissionRecord.status
    : '';

  function emitAction(name, payload, fn) {
    if (!fn) {
      traceNoop(name, 'handler missing');
      return;
    }
    traceAction(name, payload);
    fn(payload);
  }
  const cycleMode = activeCycle?.status === 'active' ? 'active' : 'review';
  const coldPlanForecast = activeCycle?.coldPlan?.forecastByDayKey || {};
  const dailyProjectionForecast = activeCycle?.coldPlan?.dailyProjection?.forecastByDayKey || {};
  const autoAsanaPlan = activeCycle?.autoAsanaPlan || null;
  const deliverables = useMemo(
    () => getDeliverablesForCycle(deliverablesByCycleId, activeCycleId),
    [deliverablesByCycleId, activeCycleId]
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
  const isReviewMode = cycleMode === 'review';
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
  const DEV_TIME_DEBUG =
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    (localStorage.getItem('JERICHO_TIME_DEBUG') === '1' || localStorage.getItem('JERICHO_TIME_DEBUG') === 'true');
  const [view, setView] = useState(() => {
    if (initialView !== null && initialView !== undefined) return initialView;
    return 'today';
  });
  // If there is no active cycle, route the UI to Structure for goal intake
  useEffect(() => {
    if (!activeCycleId) {
      setView('structure');
    }
  }, [activeCycleId]);
  const [assistantVisible, setAssistantVisible] = useState(assistantOpen);
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
  const normalizedBlocks = useMemo(() => normalizeBlocks(getAllBlocks({ today, currentWeek, cycle })), [today, currentWeek, cycle]);
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
    const blocks = getAllBlocks({ today, currentWeek, cycle });
    const anchor = activeDayKey || today?.date || currentWeek?.weekStart || nowDayKey(timeZone);
    return projectMonthDays({ monthKey: anchor, blocks, includePadding: true });
  }, [today, currentWeek, cycle, activeDayKey, timeZone]);
  const getRouteCountForDay = (dayKey) => coldPlanForecast?.[dayKey]?.totalBlocks || 0;
  const getRouteCountForDays = (dayKeys = []) =>
    (dayKeys || []).reduce((sum, key) => sum + (coldPlanForecast?.[key]?.totalBlocks || 0), 0);
  const getSuggestionDayKey = (s) => {
    if (s?.dayKey) return s.dayKey;
    const iso = s?.startISO || s?.start || '';
    if (iso) return dayKeyFromISO(iso, timeZone);
    return '';
  };
  const suggestedActive = useMemo(
    () => (suggestedBlocks || []).filter((s) => s && s.status === 'suggested'),
    [suggestedBlocks]
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
  const routeSuggestionDays = useMemo(() => {
    const days = [];
    let cursor = activeDayKey;
    for (let i = 0; i < 7; i += 1) {
      if (!cursor) break;
      days.push(cursor);
      cursor = addDays(cursor, 1, timeZone);
    }
    return days;
  }, [activeDayKey, timeZone]);
  const routeSuggestions = useMemo(() => {
    const source = Object.keys(dailyProjectionForecast || {}).length ? dailyProjectionForecast : coldPlanForecast;
    return routeSuggestionDays
      .map((dayKey) => {
        const entry = source?.[dayKey];
        return entry
          ? { dayKey, totalBlocks: entry.totalBlocks || 0, byDeliverable: entry.byDeliverable || {} }
          : { dayKey, totalBlocks: 0, byDeliverable: {} };
      })
      .filter((entry) => entry.totalBlocks > 0);
  }, [routeSuggestionDays, coldPlanForecast, dailyProjectionForecast]);
  const progressStats = useMemo(() => {
    const blocks = selectedDayBlocks || [];
    const progressBlocks = blocks.filter((b) => b?.deliverableId).length;
    const capacityBlocks = blocks.length - progressBlocks;
    return { progressBlocks, capacityBlocks, total: blocks.length };
  }, [selectedDayBlocks]);
  const showCalibration =
    !isReviewMode &&
    planDraft &&
    planDraft.status !== 'calibrated' &&
    ((planCalibration?.confidence || 0) < 0.7 ||
      (planCalibration?.missingInfo || []).includes('daysPerWeek'));
  const [calibrationBanner, setCalibrationBanner] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTypeFilter, setHistoryTypeFilter] = useState([]);
  const [historyDomainFilter, setHistoryDomainFilter] = useState([]);
  const [historyReasonFilter, setHistoryReasonFilter] = useState([]);
  const [highlightSuggestionId, setHighlightSuggestionId] = useState(null);
  const [controlPanelsOpen, setControlPanelsOpen] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState(null);
  const [cycleHistoryOpen, setCycleHistoryOpen] = useState(false);
  const [addBlockError, setAddBlockError] = useState('');
  const [strictProgressMode, setStrictProgressMode] = useState(true);
  const [deliverableDraft, setDeliverableDraft] = useState({
    domain: 'CREATION',
    title: '',
    weight: 1,
    dueDayKey: ''
  });
  const [criterionDrafts, setCriterionDrafts] = useState({});

  const handleCalibrationSelect = (daysPerWeek, uncertain = false) => {
    if (isReviewMode) return;
    actions.setCalibrationDays?.(daysPerWeek, uncertain);
    setCalibrationBanner(`Rebalanced to ${daysPerWeek} days/week`);
    window.setTimeout(() => setCalibrationBanner(''), 2400);
  };
  const isProgressDomain = (domain) =>
    ['CREATION', 'FOCUS', 'RESOURCES'].includes((domain || '').toString().toUpperCase());

  const openPlacement = (suggestion) => {
    if (isReviewMode) return;
    if (!suggestion) return;
    const suggestionDayKey = getSuggestionDayKey(suggestion) || activeDayKey;
    const link = getSuggestionLinkForCycle(deliverablesByCycleId, activeCycleId, suggestion.id);
    setPendingPlacement({
      suggestionId: suggestion.id,
      title: suggestion.title,
      domain: suggestion.domain,
      date: suggestionDayKey,
      time: '09:00',
      durationMinutes: suggestion.durationMinutes || 30,
      deliverableId: link?.deliverableId || suggestion.deliverableId || '',
      criterionId: link?.criterionId || suggestion.criterionId || '',
      isProgress: true
    });
  };

  function addMinutesToISO(iso, minutes) {
    const startMs = Date.parse(iso);
    const duration = Number.isFinite(minutes) ? minutes : 0;
    if (!Number.isFinite(startMs)) return null;
    return new Date(startMs + duration * 60 * 1000).toISOString();
  }

  const confirmPlacement = () => {
    if (isReviewMode) return;
    if (!pendingPlacement?.suggestionId) return;
    if (
      strictProgressMode &&
      pendingPlacement.isProgress &&
      isProgressDomain(pendingPlacement.domain) &&
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
        title: pendingPlacement.title || 'Block',
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
          title: pendingPlacement.title || 'Block',
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

  const signalLabel = (value) => {
    if (value >= 0.6) return 'high';
    if (value >= 0.3) return 'moderate';
    if (value > 0) return 'low';
    return 'none';
  };

  const filteredHistory = useMemo(() => {
    const suggestionsById = new Map((suggestedBlocks || []).map((s) => [s.id, s]));
    return projectSuggestionHistory({
      suggestionEvents,
      suggestionsById,
      nowDayKey: activeDayKey,
      timeZone,
      windowDays: 14,
      filters: {
        types: historyTypeFilter,
        domains: historyDomainFilter,
        reasons: historyReasonFilter
      }
    });
  }, [suggestionEvents, suggestedBlocks, historyTypeFilter, historyDomainFilter, historyReasonFilter, activeDayKey, timeZone]);

  const formatHistoryDate = (dayKey) => {
    return formatDayKeyLabel(dayKey);
  };

  const formatCycleISO = (iso) => {
    if (!iso) return '—';
    const dayKey = dayKeyFromISO(iso, timeZone);
    return dayKey ? formatDayKeyLabel(dayKey) : iso.slice(0, 10);
  };

  const toggleFilterValue = (current, value, setter) => {
    setter(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
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
    if (isReviewMode) return;
    if (
      strictProgressMode &&
      isProgress &&
      isProgressDomain(domain) &&
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
      title: title || 'Block',
      surface: 'today',
      origin: 'manual',
      goalId: linkToGoal === false ? null : goalExecutionContract?.goalId || null,
      linkToGoal,
      deliverableId: isProgress ? (deliverableId || null) : null,
      criterionId: isProgress ? (criterionId || null) : null
    });
    emitAction('today.nav.selectDay', { dayKey: dateKey }, actions.setActiveDayKey);
  };

  const handleEditBlock = (id, patch) => {
    if (isReviewMode) return;
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
    if (isReviewMode) return;
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
    if (isReviewMode) return;
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
  const cycleStartKey = goalExecutionContract?.startDayKey || null;
  const cycleEndKey = goalExecutionContract?.endDayKey || null;
  const daysToDeadline = cycleEndKey ? dayKeyDistance(activeDayKey, cycleEndKey, timeZone) : null;
  const fallbackNowISO = activeDayKey ? `${activeDayKey}T12:00:00.000Z` : '';
  const probabilityWindowSpec = getProbabilityWindowSpec({
    activeContract: goalExecutionContract,
    nowISO: appTime?.nowISO || fallbackNowISO,
    timeZone,
    scoringWindowDays: probability?.scoringSummary?.K
  });
  const probabilityWindowLabel = formatProbabilityWindowLabel(probabilityWindowSpec);
  const safeStability = stabilityView || {};
  const stabilityScoreRaw = Math.min(
    Number.isFinite(safeStability.completionRate) ? safeStability.completionRate : 0,
    Number.isFinite(safeStability.driftScore) ? safeStability.driftScore : 0,
    Number.isFinite(safeStability.streakScore) ? safeStability.streakScore : 0,
    Number.isFinite(safeStability.momentumScore) ? safeStability.momentumScore : 0
  );
  const stabilityScore = Math.max(0, Math.min(100, Math.round(stabilityScoreRaw * 100)));
  const stabilityBand = stabilityScore >= 80 ? 'High' : stabilityScore >= 50 ? 'Moderate' : 'Low';
  const probabilityValue =
    probability && Number.isFinite(probability.value) ? Math.round(probability.value * 100) : null;
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
  const requiredPerWeek = feasibility?.requiredBlocksPerDay ? feasibility.requiredBlocksPerDay * 7 : null;
  const avgPerWeek = probability?.scoringSummary?.mu ? probability.scoringSummary.mu * 7 : null;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.mode = 'zion';
    }
  }, []);

  return (
    <div className="space-y-5 relative bg-white text-jericho-text">
      <IdentityBar
        day={vector?.day || 1}
        direction={vector?.direction || '—'}
        stability={vector?.stability || 'steady'}
        drift={vector?.drift || 'contained'}
        momentum={vector?.momentum || 'active'}
        driftLabel={vector?.driftLabel || vector?.drift}
        driftHint={vector?.driftHint}
        trend={cycle?.map((d) => Math.round((d.completionRate || 0) * 100)) || []}
      />

      <div className={`mt-2 grid gap-8 ${assistantVisible ? 'grid-cols-[minmax(0,1fr)_340px]' : 'grid-cols-1'}`}>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-[0.14em] text-muted">System Loop</span>
              <p className="text-[11px] text-muted mt-1">Identity → Discipline → Project Management → Data Analysis</p>
            </div>
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
              <button
                className="text-xs text-muted hover:text-jericho-accent"
                onClick={() => setAssistantVisible(true)}
              >
                Assistant
              </button>
              {onBackHome ? (
                <button className="text-xs text-muted hover:text-jericho-accent" onClick={onBackHome}>
                  Home
                </button>
              ) : null}
            </div>
          </div>

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
                  <p className="text-[11px] text-muted">
                    Active goal: {goalExecutionContract?.goalText || '—'}
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
                      primaryObjectiveId={primaryObjectiveId}
                      chainTaskId={primaryObjectiveId}
                      onBlockClick={(id) => setSelectedBlockId(id)}
                    />
                    <div className="rounded-md border border-line/60 bg-jericho-surface/90 px-3 py-2 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-jericho-text">Progress discipline</p>
                        <label className="flex items-center gap-2 text-[11px] text-muted">
                          <input
                            type="checkbox"
                            checked={strictProgressMode}
                            onChange={(e) => setStrictProgressMode(e.target.checked)}
                            disabled={isReviewMode}
                          />
                          Strict mode
                        </label>
                      </div>
                      <div className="text-[11px] text-muted">
                        Progress blocks: {progressStats.progressBlocks} · Capacity blocks: {progressStats.capacityBlocks} · Criteria closed: {whatMovedToday.criteriaClosed?.length || 0}
                      </div>
                      {progressStats.capacityBlocks > 0 ? (
                        <div className="text-[11px] text-muted">
                          Unlinked blocks: {progressStats.capacityBlocks} (capacity, not progress)
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-md border border-line/60 bg-jericho-surface/90 px-3 py-2 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-jericho-text">Suggested Path</p>
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/10"
                            onClick={() => emitAction('suggestedPath.generatePlan', { cycleId: activeCycleId }, actions.generatePlan)}
                            disabled={isReviewMode || !isGoalAdmitted}
                          >
                            Generate plan
                          </button>
                          <button
                            className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent disabled:opacity-50"
                            onClick={() => emitAction('suggestedPath.applyPlan', { cycleId: activeCycleId }, actions.applyPlan)}
                            disabled={isReviewMode || !isGoalAdmitted || !autoAsanaPlan?.horizonBlocks?.length}
                          >
                            Apply plan
                          </button>
                        </div>
                      </div>
                      {autoAsanaPlan ? (
                        <div className="text-[11px] text-muted">
                          Horizon: {autoAsanaPlan.horizon?.startDayKey} → {autoAsanaPlan.horizon?.endDayKey} · Blocks: {autoAsanaPlan.horizonBlocks?.length || 0}
                          {autoAsanaPlan.conflicts?.length ? ` · Conflicts: ${autoAsanaPlan.conflicts.length}` : ''}
                        </div>
                      ) : null}
                      {!isGoalAdmitted && admissionReason ? (
                        <div className="text-[11px] text-amber-600">Goal not admitted: {admissionReason}</div>
                      ) : null}
                      {!suggestedActive.length ? (
                        <p className="text-[11px] text-muted">No active suggestions yet.</p>
                      ) : (
                        suggestedActive.slice(0, 6).map((s) => {
                          const dayKey = getSuggestionDayKey(s);
                          const link = getSuggestionLinkForCycle(deliverablesByCycleId, activeCycleId, s.id);
                          const linkedDeliverableId = link?.deliverableId || s.deliverableId || '';
                          const linkedCriterionId = link?.criterionId || s.criterionId || '';
                          return (
                            <div
                              key={s.id}
                              className={`rounded-md border border-line/40 p-2 space-y-1 ${highlightSuggestionId === s.id ? 'border-jericho-accent/70' : ''}`}
                            >
                              <p className="text-jericho-text">
                                {s.title} · {s.domain} · {s.durationMinutes}m
                              </p>
                              <p className="text-[11px] text-muted">
                                {dayKey || '—'} · {formatTime(s.startISO)}–{formatTime(s.endISO)}
                              </p>
                              <p className="text-[11px] text-muted">
                                {linkedDeliverableId
                                  ? `Advances: ${deliverableTitleById.get(linkedDeliverableId) || linkedDeliverableId}${
                                      linkedCriterionId ? ` / ${criterionTextById.get(linkedCriterionId) || linkedCriterionId}` : ''
                                    }`
                                  : 'Unmapped (capacity or undefined)'}
                              </p>
                              {deliverables.length ? (
                                <div className="flex flex-wrap gap-2 text-[11px] text-muted">
                                  <label className="flex items-center gap-2">
                                    <span>Deliverable</span>
                                    <select
                                      className="rounded border border-line/60 bg-transparent px-2 py-1"
                                      value={linkedDeliverableId}
                                      onChange={(e) =>
                                        emitAction('suggestedPath.assignDeliverable', {
                                          cycleId: activeCycleId,
                                          suggestionId: s.id,
                                          deliverableId: e.target.value || null,
                                          criterionId: null
                                        }, actions.assignSuggestionLink)
                                      }
                                      disabled={isReviewMode}
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
                                      value={linkedCriterionId}
                                      onChange={(e) =>
                                        emitAction('suggestedPath.assignCriterion', {
                                          cycleId: activeCycleId,
                                          suggestionId: s.id,
                                          deliverableId: linkedDeliverableId || null,
                                          criterionId: e.target.value || null
                                        }, actions.assignSuggestionLink)
                                      }
                                      disabled={isReviewMode || !linkedDeliverableId}
                                    >
                                      <option value="">None</option>
                                      {(criteriaByDeliverable[linkedDeliverableId] || []).map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.text || c.id}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              ) : null}
                              <div className="flex flex-wrap gap-2 text-[11px]">
                                {strictProgressMode && isProgressDomain(s.domain) && !linkedCriterionId ? (
                                  <span className="text-amber-600">Assign criterion to accept in Strict Mode.</span>
                                ) : null}
                                <button
                                  className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/10"
                                  onClick={() => {
                                    traceAction('suggestedPath.accept', { suggestionId: s.id, cycleId: activeCycleId });
                                    openPlacement(s);
                                  }}
                                  disabled={isReviewMode || (strictProgressMode && isProgressDomain(s.domain) && !linkedCriterionId)}
                                >
                                  Accept
                                </button>
                                <button
                                  className="rounded-full border border-line/60 px-3 py-1 text-muted hover:text-jericho-accent"
                                  onClick={() => emitAction('suggestedPath.ignore', { suggestionId: s.id }, actions.ignoreSuggestedBlock)}
                                  disabled={isReviewMode}
                                >
                                  Ignore
                                </button>
                                <button
                                  className="rounded-full border border-line/60 px-3 py-1 text-muted hover:text-jericho-accent"
                                  onClick={() => emitAction('suggestedPath.dismiss', { suggestionId: s.id }, actions.dismissSuggestedBlock)}
                                  disabled={isReviewMode}
                                >
                                  Dismiss
                                </button>
                                {[
                                  { id: 'TOO_LONG', label: 'Too long' },
                                  { id: 'WRONG_TIME', label: 'Wrong time' },
                                  { id: 'LOW_ENERGY', label: 'Low energy' },
                                  { id: 'NOT_RELEVANT', label: 'Not relevant' },
                                  { id: 'MISSING_PREREQ', label: 'Missing prereq' },
                                  { id: 'OVERCOMMITTED', label: 'Overcommitted' }
                                ].map((reason) => (
                                  <button
                                    key={reason.id}
                                    className="rounded-full border border-line/60 px-3 py-1 text-muted hover:text-jericho-accent"
                                    onClick={() => actions.rejectSuggestedBlock?.(s.id, reason.id)}
                                    disabled={isReviewMode}
                                  >
                                    {reason.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {routeSuggestions.length ? (
                      <div className="rounded-md border border-line/60 bg-jericho-surface/90 px-3 py-2 text-xs space-y-2">
                        <p className="font-medium text-jericho-text">Route suggestions (Cold Plan)</p>
                        <p className="text-[11px] text-muted">Forecast-only. Promote into schedule if useful.</p>
                        {routeSuggestions.map((entry) => (
                          <div key={entry.dayKey} className="rounded-md border border-line/40 p-2 space-y-1">
                            <p className="text-jericho-text">
                              {formatDayKeyLabel(entry.dayKey)} · {entry.totalBlocks} blocks
                            </p>
                            <div className="space-y-1 text-[11px] text-muted">
                              {Object.entries(entry.byDeliverable || {}).map(([deliverableId, count]) => (
                                <div key={deliverableId} className="flex items-center justify-between">
                                  <span>{deliverableTitleById.get(deliverableId) || deliverableId}</span>
                                  <span>{count}</span>
                                </div>
                              ))}
                            </div>
                            <button
                              className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/10"
                              onClick={() =>
                                handleCreateForDate(entry.dayKey, {
                                  time: '09:00',
                                  durationMinutes: 30,
                                  domain: planDraft?.primaryDomain || 'FOCUS',
                                  title: deliverableTitleById.get(Object.keys(entry.byDeliverable || {})[0]) || 'Route block'
                                })
                              }
                              disabled={isReviewMode}
                            >
                              Add block
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
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
                      goalLabel={goalExecutionContract?.goalText || 'goal'}
                      deliverables={deliverables}
                      criteriaByDeliverable={criteriaByDeliverable}
                      whatMovedToday={whatMovedToday}
                      strictMode={strictProgressMode}
                      criterionLabelById={Object.fromEntries(criterionTextById)}
                      readOnly={isReviewMode}
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
                          routeCount: getRouteCountForDay(dayKey),
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
                        const titles = (stats.blocks || []).slice(0, 2).map((b) => b.label || `${b.practice || b.domain} block`);
                        return {
                          date: dayKey,
                          dayNumber: Number(dayKey.slice(8, 10)),
                          inMonth: dayKey.slice(0, 7) === windowSpec.startDayKey.slice(0, 7),
                          plannedCount: stats.plannedCount,
                          completedCount: stats.completedCount,
                          completionRate: stats.completionRate,
                          routeCount: getRouteCountForDay(dayKey),
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
                        const routeTotal = getRouteCountForDays(monthDays);
                        return {
                          anchorDayKey: monthKey,
                          label: formatWindowLabel(buildWindowSpec('month', `${monthKey}T12:00:00.000Z`, timeZone), timeZone),
                          plannedCount: stats.plannedCount,
                          completedCount: stats.completedCount,
                          completionRate: stats.completionRate,
                          routeTotal
                        };
                      })}
                      summary={(() => {
                        const monthStats = getQuarterMonths(anchorISO, timeZone).map((monthKey) => {
                          const monthDays = getMonthDayKeys(monthKey, timeZone).filter((dayKey) => dayKey.slice(0, 7) === monthKey.slice(0, 7));
                          return getMonthStats(monthDays, dayBlocksMap);
                        });
                        const routeTotal = getQuarterMonths(anchorISO, timeZone).reduce((sum, monthKey) => {
                          const monthDays = getMonthDayKeys(monthKey, timeZone).filter((dayKey) => dayKey.slice(0, 7) === monthKey.slice(0, 7));
                          return sum + getRouteCountForDays(monthDays);
                        }, 0);
                        return { ...getQuarterStats(monthStats), routeTotal };
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
                        const routeTotal = getRouteCountForDays(monthDays);
                        return {
                          anchorDayKey: monthKey,
                          label: formatWindowLabel(buildWindowSpec('month', `${monthKey}T12:00:00.000Z`, timeZone), timeZone),
                          plannedCount: stats.plannedCount,
                          completedCount: stats.completedCount,
                          completionRate: stats.completionRate,
                          routeTotal
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
                      readOnly={isReviewMode}
                    />
                  ) : null}
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.14em] text-muted">Control panels</p>
                <button
                  className="text-[11px] text-muted hover:text-jericho-accent"
                  onClick={() => setControlPanelsOpen((prev) => !prev)}
                >
                  {controlPanelsOpen ? 'Hide' : 'Show'}
                </button>
              </div>
              {controlPanelsOpen ? (
                <div className="space-y-3">
                  {isReviewMode ? (
                    <div className="rounded-md border border-line/60 bg-jericho-surface/90 px-3 py-2 text-xs text-muted">
                      Review mode: calibration and corrections are read-only for ended cycles.
                    </div>
                  ) : null}
                  {showCalibration ? (
                    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-jericho-text">Calibrate capacity</p>
                        <p className="text-xs text-muted">
                          How many days per week can you realistically execute blocks for this goal?
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[3, 4, 5, 6, 7].map((days) => (
                          <button
                            key={days}
                            className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent hover:border-jericho-accent/60"
                            onClick={() => handleCalibrationSelect(days)}
                          >
                            {days} days
                          </button>
                        ))}
                        <button
                          className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent hover:border-jericho-accent/60"
                          onClick={() => handleCalibrationSelect(4, true)}
                        >
                          Not sure
                        </button>
                      </div>
                      {calibrationBanner ? (
                        <div className="text-[11px] text-emerald-600">{calibrationBanner}</div>
                      ) : null}
                    </div>
                  ) : null}

                  {correctionSignals ? (
                    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-2">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted">Correction signals (14d)</p>
                      {correctionSignals.totalRejections > 0 ? (
                        <>
                          <p className="text-xs text-muted">
                            Capacity pressure: {signalLabel(correctionSignals.signals.capacityPressure)} (
                            OVERCOMMITTED {correctionSignals.byReason.OVERCOMMITTED}/{correctionSignals.totalRejections})
                          </p>
                          <p className="text-xs text-muted">
                            Duration mismatch: {signalLabel(correctionSignals.signals.durationMismatch)} (
                            TOO_LONG {correctionSignals.byReason.TOO_LONG}/{correctionSignals.totalRejections})
                          </p>
                          <p className="text-xs text-muted">
                            Timing mismatch: {signalLabel(correctionSignals.signals.timingMismatch)} (
                            WRONG_TIME {correctionSignals.byReason.WRONG_TIME}/{correctionSignals.totalRejections})
                          </p>
                          <p className="text-xs text-muted">
                            Energy mismatch: {signalLabel(correctionSignals.signals.energyMismatch)} (
                            LOW_ENERGY {correctionSignals.byReason.LOW_ENERGY}/{correctionSignals.totalRejections})
                          </p>
                          <p className="text-xs text-muted">
                            Relevance mismatch: {signalLabel(correctionSignals.signals.relevanceMismatch)} (
                            NOT_RELEVANT {correctionSignals.byReason.NOT_RELEVANT}/{correctionSignals.totalRejections})
                          </p>
                          <p className="text-xs text-muted">
                            Prereq debt: {signalLabel(correctionSignals.signals.prereqDebt)} (
                            MISSING_PREREQ {correctionSignals.byReason.MISSING_PREREQ}/{correctionSignals.totalRejections})
                          </p>
                          {correctionSignals.signals.capacityPressure >= 0.6 ? (
                            <p className="text-[11px] text-muted">
                              Recommend: lower days/week or blocks/week target.
                            </p>
                          ) : correctionSignals.signals.durationMismatch >= 0.6 ? (
                            <p className="text-[11px] text-muted">
                              Recommend: shorten template durations.
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-xs text-muted">No rejection signals yet.</p>
                      )}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted">Suggestion history (14d)</p>
                      <button
                        className="text-[11px] text-muted hover:text-jericho-accent"
                        onClick={() => setHistoryOpen((prev) => !prev)}
                      >
                        {historyOpen ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {historyOpen ? (
                      <>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                          {['CREATED', 'ACCEPTED', 'REJECTED', 'IGNORED', 'DISMISSED'].map((type) => (
                            <button
                              key={type}
                              className={`rounded-full border px-3 py-1 ${
                                historyTypeFilter.includes(type)
                                  ? 'border-jericho-accent text-jericho-accent'
                                  : 'border-line/60 text-muted'
                              }`}
                              onClick={() => toggleFilterValue(historyTypeFilter, type, setHistoryTypeFilter)}
                            >
                              {type.toLowerCase()}
                            </button>
                          ))}
                          {DOMAINS.map((domain) => (
                            <button
                              key={domain}
                              className={`rounded-full border px-3 py-1 ${
                                historyDomainFilter.includes(domain)
                                  ? 'border-jericho-accent text-jericho-accent'
                                  : 'border-line/60 text-muted'
                              }`}
                              onClick={() => toggleFilterValue(historyDomainFilter, domain, setHistoryDomainFilter)}
                            >
                              {domain}
                            </button>
                          ))}
                          {['TOO_LONG', 'WRONG_TIME', 'LOW_ENERGY', 'NOT_RELEVANT', 'MISSING_PREREQ', 'OVERCOMMITTED'].map((reason) => (
                            <button
                              key={reason}
                              className={`rounded-full border px-3 py-1 ${
                                historyReasonFilter.includes(reason)
                                  ? 'border-jericho-accent text-jericho-accent'
                                  : 'border-line/60 text-muted'
                              }`}
                              onClick={() => toggleFilterValue(historyReasonFilter, reason, setHistoryReasonFilter)}
                            >
                              {reason.replace('_', ' ').toLowerCase()}
                            </button>
                          ))}
                          {historyTypeFilter.length || historyDomainFilter.length || historyReasonFilter.length ? (
                            <button
                              className="rounded-full border border-line/60 px-3 py-1 text-muted hover:text-jericho-accent"
                              onClick={() => {
                                setHistoryTypeFilter([]);
                                setHistoryDomainFilter([]);
                                setHistoryReasonFilter([]);
                              }}
                            >
                              Clear filters
                            </button>
                          ) : null}
                        </div>
                        <div className="space-y-2 text-xs">
                          {filteredHistory.length ? (
                            filteredHistory.map((item) => (
                              <button
                                key={item.id}
                                className="w-full text-left rounded-md border border-line/40 px-3 py-2 hover:border-jericho-accent/60"
                                onClick={() => {
                                  if (item.archived || !item.suggestionId) return;
                                  setHighlightSuggestionId(item.suggestionId);
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span>
                                    {formatHistoryDate(item.dayKey)} — {item.type.toLowerCase()}
                                    {item.reason ? ` (${item.reason})` : ''} — {item.title || item.suggestionId || 'Suggestion'}
                                    {item.domain ? ` — ${item.domain}` : ''}
                                  </span>
                                  {item.archived ? <span className="text-[11px] text-muted">archived</span> : null}
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="text-xs text-muted">No history in this window.</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted">Hidden.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {view === 'structure' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted">Active cycle</p>
                    <p className="text-sm text-jericho-text">
                      {activeCycle?.definiteGoal?.outcome || '—'}
                    </p>
                    <p className="text-[11px] text-muted">
                      Start {activeCycle?.startedAtDayKey || '—'} · Deadline {activeCycle?.definiteGoal?.deadlineDayKey || '—'} · {cycleMode}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
                      onClick={() =>
                        emitAction(
                          'cycle.new',
                          {
                            goalText: goalExecutionContract?.goalText || activeCycle?.definiteGoal?.outcome || 'New goal',
                            deadlineDayKey: goalExecutionContract?.endDayKey || activeCycle?.definiteGoal?.deadlineDayKey
                          },
                          actions.startNewCycle
                        )
                      }
                    >
                      New Cycle
                    </button>
                    <button
                      className="rounded-full border border-amber-600 px-3 py-1 text-xs text-amber-600 hover:bg-amber-600/10"
                      onClick={() => {
                        if (!activeCycleId) return;
                        if (!window.confirm('Archive the active cycle and move it to review mode?')) return;
                        emitAction('cycle.archive', { cycleId: activeCycleId }, actions.endCycle);
                      }}
                      disabled={!activeCycleId}
                    >
                      Archive Cycle
                    </button>
                    <button
                      className="rounded-full border border-red-600 px-3 py-1 text-xs text-red-600 hover:bg-red-600/10"
                      onClick={() => {
                        if (!activeCycleId) return;
                        if (!window.confirm('Delete the active cycle and clear the calendar? This cannot be undone.')) return;
                        emitAction('cycle.delete', { cycleId: activeCycleId }, actions.deleteCycle);
                      }}
                      disabled={!activeCycleId}
                    >
                      Delete Cycle
                    </button>
                    <button
                      className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
                      onClick={() => setCycleHistoryOpen((prev) => !prev)}
                    >
                      {cycleHistoryOpen ? 'Hide history' : 'Cycle history'}
                    </button>
                  </div>
                </div>
                {cycleHistoryOpen ? (
                  <div className="space-y-2 text-xs">
                    {cyclesIndex.length ? (
                      cyclesIndex.map((entry) => (
                        <div key={entry.cycleId} className="rounded-md border border-line/60 px-3 py-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-jericho-text font-semibold">{entry.goalTitle}</p>
                              <p className="text-[11px] text-muted">
                                {formatCycleISO(entry.startISO)} → {entry.endISO ? formatCycleISO(entry.endISO) : '—'} · Deadline {entry.deadlineISO ? formatCycleISO(entry.deadlineISO) : '—'}
                              </p>
                            </div>
                            <span className="rounded-full border border-line/60 px-2 py-0.5 text-[10px] text-muted">{entry.state}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {entry.state === 'Active' ? (
                              <button className="rounded-full border border-line/60 px-3 py-1 text-[11px] text-muted" disabled>
                                Active
                              </button>
                            ) : (
                              <>
                                <button
                                  className="rounded-full border border-line/60 px-3 py-1 text-[11px] text-muted hover:text-jericho-accent"
                                  onClick={() => emitAction('cycle.switch', { cycleId: entry.cycleId }, actions.setActiveCycle)}
                                  disabled={entry.state === 'Deleted'}
                                >
                                  Switch
                                </button>
                                <button
                                  className="rounded-full border border-line/60 px-3 py-1 text-[11px] text-muted hover:text-jericho-accent"
                                  onClick={() => emitAction('cycle.switch', { cycleId: entry.cycleId }, actions.setActiveCycle)}
                                  disabled={entry.state === 'Deleted'}
                                >
                                  Review
                                </button>
                              </>
                            )}
                              <button
                                className="rounded-full border border-line/60 px-3 py-1 text-[11px] text-muted hover:text-jericho-accent"
                                onClick={() => emitAction('cycle.delete', { cycleId: entry.cycleId }, actions.deleteCycle)}
                                disabled={entry.state !== 'Ended'}
                              >
                                Delete
                              </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-muted">No cycles yet.</p>
                    )}
                  </div>
                ) : null}
              </div>
              {isReviewMode ? (
                <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted">Cycle summary</p>
                  <p className="text-[11px] text-muted">Read-only summary for the selected cycle.</p>
                  {cyclesIndex.find((c) => c.cycleId === activeCycleId) ? (
                    (() => {
                      const summary = cyclesIndex.find((c) => c.cycleId === activeCycleId);
                      const completionRate = summary?.summaryStats?.completionRate || 0;
                      const probabilityPct = Number.isFinite(summary?.summaryStats?.probabilityAtEnd)
                        ? Math.round((summary.summaryStats.probabilityAtEnd || 0) * 100)
                        : null;
                      return (
                        <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted">
                          <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                            <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Completion count</p>
                            <p className="text-sm text-jericho-text">{summary?.summaryStats?.completionCount ?? 0}</p>
                          </div>
                          <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                            <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Completion rate</p>
                            <p className="text-sm text-jericho-text">{Math.round(completionRate * 100)}%</p>
                          </div>
                          <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                            <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Probability at end</p>
                            <p className="text-sm text-jericho-text">{probabilityPct !== null ? `${probabilityPct}%` : '—'}</p>
                          </div>
                          <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                            <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Feasibility at end</p>
                            <p className="text-sm text-jericho-text">{summary?.summaryStats?.feasibilityAtEnd || '—'}</p>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <p className="text-xs text-muted">No summary available.</p>
                  )}
                </div>
              ) : null}
              <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted">Deliverables (Active Cycle)</p>
                    <p className="text-[11px] text-muted">Define outcomes and closure criteria.</p>
                  </div>
                  <button
                    className="rounded-full border border-jericho-accent px-3 py-1 text-xs text-jericho-accent hover:bg-jericho-accent/10"
                    onClick={() => {
                      if (isReviewMode) return;
                      if (!deliverableDraft.title.trim()) return;
                      emitAction('deliverables.create', {
                        cycleId: activeCycleId,
                        domain: deliverableDraft.domain,
                        title: deliverableDraft.title.trim(),
                        weight: Number(deliverableDraft.weight) || 1,
                        dueDayKey: deliverableDraft.dueDayKey || null
                      }, actions.createDeliverable);
                      setDeliverableDraft({ domain: deliverableDraft.domain, title: '', weight: 1, dueDayKey: '' });
                    }}
                    disabled={isReviewMode}
                  >
                    Add deliverable
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 items-center text-xs">
                  <select
                    className="rounded border border-line/60 bg-transparent px-2 py-1"
                    value={deliverableDraft.domain}
                    onChange={(e) => setDeliverableDraft((prev) => ({ ...prev, domain: e.target.value }))}
                    disabled={isReviewMode}
                  >
                    {DELIVERABLE_DOMAINS.map((d) => (
                      <option key={d} value={d}>
                        {d.charAt(0) + d.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <input
                    className="flex-1 min-w-[160px] rounded border border-line/60 bg-transparent px-2 py-1"
                    value={deliverableDraft.title}
                    onChange={(e) => setDeliverableDraft((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Deliverable title"
                    disabled={isReviewMode}
                  />
                  <input
                    type="number"
                    className="w-20 rounded border border-line/60 bg-transparent px-2 py-1"
                    value={deliverableDraft.weight}
                    min={1}
                    onChange={(e) => setDeliverableDraft((prev) => ({ ...prev, weight: Number(e.target.value) || 1 }))}
                    disabled={isReviewMode}
                  />
                  <input
                    type="date"
                    className="rounded border border-line/60 bg-transparent px-2 py-1"
                    value={deliverableDraft.dueDayKey}
                    onChange={(e) => setDeliverableDraft((prev) => ({ ...prev, dueDayKey: e.target.value }))}
                    disabled={isReviewMode}
                  />
                </div>
                <div className="space-y-3">
                  {deliverables.length ? (
                    deliverables.map((d) => {
                      const criteria = d.criteria || [];
                      const doneCount = criteria.filter((c) => c.isDone).length;
                      return (
                        <div key={d.id} className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <input
                              className="flex-1 min-w-[180px] rounded border border-line/60 bg-transparent px-2 py-1"
                              value={d.title}
                              onChange={(e) =>
                                emitAction('deliverables.update', {
                                  cycleId: activeCycleId,
                                  deliverableId: d.id,
                                  patch: { title: e.target.value }
                                }, actions.updateDeliverable)
                              }
                              disabled={isReviewMode}
                            />
                            <select
                              className="rounded border border-line/60 bg-transparent px-2 py-1"
                              value={d.domain}
                              onChange={(e) =>
                                emitAction('deliverables.update', {
                                  cycleId: activeCycleId,
                                  deliverableId: d.id,
                                  patch: { domain: e.target.value }
                                }, actions.updateDeliverable)
                              }
                              disabled={isReviewMode}
                            >
                              {DELIVERABLE_DOMAINS.map((domain) => (
                                <option key={domain} value={domain}>
                                  {domain.charAt(0) + domain.slice(1).toLowerCase()}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              className="w-20 rounded border border-line/60 bg-transparent px-2 py-1"
                              value={d.weight}
                              min={1}
                              onChange={(e) =>
                                emitAction('deliverables.update', {
                                  cycleId: activeCycleId,
                                  deliverableId: d.id,
                                  patch: { weight: Number(e.target.value) || 1 }
                                }, actions.updateDeliverable)
                              }
                              disabled={isReviewMode}
                            />
                            <input
                              type="date"
                              className="rounded border border-line/60 bg-transparent px-2 py-1"
                              value={d.dueDayKey || ''}
                              onChange={(e) =>
                                emitAction('deliverables.update', {
                                  cycleId: activeCycleId,
                                  deliverableId: d.id,
                                  patch: { dueDayKey: e.target.value || null }
                                }, actions.updateDeliverable)
                              }
                              disabled={isReviewMode}
                            />
                            <button
                              className="rounded-full border border-line/60 px-3 py-1 text-[11px] text-muted hover:text-jericho-accent"
                              onClick={() =>
                                emitAction('deliverables.delete', {
                                  cycleId: activeCycleId,
                                  deliverableId: d.id
                                }, actions.deleteDeliverable)
                              }
                              disabled={isReviewMode}
                            >
                              Delete
                            </button>
                          </div>
                          <p className="text-[11px] text-muted">Criteria: {doneCount}/{criteria.length}</p>
                          <div className="space-y-1">
                            {criteria.map((c) => (
                              <div key={c.id} className="flex items-center gap-2 text-[11px] text-muted">
                                <input
                                  type="checkbox"
                                  checked={c.isDone}
                                  onChange={(e) =>
                                    emitAction('deliverables.toggleCriterion', {
                                      cycleId: activeCycleId,
                                      deliverableId: d.id,
                                      criterionId: c.id,
                                      isDone: e.target.checked
                                    }, actions.toggleCriterionDone)
                                  }
                                  disabled={isReviewMode}
                                />
                                <span className={c.isDone ? 'line-through text-muted' : ''}>{c.text}</span>
                                <button
                                  className="ml-auto text-[11px] text-muted hover:text-jericho-accent"
                                  onClick={() =>
                                    emitAction('deliverables.deleteCriterion', {
                                      cycleId: activeCycleId,
                                      deliverableId: d.id,
                                      criterionId: c.id
                                    }, actions.deleteCriterion)
                                  }
                                  disabled={isReviewMode}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            {!criteria.length ? <p className="text-[11px] text-muted">No criteria yet.</p> : null}
                          </div>
                          <div className="flex flex-wrap gap-2 items-center text-[11px]">
                            <input
                              className="flex-1 min-w-[200px] rounded border border-line/60 bg-transparent px-2 py-1"
                              value={criterionDrafts[d.id] || ''}
                              onChange={(e) =>
                                setCriterionDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))
                              }
                              placeholder="Add criterion"
                              disabled={isReviewMode}
                            />
                            <button
                              className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/10"
                              onClick={() => {
                                const text = (criterionDrafts[d.id] || '').trim();
                                if (!text) return;
                                emitAction('deliverables.createCriterion', {
                                  cycleId: activeCycleId,
                                  deliverableId: d.id,
                                  text
                                }, actions.createCriterion);
                                setCriterionDrafts((prev) => ({ ...prev, [d.id]: '' }));
                              }}
                              disabled={isReviewMode}
                            >
                              Add criterion
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[11px] text-muted">No deliverables defined yet.</p>
                  )}
                </div>
              </div>
              <Workspace modules={['Definite Goal']} />
            </div>
          ) : null}

          {view === 'stability' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted">Pattern</p>
                  <p className="text-sm text-muted">Read-only diagnostics derived from completion history.</p>
                </div>
                <PatternLens activeCycle={activeCycle} cycleDays={cycle} today={today} />
              </div>

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
                      {probabilityValue !== null ? `${probabilityValue}%` : '—'}
                    </p>
                    <p className="text-xs text-muted">Status: {probabilityStatusLabel}</p>
                  </div>
                  <div className="text-xs text-muted">
                    {probabilityExplanation}
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-3 text-xs text-muted">
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Workable days remaining</p>
                    <p className="text-sm text-jericho-text">
                      {Number.isFinite(feasibility?.workableDaysRemaining) ? feasibility.workableDaysRemaining : '—'}
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
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Completion rate</p>
                    <p className="text-sm text-jericho-text">{Math.round((safeStability.completionRate || 0) * 100)}%</p>
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
                  <select
                    className="rounded border border-line/60 bg-transparent px-2 py-1"
                    value={pendingPlacement.domain}
                    onChange={(e) => setPendingPlacement((prev) => ({ ...prev, domain: e.target.value }))}
                  >
                    {DOMAIN_ENUM.map((d) => (
                      <option key={d} value={d}>
                        {d.charAt(0) + d.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
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

        {assistantVisible ? (
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
