import { addDays, dayKeyFromISO } from './time/time.ts';
import {
  getContractStartDayKey,
  filterSuggestionsByStartDayKey,
  normalizeSuggestionDayKey,
} from './suggestionFilters.js';
import { compileStrategicPlan_OUTPUT, scheduleStrategicPlanToDraftBlocks } from './strategicPlan.ts';
import { computePlanningActions, computeReadyActions } from '../domain/actions/actionSelectors.ts';
import { materializeBlocksFromEvents } from './engine/todayAuthority.ts';
import {
  DEFAULT_BOUNDARY_MODE,
  DRAFT_WINDOW_DAYS,
  FULL_PLAN_PLACE_BLOCKED,
  MAX_BLOCKS_PER_DAY,
  SPINE_FALLBACK_DAYS,
  SPINE_HARD_CAP_DAYS,
  SPINE_SCHEDULE_MODE,
} from './plannerConfig.ts';
import { getSpineBoundary } from './spineBoundary.ts';
import { computePrescriptions } from '../domain/prescriptions.ts';
import { scoreSchedule } from '../planner/scoring/scoreSchedule.ts';
import { optimizeSchedule } from '../planner/optimize/optimizeSchedule.ts';

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

const formatMinutes = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const minutesFromISO = (iso) => {
  const at = Date.parse(iso || '');
  if (!Number.isFinite(at)) return null;
  const date = new Date(at);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
};

const normalizeDraftTimes = (items = [], defaults = {}) => {
  const baseStartMinutes = 9 * 60;
  const gapMinutes = Number(defaults.routeMinutes) || 30;
  const byDay = new Map();
  const passthrough = [];

  (items || []).forEach((item) => {
    if (!item?.dayKey) {
      passthrough.push(item);
      return;
    }
    if (!byDay.has(item.dayKey)) byDay.set(item.dayKey, []);
    byDay.get(item.dayKey).push(item);
  });

  const normalized = [];
  byDay.forEach((dayItems, dayKey) => {
    const startSet = new Set(dayItems.map((item) => item.startISO).filter(Boolean));
    const needsNormalize = startSet.size !== dayItems.length;
    if (!needsNormalize) {
      normalized.push(...dayItems);
      return;
    }
    const ordered = [...dayItems].sort((a, b) => {
      if (a.startISO !== b.startISO) return (a.startISO || '').localeCompare(b.startISO || '');
      return (a.title || '').localeCompare(b.title || '');
    });
    let cursor = baseStartMinutes;
    ordered.forEach((item) => {
      const minutes = Number(item.minutes) || gapMinutes;
      const timeStr = formatMinutes(cursor);
      normalized.push({ ...item, startISO: ensureISO(dayKey, timeStr) });
      cursor += Math.max(gapMinutes, minutes);
    });
  });

  return sortDraftItems([...normalized, ...passthrough]);
};

const AUTOMATION_SOURCES = new Set(['coldPlan', 'suggestedPath', 'forecast', 'strategicPlan', 'next_move_action']);

export function isAutomationScheduleItem(item) {
  if (!item) return false;
  if (item.requiresActionContext) return true;
  const source = (item.source || '').toString();
  return AUTOMATION_SOURCES.has(source);
}

function compareActions(a, b) {
  if ((a?.topoIndex || 0) !== (b?.topoIndex || 0)) return (a?.topoIndex || 0) - (b?.topoIndex || 0);
  if ((a?.priority || 0) !== (b?.priority || 0)) return (a?.priority || 0) - (b?.priority || 0);
  return `${a?.id || ''}`.localeCompare(`${b?.id || ''}`);
}

function normalizeCategoryKey(value) {
  const normalized = (value || '').toString().trim();
  return normalized ? normalized.toUpperCase() : 'UNKNOWN';
}

function compareMilestoneWindow(lhs = null, rhs = null) {
  const leftEnd = lhs?.windowEndDayKey || '9999-12-31';
  const rightEnd = rhs?.windowEndDayKey || '9999-12-31';
  if (leftEnd !== rightEnd) return leftEnd.localeCompare(rightEnd);
  const leftStart = lhs?.windowStartDayKey || '9999-12-31';
  const rightStart = rhs?.windowStartDayKey || '9999-12-31';
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
  return `${lhs?.id || ''}`.localeCompare(`${rhs?.id || ''}`);
}

function collectMilestonesForPlanning(cycle = null, contract = null, state = null) {
  const fromCycle = Array.isArray(cycle?.goalContract?.milestones) ? cycle.goalContract.milestones : [];
  if (fromCycle.length) return fromCycle;
  const fromContract = Array.isArray(contract?.milestones) ? contract.milestones : [];
  if (fromContract.length) return fromContract;
  const fromState = Array.isArray(state?.goalExecutionContract?.milestones)
    ? state.goalExecutionContract.milestones
    : [];
  return fromState;
}

export function computeActionCriticalDepthMap(actions = []) {
  const byId = new Map((actions || []).map((action) => [action?.id, action]));
  const childrenById = new Map();
  (actions || []).forEach((action) => {
    const deps = Array.isArray(action?.deps) ? action.deps : [];
    deps.forEach((depId) => {
      if (!childrenById.has(depId)) childrenById.set(depId, []);
      childrenById.get(depId).push(action?.id);
    });
  });

  const memo = new Map();
  const visiting = new Set();
  const depthFor = (actionId) => {
    if (!actionId || !byId.has(actionId)) return 0;
    if (memo.has(actionId)) return memo.get(actionId) || 0;
    if (visiting.has(actionId)) return 0;
    visiting.add(actionId);
    const children = childrenById.get(actionId) || [];
    const childDepth = children.length ? Math.max(...children.map((childId) => depthFor(childId))) : 0;
    visiting.delete(actionId);
    const depth = 1 + childDepth;
    memo.set(actionId, depth);
    return depth;
  };

  (actions || []).forEach((action) => depthFor(action?.id));
  return memo;
}

export function buildMilestonePriorityContext(milestones = [], actions = [], slotDurationMin = 30) {
  const orderedMilestones = [...(milestones || [])]
    .filter((milestone) => milestone?.windowStartDayKey && milestone?.windowEndDayKey)
    .sort(compareMilestoneWindow);
  const actionById = new Map((actions || []).map((action) => [action?.id, action]));
  const actionPriority = new Map();
  const milestonePrioritySummary = [];

  orderedMilestones.forEach((milestone, index) => {
    const checkpointActionIds = Array.isArray(milestone?.checkpointActionIds) ? milestone.checkpointActionIds : [];
    const milestoneActionIds = Array.isArray(milestone?.actionIds) ? milestone.actionIds : [];
    const allActionIds = Array.from(new Set([...checkpointActionIds, ...milestoneActionIds]));
    const demandSlots = allActionIds.reduce((sum, actionId) => {
      const action = actionById.get(actionId);
      if (!action) return sum;
      const estimateMin = resolveActionEstimateMin(action, slotDurationMin);
      return sum + Math.max(1, Math.ceil(estimateMin / Math.max(1, slotDurationMin)));
    }, 0);

    milestonePrioritySummary.push({
      milestoneId: milestone?.id || `milestone:${index + 1}`,
      demandSlots,
      windowStart: milestone.windowStartDayKey,
      windowEnd: milestone.windowEndDayKey,
    });

    allActionIds.forEach((actionId) => {
      const next = {
        milestoneRank: index,
        isCheckpointAction: checkpointActionIds.includes(actionId),
        hasMilestoneBinding: true,
        milestoneId: milestone?.id || `milestone:${index + 1}`,
        windowStartDayKey: milestone.windowStartDayKey,
        windowEndDayKey: milestone.windowEndDayKey,
      };
      const current = actionPriority.get(actionId);
      if (!current) {
        actionPriority.set(actionId, next);
        return;
      }
      if (next.milestoneRank < current.milestoneRank) {
        actionPriority.set(actionId, next);
        return;
      }
      if (next.milestoneRank === current.milestoneRank && next.isCheckpointAction && !current.isCheckpointAction) {
        actionPriority.set(actionId, next);
      }
    });
  });

  return {
    hasMilestones: orderedMilestones.length > 0,
    actionPriority,
    milestonePrioritySummary,
  };
}

function computeMilestoneCriticalContext(milestones = [], actions = []) {
  const orderedMilestones = [...(milestones || [])]
    .filter((milestone) => milestone?.windowStartDayKey && milestone?.windowEndDayKey)
    .sort(compareMilestoneWindow);
  const actionById = new Map((actions || []).map((action) => [action?.id, action]));
  const criticalByActionId = new Map();

  const markCritical = (actionId, milestone) => {
    if (!actionId || !milestone) return;
    const next = {
      isMilestoneCritical: true,
      milestoneId: milestone?.id || null,
      windowStartDayKey: milestone?.windowStartDayKey || null,
      windowEndDayKey: milestone?.windowEndDayKey || null,
    };
    const current = criticalByActionId.get(actionId);
    if (!current) {
      criticalByActionId.set(actionId, next);
      return;
    }
    if (compareMilestoneWindow(next, current) < 0) {
      criticalByActionId.set(actionId, next);
    }
  };

  const collectDeps = (actionId, visited = new Set()) => {
    if (!actionId || visited.has(actionId)) return visited;
    visited.add(actionId);
    const action = actionById.get(actionId);
    const deps = Array.isArray(action?.deps) ? action.deps : [];
    deps.forEach((depId) => collectDeps(depId, visited));
    return visited;
  };

  orderedMilestones.forEach((milestone) => {
    const actionIds = Array.isArray(milestone?.actionIds) ? milestone.actionIds : [];
    const checkpointActionIds = Array.isArray(milestone?.checkpointActionIds) ? milestone.checkpointActionIds : [];
    const depCritical = new Set();
    actionIds.forEach((actionId) => collectDeps(actionId, depCritical));
    const criticalActionIds = Array.from(new Set([...actionIds, ...checkpointActionIds, ...depCritical]));
    criticalActionIds.forEach((actionId) => markCritical(actionId, milestone));
  });

  return {
    criticalByActionId,
  };
}

export function compareActionsStrategic(a, b, context = {}) {
  const actionPriority = context?.actionPriority || new Map();
  const criticalDepthMap = context?.criticalDepthMap || new Map();
  const lhsPriority = actionPriority.get(a?.id) || {
    milestoneRank: Number.POSITIVE_INFINITY,
    isCheckpointAction: false,
  };
  const rhsPriority = actionPriority.get(b?.id) || {
    milestoneRank: Number.POSITIVE_INFINITY,
    isCheckpointAction: false,
  };

  if (lhsPriority.milestoneRank !== rhsPriority.milestoneRank) {
    return lhsPriority.milestoneRank - rhsPriority.milestoneRank;
  }
  if (lhsPriority.isCheckpointAction !== rhsPriority.isCheckpointAction) {
    return lhsPriority.isCheckpointAction ? -1 : 1;
  }

  const lhsDepth = Number(criticalDepthMap.get(a?.id) || Number.NaN);
  const rhsDepth = Number(criticalDepthMap.get(b?.id) || Number.NaN);
  if (Number.isFinite(lhsDepth) && Number.isFinite(rhsDepth) && lhsDepth !== rhsDepth) {
    return rhsDepth - lhsDepth;
  }
  if (Number.isFinite(a?.topoIndex) && Number.isFinite(b?.topoIndex) && a.topoIndex !== b.topoIndex) {
    return b.topoIndex - a.topoIndex;
  }
  if ((a?.priority || 0) !== (b?.priority || 0)) return (a?.priority || 0) - (b?.priority || 0);
  return `${a?.id || ''}`.localeCompare(`${b?.id || ''}`);
}

function normalizeDayKey(value, timeZone = 'UTC') {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return dayKeyFromISO(value, timeZone);
}

function parseSpecificDays(raw = '') {
  if (!raw || typeof raw !== 'string') return [];
  const direct = raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (direct.length) return direct;
  const map = { sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thurs: 4, fri: 5, sat: 6 };
  return raw
    .split(',')
    .map((part) => map[(part || '').trim().toLowerCase()])
    .filter((n) => Number.isInteger(n));
}

function resolveEligibleWeekdays(contract = null) {
  const binding = contract?.temporalBinding || {};
  const specific = parseSpecificDays(binding?.specificDays || '');
  if (specific.length) return new Set(specific);
  const daysPerWeek = Number(binding?.daysPerWeek);
  if (!Number.isFinite(daysPerWeek)) return new Set([1, 2, 3, 4, 5]);
  if (daysPerWeek >= 7) return new Set([0, 1, 2, 3, 4, 5, 6]);
  if (daysPerWeek >= 6) return new Set([0, 1, 2, 3, 4, 5]);
  return new Set([1, 2, 3, 4, 5]);
}

function resolveFullPlanPlacementWindow({
  startDayKey,
  goalDeadlineDayKey,
  milestones = [],
  fallbackDays = DRAFT_WINDOW_DAYS,
  guardDays = SPINE_HARD_CAP_DAYS,
  timeZone = 'UTC',
} = {}) {
  const fallbackEndDayKey = startDayKey
    ? addDays(startDayKey, Math.max(0, Number(fallbackDays || 7) - 1), timeZone)
    : null;
  const milestoneEndDayKeys = (milestones || [])
    .map((milestone) => normalizeDayKey(milestone?.windowEndDayKey, timeZone))
    .filter(Boolean)
    .sort();
  const latestMilestoneEndDayKey = milestoneEndDayKeys.length
    ? milestoneEndDayKeys[milestoneEndDayKeys.length - 1]
    : null;
  let horizonMode = 'ROUTE_WINDOW';
  let requestedEndDayKey = fallbackEndDayKey || goalDeadlineDayKey || startDayKey || null;

  if (latestMilestoneEndDayKey) {
    horizonMode = 'MILESTONE_WINDOW';
    requestedEndDayKey = latestMilestoneEndDayKey;
  } else if (goalDeadlineDayKey) {
    horizonMode = 'DEADLINE_WINDOW';
    requestedEndDayKey = goalDeadlineDayKey;
  }

  if (startDayKey && requestedEndDayKey && requestedEndDayKey < startDayKey) requestedEndDayKey = startDayKey;
  const resolvedGuardDays = Math.max(1, Number(guardDays || SPINE_HARD_CAP_DAYS) || SPINE_HARD_CAP_DAYS);
  const guardedEndDayKey = startDayKey
    ? addDays(startDayKey, Math.max(0, resolvedGuardDays - 1), timeZone)
    : requestedEndDayKey;
  let endDayKey = requestedEndDayKey;
  if (guardedEndDayKey && endDayKey && endDayKey > guardedEndDayKey) {
    endDayKey = guardedEndDayKey;
  }
  const guardApplied = Boolean(endDayKey && requestedEndDayKey && endDayKey !== requestedEndDayKey);
  const horizonDays =
    startDayKey && endDayKey
      ? Math.max(1, dayDiffInclusive(startDayKey, endDayKey))
      : Math.max(1, Number(fallbackDays || 7));
  return {
    horizonMode,
    startDayKey: startDayKey || null,
    endDayKey: endDayKey || null,
    horizonDays,
    requestedEndDayKey: requestedEndDayKey || null,
    guardApplied,
    guardDays: resolvedGuardDays,
  };
}

function dayOfWeekUTC(dayKey) {
  const at = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(at)) return null;
  return new Date(at).getUTCDay();
}

function dayDiffInclusive(startDayKey, endDayKey) {
  const start = Date.parse(`${startDayKey}T00:00:00.000Z`);
  const end = Date.parse(`${endDayKey}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function isDoneLike(status = '') {
  const normalized = (status || '').toString().toLowerCase();
  return normalized === 'done' || normalized === 'completed';
}

function isSkippedLike(status = '') {
  const normalized = (status || '').toString().toLowerCase();
  return normalized === 'skipped' || normalized === 'expired';
}

function isActiveScheduleStatus(status = '') {
  const normalized = (status || '').toString().toLowerCase();
  return ['planned', 'scheduled', 'pending', 'active', 'in_progress', 'in-progress', 'started'].includes(normalized);
}

function getCycle(state, cycleId) {
  return cycleId ? state?.cyclesById?.[cycleId] || null : null;
}

function getCycleActions(state, cycleId, fallbackActions = []) {
  if (!cycleId) return fallbackActions || [];
  const workspaceActions = state?.actionsByCycleId?.[cycleId]?.actions || [];
  const cycleActions = state?.cyclesById?.[cycleId]?.actions || [];
  if (workspaceActions.length) return workspaceActions;
  if (cycleActions.length) return cycleActions;
  return fallbackActions || [];
}

function getCycleDeliverables(state, cycleId, fallbackDeliverables = []) {
  if (!cycleId) return fallbackDeliverables || [];
  const workspaceDeliverables = state?.deliverablesByCycleId?.[cycleId]?.deliverables || [];
  return workspaceDeliverables.length ? workspaceDeliverables : fallbackDeliverables || [];
}

function getForecastByDayKey(cycle) {
  const dailyProjection = cycle?.coldPlan?.dailyProjection?.forecastByDayKey || {};
  if (Object.keys(dailyProjection).length) return dailyProjection;
  return cycle?.coldPlan?.forecastByDayKey || {};
}

function sortedDeliverableKeys(byDeliverable = {}) {
  return Object.keys(byDeliverable || {}).sort((a, b) => a.localeCompare(b));
}

function expandDeliverableSlots(entry = {}, totalBlocks = 0) {
  const expanded = [];
  const byDeliverable = entry?.byDeliverable || {};
  sortedDeliverableKeys(byDeliverable).forEach((deliverableId) => {
    const count = Math.max(0, Number(byDeliverable[deliverableId]) || 0);
    for (let i = 0; i < count; i += 1) {
      expanded.push(deliverableId);
    }
  });
  while (expanded.length < totalBlocks) {
    expanded.push(null);
  }
  return expanded.slice(0, totalBlocks);
}

function getScheduledActionIds(state, cycleId) {
  const events = state?.executionEvents || [];
  if (!events.length || !cycleId) return new Set();
  const materialized = materializeBlocksFromEvents(events, { todayISO: state?.today?.date });
  const blocks = [
    ...(materialized?.todayBlocks || []),
    ...(materialized?.days || []).flatMap((day) => day?.blocks || []),
  ];
  return blocks.reduce((set, block) => {
    if (!block?.actionId) return set;
    if (block?.cycleId !== cycleId) return set;
    if (isActiveScheduleStatus(block?.status)) set.add(block.actionId);
    return set;
  }, new Set());
}

function resolveDeliverableActions(deliverable, actions = []) {
  if (!deliverable) return [];
  const byId = new Map((actions || []).map((action) => [action.id, action]));
  if (Array.isArray(deliverable.actionIds) && deliverable.actionIds.length) {
    return deliverable.actionIds.map((id) => byId.get(id)).filter(Boolean);
  }
  const explicit = (actions || []).filter((action) => action?.deliverableId && action.deliverableId === deliverable.id);
  if (explicit.length) return explicit;
  return actions || [];
}

function formatBoundaryLabel(deliverable, defaultHorizon = 7) {
  if (!deliverable) return `Next ${defaultHorizon} days`;
  const title = deliverable.title || deliverable.label || deliverable.id || 'deliverable';
  const due = deliverable?.dueDayKey || normalizeDayKey(deliverable?.dueISO || deliverable?.dueDateISO || null) || null;
  return due ? `${title} (due ${due})` : title;
}

function buildRouteSuggestionsFromSlots(slots = []) {
  const byDay = new Map();
  (slots || []).forEach((slot) => {
    if (!slot?.dayKey) return;
    if (!byDay.has(slot.dayKey)) {
      byDay.set(slot.dayKey, { dayKey: slot.dayKey, totalBlocks: 0, byDeliverable: {} });
    }
    const entry = byDay.get(slot.dayKey);
    entry.totalBlocks += 1;
    if (slot?.deliverableId) {
      entry.byDeliverable[slot.deliverableId] = (entry.byDeliverable[slot.deliverableId] || 0) + 1;
    }
  });
  return Array.from(byDay.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

export function buildActionCandidates(actions = []) {
  return (actions || [])
    .filter((action) => !isDoneLike(action?.status) && !isSkippedLike(action?.status))
    .sort(compareActions);
}

export function buildReadyActionCandidates(actions = []) {
  return computeReadyActions(actions || []).sort(compareActions);
}

export function buildPlanningActionCandidates(actions = []) {
  return computePlanningActions(actions || []).sort(compareActions);
}

export function buildRouteSlotsWindow(state, cycleIdOrOptions = {}, maybeOptions = {}) {
  const options =
    typeof cycleIdOrOptions === 'string'
      ? { ...(maybeOptions || {}), cycleId: cycleIdOrOptions }
      : cycleIdOrOptions || {};
  const {
    cycleId,
    startDateISO,
    endDateISO = null,
    daysForward = DRAFT_WINDOW_DAYS,
    routeMinutes = 30,
    timeZone = 'UTC',
    existingDraftItems = [],
    excludeOverlaps = true,
  } = options;
  const cycle = getCycle(state, cycleId);
  const startDayKey = normalizeDayKey(startDateISO || state?.appTime?.activeDayKey || state?.today?.date, timeZone);
  const endDayKey = normalizeDayKey(endDateISO, timeZone);
  const resolvedDays = endDayKey
    ? dayDiffInclusive(startDayKey, endDayKey)
    : Math.max(0, Number(daysForward || DRAFT_WINDOW_DAYS) || 0);
  if (!cycle || resolvedDays <= 0) return { slots: [], daysCovered: 0 };
  const contract = cycle?.goalContract || null;
  const contractStartDayKey = getContractStartDayKey(contract, timeZone);
  const deadlineDayKey = contract?.deadline?.dayKey || null;
  if (!startDayKey) return { slots: [], daysCovered: 0 };
  const source = getForecastByDayKey(cycle);
  const minutes = Math.max(15, Number(routeMinutes) || 30);
  const occupiedByDay = new Map();
  const appendInterval = (dayKey, startISO, endISO) => {
    const start = Date.parse(startISO || '');
    const end = Date.parse(endISO || '');
    if (!dayKey || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    if (!occupiedByDay.has(dayKey)) occupiedByDay.set(dayKey, []);
    occupiedByDay.get(dayKey).push({ start, end });
  };
  const occupiedStatuses = new Set([
    'planned',
    'scheduled',
    'pending',
    'active',
    'in_progress',
    'in-progress',
    'started',
  ]);
  const materialized = materializeBlocksFromEvents(state?.executionEvents || [], { todayISO: state?.today?.date });
  const materializedBlocks = [
    ...(materialized?.todayBlocks || []),
    ...(materialized?.days || []).flatMap((day) => day?.blocks || []),
  ];
  materializedBlocks.forEach((block) => {
    if (!block || block.cycleId !== cycleId) return;
    const status = (block.status || '').toString().toLowerCase();
    if (!occupiedStatuses.has(status)) return;
    const dayKey = dayKeyFromISO(block.start || block.startISO || '', timeZone);
    appendInterval(dayKey, block.start || block.startISO, block.end || block.endISO);
  });
  (existingDraftItems || []).forEach((item) => {
    const dayKey = item?.dayKey || dayKeyFromISO(item?.startISO || '', timeZone);
    if (!dayKey) return;
    const startISO = item?.startISO;
    const endISO =
      item?.endISO ||
      (startISO && Number.isFinite(item?.minutes)
        ? new Date(Date.parse(startISO) + Number(item.minutes) * 60000).toISOString()
        : null);
    appendInterval(dayKey, startISO, endISO);
  });
  const overlapsOccupied = (dayKey, startISO, endISO) => {
    const start = Date.parse(startISO || '');
    const end = Date.parse(endISO || '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return true;
    const intervals = occupiedByDay.get(dayKey) || [];
    const overlapping = intervals.some((interval) => start < interval.end && end > interval.start);
    if (!overlapping) appendInterval(dayKey, startISO, endISO);
    return overlapping;
  };
  const slots = [];
  for (let i = 0; i < resolvedDays; i += 1) {
    const dayKey = addDays(startDayKey, i, timeZone);
    if (contractStartDayKey && dayKey < contractStartDayKey) continue;
    if (deadlineDayKey && dayKey > deadlineDayKey) continue;
    const entry = source?.[dayKey];
    const totalBlocks = Math.max(0, Number(entry?.totalBlocks) || 0);
    if (totalBlocks <= 0) continue;
    const deliverableSlots = expandDeliverableSlots(entry, totalBlocks);
    for (let slotIndex = 0; slotIndex < totalBlocks; slotIndex += 1) {
      const slotStartMinutes = 9 * 60 + slotIndex * minutes;
      const timeStr = formatMinutes(slotStartMinutes);
      const startISO = ensureISO(dayKey, timeStr);
      const endISO = new Date(Date.parse(startISO) + minutes * 60000).toISOString();
      if (excludeOverlaps && overlapsOccupied(dayKey, startISO, endISO)) continue;
      slots.push({
        dayKey,
        startISO,
        endISO,
        minutes,
        slotIndex,
        deliverableId: deliverableSlots[slotIndex] || null,
        source: 'forecast_window',
      });
    }
  }
  const orderedSlots = slots.sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
    if (a.startISO !== b.startISO) return (a.startISO || '').localeCompare(b.startISO || '');
    return (a.slotIndex || 0) - (b.slotIndex || 0);
  });
  const daysCovered = new Set(orderedSlots.map((slot) => slot.dayKey)).size;
  return { slots: orderedSlots, daysCovered };
}

export function getDraftBoundary(
  state,
  cycleId,
  { daysForward = DRAFT_WINDOW_DAYS, mode: _mode = DEFAULT_BOUNDARY_MODE, hardCapDays = SPINE_HARD_CAP_DAYS } = {}
) {
  if (state && cycleId) {
    const boundary = getSpineBoundary(state, cycleId, 'GOAL_ONLY');
    const timeZone = state?.appTime?.timeZone || 'UTC';
    const startDayKey = normalizeDayKey(state?.appTime?.activeDayKey || state?.today?.date, timeZone);
    const endDayKey = normalizeDayKey(boundary?.boundaryEndISO, timeZone);
    const cappedEndDayKey =
      startDayKey && endDayKey ? addDays(startDayKey, Math.max(0, hardCapDays - 1), timeZone) : endDayKey;
    const effectiveEndDayKey =
      endDayKey && cappedEndDayKey && endDayKey > cappedEndDayKey ? cappedEndDayKey : endDayKey;
    const resolvedDays =
      startDayKey && effectiveEndDayKey
        ? dayDiffInclusive(startDayKey, effectiveEndDayKey)
        : Number(daysForward || SPINE_FALLBACK_DAYS);
    const clamped = Boolean(endDayKey && effectiveEndDayKey && endDayKey !== effectiveEndDayKey);
    const kind =
      clamped || boundary?.boundaryKind === 'HORIZON_FALLBACK'
        ? 'HORIZON_FALLBACK'
        : boundary?.boundaryKind === 'GOAL'
          ? 'GOAL'
          : 'DELIVERABLE';
    return {
      kind,
      daysForward: Math.max(1, resolvedDays || Number(daysForward || SPINE_FALLBACK_DAYS)),
      label:
        clamped && kind === 'HORIZON_FALLBACK'
          ? `Draft horizon (${hardCapDays}d cap)`
          : boundary?.boundaryLabel || `Next ${daysForward} days`,
      covered: false,
      deadlineISO: boundary?.boundaryDeadlineISO || null,
      boundaryEndISO: effectiveEndDayKey ? `${effectiveEndDayKey}T23:59:59.000Z` : boundary?.boundaryEndISO || null,
      capped: Boolean(boundary?.capped || clamped),
    };
  }
  const actions = getCycleActions(state, cycleId, []);
  const deliverables = getCycleDeliverables(state, cycleId, []);
  const scheduledActionIds = getScheduledActionIds(state, cycleId);
  const startDayKey = normalizeDayKey(
    state?.appTime?.activeDayKey || state?.today?.date,
    state?.appTime?.timeZone || 'UTC'
  );
  const horizonEndISO = startDayKey
    ? `${addDays(startDayKey, daysForward - 1, state?.appTime?.timeZone || 'UTC')}T23:59:59.000Z`
    : null;
  if (_mode === 'HORIZON_ONLY') {
    return {
      kind: 'HORIZON',
      daysForward,
      label: `Next ${daysForward} days`,
      covered: false,
      horizonEndISO,
    };
  }
  const orderedDeliverables = (deliverables || [])
    .map((deliverable, index) => ({
      deliverable,
      index,
      dueKey:
        deliverable?.dueDayKey ||
        normalizeDayKey(
          deliverable?.dueISO || deliverable?.dueDateISO || deliverable?.dueDate,
          state?.appTime?.timeZone || 'UTC'
        ) ||
        '',
    }))
    .sort((a, b) => {
      if (a.dueKey !== b.dueKey) return `${a.dueKey}`.localeCompare(`${b.dueKey}`);
      return a.index - b.index;
    });

  let firstCovered = null;
  for (const entry of orderedDeliverables) {
    const deliverableActions = resolveDeliverableActions(entry.deliverable, actions)
      .filter((action) => !isDoneLike(action?.status) && !isSkippedLike(action?.status))
      .sort(compareActions);
    if (!deliverableActions.length) continue;
    const covered = deliverableActions.every((action) => scheduledActionIds.has(action.id));
    const boundary = {
      kind: 'DELIVERABLE',
      deliverableId: entry.deliverable.id || null,
      daysForward,
      label: formatBoundaryLabel(entry.deliverable, daysForward),
      covered,
      deadlineISO: entry.dueKey ? `${entry.dueKey}T23:59:59.000Z` : null,
    };
    if (!covered) return boundary;
    if (!firstCovered) firstCovered = boundary;
  }

  if (firstCovered) return firstCovered;
  return {
    kind: 'HORIZON',
    daysForward,
    label: `Next ${daysForward} days`,
    covered: false,
    horizonEndISO,
  };
}

export function buildRouteSlotsUntilBoundary(
  state,
  cycleId,
  { boundaryEndISO, startDateISO = null, routeMinutes = 30, timeZone = 'UTC', existingDraftItems = [] } = {}
) {
  const startDayKey = normalizeDayKey(startDateISO || state?.appTime?.activeDayKey || state?.today?.date, timeZone);
  const endDayKey = normalizeDayKey(boundaryEndISO, timeZone);
  if (!startDayKey || !endDayKey || endDayKey < startDayKey) {
    return { slots: [], daysCovered: 0, routeSlotsCount: 0 };
  }
  const daysForward = dayDiffInclusive(startDayKey, endDayKey);
  const window = buildRouteSlotsWindow(state, {
    cycleId,
    startDateISO: startDayKey,
    endDateISO: `${endDayKey}T23:59:59.000Z`,
    daysForward,
    routeMinutes,
    timeZone,
    existingDraftItems,
    excludeOverlaps: true,
  });
  return {
    slots: window.slots || [],
    daysCovered: window.daysCovered || 0,
    routeSlotsCount: (window.slots || []).length,
  };
}

export function buildRouteSlotsToDeadline(
  state,
  cycleId,
  { startDateISO, deadlineISO, maxBlocksPerDay = MAX_BLOCKS_PER_DAY, routeMinutes = 30, timeZone = 'UTC' } = {}
) {
  const cycle = getCycle(state, cycleId);
  const contract = cycle?.goalContract || null;
  const startDayKey = normalizeDayKey(startDateISO || state?.appTime?.activeDayKey || state?.today?.date, timeZone);
  const rawDeadlineDayKey = normalizeDayKey(deadlineISO, timeZone);
  if (!cycle || !startDayKey || !rawDeadlineDayKey) {
    return {
      slots: [],
      availableSlotsCount: 0,
      daysCovered: 0,
      startDateISO: startDayKey ? `${startDayKey}T00:00:00.000Z` : null,
      effectiveDeadlineISO: rawDeadlineDayKey ? `${rawDeadlineDayKey}T23:59:59.000Z` : null,
      hardCapApplied: false,
    };
  }
  const cappedDeadlineDayKey = addDays(startDayKey, Math.max(0, SPINE_HARD_CAP_DAYS - 1), timeZone);
  const effectiveDeadlineDayKey = rawDeadlineDayKey > cappedDeadlineDayKey ? cappedDeadlineDayKey : rawDeadlineDayKey;
  const hardCapApplied = effectiveDeadlineDayKey !== rawDeadlineDayKey;
  if (effectiveDeadlineDayKey < startDayKey) {
    return {
      slots: [],
      availableSlotsCount: 0,
      daysCovered: 0,
      startDateISO: `${startDayKey}T00:00:00.000Z`,
      effectiveDeadlineISO: `${effectiveDeadlineDayKey}T23:59:59.000Z`,
      hardCapApplied,
    };
  }

  const eligibleWeekdays = resolveEligibleWeekdays(contract);
  const source = getForecastByDayKey(cycle);
  const minutes = Math.max(15, Number(routeMinutes) || 30);
  const maxPerDay = Math.max(1, Number(maxBlocksPerDay || MAX_BLOCKS_PER_DAY) || MAX_BLOCKS_PER_DAY);
  const occupiedByDay = new Map();
  const appendInterval = (dayKey, startISO, endISO) => {
    const start = Date.parse(startISO || '');
    const end = Date.parse(endISO || '');
    if (!dayKey || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    if (!occupiedByDay.has(dayKey)) occupiedByDay.set(dayKey, []);
    occupiedByDay.get(dayKey).push({ start, end });
  };
  const occupiedStatuses = new Set([
    'planned',
    'scheduled',
    'pending',
    'active',
    'in_progress',
    'in-progress',
    'started',
  ]);
  const materialized = materializeBlocksFromEvents(state?.executionEvents || [], { todayISO: state?.today?.date });
  const materializedBlocks = [
    ...(materialized?.todayBlocks || []),
    ...(materialized?.days || []).flatMap((day) => day?.blocks || []),
  ];
  materializedBlocks.forEach((block) => {
    if (!block || block.cycleId !== cycleId) return;
    const status = (block.status || '').toString().toLowerCase();
    if (!occupiedStatuses.has(status)) return;
    const dayKey = dayKeyFromISO(block.start || block.startISO || '', timeZone);
    appendInterval(dayKey, block.start || block.startISO, block.end || block.endISO);
  });

  const overlapsOccupied = (dayKey, startISO, endISO) => {
    const start = Date.parse(startISO || '');
    const end = Date.parse(endISO || '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return true;
    const intervals = occupiedByDay.get(dayKey) || [];
    const overlapping = intervals.some((interval) => start < interval.end && end > interval.start);
    if (!overlapping) appendInterval(dayKey, startISO, endISO);
    return overlapping;
  };

  const slots = [];
  const resolvedDays = dayDiffInclusive(startDayKey, effectiveDeadlineDayKey);
  for (let i = 0; i < resolvedDays; i += 1) {
    const dayKey = addDays(startDayKey, i, timeZone);
    const weekday = dayOfWeekUTC(dayKey);
    if (weekday === null || (eligibleWeekdays.size > 0 && !eligibleWeekdays.has(weekday))) continue;
    const entry = source?.[dayKey];
    const totalBlocks = Math.max(0, Number(entry?.totalBlocks) || 0);
    if (totalBlocks <= 0) continue;
    const deliverableSlots = expandDeliverableSlots(entry, totalBlocks);
    let emittedForDay = 0;
    for (let slotIndex = 0; slotIndex < totalBlocks && emittedForDay < maxPerDay; slotIndex += 1) {
      const slotStartMinutes = 9 * 60 + slotIndex * minutes;
      const timeStr = formatMinutes(slotStartMinutes);
      const startISO = ensureISO(dayKey, timeStr);
      const endISO = new Date(Date.parse(startISO) + minutes * 60000).toISOString();
      if (overlapsOccupied(dayKey, startISO, endISO)) continue;
      slots.push({
        dateISO: dayKey,
        startMin: slotStartMinutes,
        endMin: slotStartMinutes + minutes,
        routeKey: `route:${dayKey}`,
        slotKey: `slot:${dayKey}:${slotStartMinutes}`,
        dayKey,
        startISO,
        endISO,
        minutes,
        slotIndex,
        deliverableId: deliverableSlots[slotIndex] || null,
        source: 'forecast_deadline',
      });
      emittedForDay += 1;
    }
  }

  slots.sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
    if (a.startISO !== b.startISO) return (a.startISO || '').localeCompare(b.startISO || '');
    return (a.slotIndex || 0) - (b.slotIndex || 0);
  });

  return {
    slots,
    availableSlotsCount: slots.length,
    daysCovered: new Set(slots.map((slot) => slot.dayKey)).size,
    startDateISO: `${startDayKey}T00:00:00.000Z`,
    effectiveDeadlineISO: `${effectiveDeadlineDayKey}T23:59:59.000Z`,
    hardCapApplied,
  };
}

export function buildEvenlySpacedSlots(
  actionsCount,
  startDayKey,
  deadlineDayKey,
  {
    timeZone = 'UTC',
    slotStartMin = 9 * 60,
    slotDurationMin = 30,
    eligibleWeekdays = null,
    maxBlocksPerDay = MAX_BLOCKS_PER_DAY,
    selectionMode = 'target_count',
  } = {}
) {
  if (!Number.isFinite(actionsCount) || actionsCount <= 0 || !startDayKey || !deadlineDayKey) return [];
  const totalDays = dayDiffInclusive(startDayKey, deadlineDayKey);
  if (!Number.isFinite(totalDays) || totalDays <= 0) return [];

  const eligibleDays = [];
  for (let i = 0; i < totalDays; i += 1) {
    const dayKey = addDays(startDayKey, i, timeZone);
    const weekday = dayOfWeekUTC(dayKey);
    if (weekday === null) continue;
    if (eligibleWeekdays && eligibleWeekdays.size > 0 && !eligibleWeekdays.has(weekday)) continue;
    eligibleDays.push(dayKey);
  }
  if (eligibleDays.length === 0) return [];

  const duration = Math.max(15, Number(slotDurationMin) || 30);
  const maxPerDay = Math.max(1, Number(maxBlocksPerDay || MAX_BLOCKS_PER_DAY) || MAX_BLOCKS_PER_DAY);
  const candidateSlots = [];
  eligibleDays.forEach((dayKey) => {
    for (let daySlotIndex = 0; daySlotIndex < maxPerDay; daySlotIndex += 1) {
      const startMin = slotStartMin + daySlotIndex * duration;
      const startISO = ensureISO(dayKey, formatMinutes(startMin));
      const endISO = new Date(Date.parse(startISO) + duration * 60000).toISOString();
      candidateSlots.push({
        dateISO: dayKey,
        dayKey,
        startMin,
        endMin: startMin + duration,
        startISO,
        endISO,
        minutes: duration,
        slotIndex: daySlotIndex,
        routeKey: `route:${dayKey}`,
        slotKey: `slot:${dayKey}:${startMin}`,
        deliverableId: null,
        source: 'full_plan_even_spread',
      });
    }
  });
  if (candidateSlots.length === 0) return [];

  if (selectionMode === 'all_candidates') {
    return candidateSlots.map((slot, index) => ({
      ...slot,
      slotIndex: index,
    }));
  }

  const targetCount = Math.min(actionsCount, candidateSlots.length);
  const slots = [];
  let previousIndex = -1;
  for (let i = 0; i < targetCount; i += 1) {
    const scaled = Math.round((i / Math.max(1, actionsCount - 1)) * Math.max(0, candidateSlots.length - 1));
    const nextIndex = Math.max(previousIndex + 1, scaled);
    const boundedIndex = Math.min(nextIndex, candidateSlots.length - (targetCount - i));
    const selected = candidateSlots[boundedIndex];
    slots.push({
      ...selected,
      slotIndex: i,
    });
    previousIndex = boundedIndex;
  }

  return slots;
}

function weekKeyForDay(dayKey) {
  const at = Date.parse(`${dayKey}T00:00:00.000Z`);
  if (!Number.isFinite(at)) return null;
  const day = new Date(at).getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(at + mondayOffset * 86400000).toISOString().slice(0, 10);
}

export function filterSlotsByCapacityCaps(
  slots = [],
  {
    maxScheduledMinutesPerDay = null,
    maxScheduledMinutesPerWeek = null,
    existingDayUsage = null,
    existingWeekUsage = null,
  } = {}
) {
  const dayCap = Number.isFinite(maxScheduledMinutesPerDay) ? Math.max(1, Number(maxScheduledMinutesPerDay)) : null;
  const weekCap = Number.isFinite(maxScheduledMinutesPerWeek) ? Math.max(1, Number(maxScheduledMinutesPerWeek)) : null;
  if (!dayCap && !weekCap) {
    return { slots: [...(slots || [])], dayUsage: {}, weekUsage: {} };
  }

  const dayUsage = new Map(
    existingDayUsage && typeof existingDayUsage === 'object' ? Object.entries(existingDayUsage) : []
  );
  const weekUsage = new Map(
    existingWeekUsage && typeof existingWeekUsage === 'object' ? Object.entries(existingWeekUsage) : []
  );
  const allowed = [];
  (slots || []).forEach((slot) => {
    const dayKey = slot?.dayKey || slot?.dateISO;
    if (!dayKey) return;
    const weekKey = weekKeyForDay(dayKey) || dayKey;
    const minutes = Math.max(1, Number(slot?.minutes) || 30);
    const dayUsed = dayUsage.get(dayKey) || 0;
    const weekUsed = weekUsage.get(weekKey) || 0;
    const exceedsDay = dayCap ? dayUsed + minutes > dayCap : false;
    const exceedsWeek = weekCap ? weekUsed + minutes > weekCap : false;
    if (exceedsDay || exceedsWeek) return;
    dayUsage.set(dayKey, dayUsed + minutes);
    weekUsage.set(weekKey, weekUsed + minutes);
    allowed.push(slot);
  });

  return {
    slots: allowed,
    dayUsage: Object.fromEntries(dayUsage.entries()),
    weekUsage: Object.fromEntries(weekUsage.entries()),
  };
}

export function assignActionsToSlotsSequential(actionsOrdered = [], slots = []) {
  const assignments = [];
  const unassignedActions = [];
  for (let i = 0; i < actionsOrdered.length; i += 1) {
    const action = actionsOrdered[i];
    if (i < slots.length) {
      assignments.push({ action, slot: slots[i] });
    } else {
      unassignedActions.push(action);
    }
  }
  const requiredSlots = actionsOrdered.length;
  const availableSlots = slots.length;
  const missingSlots = Math.max(0, requiredSlots - availableSlots);
  const unusedSlots = Math.max(0, availableSlots - requiredSlots);
  if (missingSlots > 0) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_ROUTE_SLOTS_TO_DEADLINE',
      requiredSlots,
      availableSlots,
      missingSlots,
      unassignedActions,
    };
  }
  return {
    ok: true,
    assignments,
    requiredSlots,
    availableSlots,
    unusedSlots,
    unassignedActions,
  };
}

export function resolveActionEstimateMin(action, fallbackMin = 30) {
  const candidate = Number(action?.estimateMin ?? action?.minutes ?? fallbackMin ?? 30);
  if (!Number.isFinite(candidate)) return Math.max(1, Number(fallbackMin) || 30);
  return Math.max(1, Math.round(candidate));
}

function resolveActionDependencyIds(action = null) {
  if (!action) return [];
  if (Array.isArray(action?.deps)) return action.deps.filter(Boolean);
  if (Array.isArray(action?.dependencies)) return action.dependencies.filter(Boolean);
  if (Array.isArray(action?.dependencies?.ids)) return action.dependencies.ids.filter(Boolean);
  return [];
}

function resolveActionDependencyBufferMinutes(action = null, fallbackBufferMinutes = 0) {
  const explicit = Number(action?.dependencies?.bufferMinutes);
  if (Number.isFinite(explicit)) return Math.max(0, Math.round(explicit));
  const fallback = Number(fallbackBufferMinutes);
  return Number.isFinite(fallback) ? Math.max(0, Math.round(fallback)) : 0;
}

export function computeDepReadyCutoffTs(action = null, placedChunksByActionId = new Map(), fallbackBufferMinutes = 0) {
  const depIds = resolveActionDependencyIds(action);
  if (!depIds.length) {
    return {
      cutoffTs: -Infinity,
      unresolvedDepIds: [],
      bufferMinutesUsed: resolveActionDependencyBufferMinutes(action, fallbackBufferMinutes),
    };
  }

  const unresolvedDepIds = [];
  let depMaxEndAt = -Infinity;
  depIds.forEach((depId) => {
    const depRows = placedChunksByActionId.get(depId) || [];
    if (!depRows.length) {
      unresolvedDepIds.push(depId);
      return;
    }
    depRows.forEach((row) => {
      const endAt = Date.parse(row?.slot?.endISO || '') || Date.parse(row?.slot?.startISO || '');
      if (Number.isFinite(endAt)) depMaxEndAt = Math.max(depMaxEndAt, endAt);
    });
  });

  const bufferMinutesUsed = resolveActionDependencyBufferMinutes(action, fallbackBufferMinutes);
  if (unresolvedDepIds.length || !Number.isFinite(depMaxEndAt)) {
    return { cutoffTs: null, unresolvedDepIds, bufferMinutesUsed };
  }
  return {
    cutoffTs: depMaxEndAt + bufferMinutesUsed * 60000,
    unresolvedDepIds: [],
    bufferMinutesUsed,
  };
}

function toTs(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeReservationSource(source = '') {
  const normalized = (source || '').toString();
  if (normalized === 'draft_cache') return 'draft_cache';
  if (normalized === 'materialized') return 'materialized';
  return 'unknown';
}

function buildReservationKey(actionId, chunkIndex) {
  return `${actionId || ''}::${Number(chunkIndex) || 0}`;
}

function buildActionPlanById(actions = [], slotDurationMin = 30) {
  const byId = new Map();
  (actions || []).forEach((action) => {
    if (!action?.id) return;
    byId.set(action.id, buildActionChunkPlan(action, slotDurationMin, slotDurationMin));
  });
  return byId;
}

function buildActionIndexById(actions = []) {
  return new Map((actions || []).map((action) => [action?.id, action]).filter(([id]) => Boolean(id)));
}

function intervalOverlaps(startTs, endTs, intervals = []) {
  return (intervals || []).some((interval) => startTs < interval.endTs && endTs > interval.startTs);
}

function toScoreAssignments(assignments = []) {
  return (assignments || [])
    .map((row) => {
      const dayKey = row?.slot?.dayKey || row?.slot?.dateISO || null;
      const startISO = row?.slot?.startISO || null;
      const startMin = Number.isFinite(row?.slot?.startMin)
        ? Number(row.slot.startMin)
        : minutesFromISO(startISO || '') || 0;
      const durationMin = Math.max(1, Number(row?.allocatedMin || row?.slot?.minutes || row?.durationMin || 30));
      if (!row?.action?.id || !dayKey) return null;
      return {
        actionId: row.action.id,
        chunkIndex: Number(row?.chunkIndex || 0),
        chunkCount: Number(row?.chunkCount || 1),
        dayKey,
        startMin,
        durationMin,
        category: row?.action?.category || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey.localeCompare(b.dayKey);
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      if (a.actionId !== b.actionId) return a.actionId.localeCompare(b.actionId);
      return a.chunkIndex - b.chunkIndex;
    });
}

function buildQualityMetricsContext(stats = {}) {
  return {
    milestoneWindowSlack: null,
    unplacedEstimateMinTotal: Number(stats?.unplacedEstimateMinTotal || 0),
    outsideExecutionHorizonEstimateMinTotal: Number(stats?.outsideExecutionHorizonEstimateMinTotal || 0),
    outsideExecutionHorizonCount: Number(stats?.outsideExecutionHorizonCount || 0),
  };
}

function applyOptimizedAssignmentsToRows(rows = [], optimizedAssignments = []) {
  const byKey = new Map(
    (optimizedAssignments || []).map((assignment) => [
      `${assignment.actionId}::${Number(assignment.chunkIndex || 0)}`,
      assignment,
    ])
  );
  return (rows || []).map((row) => {
    const key = `${row?.action?.id || ''}::${Number(row?.chunkIndex || 0)}`;
    const optimized = byKey.get(key);
    if (!optimized) return row;
    const startISO = ensureISO(optimized.dayKey, formatMinutes(Math.max(0, Number(optimized.startMin) || 0)));
    const durationMin = Math.max(1, Number(optimized.durationMin || row?.allocatedMin || row?.slot?.minutes || 30));
    const endISO = new Date(Date.parse(startISO) + durationMin * 60000).toISOString();
    return {
      ...row,
      allocatedMin: durationMin,
      slot: {
        ...(row?.slot || {}),
        dayKey: optimized.dayKey,
        dateISO: optimized.dayKey,
        startMin: optimized.startMin,
        endMin: optimized.startMin + durationMin,
        startISO,
        endISO,
        minutes: durationMin,
      },
    };
  });
}

function addIntervalByDay(intervalsByDay, dayKey, startTs, endTs, metadata = null) {
  if (!dayKey || !Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return;
  if (!intervalsByDay.has(dayKey)) intervalsByDay.set(dayKey, []);
  intervalsByDay.get(dayKey).push({ dayKey, startTs, endTs, metadata });
}

function usageFromIntervalsByDay(intervalsByDay = new Map()) {
  const dayUsage = new Map();
  const weekUsage = new Map();
  intervalsByDay.forEach((intervals, dayKey) => {
    const minutes = (intervals || []).reduce(
      (sum, interval) => sum + Math.max(1, Math.round((interval.endTs - interval.startTs) / 60000)),
      0
    );
    if (minutes <= 0) return;
    dayUsage.set(dayKey, (dayUsage.get(dayKey) || 0) + minutes);
    const weekKey = weekKeyForDay(dayKey) || dayKey;
    weekUsage.set(weekKey, (weekUsage.get(weekKey) || 0) + minutes);
  });
  return { dayUsage, weekUsage };
}

function normalizeReservationFromItem(item, source = 'unknown') {
  const actionId = item?.actionId || item?.payload?.actionId || null;
  if (!actionId) return null;
  const startISO = item?.startISO || item?.start || null;
  const endISO = item?.endISO || item?.end || null;
  const startTs = toTs(startISO);
  const inferredEndTs = Number.isFinite(startTs)
    ? startTs + Math.max(1, Number(item?.minutes || item?.durationMin || item?.allocatedMin || 30)) * 60000
    : null;
  const endTs = toTs(endISO) ?? inferredEndTs;
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return null;
  const chunkIndex = Number(item?.chunkIndex ?? item?.meta?.chunkIndex ?? item?.payload?.chunkIndex ?? 0);
  const chunkCount = Number(item?.chunkCount ?? item?.meta?.chunkCount ?? item?.payload?.chunkCount ?? 1);
  const allocatedMin = Math.max(
    1,
    Number(
      item?.allocatedMin ??
        item?.meta?.allocatedMin ??
        item?.payload?.allocatedMin ??
        item?.minutes ??
        item?.durationMin ??
        Math.round((endTs - startTs) / 60000)
    ) || 30
  );
  const dayKey = item?.dayKey || item?.dateISO || dayKeyFromISO(startISO || '', 'UTC') || null;
  return {
    actionId,
    chunkIndex: Number.isFinite(chunkIndex) ? Math.max(0, Math.round(chunkIndex)) : 0,
    chunkCount: Number.isFinite(chunkCount) ? Math.max(1, Math.round(chunkCount)) : 1,
    startTs,
    endTs,
    dayKey,
    allocatedMin,
    blockId: item?.id || item?.blockId || null,
    source: normalizeReservationSource(source),
    startISO: startISO || new Date(startTs).toISOString(),
    endISO: endISO || new Date(endTs).toISOString(),
  };
}

function collectExistingReservations(
  state,
  cycleId,
  { executionWindowStartDayKey, executionWindowEndDayKey, planningActions = [], slotDurationMin = 30 } = {}
) {
  const actionById = buildActionIndexById(planningActions);
  const actionPlanById = buildActionPlanById(planningActions, slotDurationMin);
  const dedup = new Set();
  const accepted = [];
  const immutableIntervalsByDay = new Map();
  let orphanReservationCount = 0;

  const tryAddReservation = (entry, source) => {
    const reservation = normalizeReservationFromItem(entry, source);
    if (!reservation) {
      const startTs = toTs(entry?.startISO || entry?.start || '');
      const endTs = toTs(entry?.endISO || entry?.end || '');
      const inferredEndTs =
        Number.isFinite(startTs) && Number.isFinite(entry?.minutes)
          ? startTs + Math.max(1, Number(entry.minutes)) * 60000
          : null;
      const resolvedEndTs = endTs ?? inferredEndTs;
      const dayKey =
        entry?.dayKey || entry?.dateISO || dayKeyFromISO(entry?.startISO || entry?.start || '', 'UTC') || null;
      if (Number.isFinite(startTs) && Number.isFinite(resolvedEndTs) && resolvedEndTs > startTs) {
        addIntervalByDay(immutableIntervalsByDay, dayKey, startTs, resolvedEndTs, { reason: 'ORPHAN_RESERVATION' });
        orphanReservationCount += 1;
      }
      return;
    }
    if (executionWindowStartDayKey && reservation.dayKey && reservation.dayKey < executionWindowStartDayKey) {
      return;
    }
    if (executionWindowEndDayKey && reservation.dayKey && reservation.dayKey > executionWindowEndDayKey) {
      return;
    }
    if (!actionById.has(reservation.actionId)) {
      addIntervalByDay(immutableIntervalsByDay, reservation.dayKey, reservation.startTs, reservation.endTs, {
        reason: 'ACTION_REMOVED',
      });
      orphanReservationCount += 1;
      return;
    }
    const actionPlan = actionPlanById.get(reservation.actionId);
    if (!actionPlan || reservation.chunkIndex >= actionPlan.chunkCount) {
      addIntervalByDay(immutableIntervalsByDay, reservation.dayKey, reservation.startTs, reservation.endTs, {
        reason: 'USER_EDITED_BLOCK',
      });
      orphanReservationCount += 1;
      return;
    }
    const key = buildReservationKey(reservation.actionId, reservation.chunkIndex);
    if (dedup.has(key)) return;
    dedup.add(key);
    accepted.push(reservation);
  };

  const draftItems = state?.draftScheduleItemsByCycleId?.[cycleId] || [];
  draftItems.forEach((item) => {
    if (!isAutomationScheduleItem(item)) return;
    tryAddReservation(item, 'draft_cache');
  });

  const materialized = materializeBlocksFromEvents(state?.executionEvents || [], { todayISO: state?.today?.date });
  const blocks = [
    ...(materialized?.todayBlocks || []),
    ...(materialized?.days || []).flatMap((day) => day?.blocks || []),
  ];
  blocks.forEach((block) => {
    if (!block || block?.cycleId !== cycleId) return;
    if (!isActiveScheduleStatus(block?.status)) return;
    tryAddReservation(block, 'materialized');
  });

  const groupedByAction = new Map();
  accepted.forEach((reservation) => {
    if (!groupedByAction.has(reservation.actionId)) groupedByAction.set(reservation.actionId, []);
    groupedByAction.get(reservation.actionId).push(reservation);
  });

  const reservations = [];
  groupedByAction.forEach((rows, actionId) => {
    const actionPlan = actionPlanById.get(actionId);
    const uniqueChunkCount = new Set(rows.map((row) => row.chunkIndex)).size;
    if (!actionPlan || uniqueChunkCount !== actionPlan.chunkCount) {
      rows.forEach((row) => {
        addIntervalByDay(immutableIntervalsByDay, row.dayKey, row.startTs, row.endTs, { reason: 'USER_EDITED_BLOCK' });
        orphanReservationCount += 1;
      });
      return;
    }
    rows.sort((lhs, rhs) => lhs.chunkIndex - rhs.chunkIndex).forEach((row) => reservations.push(row));
  });

  return { reservations, immutableIntervalsByDay, orphanReservationCount };
}

export function buildActionChunkPlan(action, slotDurationMin = 30, fallbackMin = 30) {
  const duration = Math.max(1, Math.round(Number(slotDurationMin) || 30));
  const estimateMin = resolveActionEstimateMin(action, fallbackMin);
  const chunkCount = Math.max(1, Math.ceil(estimateMin / duration));
  const chunks = [];
  let remaining = estimateMin;
  for (let i = 0; i < chunkCount; i += 1) {
    const chunkMin = i < chunkCount - 1 ? duration : Math.max(1, remaining);
    chunks.push(chunkMin);
    remaining -= chunkMin;
  }
  return {
    actionId: action?.id || null,
    estimateMin,
    chunkCount,
    chunks,
  };
}

export function assignActionChunksToSlots(
  actionsOrdered = [],
  slots = [],
  slotDurationMin = 30,
  fallbackMin = 30,
  options = {}
) {
  const {
    actionConstraintsById = new Map(),
    dependencyBufferMinutes = 0,
    seedAssignmentRowsByActionId = null,
  } = options || {};
  const assignments = [];
  const requiredChunks = [];
  const actionPlans = [];
  const unassignedActions = [];
  const unassignedActionReasons = {};
  let softWindowFallbackCount = 0;
  const assignmentRowsByActionId = new Map();
  if (seedAssignmentRowsByActionId && typeof seedAssignmentRowsByActionId?.forEach === 'function') {
    seedAssignmentRowsByActionId.forEach((rows, actionId) => {
      const safeRows = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
      assignmentRowsByActionId.set(actionId, safeRows);
    });
  }

  (actionsOrdered || []).forEach((action) => {
    const plan = buildActionChunkPlan(action, slotDurationMin, fallbackMin);
    actionPlans.push({ action, plan });
    for (let chunkIndex = 0; chunkIndex < plan.chunkCount; chunkIndex += 1) {
      requiredChunks.push({
        action,
        chunkIndex,
        chunkCount: plan.chunkCount,
        allocatedMin: plan.chunks[chunkIndex],
        estimateMin: plan.estimateMin,
      });
    }
  });

  const availableSlots = (slots || []).length;
  const requiredSlots = requiredChunks.length;
  const usedSlotIndices = new Set();
  for (let actionIndex = 0; actionIndex < actionPlans.length; actionIndex += 1) {
    const { action, plan } = actionPlans[actionIndex];
    const actionId = action?.id || '';
    const constraints = actionConstraintsById.get(actionId) || null;
    const constraintMode = constraints?.constraintMode === 'soft' ? 'soft' : 'hard';
    const hasMilestoneBinding = Boolean(constraints?.hasMilestoneBinding);
    const depIds = resolveActionDependencyIds(action);
    const enforceDependencyCutoff = depIds.length > 0;
    const hasWindowConstraint = Boolean(
      hasMilestoneBinding && constraints?.windowStartDayKey && constraints?.windowEndDayKey
    );
    const windowStartAt = hasWindowConstraint ? Date.parse(`${constraints.windowStartDayKey}T00:00:00.000Z`) : null;
    const windowEndAt = hasWindowConstraint ? Date.parse(`${constraints.windowEndDayKey}T23:59:59.999Z`) : null;

    let depEarliestAllowedAt = -Infinity;
    if (enforceDependencyCutoff) {
      const depReady = computeDepReadyCutoffTs(action, assignmentRowsByActionId, dependencyBufferMinutes);
      if (depReady.cutoffTs === null) {
        unassignedActions.push(action);
        unassignedActionReasons[actionId] = hasWindowConstraint ? 'DEP_NOT_READY_IN_WINDOW' : 'DEPENDENCY_NOT_READY';
        continue;
      }
      depEarliestAllowedAt = depReady.cutoffTs;
    }

    const collectCandidates = ({ inWindowOnly = false, applyDepCutoff = false } = {}) => {
      const selected = [];
      for (let slotIndex = 0; slotIndex < slots.length && selected.length < plan.chunkCount; slotIndex += 1) {
        if (usedSlotIndices.has(slotIndex)) continue;
        const slot = slots[slotIndex];
        const slotStartAt = Date.parse(slot?.startISO || '');
        const slotEndAt = Date.parse(slot?.endISO || '');
        if (!Number.isFinite(slotStartAt) || !Number.isFinite(slotEndAt)) continue;
        if (inWindowOnly && hasWindowConstraint) {
          if (!Number.isFinite(windowStartAt) || !Number.isFinite(windowEndAt)) continue;
          if (slotStartAt < windowStartAt || slotEndAt > windowEndAt) continue;
        }
        if (applyDepCutoff && Number.isFinite(depEarliestAllowedAt) && slotStartAt < depEarliestAllowedAt) continue;
        selected.push({ slotIndex, slot });
      }
      return selected;
    };

    let selectedSlots = [];
    if (hasWindowConstraint && constraintMode === 'hard') {
      const inWindowNoDep = collectCandidates({ inWindowOnly: true, applyDepCutoff: false });
      const inWindowWithDep = collectCandidates({ inWindowOnly: true, applyDepCutoff: enforceDependencyCutoff });
      selectedSlots = inWindowWithDep;
      if (selectedSlots.length < plan.chunkCount) {
        unassignedActions.push(action);
        unassignedActionReasons[actionId] =
          enforceDependencyCutoff && inWindowNoDep.length >= plan.chunkCount
            ? 'DEP_NOT_READY_IN_WINDOW'
            : 'MILESTONE_WINDOW_NO_SLOT';
        continue;
      }
    } else if (hasWindowConstraint && constraintMode === 'soft') {
      const inWindowNoDep = collectCandidates({ inWindowOnly: true, applyDepCutoff: false });
      const inWindowWithDep = collectCandidates({ inWindowOnly: true, applyDepCutoff: enforceDependencyCutoff });
      if (inWindowWithDep.length >= plan.chunkCount) {
        selectedSlots = inWindowWithDep;
      } else {
        const globalWithDep = collectCandidates({ inWindowOnly: false, applyDepCutoff: enforceDependencyCutoff });
        if (globalWithDep.length >= plan.chunkCount) {
          selectedSlots = globalWithDep;
          softWindowFallbackCount += 1;
        } else {
          unassignedActions.push(action);
          unassignedActionReasons[actionId] =
            enforceDependencyCutoff && inWindowNoDep.length >= plan.chunkCount
              ? 'DEP_NOT_READY_IN_WINDOW'
              : 'MILESTONE_WINDOW_NO_SLOT';
          continue;
        }
      }
    } else {
      selectedSlots = collectCandidates({ inWindowOnly: false, applyDepCutoff: enforceDependencyCutoff });
    }

    if (selectedSlots.length < plan.chunkCount) {
      unassignedActions.push(action);
      if (hasWindowConstraint) {
        const inWindowNoDep = collectCandidates({ inWindowOnly: true, applyDepCutoff: false });
        unassignedActionReasons[actionId] =
          enforceDependencyCutoff && inWindowNoDep.length >= plan.chunkCount
            ? 'DEP_NOT_READY_IN_WINDOW'
            : 'MILESTONE_WINDOW_NO_SLOT';
      } else {
        unassignedActionReasons[actionId] = enforceDependencyCutoff
          ? 'DEPENDENCY_NOT_READY'
          : 'INSUFFICIENT_ROUTE_SLOTS_TO_DEADLINE';
      }
      continue;
    }

    const rows = [];
    for (let chunkIndex = 0; chunkIndex < plan.chunkCount; chunkIndex += 1) {
      const selected = selectedSlots[chunkIndex];
      usedSlotIndices.add(selected.slotIndex);
      assignments.push({
        action,
        chunkIndex,
        chunkCount: plan.chunkCount,
        allocatedMin: plan.chunks[chunkIndex],
        estimateMin: plan.estimateMin,
        slot: selected.slot,
      });
      rows.push({
        chunkIndex,
        chunkCount: plan.chunkCount,
        allocatedMin: plan.chunks[chunkIndex],
        estimateMin: plan.estimateMin,
        slot: selected.slot,
      });
    }
    assignmentRowsByActionId.set(actionId, rows);
  }

  const missingSlots = Math.max(0, requiredSlots - assignments.length);
  const unusedSlots = Math.max(0, availableSlots - assignments.length);
  if (missingSlots > 0) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_ROUTE_SLOTS_TO_DEADLINE',
      assignments,
      requiredSlots,
      availableSlots,
      missingSlots,
      unusedSlots,
      unassignedActions,
      unassignedActionReasons,
      softWindowFallbackCount,
    };
  }

  return {
    ok: true,
    assignments,
    requiredSlots,
    availableSlots,
    missingSlots,
    unusedSlots,
    unassignedActions,
    unassignedActionReasons,
    softWindowFallbackCount,
  };
}

function buildStickyExecutionAssignments({
  state,
  cycleId,
  planningActions = [],
  executionSlots = [],
  actionConstraintsById = new Map(),
  dependencyBufferMinutes = 0,
  slotDurationMin = 30,
  maxScheduledMinutesPerDay = null,
  maxScheduledMinutesPerWeek = null,
  executionStartDayKey = null,
  executionEndDayKey = null,
  strategicComparator = null,
} = {}) {
  const actionById = buildActionIndexById(planningActions);
  const { reservations, immutableIntervalsByDay, orphanReservationCount } = collectExistingReservations(
    state,
    cycleId,
    {
      executionWindowStartDayKey: executionStartDayKey,
      executionWindowEndDayKey: executionEndDayKey,
      planningActions,
      slotDurationMin,
    }
  );
  const reservationsByAction = new Map();
  reservations.forEach((reservation) => {
    if (!reservationsByAction.has(reservation.actionId)) reservationsByAction.set(reservation.actionId, []);
    reservationsByAction.get(reservation.actionId).push(reservation);
  });

  const compareReservation = (lhs, rhs) => {
    const leftConstraints = actionConstraintsById.get(lhs?.actionId) || {};
    const rightConstraints = actionConstraintsById.get(rhs?.actionId) || {};
    const leftPriority = Boolean(leftConstraints?.hasMilestoneBinding || leftConstraints?.isMilestoneCritical);
    const rightPriority = Boolean(rightConstraints?.hasMilestoneBinding || rightConstraints?.isMilestoneCritical);
    if (leftPriority !== rightPriority) return leftPriority ? -1 : 1;
    if (lhs.startTs !== rhs.startTs) return lhs.startTs - rhs.startTs;
    const leftAction = actionById.get(lhs?.actionId) || null;
    const rightAction = actionById.get(rhs?.actionId) || null;
    if (leftAction && rightAction && typeof strategicComparator === 'function') {
      const strategic = strategicComparator(leftAction, rightAction);
      if (strategic !== 0) return strategic;
    }
    if ((lhs?.actionId || '') !== (rhs?.actionId || ''))
      return (lhs?.actionId || '').localeCompare(rhs?.actionId || '');
    if ((lhs?.chunkIndex || 0) !== (rhs?.chunkIndex || 0)) return (lhs?.chunkIndex || 0) - (rhs?.chunkIndex || 0);
    return `${lhs?.blockId || ''}`.localeCompare(`${rhs?.blockId || ''}`);
  };

  const sortedReservations = [...reservations].sort(compareReservation);
  const preservedIntervalsByDay = new Map();
  const assignmentRowsByActionId = new Map();
  const preservedRows = [];
  const pendingDepValidation = [];
  const rejectedByKey = new Map();
  const churnReasonsCount = {};
  const rescheduleDecisions = [];
  const { dayUsage, weekUsage } = usageFromIntervalsByDay(immutableIntervalsByDay);
  const dayCap = Number.isFinite(maxScheduledMinutesPerDay) ? Math.max(1, Number(maxScheduledMinutesPerDay)) : null;
  const weekCap = Number.isFinite(maxScheduledMinutesPerWeek) ? Math.max(1, Number(maxScheduledMinutesPerWeek)) : null;

  const rejectReservation = (reservation, reason, outcome = 'dropped') => {
    rejectedByKey.set(buildReservationKey(reservation.actionId, reservation.chunkIndex), reason);
    churnReasonsCount[reason] = (churnReasonsCount[reason] || 0) + 1;
    rescheduleDecisions.push({
      actionId: reservation.actionId,
      chunkIndex: reservation.chunkIndex,
      oldStartISO: reservation.startISO,
      oldEndISO: reservation.endISO,
      reason,
      outcome,
    });
  };

  sortedReservations.forEach((reservation) => {
    const action = actionById.get(reservation.actionId);
    if (!action) {
      rejectReservation(reservation, 'ACTION_REMOVED');
      return;
    }
    if (executionStartDayKey && reservation.dayKey && reservation.dayKey < executionStartDayKey) {
      rejectReservation(reservation, 'OUTSIDE_EXECUTION_HORIZON');
      return;
    }
    if (executionEndDayKey && reservation.dayKey && reservation.dayKey > executionEndDayKey) {
      rejectReservation(reservation, 'OUTSIDE_EXECUTION_HORIZON');
      return;
    }
    const constraints = actionConstraintsById.get(reservation.actionId) || null;
    const hasWindowConstraint = Boolean(
      constraints?.hasMilestoneBinding && constraints?.windowStartDayKey && constraints?.windowEndDayKey
    );
    if (hasWindowConstraint && constraints?.constraintMode === 'hard') {
      const windowStartAt = Date.parse(`${constraints.windowStartDayKey}T00:00:00.000Z`);
      const windowEndAt = Date.parse(`${constraints.windowEndDayKey}T23:59:59.999Z`);
      if (reservation.startTs < windowStartAt || reservation.endTs > windowEndAt) {
        rejectReservation(reservation, 'WINDOW_VIOLATION');
        return;
      }
    }
    const immutableForDay = immutableIntervalsByDay.get(reservation.dayKey) || [];
    const preservedForDay = preservedIntervalsByDay.get(reservation.dayKey) || [];
    if (
      intervalOverlaps(reservation.startTs, reservation.endTs, immutableForDay) ||
      intervalOverlaps(reservation.startTs, reservation.endTs, preservedForDay)
    ) {
      rejectReservation(reservation, 'OVERLAP_CONFLICT');
      return;
    }

    const minutes = Math.max(1, Number(reservation.allocatedMin) || 30);
    const weekKey = weekKeyForDay(reservation.dayKey) || reservation.dayKey;
    const dayUsed = dayUsage.get(reservation.dayKey) || 0;
    const weekUsed = weekUsage.get(weekKey) || 0;
    const exceedsDay = dayCap ? dayUsed + minutes > dayCap : false;
    const exceedsWeek = weekCap ? weekUsed + minutes > weekCap : false;
    if (exceedsDay || exceedsWeek) {
      rejectReservation(reservation, 'CAPACITY_CAP_VIOLATION');
      return;
    }

    const depReady = computeDepReadyCutoffTs(action, assignmentRowsByActionId, dependencyBufferMinutes);
    if (depReady.cutoffTs === null && depReady.unresolvedDepIds.length > 0) {
      pendingDepValidation.push(reservation);
    } else if (Number.isFinite(depReady.cutoffTs) && reservation.startTs < depReady.cutoffTs) {
      rejectReservation(reservation, 'DEP_BUFFER_VIOLATION');
      return;
    }

    dayUsage.set(reservation.dayKey, dayUsed + minutes);
    weekUsage.set(weekKey, weekUsed + minutes);
    addIntervalByDay(preservedIntervalsByDay, reservation.dayKey, reservation.startTs, reservation.endTs, {
      actionId: reservation.actionId,
      chunkIndex: reservation.chunkIndex,
    });
    const row = {
      action,
      chunkIndex: reservation.chunkIndex,
      chunkCount: reservation.chunkCount,
      allocatedMin: reservation.allocatedMin,
      estimateMin: resolveActionEstimateMin(action, slotDurationMin),
      slot: {
        dayKey: reservation.dayKey,
        dateISO: reservation.dayKey,
        startISO: reservation.startISO,
        endISO: reservation.endISO,
        minutes,
      },
      stickyPreserved: true,
    };
    preservedRows.push(row);
    if (!assignmentRowsByActionId.has(reservation.actionId)) assignmentRowsByActionId.set(reservation.actionId, []);
    assignmentRowsByActionId.get(reservation.actionId).push(row);
    rescheduleDecisions.push({
      actionId: reservation.actionId,
      chunkIndex: reservation.chunkIndex,
      oldStartISO: reservation.startISO,
      oldEndISO: reservation.endISO,
      reason: null,
      outcome: 'preserved',
    });
  });

  const preservedActionIds = new Set(Array.from(assignmentRowsByActionId.keys()));
  const remainingActions = planningActions.filter((action) => !preservedActionIds.has(action?.id));
  const occupiedByDay = new Map();
  immutableIntervalsByDay.forEach((intervals, dayKey) => occupiedByDay.set(dayKey, [...intervals]));
  preservedIntervalsByDay.forEach((intervals, dayKey) => {
    if (!occupiedByDay.has(dayKey)) occupiedByDay.set(dayKey, []);
    occupiedByDay.get(dayKey).push(...intervals);
  });
  const remainingCandidateSlots = executionSlots.filter((slot) => {
    const dayKey = slot?.dayKey || slot?.dateISO;
    const startTs = toTs(slot?.startISO);
    const endTs = toTs(slot?.endISO);
    if (!dayKey || !Number.isFinite(startTs) || !Number.isFinite(endTs)) return false;
    return !intervalOverlaps(startTs, endTs, occupiedByDay.get(dayKey) || []);
  });
  const existingDayUsage = Object.fromEntries(dayUsage.entries());
  const existingWeekUsage = Object.fromEntries(weekUsage.entries());
  const filteredRemainingSlots =
    dayCap || weekCap
      ? filterSlotsByCapacityCaps(remainingCandidateSlots, {
          maxScheduledMinutesPerDay: dayCap,
          maxScheduledMinutesPerWeek: weekCap,
          existingDayUsage,
          existingWeekUsage,
        }).slots
      : remainingCandidateSlots;

  const fillAssignment = assignActionChunksToSlots(
    remainingActions,
    filteredRemainingSlots,
    slotDurationMin,
    slotDurationMin,
    {
      actionConstraintsById,
      dependencyBufferMinutes,
      seedAssignmentRowsByActionId: assignmentRowsByActionId,
    }
  );

  const finalAssignments = [...preservedRows, ...(fillAssignment.assignments || [])];
  const finalRowsByActionId = new Map();
  finalAssignments.forEach((row) => {
    const actionId = row?.action?.id;
    if (!actionId) return;
    if (!finalRowsByActionId.has(actionId)) finalRowsByActionId.set(actionId, []);
    finalRowsByActionId.get(actionId).push(row);
  });

  const pendingOrdered = [...pendingDepValidation].sort(compareReservation);
  const demotedActionIds = new Set();
  pendingOrdered.forEach((reservation) => {
    const action = actionById.get(reservation.actionId);
    if (!action) return;
    const depReady = computeDepReadyCutoffTs(action, finalRowsByActionId, dependencyBufferMinutes);
    const blocked = depReady.cutoffTs === null || reservation.startTs < depReady.cutoffTs;
    if (!blocked) return;
    demotedActionIds.add(reservation.actionId);
    rejectReservation(reservation, 'DEP_BUFFER_VIOLATION');
  });

  const stableAssignments = finalAssignments.filter((row) => !demotedActionIds.has(row?.action?.id));
  const stableRowsByActionId = new Map();
  stableAssignments.forEach((row) => {
    const actionId = row?.action?.id;
    if (!actionId) return;
    if (!stableRowsByActionId.has(actionId)) stableRowsByActionId.set(actionId, []);
    stableRowsByActionId.get(actionId).push(row);
  });

  const availableAfterDemotion = executionSlots.filter((slot) => {
    const startTs = toTs(slot?.startISO);
    const endTs = toTs(slot?.endISO);
    const dayKey = slot?.dayKey || slot?.dateISO;
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || !dayKey) return false;
    const occupied = [];
    (immutableIntervalsByDay.get(dayKey) || []).forEach((interval) => occupied.push(interval));
    stableAssignments.forEach((row) => {
      const rowDay = row?.slot?.dayKey || row?.slot?.dateISO;
      if (rowDay !== dayKey) return;
      const rowStart = toTs(row?.slot?.startISO);
      const rowEnd = toTs(row?.slot?.endISO);
      if (Number.isFinite(rowStart) && Number.isFinite(rowEnd)) occupied.push({ startTs: rowStart, endTs: rowEnd });
    });
    return !intervalOverlaps(startTs, endTs, occupied);
  });

  const demotedActions = planningActions.filter((action) => demotedActionIds.has(action?.id));
  const reflow = assignActionChunksToSlots(demotedActions, availableAfterDemotion, slotDurationMin, slotDurationMin, {
    actionConstraintsById,
    dependencyBufferMinutes,
    seedAssignmentRowsByActionId: stableRowsByActionId,
  });
  reflow.assignments.forEach((row) => stableAssignments.push(row));

  const reflowPlacedIds = new Set((reflow.assignments || []).map((row) => row?.action?.id).filter(Boolean));
  demotedActions.forEach((action) => {
    if (reflowPlacedIds.has(action?.id)) return;
    churnReasonsCount.DEP_BUFFER_VIOLATION = (churnReasonsCount.DEP_BUFFER_VIOLATION || 0) + 1;
  });

  const finalByKey = new Map();
  stableAssignments.forEach((row) => {
    const actionId = row?.action?.id;
    if (!actionId) return;
    const key = buildReservationKey(actionId, row?.chunkIndex || 0);
    finalByKey.set(key, row);
  });

  let preservedChunkCount = 0;
  let movedChunkCount = 0;
  let droppedChunkCount = 0;
  let churnMovedMinutesTotal = 0;
  reservations.forEach((reservation) => {
    const key = buildReservationKey(reservation.actionId, reservation.chunkIndex);
    const row = finalByKey.get(key);
    if (!row) {
      droppedChunkCount += 1;
      if (!rejectedByKey.has(key)) {
        churnReasonsCount.UNKNOWN_INVALIDATION = (churnReasonsCount.UNKNOWN_INVALIDATION || 0) + 1;
        rescheduleDecisions.push({
          actionId: reservation.actionId,
          chunkIndex: reservation.chunkIndex,
          oldStartISO: reservation.startISO,
          oldEndISO: reservation.endISO,
          reason: 'UNKNOWN_INVALIDATION',
          outcome: 'dropped',
        });
      }
      return;
    }
    const finalStartISO = row?.slot?.startISO || '';
    if (finalStartISO === reservation.startISO) {
      preservedChunkCount += 1;
      return;
    }
    movedChunkCount += 1;
    churnMovedMinutesTotal += Math.max(1, Number(reservation.allocatedMin) || 30);
    const reason = rejectedByKey.get(key) || 'UNKNOWN_INVALIDATION';
    churnReasonsCount[reason] = (churnReasonsCount[reason] || 0) + 1;
    rescheduleDecisions.push({
      actionId: reservation.actionId,
      chunkIndex: reservation.chunkIndex,
      oldStartISO: reservation.startISO,
      oldEndISO: reservation.endISO,
      reason,
      outcome: 'moved',
    });
  });

  return {
    assignment: {
      ...fillAssignment,
      assignments: stableAssignments,
    },
    stickyStats: {
      reservationInputCount: reservations.length,
      reservationAcceptedPass1Count: preservedRows.length,
      reservationPendingDepValidationCount: pendingDepValidation.length,
      reservationRejectedCount: Math.max(0, reservations.length - preservedRows.length),
      orphanReservationCount,
      preservedChunkCount,
      movedChunkCount,
      droppedChunkCount,
      churnMovedMinutesTotal,
      churnReasonsCount,
      rescheduleDecisions,
    },
  };
}

export function selectActionsForBoundary(state, cycleId, boundary) {
  const actions = getCycleActions(state, cycleId, []);
  if (!boundary || boundary.kind !== 'DELIVERABLE') {
    return buildActionCandidates(actions);
  }
  const deliverables = getCycleDeliverables(state, cycleId, []);
  const deliverable = (deliverables || []).find((item) => item?.id === boundary.deliverableId) || null;
  return resolveDeliverableActions(deliverable, actions)
    .filter((action) => !isDoneLike(action?.status) && !isSkippedLike(action?.status))
    .sort(compareActions);
}

export function getDraftDiagnostics({
  state = null,
  cycleId = null,
  routeSuggestions = [],
  actions = [],
  draftItems = [],
  fullDraftItems = null,
  boundaryKind = 'HORIZON_FALLBACK',
  boundaryLabel = 'Next 7 days',
  boundaryDeadlineISO = null,
  boundaryEndISO = null,
  routeSlotWindowDays = 7,
  routeSlotsCount,
  requiredSlots = null,
  requiredSlotsWeighted = null,
  availableSlots = null,
  availableSlotsFromPlacement = null,
  missingSlots = null,
  missingSlotsWeighted = null,
  unusedSlots = null,
  unplacedEstimateMinTotal = null,
  unplacedEstimateMinByCategory = null,
  milestonePrioritySummary = null,
  unassignedActionReasons = null,
  milestoneWindowMissCountPlacement = null,
  depWindowBlockedCount = null,
  depWindowBlockedByMilestone = null,
  depBufferBlockedCount = null,
  depBufferBlockedByMilestone = null,
  reservationInputCount = null,
  reservationAcceptedPass1Count = null,
  reservationPendingDepValidationCount = null,
  reservationRejectedCount = null,
  orphanReservationCount = null,
  preservedChunkCount = null,
  movedChunkCount = null,
  droppedChunkCount = null,
  churnMovedMinutesTotal = null,
  churnReasonsCount = null,
  rescheduleDecisions = null,
  outsideExecutionHorizonCount = null,
  outsideExecutionHorizonEstimateMinTotal = null,
  executionHorizonDays = null,
  executionWindowStartISO = null,
  executionWindowEndISO = null,
  feasibilityWindowStartISO = null,
  feasibilityWindowEndISO = null,
  slotUniverseMode = null,
  slotUniverseCandidateCount = null,
  slotUniverseSelectedCount = null,
  placementHorizonEndISO = null,
  placementHorizonRequestedEndISO = null,
  placementHorizonGuardedEndISO = null,
  placementHorizonGuardApplied = null,
  placementHorizonGuardDays = null,
  placementHorizonDays = null,
  placementWindowStartISO = null,
  placementWindowEndISO = null,
  milestoneWindowConstraintMode = null,
  horizonMode = null,
  softWindowFallbackCount = null,
  qualityScoreBaseline = null,
  qualityScoreOptimized = null,
  qualityImprovementDelta = null,
  chosenMovesSummary = null,
  startDateISO = null,
  deadlineISO = null,
  maxBlocksPerDay = MAX_BLOCKS_PER_DAY,
  deliverableCovered = false,
  graphInvalid = false,
  noActionPlan = false,
  scheduleMode = SPINE_SCHEDULE_MODE,
  reasonCodeOverride = null,
} = {}) {
  const requestedAutomationSlots = Number.isFinite(routeSlotsCount)
    ? Math.max(0, Number(routeSlotsCount))
    : (routeSuggestions || []).reduce((sum, entry) => sum + Math.max(0, Number(entry?.totalBlocks) || 0), 0);
  const actionCount = (actions || []).length;
  const readyActionsCount = buildReadyActionCandidates(actions).length;
  const scopedDraftItems = Array.isArray(fullDraftItems) ? fullDraftItems : draftItems || [];
  const emittedAutomationSlots = scopedDraftItems.filter((item) => isAutomationScheduleItem(item)).length;
  const droppedForMissingContext = Math.max(0, requestedAutomationSlots - emittedAutomationSlots);
  const scheduledActionIds = getScheduledActionIds(state, cycleId);
  const routeDurationMin = Math.max(1, Number(state?.planDraft?.routeMinutes || 30) || 30);
  const plannedActions = buildActionCandidates(actions).filter((action) => !scheduledActionIds.has(action.id));
  const plannedActionsCount = plannedActions.length;
  const requiredSlotsWeightedComputed = plannedActions.reduce((sum, action) => {
    const estimateMin = resolveActionEstimateMin(action, routeDurationMin);
    return sum + Math.max(1, Math.ceil(estimateMin / routeDurationMin));
  }, 0);
  const draftedActionsCount = new Set(scopedDraftItems.filter((item) => item?.actionId).map((item) => item.actionId))
    .size;
  const blockedDraftedCount = scopedDraftItems.filter((item) => Boolean(item?.meta?.blocked || item?.blocked)).length;
  const planningActions = buildPlanningActionCandidates(actions);
  const blockedPlannedCount = planningActions.filter((action) => action?.blocked).length;
  const readyPlannedCount = planningActions.length - blockedPlannedCount;
  const visibleCount = (draftItems || []).length;
  const hiddenDraftCount = Math.max(0, scopedDraftItems.length - visibleCount);
  const draftTotalCount = scopedDraftItems.length;
  const draftVisibleCount = visibleCount;
  const scheduledActionsCount = scheduledActionIds.size;
  const resolvedDeadlineISO =
    deadlineISO ||
    boundaryDeadlineISO ||
    boundaryEndISO ||
    (() => {
      const cycle = getCycle(state, cycleId);
      const dayKey = normalizeDayKey(
        cycle?.goalContract?.deadline?.dayKey || cycle?.goalContract?.deadlineISO || null,
        state?.appTime?.timeZone || 'UTC'
      );
      return dayKey ? `${dayKey}T23:59:59.000Z` : null;
    })();
  const derivedAvailableSlots =
    scheduleMode === 'FULL_PLAN' &&
    state &&
    cycleId &&
    !Number.isFinite(availableSlots) &&
    !Number.isFinite(availableSlotsFromPlacement) &&
    resolvedDeadlineISO
      ? buildRouteSlotsToDeadline(state, cycleId, {
          startDateISO: startDateISO || state?.appTime?.activeDayKey || state?.today?.date,
          deadlineISO: resolvedDeadlineISO,
          maxBlocksPerDay,
          routeMinutes: 30,
          timeZone: state?.appTime?.timeZone || 'UTC',
        }).availableSlotsCount
      : null;
  const resolvedRequiredSlotsWeighted = Number.isFinite(requiredSlotsWeighted)
    ? Math.max(0, Number(requiredSlotsWeighted))
    : requiredSlotsWeightedComputed;
  const resolvedRequiredSlots = Number.isFinite(requiredSlots)
    ? Math.max(0, Number(requiredSlots))
    : scheduleMode === 'FULL_PLAN'
      ? resolvedRequiredSlotsWeighted
      : plannedActionsCount;
  const resolvedAvailableSlots = Number.isFinite(availableSlotsFromPlacement)
    ? Math.max(0, Number(availableSlotsFromPlacement))
    : Number.isFinite(availableSlots)
      ? Math.max(0, Number(availableSlots))
      : Number.isFinite(derivedAvailableSlots)
        ? Math.max(0, Number(derivedAvailableSlots))
        : requestedAutomationSlots;
  const resolvedMissingSlots = Number.isFinite(missingSlots)
    ? Math.max(0, Number(missingSlots))
    : Math.max(0, resolvedRequiredSlots - resolvedAvailableSlots);
  const resolvedUnusedSlots = Number.isFinite(unusedSlots)
    ? Math.max(0, Number(unusedSlots))
    : Math.max(0, resolvedAvailableSlots - resolvedRequiredSlots);
  const resolvedUnplacedEstimateMinTotal = Number.isFinite(unplacedEstimateMinTotal)
    ? Math.max(0, Number(unplacedEstimateMinTotal))
    : 0;
  const resolvedUnplacedEstimateMinByCategory =
    unplacedEstimateMinByCategory && typeof unplacedEstimateMinByCategory === 'object'
      ? { ...unplacedEstimateMinByCategory }
      : {};
  const resolvedMilestonePrioritySummary = Array.isArray(milestonePrioritySummary) ? [...milestonePrioritySummary] : [];
  const resolvedUnassignedActionReasons =
    unassignedActionReasons && typeof unassignedActionReasons === 'object' ? { ...unassignedActionReasons } : {};
  const resolvedMilestoneWindowMissCountPlacement = Number.isFinite(milestoneWindowMissCountPlacement)
    ? Math.max(0, Number(milestoneWindowMissCountPlacement))
    : Object.values(resolvedUnassignedActionReasons).filter(
        (code) => code === 'MILESTONE_WINDOW_NO_SLOT' || code === 'DEP_NOT_READY_IN_WINDOW'
      ).length;
  const resolvedDepWindowBlockedCount = Number.isFinite(depWindowBlockedCount)
    ? Math.max(0, Number(depWindowBlockedCount))
    : Object.values(resolvedUnassignedActionReasons).filter((code) => code === 'DEP_NOT_READY_IN_WINDOW').length;
  const resolvedDepWindowBlockedByMilestone =
    depWindowBlockedByMilestone && typeof depWindowBlockedByMilestone === 'object'
      ? { ...depWindowBlockedByMilestone }
      : {};
  const resolvedDepBufferBlockedCount = Number.isFinite(depBufferBlockedCount)
    ? Math.max(0, Number(depBufferBlockedCount))
    : resolvedDepWindowBlockedCount;
  const resolvedDepBufferBlockedByMilestone =
    depBufferBlockedByMilestone && typeof depBufferBlockedByMilestone === 'object'
      ? { ...depBufferBlockedByMilestone }
      : resolvedDepWindowBlockedByMilestone;
  const resolvedReservationInputCount = Number.isFinite(reservationInputCount)
    ? Math.max(0, Number(reservationInputCount))
    : 0;
  const resolvedReservationAcceptedPass1Count = Number.isFinite(reservationAcceptedPass1Count)
    ? Math.max(0, Number(reservationAcceptedPass1Count))
    : 0;
  const resolvedReservationPendingDepValidationCount = Number.isFinite(reservationPendingDepValidationCount)
    ? Math.max(0, Number(reservationPendingDepValidationCount))
    : 0;
  const resolvedReservationRejectedCount = Number.isFinite(reservationRejectedCount)
    ? Math.max(0, Number(reservationRejectedCount))
    : Math.max(0, resolvedReservationInputCount - resolvedReservationAcceptedPass1Count);
  const resolvedOrphanReservationCount = Number.isFinite(orphanReservationCount)
    ? Math.max(0, Number(orphanReservationCount))
    : 0;
  const resolvedPreservedChunkCount = Number.isFinite(preservedChunkCount)
    ? Math.max(0, Number(preservedChunkCount))
    : 0;
  const resolvedMovedChunkCount = Number.isFinite(movedChunkCount) ? Math.max(0, Number(movedChunkCount)) : 0;
  const resolvedDroppedChunkCount = Number.isFinite(droppedChunkCount) ? Math.max(0, Number(droppedChunkCount)) : 0;
  const resolvedChurnMovedMinutesTotal = Number.isFinite(churnMovedMinutesTotal)
    ? Math.max(0, Number(churnMovedMinutesTotal))
    : 0;
  const resolvedChurnReasonsCount =
    churnReasonsCount && typeof churnReasonsCount === 'object' ? { ...churnReasonsCount } : {};
  const resolvedRescheduleDecisions = Array.isArray(rescheduleDecisions) ? [...rescheduleDecisions] : [];
  const resolvedOutsideExecutionHorizonCount = Number.isFinite(outsideExecutionHorizonCount)
    ? Math.max(0, Number(outsideExecutionHorizonCount))
    : 0;
  const resolvedOutsideExecutionHorizonEstimateMinTotal = Number.isFinite(outsideExecutionHorizonEstimateMinTotal)
    ? Math.max(0, Number(outsideExecutionHorizonEstimateMinTotal))
    : 0;
  const resolvedSlotUniverseMode =
    slotUniverseMode === 'FULL_CANDIDATE' || slotUniverseMode === 'EVEN_SPREAD' ? slotUniverseMode : 'EVEN_SPREAD';
  const resolvedSlotUniverseCandidateCount = Number.isFinite(slotUniverseCandidateCount)
    ? Math.max(0, Number(slotUniverseCandidateCount))
    : 0;
  const resolvedSlotUniverseSelectedCount = Number.isFinite(slotUniverseSelectedCount)
    ? Math.max(0, Number(slotUniverseSelectedCount))
    : 0;
  const resolvedPlacementHorizonDays = Number.isFinite(placementHorizonDays)
    ? Math.max(0, Number(placementHorizonDays))
    : Math.max(1, Number(routeSlotWindowDays || DRAFT_WINDOW_DAYS));
  const resolvedPlacementHorizonGuardDays = Number.isFinite(placementHorizonGuardDays)
    ? Math.max(1, Number(placementHorizonGuardDays))
    : SPINE_HARD_CAP_DAYS;
  const resolvedPlacementHorizonGuardApplied =
    typeof placementHorizonGuardApplied === 'boolean'
      ? placementHorizonGuardApplied
      : Boolean(
          placementHorizonRequestedEndISO &&
          placementHorizonGuardedEndISO &&
          placementHorizonRequestedEndISO !== placementHorizonGuardedEndISO
        );
  const resolvedPlacementWindowStartISO =
    placementWindowStartISO || (startDateISO ? `${startDateISO}T00:00:00.000Z` : null);
  const resolvedPlacementWindowEndISO = placementWindowEndISO || placementHorizonEndISO || boundaryEndISO || null;
  const resolvedExecutionHorizonDays = Number.isFinite(executionHorizonDays)
    ? Math.max(1, Number(executionHorizonDays))
    : null;
  const resolvedExecutionWindowStartISO = executionWindowStartISO || resolvedPlacementWindowStartISO;
  const resolvedExecutionWindowEndISO = executionWindowEndISO || resolvedPlacementWindowEndISO;
  const resolvedFeasibilityWindowStartISO = feasibilityWindowStartISO || resolvedPlacementWindowStartISO;
  const resolvedFeasibilityWindowEndISO = feasibilityWindowEndISO || resolvedPlacementWindowEndISO;
  const resolvedMilestoneWindowConstraintMode =
    milestoneWindowConstraintMode === 'hard' || milestoneWindowConstraintMode === 'soft'
      ? milestoneWindowConstraintMode
      : 'hard';
  const resolvedHorizonMode = (horizonMode || '').toString() || 'ROUTE_WINDOW';
  const resolvedSoftWindowFallbackCount = Number.isFinite(softWindowFallbackCount)
    ? Math.max(0, Number(softWindowFallbackCount))
    : 0;
  const resolvedQualityScoreBaseline =
    qualityScoreBaseline && typeof qualityScoreBaseline === 'object' ? { ...qualityScoreBaseline } : null;
  const resolvedQualityScoreOptimized =
    qualityScoreOptimized && typeof qualityScoreOptimized === 'object'
      ? { ...qualityScoreOptimized }
      : resolvedQualityScoreBaseline;
  const resolvedQualityImprovementDelta = Number.isFinite(qualityImprovementDelta)
    ? Number(qualityImprovementDelta)
    : Number(((resolvedQualityScoreOptimized?.total || 0) - (resolvedQualityScoreBaseline?.total || 0)).toFixed(6));
  const resolvedChosenMovesSummary =
    chosenMovesSummary && typeof chosenMovesSummary === 'object'
      ? {
          iterations: Math.max(0, Number(chosenMovesSummary.iterations || 0)),
          candidatesEvaluated: Math.max(0, Number(chosenMovesSummary.candidatesEvaluated || 0)),
          moves: Array.isArray(chosenMovesSummary.moves) ? [...chosenMovesSummary.moves] : [],
        }
      : { iterations: 0, candidatesEvaluated: 0, moves: [] };
  const maxScheduledMinutesPerWeek = Number(state?.constraints?.maxScheduledMinutesPerWeek);
  const resolvedMaxScheduledMinutesPerWeek = Number.isFinite(maxScheduledMinutesPerWeek)
    ? Math.max(1, Number(maxScheduledMinutesPerWeek))
    : null;
  const prescriptions = computePrescriptions({
    unplacedEstimateMinTotal: resolvedUnplacedEstimateMinTotal,
    unplacedEstimateMinByCategory: resolvedUnplacedEstimateMinByCategory,
    outsideExecutionHorizonEstimateMinTotal: resolvedOutsideExecutionHorizonEstimateMinTotal,
    outsideExecutionHorizonCount: resolvedOutsideExecutionHorizonCount,
    executionHorizonDays: resolvedExecutionHorizonDays,
    placementWindowDays: resolvedPlacementHorizonDays,
    maxScheduledMinutesPerWeek: resolvedMaxScheduledMinutesPerWeek || undefined,
    milestoneWindowMissCountPlacement: resolvedMilestoneWindowMissCountPlacement,
  });
  const effectiveRequestedSlots = scheduleMode === 'FULL_PLAN' ? resolvedAvailableSlots : requestedAutomationSlots;
  const startDayKey = normalizeDayKey(startDateISO, state?.appTime?.timeZone || 'UTC');
  const deadlineDayKey = normalizeDayKey(resolvedDeadlineISO, state?.appTime?.timeZone || 'UTC');
  const hardCapReached =
    Boolean(startDayKey && deadlineDayKey) && dayDiffInclusive(startDayKey, deadlineDayKey) >= SPINE_HARD_CAP_DAYS;

  const resolvedMissingSlotsWeighted = Number.isFinite(missingSlotsWeighted)
    ? Math.max(0, Number(missingSlotsWeighted))
    : Math.max(0, resolvedRequiredSlotsWeighted - resolvedAvailableSlots);

  let reasonCode;
  if (graphInvalid || state?.lastPlanError?.code === 'ACTION_GRAPH_INVALID') reasonCode = 'ACTION_GRAPH_INVALID';
  else if (noActionPlan || actionCount <= 0) reasonCode = 'NO_ACTION_PLAN';
  else if (!resolvedDeadlineISO) reasonCode = 'NO_GOAL_DEADLINE';
  else if (scheduleMode === 'FULL_PLAN' && resolvedMissingSlots > 0 && emittedAutomationSlots <= 0) {
    reasonCode = 'INSUFFICIENT_ROUTE_SLOTS_TO_DEADLINE';
  } else if (effectiveRequestedSlots <= 0) reasonCode = 'NO_ROUTE_SLOTS';
  else if (scheduleMode === 'READY_ONLY' && readyActionsCount <= 0) reasonCode = 'NO_READY_ACTIONS';
  else if (boundaryKind === 'HORIZON_FALLBACK' && hardCapReached) reasonCode = 'HIT_HARD_CAP';
  else if (boundaryKind === 'DELIVERABLE' && deliverableCovered) reasonCode = 'DELIVERABLE_COVERED';
  else if (emittedAutomationSlots <= 0) reasonCode = 'NO_DRAFT_ITEMS';
  else if (plannedActionsCount > emittedAutomationSlots && effectiveRequestedSlots > emittedAutomationSlots) {
    reasonCode = 'PARTIAL_SPINE_EMITTED';
  } else if (plannedActionsCount > emittedAutomationSlots) {
    reasonCode = 'HIT_BOUNDARY';
  } else if (scheduleMode === 'FULL_PLAN' && emittedAutomationSlots >= resolvedRequiredSlots) {
    reasonCode = 'FULL_PLAN_PLACED_TO_DEADLINE';
  } else if (effectiveRequestedSlots > emittedAutomationSlots) {
    reasonCode = scheduleMode === 'READY_ONLY' ? 'INSUFFICIENT_READY_ACTIONS' : 'PARTIAL_SPINE_EMITTED';
  } else reasonCode = scheduleMode === 'FULL_PLAN' ? 'FULL_PLAN_PLACED_TO_DEADLINE' : 'FULL_SPINE_EMITTED';
  if (scheduleMode === 'FULL_PLAN' && reasonCodeOverride) {
    reasonCode = reasonCodeOverride;
  }

  return {
    actionCount,
    plannedActionsCount,
    readyActionsCount,
    scheduledActionsCount,
    draftedActionsCount,
    blockedDraftedCount,
    blockedPlannedCount,
    readyPlannedCount,
    requestedAutomationSlots: effectiveRequestedSlots,
    emittedAutomationSlots,
    droppedForMissingContext,
    draftTotalCount,
    draftVisibleCount,
    hiddenDraftCount,
    reasonCode,
    boundaryKind,
    boundaryLabel,
    boundaryDeadlineISO,
    boundaryEndISO: boundaryEndISO || boundaryDeadlineISO || null,
    startDateISO,
    deadlineISO: resolvedDeadlineISO,
    maxBlocksPerDay,
    requiredSlots: resolvedRequiredSlots,
    slotsRequired: resolvedRequiredSlots,
    requiredSlotsWeighted: resolvedRequiredSlotsWeighted,
    availableSlots: resolvedAvailableSlots,
    slotsAvailableToDeadline: resolvedAvailableSlots,
    missingSlots: resolvedMissingSlots,
    slotsMissing: resolvedMissingSlots,
    missingSlotsWeighted: resolvedMissingSlotsWeighted,
    unusedSlots: resolvedUnusedSlots,
    slotsUnused: resolvedUnusedSlots,
    unplacedEstimateMinTotal: resolvedUnplacedEstimateMinTotal,
    unplacedEstimateMinByCategory: resolvedUnplacedEstimateMinByCategory,
    milestonePrioritySummary: resolvedMilestonePrioritySummary,
    unassignedActionReasons: resolvedUnassignedActionReasons,
    milestoneWindowMissCountPlacement: resolvedMilestoneWindowMissCountPlacement,
    depWindowBlockedCount: resolvedDepWindowBlockedCount,
    depWindowBlockedByMilestone: resolvedDepWindowBlockedByMilestone,
    depBufferBlockedCount: resolvedDepBufferBlockedCount,
    depBufferBlockedByMilestone: resolvedDepBufferBlockedByMilestone,
    reservationInputCount: resolvedReservationInputCount,
    reservationAcceptedPass1Count: resolvedReservationAcceptedPass1Count,
    reservationPendingDepValidationCount: resolvedReservationPendingDepValidationCount,
    reservationRejectedCount: resolvedReservationRejectedCount,
    orphanReservationCount: resolvedOrphanReservationCount,
    preservedChunkCount: resolvedPreservedChunkCount,
    movedChunkCount: resolvedMovedChunkCount,
    droppedChunkCount: resolvedDroppedChunkCount,
    churnMovedMinutesTotal: resolvedChurnMovedMinutesTotal,
    churnReasonsCount: resolvedChurnReasonsCount,
    rescheduleDecisions: resolvedRescheduleDecisions,
    outsideExecutionHorizonCount: resolvedOutsideExecutionHorizonCount,
    outsideExecutionHorizonEstimateMinTotal: resolvedOutsideExecutionHorizonEstimateMinTotal,
    executionHorizonDays: resolvedExecutionHorizonDays,
    executionWindowStartISO: resolvedExecutionWindowStartISO,
    executionWindowEndISO: resolvedExecutionWindowEndISO,
    feasibilityWindowStartISO: resolvedFeasibilityWindowStartISO,
    feasibilityWindowEndISO: resolvedFeasibilityWindowEndISO,
    slotUniverseMode: resolvedSlotUniverseMode,
    slotUniverseCandidateCount: resolvedSlotUniverseCandidateCount,
    slotUniverseSelectedCount: resolvedSlotUniverseSelectedCount,
    placementHorizonEndISO: placementHorizonEndISO || null,
    placementHorizonRequestedEndISO: placementHorizonRequestedEndISO || null,
    placementHorizonGuardedEndISO: placementHorizonGuardedEndISO || null,
    placementHorizonGuardApplied: resolvedPlacementHorizonGuardApplied,
    placementHorizonGuardDays: resolvedPlacementHorizonGuardDays,
    placementHorizonDays: resolvedPlacementHorizonDays,
    placementWindowStartISO: resolvedPlacementWindowStartISO,
    placementWindowEndISO: resolvedPlacementWindowEndISO,
    milestoneWindowConstraintMode: resolvedMilestoneWindowConstraintMode,
    horizonMode: resolvedHorizonMode,
    softWindowFallbackCount: resolvedSoftWindowFallbackCount,
    qualityScoreBaseline: resolvedQualityScoreBaseline,
    qualityScoreOptimized: resolvedQualityScoreOptimized,
    qualityImprovementDelta: resolvedQualityImprovementDelta,
    chosenMovesSummary: resolvedChosenMovesSummary,
    prescriptions,
    routeSlotWindowDays: resolvedPlacementHorizonDays,
    routeSlotsCount: effectiveRequestedSlots,
  };
}

export function buildDraftScheduleItems(state, cycleId, options = {}) {
  const {
    startDateISO = null,
    boundary = null,
    daysForward = null,
    boundaryMode = DEFAULT_BOUNDARY_MODE,
    scheduleMode = SPINE_SCHEDULE_MODE,
    hardCapDays = SPINE_HARD_CAP_DAYS,
    suggestedBlocks = [],
    routeSuggestions = [],
    deliverables = [],
    actions = [],
    contract = null,
    timeZone = 'UTC',
    defaults = {},
    contractStartDayKey: contractStartDayKeyOverride = null,
    captureStats = null,
  } = options || {};
  const resolvedActions = state && cycleId ? getCycleActions(state, cycleId, actions || []) : actions || [];
  const resolvedDeliverables =
    state && cycleId ? getCycleDeliverables(state, cycleId, deliverables || []) : deliverables || [];
  const resolvedBoundary =
    state && cycleId
      ? boundary ||
        getDraftBoundary(state, cycleId, {
          daysForward: daysForward || DRAFT_WINDOW_DAYS,
          mode: boundaryMode,
          hardCapDays,
        })
      : boundary || {
          kind: 'HORIZON_FALLBACK',
          daysForward: daysForward || DRAFT_WINDOW_DAYS,
          label: `Next ${daysForward || DRAFT_WINDOW_DAYS} days`,
          covered: false,
        };
  const resolvedWindowDays = Math.max(
    1,
    Number(resolvedBoundary?.daysForward || daysForward || DRAFT_WINDOW_DAYS) || DRAFT_WINDOW_DAYS
  );
  const actionCandidates = buildReadyActionCandidates(resolvedActions);
  const hasActionPlan = (resolvedActions || []).length > 0;
  const keepAutomationItem = (item) =>
    !hasActionPlan || !isAutomationScheduleItem(item) || (item?.actionId && item?.title && item?.detail);

  if (scheduleMode === 'FULL_PLAN' && state && cycleId) {
    const cycle = getCycle(state, cycleId);
    const goalDeadlineDayKey = normalizeDayKey(
      cycle?.goalContract?.deadline?.dayKey ||
        cycle?.goalContract?.deadlineISO ||
        contract?.deadline?.dayKey ||
        contract?.deadlineISO ||
        contract?.deadline ||
        null,
      timeZone
    );
    const resolvedStartDateISO =
      startDateISO || state?.appTime?.activeDayKey || state?.today?.date || defaults.todayKey || null;
    const normalizedStartDayKey = normalizeDayKey(resolvedStartDateISO, timeZone);
    if (!goalDeadlineDayKey || !normalizedStartDayKey) {
      return [];
    }

    // FULL_PLAN: include the entire action spine as calendar markers (including completed).
    // Do not filter out already scheduled action IDs in this mode.
    const completedActionIds = new Set(
      (resolvedActions || [])
        .filter((action) => action?.state === 'completed' || action?.status === 'completed')
        .map((action) => action.id)
    );
    const planningMetadataById = new Map(
      buildPlanningActionCandidates(resolvedActions).map((action) => [action.id, action])
    );
    const milestones = collectMilestonesForPlanning(cycle, contract, state);
    const eligibleWeekdays = resolveEligibleWeekdays(cycle?.goalContract || null);
    const slotDurationMin = Number(defaults.routeMinutes) || 30;
    const maxScheduledMinutesPerDay = Number(state?.constraints?.maxScheduledMinutesPerDay);
    const maxScheduledMinutesPerWeek = Number(state?.constraints?.maxScheduledMinutesPerWeek);
    const hasCapacityCaps = Number.isFinite(maxScheduledMinutesPerDay) || Number.isFinite(maxScheduledMinutesPerWeek);
    const milestoneContext = buildMilestonePriorityContext(milestones, resolvedActions || [], slotDurationMin);
    const milestoneCriticalContext = computeMilestoneCriticalContext(milestones, resolvedActions || []);
    const milestoneWindowConstraintMode = milestoneContext.hasMilestones ? (hasCapacityCaps ? 'hard' : 'soft') : null;
    const placementWindow = resolveFullPlanPlacementWindow({
      startDayKey: normalizedStartDayKey,
      goalDeadlineDayKey,
      milestones,
      fallbackDays: resolvedWindowDays,
      guardDays: defaults.fullPlanMaxHorizonDays || SPINE_HARD_CAP_DAYS,
      timeZone,
    });
    const placementEndDayKey = placementWindow.endDayKey || goalDeadlineDayKey;
    const criticalDepthMap = computeActionCriticalDepthMap(resolvedActions || []);
    const planningActions = [...(resolvedActions || [])].sort(
      hasCapacityCaps && milestoneContext.hasMilestones
        ? (lhs, rhs) =>
            compareActionsStrategic(lhs, rhs, {
              actionPriority: milestoneContext.actionPriority,
              criticalDepthMap,
            })
        : compareActions
    );
    const chunkDemand = planningActions.reduce((sum, action) => {
      const estimateMin = resolveActionEstimateMin(action, slotDurationMin);
      return sum + Math.max(1, Math.ceil(estimateMin / slotDurationMin));
    }, 0);
    const actionConstraintsById = new Map();
    if (milestoneContext.hasMilestones) {
      planningActions.forEach((action) => {
        const priority = milestoneContext.actionPriority.get(action?.id) || null;
        const critical = milestoneCriticalContext.criticalByActionId.get(action?.id) || null;
        const hasDirectMilestoneBinding = Boolean(
          priority?.hasMilestoneBinding &&
          priority?.milestoneId &&
          priority?.windowStartDayKey &&
          priority?.windowEndDayKey
        );
        const resolvedMilestoneId =
          (hasDirectMilestoneBinding ? priority?.milestoneId : null) || critical?.milestoneId || null;
        const resolvedWindowStartDayKey =
          (hasDirectMilestoneBinding ? priority?.windowStartDayKey : null) || critical?.windowStartDayKey || null;
        const resolvedWindowEndDayKey =
          (hasDirectMilestoneBinding ? priority?.windowEndDayKey : null) || critical?.windowEndDayKey || null;
        if (!hasDirectMilestoneBinding && !critical?.isMilestoneCritical) return;
        actionConstraintsById.set(action.id, {
          hasMilestoneBinding: hasDirectMilestoneBinding,
          isMilestoneCritical: Boolean(critical?.isMilestoneCritical),
          milestoneId: resolvedMilestoneId,
          windowStartDayKey: resolvedWindowStartDayKey,
          windowEndDayKey: resolvedWindowEndDayKey,
          constraintMode: milestoneWindowConstraintMode,
        });
      });
    }
    const rawExecutionHorizonDays = Number(
      defaults.executionHorizonDays ?? state?.planDraft?.executionHorizonDays ?? 90
    );
    const resolvedExecutionHorizonDays = Number.isFinite(rawExecutionHorizonDays)
      ? Math.max(1, Math.round(rawExecutionHorizonDays))
      : 90;
    const requestedExecutionEndDayKey = addDays(
      normalizedStartDayKey,
      Math.max(0, resolvedExecutionHorizonDays - 1),
      timeZone
    );
    const executionEndDayKey =
      requestedExecutionEndDayKey < placementEndDayKey ? requestedExecutionEndDayKey : placementEndDayKey;

    const feasibilitySelectedSlots = buildEvenlySpacedSlots(chunkDemand, normalizedStartDayKey, placementEndDayKey, {
      timeZone,
      slotStartMin: 9 * 60,
      slotDurationMin,
      eligibleWeekdays,
      maxBlocksPerDay: MAX_BLOCKS_PER_DAY,
      selectionMode: hasCapacityCaps ? 'target_count' : 'all_candidates',
    });
    const feasibilityCandidateSlots = hasCapacityCaps
      ? buildEvenlySpacedSlots(chunkDemand, normalizedStartDayKey, placementEndDayKey, {
          timeZone,
          slotStartMin: 9 * 60,
          slotDurationMin,
          eligibleWeekdays,
          maxBlocksPerDay: MAX_BLOCKS_PER_DAY,
          selectionMode: 'all_candidates',
        })
      : feasibilitySelectedSlots;
    const executionSelectedSlots = buildEvenlySpacedSlots(chunkDemand, normalizedStartDayKey, executionEndDayKey, {
      timeZone,
      slotStartMin: 9 * 60,
      slotDurationMin,
      eligibleWeekdays,
      maxBlocksPerDay: MAX_BLOCKS_PER_DAY,
      selectionMode: hasCapacityCaps ? 'target_count' : 'all_candidates',
    });
    const executionCandidateSlots = hasCapacityCaps
      ? buildEvenlySpacedSlots(chunkDemand, normalizedStartDayKey, executionEndDayKey, {
          timeZone,
          slotStartMin: 9 * 60,
          slotDurationMin,
          eligibleWeekdays,
          maxBlocksPerDay: MAX_BLOCKS_PER_DAY,
          selectionMode: 'all_candidates',
        })
      : executionSelectedSlots;

    const feasibilitySlots = hasCapacityCaps
      ? filterSlotsByCapacityCaps(feasibilitySelectedSlots, {
          maxScheduledMinutesPerDay,
          maxScheduledMinutesPerWeek,
        }).slots
      : feasibilitySelectedSlots;
    const executionSlots = hasCapacityCaps
      ? filterSlotsByCapacityCaps(executionSelectedSlots, {
          maxScheduledMinutesPerDay,
          maxScheduledMinutesPerWeek,
        }).slots
      : executionSelectedSlots;

    const defaultDependencyBufferMinutes = Number(state?.dependencies?.defaultBufferMinutes || 0);
    const assignmentFeasibility = assignActionChunksToSlots(
      planningActions,
      feasibilitySlots,
      slotDurationMin,
      slotDurationMin,
      {
        actionConstraintsById,
        dependencyBufferMinutes: defaultDependencyBufferMinutes,
      }
    );
    const strategicComparator =
      hasCapacityCaps && milestoneContext.hasMilestones
        ? (lhs, rhs) =>
            compareActionsStrategic(lhs, rhs, {
              actionPriority: milestoneContext.actionPriority,
              criticalDepthMap,
            })
        : compareActions;
    const stickyExecution = buildStickyExecutionAssignments({
      state,
      cycleId,
      planningActions,
      executionSlots,
      actionConstraintsById,
      dependencyBufferMinutes: defaultDependencyBufferMinutes,
      slotDurationMin,
      maxScheduledMinutesPerDay,
      maxScheduledMinutesPerWeek,
      executionStartDayKey: normalizedStartDayKey,
      executionEndDayKey,
      strategicComparator,
    });
    let assignmentExecution = stickyExecution.assignment;
    const stickyStats = stickyExecution.stickyStats;

    const qualityScoreInputs = {
      actionGraph: { actions: planningActions },
      constraints: {
        maxScheduledMinutesPerDay,
        maxScheduledMinutesPerWeek,
        executionHorizonDays: resolvedExecutionHorizonDays,
      },
      horizons: {
        executionWindowStartDayKey: normalizedStartDayKey,
        executionWindowEndDayKey: executionEndDayKey,
        feasibilityWindowEndDayKey: placementEndDayKey,
      },
      milestones: (milestones || []).map((milestone) => ({
        milestoneId: milestone?.id || '',
        windowStartDayKey: milestone?.windowStartDayKey,
        windowEndDayKey: milestone?.windowEndDayKey,
        checkpointActionIds: Array.isArray(milestone?.checkpointActionIds) ? milestone.checkpointActionIds : [],
        actionIds: Array.isArray(milestone?.actionIds) ? milestone.actionIds : [],
      })),
    };
    const baselineScoreAssignments = toScoreAssignments(assignmentExecution.assignments || []);
    let qualityScoreBaseline = scoreSchedule({
      ...qualityScoreInputs,
      assignments: baselineScoreAssignments,
      metricsContext: buildQualityMetricsContext({
        unplacedEstimateMinTotal: (assignmentFeasibility.unassignedActions || []).reduce(
          (sum, action) => sum + resolveActionEstimateMin(action, slotDurationMin),
          0
        ),
        outsideExecutionHorizonEstimateMinTotal: 0,
        outsideExecutionHorizonCount: 0,
      }),
    });
    const optimizerEnabled = Boolean(state?.planDraft?.enableQualityOptimizer);
    let qualityScoreOptimized = qualityScoreBaseline;
    let qualityImprovementDelta = 0;
    let chosenMovesSummary = { iterations: 0, candidatesEvaluated: 0, moves: [] };
    if (optimizerEnabled) {
      const optimized = optimizeSchedule({
        baselineAssignments: baselineScoreAssignments,
        frozenReservations: (assignmentExecution.assignments || [])
          .filter((row) => Boolean(row?.stickyPreserved))
          .map((row) => ({
            actionId: row?.action?.id,
            chunkIndex: Number(row?.chunkIndex || 0),
          }))
          .filter((row) => Boolean(row.actionId)),
        actionGraph: qualityScoreInputs.actionGraph,
        constraints: qualityScoreInputs.constraints,
        horizons: qualityScoreInputs.horizons,
        milestones: qualityScoreInputs.milestones,
        metricsContext: buildQualityMetricsContext({
          unplacedEstimateMinTotal: (assignmentFeasibility.unassignedActions || []).reduce(
            (sum, action) => sum + resolveActionEstimateMin(action, slotDurationMin),
            0
          ),
          outsideExecutionHorizonEstimateMinTotal: 0,
          outsideExecutionHorizonCount: 0,
        }),
        actionConstraintsById,
        dependencyBufferMinutes: defaultDependencyBufferMinutes,
        maxIterations: Number(state?.planDraft?.optimizerMaxIterations || 2),
        maxCandidatesPerIter: Number(state?.planDraft?.optimizerMaxCandidates || 30),
      });
      if (optimized.bestAssignments?.length) {
        assignmentExecution = {
          ...assignmentExecution,
          assignments: applyOptimizedAssignmentsToRows(
            assignmentExecution.assignments || [],
            optimized.bestAssignments || []
          ),
        };
      }
      qualityScoreOptimized = optimized.bestScore;
      qualityImprovementDelta = Number(optimized.improvement?.deltaTotal || 0);
      chosenMovesSummary = optimized.chosenMovesSummary || chosenMovesSummary;
    }

    const feasibilityPlacedActionIds = new Set(
      (assignmentFeasibility.assignments || []).map((row) => row?.action?.id).filter(Boolean)
    );
    const executionPlacedActionIds = new Set(
      (assignmentExecution.assignments || []).map((row) => row?.action?.id).filter(Boolean)
    );
    const outsideExecutionHorizonActionIds = Array.from(feasibilityPlacedActionIds).filter(
      (actionId) => !executionPlacedActionIds.has(actionId)
    );
    const outsideExecutionHorizonEstimateMinTotal = outsideExecutionHorizonActionIds.reduce((sum, actionId) => {
      const action = planningActions.find((candidate) => candidate?.id === actionId);
      return sum + resolveActionEstimateMin(action, slotDurationMin);
    }, 0);

    const unplacedEstimateMinTotal = (assignmentFeasibility.unassignedActions || []).reduce(
      (sum, action) => sum + resolveActionEstimateMin(action, slotDurationMin),
      0
    );
    const unplacedEstimateMinByCategory = (assignmentFeasibility.unassignedActions || []).reduce((acc, action) => {
      const categoryKey = normalizeCategoryKey(action?.category || action?.domain);
      const estimateMin = resolveActionEstimateMin(action, slotDurationMin);
      acc[categoryKey] = (acc[categoryKey] || 0) + estimateMin;
      return acc;
    }, {});
    qualityScoreBaseline = scoreSchedule({
      ...qualityScoreInputs,
      assignments: baselineScoreAssignments,
      metricsContext: buildQualityMetricsContext({
        unplacedEstimateMinTotal,
        outsideExecutionHorizonEstimateMinTotal,
        outsideExecutionHorizonCount: outsideExecutionHorizonActionIds.length,
      }),
    });
    qualityScoreOptimized = scoreSchedule({
      ...qualityScoreInputs,
      assignments: toScoreAssignments(assignmentExecution.assignments || []),
      metricsContext: buildQualityMetricsContext({
        unplacedEstimateMinTotal,
        outsideExecutionHorizonEstimateMinTotal,
        outsideExecutionHorizonCount: outsideExecutionHorizonActionIds.length,
      }),
    });
    if (optimizerEnabled) {
      qualityImprovementDelta = Number((qualityScoreOptimized.total - qualityScoreBaseline.total).toFixed(6));
    } else {
      qualityImprovementDelta = 0;
    }
    const depWindowBlockedByMilestone = {};
    const depBufferBlockedByMilestone = {};
    Object.entries(assignmentFeasibility.unassignedActionReasons || {}).forEach(([actionId, reason]) => {
      if (reason !== 'DEP_NOT_READY_IN_WINDOW') return;
      const milestoneId =
        actionConstraintsById.get(actionId)?.milestoneId ||
        milestoneContext.actionPriority.get(actionId)?.milestoneId ||
        null;
      const key = milestoneId || 'UNKNOWN';
      depWindowBlockedByMilestone[key] = (depWindowBlockedByMilestone[key] || 0) + 1;
    });
    Object.entries(assignmentFeasibility.unassignedActionReasons || {}).forEach(([actionId, reason]) => {
      if (reason !== 'DEP_NOT_READY_IN_WINDOW' && reason !== 'DEPENDENCY_NOT_READY') return;
      const milestoneId =
        actionConstraintsById.get(actionId)?.milestoneId ||
        milestoneContext.actionPriority.get(actionId)?.milestoneId ||
        null;
      const key = milestoneId || 'UNKNOWN';
      depBufferBlockedByMilestone[key] = (depBufferBlockedByMilestone[key] || 0) + 1;
    });

    const feasibilityReasons = Object.values(assignmentFeasibility.unassignedActionReasons || {});
    const placementReasonCode = feasibilityReasons.includes('MILESTONE_WINDOW_NO_SLOT')
      ? 'MILESTONE_WINDOW_NO_SLOT'
      : feasibilityReasons.includes('DEP_NOT_READY_IN_WINDOW')
        ? 'DEP_NOT_READY_IN_WINDOW'
        : feasibilityReasons.includes('DEPENDENCY_NOT_READY')
          ? 'DEPENDENCY_NOT_READY'
          : hasCapacityCaps && (assignmentFeasibility.unassignedActions || []).length > 0
            ? 'CAPACITY_BOUND_UNPLACED'
            : outsideExecutionHorizonActionIds.length > 0
              ? 'OUTSIDE_EXECUTION_HORIZON'
              : 'FULL_PLAN_PLACED_TO_DEADLINE';

    const placementStats = {
      availableSlots: executionSlots.length,
      requiredSlotsWeighted: assignmentExecution.requiredSlots,
      missingSlotsWeighted: assignmentExecution.missingSlots,
      unusedSlots: assignmentExecution.unusedSlots,
      unassignedActionReasons: assignmentFeasibility.unassignedActionReasons || {},
      milestoneWindowMissCountPlacement: Object.values(assignmentFeasibility.unassignedActionReasons || {}).filter(
        (code) => code === 'MILESTONE_WINDOW_NO_SLOT' || code === 'DEP_NOT_READY_IN_WINDOW'
      ).length,
      depWindowBlockedCount: Object.values(assignmentFeasibility.unassignedActionReasons || {}).filter(
        (code) => code === 'DEP_NOT_READY_IN_WINDOW'
      ).length,
      depBufferBlockedCount: Object.values(assignmentFeasibility.unassignedActionReasons || {}).filter(
        (code) => code === 'DEP_NOT_READY_IN_WINDOW' || code === 'DEPENDENCY_NOT_READY'
      ).length,
      depWindowBlockedByMilestone,
      depBufferBlockedByMilestone,
      outsideExecutionHorizonCount: outsideExecutionHorizonActionIds.length,
      outsideExecutionHorizonEstimateMinTotal,
      executionHorizonDays: resolvedExecutionHorizonDays,
      executionWindowStartISO: normalizedStartDayKey ? `${normalizedStartDayKey}T00:00:00.000Z` : null,
      executionWindowEndISO: executionEndDayKey ? `${executionEndDayKey}T23:59:59.000Z` : null,
      feasibilityWindowStartISO: normalizedStartDayKey ? `${normalizedStartDayKey}T00:00:00.000Z` : null,
      feasibilityWindowEndISO: placementEndDayKey ? `${placementEndDayKey}T23:59:59.000Z` : null,
      slotUniverseMode: hasCapacityCaps ? 'EVEN_SPREAD' : 'FULL_CANDIDATE',
      slotUniverseCandidateCount: feasibilityCandidateSlots.length,
      slotUniverseSelectedCount: feasibilitySelectedSlots.length,
      unplacedEstimateMinTotal,
      unplacedEstimateMinByCategory,
      milestonePrioritySummary: milestoneContext.milestonePrioritySummary,
      placementHorizonEndISO: placementEndDayKey ? `${placementEndDayKey}T23:59:59.000Z` : null,
      placementHorizonRequestedEndISO: placementWindow.requestedEndDayKey
        ? `${placementWindow.requestedEndDayKey}T23:59:59.000Z`
        : null,
      placementHorizonGuardedEndISO: placementEndDayKey ? `${placementEndDayKey}T23:59:59.000Z` : null,
      placementHorizonGuardApplied: Boolean(placementWindow.guardApplied),
      placementHorizonGuardDays: placementWindow.guardDays,
      placementHorizonDays: placementWindow.horizonDays,
      placementWindowStartISO: normalizedStartDayKey ? `${normalizedStartDayKey}T00:00:00.000Z` : null,
      placementWindowEndISO: placementEndDayKey ? `${placementEndDayKey}T23:59:59.000Z` : null,
      milestoneWindowConstraintMode,
      horizonMode: placementWindow.horizonMode,
      softWindowFallbackCount: assignmentExecution.softWindowFallbackCount || 0,
      reservationInputCount: stickyStats?.reservationInputCount || 0,
      reservationAcceptedPass1Count: stickyStats?.reservationAcceptedPass1Count || 0,
      reservationPendingDepValidationCount: stickyStats?.reservationPendingDepValidationCount || 0,
      reservationRejectedCount: stickyStats?.reservationRejectedCount || 0,
      orphanReservationCount: stickyStats?.orphanReservationCount || 0,
      preservedChunkCount: stickyStats?.preservedChunkCount || 0,
      movedChunkCount: stickyStats?.movedChunkCount || 0,
      droppedChunkCount: stickyStats?.droppedChunkCount || 0,
      churnMovedMinutesTotal: stickyStats?.churnMovedMinutesTotal || 0,
      churnReasonsCount: stickyStats?.churnReasonsCount || {},
      rescheduleDecisions: stickyStats?.rescheduleDecisions || [],
      reasonCode: placementReasonCode,
      qualityScoreBaseline,
      qualityScoreOptimized,
      qualityImprovementDelta,
      chosenMovesSummary,
    };
    if (typeof captureStats === 'function') {
      captureStats(placementStats);
    }
    const goalId = cycle?.goalContract?.goalId || cycle?.goalGovernanceContract?.goalId || state?.activeGoalId || null;
    const fullPlanItems = assignmentExecution.assignments
      .map(({ action, slot, chunkIndex, chunkCount, allocatedMin, estimateMin }) => {
        const planningMeta = planningMetadataById.get(action.id) || action;
        const isCompleted = completedActionIds.has(action.id);
        const blocked = Boolean(!isCompleted && FULL_PLAN_PLACE_BLOCKED && planningMeta?.blocked);
        const unmetDepIds = isCompleted ? [] : planningMeta?.unmetDepIds || [];
        const unmetDepTitles = isCompleted ? [] : planningMeta?.unmetDepTitles || [];
        const dateISO = slot.dateISO || slot.dayKey;
        const startMin = Number.isFinite(slot.startMin)
          ? slot.startMin
          : minutesFromISO(slot.startISO || ensureISO(dateISO, '09:00')) || 9 * 60;
        const durationMin = Math.max(1, Number(allocatedMin) || Number(slot.minutes) || 30);
        const endMin = startMin + durationMin;
        const startISO = slot.startISO || ensureISO(dateISO, formatMinutes(startMin));
        const endISO = new Date(Date.parse(startISO) + durationMin * 60000).toISOString();
        return {
          id: `draft:${cycleId}:${action.id}:${dateISO}:${startMin}:chunk:${chunkIndex}`,
          source: 'FULL_PLAN',
          requiresActionContext: true,
          cycleId,
          goalId,
          dateISO,
          startMin,
          endMin,
          durationMin,
          dayKey: dateISO,
          startISO,
          endISO,
          minutes: durationMin,
          domainKey: action?.category?.toUpperCase() || defaults.primaryDomain || 'FOCUS',
          category: action?.category || defaults.primaryDomain || 'Focus',
          actionId: action.id,
          title: action.title,
          detail: action.detail || action.brief || '',
          blocked,
          completedMarker: isCompleted,
          state: isCompleted ? 'completed' : 'scheduled',
          unmetDepIds,
          unmetDepTitles,
          chunkIndex,
          chunkCount,
          estimateMin,
          allocatedMin: durationMin,
          meta: {
            blocked,
            completedMarker: isCompleted,
            state: isCompleted ? 'completed' : 'scheduled',
            unmetDepIds,
            unmetDepTitles,
            blockReason: blocked ? 'DEPS_UNMET' : null,
            estimateMin,
            allocatedMin: durationMin,
            chunkIndex,
            chunkCount,
          },
          reason: 'Forecast',
          payload: {
            dayKey: dateISO,
            deliverableId: null,
            actionId: action.id,
            blocked,
            completedMarker: isCompleted,
            state: isCompleted ? 'completed' : 'scheduled',
            unmetDepIds,
            unmetDepTitles,
            blockReason: blocked ? 'DEPS_UNMET' : null,
            estimateMin,
            allocatedMin: durationMin,
            chunkIndex,
            chunkCount,
          },
        };
      })
      .filter((item) => keepAutomationItem(item));
    return sortDraftItems(fullPlanItems);
  }

  if (contract?.planGenerationMechanismClass === 'GENERIC_DETERMINISTIC') {
    const compiled = compileStrategicPlan_OUTPUT(contract);
    if (compiled?.ok && compiled.plan) {
      const scheduled = scheduleStrategicPlanToDraftBlocks(compiled.plan, contract, timeZone);
      if (scheduled?.ok && scheduled.blocks?.length) {
        let actionCursor = 0;
        const strategicItems = scheduled.blocks.map((block) => {
          const linkedAction = actionCandidates[actionCursor] || null;
          if (linkedAction) actionCursor += 1;
          return {
            id: `plan:${block.id}`,
            source: 'strategicPlan',
            requiresActionContext: true,
            dayKey: block.dayKey,
            startISO: block.startISO,
            minutes: block.minutes,
            domainKey:
              linkedAction?.category?.toUpperCase() || contract?.domainPrimary || contract?.primaryDomain || 'FOCUS',
            category: linkedAction?.category || contract?.domainPrimary || contract?.primaryDomain || 'Focus',
            actionId: linkedAction?.id || null,
            title: linkedAction?.title || block.title,
            detail: linkedAction?.brief || block.advances || '',
            reason: 'Strategic plan',
            payload: block,
          };
        });
        return sortDraftItems(strategicItems.filter((item) => keepAutomationItem(item)));
      }
    }
  }
  const startDayKey = contractStartDayKeyOverride || getContractStartDayKey(contract, timeZone);
  const normalizedSuggested = filterSuggestionsByStartDayKey(suggestedBlocks, startDayKey, timeZone);
  let actionCursor = 0;
  const items = [];

  normalizedSuggested.forEach((suggestion) => {
    const linkedAction = suggestion?.actionId
      ? actionCandidates.find((action) => action.id === suggestion.actionId) || null
      : actionCandidates[actionCursor] || null;
    if (!suggestion?.actionId && linkedAction) actionCursor += 1;
    const dayKey = normalizeSuggestionDayKey(suggestion, timeZone) || defaults.todayKey || '';
    const startISO = suggestion.startISO || suggestion.start || ensureISO(dayKey, '09:00') || `${dayKey}T09:00:00.000Z`;
    const minutes = Number(suggestion.durationMinutes) || Number(suggestion.minutes) || 30;
    const title = suggestion.title || linkedAction?.title || suggestion.label || 'Suggested block';
    items.push({
      id: `suggested:${suggestion.id || `${dayKey}-${title}`}`,
      source: 'suggestedPath',
      requiresActionContext: true,
      dayKey,
      startISO,
      minutes,
      domainKey: linkedAction?.category?.toUpperCase() || suggestion.domain || 'FOCUS',
      category: linkedAction?.category || suggestion.domain || 'Focus',
      actionId: suggestion.actionId || linkedAction?.id || null,
      title,
      detail: suggestion.detail || linkedAction?.brief || suggestion.description || '',
      reason: 'Suggested path',
      payload: { ...suggestion, actionId: suggestion.actionId || linkedAction?.id || null },
    });
  });

  const deliverableTitleById = new Map(
    (resolvedDeliverables || []).filter(Boolean).map((d) => [d.id, d.title || d.id])
  );
  const baseStartMinutes = 9 * 60;
  const routeMinutes = defaults.routeMinutes || 30;
  const buildRouteItemsForDay = (entry) => {
    const dayKey = entry?.dayKey || defaults.todayKey || '';
    const byDeliverable = entry?.byDeliverable || {};
    const total = Number(entry?.totalBlocks) || 0;
    if (!dayKey || total <= 0) return [];
    const orderedIds = [
      ...deliverableTitleById.keys(),
      ...Object.keys(byDeliverable || {}).filter((id) => !deliverableTitleById.has(id)),
    ];
    const counts = orderedIds
      .map((id) => ({ id, count: Number(byDeliverable?.[id] || 0) }))
      .filter((entryCount) => entryCount.count > 0);
    const resolvedCounts = counts.length ? counts : [{ id: null, count: total }];
    const items = [];
    let slotIndex = 0;
    resolvedCounts.forEach(({ id, count }) => {
      const baseTitle = id ? deliverableTitleById.get(id) : null;
      for (let i = 0; i < count; i += 1) {
        const action = actionCandidates[actionCursor] || null;
        if (action) actionCursor += 1;
        const timeStr = formatMinutes(baseStartMinutes + slotIndex * routeMinutes);
        const title = action?.title || baseTitle || entry?.summary || 'Missing action context';
        const suffix = count > 1 ? ` (${i + 1}/${count})` : '';
        items.push({
          id: `route:${dayKey}:${id || 'deliverable'}:${i + 1}:${action?.id || 'legacy'}`,
          source: 'coldPlan',
          requiresActionContext: true,
          dayKey,
          startISO: ensureISO(dayKey, timeStr),
          minutes: routeMinutes,
          domainKey: action?.category?.toUpperCase() || defaults.primaryDomain || 'FOCUS',
          category: action?.category || defaults.primaryDomain || 'Focus',
          actionId: action?.id || null,
          title: `${title}${suffix}`,
          detail: action?.brief || (baseTitle ? `Deliverable: ${baseTitle}` : entry?.summary || ''),
          reason: 'Forecast',
          payload: { ...entry, deliverableId: id || null, actionId: action?.id || null },
        });
        slotIndex += 1;
      }
    });
    return items;
  };

  let effectiveRouteSuggestions = routeSuggestions;
  let deliverableCovered = Boolean(resolvedBoundary?.kind === 'DELIVERABLE' && resolvedBoundary?.covered);
  let route = routeSuggestions.flatMap((entry) => buildRouteItemsForDay(entry));
  let routeWindowDays = resolvedWindowDays;
  let routeSlotsCount = route.reduce((sum, item) => sum + (item?.source === 'coldPlan' ? 1 : 0), 0);

  if (state && cycleId) {
    const routeWindow = buildRouteSlotsUntilBoundary(state, cycleId, {
      boundaryEndISO: resolvedBoundary?.boundaryEndISO || resolvedBoundary?.deadlineISO,
      startDateISO: startDateISO || startDayKey || defaults.todayKey,
      routeMinutes,
      timeZone,
      existingDraftItems: items,
    });
    const routeSlots = routeWindow.slots || [];
    routeWindowDays = routeWindow.daysCovered || resolvedWindowDays;
    routeSlotsCount = routeWindow.routeSlotsCount || 0;
    effectiveRouteSuggestions = buildRouteSuggestionsFromSlots(routeSlots);
    const boundaryActions = selectActionsForBoundary(state, cycleId, resolvedBoundary);
    const readyById = new Set(buildReadyActionCandidates(resolvedActions).map((action) => action.id));
    const existingScheduledActionIds = getScheduledActionIds(state, cycleId);
    const planningActions = buildPlanningActionCandidates(resolvedActions);
    const planningById = new Map(planningActions.map((action) => [action.id, action]));
    const targetActions = (boundaryActions || []).filter(
      (action) => !isDoneLike(action?.status) && !isSkippedLike(action?.status)
    );
    const uncoveredTargetActions = targetActions.filter((action) => !existingScheduledActionIds.has(action.id));
    if (resolvedBoundary?.kind === 'DELIVERABLE' && uncoveredTargetActions.length === 0) {
      deliverableCovered = true;
    }
    const queue =
      scheduleMode === 'FULL_PLAN'
        ? uncoveredTargetActions.map((action) => planningById.get(action.id) || action).sort(compareActions)
        : uncoveredTargetActions.filter((action) => readyById.has(action.id)).sort(compareActions);
    route = [];
    const emittedActionIds = new Set();
    for (const slot of routeSlots) {
      const nextAction = queue.find((action) => !emittedActionIds.has(action.id));
      if (!nextAction) break;
      emittedActionIds.add(nextAction.id);
      const blocked = Boolean(
        FULL_PLAN_PLACE_BLOCKED &&
        (nextAction?.blocked || (scheduleMode !== 'FULL_PLAN' ? false : !readyById.has(nextAction.id)))
      );
      const unmetDepIds = nextAction?.unmetDepIds || [];
      const unmetDepTitles = nextAction?.unmetDepTitles || [];
      route.push({
        id: `route:${slot.dayKey}:${slot.slotIndex + 1}:${nextAction.id}`,
        source: 'coldPlan',
        requiresActionContext: true,
        dayKey: slot.dayKey,
        startISO: slot.startISO,
        minutes: slot.minutes,
        domainKey: nextAction?.category?.toUpperCase() || defaults.primaryDomain || 'FOCUS',
        category: nextAction?.category || defaults.primaryDomain || 'Focus',
        actionId: nextAction.id,
        title: nextAction.title,
        detail: nextAction.detail || nextAction.brief || '',
        blocked,
        unmetDepIds,
        unmetDepTitles,
        meta: {
          blocked,
          unmetDepIds,
          unmetDepTitles,
          blockReason: blocked ? 'DEPS_UNMET' : null,
        },
        reason: 'Forecast',
        payload: {
          dayKey: slot.dayKey,
          deliverableId: slot.deliverableId || resolvedBoundary?.deliverableId || null,
          actionId: nextAction.id,
          blocked,
          unmetDepIds,
          unmetDepTitles,
          blockReason: blocked ? 'DEPS_UNMET' : null,
        },
      });
      if (resolvedBoundary?.kind === 'DELIVERABLE') {
        const coveredCount = targetActions.filter(
          (action) => existingScheduledActionIds.has(action.id) || emittedActionIds.has(action.id)
        ).length;
        if (coveredCount >= targetActions.length) break;
      }
    }
  }

  const merged = sortDraftItems([...items, ...route]);
  const normalized = normalizeDraftTimes(merged, defaults);
  const contextFiltered = normalized.filter((item) => keepAutomationItem(item));
  const fullDraftItems = contextFiltered;
  const diagnostics = getDraftDiagnostics({
    state,
    cycleId,
    routeSuggestions: effectiveRouteSuggestions,
    actions: resolvedActions,
    draftItems: contextFiltered,
    fullDraftItems,
    boundaryKind: resolvedBoundary?.kind || 'HORIZON_FALLBACK',
    boundaryLabel: resolvedBoundary?.label || `Next ${resolvedWindowDays} days`,
    boundaryDeadlineISO: resolvedBoundary?.deadlineISO || resolvedBoundary?.boundaryEndISO || null,
    boundaryEndISO: resolvedBoundary?.boundaryEndISO || resolvedBoundary?.deadlineISO || null,
    routeSlotWindowDays: routeWindowDays,
    routeSlotsCount:
      routeSlotsCount ||
      (effectiveRouteSuggestions || []).reduce((sum, entry) => sum + Math.max(0, Number(entry?.totalBlocks) || 0), 0),
    deliverableCovered,
    graphInvalid: state?.lastPlanError?.code === 'ACTION_GRAPH_INVALID',
    noActionPlan: resolvedActions.length <= 0,
    scheduleMode,
  });
  if (
    process.env.NODE_ENV !== 'production' &&
    (diagnostics.droppedForMissingContext > 0 ||
      diagnostics.emittedAutomationSlots < diagnostics.requestedAutomationSlots)
  ) {
    console.warn('Dropping automation draft items missing action context', {
      cycleId: cycleId || null,
      actionCount: diagnostics.actionCount,
      boundaryKind: diagnostics.boundaryKind,
      boundaryLabel: diagnostics.boundaryLabel,
      routeSlotsCount: diagnostics.routeSlotsCount,
      readyActionsCount: diagnostics.readyActionsCount,
      requestedSlots: diagnostics.requestedAutomationSlots,
      emittedSlots: diagnostics.emittedAutomationSlots,
      droppedForMissingContext: diagnostics.droppedForMissingContext,
    });
  }
  if (!startDayKey && !contract?.deadline?.dayKey) return contextFiltered;
  return contextFiltered.filter((item) => {
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

export function hasActionPlan(cycleId, actionsByCycleId = {}, cyclesById = {}) {
  if (!cycleId) return false;
  const workspaceActions = actionsByCycleId?.[cycleId]?.actions || [];
  if (workspaceActions.length > 0) return true;
  const cycleActions = cyclesById?.[cycleId]?.actions || [];
  return cycleActions.length > 0;
}

export function hasStaleForecast(cycleId, forecastItems = [], _actionsByCycleId = {}, _cyclesById = {}) {
  return (forecastItems || []).some(
    (item) => isAutomationScheduleItem(item) && (!item?.actionId || !item?.title || !item?.detail)
  );
}
