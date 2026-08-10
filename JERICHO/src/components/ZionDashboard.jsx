import React, { useEffect, useMemo, useState } from 'react';
import MasterPlanTimeline from '../ui/masterPlan/MasterPlanTimeline.jsx';
import BlockColumn from './zion/BlockColumn.jsx';
import PlanningPanel from './zion/PlanningPanel.jsx';
import BlockDetailsPanel from './zion/BlockDetailsPanel.jsx';
import Workspace from './zion/Workspace.jsx';
import AssistantPanel from './zion/AssistantPanel.jsx';
import DiagnosticsPanel from './DiagnosticsPanel.jsx';
import MissionSetupFlow from './zion/MissionSetupFlow.jsx';
import HorizonResolutionPanel from './zion/HorizonResolutionPanel.jsx';
import DailyCheckInPanel from './zion/DailyCheckInPanel.jsx';
import { StructurePageConsolidated } from './zion/StructurePageConsolidated.jsx';
import { MasterGridTab } from './zion/MasterGridTab.jsx';
import { filterCalendarBlocksByScope, availableBlockScopes, BLOCK_SCOPE_KINDS } from '../domain/masterGrid/filterCalendarBlocksByScope.js';
import { CalendarScopeToggle } from './zion/CalendarScopeToggle.jsx';
import CalendarSourceCutoverControl from './zion/CalendarSourceCutoverControl.jsx';
import { resolveCommittedCalendarSource, describeCalendarSource } from '../domain/masterGrid/calendarSourceCutover.js';
import { isRuntimeEnvFlagEnabled } from '../utils/runtimeEnv.js';
import { CapacityConfirmPanel } from './zion/CapacityConfirmPanel.jsx';
import CycleTransitionModal from './zion/CycleTransitionModal.jsx';
import ProfileHistoryMenu from './zion/ProfileHistoryMenu.jsx';
import ProductStateBanner from './product/ProductStateBanner.jsx';
import { REDUCE_UI } from '../ui/reduceUIConfig.js';
import ZionWeekView from './zion/views/ZionWeekView.jsx';
import ZionMonthView from './zion/views/ZionMonthView.jsx';
import ZionQuarterView from './zion/views/ZionQuarterView.jsx';
import ZionYearView from './zion/views/ZionYearView.jsx';
import { useIdentityStore } from '../state/identityStore.js';
import {
  computeStability,
  getAllBlocks,
  isCanonicalBlankState,
  projectMonthDays,
  resolveFirstCycleScheduleStart,
} from '../state/identityCompute.js';
import { computeDayMetricsMap, normalizeBlocks } from '../state/metrics.js';
import { materializeBlocksFromEvents } from '../state/engine/todayAuthority.ts';
import { localStartFromDayAndTime } from './zion/timeUtils.js';
import { addDays, APP_TIME_ZONE, dayKeyFromISO, isValidISO, assertValidISO, nowDayKey } from '../state/time/time.ts';
import { formatProbabilityWindowLabel, getProbabilityWindowSpec } from '../state/engine/probabilityWindow.ts';
import { projectCyclesIndex } from '../state/engine/cycleIndex.ts';
import { deriveWhatMovedToday } from '../state/whatMovedToday.ts';
import {
  getCanonicalCycleContract,
  getCanonicalCycleDeliverables,
  getCanonicalProposedBlocks,
} from '../state/cycleSelectors.js';
import { getContractStartDayKey, getContractDeadlineDayKey } from '../state/suggestionFilters.js';
import { buildConvergenceCandidateAdvisory } from '../state/convergenceCandidateAdvisory.js';
import { buildLegalFormationAdvisory } from '../state/legalFormationAdvisory.js';
import { traceAction, traceNoop } from '../dev/uiWiringTrace.ts';
import {
  buildWindowSpec,
  formatWindowLabel,
  getMonthDayKeys,
  getQuarterMonths,
  getWeekDayKeys,
  getYearMonths,
  shiftAnchorDayKey,
} from '../state/time/window.ts';
import { getDayStats, getMonthStats, getQuarterStats } from '../state/time/viewAggregates.ts';
import { buildStabilityEndToEndSummary } from '../state/contracts/stabilityEndToEndVerification';
import { deriveDailyCheckIn } from '../domain/live/dailyCheckIn.ts';
import { deriveMasterPlanPhaseModel } from '../domain/masterPlan/masterPlanPhaseModel.js';
import { resolveEffectiveExecutableStartDayKey } from '../domain/product/resolveEffectiveExecutableStartDayKey.js';
import { resolveOperatingLifecycleState } from '../domain/product/resolveOperatingLifecycleState.ts';

const DOMAIN_ENUM = ['BODY', 'RESOURCES', 'CREATION', 'FOCUS'];

const TAB_CONFIG = [
  { key: 'structure', label: 'Structure', tagline: 'Contract' },
  { key: 'today', label: 'Today', tagline: 'Execution' },
  { key: 'stability', label: 'Stability', tagline: 'Signals' },
  { key: 'plan', label: 'Master Plan', tagline: 'Horizon' },
  { key: 'mastergrid', label: 'Master Grid', tagline: 'Rollup' },
];
const ZION_VIEW_TABS = [
  { key: 'today', label: 'Today' },
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

const HORIZON_MODE_TABS = [
  { key: 'current_cycle', label: 'Sprint' },
  { key: '1_year', label: '1Y' },
  { key: '2_year', label: '2Y' },
  { key: '3_year', label: '3Y' },
  { key: '4_year', label: '4Y' },
  { key: '5_year', label: '5Y' },
  { key: 'full_horizon', label: 'Full' },
];
const FRICTION_EVENT_TYPE_OPTIONS = [
  'missed_work',
  'external_rejection',
  'unexpected_cost',
  'dependency_delay',
  'capacity_loss',
  'scope_growth',
  'quality_failure',
  'income_pressure',
];
const FRICTION_SEVERITY_OPTIONS = ['low', 'moderate', 'high'];

const LIVE_POS_REASON_LABELS = {
  LIVE_POS_WITHHELD_CANONICAL_TRUTH_THIN: 'Canonical execution truth is still too thin.',
  LIVE_POS_WITHHELD_EXECUTION_STATE_UNAVAILABLE: 'Execution-state evidence is not available yet.',
  LIVE_POS_WITHHELD_LINEAGE_INSUFFICIENT: 'Execution evidence is not linked cleanly enough to the plan.',
  LIVE_POS_WITHHELD_SCHEDULE_NOT_LIVE: 'The schedule is not live yet.',
  LIVE_POS_WITHHELD_UNLINKED_EVIDENCE_ONLY: 'Only unlinked execution evidence exists so far.',
  LIVE_POS_WITHHELD_UNTIL_ADMISSION: 'The goal is not admitted yet.',
  LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE: 'No linked execution evidence exists yet.',
  LIVE_POS_ACTIVATING_EVIDENCE_EARLY: 'Linked execution evidence is present, but still early.',
  LIVE_POS_STABLE_LINKED_EXECUTION_CONTINUITY: 'Linked execution continuity is stable across the live window.',
  LIVE_POS_AT_RISK_MISSED_EXECUTION_BURDEN: 'Missed execution burden is materially present.',
  LIVE_POS_AT_RISK_DRIFT_ACCUMULATING: 'Schedule drift is accumulating.',
  LIVE_POS_AT_RISK_EVIDENCE_THIN: 'Risk is visible, but evidence remains thin.',
  LIVE_POS_RECOVERING_AFTER_RISK: 'The goal is recovering after earlier risk.',
  LIVE_POS_RECOVERING_LINKED_RECOVERY_EVIDENCE: 'Linked recovery evidence is now present.',
  LIVE_POS_SCORE_WITHHELD: 'The live score is withheld until Live P.O.S. is available.',
  LIVE_POS_SCORE_ACTIVATING_RANGE: 'The score is in an early activating range.',
  LIVE_POS_SCORE_STABLE_CONTINUITY: 'The score reflects stable linked execution continuity.',
  LIVE_POS_SCORE_AT_RISK_RANGE: 'The score reflects at-risk execution conditions.',
  LIVE_POS_SCORE_RECOVERY_UPLIFT: 'The score includes bounded recovery uplift.',
  LIVE_POS_SCORE_CAPPED_EARLY_EVIDENCE: 'The score is capped because evidence is still early.',
  LIVE_POS_SCORE_CAPPED_RECOVERY_EARLY: 'The score is capped because recovery evidence is still early.',
  LIVE_POS_SCORE_EVIDENCE_DENSITY_THIN: 'Evidence density is still thin.',
  LIVE_POS_SCORE_EVIDENCE_DENSITY_STRONG: 'Evidence density is strong.',
};

function resolveDashboardViewFromHash(hashValue) {
  const currentHash = String(hashValue || '').trim();
  if (currentHash.startsWith('#/structure')) {
    return 'structure';
  }
  if (currentHash.startsWith('#/today')) {
    return 'today';
  }
  if (currentHash.startsWith('#/stability')) {
    return 'stability';
  }
  if (currentHash.startsWith('#/plan')) {
    return 'plan';
  }
  if (currentHash.startsWith('#/mastergrid')) {
    return 'mastergrid';
  }
  return null;
}

function resolveHashForDashboardView(view) {
  if (view === 'structure') {
    return '#/structure';
  }
  if (view === 'stability') {
    return '#/stability';
  }
  if (view === 'plan') {
    return '#/plan';
  }
  if (view === 'mastergrid') {
    return '#/mastergrid';
  }
  return '#/today';
}

const PLAN_QUALITY_REASON_LABELS = {
  LONG_HORIZON_TEMPORAL_COMPRESSION:
    'Long-horizon issue: scheduled work compresses into the opening part of the contract.',
  LONG_HORIZON_UNJUSTIFIED_TAIL_GAP:
    'Long-horizon issue: scheduled work leaves a large unexplained tail before the contract end.',
  LONG_HORIZON_SPARSE_CADENCE: 'Long-horizon issue: planned work is too thin for this commercial launch corridor.',
  LONG_HORIZON_WORK_GAPS: 'Long-horizon issue: scheduled work leaves repeated gaps between execution blocks.',
  COMMERCIAL_BLOCK_SPECIFICITY_WEAK:
    'Commercial launch issue: scheduled blocks repeat family shells instead of concrete operational sub-work.',
  COMMERCIAL_WORK_WINDOW_UNDERUSED:
    'Commercial launch issue: active weeks use too few workdays for this launch corridor.',
  TERMINAL_OBJECT_DRIFT: 'Semantic coverage issue: the plan does not preserve the sellable product object.',
  COMMERCIAL_READINESS_MISSING: 'Semantic coverage issue: commercial readiness is missing.',
  PURCHASE_PATH_MISSING: 'Semantic coverage issue: purchase path or checkout coverage is missing.',
  FIRST_SALES_CORRIDOR_MISSING: 'Semantic coverage issue: first-sales execution corridor is missing.',
  BRAND_LAUNCH_SUBSTITUTED_FOR_PRODUCT_LAUNCH:
    'Semantic coverage issue: brand-launch support is substituting for product-launch completion.',
  TERMINAL_EVENT_EVIDENCE_MISSING:
    'Semantic coverage issue: terminal sales evidence review or decision coverage is missing.',
};

const PLAN_QUALITY_REASON_PRIORITY = {
  LONG_HORIZON_UNJUSTIFIED_TAIL_GAP: 0,
  LONG_HORIZON_TEMPORAL_COMPRESSION: 1,
  LONG_HORIZON_SPARSE_CADENCE: 2,
  LONG_HORIZON_WORK_GAPS: 3,
  COMMERCIAL_BLOCK_SPECIFICITY_WEAK: 4,
  COMMERCIAL_WORK_WINDOW_UNDERUSED: 5,
  BRAND_LAUNCH_SUBSTITUTED_FOR_PRODUCT_LAUNCH: 6,
  TERMINAL_OBJECT_DRIFT: 7,
  PURCHASE_PATH_MISSING: 8,
  COMMERCIAL_READINESS_MISSING: 9,
  FIRST_SALES_CORRIDOR_MISSING: 10,
  TERMINAL_EVENT_EVIDENCE_MISSING: 11,
};

function sortPlanQualityCodesForDisplay(codes) {
  return [...(codes || [])].sort((a, b) => {
    const aPriority = PLAN_QUALITY_REASON_PRIORITY[a] ?? 100;
    const bPriority = PLAN_QUALITY_REASON_PRIORITY[b] ?? 100;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    return String(a).localeCompare(String(b));
  });
}

function formatDiagnosticDayKey(dayKey) {
  const text = String(dayKey || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text || 'unknown date';
  }
  const [year, month, day] = text.split('-').map((part) => Number(part));
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCanonicalReasonLabel(code) {
  const key = String(code || '').trim();
  if (!key) {
    return '';
  }
  if (PLAN_QUALITY_REASON_LABELS[key]) {
    return PLAN_QUALITY_REASON_LABELS[key];
  }
  if (LIVE_POS_REASON_LABELS[key]) {
    return LIVE_POS_REASON_LABELS[key];
  }
  return key
    .replace(/^LIVE_POS_/i, '')
    .replace(/^FEASIBILITY_/i, '')
    .replace(/^POS_/i, '')
    .replace(/_/g, ' ')
    .toLowerCase();
}

function mapMasterPlanCriticQuestionsByLane(plan, lanes) {
  const unresolvedQuestions = Array.isArray(plan?.structureCritic?.unresolvedQuestions)
    ? plan.structureCritic.unresolvedQuestions
    : [];
  const laneById = new Map((lanes || []).map((lane) => [lane.id, lane]));
  const result = {};
  unresolvedQuestions.forEach((question) => {
    const directLaneId = String(question?.laneId || '').trim();
    if (directLaneId && laneById.has(directLaneId)) {
      if (!result[directLaneId]) {
        result[directLaneId] = [];
      }
      result[directLaneId].push(question);
      return;
    }
    const domain = String(question?.domain || '').trim().toLowerCase();
    if (!domain) {
      return;
    }
    const matchingLane = (lanes || []).find((lane) => String(lane?.domain || '').trim().toLowerCase() === domain);
    if (matchingLane) {
      if (!result[matchingLane.id]) {
        result[matchingLane.id] = [];
      }
      result[matchingLane.id].push(question);
    }
  });
  return result;
}

function formatPlanQualityTemporalDiagnostic(planQualityGate) {
  const temporal = planQualityGate?.meta?.temporalDistribution || null;
  const codes = uniqueStringList([
    ...(Array.isArray(planQualityGate?.failureCodes) ? planQualityGate.failureCodes : []),
    ...(Array.isArray(planQualityGate?.reasonCodes) ? planQualityGate.reasonCodes : []),
  ]);
  if (!temporal || codes.length === 0) {
    return null;
  }
  const last = formatDiagnosticDayKey(temporal.lastScheduledDayKey);
  const end = formatDiagnosticDayKey(temporal.contractEndDayKey);
  if (codes.includes('LONG_HORIZON_UNJUSTIFIED_TAIL_GAP')) {
    return `Long-horizon issue: work ends on ${last}, leaving an unjustified tail before ${end}.`;
  }
  if (codes.includes('LONG_HORIZON_TEMPORAL_COMPRESSION')) {
    return `Long-horizon issue: work is compressed too early; last scheduled work is ${last} before the ${end} contract end.`;
  }
  return null;
}

function formatLivePosStateLabel(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) {
    return 'Unknown';
  }
  if (raw === 'at_risk') {
    return 'At risk';
  }
  if (raw === 'activating') {
    return 'Activating';
  }
  if (raw === 'recovering') {
    return 'Recovering';
  }
  if (raw === 'stable') {
    return 'Stable';
  }
  if (raw === 'withheld') {
    return 'Withheld';
  }
  return raw.replace(/_/g, ' ');
}

function formatEvidenceDensityLabel(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) {
    return 'Unknown';
  }
  if (raw === 'thin') {
    return 'Thin evidence';
  }
  if (raw === 'moderate') {
    return 'Moderate evidence';
  }
  if (raw === 'strong') {
    return 'Strong evidence';
  }
  if (raw === 'unavailable') {
    return 'Evidence unavailable';
  }
  return raw.replace(/_/g, ' ');
}

function formatFeasibilityStateLabel(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) {
    return 'Unavailable';
  }
  if (raw === 'feasible') {
    return 'Feasible';
  }
  if (raw === 'constrained') {
    return 'Constrained';
  }
  if (raw === 'degraded') {
    return 'Degraded';
  }
  if (raw === 'withheld') {
    return 'Withheld';
  }
  return raw.replace(/_/g, ' ');
}

function formatShotClockDateTime(iso, timeZone) {
  if (!iso) return 'Unknown';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return String(iso);
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${dateLabel} · ${timeLabel}`;
}

function titleCaseWords(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getGoalDisplayLabel(goalsById, cyclesById, goalId) {
  const goal = goalsById?.[goalId] || null;
  const cycle = goal?.activeCycleId ? cyclesById?.[goal.activeCycleId] || null : null;
  return (
    goal?.title ||
    cycle?.goalContract?.goalLabel ||
    cycle?.goalContract?.goalText ||
    cycle?.goalGovernanceContract?.goalText ||
    goalId
  );
}

function formatShotClockDate(isoOrDayKey, timeZone) {
  const value = String(isoOrDayKey || '').trim();
  if (!value) return 'Unknown';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function formatShotClockTime(iso, timeZone) {
  if (!iso) return 'Unknown';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return String(iso);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatShotClockPaceState(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return 'unknown';
  return raw.replace(/_/g, ' ');
}

function formatShotClockDeadlineState(value, completedLate = false) {
  const base = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  if (!base) return 'unknown';
  if (base === 'completed' && completedLate) {
    return 'completed late';
  }
  return base;
}

function uniqueStringList(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter((value) => value.length > 0)
    )
  );
}
// Dev note: activeDayKey is the only anchor for UI dates; avoid new Date/Date.now for display-critical state.

function isAdmittedLikeStatus(status) {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();
  return normalized === 'ADMITTED' || normalized === 'ACTIVE';
}

function computeScheduleItemEndISO(item) {
  const startISO = item?.start || item?.startISO || '';
  const explicitEnd = item?.end || item?.endISO || '';
  if (explicitEnd) {
    return explicitEnd;
  }
  const durationMinutes = Number(item?.durationMinutes || item?.minutes || 0);
  const startMs = Date.parse(startISO);
  if (!Number.isFinite(startMs) || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return startISO;
  }
  return new Date(startMs + durationMinutes * 60 * 1000).toISOString();
}

function normalizeScheduleSurfaceBlocks(items = []) {
  return normalizeBlocks(
    (Array.isArray(items) ? items : []).map((item) => ({
      ...item,
      start: item?.start || item?.startISO || '',
      end: computeScheduleItemEndISO(item),
    }))
  );
}

function getCalendarSurfaceIdentity(block) {
  const stableId = String(block?.id || '').trim();
  if (stableId) {
    return `id:${stableId}`;
  }
  const dayKey = String(block?.dayKey || block?.date || dayKeyFromISO(block?.start || block?.startISO || '', 'UTC') || '').trim();
  const start = String(block?.start || block?.startISO || '').trim();
  const title = String(block?.displayTitle || block?.title || block?.label || '').trim();
  return `shape:${dayKey}:${start}:${title}`;
}

function mergeCalendarSurfaceBlocks(committed = [], forecast = []) {
  const ordered = [...(Array.isArray(committed) ? committed : []), ...(Array.isArray(forecast) ? forecast : [])];
  const deduped = new Map();
  ordered.forEach((block) => {
    const identity = getCalendarSurfaceIdentity(block);
    if (!deduped.has(identity)) {
      deduped.set(identity, block);
    }
  });
  return Array.from(deduped.values());
}

function summarizeTraceBlock(item, timeZone = 'UTC') {
  const start = item?.start || item?.startISO || '';
  return {
    id: item?.id || null,
    title: item?.title || item?.label || null,
    dayKey: item?.dayKey || dayKeyFromISO(start || item?.date || '', timeZone) || null,
    start: start || null,
    status: item?.status || null,
    cycleId: item?.cycleId || null,
    goalId: item?.goalId || null,
    actionId: item?.actionId || null,
    deliverableId: item?.deliverableId ?? item?.payload?.deliverableId ?? null,
    identityKey: item?.identityKey || null,
    origin: item?.origin || null,
  };
}

function findClosureTraceBlocks(items = [], timeZone = 'UTC') {
  return (Array.isArray(items) ? items : [])
    .filter((item) =>
      /final validation|terminal closure checkpoint|closure checkpoint/i.test(String(item?.title || item?.label || ''))
    )
    .map((item) => summarizeTraceBlock(item, timeZone));
}

function hasExplicitWorkWindows(workWindows = {}) {
  return Object.values(workWindows || {}).some(
    (rows) =>
      Array.isArray(rows) &&
      rows.some((row) => {
        const start = String(row?.startHHMM || row?.start || '').trim();
        const end = String(row?.endHHMM || row?.end || '').trim();
        return Boolean(start && end && start < end);
      })
  );
}

function hasWindowForDayKey(dayKey, workWindows = {}, timeZone = 'UTC') {
  if (!dayKey) {
    return false;
  }
  const dow = new Date(`${dayKey}T12:00:00.000Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone,
  });
  const key = String(dow || '')
    .slice(0, 3)
    .toLowerCase();
  const rows = Array.isArray(workWindows?.[key]) ? workWindows[key] : [];
  return rows.some((row) => {
    const start = String(row?.startHHMM || row?.start || '').trim();
    const end = String(row?.endHHMM || row?.end || '').trim();
    return Boolean(start && end && start < end);
  });
}

function normalizeCanonicalWorkWindowsForUi(workWindows = {}) {
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  return days.reduce((acc, day) => {
    const rows = Array.isArray(workWindows?.[day]) ? workWindows[day] : [];
    acc[day] = rows
      .map((row) => ({
        start: String(row?.start || row?.startHHMM || '').trim(),
        end: String(row?.end || row?.endHHMM || '').trim(),
      }))
      .filter((row) => row.start && row.end && row.start < row.end);
    return acc;
  }, {});
}

function countCanonicalWorkWindows(workWindows = {}) {
  return Object.values(normalizeCanonicalWorkWindowsForUi(workWindows)).reduce(
    (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
    0
  );
}

function parseHHMMToMinutesUi(hhmm) {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(String(hhmm))) {
    return 0;
  }
  const [hh, mm] = String(hhmm)
    .split(':')
    .map((value) => Number(value));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    return 0;
  }
  return hh * 60 + mm;
}

function computeWeeklyCapacityMinutesUi(workWindows = {}) {
  return Object.values(normalizeCanonicalWorkWindowsForUi(workWindows)).reduce((total, rows) => {
    if (!Array.isArray(rows)) {
      return total;
    }
    return (
      total +
      rows.reduce((dayTotal, row) => {
        return dayTotal + Math.max(0, parseHHMMToMinutesUi(row.end) - parseHHMMToMinutesUi(row.start));
      }, 0)
    );
  }, 0);
}

function formatHoursFromMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0 hrs/week';
  }
  const hours = minutes / 60;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 1)} hrs/week`;
}

function deriveGapReasonLabel({
  dayKey,
  hasBlocks,
  contractStartDayKey,
  deadlineDayKey,
  scheduleDayKeys = [],
  blackoutDayKeys = [],
  workWindows = {},
  lastPlanError = null,
  timeZone = 'UTC',
}) {
  if (!dayKey || hasBlocks) {
    return null;
  }
  if ((contractStartDayKey && dayKey < contractStartDayKey) || (deadlineDayKey && dayKey > deadlineDayKey)) {
    return null;
  }
  if (Array.isArray(blackoutDayKeys) && blackoutDayKeys.includes(dayKey)) {
    return 'Gap: blackout';
  }
  const reasonCodes = Array.isArray(lastPlanError?.reasonCodes) ? lastPlanError.reasonCodes : [];
  if (reasonCodes.includes('NO_ALLOWED_WINDOWS')) {
    return 'Gap: no valid window';
  }
  if (hasExplicitWorkWindows(workWindows) && !hasWindowForDayKey(dayKey, workWindows, timeZone)) {
    return 'Gap: no valid window';
  }
  if (
    reasonCodes.includes('EXCEEDS_MAX_PER_DAY') ||
    reasonCodes.includes('EXCEEDS_MAX_PER_WEEK') ||
    reasonCodes.includes('OVERLAP_ALL_SLOTS') ||
    reasonCodes.includes('CLAMP_FILTERED_ALL')
  ) {
    return 'Gap: capacity limit';
  }
  const futureScheduled = scheduleDayKeys.some((scheduledDayKey) => scheduledDayKey > dayKey);
  const pastScheduled = scheduleDayKeys.some((scheduledDayKey) => scheduledDayKey < dayKey);
  if (futureScheduled && !pastScheduled) {
    return 'Gap: predecessor gate';
  }
  if (pastScheduled && !futureScheduled) {
    return 'Gap: no remaining blocks';
  }
  if (reasonCodes.includes('UNSCHEDULABLE') || lastPlanError?.code === 'NO_PROPOSED_BLOCKS') {
    return 'Gap: capacity limit';
  }
  return null;
}

function normalizeLifecycleAuditValue(value) {
  if (value && typeof value === 'object') {
    const status = String(value.status || '').trim();
    if (status) {
      return normalizeLifecycleAuditValue(status);
    }
    if (value.passed === true) {
      return 'PASS';
    }
    if (value.passed === false) {
      return 'FAIL';
    }
    return '';
  }
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }
  const upper = normalized.toUpperCase();
  if (upper === 'PASS' || upper === 'FAIL' || upper === 'UNKNOWN') {
    return upper;
  }
  return normalized;
}

function hasConcreteLifecycleAuditValue(value) {
  const normalized = normalizeLifecycleAuditValue(value);
  return normalized !== '' && normalized !== 'UNKNOWN';
}

function hasTrustedFullHorizonProjection({ coverageAudit, planQuality, blockQuality }) {
  return (
    Boolean(coverageAudit?.fullHorizonCovered) &&
    String(planQuality?.state || '').trim().toLowerCase() === 'trusted' &&
    String(planQuality?.standardStatus || '').trim().toLowerCase() === 'trusted_plan' &&
    String(blockQuality?.state || '').trim().toLowerCase() === 'trusted'
  );
}

const EXECUTION_READINESS_BLOCKING_FAILURE_CODES = new Set([
  'ACTIVE_BLOCK_UNKNOWN_LANE',
  'ACTIVE_BLOCK_UNKNOWN_ENTITY',
  'PROJECT_CONTEXT_MISSING',
  'UNKNOWN_LANE_IDENTITY',
  'LANE_CONTEXT_NOT_APPLIED',
  'TITLE_REPEATED_IN_PRODUCES',
  'OUTPUT_ARTIFACT_TOO_VAGUE',
  'MISSING_COMPLETED_ARTIFACT',
  'BLOCK_DETAIL_AMBIGUOUS',
  'GENERIC_EXECUTION_INSTRUCTION',
  'PHASE_SCOPE_CONFLICT',
  'DEFERRED_LANE_SCHEDULED_WITHOUT_JUSTIFICATION',
  'FUTURE_PHASE_WORK_REQUIRES_PREREQUISITE_PROOF',
  'ENTITY_PURPOSE_MISMATCH',
  'SCHEDULE_DISTRIBUTION_CLUSTER_UNJUSTIFIED',
  'P1_NONCRITICAL_LANE_OVERREPRESENTED',
  'PHASE_ENERGY_VIOLATION',
  'LOW_PRIORITY_WORK_CROWDS_OUT_P1',
  'FULL_HORIZON_REPRESENTATION_LEAKED_INTO_SPRINT',
]);

function hasProjectedExecutionReadinessBlocker(planQualityGate) {
  const failureCodes = Array.isArray(planQualityGate?.failureCodes) ? planQualityGate.failureCodes : [];
  return failureCodes.some((code) => EXECUTION_READINESS_BLOCKING_FAILURE_CODES.has(String(code || '').trim()));
}

function buildProjectedLifecycleGate({
  planQualityGate,
  fullHorizonCoverageAudit,
  fullHorizonPlanQuality,
  fullHorizonBlockQuality,
  firstExecutableDate,
  blockCount,
}) {
  const trustedFullHorizon = hasTrustedFullHorizonProjection({
    coverageAudit: fullHorizonCoverageAudit,
    planQuality: fullHorizonPlanQuality,
    blockQuality: fullHorizonBlockQuality,
  });
  const base = planQualityGate && typeof planQualityGate === 'object' ? { ...planQualityGate } : null;

  if (!trustedFullHorizon || hasProjectedExecutionReadinessBlocker(base)) {
    return base;
  }

  return {
    ...(base || {}),
    passed: true,
    status: 'PLAN_QUALITY_PASSED',
    failureCodes: [],
    reasonCodes: [],
    dependencyAudit: hasConcreteLifecycleAuditValue(base?.dependencyAudit)
      ? normalizeLifecycleAuditValue(base?.dependencyAudit)
      : 'PASS',
    ownerCoverage: hasConcreteLifecycleAuditValue(base?.ownerCoverage)
      ? normalizeLifecycleAuditValue(base?.ownerCoverage)
      : 'PASS',
    gateIntegrity: hasConcreteLifecycleAuditValue(base?.gateIntegrity)
      ? normalizeLifecycleAuditValue(base?.gateIntegrity)
      : 'PASS',
    firstExecutableDate: String(base?.firstExecutableDate || firstExecutableDate || '').trim() || undefined,
    blockCount:
      Number.isFinite(Number(base?.blockCount)) && Number(base?.blockCount) > 0
        ? Number(base.blockCount)
        : Number.isFinite(Number(blockCount)) && Number(blockCount) > 0
          ? Number(blockCount)
          : undefined,
  };
}

function useZionState() {
  const {
    activeProfileId,
    activeGoalId,
    profileAccess,
    profilesById,
    goalsById,
    today,
    currentWeek,
    cycle,
    executionEvents,
    lastPlanError,
    proposedBlocks,
    suggestedBlocks,
    deliverablesByCycleId,
    goalAdmissionByGoal,
    appTime,
    viewDate,
    goalWorkById,
    constraints,
    availabilityPolicy,
    debug,
    cyclesById,
    cycleDynamicsByCycleId,
    activeCycleId,
    blockStore,
    goalExecutionContract,
    probabilityByGoal,
    feasibilityByGoal,
    planQualityGateByGoal,
    executionCorrectionByGoal,
    systemShotClockByGoal,
    masterPlansById,
    masterPlanLanesById,
    masterPlanMilestonesById,
    masterCalendarsById,
    strategicClustersById,
    goalRelations,
    constraintRelations,
    frictionEvents,
    frictionPropagationResults,
    profileLearning,
    planRecovery,
    pendingPlanConfirmation,
    scheduleApplied,
    coreContinuity,
    coreMissionContractsById,
    setActiveCycle,
    deleteCycle,
    startNewCycle,
    startNewCycleWithDecision,
    generateScheduleForActiveCycle,
    generatePlanWithLLM,
    completeBlock,
    missBlock,
    skipBlock,
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
    setPlanResolutionKind,
    activateSchedule,
    rebaseSchedule,
    applyRenegotiationOption,
    resetIdentity,
    upsertProfileDetails,
    addFrictionEvent,
    completeCycleReassessment,
    selectedHorizonMode,
    calendarDisplayBlocks,
    fullHorizonScheduleBlocks,
    fullHorizonCoverageAudit,
    fullHorizonPlanQuality,
    fullHorizonBlockQuality,
    scheduleLifecycleState,
    setSelectedHorizonMode,
    setViewDate,
    respondConvergenceDetectionQuestion,
    matrix,
  } = useIdentityStore();
  return {
    activeProfileId,
    activeGoalId,
    profileAccess,
    profilesById,
    goalsById,
    today,
    currentWeek,
    cycle,
    executionEvents,
    lastPlanError,
    proposedBlocks,
    suggestedBlocks,
    deliverablesByCycleId,
    goalAdmissionByGoal,
    appTime,
    viewDate,
    goalWorkById,
    constraints,
    availabilityPolicy,
    debug,
    cyclesById,
    cycleDynamicsByCycleId,
    activeCycleId,
    blockStore,
    goalExecutionContract,
    probabilityByGoal,
    feasibilityByGoal,
    planQualityGateByGoal,
    executionCorrectionByGoal,
    systemShotClockByGoal,
    masterPlansById,
    masterPlanLanesById,
    masterPlanMilestonesById,
    masterCalendarsById,
    strategicClustersById,
    goalRelations,
    constraintRelations,
    frictionEvents,
    frictionPropagationResults,
    profileLearning,
    planRecovery,
    pendingPlanConfirmation,
    scheduleApplied,
    coreContinuity,
    coreMissionContractsById,
    selectedHorizonMode,
    calendarDisplayBlocks,
    fullHorizonScheduleBlocks,
    fullHorizonCoverageAudit,
    fullHorizonPlanQuality,
    fullHorizonBlockQuality,
    scheduleLifecycleState,
    matrix,
    actions: {
      completeBlock,
      missBlock,
      skipBlock,
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
      setViewDate,
      generatePlan,
      commitPreviewItems,
      applyPlan,
      setPlanResolutionKind,
      activateSchedule,
      rebaseSchedule,
      applyRenegotiationOption,
      resetIdentity,
      upsertProfileDetails,
      addFrictionEvent,
      completeCycleReassessment,
      setSelectedHorizonMode,
      respondConvergenceDetectionQuestion,
    },
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
  initialAnchorDayKey = null,
}) {
  const {
    activeProfileId,
    activeGoalId,
    profileAccess,
    profilesById,
    goalsById,
    today,
    currentWeek,
    cycle,
    executionEvents,
    proposedBlocks,
    suggestedBlocks,
    deliverablesByCycleId,
    goalAdmissionByGoal,
    appTime,
    viewDate,
    goalWorkById,
    constraints,
    availabilityPolicy,
    debug,
    lastPlanError,
    cyclesById,
    cycleDynamicsByCycleId,
    activeCycleId,
    blockStore,
    goalExecutionContract,
    probabilityByGoal,
    feasibilityByGoal,
    planQualityGateByGoal,
    executionCorrectionByGoal,
    systemShotClockByGoal,
    masterPlansById,
    masterPlanLanesById,
    masterPlanMilestonesById,
    masterCalendarsById,
    strategicClustersById,
    goalRelations,
    constraintRelations,
    frictionEvents,
    frictionPropagationResults,
    profileLearning,
    planRecovery,
    pendingPlanConfirmation,
    scheduleApplied,
    coreContinuity,
    coreMissionContractsById,
    scheduleLifecycleState,
    matrix: calendarScopeMatrix,
    selectedHorizonMode,
    calendarDisplayBlocks: forecastCalendarBlocks = [],
    fullHorizonScheduleBlocks: fullHorizon = [],
    fullHorizonCoverageAudit,
    fullHorizonPlanQuality,
    fullHorizonBlockQuality,
    actions,
  } = useZionState();
  const activeCycle = activeCycleId && cyclesById ? cyclesById[activeCycleId] : null;
  const activeProfile = activeProfileId ? profilesById?.[activeProfileId] || null : null;
  const activeMasterPlan =
    activeProfile?.activeMasterPlanId ? masterPlansById?.[activeProfile.activeMasterPlanId] || null : null;
  const activeMasterCalendar =
    activeProfile?.masterCalendarId ? masterCalendarsById?.[activeProfile.masterCalendarId] || null : null;
  const profileStrategicClusters = useMemo(
    () =>
      Array.isArray(activeProfile?.strategicClusterIds)
        ? activeProfile.strategicClusterIds
            .map((clusterId) => strategicClustersById?.[clusterId] || null)
            .filter(Boolean)
        : [],
    [activeProfile?.strategicClusterIds, strategicClustersById]
  );
  const clusteredGoalIds = useMemo(
    () => new Set(profileStrategicClusters.flatMap((cluster) => cluster.goalIds || [])),
    [profileStrategicClusters]
  );
  const activeProfileGoalIds = useMemo(
    () => (Array.isArray(activeProfile?.goalIds) ? activeProfile.goalIds.filter(Boolean) : []),
    [activeProfile?.goalIds]
  );
  const activeProfileCycleIds = useMemo(
    () =>
      activeProfileGoalIds
        .map((goalId) => goalsById?.[goalId]?.activeCycleId || null)
        .filter(Boolean),
    [activeProfileGoalIds, goalsById]
  );
  const independentGoalIds = useMemo(
    () => activeProfileGoalIds.filter((goalId) => !clusteredGoalIds.has(goalId)),
    [activeProfileGoalIds, clusteredGoalIds]
  );
  const globalConstraintSummaries = useMemo(() => {
    const bySource = new Map();
    (Array.isArray(constraintRelations) ? constraintRelations : []).forEach((relation) => {
      if (relation?.profileId !== activeProfileId || relation?.scope !== 'global') {
        return;
      }
      const key = `${relation.sourceGoalId}:${relation.relationType}`;
      if (!bySource.has(key)) {
        bySource.set(key, {
          sourceGoalId: relation.sourceGoalId,
          relationType: relation.relationType,
          severity: relation.severity,
        });
      }
    });
    return Array.from(bySource.values());
  }, [constraintRelations, activeProfileId]);
  const independentCompetitionLabels = useMemo(() => {
    const labels = new Set();
    (Array.isArray(goalRelations) ? goalRelations : []).forEach((relation) => {
      if (
        relation?.profileId !== activeProfileId ||
        relation?.relationType !== 'competes_for_time'
      ) {
        return;
      }
      if (!independentGoalIds.includes(relation.fromGoalId) && !independentGoalIds.includes(relation.toGoalId)) {
        return;
      }
      const fromLabel = getGoalDisplayLabel(goalsById, cyclesById, relation.fromGoalId);
      const toLabel = getGoalDisplayLabel(goalsById, cyclesById, relation.toGoalId);
      labels.add(`${fromLabel} ↔ ${toLabel}`);
    });
    return Array.from(labels).slice(0, 4);
  }, [goalRelations, activeProfileId, independentGoalIds, goalsById, cyclesById]);
  const profileFrictionResults = useMemo(
    () =>
      (Array.isArray(frictionPropagationResults) ? frictionPropagationResults : []).filter(
        (result) => result?.profileId === activeProfileId
      ),
    [frictionPropagationResults, activeProfileId]
  );
  const profileFrictionEvents = useMemo(
    () =>
      (Array.isArray(frictionEvents) ? frictionEvents : []).filter((event) => event?.profileId === activeProfileId),
    [frictionEvents, activeProfileId]
  );
  const [frictionGoalId, setFrictionGoalId] = useState(activeGoalId || '');
  const [frictionCycleId, setFrictionCycleId] = useState(activeCycleId || '');
  const [frictionBlockId, setFrictionBlockId] = useState('');
  const [frictionEventType, setFrictionEventType] = useState('capacity_loss');
  const [frictionSeverity, setFrictionSeverity] = useState('moderate');
  const [frictionHours, setFrictionHours] = useState('4');
  const [frictionStartDate, setFrictionStartDate] = useState(appTime?.activeDayKey || today?.date || nowDayKey());
  const [frictionEndDate, setFrictionEndDate] = useState('');
  const [frictionNote, setFrictionNote] = useState('');
  useEffect(() => {
    if (!frictionGoalId && activeGoalId) {
      setFrictionGoalId(activeGoalId);
    }
  }, [frictionGoalId, activeGoalId]);
  useEffect(() => {
    const nextCycleId =
      (frictionGoalId && goalsById?.[frictionGoalId]?.activeCycleId) || activeCycleId || '';
    if (nextCycleId && frictionCycleId !== nextCycleId) {
      setFrictionCycleId(nextCycleId);
    }
  }, [frictionGoalId, goalsById, activeCycleId, frictionCycleId]);
  const frictionGoalOptions = useMemo(
    () =>
      activeProfileGoalIds.map((goalId) => ({
        goalId,
        label: getGoalDisplayLabel(goalsById, cyclesById, goalId),
        cycleId: goalsById?.[goalId]?.activeCycleId || '',
      })),
    [activeProfileGoalIds, goalsById, cyclesById]
  );
  const handleCreateFrictionEvent = (event) => {
    event.preventDefault();
    if (!canRecordCycleFriction || !frictionGoalId || !frictionEventType) {
      return;
    }
    actions.addFrictionEvent({
      profileId: activeProfileId,
      goalId: frictionGoalId,
      cycleId: frictionCycleId || null,
      blockId: frictionBlockId.trim() || null,
      eventType: frictionEventType,
      severity: frictionSeverity,
      calendarImpactHours: Number(frictionHours || 0),
      startDateISO: frictionStartDate || appTime?.activeDayKey || today?.date || nowDayKey(),
      endDateISO: frictionEndDate || null,
      note: frictionNote.trim() || null,
      source: 'user_reported',
    });
    setFrictionBlockId('');
    setFrictionNote('');
  };
  const activePlanSummary = activeCycle?.autoAsanaPlan?.summary || activeCycle?.lastResolvedPlanSummary || null;
  const normalizedPlanStatus = String(activePlanSummary?.planStatus || '')
    .trim()
    .toUpperCase();
  const selectedPlanResolutionKind = activeCycle?.selectedPlanResolutionKind || null;
  const requiresHorizonResolution = normalizedPlanStatus === 'VALID_BUT_HORIZON_INSUFFICIENT';
  const canonicalContract = getCanonicalCycleContract(activeCycle, goalExecutionContract);
  const goalId = canonicalContract?.goalId || null;
  const renderGoalId =
    goalId ||
    activeCycle?.goalContract?.goalId ||
    activeCycle?.goalGovernanceContract?.goalId ||
    activeCycle?.contract?.goalId ||
    null;
  const admissionRecord = goalId
    ? goalAdmissionByGoal?.[goalId] || activeCycle?.goalAdmission
    : activeCycle?.goalAdmission;
  const hasAdmittedGoal = Boolean(activeCycle?.goalContract);
  const normalizedAdmissionStatus = String(admissionRecord?.status || '')
    .trim()
    .toUpperCase();
  const isGoalAdmitted =
    hasAdmittedGoal &&
    (!admissionRecord || !normalizedAdmissionStatus || isAdmittedLikeStatus(normalizedAdmissionStatus));

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
  const goalPolicy = activeCycle?.policyState?.goalPolicy || activeMasterPlan?.policyState?.goalPolicy || null;
  const hasExecutableMasterPlan = Boolean(
    activeMasterPlan?.id && Array.isArray(activeMasterPlan?.laneIds) && activeMasterPlan.laneIds.length > 0
  );
  const cycleMode =
    normalizedCycleStatus === 'active' || (!activeCycle && hasExecutableMasterPlan) ? 'active' : 'review';
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
  const timeZone = appTime?.timeZone || APP_TIME_ZONE;
  const todayTruthTimeZone = APP_TIME_ZONE;
  const whatMovedToday = useMemo(
    () => deriveWhatMovedToday({ deliverableWorkspace: deliverablesWorkspace, dayKey: activeDayKey }),
    [deliverablesWorkspace, activeDayKey]
  );
  const cyclesIndex = useMemo(
    () =>
      projectCyclesIndex({
        cyclesById: cyclesById || {},
        goalWorkById: goalWorkById || {},
        constraints: constraints || {},
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
      completionRate: readOnlyCycle.summary.completionRate,
    }) ||
    readOnlyCycleEntry?.summaryStats ||
    null;
  const summaryText = readOnlySummaryStats
    ? `Completion rate ${Math.round((readOnlySummaryStats.completionRate || 0) * 100)}% · ${readOnlySummaryStats.completionCount || 0} completions`
    : 'Summary pending';
  const startDayKey = readOnlyCycle?.startedAtDayKey || (readOnlyCycleEntry?.startISO || '').slice(0, 10) || null;
  const endDayKey = readOnlyCycle?.endedAtDayKey || (readOnlyCycleEntry?.endISO || '').slice(0, 10) || null;
  const rangeText = startDayKey
    ? endDayKey
      ? `${formatDayKeyLabel(startDayKey)} → ${formatDayKeyLabel(endDayKey)}`
      : `Started ${formatDayKeyLabel(startDayKey)}`
    : 'Dates pending';
  const learningUpdatesCount = profileLearning?.cycleCount ?? 0;
  const learningUpdatedAt = readOnlyCycle?.fidelityVerdictReport?.updatedAtISO || 'Pending';
  const bannerTitle =
    readOnlyCycle?.status === 'ended' || readOnlyCycleEntry?.state === 'Ended'
      ? 'Operating Cycle ended — Read only'
      : 'Review Mode — Read only';
  const alternateActiveEntry = cyclesIndex?.find(
    (entry) => entry.state === 'Active' && entry.cycleId && entry.cycleId !== readOnlyCycle?.id
  );
  const canReturnToActive = Boolean(alternateActiveEntry);
  const cycleLabel =
    readOnlyCycle?.goalContract?.goalText ||
    readOnlyCycleEntry?.goalTitle ||
    (readOnlyCycle && readOnlyCycle.id) ||
    'Operating Cycle';
  const DEV_TIME_DEBUG =
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    (localStorage.getItem('JERICHO_TIME_DEBUG') === '1' || localStorage.getItem('JERICHO_TIME_DEBUG') === 'true');
  const [view, setView] = useState(() => {
    const routeView =
      typeof window !== 'undefined' ? resolveDashboardViewFromHash(window.location.hash || '') : null;
    if (routeView) return routeView;
    if (initialView !== null && initialView !== undefined) return initialView;
    return 'today';
  });
  useEffect(() => {
    const errorCode = String(lastPlanError?.code || '')
      .trim()
      .toUpperCase();
    const requiredRecovery = String(planRecovery?.required || '')
      .trim()
      .toUpperCase();
    if (
      errorCode === 'MISSING_GOAL_DRAFT' ||
      requiredRecovery === 'GOAL_DRAFT_CONTEXT' ||
      errorCode.startsWith('INTAKE_') ||
      requiredRecovery.startsWith('INTAKE_')
    ) {
      setView('structure');
    }
  }, [lastPlanError?.code, planRecovery?.required]);
  // Sync hash changes to view state (e.g., when user navigates via URL)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncHashToView = () => {
      const routeView = resolveDashboardViewFromHash(window.location.hash || '');
      if (routeView) {
        setView(routeView);
        if (routeView === 'structure') {
          setZionView('day');
        }
      }
    };

    // Sync on mount
    syncHashToView();

    // Listen for route and browser restore events. Session/tab restore can bring
    // back stale React view state without remounting or firing a hashchange, so
    // pageshow/visibility restore must reassert URL authority.
    window.addEventListener('hashchange', syncHashToView);
    window.addEventListener('pageshow', syncHashToView);
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncHashToView();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      window.removeEventListener('hashchange', syncHashToView);
      window.removeEventListener('pageshow', syncHashToView);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);
  const [assistantVisible, setAssistantVisible] = useState(assistantOpen);
  const [isCycleTransitionModalOpen, setCycleTransitionModalOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [liveClockISO, setLiveClockISO] = useState(() => new Date().toISOString());
  const [zionView, setZionView] = useState(() => {
    const routeView =
      typeof window !== 'undefined' ? resolveDashboardViewFromHash(window.location.hash || '') : null;
    if (routeView === 'structure') {
      return 'day';
    }
    return initialZionView || 'day';
  });
  const [anchorDayKey, setAnchorDayKey] = useState(() => initialAnchorDayKey || viewDate || activeDayKey);
  // Keep the URL route sovereign over any restored/passed view state.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const routeView = resolveDashboardViewFromHash(window.location.hash || '');
    if (!routeView) return;
    if (view !== routeView) {
      setView(routeView);
    }
    if (routeView === 'structure' && zionView !== 'day') {
      setZionView('day');
    }
  }, [view, zionView]);
  useEffect(() => {
    setAssistantVisible(assistantOpen);
  }, [assistantOpen]);
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setLiveClockISO(new Date().toISOString());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);
  const changeView = React.useCallback((mode) => {
    traceAction(`tabs.${mode}`, { mode });
    if (typeof window !== 'undefined') {
      const nextHash = resolveHashForDashboardView(mode);
      const currentHash = window.location.hash || '';
      if (currentHash !== nextHash) {
        try {
          window.location.hash = nextHash;
        } catch {
          // ignore hash routing failures and still update local state
        }
      }
    }
    setView(mode);
    if (mode === 'structure') {
      setZionView('day');
    }
  }, []);

  const primaryObjectiveId = today?.primaryObjectiveId || null;
  const runtimeTodayDayKey =
    dayKeyFromISO(liveClockISO, todayTruthTimeZone) ||
    activeDayKey ||
    viewDate ||
    nowDayKey(todayTruthTimeZone);
  useEffect(() => {
    if (zionView === 'today') {
      setAnchorDayKey(runtimeTodayDayKey);
      actions.setViewDate?.(runtimeTodayDayKey);
      return;
    }
    if (zionView === 'day') {
      setAnchorDayKey(viewDate || activeDayKey);
    }
  }, [viewDate, activeDayKey, zionView, runtimeTodayDayKey, actions]);
  const normalizeDayKeyValue = (value) => {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return dayKeyFromISO(value, timeZone);
  };
  const viewDayKey = zionView === 'day' || zionView === 'today' ? anchorDayKey : null;
  const selectedCalendarDayKey =
    zionView === 'today'
      ? runtimeTodayDayKey
      : viewDayKey || anchorDayKey || viewDate || activeDayKey || runtimeTodayDayKey || null;
  const shouldResolveMasterPlanCycleStart = Boolean(
    activeMasterPlan && (activeCycle?.source === 'master_plan' || activeCycle?.masterPlanId === activeMasterPlan.id)
  );
  const cycleStartResolution = useMemo(
    () =>
      shouldResolveMasterPlanCycleStart
        ? resolveFirstCycleScheduleStart(
            {
              today,
              appTime,
              availabilityPolicy,
              profilesById,
              masterCalendarsById,
            },
            {
              plan: activeMasterPlan,
              cycle: activeCycle,
              contract: activeCycle?.goalContract || canonicalContract || goalExecutionContract || null,
            }
          )
        : null,
    [
      shouldResolveMasterPlanCycleStart,
      today,
      appTime,
      availabilityPolicy,
      profilesById,
      masterCalendarsById,
      activeMasterPlan,
      activeCycle,
      canonicalContract,
      goalExecutionContract,
    ]
  );
  const contractStartDateValue = resolveEffectiveExecutableStartDayKey({
    executionStartDayKey: activeCycle?.executionStartDayKey || null,
    reassessmentCompletedAtISO: activeCycle?.reassessmentCompletedAtISO || null,
    scheduleGeneratedAtISO: activeCycle?.scheduleGeneratedAtISO || activeCycle?.autoAsanaPlan?.audit?.generatedAtISO || null,
    fallbackStartDayKey:
      cycleStartResolution?.resolvedStartDayKey ||
      activeCycle?.startedAtDayKey ||
      activeCycle?.goalGovernanceContract?.activeFromISO ||
      activeCycle?.goalContract?.startDayKey ||
      activeCycle?.goalContract?.startDateISO ||
      activeCycle?.goalContract?.startDate ||
      activeCycle?.goalContract?.temporalBinding?.startDayKey ||
      goalExecutionContract?.startDayKey ||
      goalExecutionContract?.startDateISO ||
      goalExecutionContract?.startDate ||
      goalExecutionContract?.temporalBinding?.startDayKey ||
      null,
  });
  const contractStartDayKey = normalizeDayKeyValue(contractStartDateValue);
  const effectiveExecutionDayKey =
    contractStartDayKey && activeDayKey && activeDayKey < contractStartDayKey ? contractStartDayKey : activeDayKey;
  const contractStartReasonLabel = String(
    shouldResolveMasterPlanCycleStart ? cycleStartResolution?.reasonLabel || activeCycle?.startDateReason || '' : ''
  ).trim();
  const contractStartIsDelayed = Boolean(shouldResolveMasterPlanCycleStart && cycleStartResolution?.delayed);
  const suppressSuggestionsForPreStartDay = Boolean(
    contractStartDayKey && viewDayKey && viewDayKey < contractStartDayKey
  );
  const suppressDrafts = suppressSuggestionsForPreStartDay;
  const normalizedScheduleLifecycle = String(activeCycle?.scheduleLifecycle || '')
    .trim()
    .toLowerCase();
  const normalizedScheduleLifecycleState = String(scheduleLifecycleState || 'no_goal')
    .trim()
    .toLowerCase();
  const reviewScheduleBlocks = (
    Array.isArray(activeCycle?.scheduleReviewBlocks) ? activeCycle.scheduleReviewBlocks : []
  ).filter((block) => {
    if (activeCycleId && block?.cycleId && block.cycleId !== activeCycleId) {
      return false;
    }
    if (renderGoalId && block?.goalId && block.goalId !== renderGoalId) {
      return false;
    }
    return true;
  });
  const hasAppliedReviewSchedule = normalizedScheduleLifecycle === 'applied_review' && reviewScheduleBlocks.length > 0;
  const hasActiveSchedule = normalizedScheduleLifecycle === 'active_schedule';
  const isInterCycle = normalizedScheduleLifecycleState === 'inter_cycle';
  const generatedScheduleDayKey =
    dayKeyFromISO(
      activeCycle?.scheduleGeneratedAtISO || activeCycle?.autoAsanaPlan?.audit?.generatedAtISO || '',
      timeZone
    ) || null;
  const runtimeLocalDayKey = activeDayKey || dayKeyFromISO(appTime?.nowISO || '', timeZone) || null;
  const hasGeneratedCycleSchedule =
    hasActiveSchedule ||
    hasAppliedReviewSchedule ||
    normalizedScheduleLifecycle === 'draft_schedule_ready' ||
    (Array.isArray(activeCycle?.proposedBlocks) && activeCycle.proposedBlocks.length > 0);
  const allRenderedBlocks = useMemo(() => {
    const rawBlocks = getAllBlocks({ today, currentWeek, cycle, blockStore });
    return normalizeBlocks(rawBlocks);
  }, [today, currentWeek, cycle, blockStore]);
  const fallbackExecutionBlocks = useMemo(() => {
    const cycleEvents =
      Array.isArray(activeCycle?.executionEvents) && activeCycle.executionEvents.length > 0
        ? activeCycle.executionEvents
        : executionEvents || [];
    if (!Array.isArray(cycleEvents) || cycleEvents.length === 0) {
      return [];
    }
    const { days } = materializeBlocksFromEvents(cycleEvents, { todayISO: today?.date });
    return normalizeBlocks((days || []).flatMap((day) => day?.blocks || []));
  }, [activeCycle, executionEvents, today?.date]);
  const normalizedBlocks = useMemo(() => {
    if (!activeCycleId || (!((hasAdmittedGoal && isGoalAdmitted) || hasExecutableMasterPlan) && !hasActiveSchedule)) {
      return [];
    }
    // Cycle identity is the canonical scope for committed execution blocks.
    // Goal ids on persisted events can lag contract rewrites and should not hide
    // already-committed schedule from the active cycle's calendar.
    const renderedCycleBlocks = (allRenderedBlocks || []).filter((block) => block?.cycleId === activeCycleId);
    const canonicalCycleBlocks = (fallbackExecutionBlocks || []).filter((block) => block?.cycleId === activeCycleId);
    if (hasActiveSchedule && canonicalCycleBlocks.length > 0) {
      return canonicalCycleBlocks;
    }
    // state.cycle is still recomputed as the visible month slice in some reducer paths.
    // executionEvents remain the canonical committed source of truth, so prefer them
    // whenever they contain a fuller horizon than the currently rendered slice.
    if (canonicalCycleBlocks.length > renderedCycleBlocks.length) {
      return canonicalCycleBlocks;
    }
    if (renderedCycleBlocks.length > 0) {
      return renderedCycleBlocks;
    }
    return canonicalCycleBlocks;
  }, [
    allRenderedBlocks,
    fallbackExecutionBlocks,
    activeCycleId,
    hasAdmittedGoal,
    isGoalAdmitted,
    hasExecutableMasterPlan,
    hasActiveSchedule,
  ]);
  const hasVisibleCanonicalBlocks = normalizedBlocks.length > 0;
  const hasPendingActivation = hasAppliedReviewSchedule && !hasActiveSchedule;
  const temporalRebaseRequired =
    hasPendingActivation &&
    ['SCHEDULE_REBASE_REQUIRED', 'GENERATED_SCHEDULE_STALE'].includes(
      String(lastPlanError?.code || '')
        .trim()
        .toUpperCase()
    );
  const activationDelayReassessmentRequired =
    hasPendingActivation &&
    String(lastPlanError?.code || '')
      .trim()
      .toUpperCase() === 'ACTIVATION_DELAY_REASSESSMENT_REQUIRED';
  const showRebaseRecoveryAction = temporalRebaseRequired || activationDelayReassessmentRequired;
  const cycleWasRebased = String(activeCycle?.temporalStatus || '')
    .trim()
    .toLowerCase() === 'rebased';
  const reassessmentRequired =
    String(activeCycle?.reassessmentStatus || '')
      .trim()
      .toLowerCase() === 'required';
  const formatRangeLabel = React.useCallback(
    (startDayKey, endDayKey) => {
      if (!startDayKey && !endDayKey) return '—';
      if (startDayKey && endDayKey) {
        return `${formatDayKeyLabel(startDayKey)} → ${formatDayKeyLabel(endDayKey)}`;
      }
      if (startDayKey) return `Starts ${formatDayKeyLabel(startDayKey)}`;
      return `Through ${formatDayKeyLabel(endDayKey)}`;
    },
    [timeZone]
  );
  const executionLockReason = hasPendingActivation
    ? 'Schedule applied — not active yet. Activate the cycle before logging completion, misses, or rescheduling blocks.'
    : '';
  const masterPlanHorizonLabel = activeMasterPlan
    ? formatRangeLabel(activeMasterPlan.horizonStart || null, activeMasterPlan.fullHorizonEndDayKey || activeMasterPlan.horizonEnd || null)
    : '—';
  const executionCycleHorizonLabel = activeCycle
    ? formatRangeLabel(
        contractStartDayKey || activeCycle?.goalContract?.startDayKey || activeCycle?.startedAtDayKey || null,
        activeCycle?.goalContract?.endDayKey || null
      )
    : 'No active Operating Cycle';
  const hasStaleActiveSchedule = hasActiveSchedule && !hasVisibleCanonicalBlocks;
  const effectiveWindowMode = zionView === 'today' ? 'day' : zionView;
  const resolvedAnchorDayKey =
    zionView === 'day' || zionView === 'today'
      ? viewDayKey || anchorDayKey || viewDate || effectiveExecutionDayKey || activeDayKey
      : anchorDayKey || effectiveExecutionDayKey || activeDayKey;
  const anchorISO = resolvedAnchorDayKey ? `${resolvedAnchorDayKey}T12:00:00.000Z` : appTime?.nowISO || '';
  const windowSpec = buildWindowSpec(effectiveWindowMode, anchorISO, timeZone);
  const windowLabel = formatWindowLabel(windowSpec, timeZone);
  const globalScheduleSource = getCanonicalProposedBlocks(proposedBlocks, suggestedBlocks);
  const cycleLocalScheduleSource = Array.isArray(activeCycle?.proposedBlocks) ? activeCycle.proposedBlocks : [];
  const scheduleSource = globalScheduleSource.length > 0 ? globalScheduleSource : cycleLocalScheduleSource;
  const hasExecutableProposalContext = (hasAdmittedGoal && isGoalAdmitted) || hasExecutableMasterPlan;
  const suggestedActive = useMemo(
    () =>
      (scheduleSource || []).filter((s) => {
        if (!s || s.status !== 'suggested') {
          return false;
        }
        if (!activeCycleId || !hasExecutableProposalContext) {
          return false;
        }
        if (s?.cycleId && s.cycleId !== activeCycleId) {
          return false;
        }
        if (!renderGoalId || !s?.goalId) {
          return true;
        }
        return s?.goalId === renderGoalId;
      }),
    [scheduleSource, activeCycleId, renderGoalId, hasExecutableProposalContext]
  );
  const hasExpiredDraftSchedule = Boolean(
    !hasAppliedReviewSchedule &&
      !hasActiveSchedule &&
      suggestedActive.length > 0 &&
      generatedScheduleDayKey &&
      runtimeLocalDayKey &&
      runtimeLocalDayKey !== generatedScheduleDayKey
  );
  const hasExpiredReviewSchedule = Boolean(
    hasPendingActivation && generatedScheduleDayKey && runtimeLocalDayKey && runtimeLocalDayKey !== generatedScheduleDayKey
  );
  const hasExpiredGeneratedSchedule = hasExpiredDraftSchedule || hasExpiredReviewSchedule;
  const generatedScheduleExpiredReason = hasExpiredGeneratedSchedule
    ? `Generated on ${formatDayKeyLabel(generatedScheduleDayKey)}. Reassess current state and regenerate before ${
        hasExpiredReviewSchedule ? 'activation' : 'applying this Sprint'
      }.`
    : '';
  const deliverableTitleById = useMemo(() => {
    const map = new Map();
    deliverables.forEach((d) => {
      if (d?.id) {
        map.set(d.id, d.title || d.id);
      }
    });
    return map;
  }, [deliverables]);
  const deliverableLabelById = useMemo(() => Object.fromEntries(deliverableTitleById), [deliverableTitleById]);
  const criterionTextById = useMemo(() => {
    const map = new Map();
    deliverables.forEach((d) => {
      (d.criteria || []).forEach((c) => {
        map.set(c.id, c.text || c.id);
      });
    });
    return map;
  }, [deliverables]);
  const criterionLabelById = useMemo(() => Object.fromEntries(criterionTextById), [criterionTextById]);
  const contract = canonicalContract;
  const contractWindowsCandidate = contract?.workWindows || activeCycle?.goalContract?.workWindows || {};
  const contractWorkWindows =
    countCanonicalWorkWindows(contractWindowsCandidate) > 0
      ? contractWindowsCandidate
      : availabilityPolicy?.workWindows || {};
  const normalizedContractWorkWindows = normalizeCanonicalWorkWindowsForUi(contractWorkWindows);
  const workWindowCount = countCanonicalWorkWindows(normalizedContractWorkWindows);
  const workWindowsSource =
    contract?.workWindowsSource ||
    activeCycle?.goalContract?.workWindowsSource ||
    availabilityPolicy?.workWindowsSource ||
    (workWindowCount > 0 ? 'user_defined' : 'unset');
  const capacityValidation =
    contract?.capacityValidation ||
    activeCycle?.goalContract?.capacityValidation ||
    availabilityPolicy?.capacityValidation ||
    null;
  const constraintsStatus =
    contract?.constraintsStatus ||
    activeCycle?.goalContract?.constraintsStatus ||
    availabilityPolicy?.constraintsStatus ||
    (workWindowCount === 0 ? 'unsaved' : workWindowsSource === 'system_inferred' ? 'unsaved' : 'approved');
  const hasConfirmedWorkWindows =
    workWindowCount > 0 && workWindowsSource !== 'system_inferred' && constraintsStatus !== 'unsaved';
  const hasApprovedCapacity = hasConfirmedWorkWindows && constraintsStatus !== 'stale' && constraintsStatus !== 'insufficient';
  const availableWeeklyMinutes =
    Number(capacityValidation?.availableWeeklyMinutes) || computeWeeklyCapacityMinutesUi(normalizedContractWorkWindows);
  const requiredWeeklyMinutes = Number.isFinite(Number(capacityValidation?.requiredWeeklyMinutes))
    ? Number(capacityValidation?.requiredWeeklyMinutes)
    : null;
  const gapWeeklyMinutes = Number.isFinite(Number(capacityValidation?.gapWeeklyMinutes))
    ? Number(capacityValidation?.gapWeeklyMinutes)
    : requiredWeeklyMinutes !== null
      ? Math.max(0, requiredWeeklyMinutes - availableWeeklyMinutes)
      : null;
  const capacityMitigationSuggestions = Array.isArray(capacityValidation?.mitigationSuggestions)
    ? capacityValidation.mitigationSuggestions
    : [];
  const canGenerateSchedule = Boolean(
    !isCycleReadOnly &&
    !suppressDrafts &&
    Boolean(activeCycleId) &&
    ((hasAdmittedGoal && isGoalAdmitted) || hasExecutableMasterPlan) &&
    !reassessmentRequired &&
    hasApprovedCapacity &&
    (!hasActiveSchedule || !hasVisibleCanonicalBlocks)
  );
  const blackoutDayKeys = Array.isArray(activeCycle?.strategy?.constraints?.blackoutDayKeys)
    ? activeCycle.strategy.constraints.blackoutDayKeys
    : [];
  const deadlineDayKey = getContractDeadlineDayKey(contract);
  // When in expanded horizon mode, extend the calendar range to cover forecast blocks
  const effectiveHorizonEndDayKey = useMemo(() => {
    if (!selectedHorizonMode || selectedHorizonMode === 'current_cycle') return deadlineDayKey;
    const forecastEnd = forecastCalendarBlocks.length > 0
      ? [...forecastCalendarBlocks]
          .map(b => b.dayKey || b.date)
          .filter(Boolean)
          .sort()
          .pop() || null
      : null;
    if (!forecastEnd) return deadlineDayKey;
    if (!deadlineDayKey) return forecastEnd;
    return forecastEnd > deadlineDayKey ? forecastEnd : deadlineDayKey;
  }, [selectedHorizonMode, deadlineDayKey, forecastCalendarBlocks]);
  const visibleScheduleEndDayKey =
    selectedHorizonMode && selectedHorizonMode !== 'current_cycle' ? effectiveHorizonEndDayKey || deadlineDayKey : deadlineDayKey;
  const getScheduleItemDayKey = (item) =>
    item?.dayKey || dayKeyFromISO(item?.startISO || item?.start || item?.date || '', timeZone);
  const proposalVisibilityFloorDayKey = pendingPlanConfirmation ? null : contractStartDayKey;
  const proposedScheduleItemsAll = useMemo(() => {
    const items = (suggestedActive || []).filter((item) => {
      const dayKey = getScheduleItemDayKey(item);
      if (!dayKey) {
        return false;
      }
      if (proposalVisibilityFloorDayKey && dayKey < proposalVisibilityFloorDayKey) {
        return false;
      }
      if (deadlineDayKey && dayKey > deadlineDayKey) {
        return false;
      }
      return true;
    });
    return items;
  }, [suggestedActive, proposalVisibilityFloorDayKey, deadlineDayKey, timeZone]);
  const activeScheduleVisibilityFloorDayKey = hasActiveSchedule ? null : contractStartDayKey;
  const activeScheduleVisibilityEndDayKey = hasActiveSchedule ? null : deadlineDayKey;
  const reviewScheduleVisibilityFloorDayKey = hasAppliedReviewSchedule ? null : contractStartDayKey;
  const reviewScheduleVisibilityEndDayKey = hasAppliedReviewSchedule ? null : deadlineDayKey;
  const reviewScheduleItemsAll = useMemo(() => {
    const items = (reviewScheduleBlocks || []).filter((item) => {
      const dayKey = getScheduleItemDayKey(item);
      if (!dayKey) {
        return false;
      }
      if (reviewScheduleVisibilityFloorDayKey && dayKey < reviewScheduleVisibilityFloorDayKey) {
        return false;
      }
      if (reviewScheduleVisibilityEndDayKey && dayKey > reviewScheduleVisibilityEndDayKey) {
        return false;
      }
      return true;
    });
    return items;
  }, [reviewScheduleBlocks, reviewScheduleVisibilityFloorDayKey, reviewScheduleVisibilityEndDayKey, timeZone]);
  const scheduleDisplayItemsAll = hasAppliedReviewSchedule ? reviewScheduleItemsAll : [];
  const canFallbackToCommittedBlocks =
    hasActiveSchedule ||
    (Boolean(scheduleApplied) && !pendingPlanConfirmation && proposedScheduleItemsAll.length === 0);
  const scheduleDisplayFallbackItemsAll = useMemo(() => {
    if (isInterCycle) {
      return [];
    }
    // If the user has selected an expanded horizon and the canonical full-horizon
    // substrate exists, prefer it as the Plan overview workload source.
    if (selectedHorizonMode && selectedHorizonMode !== 'current_cycle' && Array.isArray(fullHorizon) && fullHorizon.length > 0) {
      const filtered = (fullHorizon || []).filter((item) => {
        const dayKey = getScheduleItemDayKey(item);
        if (!dayKey) return false;
        if (contractStartDayKey && dayKey < contractStartDayKey) return false;
        if (visibleScheduleEndDayKey && dayKey > visibleScheduleEndDayKey) return false;
        return true;
      });
      if (filtered.length > 0) return filtered;
      // fall through to other fallbacks if full horizon substrate is empty after filtering
    }
    if (scheduleDisplayItemsAll.length > 0) {
      return scheduleDisplayItemsAll;
    }
    if (!canFallbackToCommittedBlocks) {
      return [];
    }
    const committedBlocks = normalizedBlocks.filter((block) => {
      const dayKey = getScheduleItemDayKey(block);
      if (!dayKey) {
        return false;
      }
      if (activeScheduleVisibilityFloorDayKey && dayKey < activeScheduleVisibilityFloorDayKey) {
        return false;
      }
      if (activeScheduleVisibilityEndDayKey && dayKey > activeScheduleVisibilityEndDayKey) {
        return false;
      }
      return true;
    });
    if (committedBlocks.length > 0) {
      return committedBlocks;
    }
    if (hasActiveSchedule && proposedScheduleItemsAll.length > 0) {
      return proposedScheduleItemsAll;
    }
    return committedBlocks;
  }, [
    hasAppliedReviewSchedule,
    hasActiveSchedule,
    canFallbackToCommittedBlocks,
    scheduleDisplayItemsAll,
    normalizedBlocks,
    proposedScheduleItemsAll,
    activeScheduleVisibilityFloorDayKey,
    activeScheduleVisibilityEndDayKey,
    visibleScheduleEndDayKey,
    isInterCycle,
    timeZone,
  ]);
  // Gate 2 cutover (dormant, default OFF): a dev flag enables the matrix calendar source for
  // testing; the operator flips matrixCalendarCutoverOn in production (no earlier than the rerun).
  // OFF → resolveCommittedCalendarSource returns the existing fallback unchanged (identical behavior).
  const [matrixCalendarCutoverOn, setMatrixCalendarCutoverOn] = useState(false);
  const matrixCalendarCutoverEnabled =
    matrixCalendarCutoverOn || isRuntimeEnvFlagEnabled('JERICHO_MATRIX_CALENDAR_CUTOVER');
  const scheduleDisplayItemsAllResolved = resolveCommittedCalendarSource({
    cutoverEnabled: matrixCalendarCutoverEnabled,
    cycle: activeCycle,
    fallbackItems: scheduleDisplayFallbackItemsAll,
  });
  const calendarSourceInfo = describeCalendarSource({
    cutoverEnabled: matrixCalendarCutoverEnabled,
    cycle: activeCycle,
  });
  const hasVisibleScheduleBlocks = scheduleDisplayItemsAllResolved.length > 0;
  const scheduleDisplayDayKeys = useMemo(
    () =>
      scheduleDisplayItemsAllResolved
        .map((item) => getScheduleItemDayKey(item))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [scheduleDisplayItemsAllResolved, timeZone]
  );
  const calendarSurfaceBlocksFull = useMemo(() => {
    const committed = normalizeScheduleSurfaceBlocks(scheduleDisplayItemsAllResolved);
    if (isInterCycle) {
      return !selectedHorizonMode || selectedHorizonMode === 'current_cycle' ? committed : [];
    }
    if (!selectedHorizonMode || selectedHorizonMode === 'current_cycle') return committed;
    const forecast = (Array.isArray(forecastCalendarBlocks) ? forecastCalendarBlocks : []).filter((block) => {
      const dayKey = block?.date || dayKeyFromISO(block?.start || block?.startISO || '', timeZone) || block?.dayKey || null;
      if (!dayKey) {
        return false;
      }
      if (contractStartDayKey && dayKey < contractStartDayKey) {
        return false;
      }
      if (visibleScheduleEndDayKey && dayKey > visibleScheduleEndDayKey) {
        return false;
      }
      return true;
    });
    return mergeCalendarSurfaceBlocks(committed, forecast);
  }, [
    scheduleDisplayItemsAllResolved,
    selectedHorizonMode,
    forecastCalendarBlocks,
    isInterCycle,
    contractStartDayKey,
    visibleScheduleEndDayKey,
    timeZone,
  ]);
  // Gate 8 — calendar scope toggle: isolate blocks by matrix category (node-level). 'full'
  // is a pure pass-through, so default behavior is unchanged. All downstream consumers read
  // the scoped list, so day/month/metrics scope together; returning to 'full' restores the
  // complete schedule. Options are enumerated from the FULL (unscoped) list.
  const [calendarScope, setCalendarScope] = useState('full');
  const calendarSurfaceBlocks = useMemo(
    () => filterCalendarBlocksByScope(calendarSurfaceBlocksFull, calendarScope, calendarScopeMatrix),
    [calendarSurfaceBlocksFull, calendarScope, calendarScopeMatrix]
  );
  const calendarScopeOptions = useMemo(
    () => availableBlockScopes(calendarSurfaceBlocksFull, calendarScopeMatrix),
    [calendarSurfaceBlocksFull, calendarScopeMatrix]
  );
  const shouldShowMasterPlanForecastInspectionNotice =
    view === 'today' &&
    Boolean(selectedHorizonMode && selectedHorizonMode !== 'current_cycle') &&
    isInterCycle &&
    Array.isArray(fullHorizon) &&
    fullHorizon.length > 0;
  const calendarDayBlocksMap = useMemo(() => {
    const map = new Map();
    (calendarSurfaceBlocks || []).forEach((b) => {
      const key = b.date || dayKeyFromISO(b.start || '', timeZone);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(b);
    });
    return map;
  }, [calendarSurfaceBlocks, timeZone]);
  const selectedDayBlocks = calendarDayBlocksMap.get(selectedCalendarDayKey) || [];
  const dailyCheckInView = useMemo(() => {
    if (!hasVisibleScheduleBlocks || !hasActiveSchedule) {
      return null;
    }
    const planningIntake =
      canonicalContract?.planningIntake || activeCycle?.goalContract?.planningIntake || goalExecutionContract?.planningIntake || null;
    const feasibilityAssessment =
      activePlanSummary?.feasibilityAssessment ||
      activeCycle?.goalContract?.feasibilityAssessment ||
      canonicalContract?.feasibilityAssessment ||
      null;
    const asOfISO = appTime?.nowISO || `${effectiveExecutionDayKey}T12:00:00.000Z`;
    return deriveDailyCheckIn({
      plan: {
        scheduledBlocks: scheduleDisplayItemsAllResolved,
        summary: {
          plannedCompletionDate:
            scheduleDisplayItemsAllResolved[scheduleDisplayItemsAllResolved.length - 1]?.endISO ||
            scheduleDisplayItemsAllResolved[scheduleDisplayItemsAllResolved.length - 1]?.startISO ||
            null,
          feasibilityAssessment,
          capitalAcquisitionFeasibility:
            activeCycle?.goalContract?.prePlanFeasibility ||
            activeCycle?.goalContract?.capitalAcquisitionFeasibility ||
            null,
        },
      },
      completionLog: executionEvents || [],
      asOf: asOfISO,
      feasibilityAssessment,
      intake: planningIntake,
    });
  }, [
    hasVisibleScheduleBlocks,
    canonicalContract,
    activeCycle,
    goalExecutionContract,
    activePlanSummary,
    appTime?.nowISO,
    activeDayKey,
    effectiveExecutionDayKey,
    scheduleDisplayItemsAllResolved,
    executionEvents,
  ]);
  const committedDayKeys = useMemo(
    () => Array.from(calendarDayBlocksMap.keys()).sort((a, b) => a.localeCompare(b)),
    [calendarDayBlocksMap]
  );
  const firstCommittedDayKey = committedDayKeys[0] || null;
  const monthDays = useMemo(() => {
    const anchor = anchorDayKey || viewDate || activeDayKey || today?.date || currentWeek?.weekStart || nowDayKey(timeZone);
    return projectMonthDays({ monthKey: anchor, blocks: calendarSurfaceBlocks, includePadding: true });
  }, [anchorDayKey, viewDate, today, currentWeek, activeDayKey, timeZone, calendarSurfaceBlocks]);
  const proposedScheduleItems = useMemo(() => {
    if (!viewDayKey) return proposedScheduleItemsAll;
    return proposedScheduleItemsAll.filter((item) => {
      const dayKey = getScheduleItemDayKey(item);
      return dayKey === viewDayKey;
    });
  }, [proposedScheduleItemsAll, viewDayKey, timeZone]);
  const proposedScheduleItemsGrouped = useMemo(
    () =>
      Object.entries(
        proposedScheduleItemsAll.reduce((acc, item) => {
          const dayKey = getScheduleItemDayKey(item);
          if (!dayKey) return acc;
          if (!acc[dayKey]) acc[dayKey] = [];
          acc[dayKey].push(item);
          return acc;
        }, {})
      ).sort(([a], [b]) => a.localeCompare(b)),
    [proposedScheduleItemsAll, timeZone]
  );
  const scheduleWindowItems = hasAppliedReviewSchedule
    ? reviewScheduleItemsAll
    : hasActiveSchedule
      ? scheduleDisplayItemsAllResolved
      : proposedScheduleItemsAll;
  const scheduleWindowDayKeys = scheduleWindowItems
    .map((item) => getScheduleItemDayKey(item))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const schedulePreviewWindowLabel =
    scheduleWindowDayKeys.length > 0
      ? formatRangeLabel(scheduleWindowDayKeys[0], scheduleWindowDayKeys[scheduleWindowDayKeys.length - 1])
      : reassessmentRequired && activeCycle
        ? 'Pending reassessment'
        : activeCycle
          ? 'Will be set when the first Sprint is generated'
          : 'No active Operating Cycle';
  const todayCalendarWindowLabel = windowLabel || '—';
  const scheduledPreviewBlockCount = Number(activePlanSummary?.scheduledBlockCount || proposedScheduleItemsAll.length || 0);
  const unscheduledPreviewBlockCount = Number(activePlanSummary?.unscheduledBlockCount || 0);
  const scheduledPreviewMinutes = Number(
    activePlanSummary?.scheduledMinutes ||
      proposedScheduleItemsAll.reduce((sum, item) => sum + Number(item?.durationMinutes || 0), 0)
  );
  const unscheduledPreviewMinutes = Number(activePlanSummary?.unscheduledMinutes || 0);
  const partialScheduleReason = String(activePlanSummary?.partialScheduleReason || '').trim() || null;
  const activePhaseDeadlineDayKey = activePlanSummary?.activePhaseDeadlineDayKey || deadlineDayKey || null;
  const scheduleCoverageThroughDayKey =
    activePlanSummary?.calendarCoverageThroughDayKey ||
    scheduleWindowDayKeys[scheduleWindowDayKeys.length - 1] ||
    null;
  const scheduleCoverageStatus = String(activePlanSummary?.coverageStatus || '')
    .trim()
    .toLowerCase();
  const scheduleCoverageStatusLabel =
    scheduleCoverageStatus === 'complete_to_anchor'
      ? 'Complete to anchor'
      : scheduleCoverageStatus === 'partial_before_anchor'
        ? 'Partial before anchor'
        : scheduleCoverageStatus === 'failed_before_anchor'
          ? 'Failed before anchor'
          : 'Pending';
  const coverageFailureReason = String(activePlanSummary?.coverageFailureReason || '').trim() || null;
  const unscheduledReasonLabels = (Array.isArray(activePlanSummary?.unscheduledReasons) ? activePlanSummary.unscheduledReasons : [])
    .map((reason) => {
      if (!reason) {
        return null;
      }
      if (reason?.reasonCode === 'INSUFFICIENT_SCHEDULE_SLOTS') {
        return `Unscheduled remaining workload: ${reason.count || 0} block${Number(reason.count || 0) === 1 ? '' : 's'} / ${Math.round(
          Number(reason.minutes || 0) / 60
        )}h due to current preview-window capacity.`;
      }
      if (reason?.reasonCode === 'UNACTIONABLE_BLOCK_TITLE') {
        return `Skipped non-actionable draft item${reason.originalTitle ? `: ${reason.originalTitle}` : ''}.`;
      }
      if (reason?.reasonCode === 'PARTIAL_BEFORE_ANCHOR' || reason?.reasonCode === 'FAILED_BEFORE_ANCHOR') {
        return `Coverage shortfall: ${formatRangeLabel(
          reason.latestScheduledDayKey || null,
          reason.activePhaseDeadlineDayKey || null
        )}.`;
      }
      return formatCanonicalReasonLabel(reason.reasonCode || reason.code || 'UNSCHEDULED_WORK');
    })
    .filter(Boolean);
  const activeMasterPlanLanes = useMemo(
    () =>
      Array.isArray(activeMasterPlan?.laneIds)
        ? activeMasterPlan.laneIds.map((laneId) => masterPlanLanesById?.[laneId] || null).filter(Boolean)
        : [],
    [activeMasterPlan, masterPlanLanesById]
  );
  const activeMasterPlanMilestones = useMemo(
    () =>
      activeMasterPlanLanes.flatMap((lane) =>
        Array.isArray(lane?.milestoneIds)
          ? lane.milestoneIds.map((milestoneId) => masterPlanMilestonesById?.[milestoneId] || null).filter(Boolean)
          : []
      ),
    [activeMasterPlanLanes, masterPlanMilestonesById]
  );
  const activeMasterPlanAnchors = useMemo(
    () => (Array.isArray(activeMasterPlan?.anchors) ? activeMasterPlan.anchors : []),
    [activeMasterPlan]
  );
  const activeMasterPlanCriticQuestionsByLane = useMemo(
    () => mapMasterPlanCriticQuestionsByLane(activeMasterPlan, activeMasterPlanLanes),
    [activeMasterPlan, activeMasterPlanLanes]
  );
  const phaseModel = useMemo(
    () =>
      deriveMasterPlanPhaseModel({
        plan: activeMasterPlan,
        lanes: activeMasterPlanLanes,
        milestones: activeMasterPlanMilestones,
        anchors: activeMasterPlanAnchors,
        planCycle: activeCycle,
        committedBlocks: proposedScheduleItemsAll.length > 0 ? proposedScheduleItemsAll : normalizedBlocks,
        criticQuestionsByLane: activeMasterPlanCriticQuestionsByLane,
      }),
    [
      activeMasterPlan,
      activeMasterPlanLanes,
      activeMasterPlanMilestones,
      activeMasterPlanAnchors,
      activeCycle,
      proposedScheduleItemsAll,
      normalizedBlocks,
      activeMasterPlanCriticQuestionsByLane,
    ]
  );
  const activePhase = phaseModel?.activePhase || null;
  const nextPhase = phaseModel?.nextPhase || null;
  const activePhaseStatusReport = activePhase?.statusReport || null;
  const blockHierarchyContext = useMemo(
    () => ({
      phase: activePhase ? `${activePhase.label}${activePhase.name ? ` / ${activePhase.name}` : ''}` : undefined,
      operatingCycle: executionCycleHorizonLabel,
      sprint: schedulePreviewWindowLabel,
      // Canonical lane lookup map. BlockDetailsPanel uses this to resolve a
      // block's lane label when the block itself carries laneId but the
      // canonical laneLabel was dropped along some upstream materialization
      // path. Prevents BlockDetailsPanel detail-authority from emitting
      // UNKNOWN_LANE_IDENTITY when the canonical lane is recoverable.
      lanesById: masterPlanLanesById || null,
      masterPlan: activeMasterPlan || null,
    }),
    [activePhase, executionCycleHorizonLabel, schedulePreviewWindowLabel, masterPlanLanesById, activeMasterPlan]
  );
  const generateDisabledReason = isCycleReadOnly
    ? 'Cycle is read-only.'
    : suppressDrafts
      ? `Drafts begin on ${formatDayKeyLabel(contractStartDayKey)}.${contractStartIsDelayed && contractStartReasonLabel ? ` ${contractStartReasonLabel}` : ''}`
      : !activeCycleId
        ? 'Start an Operating Cycle first.'
        : !((hasAdmittedGoal && isGoalAdmitted) || hasExecutableMasterPlan)
          ? 'Complete goal setup in Structure first.'
          : reassessmentRequired
            ? 'Current-state reassessment is required before schedule generation.'
            : !hasConfirmedWorkWindows
              ? 'Define and save work windows before generating a schedule.'
              : constraintsStatus === 'stale'
                ? 'Re-save work windows to revalidate availability.'
                : constraintsStatus === 'insufficient'
                  ? 'Availability is insufficient for the first-cycle workload.'
                  : lastPlanError?.code === 'NO_PROPOSED_BLOCKS'
                    ? 'No schedulable blocks were generated.'
              : hasActiveSchedule && hasVisibleCanonicalBlocks
                    ? 'An active schedule already exists.'
                    : '';
  const applyDisabledReason = isCycleReadOnly
    ? 'Cycle is read-only.'
    : suppressDrafts
      ? `Drafts begin on ${formatDayKeyLabel(contractStartDayKey)}.${contractStartIsDelayed && contractStartReasonLabel ? ` ${contractStartReasonLabel}` : ''}`
      : requiresHorizonResolution && !selectedPlanResolutionKind
        ? 'Resolve the horizon conflict first.'
    : hasExpiredGeneratedSchedule
      ? generatedScheduleExpiredReason
      : proposedScheduleItemsAll.length === 0
          ? 'Generate the first Sprint first.'
          : hasActiveSchedule
            ? 'Activated Plan is already live.'
            : '';
  const activateDisabledReason = isCycleReadOnly
    ? 'Cycle is read-only.'
    : suppressDrafts
      ? `Drafts begin on ${formatDayKeyLabel(contractStartDayKey)}.${contractStartIsDelayed && contractStartReasonLabel ? ` ${contractStartReasonLabel}` : ''}`
      : hasExpiredGeneratedSchedule
        ? generatedScheduleExpiredReason
      : hasActiveSchedule
        ? 'Activated Plan is already live.'
        : !hasAppliedReviewSchedule || reviewScheduleBlocks.length === 0
          ? 'Apply the Sprint first.'
          : '';
  const scheduleDisplayItems = useMemo(() => {
    if (!viewDayKey) return scheduleDisplayItemsAllResolved;
    return scheduleDisplayItemsAllResolved.filter((item) => {
      const dayKey = getScheduleItemDayKey(item);
      return dayKey === viewDayKey;
    });
  }, [scheduleDisplayItemsAllResolved, viewDayKey, timeZone]);
  const scheduleDisplayItemsGrouped = useMemo(
    () =>
      Object.entries(
        scheduleDisplayItemsAllResolved.reduce((acc, item) => {
          const dayKey = getScheduleItemDayKey(item);
          if (!dayKey) return acc;
          if (!acc[dayKey]) acc[dayKey] = [];
          acc[dayKey].push(item);
          return acc;
        }, {})
      ).sort(([a], [b]) => (a < b ? -1 : 1)),
    [scheduleDisplayItemsAllResolved, timeZone]
  );
  const committedHorizonMonths = useMemo(() => {
    const horizonEndKey = effectiveHorizonEndDayKey || deadlineDayKey;
    if (!calendarSurfaceBlocks.length || !horizonEndKey) return [];
    const horizonStartDayKey =
      contractStartDayKey ||
      calendarSurfaceBlocks
        .map((block) => block?.date || dayKeyFromISO(block?.start || '', timeZone))
        .filter(Boolean)
        .sort()[0] ||
      null;
    if (!horizonStartDayKey) return [];
    return getMonthStartKeysInRange(horizonStartDayKey, horizonEndKey).map((monthStartKey) => {
      const monthPrefix = monthStartKey.slice(0, 7);
      const monthBlocks = calendarSurfaceBlocks
        .filter((block) => {
          const blockDayKey = block?.date || dayKeyFromISO(block?.start || '', timeZone);
          return Boolean(blockDayKey && blockDayKey.slice(0, 7) === monthPrefix);
        })
        .sort((left, right) => {
          const leftKey = left?.start || left?.date || '';
          const rightKey = right?.start || right?.date || '';
          return leftKey.localeCompare(rightKey);
        });
      const dayGroups = Object.entries(
        monthBlocks.reduce((acc, block) => {
          const dayKey = block?.date || dayKeyFromISO(block?.start || '', timeZone);
          if (!dayKey) return acc;
          if (!acc[dayKey]) acc[dayKey] = [];
          acc[dayKey].push(block);
          return acc;
        }, {})
      ).sort(([a], [b]) => a.localeCompare(b));
      return {
        monthStartKey,
        label: formatWindowLabel(buildWindowSpec('month', `${monthStartKey}T12:00:00.000Z`, timeZone), timeZone),
        monthBlocks,
        dayGroups,
        emptyReasonLabel: deriveGapReasonLabel({
          dayKey: monthStartKey,
          hasBlocks: monthBlocks.length > 0,
          contractStartDayKey,
          deadlineDayKey: effectiveHorizonEndDayKey || deadlineDayKey,
          scheduleDayKeys: scheduleDisplayDayKeys,
          blackoutDayKeys,
          workWindows: contractWorkWindows,
          lastPlanError,
          timeZone,
        }),
      };
    });
  }, [
    calendarSurfaceBlocks,
    effectiveHorizonEndDayKey,
    deadlineDayKey,
    contractStartDayKey,
    scheduleDisplayDayKeys,
    blackoutDayKeys,
    contractWorkWindows,
    lastPlanError,
    timeZone,
  ]);
  const scheduleHorizonLabel = hasActiveSchedule
    ? 'Active canonical horizon'
    : hasAppliedReviewSchedule
      ? 'Review canonical horizon'
      : 'Committed canonical horizon';
  const scheduleHorizonDescription = hasActiveSchedule
    ? 'One canonical active schedule is rendered as month slices through the current deadline.'
    : hasAppliedReviewSchedule
      ? 'One canonical review schedule is rendered as month slices through the current deadline.'
      : 'One canonical schedule is rendered as month slices through the current deadline.';
  const scheduleHorizonEmptyLabel = hasActiveSchedule
    ? 'No active blocks in this visible slice.'
    : hasAppliedReviewSchedule
      ? 'No review blocks in this visible slice.'
      : 'No committed blocks in this visible slice.';
  const scheduleHorizonCoverageLabel = hasActiveSchedule
    ? 'This visible slice reflects the canonical active schedule.'
    : hasAppliedReviewSchedule
      ? 'This visible slice reflects the canonical review schedule.'
      : 'This visible slice reflects the canonical schedule.';
  const committedHorizonCoversDeadlineWindow = useMemo(() => {
    if (!deadlineDayKey || committedHorizonMonths.length === 0) {
      return false;
    }
    if (hasAppliedReviewSchedule || hasActiveSchedule) {
      return calendarSurfaceBlocks.length > 0;
    }
    return committedHorizonMonths.every((month) => month.monthBlocks.length > 0);
  }, [
    calendarSurfaceBlocks.length,
    committedHorizonMonths,
    deadlineDayKey,
    hasActiveSchedule,
    hasAppliedReviewSchedule,
  ]);
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
    if (strictProgressMode && pendingPlacement.isProgress && !pendingPlacement.criterionId) {
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
        resolvedDayKey: dayKeyFromISO(startISO, timeZone),
      });
    }
    setAddBlockError('');
    emitAction(
      'suggestedPath.assignPlacement',
      {
        cycleId: activeCycleId,
        suggestionId: pendingPlacement.suggestionId,
        deliverableId: pendingPlacement.isProgress ? pendingPlacement.deliverableId || null : null,
        criterionId: pendingPlacement.isProgress ? pendingPlacement.criterionId || null : null,
      },
      actions.assignSuggestionLink
    );
    if (actions.acceptSuggestedBlockWithPlacement) {
      traceAction('suggestedPath.accept', { suggestionId: pendingPlacement.suggestionId, cycleId: activeCycleId });
      actions.acceptSuggestedBlockWithPlacement(pendingPlacement.suggestionId, {
        start: startISO,
        durationMinutes: pendingPlacement.durationMinutes,
        domain: applyDomainEnum(pendingPlacement.domain),
        title: pendingPlacement.title || 'Untitled task',
        surface: 'today',
        timeZone,
        deliverableId: pendingPlacement.isProgress ? pendingPlacement.deliverableId || null : null,
        criterionId: pendingPlacement.isProgress ? pendingPlacement.criterionId || null : null,
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
          timeZone,
        });
      }
    }
    emitAction('today.nav.selectDay', { dayKey: pendingPlacement.date }, actions.setViewDate);
    setPendingPlacement(null);
  };

  const handleCloseLinkedCriterion = (block) => {
    if (!block?.deliverableId || !block?.criterionId) return;
    emitAction(
      'deliverables.toggleCriterion',
      {
        cycleId: activeCycleId,
        deliverableId: block.deliverableId,
        criterionId: block.criterionId,
        isDone: true,
      },
      actions.toggleCriterionDone
    );
  };

  const monthDayMetrics = useMemo(
    () => computeDayMetricsMap({ blocks: calendarSurfaceBlocks, dayKeys: (monthDays || []).map((d) => d.date) }),
    [calendarSurfaceBlocks, monthDays]
  );
  const monthDaysWithMetrics = useMemo(
    () =>
      (monthDays || []).map((d) => {
        const m = monthDayMetrics[d.date];
        if (!m) return d;
        return {
          ...d,
          plannedMinutes: m.plannedMinutes,
          completedMinutes: m.completedMinutes,
          completionRate: m.cr,
        };
      }),
    [monthDays, monthDayMetrics]
  );
  const monthViewDays = useMemo(
    () =>
      (monthDaysWithMetrics || []).map((day) => {
        const blocks = Array.isArray(day?.blocks) ? day.blocks : [];
        const plannedCount = blocks.length;
        const completedCount = blocks.filter((block) => block?.status === 'completed' || block?.status === 'complete').length;
        const completionRate =
          Number.isFinite(day?.completionRate) && day.completionRate >= 0
            ? day.completionRate
            : plannedCount
              ? completedCount / plannedCount
              : 0;
        return {
          date: day.date,
          dayNumber: Number(String(day.date || '').slice(8, 10)),
          inMonth: Boolean(day.inMonth),
          plannedCount,
          completedCount,
          completionRate,
          blocks,
          moreCount: Math.max(0, blocks.length - 2),
          gapReasonLabel: deriveGapReasonLabel({
            dayKey: day.date,
            hasBlocks: blocks.length > 0,
            contractStartDayKey,
            deadlineDayKey,
            scheduleDayKeys: scheduleDisplayDayKeys,
            blackoutDayKeys,
            workWindows: contractWorkWindows,
            lastPlanError,
            timeZone,
          }),
        };
      }),
    [
      monthDaysWithMetrics,
      contractStartDayKey,
      deadlineDayKey,
      scheduleDisplayDayKeys,
      blackoutDayKeys,
      contractWorkWindows,
      lastPlanError,
      timeZone,
    ]
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

  const handleCreateForDate = (
    dateKey,
    { title, domain, durationMinutes, time, linkToGoal, deliverableId, criterionId, isProgress }
  ) => {
    if (isCycleReadOnly) return;
    if (strictProgressMode && isProgress && !criterionId) {
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
        resolvedDayKey: dayKeyFromISO(startISO, timeZone),
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
      isProgress,
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
      deliverableId: isProgress ? deliverableId || null : null,
      criterionId: isProgress ? criterionId || null : null,
    });
    emitAction('today.nav.selectDay', { dayKey: dateKey }, actions.setViewDate);
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
    const startISO = patch?.start || buildStartISO(dateKey, timeValue);
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
      start: startISO,
      durationMinutes,
      domain: applyDomainEnum(patch.domain || target?.domain || target?.practice),
      title: patch?.title,
      surface: 'today',
    });
    setAddBlockError('');
    if (patch?.date) actions.setViewDate?.(patch.date);
  };

  const handleDeleteBlock = (id) => {
    if (isCycleReadOnly) return;
    const target = (normalizedBlocks || []).find((b) => b.id === id);
    if (target?.requiredSystemBlock || String(target?.origin || '').trim() === 'schedule_active') {
      setAddBlockError('Required active block: reschedule it instead of deleting.');
      return;
    }
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

  const handleMissBlock = (id) => {
    if (isCycleReadOnly) return;
    traceAction('blocks.miss', { blockId: id });
    actions.missBlock?.(id);
  };

  const handleDrillToDay = (dayKey) => {
    if (!dayKey) return;
    traceAction('today.nav.selectDay', { dayKey });
    setAnchorDayKey(dayKey);
    setZionView('day');
    actions.setViewDate?.(dayKey);
  };

  const shiftAnchor = (delta) => {
    if (zionView === 'today') return;
    const nextKey = shiftAnchorDayKey(anchorISO, zionView, delta, timeZone);
    if (!nextKey) return;
    traceAction(delta > 0 ? 'today.nav.next' : 'today.nav.prev', { dayKey: nextKey, view: zionView });
    if (zionView === 'day') {
      setAnchorDayKey(nextKey);
      actions.setViewDate?.(nextKey);
    } else {
      setAnchorDayKey(nextKey);
    }
  };

  const jumpToAnchorToday = () => {
    const todayKey = dayKeyFromISO(new Date().toISOString(), todayTruthTimeZone);
    if (todayKey) setAnchorDayKey(todayKey);
    traceAction('today.nav.today', { dayKey: todayKey, view: zionView });
    actions.jumpToToday?.();
    setZionView('today');
  };

  const handleGenerateSchedule = () => {
    if (isCycleReadOnly || suppressDrafts) return;
    const cycleId = activeCycleId || null;
    const generationAnchorDayKey =
      zionView === 'today'
        ? runtimeTodayDayKey
        : zionView === 'day'
          ? selectedCalendarDayKey || activeDayKey || runtimeTodayDayKey || null
          : activeDayKey || runtimeTodayDayKey || null;
    if (!(hasAdmittedGoal && isGoalAdmitted) && !hasExecutableMasterPlan) {
      traceAction('schedule.generate.blocked.missing-goal', { cycleId, goalId: goalId || null });
      return;
    }
    if (hasStaleActiveSchedule) {
      traceAction('schedule.generate.recover.stale-active', {
        cycleId,
        goalId: goalId || null,
        anchorDayKey: generationAnchorDayKey,
      });
    }
    traceAction('schedule.generate.click', { cycleId, anchorDayKey: generationAnchorDayKey });
    if (typeof actions.generateScheduleForActiveCycle === 'function') {
      actions.generateScheduleForActiveCycle({ cycleId, anchorDayKey: generationAnchorDayKey });
      return;
    }
    if (typeof actions.generatePlanWithLLM === 'function') {
      actions.generatePlanWithLLM({ cycleId, anchorDayKey: generationAnchorDayKey });
      return;
    }
    actions.generatePlan?.({ cycleId, anchorDayKey: generationAnchorDayKey });
  };

  const handleApplySchedule = () => {
    if (
      isCycleReadOnly ||
      suppressDrafts ||
      hasExpiredGeneratedSchedule ||
      hasActiveSchedule ||
      proposedScheduleItemsAll.length === 0 ||
      (requiresHorizonResolution && !selectedPlanResolutionKind)
    ) {
      return;
    }
    const cycleId = activeCycleId || null;
    traceAction('schedule.apply.click', { cycleId, count: proposedScheduleItemsAll.length });
    if (typeof actions.applyPlan === 'function') {
      actions.applyPlan({
        cycleId,
        resolutionKind: requiresHorizonResolution ? selectedPlanResolutionKind : undefined,
      });
      const firstBlock = proposedScheduleItemsAll.slice().sort((a, b) => {
        const left = a?.startISO || a?.start || a?.date || '';
        const right = b?.startISO || b?.start || b?.date || '';
        return left < right ? -1 : 1;
      })[0];
      if (firstBlock) {
        const firstDayKey = dayKeyFromISO(
          firstBlock?.startISO || firstBlock?.start || firstBlock?.date || '',
          timeZone
        );
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
      resolutionKind: requiresHorizonResolution ? selectedPlanResolutionKind : undefined,
      items: proposedScheduleItemsAll.map((item) => ({
        id: item.id,
        dayKey: item.dayKey || dayKeyFromISO(item.startISO || '', timeZone),
        startISO: item.startISO,
        minutes: item.durationMinutes,
        title: item.title,
        domainKey: item.domain,
      })),
    });
  };

  const handleActivateSchedule = () => {
    if (isCycleReadOnly || suppressDrafts || hasExpiredGeneratedSchedule || hasActiveSchedule || !hasAppliedReviewSchedule) return;
    const cycleId = activeCycleId || null;
    traceAction('schedule.activate.click', { cycleId, count: reviewScheduleBlocks.length });
    if (typeof actions.activateSchedule === 'function') {
      actions.activateSchedule({ cycleId });
      const firstBlock = reviewScheduleBlocks.slice().sort((a, b) => {
        const left = a?.startISO || a?.start || a?.date || '';
        const right = b?.startISO || b?.start || b?.date || '';
        return left < right ? -1 : 1;
      })[0];
      if (firstBlock) {
        const firstDayKey = dayKeyFromISO(
          firstBlock?.startISO || firstBlock?.start || firstBlock?.date || '',
          timeZone
        );
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
      items: reviewScheduleBlocks.map((item) => ({
        id: item.id,
        dayKey: item.dayKey || dayKeyFromISO(item.startISO || '', timeZone),
        startISO: item.startISO,
        minutes: item.durationMinutes,
        title: item.title,
        domainKey: item.domain,
      })),
    });
  };

  const handleRebaseSchedule = () => {
    if (isCycleReadOnly || hasActiveSchedule || !hasAppliedReviewSchedule) return;
    const cycleId = activeCycleId || null;
    const executionStartDayKey =
      lastPlanError?.meta?.executionStartDayKey || activeDayKey || appTime?.activeDayKey || today?.date || null;
    traceAction('schedule.rebase.click', { cycleId, executionStartDayKey, errorCode: lastPlanError?.code || null });
    actions.rebaseSchedule?.({
      cycleId,
      executionStartDayKey,
      ...(activationDelayReassessmentRequired
        ? { activationDelayResolution: 'rebase', workHappenedDuringDelay: 'none' }
        : {}),
    });
  };

  const handleCompleteCycleReassessment = () => {
    if (!activeCycleId || typeof actions.completeCycleReassessment !== 'function') {
      return;
    }
    traceAction('cycle.reassessment.accept', { cycleId: activeCycleId });
    actions.completeCycleReassessment(activeCycleId);
  };

  const jumpToFirstCommittedDay = () => {
    if (!firstCommittedDayKey) return;
    traceAction('today.nav.firstCommittedDay', { dayKey: firstCommittedDayKey, cycleId: activeCycleId });
    setAnchorDayKey(firstCommittedDayKey);
    setZionView('day');
    actions.setViewDate?.(firstCommittedDayKey);
  };

  const openCommittedMonth = () => {
    const targetDayKey = firstCommittedDayKey || anchorDayKey || activeDayKey;
    if (!targetDayKey) return;
    traceAction('today.nav.committedMonth', { dayKey: targetDayKey, cycleId: activeCycleId });
    setAnchorDayKey(targetDayKey);
    setZionView('month');
  };

  const handleApplyRenegotiationOption = (option, index) => {
    if (isCycleReadOnly || !option) return;
    const optionType = String(option?.type || '')
      .trim()
      .toUpperCase();
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
    scoringWindowDays: probability?.scoringSummary?.K,
  });
  const probabilityWindowLabel = formatProbabilityWindowLabel(probabilityWindowSpec);
  const cycleMetrics = activeCycle?.metrics || {};
  const feasibilityScore = Number.isFinite(cycleMetrics.feasibilityScore)
    ? Number(cycleMetrics.feasibilityScore)
    : null;
  const integrityScoreCycle = Number.isFinite(cycleMetrics.integrityScore) ? Number(cycleMetrics.integrityScore) : null;
  const safeStability = stabilityView || {};
  const stabilityE2E = useMemo(() => buildStabilityEndToEndSummary(), []);
  const isStabilityBlankState = useMemo(
    () =>
      isCanonicalBlankState({
        activeProfileId,
        profilesById,
        goalsById,
        masterPlansById,
        goalExecutionContract,
        activeCycleId,
        cyclesById,
        scheduleApplied,
        scheduleLifecycle: activeCycle?.scheduleLifecycle || null,
        executionEvents,
        externalEvidenceEvents: activeCycle?.externalEvidenceEvents || [],
      }),
    [
      activeProfileId,
      profilesById,
      goalsById,
      masterPlansById,
      goalExecutionContract,
      activeCycleId,
      cyclesById,
      scheduleApplied,
      activeCycle?.scheduleLifecycle,
      activeCycle?.externalEvidenceEvents,
      executionEvents,
    ]
  );
  const stabilityRecoverySummary = useMemo(() => {
    const lanes = stabilityE2E?.laneVerifications || [];
    return {
      withSignals: lanes.filter((lane) => lane.recovery.signalCount > 0).length,
      noRecoveryNeeded: lanes.filter((lane) => lane.recovery.signalCount === 0).length,
      confirmationRequired: lanes.filter((lane) => lane.recovery.recommendation.confirmationRequired).length,
    };
  }, [stabilityE2E]);
  const hasAdmittedGoalContext = Boolean(goalId || activeMasterPlan?.id || goalExecutionContract);
  const hasMasterPlanContext = Boolean(activeMasterPlan?.id || Object.keys(masterPlansById || {}).length > 0);
  const hasGoalContractContext = Boolean(goalExecutionContract);
  const hasActiveExecutionCycle = Boolean(activeCycleId && activeCycle);
  const hasExecutionEvidence =
    (Array.isArray(executionEvents) && executionEvents.length > 0) ||
    (Array.isArray(activeCycle?.externalEvidenceEvents) && activeCycle.externalEvidenceEvents.length > 0) ||
    goalPolicy?.livePos?.score?.state === 'available';
  const canPopulateInitialFeasibility = hasAdmittedGoalContext || hasMasterPlanContext || hasGoalContractContext;
  const canPopulateLivePOS = hasAdmittedGoalContext && hasExecutionEvidence;
  const canPopulateExecutionMetrics = hasActiveExecutionCycle && hasExecutionEvidence;
  const shouldShowUnavailableExecutionMetrics = !canPopulateExecutionMetrics;
  const canShowCycleFrictionInputs = hasActiveExecutionCycle;
  const canRecordCycleFriction =
    canShowCycleFrictionInputs && !isStabilityBlankState && frictionGoalOptions.length > 0 && activeProfileCycleIds.length > 0;
  const stabilityScoreRaw = Math.min(
    Number.isFinite(safeStability.completionRate) ? safeStability.completionRate : 0,
    Number.isFinite(safeStability.driftScore) ? safeStability.driftScore : 0,
    Number.isFinite(safeStability.streakScore) ? safeStability.streakScore : 0,
    Number.isFinite(safeStability.momentumScore) ? safeStability.momentumScore : 0
  );
  const stabilityScore = Math.max(0, Math.min(100, Math.round(stabilityScoreRaw * 100)));
  const stabilityBand = stabilityScore >= 80 ? 'High' : stabilityScore >= 50 ? 'Moderate' : 'Low';
  const canonicalLivePos = goalPolicy?.livePos || null;
  const livePosAdmissionState = canonicalLivePos?.state || 'withheld';
  const livePosAvailable =
    (livePosAdmissionState === 'available' || livePosAdmissionState === 'provisional' || livePosAdmissionState === 'eligible') &&
    canonicalLivePos?.score?.state === 'available';
  const livePosAvailabilityLabel =
    livePosAdmissionState === 'provisional'
      ? 'Provisional'
      : livePosAvailable
        ? 'Available'
        : 'Withheld';
  const livePosStateLabel = formatLivePosStateLabel(canonicalLivePos?.liveState);
  const livePosPercent =
    Number.isFinite(canonicalLivePos?.percent)
      ? Number(canonicalLivePos.percent)
      : Number.isFinite(canonicalLivePos?.score?.value)
        ? Math.round(Number(canonicalLivePos.score.value) * 100)
        : null;
  const livePosPrimaryValue = livePosAvailable
    ? `${livePosPercent}%`
    : 'Withheld';
  const livePosRangeLabel =
    Array.isArray(canonicalLivePos?.range) &&
    Number.isFinite(canonicalLivePos?.range?.[0]) &&
    Number.isFinite(canonicalLivePos?.range?.[1])
      ? `${Math.round(canonicalLivePos.range[0] * 100)}-${Math.round(canonicalLivePos.range[1] * 100)}%`
      : Number.isFinite(canonicalLivePos?.score?.lowerBound) && Number.isFinite(canonicalLivePos?.score?.upperBound)
        ? `${Math.round(canonicalLivePos.score.lowerBound * 100)}-${Math.round(canonicalLivePos.score.upperBound * 100)}%`
      : '—';
  const livePosEvidenceDensityLabel = formatEvidenceDensityLabel(canonicalLivePos?.score?.evidenceDensity);
  const livePosSummaryReasonCodes = livePosAvailable
    ? uniqueStringList([
        ...(Array.isArray(canonicalLivePos?.liveStateReasonCodes) ? canonicalLivePos.liveStateReasonCodes : []),
        ...(Array.isArray(canonicalLivePos?.score?.reasonCodes) ? canonicalLivePos.score.reasonCodes : []),
      ])
    : uniqueStringList(Array.isArray(canonicalLivePos?.reasonCodes) ? canonicalLivePos.reasonCodes : []);
  const livePosSummaryReasonLabels = livePosSummaryReasonCodes.map((code) => formatCanonicalReasonLabel(code));
  const livePosPrimaryExplanation =
    livePosSummaryReasonLabels[0] ||
    (livePosAvailable
      ? 'Live P.O.S. is being computed from linked execution evidence on the live schedule.'
      : 'Live P.O.S. is intentionally withheld until canonical execution evidence is available.');
  const livePosDetailExplanation = livePosSummaryReasonLabels.slice(1, 4);
  const planQualityGate =
    activeCycle?.planQualityGate || (goalId ? planQualityGateByGoal?.[goalId] || null : null) || null;
  const projectedPlanQualityGate = useMemo(
    () =>
      buildProjectedLifecycleGate({
        planQualityGate,
        fullHorizonCoverageAudit,
        fullHorizonPlanQuality,
        fullHorizonBlockQuality,
        firstExecutableDate: generatedScheduleDayKey || contractStartDayKey || activeCycle?.goalContract?.startDayKey || null,
        blockCount:
          Array.isArray(activeCycle?.scheduleReviewBlocks) && activeCycle.scheduleReviewBlocks.length > 0
            ? activeCycle.scheduleReviewBlocks.length
            : Array.isArray(activeCycle?.proposedBlocks) && activeCycle.proposedBlocks.length > 0
              ? activeCycle.proposedBlocks.length
              : Array.isArray(fullHorizon)
                ? fullHorizon.length
                : null,
      }),
    [
      activeCycle,
      contractStartDayKey,
      fullHorizon,
      fullHorizonBlockQuality,
      fullHorizonCoverageAudit,
      fullHorizonPlanQuality,
      generatedScheduleDayKey,
      planQualityGate,
    ]
  );
  const executionCorrection = goalId ? executionCorrectionByGoal?.[goalId] || null : null;
  const lifecycleResolution = useMemo(() => {
    const resolvedGoalId = String(activeGoalId || goalId || activeCycle?.goalContract?.goalId || '').trim();
    const fallbackProfileId =
      activeProfileId || (resolvedGoalId || activeCycleId || activeMasterPlan ? '__dashboard-session__' : '');
    const fallbackGoalId = resolvedGoalId || (activeCycleId ? '__dashboard-goal__' : '');
    const normalizedProfilesById =
      fallbackProfileId && !profilesById?.[fallbackProfileId]
        ? {
            ...(profilesById || {}),
            [fallbackProfileId]: {
              id: fallbackProfileId,
              activeGoalId: fallbackGoalId || null,
              activeMasterPlanId: activeProfile?.activeMasterPlanId || activeMasterPlan?.id || null,
              masterCalendarId: activeProfile?.masterCalendarId || activeMasterCalendar?.id || null,
            },
          }
        : profilesById || {};
    const normalizedGoalsById =
      fallbackGoalId && !goalsById?.[fallbackGoalId]
        ? {
            ...(goalsById || {}),
            [fallbackGoalId]: {
              id: fallbackGoalId,
              activeCycleId: activeCycleId || null,
            },
          }
        : goalsById || {};
    const normalizedActiveCycle =
      activeCycle &&
      String(activeCycle?.reassessmentStatus || '')
        .trim()
        .toLowerCase() === 'complete' &&
      (hasGeneratedCycleSchedule || hasPendingActivation || hasActiveSchedule)
        ? {
            ...activeCycle,
            reassessmentStatus: null,
          }
        : activeCycle;
    const normalizedCyclesById =
      normalizedActiveCycle && activeCycleId
        ? {
            ...(cyclesById || {}),
            [activeCycleId]: normalizedActiveCycle,
          }
        : cyclesById || {};

    return resolveOperatingLifecycleState({
      isAuthenticated: true,
      activeProfileId: fallbackProfileId || null,
      activeGoalId: fallbackGoalId || null,
      activeCycleId: activeCycleId || null,
      profileAccess,
      profilesById: normalizedProfilesById,
      goalsById: normalizedGoalsById,
      cyclesById: normalizedCyclesById,
      scheduleLifecycleState,
      planQualityGate: projectedPlanQualityGate,
      executionCorrection,
      pendingPlanConfirmation,
      regenerationRequired: showRebaseRecoveryAction,
      activeTodayBlockCount: Array.isArray(selectedDayBlocks) ? selectedDayBlocks.length : 0,
      todayBlocks: selectedDayBlocks,
      readinessSummary: {
        profile: fallbackProfileId ? 'READY' : undefined,
        goal: fallbackGoalId ? 'READY' : undefined,
        schedule:
          hasActiveSchedule
            ? 'ACTIVE'
            : hasPendingActivation
              ? 'REVIEW_APPLIED'
              : hasGeneratedCycleSchedule
                ? 'GENERATED'
                : activeCycle
                  ? 'MISSING'
                  : undefined,
        phase: activePhase?.label || activePhase?.name || activeCycle?.goalContract?.phaseLabel || undefined,
        today: Array.isArray(selectedDayBlocks) && selectedDayBlocks.length > 0 ? 'WORK_PRESENT' : 'NO_WORK_TODAY',
        planQuality:
          normalizeLifecycleAuditValue(
            projectedPlanQualityGate?.passed === true
              ? 'PASS'
              : projectedPlanQualityGate?.passed === false
                ? 'FAIL'
                : projectedPlanQualityGate?.status
          ) || undefined,
        dependencyAudit: normalizeLifecycleAuditValue(projectedPlanQualityGate?.dependencyAudit) || undefined,
        ownerCoverage: normalizeLifecycleAuditValue(projectedPlanQualityGate?.ownerCoverage) || undefined,
        gateIntegrity: normalizeLifecycleAuditValue(projectedPlanQualityGate?.gateIntegrity) || undefined,
        firstExecutableDate:
          normalizeLifecycleAuditValue(projectedPlanQualityGate?.firstExecutableDate) ||
          generatedScheduleDayKey ||
          contractStartDayKey ||
          activeCycle?.goalContract?.startDayKey ||
          undefined,
        blockCount:
          Number.isFinite(Number(projectedPlanQualityGate?.blockCount)) && Number(projectedPlanQualityGate.blockCount) > 0
            ? Number(projectedPlanQualityGate.blockCount)
            : undefined,
      },
    });
  }, [
      activeCycle,
      activeCycleId,
    activeGoalId,
    activeMasterCalendar?.id,
    activeMasterPlan,
    activePhase,
    activeProfile?.activeMasterPlanId,
    activeProfile?.masterCalendarId,
    activeProfileId,
      cyclesById,
    executionCorrection,
    goalId,
    goalsById,
    hasActiveSchedule,
    hasGeneratedCycleSchedule,
    hasPendingActivation,
    contractStartDayKey,
    fullHorizonBlockQuality,
    fullHorizonCoverageAudit,
    fullHorizonPlanQuality,
    generatedScheduleDayKey,
    pendingPlanConfirmation,
    projectedPlanQualityGate,
    profileAccess,
    profilesById,
    scheduleLifecycleState,
    selectedDayBlocks,
    showRebaseRecoveryAction,
  ]);
  const shotClock = goalId ? systemShotClockByGoal?.[goalId] || null : null;
  const planQualityCodes = uniqueStringList([
    ...(Array.isArray(projectedPlanQualityGate?.failureCodes) ? projectedPlanQualityGate.failureCodes : []),
    ...(Array.isArray(projectedPlanQualityGate?.reasonCodes) ? projectedPlanQualityGate.reasonCodes : []),
  ]);
  const planQualityTemporalDiagnostic = formatPlanQualityTemporalDiagnostic(projectedPlanQualityGate);
  const planQualityReasonLabels = sortPlanQualityCodesForDisplay(planQualityCodes).map((code) =>
    formatCanonicalReasonLabel(code)
  );
  const initialFeasibility = goalPolicy?.feasibility || null;
  const initialFeasibilityStateLabel = formatFeasibilityStateLabel(
    initialFeasibility?.state || feasibility?.status || 'unavailable'
  );
  const initialFeasibilitySubstrateLabel = initialFeasibility?.substrateLevel
    ? String(initialFeasibility.substrateLevel).replace(/_/g, ' ')
    : 'unavailable';
  const initialFeasibilityPercent =
    Number.isFinite(initialFeasibility?.percent)
      ? Number(initialFeasibility.percent)
      : Number.isFinite(initialFeasibility?.score)
        ? Math.round(Number(initialFeasibility.score) * 100)
        : null;
  const initialFeasibilityScoreLabel =
    initialFeasibility?.state !== 'withheld' && initialFeasibilityPercent !== null
      ? `${initialFeasibilityPercent}%`
      : feasibilityScore !== null && initialFeasibility?.state !== 'withheld'
        ? `${Math.round(feasibilityScore * 100)}%`
        : 'No score awarded';
  const initialFeasibilityHasScore =
    initialFeasibility?.state !== 'withheld' &&
    (initialFeasibilityPercent !== null || feasibilityScore !== null);
  const initialFeasibilityRangeLabel =
    Array.isArray(initialFeasibility?.range) &&
    Number.isFinite(initialFeasibility.range[0]) &&
    Number.isFinite(initialFeasibility.range[1])
      ? `${Math.round(initialFeasibility.range[0] * 100)}-${Math.round(initialFeasibility.range[1] * 100)}%`
      : '—';
  const initialFeasibilityConfidenceLabel = initialFeasibility?.confidence
    ? String(initialFeasibility.confidence).replace(/^\w/, (letter) => letter.toUpperCase())
    : 'Unavailable';
  const initialFeasibilityReasonCodes = uniqueStringList([
    ...(Array.isArray(initialFeasibility?.reasonCodes) ? initialFeasibility.reasonCodes : []),
    ...((initialFeasibility?.state === 'withheld' || initialFeasibility?.substrateLevel === 'withheld')
      ? planQualityCodes
      : []),
  ]);
  const initialFeasibilityReasonLabels = initialFeasibilityReasonCodes.map((code) => formatCanonicalReasonLabel(code));
  const initialFeasibilityPrimaryReason =
    initialFeasibility?.summary ||
    initialFeasibilityReasonLabels[0] ||
    (initialFeasibility?.state === 'withheld'
      ? 'Initial feasibility is withheld until the plan-quality substrate qualifies.'
      : 'Initial feasibility is a pre-execution forecast derived from the canonical plan substrate.');
  const initialFeasibilityDetailReasons = [
    ...uniqueStringList(Array.isArray(initialFeasibility?.assumptions) ? initialFeasibility.assumptions : []),
    ...initialFeasibilityReasonLabels.slice(initialFeasibility?.summary ? 0 : 1, 4),
  ].slice(0, 4);
  const shotClockCurrentTimeLabel = shotClock?.currentDateTimeISO
    ? formatShotClockTime(shotClock.currentDateTimeISO, shotClock.timezone || timeZone)
    : 'Unknown';
  const shotClockCurrentDateLabel = shotClock?.currentDate
    ? formatShotClockDate(shotClock.currentDate, shotClock.timezone || timeZone)
    : 'Unknown';
  const shotClockDeadlineLabel = shotClock?.contractEndDate
    ? formatShotClockDate(shotClock.contractEndDate, shotClock.timezone || timeZone)
    : 'Unknown';
  const shotClockPaceLabel = formatShotClockPaceState(shotClock?.paceState);
  const shotClockTimedDeadlines = Array.isArray(shotClock?.timedDeadlines) ? shotClock.timedDeadlines.slice(0, 5) : [];
  const planTrustLabel = String(goalPolicy?.posTrust?.state || 'unknown').replace(/_/g, ' ');
  const gatePassedWithPolicyAdvisory =
    projectedPlanQualityGate?.status === 'PLAN_QUALITY_PASSED' &&
    goalPolicy?.planQuality?.state &&
    goalPolicy.planQuality.state !== 'policy_clean';
  const livePosPanelValue = canPopulateLivePOS ? livePosPrimaryValue : hasAdmittedGoalContext ? 'Withheld' : '—';
  const livePosPanelAvailabilityLabel = canPopulateLivePOS
    ? livePosAvailabilityLabel
    : hasAdmittedGoalContext
      ? 'Withheld'
      : 'Pending';
  const livePosPanelStateLabel = canPopulateLivePOS
    ? livePosStateLabel
    : hasAdmittedGoalContext
      ? 'Withheld'
      : 'Unavailable';
  const livePosPanelPrimaryExplanation = canPopulateLivePOS
    ? livePosPrimaryExplanation
    : hasAdmittedGoalContext
      ? livePosSummaryReasonLabels[0] || 'Requires admitted goal and execution evidence.'
      : 'Requires admitted goal and execution evidence.';
  const livePosPanelDetailExplanation = canPopulateLivePOS
    ? livePosDetailExplanation
    : hasAdmittedGoalContext
      ? livePosSummaryReasonLabels.slice(1, 4)
      : [];
  const initialFeasibilityPanelPrimaryLabel = canPopulateInitialFeasibility
    ? initialFeasibilityHasScore
      ? initialFeasibilityScoreLabel
      : initialFeasibilityStateLabel
    : '—';
  const initialFeasibilityPanelSecondaryLabel = canPopulateInitialFeasibility
    ? initialFeasibilityHasScore
      ? initialFeasibilityStateLabel
      : initialFeasibilityScoreLabel
    : 'Pending goal admission.';
  const initialFeasibilityPanelSubstrateLabel = canPopulateInitialFeasibility
    ? initialFeasibilitySubstrateLabel
    : 'pending admission';
  const initialFeasibilityPanelConfidenceLabel = canPopulateInitialFeasibility
    ? initialFeasibilityConfidenceLabel
    : 'Unavailable';
  const initialFeasibilityPanelReason = canPopulateInitialFeasibility
    ? initialFeasibilityPrimaryReason
    : 'Initial feasibility appears after a goal is admitted.';
  const initialFeasibilityPanelDetailReasons = canPopulateInitialFeasibility ? initialFeasibilityDetailReasons : [];
  const stabilityScoreDisplay = canPopulateExecutionMetrics ? String(stabilityScore) : '—';
  const stabilityBandDisplay = canPopulateExecutionMetrics ? stabilityBand : 'No active Operating Cycle';
  const integrityRateDisplay = canPopulateExecutionMetrics
    ? `${Math.round(((integrityScoreCycle ?? safeStability.completionRate ?? 0) || 0) * 100)}%`
    : '—';
  const mixDriftDisplay = canPopulateExecutionMetrics ? `${Math.round((safeStability.driftScore || 0) * 100)}%` : '—';
  const consistencyDisplay = canPopulateExecutionMetrics ? `${Math.round((safeStability.streakScore || 0) * 100)}%` : '—';
  const momentumDisplay = canPopulateExecutionMetrics ? `${Math.round((safeStability.momentumScore || 0) * 100)}%` : '—';
  const containmentSummaryCopy = isStabilityBlankState
    ? 'One profile, one master calendar, no active work yet.'
    : 'One profile, one master calendar, many active goals.';
  const liveCanonicalTrace = useMemo(() => {
    const proposedAll = Array.isArray(scheduleSource) ? scheduleSource : [];
    const proposedForCycle = proposedAll.filter(
      (item) => !activeCycleId || !item?.cycleId || item.cycleId === activeCycleId
    );
    const reviewForCycle = Array.isArray(reviewScheduleBlocks) ? reviewScheduleBlocks : [];
    const visibleForCycle = Array.isArray(scheduleDisplayItemsAllResolved) ? scheduleDisplayItemsAllResolved : [];
    const dayKeys = visibleForCycle
      .map((item) => getScheduleItemDayKey(item))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return {
      activeCycleId,
      goalId,
      scheduleLifecycle: activeCycle?.scheduleLifecycle || null,
      scheduleApplied: Boolean(scheduleApplied),
      pendingPlanConfirmation: Boolean(pendingPlanConfirmation),
      planQualityGate: {
        status: projectedPlanQualityGate?.status || null,
        failureCodes: projectedPlanQualityGate?.failureCodes || [],
        reasonCodes: projectedPlanQualityGate?.reasonCodes || [],
        temporalDistribution: projectedPlanQualityGate?.meta?.temporalDistribution || null,
      },
      counts: {
        proposedAll: proposedAll.length,
        proposedForCycle: proposedForCycle.length,
        proposedSuggestedForCycle: proposedScheduleItemsAll.length,
        reviewForCycle: reviewForCycle.length,
        visibleSchedule: visibleForCycle.length,
        calendarSurface: calendarSurfaceBlocks.length,
      },
      visibleHorizon: {
        firstDayKey: dayKeys[0] || null,
        lastDayKey: dayKeys[dayKeys.length - 1] || null,
        dayKeys,
      },
      closureCheckpoint: {
        proposed: findClosureTraceBlocks(proposedForCycle, timeZone),
        review: findClosureTraceBlocks(reviewForCycle, timeZone),
        visible: findClosureTraceBlocks(visibleForCycle, timeZone),
      },
      latestVisibleBlocks: visibleForCycle
        .map((item) => summarizeTraceBlock(item, timeZone))
        .sort((left, right) => String(left.dayKey || '').localeCompare(String(right.dayKey || '')))
        .slice(-8),
    };
  }, [
    activeCycle?.scheduleLifecycle,
    activeCycleId,
    calendarSurfaceBlocks.length,
    goalId,
    pendingPlanConfirmation,
    projectedPlanQualityGate,
    proposedScheduleItemsAll.length,
    reviewScheduleBlocks,
    scheduleApplied,
    scheduleDisplayItemsAllResolved,
    scheduleSource,
    timeZone,
  ]);
  const uiDebugSnapshot = useMemo(() => {
    const previewDayKeys = (items = []) =>
      (Array.isArray(items) ? items : [])
        .slice(0, 20)
        .map((item) => getScheduleItemDayKey(item))
        .filter(Boolean);
    const previewBlocks = (items = []) =>
      (Array.isArray(items) ? items : []).slice(0, 20).map((item) => summarizeTraceBlock(item, timeZone));
    const currentHash = typeof window !== 'undefined' ? window.location.hash || '' : '';
    let persistedIdentitySummary = null;
    if (typeof window !== 'undefined' && typeof window.localStorage?.getItem === 'function') {
      try {
        const persisted = JSON.parse(window.localStorage.getItem('jericho-identity') || 'null');
        const persistedActiveCycle =
          persisted && persisted.activeCycleId && persisted.cyclesById ? persisted.cyclesById[persisted.activeCycleId] : null;
        const persistedScheduledBlocks = Array.isArray(persisted?.schedule?.blocks) ? persisted.schedule.blocks : [];
        persistedIdentitySummary = {
          activeCycleId: persisted?.activeCycleId || null,
          activePlanId: persisted?.activePlanId || null,
          activeDayKey: persisted?.activeDayKey || null,
          activeCycle: persistedActiveCycle
            ? {
                id: persistedActiveCycle.id || null,
                source: persistedActiveCycle.source || null,
                startedAtDayKey: persistedActiveCycle.startedAtDayKey || null,
                executionStartDayKey: persistedActiveCycle.executionStartDayKey || null,
                reassessmentCompletedAtISO: persistedActiveCycle.reassessmentCompletedAtISO || null,
                scheduleGeneratedAtISO:
                  persistedActiveCycle.scheduleGeneratedAtISO ||
                  persistedActiveCycle?.autoAsanaPlan?.audit?.generatedAtISO ||
                  null,
                scheduleLifecycle: persistedActiveCycle.scheduleLifecycle || null,
              }
            : null,
          scheduledBlockDayKeys: previewDayKeys(persistedScheduledBlocks),
          scheduledBlocksPreview: previewBlocks(persistedScheduledBlocks),
        };
      } catch {
        persistedIdentitySummary = { parseError: true };
      }
    }
    return {
      hash: currentHash,
      view,
      zionView,
      renderedSurface:
        view === 'structure'
          ? 'structure'
          : view === 'today'
            ? zionView === 'month'
              ? 'today-month'
              : zionView === 'week'
                ? 'today-week'
                : zionView === 'quarter'
                  ? 'today-quarter'
                  : zionView === 'year'
                    ? 'today-year'
                    : 'today-day'
            : view || 'unknown',
      anchorDayKey,
      activeDayKey,
      effectiveExecutionDayKey,
      contractStartDayKey,
      firstCommittedDayKey,
      resolvedFirstCycleScheduleStart: cycleStartResolution?.resolvedStartDayKey || null,
      effectiveExecutableFloorDayKey: contractStartDayKey || null,
      activeCycle: activeCycle
        ? {
            id: activeCycle.id || null,
            source: activeCycle.source || null,
            startedAtDayKey: activeCycle.startedAtDayKey || null,
            executionStartDayKey: activeCycle.executionStartDayKey || null,
            reassessmentCompletedAtISO: activeCycle.reassessmentCompletedAtISO || null,
            scheduleGeneratedAtISO: activeCycle.scheduleGeneratedAtISO || activeCycle?.autoAsanaPlan?.audit?.generatedAtISO || null,
            scheduleLifecycle: activeCycle.scheduleLifecycle || null,
          }
        : null,
      activePlan: activeMasterPlan
        ? {
            id: activeMasterPlan.id || null,
            horizonStart: activeMasterPlan.horizonStart || null,
            horizonEnd: activeMasterPlan.fullHorizonEndDayKey || activeMasterPlan.horizonEnd || null,
          }
        : null,
      calendarSurfaceBlockDayKeys: previewDayKeys(calendarSurfaceBlocks),
      activeExecutionBlockDayKeys: previewDayKeys(normalizedBlocks),
      persistedScheduledBlockDayKeys: previewDayKeys(
        hasAppliedReviewSchedule ? reviewScheduleBlocks : fallbackExecutionBlocks
      ),
      calendarSurfaceBlocksPreview: previewBlocks(calendarSurfaceBlocks),
      activeExecutionBlocksPreview: previewBlocks(normalizedBlocks),
      persistedScheduledBlocksPreview: previewBlocks(
        hasAppliedReviewSchedule ? reviewScheduleBlocks : fallbackExecutionBlocks
      ),
      persistedIdentitySummary,
    };
  }, [
    view,
    zionView,
    anchorDayKey,
    activeDayKey,
    effectiveExecutionDayKey,
    contractStartDayKey,
    firstCommittedDayKey,
    cycleStartResolution,
    activeCycle,
    activeMasterPlan,
    calendarSurfaceBlocks,
    normalizedBlocks,
    hasAppliedReviewSchedule,
    reviewScheduleBlocks,
    fallbackExecutionBlocks,
    timeZone,
  ]);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    window.__jerichoUiDebug__ = {
      snapshot: uiDebugSnapshot,
      getSnapshot: () => uiDebugSnapshot,
    };
    return () => {
      if (window.__jerichoUiDebug__?.snapshot === uiDebugSnapshot) {
        delete window.__jerichoUiDebug__;
      }
    };
  }, [uiDebugSnapshot]);
  const requiredPerWeek = Number.isFinite(cycleMetrics?.requiredWeeklyThroughput)
    ? cycleMetrics.requiredWeeklyThroughput
    : feasibility?.requiredBlocksPerDay
      ? feasibility.requiredBlocksPerDay * 7
      : null;
  const avgPerWeek = Number.isFinite(cycleMetrics?.actualAvgPerWeek)
    ? cycleMetrics.actualAvgPerWeek
    : probability?.scoringSummary?.mu
      ? probability.scoringSummary.mu * 7
      : null;
  const workableDaysRemaining = Number.isFinite(cycleMetrics?.workableDaysRemaining)
    ? cycleMetrics.workableDaysRemaining
    : feasibility?.workableDaysRemaining;
  const contractFailureReasons = Array.isArray(cycleMetrics?.contractFailureReasons)
    ? cycleMetrics.contractFailureReasons
    : [];
  const recoveryState =
    String(cycleMetrics?.recoveryState || '')
      .trim()
      .toUpperCase() || null;
  const recoveryReasons = Array.isArray(cycleMetrics?.recoveryReasons) ? cycleMetrics.recoveryReasons : [];
  const recoveryMetrics = cycleMetrics?.recoveryMetrics || {};
  const recoveryOptions = Array.isArray(cycleMetrics?.renegotiationOptions) ? cycleMetrics.renegotiationOptions : [];
  const renegotiationApplyResult = cycleMetrics?.renegotiationApplyResult || null;
  const lastRenegotiationApplied = activeCycle?.lastRenegotiationApplied || null;
  const activeCycleDynamics =
    cyclesById?.[activeCycleId]?.cycleDynamics || cycleDynamicsByCycleId?.[activeCycleId] || null;
  const missedBlocksCount = Math.max(
    0,
    Number(cycleMetrics?.dynamicOutcome?.missedBlocks || activeCycleDynamics?.totals?.missed || 0)
  );
  const expiredBlocksCount = Math.max(
    0,
    Number(cycleMetrics?.dynamicOutcome?.expiredBlocks || activeCycleDynamics?.totals?.expired || 0)
  );
  const overdueUnfinishedCount = Math.max(
    0,
    Number(cycleMetrics?.dynamicOutcome?.overdueUnfinished || activeCycleDynamics?.totals?.overdueUnfinished || 0)
  );
  const pendingMissedTransitions = Array.isArray(activeCycleDynamics?.recommendedTransitions)
    ? activeCycleDynamics.recommendedTransitions.filter(
        (transition) =>
          String(transition?.toStatus || '')
            .trim()
            .toUpperCase() === 'MISSED'
      )
    : [];
  const missedSignal = useMemo(() => {
    if (overdueUnfinishedCount <= 0 && missedBlocksCount <= 0 && expiredBlocksCount <= 0) return null;
    const overdueLabel = overdueUnfinishedCount > 0 ? `${overdueUnfinishedCount} overdue unfinished` : null;
    const missedLabel = missedBlocksCount > 0 ? `${missedBlocksCount} missed` : null;
    const expiredLabel = expiredBlocksCount > 0 ? `${expiredBlocksCount} expired` : null;
    const details = [overdueLabel, missedLabel, expiredLabel].filter(Boolean);
    if (overdueUnfinishedCount > 0 || pendingMissedTransitions.length > 0) {
      return {
        level: 'active',
        headline: `${overdueUnfinishedCount} overdue block${overdueUnfinishedCount === 1 ? '' : 's'} require missed-work recovery`,
        actionLine: 'Resolve overdue unfinished work before treating the cycle as stable.',
        details,
      };
    }
    return {
      level: 'recorded',
      headline: `${missedBlocksCount} missed block${missedBlocksCount === 1 ? '' : 's'} recorded in this cycle`,
      actionLine:
        expiredBlocksCount > 0
          ? 'Some missed work has already aged into expired burden.'
          : 'Missed work is recorded and should be recovered or renegotiated explicitly.',
      details,
    };
  }, [expiredBlocksCount, missedBlocksCount, overdueUnfinishedCount, pendingMissedTransitions.length]);

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
          <ProfileHistoryMenu
            profile={activeProfile}
            activeProfileId={activeProfileId}
            activeGoalId={activeGoalId}
            activeMasterPlanId={activeProfile?.activeMasterPlanId || null}
            activeCycleId={activeCycleId}
            goalsById={goalsById}
            masterPlansById={masterPlansById}
            cyclesById={cyclesById}
            onSelectCycle={(cycleId) => actions.setActiveCycle?.(cycleId)}
            onUpdateProfile={(payload) => actions.upsertProfileDetails?.(payload)}
          />
          {!REDUCE_UI ? (
            <button className="text-xs text-muted hover:text-jericho-accent" onClick={() => setAssistantVisible(true)}>
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
                Start Operating Cycle
              </button>
              {canReturnToActive ? (
                <button
                  className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent disabled:opacity-50"
                  disabled={!alternateActiveEntry}
                  onClick={() => alternateActiveEntry && actions.setActiveCycle?.(alternateActiveEntry.cycleId)}
                >
                  Back to active Operating Cycle
                </button>
              ) : null}
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-xs text-muted">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Operating Cycle Summary</p>
              <p className="text-sm text-jericho-text">{summaryText}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Ended at</p>
              <p className="text-sm text-jericho-text">{endDayKey ? formatDayKeyLabel(endDayKey) : 'Pending'}</p>
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
          <ProductStateBanner resolution={lifecycleResolution} />

          {view !== 'structure' ? (
            <div>
              <span className="text-xs uppercase tracking-[0.14em] text-muted">System Loop</span>
              <p className="text-[11px] text-muted mt-1">Identity → Discipline → Project Management → Data Analysis</p>
            </div>
          ) : null}

          {view === 'today' ? (
            <div className="space-y-4">
              {activeMasterPlan && (activeMasterPlan.fullHorizonEndDayKey || activeMasterPlan.horizonEnd) ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Horizon</span>
                  {HORIZON_MODE_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => actions.setSelectedHorizonMode(tab.key)}
                      className={`px-2 py-1 rounded border text-[11px] ${
                        selectedHorizonMode === tab.key
                          ? 'border-jericho-accent text-jericho-accent font-semibold'
                          : 'border-line/40 text-muted'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  {selectedHorizonMode !== 'current_cycle' && !isInterCycle && forecastCalendarBlocks.length > 0 ? (
                    <span className="text-[10px] text-muted ml-1">
                      {forecastCalendarBlocks.length} forecast block{forecastCalendarBlocks.length === 1 ? '' : 's'} visible
                    </span>
                  ) : null}
                </div>
              ) : null}

              {shouldShowMasterPlanForecastInspectionNotice ? (
                <p className="text-[11px] text-muted">
                  No Sprint generated yet. Master Plan forecast remains available in Master Plan.
                </p>
              ) : null}

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-2">
                  {ZION_VIEW_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        if (tab.key === 'today') {
                          jumpToAnchorToday();
                          return;
                        }
                        setZionView(tab.key);
                      }}
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
                {zionView !== 'today' ? (
                  <button
                    aria-label={`Go to previous ${zionView}`}
                    className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
                    onClick={() => shiftAnchor(-1)}
                  >
                    Prev
                  </button>
                ) : (
                  <div />
                )}
                <div className="text-center">
                    <p className="text-lg font-semibold" data-window-label>
                      {zionView === 'today'
                        ? formatDayKeyLabel(runtimeTodayDayKey)
                      : zionView === 'day'
                      ? formatDayKeyLabel(selectedCalendarDayKey || resolvedAnchorDayKey || effectiveExecutionDayKey)
                      : windowLabel}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                    {zionView === 'today'
                      ? formatClockTimeLabel(liveClockISO, todayTruthTimeZone)
                      : zionView === 'day'
                        ? 'Day'
                        : zionView}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {zionView === 'today' ? null : (
                    <button
                      aria-label={`Go to next ${zionView}`}
                      className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
                      onClick={() => shiftAnchor(1)}
                    >
                      Next
                    </button>
                  )}
                </div>
              </div>

              <CalendarScopeToggle
                options={calendarScopeOptions}
                scope={calendarScope}
                onScope={setCalendarScope}
              />

              <CalendarSourceCutoverControl
                label={calendarSourceInfo.label}
                enabled={matrixCalendarCutoverEnabled}
                onToggle={setMatrixCalendarCutoverOn}
              />

              {zionView === 'day' || zionView === 'today' ? (
                <div className="space-y-4">
                  {dailyCheckInView ? (
                    <DailyCheckInPanel view={dailyCheckInView} />
                  ) : !activeCycleId ? (
                    <div className="rounded-lg border border-line/60 bg-jericho-surface/90 px-4 py-6 space-y-1 text-center">
                      <p className="text-sm font-semibold text-jericho-text">No Operating Cycle active.</p>
                      <p className="text-xs text-muted">Start your first Operating Cycle when ready.</p>
                    </div>
                  ) : null}
                  <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
                    <div className="space-y-3">
                    <BlockColumn
                      dateLabel={selectedCalendarDayKey || effectiveExecutionDayKey}
                      blocks={selectedDayBlocks}
                      drafts={[]}
                      timeZone={timeZone}
                      selectedBlockId={selectedBlockId}
                      lineageBlocks={calendarSurfaceBlocksFull}
                      deliverableLabelById={deliverableLabelById}
                      criterionLabelById={criterionLabelById}
                      primaryObjectiveId={primaryObjectiveId}
                      chainTaskId={primaryObjectiveId}
                      onBlockClick={(id) => setSelectedBlockId(id)}
                    />
                    <div className="rounded-md border border-line/60 bg-jericho-surface/90 px-3 py-3 text-xs space-y-3">
                      {activePhase ? (
                        <div className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2 text-[11px] text-muted space-y-1">
                          <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Active Phase</p>
                          <p className="text-sm font-semibold text-jericho-text">
                            {activePhase.label} · {activePhase.name}
                          </p>
                          <p>{activePhase.phaseObjective}</p>
                          <p>
                            <span className="font-semibold text-jericho-text">Next unlock:</span>{' '}
                            {phaseModel.nextUnlockSummary}
                          </p>
                          <p>
                            <span className="font-semibold text-jericho-text">Schedule status:</span>{' '}
                            {titleCaseWords(activePhase.executionScheduleStatus)}
                          </p>
                        </div>
                      ) : null}
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                          {hasActiveSchedule
                            ? 'Activated Plan'
                            : hasAppliedReviewSchedule
                              ? 'Sprint Review'
                              : 'First Sprint'}
                        </p>
                        <p className="text-[11px] text-muted">
                          {hasActiveSchedule
                            ? 'This Activated Plan is authoritative. Reschedule specific blocks instead of regenerating.'
                            : hasAppliedReviewSchedule
                              ? 'This Sprint is on the calendar for review. Activate when ready to start accountability.'
                              : isInterCycle
                                ? 'No Sprint is generated yet. Reassess current state, then generate a new Sprint.'
                                : 'Preview only. The Master Plan keeps its long horizon; Today schedules the active Phase through its hard deadline before applying it to the calendar.'}
                        </p>
                        <p className="text-[11px] text-muted">
                          {isInterCycle
                            ? 'Today stays blank for execution until a new Sprint is generated. Strategic forecast remains available in Master Plan.'
                            : 'Today shows committed execution work. Future roadmap and forecast work remain visible in Master Plan.'}
                        </p>
                      </div>
                      <div className="grid gap-2 text-[11px] text-muted sm:grid-cols-2">
                        <div className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2">
                          <span className="font-semibold text-jericho-text">Master Plan horizon:</span>{' '}
                          {masterPlanHorizonLabel}
                        </div>
                        <div className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2">
                          <span className="font-semibold text-jericho-text">Operating Cycle horizon:</span>{' '}
                          {executionCycleHorizonLabel}
                        </div>
                        <div className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2">
                          <span className="font-semibold text-jericho-text">Sprint window:</span>{' '}
                          {schedulePreviewWindowLabel}
                        </div>
                        <div className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2">
                          <span className="font-semibold text-jericho-text">Today window:</span>{' '}
                          {todayCalendarWindowLabel}
                        </div>
                        <div className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2">
                          <span className="font-semibold text-jericho-text">Active phase deadline:</span>{' '}
                          {activePhaseDeadlineDayKey ? formatDayKeyLabel(activePhaseDeadlineDayKey) : '—'}
                        </div>
                        <div className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2">
                          <span className="font-semibold text-jericho-text">Calendar coverage through:</span>{' '}
                          {scheduleCoverageThroughDayKey ? formatDayKeyLabel(scheduleCoverageThroughDayKey) : '—'}
                        </div>
                        <div className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2">
                          <span className="font-semibold text-jericho-text">Coverage status:</span>{' '}
                          {scheduleCoverageStatusLabel}
                        </div>
                      </div>
                      <div className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2 text-[11px] text-muted space-y-1">
                        <p>
                          <span className="font-semibold text-jericho-text">First-cycle coverage:</span>{' '}
                          {scheduledPreviewBlockCount} scheduled block{scheduledPreviewBlockCount === 1 ? '' : 's'} /{' '}
                          {Math.round(scheduledPreviewMinutes / 60)}h
                          {unscheduledPreviewBlockCount > 0
                            ? ` · ${unscheduledPreviewBlockCount} unscheduled block${unscheduledPreviewBlockCount === 1 ? '' : 's'} / ${Math.round(
                                unscheduledPreviewMinutes / 60
                              )}h`
                            : ''}
                        </p>
                        {coverageFailureReason ? <p>{coverageFailureReason}</p> : null}
                        {partialScheduleReason ? <p>{partialScheduleReason}</p> : null}
                        {unscheduledReasonLabels.slice(0, 2).map((label) => (
                          <p key={label}>{label}</p>
                        ))}
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
                          disabled={
                            isCycleReadOnly ||
                            hasActiveSchedule ||
                            hasExpiredGeneratedSchedule ||
                            proposedScheduleItemsAll.length === 0 ||
                            suppressDrafts ||
                            (requiresHorizonResolution && !selectedPlanResolutionKind)
                          }
                        >
                          {requiresHorizonResolution && !selectedPlanResolutionKind
                            ? 'Resolve horizon conflict to apply'
                            : 'Apply schedule'}
                        </button>
                        <button
                          className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/10"
                          onClick={handleActivateSchedule}
                          disabled={
                            isCycleReadOnly ||
                            suppressDrafts ||
                            hasExpiredGeneratedSchedule ||
                            hasActiveSchedule ||
                            !hasAppliedReviewSchedule ||
                            reviewScheduleBlocks.length === 0
                          }
                        >
                          Activate schedule
                        </button>
                      </div>
                      <div className="space-y-1 text-[11px] text-muted">
                        <p>
                          <span className="font-semibold text-jericho-text">Generate schedule:</span>{' '}
                          {generateDisabledReason || 'Ready'}
                        </p>
                        <p>
                          <span className="font-semibold text-jericho-text">Apply schedule:</span>{' '}
                          {applyDisabledReason || 'Ready'}
                        </p>
                        <p>
                          <span className="font-semibold text-jericho-text">Activate schedule:</span>{' '}
                          {activateDisabledReason || 'Ready'}
                        </p>
                      </div>
                      <div className="rounded-md border border-line/40 bg-jericho-bg px-3 py-3 text-[11px] space-y-2">
                        <p className="font-semibold text-jericho-text">Confirmed availability</p>
                        {!hasConfirmedWorkWindows ? (
                          <>
                            <p className="text-muted">
                              No work windows defined. Add the real times you can work and save constraints. Jericho
                              will schedule only inside confirmed windows.
                            </p>
                            <p className="text-muted">Status: {constraintsStatus === 'stale' ? 'Stale' : 'Unsaved'}</p>
                          </>
                        ) : (
                          <>
                            <p className="text-muted">Available: {formatHoursFromMinutes(availableWeeklyMinutes)}</p>
                            <p className="text-muted">
                              Required first-cycle workload:{' '}
                              {requiredWeeklyMinutes !== null ? formatHoursFromMinutes(requiredWeeklyMinutes) : 'Pending'}
                            </p>
                            {gapWeeklyMinutes && gapWeeklyMinutes > 0 ? (
                              <p className="text-red-600">
                                Gap: {formatHoursFromMinutes(gapWeeklyMinutes)}. Jericho will not cram the plan into
                                unrealistic time.
                              </p>
                            ) : (
                              <p className="text-emerald-700">Availability is approved for first-cycle scheduling.</p>
                            )}
                            {capacityMitigationSuggestions.length > 0 ? (
                              <p className="text-muted">
                                Mitigation: {capacityMitigationSuggestions.join(' · ')}
                              </p>
                            ) : null}
                          </>
                        )}
                      </div>
                      {pendingPlanConfirmation ? (
                        <p className="text-[11px] text-amber-600">
                          Proposed schedule is awaiting confirmation. Apply to place it on the calendar for review.
                        </p>
                      ) : null}
                      {hasExpiredGeneratedSchedule ? (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-[11px] text-amber-700 space-y-1">
                          <p className="font-semibold">Generated Sprint expired</p>
                          <p>{generatedScheduleExpiredReason}</p>
                          <p>Reassessment must preserve the goal, hard anchors, phase structure, mandatory work, and strategic scope.</p>
                        </div>
                      ) : null}
                      {reassessmentRequired ? (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-[11px] text-amber-700 space-y-2">
                          <p>
                            Current-state reassessment is required before schedule generation. Confirm the current state
                            of this Operating Cycle so Jericho does not schedule from stale assumptions.
                          </p>
                          <button
                            className="rounded-full border border-amber-600 px-3 py-1 text-amber-700 hover:bg-amber-500/10"
                            onClick={handleCompleteCycleReassessment}
                            disabled={!activeCycleId || typeof actions.completeCycleReassessment !== 'function'}
                          >
                            Accept current-state reassessment
                          </button>
                        </div>
                      ) : null}
                      {requiresHorizonResolution ? (
                        <HorizonResolutionPanel
                          summary={activePlanSummary}
                          selectedKind={selectedPlanResolutionKind}
                          onSelect={(kind) => actions.setPlanResolutionKind?.({ cycleId: activeCycleId, kind })}
                          className="pt-1"
                        />
                      ) : null}
                      {hasAppliedReviewSchedule ? (
                        <p className="text-[11px] text-amber-600">
                          Sprint Review is on the calendar. Activate to start live accountability.
                        </p>
                      ) : null}
                      {hasActiveSchedule ? (
                        <p className="text-[11px] text-green-600">
                          Activated Plan is authoritative. Required system-created blocks should be rescheduled, not
                          casually deleted.
                        </p>
                      ) : null}
                      {hasStaleActiveSchedule ? (
                        <p className="text-[11px] text-amber-600">
                          Activated Plan is currently empty in the visible canonical store. Generate a Sprint to
                          rebuild the blocks you can reschedule.
                        </p>
                      ) : null}
                      {isCycleReadOnly ? (
                        <p className="text-[11px] text-amber-600">
                          Cycle ended/read-only. Generate and apply are disabled.
                        </p>
                      ) : !(hasAdmittedGoal && isGoalAdmitted) && !hasExecutableMasterPlan ? (
                        <p className="text-[11px] text-amber-600">
                          Complete goal setup in Structure before generating a schedule.
                        </p>
                      ) : null}
                      {suppressDrafts && contractStartDayKey ? (
                        <p className="text-[11px] text-amber-600">
                          Drafts begin on {formatDayKeyLabel(contractStartDayKey)}. Nothing before that date.
                          {contractStartIsDelayed && contractStartReasonLabel ? ` ${contractStartReasonLabel}` : ''}
                        </p>
                      ) : hasAppliedReviewSchedule || hasActiveSchedule || hasVisibleScheduleBlocks ? (
                        <div className="space-y-3">
                          <p className="text-[11px] text-muted">
                            {hasActiveSchedule
                              ? `This cycle has ${normalizedBlocks.length} active block${normalizedBlocks.length === 1 ? '' : 's'} across ${committedDayKeys.length} scheduled day${committedDayKeys.length === 1 ? '' : 's'}.`
                              : hasVisibleScheduleBlocks && !hasAppliedReviewSchedule
                                ? `This cycle already has ${normalizedBlocks.length} scheduled block${normalizedBlocks.length === 1 ? '' : 's'} across ${committedDayKeys.length} scheduled day${committedDayKeys.length === 1 ? '' : 's'}.`
                                : `${scheduleDisplayItemsAllResolved.length} block${scheduleDisplayItemsAllResolved.length === 1 ? '' : 's'} are placed on the calendar for review.`}
                            {firstCommittedDayKey
                              ? ` The first scheduled day is ${formatDayKeyLabel(firstCommittedDayKey)}.`
                              : ''}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {firstCommittedDayKey ? (
                              <button
                                className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
                                onClick={jumpToFirstCommittedDay}
                              >
                                Jump to first scheduled day
                              </button>
                            ) : null}
                            <button
                              className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
                              onClick={openCommittedMonth}
                            >
                              {hasActiveSchedule ? 'View active schedule' : 'View review schedule'}
                            </button>
                            {hasAppliedReviewSchedule && !hasActiveSchedule ? (
                              <>
                                <button
                                  className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/10"
                                  onClick={handleActivateSchedule}
                                  disabled={!actions.activateSchedule || hasExpiredGeneratedSchedule || reviewScheduleBlocks.length === 0}
                                >
                                  Activate schedule
                                </button>
                              </>
                            ) : null}
                          </div>
                      {scheduleDisplayItemsAllResolved.length > 0 &&
                      (hasAppliedReviewSchedule || hasActiveSchedule) ? (
                        <div className="space-y-3">
                          {hasPendingActivation ? (
                            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-xs space-y-1">
                              <p className="font-semibold text-amber-700">Schedule applied — not active yet</p>
                              <p className="text-amber-700/90">
                                Review the placed schedule, then use <span className="font-semibold">Activate schedule</span>{' '}
                                to start live execution. Today completion, miss, and reschedule controls stay disabled until
                                activation.
                              </p>
                              {activationDelayReassessmentRequired ? (
                                <>
                                  <p className="text-amber-700/90">
                                    Activation delay reassessment required. This schedule was applied for{' '}
                                    {formatDayKeyLabel(
                                      lastPlanError?.meta?.appliedStartDayKey ||
                                        activeCycle?.activationDelayAssessment?.appliedStartDayKey ||
                                        ''
                                    )}
                                    , but activation is being requested on{' '}
                                    {formatDayKeyLabel(
                                      lastPlanError?.meta?.requestedExecutionStartDayKey ||
                                        activeCycle?.activationDelayAssessment?.requestedExecutionStartDayKey ||
                                        activeDayKey
                                    )}
                                    .
                                  </p>
                                  <p className="text-amber-700/90">
                                    Confirm what happened during the delay window before Jericho rebases or activates the
                                    schedule.
                                  </p>
                                  <div className="pt-1">
                                    <button
                                      className="rounded-full border border-amber-700/60 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-600/10"
                                      onClick={handleRebaseSchedule}
                                      disabled={!actions.rebaseSchedule}
                                    >
                                      None happened - rebase from today
                                    </button>
                                  </div>
                                </>
                              ) : temporalRebaseRequired ? (
                                <>
                                  <p className="text-amber-700/90">
                                    Schedule rebase required. This draft no longer matches the activation start date and
                                    still contains unexecuted work in the past.
                                  </p>
                                  <p className="text-amber-700/90">
                                    Rebase from {formatDayKeyLabel(activeDayKey)} to move executable work forward,
                                    then review and activate.
                                  </p>
                                  <div className="pt-1">
                                    <button
                                      className="rounded-full border border-amber-700/60 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-600/10"
                                      onClick={handleRebaseSchedule}
                                      disabled={!actions.rebaseSchedule}
                                    >
                                      Rebase from today
                                    </button>
                                  </div>
                                </>
                              ) : null}
                              {cycleWasRebased ? (
                                <p className="text-amber-700/90">
                                  Schedule rebased from the current start date. Review the shifted blocks, then activate
                                  execution.
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {scheduleDisplayItemsAllResolved.length > 0 && scheduleDisplayItems.length === 0 ? (
                                <>
                                  <p className="text-xs text-muted">
                                    {scheduleDisplayItemsAllResolved.length} block
                                    {scheduleDisplayItemsAllResolved.length === 1 ? '' : 's'} are placed across your
                                    plan window. Showing full schedule:
                                  </p>
                                  {scheduleDisplayItemsGrouped.map(([dayKey, items]) => (
                                    <div key={dayKey} className="space-y-2">
                                      <p className="text-[11px] font-semibold text-muted">
                                        {formatDayKeyLabel(dayKey)}
                                      </p>
                                      {items.map((item) => (
                                        <div
                                          key={item.id || item.blockId}
                                          className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2 text-[11px] space-y-1"
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium text-jericho-text">
                                              {item.displayTitle || item.title}
                                            </span>
                                            <span className="text-muted">{item.durationMinutes || 30}m</span>
                                          </div>
                                          <p className="text-[11px] text-muted">{formatTime(item.startISO, timeZone)}</p>
                                          {item.commerceReadinessLevel ? (
                                            <p className="text-[11px] text-muted">
                                              Commerce readiness: {item.commerceReadinessLevel}
                                            </p>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </>
                              ) : scheduleDisplayItems.length > 0 ? (
                                scheduleDisplayItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2 text-[11px] space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-jericho-text">
                                        {item.displayTitle || item.title}
                                      </span>
                                      <span className="text-muted">{item.durationMinutes || 30}m</span>
                                    </div>
                                    <p className="text-[11px] text-muted">{formatTime(item.startISO, timeZone)}</p>
                                    {item.commerceReadinessLevel ? (
                                      <p className="text-[11px] text-muted">
                                        Commerce readiness: {item.commerceReadinessLevel}
                                      </p>
                                    ) : null}
                                  </div>
                                ))
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : lastPlanError?.code && proposedScheduleItemsAll.length === 0 && !pendingPlanConfirmation ? (
                        <p className="text-[11px] text-red-600">
                          Generate failed: {lastPlanError.code}
                          {lastPlanError?.reasonCodes?.length ? ` (${lastPlanError.reasonCodes.join(', ')})` : ''}
                        </p>
                      ) : proposedScheduleItems.length > 0 || proposedScheduleItemsAll.length > 0 ? (
                        <div className="space-y-3">
                          {proposedScheduleItems.length === 0 && proposedScheduleItemsAll.length > 0 ? (
                            <>
                              <p className="text-xs text-muted">
                                {proposedScheduleItemsAll.length} proposed block
                                {proposedScheduleItemsAll.length === 1 ? '' : 's'} exist across the Sprint window. Showing full proposal:
                              </p>
                              {proposedScheduleItemsGrouped.map(([dayKey, items]) => (
                                <div key={dayKey} className="space-y-2">
                                  <p className="text-[11px] font-semibold text-muted">{formatDayKeyLabel(dayKey)}</p>
                                  {items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2 text-[11px] space-y-1"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-jericho-text">{item.displayTitle || item.title}</span>
                                        <span className="text-muted">{item.durationMinutes || 30}m</span>
                                      </div>
                                      <p className="text-[11px] text-muted">{formatTime(item.startISO, timeZone)}</p>
                                      {item.expectedOutput ? (
                                        <p className="text-[11px] text-muted">Expected output: {item.expectedOutput}</p>
                                      ) : null}
                                      {item.sourceQuestion ? (
                                        <p className="text-[11px] text-muted">Resolved from: {item.sourceQuestion}</p>
                                      ) : null}
                                      {item.commerceReadinessLevel ? (
                                        <p className="text-[11px] text-muted">
                                          Commerce readiness: {item.commerceReadinessLevel}
                                        </p>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </>
                          ) : (
                            proposedScheduleItems.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-md border border-line/40 bg-jericho-bg px-3 py-2 text-[11px] space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-jericho-text">{item.displayTitle || item.title}</span>
                                  <span className="text-muted">{item.durationMinutes || 30}m</span>
                                </div>
                                <p className="text-[11px] text-muted">{formatTime(item.startISO, timeZone)}</p>
                                {item.expectedOutput ? (
                                  <p className="text-[11px] text-muted">Expected output: {item.expectedOutput}</p>
                                ) : null}
                                {item.sourceQuestion ? (
                                  <p className="text-[11px] text-muted">Resolved from: {item.sourceQuestion}</p>
                                ) : null}
                                {item.commerceReadinessLevel ? (
                                  <p className="text-[11px] text-muted">
                                    Commerce readiness: {item.commerceReadinessLevel}
                                  </p>
                                ) : null}
                              </div>
                            ))
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted">
                          No proposed schedule blocks yet. Generate schedule first.
                        </p>
                      )}
                    </div>
                    </div>
                    <div className="space-y-3">
                      <PlanningPanel
                        surface="today"
                        selectedDayKey={selectedCalendarDayKey}
                        onSelectedDayKeyChange={actions.setViewDate}
                        blocks={selectedDayBlocks}
                        selectedBlockId={selectedBlockId}
                        onSelectBlock={setSelectedBlockId}
                        onAddBlock={(day, payload) => handleCreateForDate(day, payload)}
                        errorMessage={addBlockError}
                        timeZone={timeZone}
                        onDeleteBlock={handleDeleteBlock}
                        onComplete={hasPendingActivation ? undefined : handleCompleteBlock}
                        onMiss={hasPendingActivation ? undefined : handleMissBlock}
                        onEdit={handleEditBlock}
                        onLinkCriterion={(block) => handleCloseLinkedCriterion(block)}
                        deliverables={deliverables}
                        criteriaByDeliverable={criteriaByDeliverable}
                        whatMovedToday={whatMovedToday}
                        strictMode={strictProgressMode}
                        criterionLabelById={criterionLabelById}
                        lineageBlocks={calendarSurfaceBlocksFull}
                        readOnly={isCycleReadOnly}
                        executionLocked={hasPendingActivation}
                        executionLockReason={executionLockReason}
                        hierarchyContext={blockHierarchyContext}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {zionView === 'week' ? (
                    <ZionWeekView
                      days={getWeekDayKeys(anchorISO, timeZone).map((dayKey) => {
                        const stats = getDayStats(dayKey, calendarDayBlocksMap);
                        return {
                          dayKey,
                          label: formatDayKeyLabel(dayKey),
                          ...stats,
                        };
                      })}
                      onSelectDay={handleDrillToDay}
                      onSelectBlock={setSelectedBlockId}
                      timeZone={timeZone}
                      lineageBlocks={calendarSurfaceBlocksFull}
                      deliverableLabelById={deliverableLabelById}
                      criterionLabelById={criterionLabelById}
                    />
                  ) : null}
                  {zionView === 'month' ? (
                    <div className="space-y-3">
                      <ZionMonthView
                        days={monthViewDays}
                        onSelectDay={handleDrillToDay}
                        lineageBlocks={calendarSurfaceBlocksFull}
                        deliverableLabelById={deliverableLabelById}
                        criterionLabelById={criterionLabelById}
                      />
                      {committedHorizonMonths.length > 0 ? (
                        <div className="rounded-md border border-line/60 bg-jericho-surface/90 px-3 py-3 space-y-3">
                          <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{scheduleHorizonLabel}</p>
                            <p className="text-[11px] text-muted">{scheduleHorizonDescription}</p>
                          </div>
                          <div className="space-y-4">
                            {committedHorizonMonths.map((month) => (
                              <div key={month.monthStartKey} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-jericho-text">{month.label}</p>
                                  <span className="text-[11px] text-muted">{month.monthBlocks.length} blocks</span>
                                </div>
                                {month.dayGroups.length > 0 ? (
                                  <p className="text-[11px] text-muted">{scheduleHorizonCoverageLabel}</p>
                                ) : (
                                  <p className="text-[11px] text-muted">
                                    {month.emptyReasonLabel || scheduleHorizonEmptyLabel}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {zionView === 'quarter' ? (
                    <ZionQuarterView
                      months={getQuarterMonths(anchorISO, timeZone).map((monthKey) => {
                        const monthDays = getMonthDayKeys(monthKey, timeZone).filter(
                          (dayKey) => dayKey.slice(0, 7) === monthKey.slice(0, 7)
                        );
                        const stats = getMonthStats(monthDays, calendarDayBlocksMap);
                        return {
                          anchorDayKey: monthKey,
                          label: formatWindowLabel(
                            buildWindowSpec('month', `${monthKey}T12:00:00.000Z`, timeZone),
                            timeZone
                          ),
                          plannedCount: stats.plannedCount,
                          completedCount: stats.completedCount,
                          completionRate: stats.completionRate,
                        };
                      })}
                      summary={(() => {
                        const monthStats = getQuarterMonths(anchorISO, timeZone).map((monthKey) => {
                          const monthDays = getMonthDayKeys(monthKey, timeZone).filter(
                            (dayKey) => dayKey.slice(0, 7) === monthKey.slice(0, 7)
                          );
                          return getMonthStats(monthDays, calendarDayBlocksMap);
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
                        const monthDays = getMonthDayKeys(monthKey, timeZone).filter(
                          (dayKey) => dayKey.slice(0, 7) === monthKey.slice(0, 7)
                        );
                        const stats = getMonthStats(monthDays, calendarDayBlocksMap);
                        return {
                          anchorDayKey: monthKey,
                          label: formatWindowLabel(
                            buildWindowSpec('month', `${monthKey}T12:00:00.000Z`, timeZone),
                            timeZone
                          ),
                          plannedCount: stats.plannedCount,
                          completedCount: stats.completedCount,
                          completionRate: stats.completionRate,
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
                      blocks={calendarSurfaceBlocksFull}
                      lineageBlocks={calendarSurfaceBlocksFull}
                      surface="today"
                      hierarchyContext={blockHierarchyContext}
                      onComplete={hasPendingActivation ? undefined : handleCompleteBlock}
                      onMiss={hasPendingActivation ? undefined : handleMissBlock}
                      onDelete={handleDeleteBlock}
                      onEdit={handleEditBlock}
                      timeZone={timeZone}
                      readOnly={isCycleReadOnly}
                      executionLocked={hasPendingActivation}
                      executionLockReason={executionLockReason}
                      deliverableLabelById={deliverableLabelById}
                      criterionLabelById={criterionLabelById}
                    />
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {view === 'structure' && (
            <StructurePageConsolidated
              onStartNewCycleRequest={({ hasActiveExecutionCycle } = {}) => {
                if (hasActiveExecutionCycle) {
                  setCycleTransitionModalOpen(true);
                  return;
                }
                actions.startNewCycleWithDecision?.({ mode: 'archive' });
              }}
              onOpenToday={() => {
                changeView('today');
                setZionView('day');
              }}
            />
          )}

          {view === 'mastergrid' && (
            <div className="space-y-4">
              <CapacityConfirmPanel />
              <MasterGridTab onOpenNode={() => changeView('structure')} />
            </div>
          )}

          {view === 'stability' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted">Probability of Success</p>
                  <p className="text-sm text-muted">
                    Feasibility remains the pre-execution support forecast. Live P.O.S. reflects post-execution evidence
                    only and stays separate from trust.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-3 space-y-2 md:col-span-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Live P.O.S.</p>
                        <p className="text-3xl font-semibold text-jericho-text">{livePosPanelValue}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-xs text-muted">Status: {livePosPanelAvailabilityLabel}</p>
                        <p className="text-xs text-muted">Live state: {livePosPanelStateLabel}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted">{livePosPanelPrimaryExplanation}</p>
                    {canPopulateLivePOS ? (
                      <div className="grid gap-3 md:grid-cols-4 text-xs text-muted">
                        <div>
                          <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Score range</p>
                          <p className="text-sm text-jericho-text">{livePosRangeLabel}</p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Evidence density</p>
                          <p className="text-sm text-jericho-text">{livePosEvidenceDensityLabel}</p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Bounded score</p>
                          <p className="text-sm text-jericho-text">{livePosPanelValue}</p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Cap</p>
                          <p className="text-sm text-jericho-text">
                            {canonicalLivePos?.score?.capped ? 'Capped' : 'Uncapped'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted">
                        Requires admitted goal and execution evidence.
                      </p>
                    )}
                    {livePosPanelDetailExplanation.length > 0 ? (
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2 text-[11px] text-muted space-y-1">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Canonical reasons</p>
                        {livePosPanelDetailExplanation.map((label, index) => (
                          <p key={`live-pos-reason-${index}`}>{label}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-3 space-y-2">
                      <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Initial Feasibility</p>
                      <div className="space-y-1">
                        <p className="text-3xl font-semibold text-jericho-text">{initialFeasibilityPanelPrimaryLabel}</p>
                        <p className="text-sm text-jericho-text">{initialFeasibilityPanelSecondaryLabel}</p>
                        <p className="text-[11px] text-muted">
                          Pre-execution forecast only. Live P.O.S. remains separate and stays withheld until execution
                          evidence exists.
                        </p>
                      </div>
                      <div className="grid gap-2 text-[11px] text-muted">
                        <p>
                          <span className="font-semibold text-jericho-text">Substrate:</span>{' '}
                          {initialFeasibilityPanelSubstrateLabel}
                        </p>
                        {canPopulateInitialFeasibility && initialFeasibilityHasScore ? (
                          <p>
                            <span className="font-semibold text-jericho-text">Range:</span>{' '}
                            {initialFeasibilityRangeLabel}
                            {' · '}
                            <span className="font-semibold text-jericho-text">Confidence:</span>{' '}
                            {initialFeasibilityPanelConfidenceLabel}
                          </p>
                        ) : (
                          <>
                            <p>
                              <span className="font-semibold text-jericho-text">Score:</span>{' '}
                              {canPopulateInitialFeasibility ? initialFeasibilityScoreLabel : '—'}
                            </p>
                            <p>
                              <span className="font-semibold text-jericho-text">Confidence:</span>{' '}
                              {initialFeasibilityPanelConfidenceLabel}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2 text-[11px] text-muted space-y-1">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Reason</p>
                        <p>{initialFeasibilityPanelReason}</p>
                        {initialFeasibilityPanelDetailReasons.map((label, index) => (
                          <p key={`initial-feasibility-reason-${index}`}>{label}</p>
                        ))}
                      </div>
                    </div>
                    {shotClock ? (
                      <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-3 space-y-2">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">System Shot Clock</p>
                        <div className="space-y-1 text-[11px] text-muted">
                          <p>
                            <span className="font-semibold text-jericho-text">Today:</span> {shotClockCurrentDateLabel}
                            {' · '}
                            {shotClockCurrentTimeLabel}
                          </p>
                          <p>
                            <span className="font-semibold text-jericho-text">Deadline:</span> {shotClockDeadlineLabel}
                          </p>
                          <p>
                            <span className="font-semibold text-jericho-text">Remaining:</span>{' '}
                            {Number.isFinite(shotClock.remainingDays) ? `${shotClock.remainingDays} days` : '—'}
                          </p>
                          <p>
                            <span className="font-semibold text-jericho-text">Horizon elapsed:</span>{' '}
                            {Math.round((Number(shotClock.elapsedRatio) || 0) * 100)}%
                            {' · '}
                            <span className="font-semibold text-jericho-text">Work complete:</span>{' '}
                            {Math.round((Number(shotClock.completionRatio) || 0) * 100)}%
                          </p>
                          <p>
                            <span className="font-semibold text-jericho-text">Pace:</span> {shotClockPaceLabel}
                          </p>
                        </div>
                        {shotClockTimedDeadlines.length > 0 ? (
                          <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2 text-[11px] text-muted space-y-1">
                            <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Timed Deadlines</p>
                            {shotClockTimedDeadlines.map((deadline) => (
                              <p key={`shot-clock-deadline-${deadline.blockId}`}>
                                {deadline.deadlineLabel}: due by{' '}
                                {formatShotClockTime(deadline.deadlineDateTime, shotClock.timezone || timeZone)}
                                {' · '}
                                {formatShotClockDeadlineState(deadline.deadlineState, deadline.completedLate)}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                      <p className="uppercase tracking-[0.12em] text-[10px] text-muted">P.O.S. trust</p>
                      <p className="text-sm text-jericho-text">{planTrustLabel}</p>
                      <p className="text-[11px] text-muted">Trust does not substitute for live execution evidence.</p>
                    </div>
                    {goalPolicy ? (
                      <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2 text-[11px] space-y-1">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Policy advisory</p>
                        <p>
                          <span className="font-semibold">Intake:</span>{' '}
                          {String(goalPolicy.intakeReadiness?.state || 'unknown').replace(/_/g, ' ')}
                        </p>
                        <p>
                          <span className="font-semibold">Planning advisory:</span>{' '}
                          {String(goalPolicy.planQuality?.state || 'unknown').replace(/_/g, ' ')}
                        </p>
                        {gatePassedWithPolicyAdvisory ? (
                          <p className="text-muted/70">
                            Canonical plan-quality gate passed; advisory signals may still flag pacing, density, or
                            support-forecast pressure.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                {projectedPlanQualityGate ? (
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2 text-[11px] text-muted space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Plan-quality diagnostics</p>
                      <p className="text-[11px] text-jericho-text">
                        {String(projectedPlanQualityGate.status || 'unknown').replace(/_/g, ' ')}
                      </p>
                    </div>
                    {planQualityTemporalDiagnostic ? (
                      <p className="text-jericho-text">{planQualityTemporalDiagnostic}</p>
                    ) : null}
                    {planQualityReasonLabels.length > 0 ? (
                      <div className="space-y-1">
                        {planQualityReasonLabels.slice(0, 4).map((label, index) => (
                          <p key={`plan-quality-reason-${index}`}>{label}</p>
                        ))}
                      </div>
                    ) : (
                      <p>No plan-quality failure codes are active.</p>
                    )}
                    {projectedPlanQualityGate.meta?.temporalDistribution ? (
                      <p>
                        Temporal truth: last scheduled{' '}
                        {formatDiagnosticDayKey(projectedPlanQualityGate.meta.temporalDistribution.lastScheduledDayKey)} ·
                        contract end{' '}
                        {formatDiagnosticDayKey(projectedPlanQualityGate.meta.temporalDistribution.contractEndDayKey)}
                      </p>
                    ) : null}
                    <details className="rounded-md border border-line/50 bg-black/20 px-2 py-1">
                      <summary className="cursor-pointer text-[10px] uppercase tracking-[0.12em] text-muted">
                        Live canonical trace
                      </summary>
                      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-relaxed text-muted">
                        {JSON.stringify(liveCanonicalTrace, null, 2)}
                      </pre>
                    </details>
                  </div>
                ) : null}
                {activePhase ? (
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-3 text-[11px] text-muted space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Status Report</p>
                        <p className="text-sm font-semibold text-jericho-text">
                          {activePhase.label} · {activePhase.name}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted">
                        Next unlock readiness: {titleCaseWords(activePhaseStatusReport?.nextPhaseReadiness || 'unknown')}
                      </p>
                    </div>
                    <p>{activePhaseStatusReport?.summary || 'Execution evidence is still being gathered.'}</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2 space-y-1">
                        <p>
                          <span className="font-semibold text-jericho-text">Phase progress:</span>{' '}
                          {activePhaseStatusReport?.phaseProgress || '—'}
                        </p>
                        <p>
                          <span className="font-semibold text-jericho-text">Evidence:</span>{' '}
                          {activePhaseStatusReport?.evidenceStatus || 'Insufficient evidence.'}
                        </p>
                        <p>
                          <span className="font-semibold text-jericho-text">Recommended correction:</span>{' '}
                          {activePhaseStatusReport?.recommendedCorrection || 'Continue gathering evidence.'}
                        </p>
                      </div>
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2 space-y-1">
                        <p>
                          <span className="font-semibold text-jericho-text">Next unlock:</span>{' '}
                          {phaseModel.nextUnlockSummary}
                        </p>
                        <p>
                          <span className="font-semibold text-jericho-text">Unresolved assumptions:</span>{' '}
                          {activePhaseStatusReport?.unresolvedAssumptions ?? 0}
                        </p>
                        <p>
                          <span className="font-semibold text-jericho-text">Next-phase implications:</span>{' '}
                          {activePhase.nextPhaseImplications}
                        </p>
                      </div>
                    </div>
                    {Array.isArray(activePhaseStatusReport?.blockers) && activePhaseStatusReport.blockers.length > 0 ? (
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2 space-y-1">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Blockers</p>
                        {activePhaseStatusReport.blockers.slice(0, 3).map((blocker, index) => (
                          <p key={`phase-blocker-${index}`}>{blocker}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {executionCorrection ? (
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2 text-xs space-y-1">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Execution correction</p>
                    <p className="text-jericho-text">
                      {String(executionCorrection.correctionState).replace(/_/g, ' ')}
                    </p>
                    {executionCorrection.correctionState !== 'insufficient_evidence' ? (
                      <p className="text-muted">
                        {executionCorrection.completedCount}c · {executionCorrection.missedCount}m ·{' '}
                        {executionCorrection.skippedCount}sk
                        {executionCorrection.blockedDownstreamCount > 0
                          ? ` · ${executionCorrection.blockedDownstreamCount} downstream blocked`
                          : null}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {activeProfile && activeMasterCalendar ? (
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Profile Containment</p>
                        <p className="text-sm text-jericho-text">{containmentSummaryCopy}</p>
                      </div>
                      <div className="text-right text-[11px] text-muted">
                        <p>{activeProfileId}</p>
                        <p>{activeMasterCalendar.id}</p>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-4 gap-3 text-xs text-muted">
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Active goals</p>
                        <p className="text-sm text-jericho-text">{activeProfileGoalIds.length}</p>
                      </div>
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Active cycles</p>
                        <p className="text-sm text-jericho-text">{activeProfileCycleIds.length}</p>
                      </div>
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Strategic clusters</p>
                        <p className="text-sm text-jericho-text">{profileStrategicClusters.length}</p>
                      </div>
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Calendar capacity</p>
                        <p className="text-sm text-jericho-text">
                          {activeMasterCalendar.availableCapacityHours}/{activeMasterCalendar.baseWeeklyCapacityHours}h
                        </p>
                      </div>
                    </div>
                    {profileStrategicClusters.length > 0 ? (
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2 text-[11px] text-muted space-y-1">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Integrated strategic clusters</p>
                        {profileStrategicClusters.map((cluster) => (
                          <p key={cluster.id}>
                            <span className="font-semibold text-jericho-text">{titleCaseWords(cluster.label)}</span>
                            {cluster.sharedAnchorDayKey ? ` · anchor ${cluster.sharedAnchorDayKey}` : ''}
                            {' · '}
                            {cluster.goalIds.map((goalId) => getGoalDisplayLabel(goalsById, cyclesById, goalId)).join(' · ')}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {independentGoalIds.length > 0 ? (
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2 text-[11px] text-muted space-y-1">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">
                          Independent strategies on the master calendar
                        </p>
                        <p>{independentGoalIds.map((goalId) => getGoalDisplayLabel(goalsById, cyclesById, goalId)).join(' · ')}</p>
                        {independentCompetitionLabels.slice(0, 2).map((label, index) => (
                          <p key={`independent-competition-${index}`}>{label}</p>
                        ))}
                      </div>
                    ) : null}
                    {globalConstraintSummaries.length > 0 ? (
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2 text-[11px] text-muted space-y-1">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Global constraints</p>
                        {globalConstraintSummaries.map((relation, index) => (
                          <p key={`global-constraint-${index}`}>
                            {getGoalDisplayLabel(goalsById, cyclesById, relation.sourceGoalId)} ·{' '}
                            {titleCaseWords(relation.relationType)} · {titleCaseWords(relation.severity)}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {profileFrictionResults.length > 0 ? (
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-2 text-[11px] text-muted space-y-1">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Friction propagation</p>
                        {profileFrictionResults.map((result) => {
                          const event = profileFrictionEvents.find((candidate) => candidate.id === result.frictionEventId);
                          const eventGoalLabel = getGoalDisplayLabel(goalsById, cyclesById, event?.goalId);
                          return (
                            <p key={result.frictionEventId}>
                              {eventGoalLabel}: {titleCaseWords(event?.frictionType || 'friction')}
                              {Number.isFinite(result.capacityDeltaHours) && result.capacityDeltaHours !== 0
                                ? ` · ${result.capacityDeltaHours}h`
                                : ''}
                              {result.strategicImpactGoalIds?.length > 0
                                ? ` · strategic impact: ${result.strategicImpactGoalIds
                                    .map((goalId) => getGoalDisplayLabel(goalsById, cyclesById, goalId))
                                    .join(' · ')}`
                                : ' · calendar impact only'}
                              {result.requiresReallocation ? ' · correction required' : ''}
                            </p>
                          );
                        })}
                      </div>
                    ) : null}
                    {canShowCycleFrictionInputs ? (
                      <form
                        className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-3 text-[11px] text-muted space-y-2"
                        onSubmit={handleCreateFrictionEvent}
                      >
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Record friction event</p>
                        <div className="grid md:grid-cols-2 gap-2">
                          <label className="space-y-1">
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-muted">Source goal</span>
                            <select
                              aria-label="Friction source goal"
                              className="w-full rounded-md border border-line/60 bg-black/20 px-2 py-1 text-jericho-text"
                              value={frictionGoalId}
                              onChange={(event) => setFrictionGoalId(event.target.value)}
                            >
                              {frictionGoalOptions.map((option) => (
                                <option key={option.goalId} value={option.goalId}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1">
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-muted">Event type</span>
                            <select
                              aria-label="Friction event type"
                              className="w-full rounded-md border border-line/60 bg-black/20 px-2 py-1 text-jericho-text"
                              value={frictionEventType}
                              onChange={(event) => setFrictionEventType(event.target.value)}
                            >
                              {FRICTION_EVENT_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {titleCaseWords(option)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1">
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-muted">Source cycle</span>
                            <input
                              aria-label="Friction source cycle"
                              className="w-full rounded-md border border-line/60 bg-black/20 px-2 py-1 text-jericho-text"
                              value={frictionCycleId}
                              onChange={(event) => setFrictionCycleId(event.target.value)}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-muted">Source block</span>
                            <input
                              aria-label="Friction source block"
                              className="w-full rounded-md border border-line/60 bg-black/20 px-2 py-1 text-jericho-text"
                              value={frictionBlockId}
                              onChange={(event) => setFrictionBlockId(event.target.value)}
                              placeholder="Optional block id"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-muted">Severity</span>
                            <select
                              aria-label="Friction severity"
                              className="w-full rounded-md border border-line/60 bg-black/20 px-2 py-1 text-jericho-text"
                              value={frictionSeverity}
                              onChange={(event) => setFrictionSeverity(event.target.value)}
                            >
                              {FRICTION_SEVERITY_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {titleCaseWords(option)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1">
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-muted">
                              Calendar impact hours
                            </span>
                            <input
                              aria-label="Friction calendar impact hours"
                              type="number"
                              min="0"
                              className="w-full rounded-md border border-line/60 bg-black/20 px-2 py-1 text-jericho-text"
                              value={frictionHours}
                              onChange={(event) => setFrictionHours(event.target.value)}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-muted">Start date</span>
                            <input
                              aria-label="Friction start date"
                              type="date"
                              className="w-full rounded-md border border-line/60 bg-black/20 px-2 py-1 text-jericho-text"
                              value={frictionStartDate}
                              onChange={(event) => setFrictionStartDate(event.target.value)}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="block text-[10px] uppercase tracking-[0.12em] text-muted">End date</span>
                            <input
                              aria-label="Friction end date"
                              type="date"
                              className="w-full rounded-md border border-line/60 bg-black/20 px-2 py-1 text-jericho-text"
                              value={frictionEndDate}
                              onChange={(event) => setFrictionEndDate(event.target.value)}
                            />
                          </label>
                        </div>
                        <label className="space-y-1 block">
                          <span className="block text-[10px] uppercase tracking-[0.12em] text-muted">Note</span>
                          <textarea
                            aria-label="Friction note"
                            className="w-full rounded-md border border-line/60 bg-black/20 px-2 py-1 text-jericho-text"
                            rows={2}
                            value={frictionNote}
                            onChange={(event) => setFrictionNote(event.target.value)}
                            placeholder="Optional detail about the real-world friction."
                          />
                        </label>
                        <button
                          type="submit"
                          className="rounded-md border border-line/60 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-jericho-text"
                        >
                          Record friction
                        </button>
                      </form>
                    ) : (
                      <div className="rounded-md border border-line/50 bg-jericho-surface/60 px-3 py-3 text-[11px] text-muted space-y-1">
                        <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Record friction event</p>
                        <p>Start an Operating Cycle before recording cycle friction.</p>
                      </div>
                    )}
                  </div>
                ) : null}
                {!committedHorizonCoversDeadlineWindow && committedHorizonMonths.length > 0 ? (
                  <p className="text-[11px] text-amber-600">
                    Canonical schedule coverage is not yet visible across the full contract horizon.
                  </p>
                ) : null}
                <div className="grid md:grid-cols-3 gap-3 text-xs text-muted">
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
                        const optionType = String(option?.type || '')
                          .trim()
                          .toUpperCase();
                        const isSupported = optionType === 'EXTEND_DEADLINE' || optionType === 'INCREASE_THROUGHPUT';
                        return (
                          <div
                            key={`recovery-option-${optionType}-${index}`}
                            className="rounded-md border border-line/50 px-2 py-2"
                          >
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
                {renegotiationFeedback ? <div className="text-[11px] text-muted">{renegotiationFeedback}</div> : null}
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
                    <p className="text-sm text-muted">Integrity and consistency across the active Operating Cycle.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-jericho-text">{stabilityScoreDisplay}</p>
                    <p className="text-xs text-muted">{stabilityBandDisplay}</p>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-line/40 overflow-hidden">
                  <div
                    className="h-full bg-jericho-accent"
                    style={{ width: `${canPopulateExecutionMetrics ? stabilityScore : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Low 0–49</span>
                  <span>Moderate 50–79</span>
                  <span>High 80–100</span>
                </div>
                {shouldShowUnavailableExecutionMetrics ? (
                  <p className="text-[11px] text-muted">
                    {hasActiveExecutionCycle
                      ? 'Execution metrics remain unavailable until execution evidence exists.'
                      : 'No active Operating Cycle.'}
                  </p>
                ) : null}
                <div className="grid md:grid-cols-2 gap-3 text-xs text-muted">
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Integrity rate</p>
                    <p className="text-sm text-jericho-text">{integrityRateDisplay}</p>
                  </div>
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Mix drift</p>
                    <p className="text-sm text-jericho-text">{mixDriftDisplay}</p>
                  </div>
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Consistency</p>
                    <p className="text-sm text-jericho-text">{consistencyDisplay}</p>
                  </div>
                  <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2">
                    <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Momentum</p>
                    <p className="text-sm text-jericho-text">{momentumDisplay}</p>
                  </div>
                </div>
              </div>

              {canPopulateExecutionMetrics ? (
                <DiagnosticsPanel
                  drift={Math.round((safeStability.driftScore || 0) * 100)}
                  risks={recoveryReasons || []}
                  metrics={{
                    completionRate: Math.round((safeStability.completionRate || 0) * 100),
                    streak: Math.round((safeStability.streakScore || 0) * 100),
                    driftIndex: Math.round((safeStability.driftScore || 0) * 100),
                  }}
                  missedSignal={missedSignal}
                  traceLog={debug?.traceLog || []}
                />
              ) : (
                <div className="rounded-xl border border-line/60 bg-jericho-surface/90 shadow-glass p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Diagnostics</p>
                      <h3 className="text-lg font-semibold">Integrity + risk</h3>
                    </div>
                    <span className="text-xs text-muted">Drift: —</span>
                  </div>
                  <p className="text-sm text-muted">
                    {hasActiveExecutionCycle
                      ? 'Diagnostics appear after execution evidence is recorded.'
                      : 'Diagnostics become available after an Operating Cycle begins.'}
                  </p>
                </div>
              )}

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
                          Admission: {lane.admission.detectedArchetype} / {lane.admission.detectedSubtype} · confidence{' '}
                          {lane.admission.confidence}
                        </p>
                        <p>
                          Context: required asked {lane.context.requiredQuestionsAsked} · answers{' '}
                          {lane.context.answersProvided} · defaults {lane.context.defaultsApplied} · confirmation{' '}
                          {lane.context.confirmationRequired ? 'required' : 'not required'}
                        </p>
                        <p>
                          Compile: canonical {lane.compilation.canonicalPathUsed ? 'yes' : 'no'} · outputs{' '}
                          {lane.compilation.outputCount} ({lane.compilation.outputTypes.join(', ') || 'none'}) · actions{' '}
                          {lane.compilation.actionCount} · sessions {lane.compilation.estimatedSessionCount} · schedule{' '}
                          {lane.compilation.scheduleGenerationStatus}
                        </p>
                        <p>
                          Runtime: fallback {lane.runtimeIntegrity.fallbackUsed ? 'used' : 'none'} · missing fields{' '}
                          {lane.runtimeIntegrity.missingFields.length > 0
                            ? lane.runtimeIntegrity.missingFields.join(', ')
                            : 'none'}{' '}
                          · issues{' '}
                          {lane.runtimeIntegrity.issues.length > 0 ? lane.runtimeIntegrity.issues.join(', ') : 'none'}
                        </p>
                        <p>
                          Recovery: signals {lane.recovery.signalCount} · failure class{' '}
                          {lane.recovery.primaryFailureClass || 'NONE'} · confirmation{' '}
                          {lane.recovery.recommendation.confirmationRequired ? 'required' : 'not required'}
                        </p>
                        <p>Recovery adjustment: {lane.recovery.recommendation.proposedAdjustment}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </div>

              {/* Core Continuity Panel */}
              {coreContinuity && coreContinuity.state !== 'absent' && (
                <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-muted">Core Continuity</p>
                      <p className="text-sm text-muted">Mission alignment above changing plans.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-jericho-text capitalize">{coreContinuity.state}</p>
                      <p className="text-xs text-muted">
                        {coreContinuity.activeMissionId ? 'Active mission' : 'No mission'}
                      </p>
                    </div>
                  </div>

                  {coreContinuity.activeMissionId && (
                    <div className="space-y-3">
                      {(() => {
                        const contract = coreMissionContractsById?.[coreContinuity.activeMissionId];
                        return contract ? (
                          <>
                            <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-3 space-y-2">
                              <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Durable Objective</p>
                              <p className="text-sm text-jericho-text">{contract.durableObjective || 'Not specified'}</p>
                              <div className="grid md:grid-cols-2 gap-3 text-xs text-muted">
                                <div>
                                  <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Current Phase</p>
                                  <p className="text-sm text-jericho-text capitalize">
                                    {contract.currentPhase || 'Not specified'}
                                  </p>
                                </div>
                                <div>
                                  <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Horizon</p>
                                  <p className="text-sm text-jericho-text">
                                    {contract.horizonYears ? `${contract.horizonYears} years` : 'Not specified'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {coreContinuity.reasonCodes && coreContinuity.reasonCodes.length > 0 && (
                              <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2 text-xs text-muted space-y-1">
                                <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Continuity Signals</p>
                                {coreContinuity.reasonCodes.map((code, index) => (
                                  <p key={`continuity-reason-${index}`} className="capitalize">
                                    {code.replace(/_/g, ' ')}
                                  </p>
                                ))}
                              </div>
                            )}

                            {contract.revisionHistory && contract.revisionHistory.length > 0 && (
                              <div className="rounded-md border border-line/60 bg-jericho-surface/80 px-3 py-2 text-xs text-muted space-y-1">
                                <p className="uppercase tracking-[0.12em] text-[10px] text-muted">Latest Revision</p>
                                {(() => {
                                  const latestRevision = contract.revisionHistory[contract.revisionHistory.length - 1];
                                  return (
                                    <p>
                                      {latestRevision.note || 'Revision recorded'}{' '}
                                      {latestRevision.timestamp
                                        ? new Date(latestRevision.timestamp).toLocaleDateString()
                                        : ''}
                                    </p>
                                  );
                                })()}
                              </div>
                            )}
                          </>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {view === 'plan' && (
            <MasterPlanTimeline />
          )}
        </div>

        {(() => {
          const convergenceAdvisory = buildConvergenceCandidateAdvisory({ matrix: calendarScopeMatrix });
          return convergenceAdvisory ? (
            <div className="space-y-3 p-4 bg-jericho-surface/50 border border-line/40 rounded-lg">
              <div>
                <h3 className="text-sm font-semibold text-jericho-text">{convergenceAdvisory.title}</h3>
                <p className="text-xs text-muted mt-1">{convergenceAdvisory.description}</p>
              </div>
              <div className="space-y-2">
                {convergenceAdvisory.questions.map(question => (
                  <div key={question.id} className="flex items-start justify-between gap-3 p-2 bg-jericho-surface rounded border border-line/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-jericho-text">{question.label}</p>
                      <p className="text-xs text-muted">{question.targetDate}</p>
                    </div>
                    <div className="flex gap-2">
                      {question.actions.map(action => (
                        <button
                          key={action.type}
                          className="text-xs px-2 py-1 rounded border border-line/40 hover:bg-jericho-surface hover:border-line/60 text-muted hover:text-jericho-text transition-colors"
                          onClick={() =>
                            actions.respondConvergenceDetectionQuestion({
                              questionId: question.id,
                              disposition: action.type
                            })
                          }
                          title={action.description}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}

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
                        criterionId: e.target.checked ? prev.criterionId : '',
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
                    onChange={(e) =>
                      setPendingPlacement((prev) => ({
                        ...prev,
                        durationMinutes: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
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
                            criterionId: '',
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

function monthStartKey(dayKey = '') {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  return `${dayKey.slice(0, 7)}-01`;
}

function nextMonthStartKey(dayKey = '') {
  const normalized = monthStartKey(dayKey);
  if (!normalized) return null;
  const [yearRaw, monthRaw] = normalized.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`;
}

function getMonthStartKeysInRange(startDayKey, endDayKey) {
  const start = monthStartKey(startDayKey);
  const end = monthStartKey(endDayKey);
  if (!start || !end || start > end) return [];
  const results = [];
  let cursor = start;
  let guard = 0;
  while (cursor && cursor <= end && guard < 120) {
    results.push(cursor);
    cursor = nextMonthStartKey(cursor);
    guard += 1;
  }
  return results;
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

function formatTime(iso = '', timeZone = 'UTC') {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '--:--';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

function formatClockTimeLabel(iso = '', timeZone = 'UTC') {
  if (!iso) return '--:--:--';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '--:--:--';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}
