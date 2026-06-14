import { addDays, buildLocalStartISO, dayKeyFromISO, localMinutesFromISO, nowDayKey } from '../time/time.ts';
import { isRuntimeEnvFlagEnabled } from '../../utils/runtimeEnv.js';
import type { FeasibilityAssessment } from '../../domain/feasibility/feasibilityDerivation';

type Constraints = {
  timezone: string;
  maxBlocksPerDay?: number;
  maxBlocksPerWeek?: number;
  minSessionMinutes?: number;
  longHorizonNonRecurring?: boolean;
  earlyCompletionJustification?: string | null;
  workingHoursWindows?: TimeWindow[];
  forbiddenTimeWindows?: TimeWindow[];
  forbiddenDayKeys?: string[];
  workableDayPolicy?: { weekdays?: Array<number | string> };
  weeklyWindows?: Partial<Record<string, Array<{ startHHMM: string; endHHMM: string }>>>;
  dayEndAtHHMM?: string;
  cycleStartDayKey?: string;
  cycleEndDayKey?: string;
  blackoutDates?: string[];
  calendarCommittedBlocksByDate?: Record<string, number>;
};

type PlanProof = {
  workableDaysRemaining: number;
  totalRequiredUnits: number;
  requiredPacePerDay: number;
  maxPerDay: number;
  maxPerWeek: number;
  slackUnits: number;
  slackRatio: number;
  intensityRatio: number;
};

type DependencyType = 'hard_gate' | 'directional' | 'informational';
type DependencyDetail = { actionId: string; dependencyType: DependencyType };
type CommerceReadinessLevel = 'hypothesis' | 'validated';

type AutoAsanaPlan = {
  graph: { tasks: any[]; dependencies: any[]; milestones: any[] };
  horizon: { startDayKey: string; endDayKey: string; daysCount: number };
  horizonBlocks: Array<{
    id: string;
    dayKey: string;
    startISO: string;
    durationMinutes: number;
    kind: string;
    title: string;
    identityKey?: string;
    deliverableId?: string | null;
    actionId?: string | null;
    directDependencyIds?: string[];
    directDependencyDetails?: DependencyDetail[];
    transitiveDependencyIds?: string[];
    transitiveDependencyDetails?: DependencyDetail[];
    commerceReadinessLevel?: CommerceReadinessLevel | null;
    placementBasis?: 'confirmed' | 'assumption';
    assumedDependencies?: string[];
    sessionIndex?: number | null;
    actionSteps?: string[];
    completionCondition?: string | null;
    detailTitle?: string | null;
    endISO?: string | null;
    blockType?: 'execution' | 'waiting_period' | 'capital_checkpoint';
    waitType?: string | null;
    minimumDurationBusinessDays?: number | null;
    parallelWorkSuggestions?: string[];
    requiredWorkFamily?: string | null;
    capitalGateId?: string | null;
    pathwayTag?: string | null;
    owner?: string | null;
    producesArtifact?: string | null;
    consumedBy?: string[] | string | null;
    passEvidence?: string | null;
    consumedByRef?: { type: string; id: string } | null;
  }>;
  conflicts: { kind: string; detail: string; code?: string; candidateResolutions?: string[] }[];
  recoveryOptions: { kind: string; detail: string }[];
  unscheduledDrafts: Array<{
    id: string;
    title: string;
    actionId?: string | null;
    deliverableId?: string | null;
    targetDayKey?: string | null;
    hardGateFloorISO?: string | null;
    directionalFloorISO?: string | null;
    assumedDependencies?: string[];
    commerceReadinessLevel?: CommerceReadinessLevel | null;
  }>;
  summary: {
    planStatus:
      | 'INVALID_SEMANTICS'
      | 'VALID_AND_FULLY_SCHEDULED'
      | 'VALID_BUT_HORIZON_INSUFFICIENT'
      | 'VALID_PARTIAL_BY_USER_CHOICE';
    requiredBlockCount: number;
    scheduledBlockCount: number;
    unscheduledBlockCount: number;
    acceptedBlockCount: number;
    horizonDayCount: number;
    candidateResolutionKinds: string[];
    recommendations: Array<
      | {
          kind: 'EXTEND_HORIZON';
          extensionDays: number;
          extensionWeeks: number;
          earliestFeasibleCompletionDate: string | null;
          unscheduledBlockCount: number;
        }
      | {
          kind: 'REDUCE_CYCLE_COUNT';
          currentCycleCount: number;
          recommendedCycleCount: number;
          removedCycles: number[];
          recoveredDays: number;
        }
      | {
          kind: 'ACCEPT_PARTIAL_PLAN';
          scheduledBlockCount: number;
          unscheduledBlockCount: number;
          scheduledThroughDate: string | null;
          unscheduledFromDate: string | null;
        }
    >;
    pacingNotes?: string[];
    qualityWarnings?: Array<{ rule: string; message: string }>;
    feasibilityAssessment?: FeasibilityAssessment | null;
  };
  audit: { generatedAtISO: string; goalId: string; cycleId: string; policyVersion: string };
};

type TimeWindow = { startMin: number; endMin: number };

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};
const DAY_CODE_BY_INDEX = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const EXECUTION_TITLE_ACTION_VERBS = new Set([
  'assess',
  'build',
  'confirm',
  'configure',
  'create',
  'define',
  'document',
  'draft',
  'edit',
  'evaluate',
  'finalize',
  'map',
  'outline',
  'package',
  'prepare',
  'produce',
  'record',
  'review',
  'run',
  'secure',
  'select',
  'stress-test',
  'submit',
  'test',
  'track',
  'validate',
  'verify',
  'write',
]);
const EXECUTION_TITLE_VERB_REWRITE: Record<string, string> = {
  check: 'validate',
  choose: 'select',
  compare: 'evaluate',
  conduct: 'run',
  list: 'document',
  lock: 'finalize',
  request: 'secure',
  retest: 'test',
};

export function compileAutoAsanaPlan({
  goalId,
  cycleId,
  planProof,
  constraints,
  nowISO,
  horizonDays = 90,
  acceptedBlocks = [],
  actionSequence = [],
  sessionPlan = [],
}: {
  goalId: string;
  cycleId: string;
  planProof: PlanProof;
  constraints: Constraints;
  nowISO: string;
  horizonDays?: number;
  acceptedBlocks?: Array<{
    id: string;
    startISO: string;
    durationMinutes: number;
    deliverableId?: string | null;
    actionId?: string | null;
    sessionIndex?: number | null;
    identityKey?: string | null;
  }>;
  actionSequence?: Array<{
    id?: string;
    title?: string;
    deliverable?: string;
    definitionOfDone?: string;
    actionType?: 'preparation' | 'execution';
    estimateMin?: number;
    dependencies?: string[];
    dependencyDetails?: DependencyDetail[];
    deliverableId?: string | null;
    deliverableTitle?: string | null;
    sessionTitles?: string[];
    minimumDurationBusinessDays?: number;
    blockType?: 'execution' | 'waiting_period' | 'capital_checkpoint';
    waitType?: string;
    parallelWorkSuggestions?: string[];
    requiredWorkFamily?: string;
    capitalGateId?: string;
    pathwayTag?: string;
  }>;
  sessionPlan?: Array<{
    date?: string;
    startTime?: string;
    durationMinutes?: number;
    actionSteps?: string[];
    completionCondition?: string;
    deliverableId?: string;
    actionId?: string;
    title?: string;
    directDependencyDetails?: DependencyDetail[];
    transitiveDependencyDetails?: DependencyDetail[];
    minimumDurationBusinessDays?: number;
    blockType?: 'execution' | 'waiting_period' | 'capital_checkpoint';
    waitType?: string;
    parallelWorkSuggestions?: string[];
    requiredWorkFamily?: string;
    capitalGateId?: string;
    pathwayTag?: string;
  }>;
}): AutoAsanaPlan {
  const timeZone = constraints?.timezone || 'UTC';
  const nowDay = dayKeyFromISO(nowISO, timeZone) || nowDayKey(timeZone);
  const startDayKey =
    constraints?.cycleStartDayKey && constraints.cycleStartDayKey > nowDay ? constraints.cycleStartDayKey : nowDay;
  const endDayKey = addDays(startDayKey, Math.max(0, horizonDays - 1), timeZone);
  const dayKeys = collectHorizonDays(startDayKey, endDayKey, constraints, timeZone);
  if (isRuntimeEnvFlagEnabled('JERICHO_DEBUG_SCHEDULER')) {
    // Placement diagnostics for horizon expansion vs. distributor output.
    // eslint-disable-next-line no-console
    console.log('dayKeys sample', dayKeys[0], dayKeys[dayKeys.length - 1], 'total:', dayKeys.length);
  }

  const maxPerDay = Math.max(0, Number.isFinite(planProof?.maxPerDay) ? Number(planProof.maxPerDay) : 0);
  const requiredPerDay = Math.max(0, Math.ceil(planProof?.requiredPacePerDay || 0));
  const plannedPerDay = Math.min(maxPerDay || requiredPerDay, requiredPerDay || maxPerDay || 0);

  const schedule = scheduleHorizonBlocks({
    dayKeys,
    plannedPerDay,
    timeZone,
    goalId,
    cycleId,
    constraints,
    acceptedBlocks,
    actionSequence,
    sessionPlan,
  });
  const conflicts: AutoAsanaPlan['conflicts'] = schedule.conflicts;
  const recoveryOptions: AutoAsanaPlan['recoveryOptions'] = schedule.recoveryOptions;
  const clamped = clampPlacedBlocksToCycleWindow({
    placed: schedule.placed,
    conflicts,
    constraints,
    timeZone,
  });
  if (maxPerDay && requiredPerDay > maxPerDay) {
    conflicts.push({
      kind: 'UNSCHEDULABLE',
      code: 'EXCEEDS_MAX_PER_DAY',
      detail: `Required ${requiredPerDay} blocks/day exceeds max ${maxPerDay}.`,
      candidateResolutions: ['INCREASE_MAX_PER_DAY', 'EXTEND_DEADLINE', 'REDUCE_SCOPE'],
    });
  }

  if (planProof?.maxPerWeek && requiredPerDay * 7 > planProof.maxPerWeek) {
    conflicts.push({
      kind: 'UNSCHEDULABLE',
      code: 'EXCEEDS_MAX_PER_WEEK',
      detail: `Required ${requiredPerDay * 7} blocks/week exceeds max ${planProof.maxPerWeek}.`,
      candidateResolutions: ['INCREASE_MAX_PER_WEEK', 'EXTEND_DEADLINE', 'REDUCE_SCOPE'],
    });
  }

  if (!dayKeys.length) {
    conflicts.push({
      kind: 'UNSCHEDULABLE',
      code: 'NO_WORKABLE_DAYS',
      detail: 'No workable days in horizon under current constraints.',
      candidateResolutions: ['REMOVE_BLACKOUTS', 'ADJUST_WORKABLE_DAYS'],
    });
  }

  if (conflicts.length) {
    recoveryOptions.push({ kind: 'ADJUST_CONSTRAINTS', detail: 'Increase capacity or widen workable days.' });
  }

  const requiredBlockCount = Number(schedule.requiredDraftCount || 0);
  const scheduledBlockCount = Array.isArray(clamped.placed) ? clamped.placed.length : 0;
  const unscheduledBlockCount = Math.max(0, requiredBlockCount - scheduledBlockCount);
  const planStatus =
    requiredBlockCount === 0 && (!Array.isArray(actionSequence) || actionSequence.length === 0) && (!Array.isArray(sessionPlan) || sessionPlan.length === 0)
      ? 'INVALID_SEMANTICS'
      : unscheduledBlockCount > 0
        ? 'VALID_BUT_HORIZON_INSUFFICIENT'
        : 'VALID_AND_FULLY_SCHEDULED';
  const recommendations =
    planStatus === 'VALID_BUT_HORIZON_INSUFFICIENT'
      ? buildHorizonRecommendations({
          unscheduledDrafts: schedule.unscheduledDrafts || [],
          placed: clamped.placed,
          horizonEndDayKey: endDayKey,
          horizonDayCount: dayKeys.length,
          constraints,
          timeZone,
        })
      : [];
  const candidateResolutionKinds =
    recommendations.length > 0
      ? recommendations.map((recommendation) => recommendation.kind)
      : Array.from(new Set((recoveryOptions || []).map((option) => String(option?.kind || '').trim()).filter(Boolean))).sort(
          (left, right) => left.localeCompare(right)
        );

  const graph = buildProjectGraph(goalId, planProof);

  return {
    graph,
    horizon: {
      startDayKey,
      endDayKey,
      daysCount: dayKeys.length,
    },
    horizonBlocks: clamped.placed,
    conflicts,
    recoveryOptions,
    unscheduledDrafts: (schedule.unscheduledDrafts || []).map((draft) => ({
      id: draft?.id || '',
      title: draft?.title || 'Unscheduled block',
      actionId: draft?.actionId || null,
      deliverableId: draft?.deliverableId || null,
      targetDayKey: draft?.targetDayKey || null,
      hardGateFloorISO: draft?.hardGateFloorISO || null,
      directionalFloorISO: draft?.directionalFloorISO || null,
      assumedDependencies: Array.isArray(draft?.assumedDependencies) ? [...draft.assumedDependencies] : [],
      commerceReadinessLevel: draft?.commerceReadinessLevel || null,
    })),
    summary: {
      planStatus,
      requiredBlockCount,
      scheduledBlockCount,
      unscheduledBlockCount,
      acceptedBlockCount: Array.isArray(acceptedBlocks) ? acceptedBlocks.length : 0,
      horizonDayCount: dayKeys.length,
      candidateResolutionKinds,
      recommendations,
    },
    audit: {
      generatedAtISO: nowISO,
      goalId,
      cycleId,
      policyVersion: 'auto_asana_v1.2',
    },
  };
}

function collectHorizonDays(startDayKey: string, endDayKey: string, constraints: Constraints, timeZone: string) {
  const days: string[] = [];
  let cursor = startDayKey;
  let guard = 0;
  while (cursor <= endDayKey && guard < 5000) {
    if (isWorkableDate(cursor, constraints, timeZone)) days.push(cursor);
    const next = addDays(cursor, 1, timeZone);
    if (!next || next === cursor) break;
    cursor = next;
    guard += 1;
  }
  return days;
}

function inferCommerceReadinessLevel(actionId?: string | null, title?: string | null): CommerceReadinessLevel | null {
  const normalizedActionId = String(actionId || '').trim().toLowerCase();
  const normalizedTitle = String(title || '').trim().toLowerCase();
  if (!normalizedActionId && !normalizedTitle) {
    return null;
  }
  if (/^brand:02:/.test(normalizedActionId) || /^brand:03:/.test(normalizedActionId)) {
    return 'hypothesis';
  }
  if (/^brand:04:\d+:cycle-\d+-buyer-offer$/.test(normalizedActionId)) {
    return 'hypothesis';
  }
  if (
    /^brand:04:\d+:cycle-\d+-(outreach-response|purchase-friction)$/.test(normalizedActionId) ||
    /^brand:05:/.test(normalizedActionId)
  ) {
    return 'validated';
  }
  if (/\b(offer|pricing|product page|checkout|order-capture|fulfillment|buyer segment|cta|message|campaign asset)\b/.test(normalizedTitle)) {
    return 'hypothesis';
  }
  if (/\b(outreach|response capture|purchase-path attempt|friction capture|evidence|next market move|launch handoff|first-sales push)\b/.test(normalizedTitle)) {
    return 'validated';
  }
  return null;
}

function buildProjectGraph(goalId: string, planProof: PlanProof) {
  const tasks = [
    {
      id: `task-${goalId}-execution`,
      title: 'Execution',
      requiredUnits: planProof?.totalRequiredUnits || 0,
    },
  ];
  const milestones = [
    {
      id: `milestone-${goalId}-deadline`,
      title: 'Deadline',
      targetUnits: planProof?.totalRequiredUnits || 0,
    },
  ];
  return {
    tasks,
    dependencies: [],
    milestones,
  };
}

function isWorkableDate(dateKey: string, constraints: Constraints, timeZone: string) {
  if (!dateKey) return false;
  const blackout = new Set([...(constraints?.blackoutDates || []), ...(constraints?.forbiddenDayKeys || [])]);
  if (blackout.has(dateKey)) return false;
  if (hasExplicitWeeklyWindows(constraints)) {
    const dayCode = dayCodeFromDayKey(dateKey, timeZone);
    const dayWindows = constraints?.weeklyWindows?.[dayCode];
    return Array.isArray(dayWindows) && dayWindows.length > 0;
  }
  const weekdays = normalizeWeekdays(constraints?.workableDayPolicy?.weekdays);
  if (!weekdays) return true;
  const weekday = weekdayIndex(dateKey, timeZone);
  return weekdays.includes(weekday);
}

function normalizeWeekdays(weekdays?: Array<number | string>) {
  if (!weekdays || !weekdays.length) return null;
  const out: number[] = [];
  weekdays.forEach((d) => {
    if (typeof d === 'number' && d >= 0 && d <= 6) out.push(d);
    if (typeof d === 'string') {
      const key = d.slice(0, 3).toLowerCase();
      if (key in WEEKDAY_MAP) out.push(WEEKDAY_MAP[key]);
    }
  });
  return Array.from(new Set(out));
}

function weekdayIndex(dateKey: string, timezone: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(dt);
  const key = day.slice(0, 3).toLowerCase();
  return WEEKDAY_MAP[key] ?? 0;
}

function pad2(value: number) {
  return `${value}`.padStart(2, '0');
}

function scheduleHorizonBlocks({
  dayKeys,
  plannedPerDay,
  timeZone,
  goalId,
  cycleId,
  constraints,
  acceptedBlocks,
  actionSequence,
  sessionPlan,
}: {
  dayKeys: string[];
  plannedPerDay: number;
  timeZone: string;
  goalId: string;
  cycleId: string;
  constraints: Constraints;
  acceptedBlocks: Array<{ id: string; startISO: string; durationMinutes: number }>;
  actionSequence: Array<{
    id?: string;
    title?: string;
    deliverable?: string;
    definitionOfDone?: string;
    actionType?: 'preparation' | 'execution';
    estimateMin?: number;
    dependencies?: string[];
    deliverableId?: string | null;
    deliverableTitle?: string | null;
    sessionTitles?: string[];
  }>;
  sessionPlan: Array<{
    date?: string;
    startTime?: string;
    durationMinutes?: number;
    actionSteps?: string[];
    completionCondition?: string;
    deliverableId?: string;
    actionId?: string;
    title?: string;
  }>;
}) {
  const placed: Array<{
    id: string;
    dayKey: string;
    startISO: string;
    durationMinutes: number;
    kind: string;
    title: string;
    identityKey?: string;
    deliverableId?: string | null;
    actionId?: string | null;
    directDependencyIds?: string[];
    transitiveDependencyIds?: string[];
    sessionIndex?: number | null;
    actionSteps?: string[];
    completionCondition?: string | null;
    detailTitle?: string | null;
    endISO?: string | null;
    owner?: string | null;
    producesArtifact?: string | null;
    consumedBy?: string[] | string | null;
    passEvidence?: string | null;
    consumedByRef?: { type: string; id: string } | null;
  }> = [];
  const conflicts: AutoAsanaPlan['conflicts'] = [];
  const recoveryOptions: AutoAsanaPlan['recoveryOptions'] = [];
  const unscheduledDrafts: any[] = [];
  const durationMinutes = Math.max(15, constraints?.minSessionMinutes || 60);
  const requiredDrafts = buildRequiredDrafts(
    dayKeys,
    plannedPerDay,
    goalId,
    cycleId,
    durationMinutes,
    acceptedBlocks,
    actionSequence,
    sessionPlan,
    constraints
  );
  if (!dayKeys.length || requiredDrafts.length === 0) {
    return { placed, conflicts, recoveryOptions, requiredDraftCount: requiredDrafts.length };
  }

  const allowedBase = normalizeWindows(constraints?.workingHoursWindows || [{ startMin: 0, endMin: 1440 }]);
  const forbidden = normalizeWindows(constraints?.forbiddenTimeWindows || []);
  const existingBusy = busyFromAcceptedBlocks(acceptedBlocks, timeZone);
  const placedBusyByDay: Record<string, TimeWindow[]> = {};
  const startIsoCache = new Map<string, string | null>();
  const completionByActionId = buildAcceptedCompletionByActionId(acceptedBlocks);

  const dailyCounts: Record<string, number> = {};
  const weeklyCounts: Record<string, number> = {};
  acceptedBlocks.forEach((block) => {
    const dayKey = dayKeyFromISO(block.startISO, timeZone);
    dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
    const weekKey = weekKeyForDay(dayKey);
    weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;
  });
  const seenIdentityKeys = new Set<string>();

  requiredDrafts.forEach((draft) => {
    if (draft.identityKey && seenIdentityKeys.has(draft.identityKey)) {
      return;
    }
    const dependencyPlacement = resolveDependencyPlacementRequirements(draft, completionByActionId);
    draft.hardGateFloorISO = dependencyPlacement.hardGateStartISO || null;
    draft.directionalFloorISO = dependencyPlacement.directionalStartISO || null;
    if (dependencyPlacement.missingHardGateDependencyIds.length > 0) {
      draft.failCode = 'MISSING_HARD_GATE_COMPLETION';
      draft.recoveryOptions = [
        {
          kind: 'RESCHEDULE_HARD_GATES',
          detail: `Place hard-gate prerequisites before ${draft.title || draft.id}.`,
        },
      ];
      conflicts.push({
        kind: 'UNSCHEDULABLE',
        code: draft.failCode,
        detail: {
          blockId: draft.id,
          missingHardGateDependencyIds: dependencyPlacement.missingHardGateDependencyIds,
        },
        candidateResolutions: draft.recoveryOptions,
      });
      unscheduledDrafts.push({
        ...draft,
        assumedDependencies: [...dependencyPlacement.assumedDirectionalDependencyIds],
      });
      return;
    }
    const slot = findSlotForDraft({
      draft,
      dayKeys,
      timeZone,
      allowedBase,
      forbidden,
      existingBusy,
      placedBusyByDay,
      startIsoCache,
      dailyCounts,
      weeklyCounts,
      constraints,
      earliestHardGateStartISO: dependencyPlacement.hardGateStartISO,
      earliestDirectionalStartISO: dependencyPlacement.directionalStartISO,
    });
    if (!slot) {
      conflicts.push({
        kind: 'UNSCHEDULABLE',
        code: draft.failCode || 'UNSCHEDULABLE',
        detail: { blockId: draft.id, dayKey: draft.failDayKey, attemptedDays: dayKeys.length },
        candidateResolutions: draft.recoveryOptions || [],
      });
      (draft.recoveryOptions || []).forEach((opt) => {
        if (!recoveryOptions.find((r) => r.kind === opt.kind && r.detail === opt.detail)) {
          recoveryOptions.push(opt);
        }
      });
      unscheduledDrafts.push({
        ...draft,
        assumedDependencies: [...dependencyPlacement.assumedDirectionalDependencyIds],
      });
      return;
    }
    const placedEndISO = computePlacedBlockEndISO(slot.startISO, draft, constraints, timeZone);
    placed.push({
      id: draft.id,
      dayKey: slot.dayKey,
      startISO: slot.startISO,
      durationMinutes: draft.durationMinutes,
      kind:
        draft.blockType === 'waiting_period'
          ? 'WAITING_PERIOD'
          : draft.blockType === 'capital_checkpoint'
            ? 'CAPITAL_CHECKPOINT'
            : 'EXECUTION',
      title: draft.title || 'Auto Asana Execution',
      identityKey: draft.identityKey || '',
      deliverableId: draft.deliverableId || null,
      actionId: draft.actionId || null,
      directDependencyIds: Array.isArray(draft.directDependencyIds) ? [...draft.directDependencyIds] : [],
      directDependencyDetails: Array.isArray(draft.directDependencyDetails) ? [...draft.directDependencyDetails] : [],
      transitiveDependencyIds: Array.isArray(draft.transitiveDependencyIds) ? [...draft.transitiveDependencyIds] : [],
      transitiveDependencyDetails: Array.isArray(draft.transitiveDependencyDetails)
        ? [...draft.transitiveDependencyDetails]
        : [],
      commerceReadinessLevel: draft.commerceReadinessLevel || null,
      placementBasis:
        dependencyPlacement.assumedDirectionalDependencyIds.length > 0 ? 'assumption' : 'confirmed',
      assumedDependencies: [...dependencyPlacement.assumedDirectionalDependencyIds],
      sessionIndex: Number.isFinite(draft.sessionIndex) ? draft.sessionIndex : null,
      actionSteps: Array.isArray(draft.actionSteps) ? [...draft.actionSteps] : [],
      completionCondition: draft.completionCondition || null,
      detailTitle: draft.detailTitle || draft.title || null,
      endISO: placedEndISO,
      blockType: draft.blockType || 'execution',
      waitType: draft.waitType || null,
      minimumDurationBusinessDays:
        Number.isFinite(Number(draft.minimumDurationBusinessDays)) ? Number(draft.minimumDurationBusinessDays) : null,
      parallelWorkSuggestions: Array.isArray(draft.parallelWorkSuggestions) ? [...draft.parallelWorkSuggestions] : [],
      requiredWorkFamily: draft.requiredWorkFamily || null,
      capitalGateId: draft.capitalGateId || null,
      pathwayTag: draft.pathwayTag || null,
      owner: draft.owner ?? null,
      producesArtifact: draft.producesArtifact ?? null,
      consumedBy: Array.isArray(draft.consumedBy) ? [...draft.consumedBy] : draft.consumedBy ?? null,
      passEvidence: draft.passEvidence ?? null,
      consumedByRef: draft.consumedByRef ? { ...draft.consumedByRef } : draft.consumedByRef ?? null,
    });
    if (draft.identityKey) {
      seenIdentityKeys.add(draft.identityKey);
    }
    const slotStartMin = minutesFromISO(slot.startISO, timeZone);
    if (!placedBusyByDay[slot.dayKey]) placedBusyByDay[slot.dayKey] = [];
    placedBusyByDay[slot.dayKey].push({ startMin: slotStartMin, endMin: slotStartMin + draft.durationMinutes });
    dailyCounts[slot.dayKey] = (dailyCounts[slot.dayKey] || 0) + 1;
    const weekKey = weekKeyForDay(slot.dayKey);
    weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;
    updateCompletionByActionId(completionByActionId, draft.actionId, slot.startISO, draft.durationMinutes, placedEndISO);
  });

  if (
    constraints?.longHorizonNonRecurring &&
    String(constraints?.earlyCompletionJustification || '').trim().length < 12
  ) {
    const placedDayKeys = placed
      .map((block) => String(block?.dayKey || '').trim())
      .filter((dayKey) => /^\d{4}-\d{2}-\d{2}$/.test(dayKey))
      .sort();
    const horizonDays = dayKeys.length ? Math.max(1, dayKeyDistance(dayKeys[0], dayKeys[dayKeys.length - 1]) + 1) : 0;
    const lastPlacedDayKey = placedDayKeys[placedDayKeys.length - 1] || '';
    const remainingTailDays =
      lastPlacedDayKey && dayKeys.length
        ? Math.max(0, dayKeyDistance(lastPlacedDayKey, dayKeys[dayKeys.length - 1]))
        : 0;
    const remainingTailRatio = horizonDays > 0 ? remainingTailDays / horizonDays : 0;
    const hasClosureCheckpoint = placed.some((block) =>
      /final validation|terminal closure checkpoint|closure checkpoint/i.test(String(block?.title || ''))
    );

    if (placed.length > 0 && !hasClosureCheckpoint && remainingTailDays >= 60 && remainingTailRatio > 0.25) {
      const targetIndex = Math.min(dayKeys.length - 1, Math.max(0, Math.floor(dayKeys.length * 0.9)));
      const targetDayKey = dayKeys[targetIndex] || dayKeys[dayKeys.length - 1];
      const anchorBlock = placed[placed.length - 1] || {};
      if (targetDayKey && targetDayKey > lastPlacedDayKey) {
        const actionId = String(anchorBlock.actionId || 'long-horizon-closure').trim();
        const deliverableId = String(anchorBlock.deliverableId || 'long-horizon-terminal').trim();
        const nextSessionIndex =
          Math.max(
            -1,
            ...placed
              .filter((block) => String(block?.actionId || '') === actionId)
              .map((block) => Number(block?.sessionIndex))
              .filter((index) => Number.isFinite(index))
          ) + 1;
        const identityKey = buildProposalIdentityKey({
          cycleId,
          deliverableId,
          actionId,
          sessionIndex: nextSessionIndex,
        });
        const anchorTitle = String(anchorBlock.title || anchorBlock.detailTitle || 'the long-term goal')
          .replace(/\s*\(Session\s+\d+\/\d+\)\s*$/i, '')
          .trim();
        const closureDraft = {
          id: `blk-auto-${identityKey}`,
          durationMinutes: Math.max(30, Math.min(90, Number(durationMinutes) || 60)),
          targetDayKey,
          title: `Final validation and terminal closure checkpoint for ${anchorTitle}`,
          actionId,
          deliverableId,
          sessionIndex: nextSessionIndex,
          identityKey,
          detailTitle: `Final validation and terminal closure checkpoint for ${anchorTitle}`,
          owner: 'executor',
          producesArtifact: `Terminal closure evidence package for ${anchorTitle}`,
          consumedBy: [`terminalOutcome:${goalId}`],
          passEvidence: `Terminal closure checkpoint recorded with final validation evidence and outcome decision for ${anchorTitle}`,
          consumedByRef: { type: 'terminalOutcome', id: goalId },
        };
        const slot = findSlotForDraft({
          draft: closureDraft,
          dayKeys,
          timeZone,
          allowedBase,
          forbidden,
          existingBusy,
          placedBusyByDay,
          startIsoCache,
          dailyCounts,
          weeklyCounts,
          constraints,
        });
        if (slot) {
          placed.push({
            id: closureDraft.id,
            dayKey: slot.dayKey,
            startISO: slot.startISO,
            durationMinutes: closureDraft.durationMinutes,
            kind: 'EXECUTION',
            title: closureDraft.title,
            identityKey: closureDraft.identityKey,
            deliverableId: closureDraft.deliverableId,
            actionId: closureDraft.actionId,
            directDependencyIds: Array.isArray(closureDraft.directDependencyIds) ? [...closureDraft.directDependencyIds] : [],
            directDependencyDetails: Array.isArray(closureDraft.directDependencyDetails)
              ? [...closureDraft.directDependencyDetails]
              : [],
            transitiveDependencyIds: Array.isArray(closureDraft.transitiveDependencyIds)
              ? [...closureDraft.transitiveDependencyIds]
              : [],
            transitiveDependencyDetails: Array.isArray(closureDraft.transitiveDependencyDetails)
              ? [...closureDraft.transitiveDependencyDetails]
              : [],
            commerceReadinessLevel: closureDraft.commerceReadinessLevel || null,
            placementBasis: 'confirmed',
            assumedDependencies: [],
            sessionIndex: closureDraft.sessionIndex,
            actionSteps: [],
            completionCondition: null,
            detailTitle: closureDraft.detailTitle,
            endISO: new Date(Date.parse(slot.startISO) + closureDraft.durationMinutes * 60 * 1000).toISOString(),
            owner: closureDraft.owner ?? null,
            producesArtifact: closureDraft.producesArtifact ?? null,
            consumedBy: Array.isArray(closureDraft.consumedBy)
              ? [...closureDraft.consumedBy]
              : closureDraft.consumedBy ?? null,
            passEvidence: closureDraft.passEvidence ?? null,
            consumedByRef: closureDraft.consumedByRef ? { ...closureDraft.consumedByRef } : closureDraft.consumedByRef ?? null,
          });
          const slotStartMin = minutesFromISO(slot.startISO, timeZone);
          if (!placedBusyByDay[slot.dayKey]) placedBusyByDay[slot.dayKey] = [];
          placedBusyByDay[slot.dayKey].push({
            startMin: slotStartMin,
            endMin: slotStartMin + closureDraft.durationMinutes,
          });
          dailyCounts[slot.dayKey] = (dailyCounts[slot.dayKey] || 0) + 1;
          const weekKey = weekKeyForDay(slot.dayKey);
          weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;
          updateCompletionByActionId(completionByActionId, closureDraft.actionId, slot.startISO, closureDraft.durationMinutes);
        } else {
          conflicts.push({
            kind: 'UNSCHEDULABLE',
            code: closureDraft.failCode || 'LONG_HORIZON_TAIL_CLOSURE_UNSCHEDULABLE',
            detail: { blockId: closureDraft.id, dayKey: closureDraft.failDayKey, attemptedDays: dayKeys.length },
            candidateResolutions: closureDraft.recoveryOptions || [],
          });
        }
      }
    }
  }

  if (isRuntimeEnvFlagEnabled('JERICHO_DEBUG_SCHEDULER')) {
    // eslint-disable-next-line no-console
    console.log(
      'placed dayKeys',
      placed
        .filter((d) => d?.dayKey)
        .map((d) => d.dayKey)
        .sort()
    );
  }

  const dependencyViolations = validatePlacedBlockDependencies(placed);
  dependencyViolations.forEach((violation) => {
    conflicts.push({
      kind: 'UNSCHEDULABLE',
      code: 'DEPENDENCY_ORDER_VIOLATED',
      detail: violation,
      candidateResolutions: ['REGENERATE_PLAN', 'EXTEND_HORIZON', 'ADJUST_DEPENDENCIES'],
    });
  });

  return { placed, conflicts, recoveryOptions, requiredDraftCount: requiredDrafts.length, unscheduledDrafts };
}

function buildRequiredDrafts(
  dayKeys: string[],
  plannedPerDay: number,
  goalId: string,
  cycleId: string,
  durationMinutes: number,
  acceptedBlocks: Array<{
    id?: string;
    deliverableId?: string | null;
    actionId?: string | null;
    sessionIndex?: number | null;
    identityKey?: string | null;
  }>,
  actionSequence: Array<{
    id?: string;
    title?: string;
    deliverable?: string;
    definitionOfDone?: string;
    actionType?: 'preparation' | 'execution';
    estimateMin?: number;
    dependencies?: string[];
    deliverableId?: string | null;
    deliverableTitle?: string | null;
    sessionTitles?: string[];
  }>,
  sessionPlan: Array<{
    date?: string;
    startTime?: string;
    durationMinutes?: number;
    actionSteps?: string[];
    completionCondition?: string;
    deliverableId?: string;
    actionId?: string;
    title?: string;
  }>,
  constraints: Constraints
) {
  const dependencyMeta = buildActionDependencyMeta(actionSequence);
  const committedIdentityKeys = new Set(
    (acceptedBlocks || [])
      .map((block) => {
        if (block?.identityKey) {
          return String(block.identityKey).trim();
        }
        if (block?.actionId && Number.isFinite(block?.sessionIndex)) {
          return buildProposalIdentityKey({
            cycleId,
            deliverableId: String(block?.deliverableId || 'deliv-synthetic').trim() || 'deliv-synthetic',
            actionId: String(block.actionId).trim(),
            sessionIndex: Number(block.sessionIndex),
          });
        }
        return '';
      })
      .filter(Boolean)
  );
  const orderedActions = orderActionsForScheduling(actionSequence);
  const actionTitleById = new Map<string, string>();
  const actionIdByDeliverableId = new Map<string, string>();
  const actionTitleByDeliverableId = new Map<string, string>();
  const actionMetaById = new Map<
    string,
    {
      title?: string;
      deliverable?: string;
      definitionOfDone?: string;
      actionType?: 'preparation' | 'execution';
      minimumDurationBusinessDays?: number;
      blockType?: 'execution' | 'waiting_period' | 'capital_checkpoint';
      waitType?: string;
      parallelWorkSuggestions?: string[];
      requiredWorkFamily?: string;
      capitalGateId?: string;
      pathwayTag?: string;
    }
  >();
  orderedActions.forEach((action) => {
    const id = String(action?.id || '').trim();
    const title = String(action?.title || '').trim();
    const deliverableId = String(action?.deliverableId || '').trim();
    const deliverableTitle = String(action?.deliverableTitle || '').trim();
    if (id && title) {
      actionTitleById.set(id, title);
    }
    if (deliverableId && id && !actionIdByDeliverableId.has(deliverableId)) {
      actionIdByDeliverableId.set(deliverableId, id);
    }
    if (deliverableId && deliverableTitle && !actionTitleByDeliverableId.has(deliverableId)) {
      actionTitleByDeliverableId.set(deliverableId, deliverableTitle);
    } else if (deliverableId && title && !actionTitleByDeliverableId.has(deliverableId)) {
      actionTitleByDeliverableId.set(deliverableId, title);
    }
    if (id) {
      actionMetaById.set(id, {
        title,
        deliverable: String((action as any)?.deliverable || '').trim() || undefined,
        definitionOfDone: String((action as any)?.definitionOfDone || '').trim() || undefined,
        actionType:
          (action as any)?.actionType === 'preparation' || (action as any)?.actionType === 'execution'
            ? (action as any).actionType
            : undefined,
        minimumDurationBusinessDays: Number.isFinite(Number((action as any)?.minimumDurationBusinessDays))
          ? Number((action as any)?.minimumDurationBusinessDays)
          : undefined,
        blockType: (action as any)?.blockType,
        waitType: String((action as any)?.waitType || '').trim() || undefined,
        parallelWorkSuggestions: Array.isArray((action as any)?.parallelWorkSuggestions)
          ? [...(action as any).parallelWorkSuggestions]
          : undefined,
        requiredWorkFamily: String((action as any)?.requiredWorkFamily || '').trim() || undefined,
        capitalGateId: String((action as any)?.capitalGateId || '').trim() || undefined,
        pathwayTag: String((action as any)?.pathwayTag || '').trim() || undefined,
      });
    }
  });
  const normalizedSessionPlan = normalizeSessionPlanEntries(sessionPlan);
  if (normalizedSessionPlan.length > 0) {
    const totalSessions = Math.max(1, normalizedSessionPlan.length);
    const usesCommercialProductLaunchPacking = isCommercialProductLaunchActionSequence(orderedActions);
    const sessionPlanCompletionByActionId = buildSessionPlanCompletionByActionId(normalizedSessionPlan);
    const drafts = normalizedSessionPlan
      .map((session, index) => {
        const orderedFallbackAction = orderedActions[Math.min(index, Math.max(0, orderedActions.length - 1))] || null;
        const syntheticActionKey = `synthetic-action-${index + 1}`;
        const deliverableKey =
          session.deliverableId ||
          String(orderedFallbackAction?.deliverableId || '').trim() ||
          `deliv-synthetic-${index + 1}`;
        const deliverableMappedActionId = actionIdByDeliverableId.get(deliverableKey) || '';
        const actionKey =
          session.actionId ||
          deliverableMappedActionId ||
          String(orderedFallbackAction?.id || '').trim() ||
          syntheticActionKey;
        const actionMeta = actionMetaById.get(actionKey) || {};
        const canonicalActionTitle = actionTitleById.get(actionKey) || '';
        const canonicalDeliverableTitle = actionTitleByDeliverableId.get(deliverableKey) || '';
        const sessionIndex = Number.isFinite(session.sessionIndex) ? Number(session.sessionIndex) : index;
        const explicitTargetDayKey = dayKeys.includes(session.date) ? session.date : null;
        const identityKey = buildProposalIdentityKey({
          cycleId,
          deliverableId: deliverableKey,
          actionId: actionKey,
          sessionIndex,
        });
        const operationalTitle = commercialOperationalSessionTitle({
          visibleTitle: session.title,
          actionTitle: canonicalActionTitle || String(orderedFallbackAction?.title || '').trim(),
          deliverableTitle: canonicalDeliverableTitle,
          sessionIndex,
        });
        const prefersCanonicalTitle = !session.actionId && Boolean(canonicalActionTitle || canonicalDeliverableTitle);
        const selectedTitle =
          (prefersCanonicalTitle ? canonicalActionTitle || canonicalDeliverableTitle : '') ||
          operationalTitle ||
          (isGenericSessionTitle(session.title) || !session.title || prefersCanonicalTitle
            ? canonicalDeliverableTitle ||
              canonicalActionTitle ||
              String(orderedFallbackAction?.title || '').trim() ||
              session.title
            : session.title);
        const normalizedTitle = buildActionableExecutionTitle({
          rawTitle: selectedTitle,
          fallbackTitle: operationalTitle,
          deliverableTitle: canonicalDeliverableTitle,
          deliverable: actionMeta.deliverable,
          definitionOfDone: actionMeta.definitionOfDone,
          actionTitle: canonicalActionTitle || String(orderedFallbackAction?.title || '').trim(),
          sessionTitle: session.title,
          blockType: actionMeta.blockType || 'execution',
        });
        return {
          id: `blk-auto-${identityKey}`,
          durationMinutes: session.durationMinutes,
          targetDayKey: explicitTargetDayKey || session.date,
          preferredStartTime: session.startTime,
          title: normalizedTitle,
          actionId: actionKey,
          deliverableId: deliverableKey,
          directDependencyIds: dependencyMeta.directByActionId.get(actionKey) || [],
          directDependencyDetails: dependencyMeta.directDetailsByActionId.get(actionKey) || [],
          transitiveDependencyIds: dependencyMeta.transitiveByActionId.get(actionKey) || [],
          transitiveDependencyDetails: dependencyMeta.transitiveDetailsByActionId.get(actionKey) || [],
          commerceReadinessLevel: inferCommerceReadinessLevel(
            actionKey,
            operationalTitle ||
              canonicalActionTitle ||
              String(orderedFallbackAction?.title || '').trim() ||
              session.title
          ),
          minimumDurationBusinessDays: actionMeta.minimumDurationBusinessDays,
          blockType: actionMeta.blockType || 'execution',
          waitType: actionMeta.waitType || null,
          parallelWorkSuggestions: Array.isArray(actionMeta.parallelWorkSuggestions)
            ? [...actionMeta.parallelWorkSuggestions]
            : [],
          requiredWorkFamily: actionMeta.requiredWorkFamily || null,
          capitalGateId: actionMeta.capitalGateId || null,
          pathwayTag: actionMeta.pathwayTag || null,
          sessionIndex,
          identityKey,
        };
      })
      .filter((draft) => !committedIdentityKeys.has(String(draft.identityKey || '').trim()));
    const packedSessionTargets = usesCommercialProductLaunchPacking
      ? buildCommercialProductLaunchTargetDayKeys(dayKeys, drafts)
      : buildPackedTargetDayKeys(dayKeys, normalizedWeekCount(dayKeys), totalSessions);
    drafts.forEach((draft, index) => {
      const explicitTargetDayKey = dayKeys.includes(draft.targetDayKey) ? draft.targetDayKey : null;
      const packedTargetDayKey = packedSessionTargets[index] || null;
      const hardGateFloorDayKey = resolveHardGateFloorDayKeyFromCompletionMap(draft, sessionPlanCompletionByActionId);
      if (explicitTargetDayKey && (!hardGateFloorDayKey || explicitTargetDayKey >= hardGateFloorDayKey)) {
        draft.targetDayKey = explicitTargetDayKey;
        return;
      }
      draft.targetDayKey = maxDayKey(
        usesCommercialProductLaunchPacking && packedTargetDayKey ? packedTargetDayKey : null,
        hardGateFloorDayKey,
        explicitTargetDayKey,
        draft.targetDayKey
      );
    });
    return hydrateDraftExecutionSubstrate({
      goalId,
      drafts: materializeLongHorizonTailClosureDrafts({
        drafts: sortDraftsByDependency(drafts),
        dayKeys,
        cycleId,
        durationMinutes,
        constraints,
      }),
      actionMetaById,
    });
  }
  // Canonical action sequence present: expand each action into one or more
  // session blocks, then spread all sessions across the available horizon.
  if (orderedActions.length > 0 && dayKeys.length > 0) {
    const baseSessionMinutes = Math.max(15, Number(durationMinutes) || 60);
    const actionSessionCounts = new Map<string, number>();
    const sessionSpecs = orderedActions.flatMap((action, actionIndex) => {
      const actionDuration = Number(action?.estimateMin);
      const totalMinutes = Number.isFinite(actionDuration) && actionDuration > 0 ? actionDuration : baseSessionMinutes;
      const sessionCount = Math.max(1, Math.ceil(totalMinutes / baseSessionMinutes));
      const sessionTitles = Array.isArray((action as any)?.sessionTitles)
        ? ((action as any).sessionTitles as string[])
        : [];
      let remaining = totalMinutes;
      return Array.from({ length: sessionCount }).map((_, idx) => {
        const isLast = idx === sessionCount - 1;
        const chunk = isLast ? Math.max(15, remaining) : Math.max(15, baseSessionMinutes);
        remaining = Math.max(0, remaining - chunk);
        const actionTitle = String(action?.title || '').trim();
        const deliverableTitle = String(action?.deliverableTitle || '').trim();
        const operationalTitle = commercialOperationalSessionTitle({
          visibleTitle: String(sessionTitles[idx] || '').trim(),
          actionTitle,
          deliverableTitle,
          sessionIndex: idx,
        });
        const titleBase =
          operationalTitle ||
          String(sessionTitles[idx] || '').trim() ||
          (isGenericActionTitle(actionTitle) ? deliverableTitle || actionTitle : actionTitle || deliverableTitle) ||
          'Auto Asana Execution';
        const titleNeedsOrdinal = !operationalTitle && !sessionTitles[idx] && sessionCount > 1;
        const actionId = action?.id ? String(action.id) : `synthetic-action-${actionIndex + 1}`;
        const actionMeta = actionMetaById.get(actionId) || {};
        const currentIndex = actionSessionCounts.get(actionId) || 0;
        actionSessionCounts.set(actionId, currentIndex + 1);
        const deliverableId = action?.deliverableId
          ? String(action.deliverableId)
          : `deliv-synthetic-${actionIndex + 1}`;
        const rawTitle = titleNeedsOrdinal ? `${titleBase} (Session ${idx + 1}/${sessionCount})` : titleBase;
        const title = buildActionableExecutionTitle({
          rawTitle,
          fallbackTitle: operationalTitle,
          deliverableTitle,
          deliverable: actionMeta.deliverable,
          definitionOfDone: actionMeta.definitionOfDone,
          actionTitle,
          sessionTitle: String(sessionTitles[idx] || '').trim(),
          blockType: actionMeta.blockType || 'execution',
        });
        return {
          actionId,
          deliverableId,
          title,
          durationMinutes: chunk,
          directDependencyIds: dependencyMeta.directByActionId.get(actionId) || [],
          directDependencyDetails: dependencyMeta.directDetailsByActionId.get(actionId) || [],
          transitiveDependencyIds: dependencyMeta.transitiveByActionId.get(actionId) || [],
          transitiveDependencyDetails: dependencyMeta.transitiveDetailsByActionId.get(actionId) || [],
          commerceReadinessLevel: inferCommerceReadinessLevel(actionId, title),
          minimumDurationBusinessDays: actionMeta.minimumDurationBusinessDays,
          blockType: actionMeta.blockType || 'execution',
          waitType: actionMeta.waitType || null,
          parallelWorkSuggestions: Array.isArray(actionMeta.parallelWorkSuggestions)
            ? [...actionMeta.parallelWorkSuggestions]
            : [],
          requiredWorkFamily: actionMeta.requiredWorkFamily || null,
          capitalGateId: actionMeta.capitalGateId || null,
          pathwayTag: actionMeta.pathwayTag || null,
          sessionIndex: currentIndex,
        };
      });
    });

    const totalSessions = Math.max(1, sessionSpecs.length);
    const packedTargets = isCommercialProductLaunchActionSequence(orderedActions)
      ? buildCommercialProductLaunchTargetDayKeys(dayKeys, sessionSpecs)
      : buildPackedTargetDayKeys(dayKeys, normalizedWeekCount(dayKeys), totalSessions);
    const drafts = sessionSpecs
      .map((session, index) => {
        const targetDayKey =
          packedTargets[index] || dayKeys[Math.min(index, dayKeys.length - 1)] || dayKeys[dayKeys.length - 1];
        return {
          id: `blk-auto-${buildProposalIdentityKey({
            cycleId,
            deliverableId: session.deliverableId,
            actionId: session.actionId,
            sessionIndex: session.sessionIndex,
          })}`,
          durationMinutes: session.durationMinutes,
          targetDayKey,
          title: session.title,
          actionId: session.actionId,
          deliverableId: session.deliverableId,
          directDependencyIds: Array.isArray(session.directDependencyIds) ? [...session.directDependencyIds] : [],
          directDependencyDetails: Array.isArray(session.directDependencyDetails) ? [...session.directDependencyDetails] : [],
          transitiveDependencyIds: Array.isArray(session.transitiveDependencyIds) ? [...session.transitiveDependencyIds] : [],
          transitiveDependencyDetails: Array.isArray(session.transitiveDependencyDetails)
            ? [...session.transitiveDependencyDetails]
            : [],
          commerceReadinessLevel: session.commerceReadinessLevel || null,
          minimumDurationBusinessDays:
            Number.isFinite(Number((session as any)?.minimumDurationBusinessDays))
              ? Number((session as any).minimumDurationBusinessDays)
              : Number.isFinite(Number(session.minimumDurationBusinessDays))
                ? Number(session.minimumDurationBusinessDays)
                : null,
          blockType: (session as any)?.blockType || session.blockType || 'execution',
          waitType: String((session as any)?.waitType || session.waitType || '').trim() || null,
          parallelWorkSuggestions: Array.isArray((session as any)?.parallelWorkSuggestions)
            ? [...(session as any).parallelWorkSuggestions]
            : Array.isArray(session.parallelWorkSuggestions)
              ? [...session.parallelWorkSuggestions]
              : [],
          requiredWorkFamily:
            String((session as any)?.requiredWorkFamily || session.requiredWorkFamily || '').trim() || null,
          capitalGateId: String((session as any)?.capitalGateId || session.capitalGateId || '').trim() || null,
          pathwayTag: String((session as any)?.pathwayTag || session.pathwayTag || '').trim() || null,
          sessionIndex: session.sessionIndex,
          identityKey: buildProposalIdentityKey({
            cycleId,
            deliverableId: session.deliverableId,
            actionId: session.actionId,
            sessionIndex: session.sessionIndex,
          }),
        };
      })
      .filter((draft) => !committedIdentityKeys.has(String(draft.identityKey || '').trim()));
    return hydrateDraftExecutionSubstrate({
      goalId,
      drafts: materializeLongHorizonTailClosureDrafts({
        drafts: sortDraftsByDependency(drafts),
        dayKeys,
        cycleId,
        durationMinutes,
        constraints,
      }),
      actionMetaById,
    });
  }
  const drafts: Array<{
    id: string;
    durationMinutes: number;
    targetDayKey: string;
    preferredStartTime?: string;
    title?: string;
    deliverableId?: string | null;
    actionId?: string | null;
    directDependencyIds?: string[];
    directDependencyDetails?: DependencyDetail[];
    transitiveDependencyIds?: string[];
    transitiveDependencyDetails?: DependencyDetail[];
    sessionIndex?: number;
    identityKey?: string;
    failCode?: string;
    failDayKey?: string;
    recoveryOptions?: any[];
  }> = [];
  let actionCursor = 0;
  dayKeys.forEach((dayKey) => {
    for (let idx = 0; idx < plannedPerDay; idx += 1) {
      const action = orderedActions.length ? orderedActions[actionCursor % orderedActions.length] : null;
      actionCursor += 1;
      const actionTitle = String(action?.title || '').trim();
      const actionDuration = Number(action?.estimateMin);
      const actionId = action?.id ? String(action.id) : `synthetic-action-${actionCursor}`;
      const actionMeta = actionMetaById.get(actionId) || {};
      const deliverableId = action?.deliverableId ? String(action.deliverableId) : `deliv-synthetic-${actionCursor}`;
      const sessionIndex = idx;
      const identityKey = buildProposalIdentityKey({
        cycleId,
        deliverableId,
        actionId,
        sessionIndex,
      });
      drafts.push({
        id: `blk-auto-${identityKey}`,
        durationMinutes: Number.isFinite(actionDuration) && actionDuration > 0 ? actionDuration : durationMinutes,
        targetDayKey: dayKey,
        title: actionTitle || 'Auto Asana Execution',
        actionId,
        deliverableId,
        directDependencyIds: dependencyMeta.directByActionId.get(actionId) || [],
        directDependencyDetails: dependencyMeta.directDetailsByActionId.get(actionId) || [],
        transitiveDependencyIds: dependencyMeta.transitiveByActionId.get(actionId) || [],
        transitiveDependencyDetails: dependencyMeta.transitiveDetailsByActionId.get(actionId) || [],
        commerceReadinessLevel: inferCommerceReadinessLevel(actionId, actionTitle),
        minimumDurationBusinessDays: actionMeta.minimumDurationBusinessDays,
        blockType: actionMeta.blockType || 'execution',
        waitType: actionMeta.waitType || null,
        parallelWorkSuggestions: Array.isArray(actionMeta.parallelWorkSuggestions)
          ? [...actionMeta.parallelWorkSuggestions]
          : [],
        requiredWorkFamily: actionMeta.requiredWorkFamily || null,
        capitalGateId: actionMeta.capitalGateId || null,
        pathwayTag: actionMeta.pathwayTag || null,
        sessionIndex,
        identityKey,
      });
    }
  });
  return hydrateDraftExecutionSubstrate({
    goalId,
    drafts: materializeLongHorizonTailClosureDrafts({
      drafts: sortDraftsByDependency(drafts),
      dayKeys,
      cycleId,
      durationMinutes,
      constraints,
    }),
    actionMetaById,
  });
}

function resolveGeneratedBlockOwner(blockType?: string | null) {
  if (blockType === 'waiting_period') {
    return null;
  }
  return 'executor';
}

function normalizeExecutionTitleWord(value: unknown) {
  return String(value || '')
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z-]/g, '');
}

function isActionableExecutionTitle(value: unknown) {
  const title = String(value || '').trim();
  if (!title) {
    return false;
  }
  const words = title.split(/\s+/);
  if (words.length < 3) {
    return false;
  }
  return EXECUTION_TITLE_ACTION_VERBS.has(normalizeExecutionTitleWord(title));
}

function rewriteExecutionLeadVerb(value: unknown) {
  const title = String(value || '').trim();
  if (!title) {
    return '';
  }
  const words = title.split(/\s+/);
  const firstWord = normalizeExecutionTitleWord(title);
  const rewrittenVerb = EXECUTION_TITLE_VERB_REWRITE[firstWord];
  if (!rewrittenVerb) {
    return title;
  }
  return [rewrittenVerb.charAt(0).toUpperCase() + rewrittenVerb.slice(1), ...words.slice(1)].join(' ');
}

function inferExecutionTitleVerb({
  rawTitle,
  deliverableTitle,
  deliverable,
  definitionOfDone,
}: {
  rawTitle?: unknown;
  deliverableTitle?: unknown;
  deliverable?: unknown;
  definitionOfDone?: unknown;
}) {
  const context = [rawTitle, deliverableTitle, deliverable, definitionOfDone]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\b(record|episode|podcast|audio|interview|segment)\b/i.test(context)) {
    return 'Record';
  }
  if (/\b(validate|review|proof|criteria|acceptance|qa|quality|check)\b/i.test(context)) {
    return 'Validate';
  }
  if (/\b(test|checkout|flow|payment|order path|order capture)\b/i.test(context)) {
    return 'Test';
  }
  if (/\b(package|evidence|bundle|packet|submission)\b/i.test(context)) {
    return 'Package';
  }
  if (/\b(map|dependency)\b/i.test(context)) {
    return 'Map';
  }
  if (/\b(compare|moq|lead time|quote)\b/i.test(context)) {
    return 'Compare';
  }
  if (/\b(request|outreach|supplier|manufacturer|sample)\b/i.test(context)) {
    return 'Create';
  }
  if (/\b(configure|setup)\b/i.test(context)) {
    return 'Configure';
  }
  if (/\b(build|page|dashboard|system|workflow|funnel|checkout)\b/i.test(context)) {
    return 'Build';
  }
  if (/\b(write|copy|script|brief|outline|messaging)\b/i.test(context)) {
    return 'Draft';
  }
  if (/\b(list|checklist|question|notes|criteria)\b/i.test(context)) {
    return 'Create';
  }
  return 'Create';
}

function normalizeExecutionObjectTitle(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/\s+\(Session\s+\d+\/\d+\)$/i, '')
    .replace(/^[\s.:;-]+|[\s.:;-]+$/g, '');
}

function buildActionableExecutionTitle({
  rawTitle,
  fallbackTitle,
  deliverableTitle,
  deliverable,
  definitionOfDone,
  actionTitle,
  sessionTitle,
  blockType,
}: {
  rawTitle?: unknown;
  fallbackTitle?: unknown;
  deliverableTitle?: unknown;
  deliverable?: unknown;
  definitionOfDone?: unknown;
  actionTitle?: unknown;
  sessionTitle?: unknown;
  blockType?: string | null;
}) {
  if (blockType && blockType !== 'execution') {
    return String(rawTitle || fallbackTitle || '').trim();
  }

  const raw = String(rawTitle || '').trim();
  if (raw && raw.split(/\s+/).length < 3) {
    return raw;
  }
  if (isActionableExecutionTitle(raw)) {
    return raw;
  }
  const rewrittenRaw = rewriteExecutionLeadVerb(raw);
  if (isActionableExecutionTitle(rewrittenRaw)) {
    return rewrittenRaw;
  }

  const fallback = String(fallbackTitle || '').trim();
  if (fallback && fallback.split(/\s+/).length < 3) {
    return fallback;
  }
  if (isActionableExecutionTitle(fallback)) {
    return fallback;
  }
  const rewrittenFallback = rewriteExecutionLeadVerb(fallback);
  if (isActionableExecutionTitle(rewrittenFallback)) {
    return rewrittenFallback;
  }

  const objectTitle =
    normalizeExecutionObjectTitle(deliverableTitle) ||
    normalizeExecutionObjectTitle(deliverable) ||
    normalizeExecutionObjectTitle(actionTitle) ||
    normalizeExecutionObjectTitle(sessionTitle) ||
    normalizeExecutionObjectTitle(raw) ||
    normalizeExecutionObjectTitle(fallback) ||
    'execution deliverable';
  const verb = inferExecutionTitleVerb({
    rawTitle: raw,
    deliverableTitle,
    deliverable,
    definitionOfDone,
  });
  let title = `${verb} ${objectTitle}`.replace(/\s+/g, ' ').trim();

  if (title.split(/\s+/).length < 3) {
    const qualifier =
      normalizeExecutionObjectTitle(definitionOfDone) ||
      normalizeExecutionObjectTitle(deliverable) ||
      'work package';
    title = `${title} for ${qualifier}`.replace(/\s+/g, ' ').trim();
  }

  return title;
}


function hydrateDraftExecutionSubstrate({
  goalId,
  drafts,
  actionMetaById,
}: {
  goalId: string;
  drafts: any[];
  actionMetaById: Map<
    string,
    {
      title?: string;
      deliverable?: string;
      definitionOfDone?: string;
      actionType?: 'preparation' | 'execution';
    }
  >;
}) {
  const safeDrafts = Array.isArray(drafts) ? drafts.map((draft) => ({ ...draft })) : [];
  const downstreamDraftsByActionId = new Map<string, any[]>();

  safeDrafts.forEach((draft) => {
    const directDependencyIds = Array.isArray(draft?.directDependencyIds)
      ? draft.directDependencyIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : [];
    directDependencyIds.forEach((dependencyId) => {
      const downstream = downstreamDraftsByActionId.get(dependencyId) || [];
      downstream.push(draft);
      downstreamDraftsByActionId.set(dependencyId, downstream);
    });
  });

  return safeDrafts.map((draft) => {
    if (draft?.blockType === 'waiting_period') {
      return draft;
    }

    const actionId = String(draft?.actionId || '').trim();
    const actionMeta = actionMetaById.get(actionId) || {};
    const currentSessionIndex = Number.isFinite(Number(draft?.sessionIndex)) ? Number(draft.sessionIndex) : null;
    const nextSessionDraft =
      currentSessionIndex === null
        ? null
        : safeDrafts.find(
            (candidate) =>
              String(candidate?.actionId || '').trim() === actionId &&
              Number.isFinite(Number(candidate?.sessionIndex)) &&
              Number(candidate.sessionIndex) === currentSessionIndex + 1
          ) || null;
    const downstreamDraft = (downstreamDraftsByActionId.get(actionId) || [])[0] || null;

    let consumedByRef = null;
    let consumedBy: string[] | null = null;
    if (nextSessionDraft?.id) {
      consumedByRef = { type: 'block', id: String(nextSessionDraft.id) };
      consumedBy = [String(nextSessionDraft.title || nextSessionDraft.detailTitle || nextSessionDraft.id)];
    } else if (downstreamDraft?.id) {
      consumedByRef = { type: 'block', id: String(downstreamDraft.id) };
      consumedBy = [String(downstreamDraft.title || downstreamDraft.detailTitle || downstreamDraft.id)];
    } else if (goalId) {
      consumedByRef = { type: 'terminalOutcome', id: goalId };
      consumedBy = [`terminalOutcome:${goalId}`];
    }

    return {
      ...draft,
      owner: resolveGeneratedBlockOwner(draft?.blockType),
      producesArtifact: String(actionMeta?.deliverable || '').trim() || null,
      consumedBy,
      passEvidence: String(actionMeta?.definitionOfDone || '').trim() || null,
      consumedByRef,
    };
  });
}

function dayKeyDistance(startDayKey: string, endDayKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDayKey) || !/^\d{4}-\d{2}-\d{2}$/.test(endDayKey)) {
    return 0;
  }
  const start = Date.parse(`${startDayKey}T12:00:00.000Z`);
  const end = Date.parse(`${endDayKey}T12:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  return Math.round((end - start) / 86400000);
}

function normalizeDependencyType(value: unknown): DependencyType | null {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (normalized === 'hard_gate' || normalized === 'hard-gate' || normalized === 'hard') {
    return 'hard_gate';
  }
  if (normalized === 'directional' || normalized === 'soft') {
    return 'directional';
  }
  if (normalized === 'informational' || normalized === 'info') {
    return 'informational';
  }
  return null;
}

function normalizeDependencyDetails(rawDetails: unknown[], dependencyIds: string[] = []): DependencyDetail[] {
  const byId = new Map<string, DependencyDetail>();
  (Array.isArray(rawDetails) ? rawDetails : []).forEach((detail) => {
    const record = detail as Record<string, unknown>;
    const actionId = String(record?.actionId || record?.dependencyId || record?.id || '').trim();
    if (!actionId) {
      return;
    }
    byId.set(actionId, {
      actionId,
      dependencyType: normalizeDependencyType(record?.dependencyType) || 'hard_gate',
    });
  });
  (Array.isArray(dependencyIds) ? dependencyIds : []).forEach((dependencyId) => {
    const normalizedActionId = String(dependencyId || '').trim();
    if (!normalizedActionId || byId.has(normalizedActionId)) {
      return;
    }
    byId.set(normalizedActionId, {
      actionId: normalizedActionId,
      dependencyType: 'hard_gate',
    });
  });
  return dependencyIds
    .map((dependencyId) => byId.get(String(dependencyId || '').trim()))
    .filter((detail): detail is DependencyDetail => Boolean(detail));
}

function addBusinessDaysFromDayKey(
  startDayKey: string,
  businessDays: number,
  constraints: Constraints,
  timeZone: string
) {
  let cursor = String(startDayKey || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cursor)) {
    return null;
  }
  let remaining = Math.max(0, Number.isFinite(businessDays) ? Math.floor(businessDays) : 0);
  let guard = 0;
  while (remaining > 0 && guard < 5000) {
    const next = addDays(cursor, 1, timeZone);
    if (!next || next === cursor) {
      break;
    }
    cursor = next;
    if (isWorkableDate(cursor, constraints, timeZone)) {
      remaining -= 1;
    }
    guard += 1;
  }
  return cursor;
}

function computePlacedBlockEndISO(
  startISO: string,
  draft: { durationMinutes?: number; minimumDurationBusinessDays?: number; blockType?: string },
  constraints: Constraints,
  timeZone: string
) {
  const minimumDurationBusinessDays = Number(draft?.minimumDurationBusinessDays);
  if (draft?.blockType === 'waiting_period' && Number.isFinite(minimumDurationBusinessDays) && minimumDurationBusinessDays > 0) {
    const startDayKey = dayKeyFromISO(startISO, timeZone);
    const endDayKey = addBusinessDaysFromDayKey(startDayKey, Math.max(1, Math.floor(minimumDurationBusinessDays)), constraints, timeZone);
    if (endDayKey) {
      return `${endDayKey}T23:59:59.000Z`;
    }
  }
  return new Date(Date.parse(startISO) + Number(draft?.durationMinutes || 0) * 60 * 1000).toISOString();
}

function dependencyDayKeyFloorRank(dependencyType: DependencyType) {
  if (dependencyType === 'hard_gate') {
    return 2;
  }
  if (dependencyType === 'directional') {
    return 1;
  }
  return 0;
}

function dependencyTypeRank(dependencyType: DependencyType) {
  if (dependencyType === 'hard_gate') {
    return 2;
  }
  if (dependencyType === 'directional') {
    return 1;
  }
  return 0;
}

function dependencyTypeFromRank(rank: number): DependencyType {
  if (rank >= 2) {
    return 'hard_gate';
  }
  if (rank >= 1) {
    return 'directional';
  }
  return 'informational';
}

function composeDependencyType(left: DependencyType, right: DependencyType): DependencyType {
  return dependencyTypeFromRank(Math.min(dependencyTypeRank(left), dependencyTypeRank(right)));
}

function mergeDependencyType(target: Map<string, DependencyType>, actionId: string, dependencyType: DependencyType) {
  const existing = target.get(actionId);
  if (!existing || dependencyTypeRank(dependencyType) > dependencyTypeRank(existing)) {
    target.set(actionId, dependencyType);
  }
}

function materializeLongHorizonTailClosureDrafts({
  drafts,
  dayKeys,
  cycleId,
  durationMinutes,
  constraints,
}: {
  drafts: any[];
  dayKeys: string[];
  cycleId: string;
  durationMinutes: number;
  constraints: Constraints;
}) {
  if (
    !constraints?.longHorizonNonRecurring ||
    String(constraints?.earlyCompletionJustification || '').trim().length >= 12
  ) {
    return drafts;
  }
  if (!Array.isArray(dayKeys) || dayKeys.length === 0 || !Array.isArray(drafts) || drafts.length === 0) {
    return drafts;
  }
  const horizonDays = Math.max(1, dayKeyDistance(dayKeys[0], dayKeys[dayKeys.length - 1]) + 1);
  if (horizonDays < 180) {
    return drafts;
  }
  const targetDayKeys = drafts
    .map((draft) => String(draft?.targetDayKey || '').trim())
    .filter((dayKey) => /^\d{4}-\d{2}-\d{2}$/.test(dayKey))
    .sort();
  if (targetDayKeys.length === 0) {
    return drafts;
  }
  const lastTargetDayKey = targetDayKeys[targetDayKeys.length - 1];
  const remainingTailDays = Math.max(0, dayKeyDistance(lastTargetDayKey, dayKeys[dayKeys.length - 1]));
  const remainingTailRatio = remainingTailDays / horizonDays;
  if (remainingTailDays < 60 || remainingTailRatio <= 0.25) {
    return drafts;
  }

  const targetIndex = Math.min(dayKeys.length - 1, Math.max(0, Math.floor(dayKeys.length * 0.9)));
  const targetDayKey = dayKeys[targetIndex] || dayKeys[dayKeys.length - 1];
  if (!targetDayKey || targetDayKey <= lastTargetDayKey) {
    return drafts;
  }

  const anchorDraft = drafts[drafts.length - 1] || {};
  const deliverableId = String(anchorDraft.deliverableId || 'long-horizon-terminal').trim();
  const actionId = String(anchorDraft.actionId || `long-horizon-closure-${deliverableId}`).trim();
  const sessionIndex =
    Math.max(
      -1,
      ...drafts
        .filter((draft) => String(draft?.actionId || '') === actionId)
        .map((draft) => Number(draft?.sessionIndex))
        .filter((index) => Number.isFinite(index))
    ) + 1;
  const identityKey = buildProposalIdentityKey({
    cycleId,
    deliverableId,
    actionId,
    sessionIndex,
  });
  const anchorTitle = String(anchorDraft.title || anchorDraft.detailTitle || 'the long-term goal')
    .replace(/\s*\(Session\s+\d+\/\d+\)\s*$/i, '')
    .trim();

  return [
    ...drafts,
    {
      id: `blk-auto-${identityKey}`,
      durationMinutes: Math.max(30, Math.min(90, Number(durationMinutes) || 60)),
      targetDayKey,
      title: `Final validation and terminal closure checkpoint for ${anchorTitle}`,
      actionId,
      deliverableId,
      directDependencyIds: [],
      directDependencyDetails: [],
      transitiveDependencyIds: [],
      transitiveDependencyDetails: [],
      sessionIndex,
      identityKey,
      detailTitle: `Final validation and terminal closure checkpoint for ${anchorTitle}`,
      commerceReadinessLevel: inferCommerceReadinessLevel(actionId, anchorTitle),
    },
  ];
}

function buildSessionPlanCompletionByActionId(
  sessionPlan: Array<{ actionId?: string; date?: string; startTime?: string; durationMinutes?: number }>
) {
  const completionByActionId = new Map<string, string>();
  (Array.isArray(sessionPlan) ? sessionPlan : []).forEach((session) => {
    const actionId = String(session?.actionId || '').trim();
    const date = String(session?.date || '').trim();
    if (!actionId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return;
    }
    const startISO = `${date}T${String(session?.startTime || '09:00').trim() || '09:00'}:00.000Z`;
    updateCompletionByActionId(
      completionByActionId,
      actionId,
      startISO,
      Number(session?.durationMinutes) || 60
    );
  });
  return completionByActionId;
}

function resolveHardGateFloorDayKeyFromCompletionMap(draft: any, completionByActionId: Map<string, string>) {
  const dependencyDetails = normalizeDependencyDetails(
    Array.isArray(draft?.transitiveDependencyDetails) ? draft.transitiveDependencyDetails : [],
    Array.isArray(draft?.transitiveDependencyIds) ? draft.transitiveDependencyIds : []
  ).filter((detail) => detail.dependencyType === 'hard_gate');
  let latestDayKey: string | null = null;
  dependencyDetails.forEach((detail) => {
    const completionISO = completionByActionId.get(String(detail?.actionId || '').trim());
    if (!completionISO) {
      return;
    }
    const dayKey = String(completionISO).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey) && (!latestDayKey || dayKey > latestDayKey)) {
      latestDayKey = dayKey;
    }
  });
  return latestDayKey;
}

function maxDayKey(...dayKeys: Array<string | null | undefined>) {
  return dayKeys
    .filter((dayKey): dayKey is string => Boolean(dayKey) && /^\d{4}-\d{2}-\d{2}$/.test(String(dayKey)))
    .sort()
    .slice(-1)[0] || null;
}

function minDayKey(...dayKeys: Array<string | null | undefined>) {
  return dayKeys
    .filter((dayKey): dayKey is string => Boolean(dayKey) && /^\d{4}-\d{2}-\d{2}$/.test(String(dayKey)))
    .sort()[0] || null;
}

function inferCycleNumber(value: unknown) {
  const text = String(value || '').trim();
  let match = text.match(/brand:0[45]:(\d+):/i);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  match = text.match(/\bcycle[\s:-]+(\d+)\b/i);
  if (match) {
    return Number.parseInt(match[1], 10);
  }
  return null;
}

function buildHorizonRecommendations({
  unscheduledDrafts,
  placed,
  horizonEndDayKey,
  horizonDayCount,
  constraints,
  timeZone,
}: {
  unscheduledDrafts: any[];
  placed: any[];
  horizonEndDayKey: string;
  horizonDayCount: number;
  constraints: Constraints;
  timeZone: string;
}) {
  const safePlaced = Array.isArray(placed) ? placed : [];
  const safeUnscheduled = Array.isArray(unscheduledDrafts) ? unscheduledDrafts : [];
  const scheduledBlockCount = safePlaced.length;
  const unscheduledBlockCount = safeUnscheduled.length;
  if (unscheduledBlockCount <= 0) {
    return [];
  }

  const scheduledDensity = scheduledBlockCount > 0 && horizonDayCount > 0 ? scheduledBlockCount / horizonDayCount : 1;
  const daysNeeded = Math.max(1, Math.ceil(unscheduledBlockCount / Math.max(scheduledDensity, 0.0001)));
  const projectedCompletionDayKey = addBusinessDaysFromDayKey(horizonEndDayKey, daysNeeded, constraints, timeZone);
  const maxHardGateFloorDayKey = maxDayKey(
    ...safeUnscheduled.map((draft) => String(draft?.hardGateFloorISO || '').slice(0, 10) || null)
  );
  const earliestFeasibleCompletionDate = maxDayKey(projectedCompletionDayKey, maxHardGateFloorDayKey);

  const cycleGroups = new Map<number, { placed: any[]; unscheduled: any[] }>();
  const addToCycle = (collection: any[], key: 'placed' | 'unscheduled') => {
    collection.forEach((block) => {
      const cycleNumber = inferCycleNumber(block?.actionId || block?.title || block?.detailTitle);
      if (!Number.isFinite(cycleNumber)) {
        return;
      }
      if (!cycleGroups.has(cycleNumber)) {
        cycleGroups.set(cycleNumber, { placed: [], unscheduled: [] });
      }
      cycleGroups.get(cycleNumber)![key].push(block);
    });
  };
  addToCycle(safePlaced, 'placed');
  addToCycle(safeUnscheduled, 'unscheduled');
  const cycleNumbers = Array.from(cycleGroups.keys()).sort((left, right) => left - right);
  const currentCycleCount = cycleNumbers.length ? Math.max(...cycleNumbers) : 0;
  let recommendedCycleCount = currentCycleCount;
  for (const cycleNumber of cycleNumbers) {
    if ((cycleGroups.get(cycleNumber)?.unscheduled || []).length > 0) {
      recommendedCycleCount = Math.max(0, cycleNumber - 1);
      break;
    }
  }
  const removedCycles =
    recommendedCycleCount < currentCycleCount
      ? Array.from({ length: currentCycleCount - recommendedCycleCount }, (_, index) => recommendedCycleCount + index + 1)
      : [];
  const firstRemovedCycleDayKey = minDayKey(
    ...safePlaced
      .filter((block) => {
        const cycleNumber = inferCycleNumber(block?.actionId || block?.title || block?.detailTitle);
        return Number.isFinite(cycleNumber) && Number(cycleNumber) > recommendedCycleCount;
      })
      .map((block) => block?.dayKey || String(block?.startISO || '').slice(0, 10) || null)
  );
  const recoveredDays =
    firstRemovedCycleDayKey && horizonEndDayKey
      ? Math.max(0, dayKeyDistance(firstRemovedCycleDayKey, horizonEndDayKey) + 1)
      : 0;

  const scheduledThroughDate = maxDayKey(
    ...safePlaced.map((block) => block?.dayKey || String(block?.startISO || '').slice(0, 10) || null)
  );
  const unscheduledFromDate = minDayKey(
    ...safeUnscheduled.map((draft) =>
      minDayKey(
        draft?.targetDayKey || null,
        String(draft?.hardGateFloorISO || '').slice(0, 10) || null,
        String(draft?.directionalFloorISO || '').slice(0, 10) || null
      )
    )
  );

  const recommendations: Array<any> = [
    {
      kind: 'EXTEND_HORIZON',
      extensionDays: daysNeeded,
      extensionWeeks: Math.ceil(daysNeeded / 5),
      earliestFeasibleCompletionDate,
      unscheduledBlockCount,
    },
    {
      kind: 'ACCEPT_PARTIAL_PLAN',
      scheduledBlockCount,
      unscheduledBlockCount,
      scheduledThroughDate,
      unscheduledFromDate,
    },
  ];

  if (currentCycleCount > 0 && recommendedCycleCount < currentCycleCount) {
    recommendations.splice(1, 0, {
      kind: 'REDUCE_CYCLE_COUNT',
      currentCycleCount,
      recommendedCycleCount,
      removedCycles,
      recoveredDays,
    });
  }

  return recommendations;
}

function normalizedWeekCount(dayKeys: string[]) {
  const count = new Set((dayKeys || []).map((dayKey) => weekKeyForDay(dayKey))).size;
  return Math.max(1, count);
}

function buildPackedTargetDayKeys(dayKeys: string[], weekCount: number, totalSessions: number) {
  if (!Array.isArray(dayKeys) || dayKeys.length === 0 || !Number.isFinite(totalSessions) || totalSessions <= 0) {
    return [];
  }
  const horizonDays = dayKeyDistance(dayKeys[0], dayKeys[dayKeys.length - 1]) + 1;
  if (horizonDays >= 120 && totalSessions > weekCount) {
    return Array.from({ length: totalSessions }).map((_, index) => {
      const dayIndex = Math.round((index * (dayKeys.length - 1)) / Math.max(1, totalSessions - 1));
      return dayKeys[Math.min(dayKeys.length - 1, dayIndex)] || dayKeys[dayKeys.length - 1];
    });
  }
  const weeksInOrder: string[][] = [];
  let currentWeekKey = '';
  (dayKeys || []).forEach((dayKey) => {
    const weekKey = weekKeyForDay(dayKey);
    if (weekKey !== currentWeekKey) {
      weeksInOrder.push([]);
      currentWeekKey = weekKey;
    }
    weeksInOrder[weeksInOrder.length - 1].push(dayKey);
  });
  if (totalSessions <= weeksInOrder.length) {
    return Array.from({ length: totalSessions }).map((_, index) => {
      const weekIndex =
        totalSessions === 1
          ? 0
          : Math.min(
              weeksInOrder.length - 1,
              Math.round((index * Math.max(0, weeksInOrder.length - 1)) / Math.max(1, totalSessions - 1))
            );
      const weekDays = weeksInOrder[weekIndex] || [];
      return weekDays[0] || dayKeys[dayKeys.length - 1];
    });
  }
  const sessionsPerWeek = Math.max(1, Math.ceil(totalSessions / Math.max(1, weekCount)));
  const targets: string[] = [];
  for (let index = 0; index < totalSessions; index += 1) {
    const weekIndex = Math.min(weeksInOrder.length - 1, Math.floor(index / sessionsPerWeek));
    const slotIndex = index % sessionsPerWeek;
    const weekDays = weeksInOrder[weekIndex] || [];
    const targetDayKey = weekDays[Math.min(slotIndex, Math.max(0, weekDays.length - 1))] || dayKeys[dayKeys.length - 1];
    targets.push(targetDayKey);
  }
  return targets;
}

function isCommercialProductLaunchActionSequence(
  actions: Array<{
    id?: string;
    title?: string;
    deliverableTitle?: string | null;
    sessionTitles?: string[];
  }>
) {
  if (!Array.isArray(actions) || actions.length === 0) return false;
  const haystack = actions
    .map((action) =>
      [
        String(action?.id || ''),
        String(action?.title || ''),
        String(action?.deliverableTitle || ''),
        ...(Array.isArray(action?.sessionTitles) ? action.sessionTitles.map((title) => String(title || '')) : []),
      ].join(' ')
    )
    .join(' ')
    .toLowerCase();
  return (
    /brand:0[1-5]:/.test(haystack) &&
    /gum|caffeinated|first[-\s]?sales|checkout|purchase[-\s]?path|buyer|outreach|fulfillment/.test(haystack)
  );
}

function buildCommercialProductLaunchTargetDayKeys(
  dayKeys: string[],
  sessionSpecs: Array<{
    actionId: string;
    deliverableId: string;
    title: string;
    durationMinutes: number;
    sessionIndex: number;
  }>
) {
  if (!Array.isArray(dayKeys) || dayKeys.length === 0 || !Array.isArray(sessionSpecs) || sessionSpecs.length === 0) {
    return [];
  }

  const targets = Array.from({ length: sessionSpecs.length }).map(() => dayKeys[dayKeys.length - 1]);
  const foundationIndexes = sessionSpecs
    .map((spec, index) => ({ spec, index }))
    .filter(({ spec }) => /^brand:0[123]:/.test(String(spec?.actionId || '')));
  const cycleIndexes = sessionSpecs
    .map((spec, index) => ({ spec, index }))
    .filter(({ spec }) => !/^brand:0[123]:/.test(String(spec?.actionId || '')));

  const foundationTargetDays = Math.max(1, Math.ceil(foundationIndexes.length / 2));
  foundationIndexes.forEach(({ index }, foundationIndex) => {
    const targetIndex = Math.min(dayKeys.length - 1, Math.floor(foundationIndex / 2));
    targets[index] = dayKeys[targetIndex] || dayKeys[0];
  });

  const cycleStartIndex = Math.min(
    Math.max(0, dayKeys.length - 1),
    Math.max(foundationTargetDays + 3, Math.floor(dayKeys.length * 0.34))
  );
  const cycleDayKeys = dayKeys.slice(cycleStartIndex);
  cycleIndexes.forEach(({ index }, cycleIndex) => {
    const targetIndex =
      cycleIndexes.length <= 1
        ? 0
        : Math.round((cycleIndex * Math.max(0, cycleDayKeys.length - 1)) / Math.max(1, cycleIndexes.length - 1));
    targets[index] = cycleDayKeys[Math.min(cycleDayKeys.length - 1, targetIndex)] || dayKeys[dayKeys.length - 1];
  });

  return targets;
}

function orderActionsForScheduling(
  actions: Array<{
    id?: string;
    title?: string;
    estimateMin?: number;
    dependencies?: string[];
    deliverableId?: string | null;
    deliverableTitle?: string | null;
  }>
) {
  const source = Array.isArray(actions) ? actions.filter((action) => action && action.id && action.title) : [];
  if (!source.length) return [];

  const byId = new Map(source.map((action) => [String(action.id), action]));
  const indegree = new Map<string, number>();
  const out = new Map<string, string[]>();

  byId.forEach((_, id) => {
    indegree.set(id, 0);
    out.set(id, []);
  });

  source.forEach((action) => {
    const id = String(action.id);
    const deps = Array.isArray(action.dependencies) ? action.dependencies : [];
    deps.forEach((dep) => {
      const depId = String(dep || '');
      if (!byId.has(depId) || depId === id) return;
      out.get(depId)?.push(id);
      indegree.set(id, (indegree.get(id) || 0) + 1);
    });
  });

  const queue = source.map((action) => String(action.id)).filter((id) => (indegree.get(id) || 0) === 0);
  const ordered: Array<{
    id?: string;
    title?: string;
    estimateMin?: number;
    dependencies?: string[];
    deliverableId?: string | null;
    deliverableTitle?: string | null;
  }> = [];
  const visited = new Set<string>();

  while (queue.length) {
    const current = queue.shift() as string;
    if (visited.has(current)) continue;
    visited.add(current);
    const action = byId.get(current);
    if (action) ordered.push(action);
    (out.get(current) || []).forEach((nextId) => {
      indegree.set(nextId, (indegree.get(nextId) || 0) - 1);
      if ((indegree.get(nextId) || 0) === 0) queue.push(nextId);
    });
  }

  if (ordered.length < source.length) {
    source.forEach((action) => {
      const id = String(action.id);
      if (!visited.has(id)) ordered.push(action);
    });
  }

  return ordered;
}

function findSlotForDraft({
  draft,
  dayKeys,
  timeZone,
  allowedBase,
  forbidden,
  existingBusy,
  placedBusyByDay,
  startIsoCache,
  dailyCounts,
  weeklyCounts,
  constraints,
  earliestHardGateStartISO,
  earliestDirectionalStartISO,
}: {
  draft: any;
  dayKeys: string[];
  timeZone: string;
  allowedBase: TimeWindow[];
  forbidden: TimeWindow[];
  existingBusy: Record<string, TimeWindow[]>;
  placedBusyByDay: Record<string, TimeWindow[]>;
  startIsoCache: Map<string, string | null>;
  dailyCounts: Record<string, number>;
  weeklyCounts: Record<string, number>;
  constraints: Constraints;
  earliestHardGateStartISO?: string | null;
  earliestDirectionalStartISO?: string | null;
}) {
  const maxPerDay = Number.isFinite(constraints?.maxBlocksPerDay) ? Number(constraints.maxBlocksPerDay) : Infinity;
  const maxPerWeek = Number.isFinite(constraints?.maxBlocksPerWeek) ? Number(constraints.maxBlocksPerWeek) : Infinity;
  const step = 15;
  let foundAnyWindows = false;
  let capacityFailure: { code: string; recoveryOptions: any[] } | null = null;
  let overlapOnly = true;
  const explicitWeeklyWindows = hasExplicitWeeklyWindows(constraints);
  const dayEndAtMin = parseHHMMToMinutes(constraints?.dayEndAtHHMM || '23:59');
  const preferredStartMinutes = parseHHMMToMinutes(draft?.preferredStartTime || '');
  const earliestHardGateStartMs = Date.parse(String(earliestHardGateStartISO || ''));
  const earliestDirectionalStartMs = Date.parse(String(earliestDirectionalStartISO || ''));
  const resolveStartISO = (dayKey: string, startMin: number) => {
    const cacheKey = `${dayKey}:${startMin}`;
    if (startIsoCache.has(cacheKey)) {
      return startIsoCache.get(cacheKey) || null;
    }
    const startISO = buildLocalStartISO(dayKey, minutesToTime(startMin), timeZone).startISO || null;
    startIsoCache.set(cacheKey, startISO);
    return startISO;
  };
  const tryDayKey = (dayKey: string) => {
    const allowed = explicitWeeklyWindows
      ? subtractWindows(
          normalizeHHMMWindows(constraints?.weeklyWindows?.[dayCodeFromDayKey(dayKey, timeZone)] || [], dayEndAtMin),
          forbidden
        )
      : subtractWindows(allowedBase, forbidden);
    if (!allowed.length) return null;
    foundAnyWindows = true;
    const dayBusy = [...(existingBusy[dayKey] || []), ...(placedBusyByDay[dayKey] || [])];
    const weekKey = weekKeyForDay(dayKey);
    if ((dailyCounts[dayKey] || 0) + 1 > maxPerDay) {
      capacityFailure ||= {
        code: 'EXCEEDS_MAX_PER_DAY',
        recoveryOptions: [{ kind: 'INCREASE_MAX_PER_DAY', detail: `Increase max per day above ${maxPerDay}.` }],
      };
      return null;
    }
    if ((weeklyCounts[weekKey] || 0) + 1 > maxPerWeek) {
      capacityFailure ||= {
        code: 'EXCEEDS_MAX_PER_WEEK',
        recoveryOptions: [{ kind: 'INCREASE_MAX_PER_WEEK', detail: `Increase max per week above ${maxPerWeek}.` }],
      };
      return null;
    }
    for (const window of allowed) {
      if (preferredStartMinutes > 0 && preferredStartMinutes + draft.durationMinutes <= window.endMin) {
        const preferredCandidate = {
          startMin: Math.max(window.startMin, preferredStartMinutes),
          endMin: Math.max(window.startMin, preferredStartMinutes) + draft.durationMinutes,
        };
        if (preferredCandidate.endMin <= window.endMin && !overlapsAny(preferredCandidate, dayBusy)) {
          overlapOnly = false;
          const startISO = resolveStartISO(dayKey, preferredCandidate.startMin);
          if (startISO) {
            if (Number.isFinite(earliestHardGateStartMs) && Date.parse(startISO) < earliestHardGateStartMs) {
              continue;
            }
            if (
              Number.isFinite(earliestDirectionalStartMs) &&
              Date.parse(startISO) < earliestDirectionalStartMs
            ) {
              continue;
            }
            return { dayKey, startISO };
          }
        }
      }
      for (let startMin = window.startMin; startMin + draft.durationMinutes <= window.endMin; startMin += step) {
        const candidate = { startMin, endMin: startMin + draft.durationMinutes };
        if (!overlapsAny(candidate, dayBusy)) {
          overlapOnly = false;
          const startISO = resolveStartISO(dayKey, startMin);
          if (!startISO) continue;
          if (Number.isFinite(earliestHardGateStartMs) && Date.parse(startISO) < earliestHardGateStartMs) {
            continue;
          }
          if (Number.isFinite(earliestDirectionalStartMs) && Date.parse(startISO) < earliestDirectionalStartMs) {
            continue;
          }
          return { dayKey, startISO };
        }
      }
    }
    return null;
  };

  const findBestCandidate = (candidateDayKeys: string[]) => {
    let bestCandidate: { dayKey: string; startISO: string; load: number } | null = null;
    for (const dayKey of candidateDayKeys) {
      const startCandidate = tryDayKey(dayKey);
      if (!startCandidate) continue;
      // Balance first across valid days, then pack within the chosen day.
      const load = (dailyCounts[dayKey] || 0) + ((placedBusyByDay[dayKey] || []).length || 0);
      if (!bestCandidate || load < bestCandidate.load) {
        bestCandidate = { ...startCandidate, load };
      }
    }
    return bestCandidate;
  };

  const targetWeekDayKeys = getTargetWeekDayKeys(dayKeys, draft?.targetDayKey);
  const targetCandidate = targetWeekDayKeys.length ? findBestCandidate(targetWeekDayKeys) : null;
  if (targetCandidate) {
    return { dayKey: targetCandidate.dayKey, startISO: targetCandidate.startISO };
  }

  const targetWeekDayKeySet = new Set(targetWeekDayKeys);
  const fallbackCandidate = findBestCandidate(dayKeys.filter((dayKey) => !targetWeekDayKeySet.has(dayKey)));
  if (fallbackCandidate) {
    return { dayKey: fallbackCandidate.dayKey, startISO: fallbackCandidate.startISO };
  }
  if (!foundAnyWindows) {
    draft.failCode = 'NO_ALLOWED_WINDOWS';
    draft.recoveryOptions = [{ kind: 'RELAX_WORKING_HOURS', detail: 'Add working-hour windows.' }];
  } else if (capacityFailure) {
    draft.failCode = capacityFailure.code;
    draft.recoveryOptions = capacityFailure.recoveryOptions;
  } else if (overlapOnly) {
    draft.failCode = 'OVERLAP_ALL_SLOTS';
    draft.recoveryOptions = [{ kind: 'EXTEND_HORIZON', detail: 'Extend horizon to find free slots.' }];
  } else if (!draft.failCode) {
    draft.failCode = 'UNSCHEDULABLE';
    draft.recoveryOptions = [{ kind: 'EXTEND_HORIZON', detail: 'Extend horizon or reduce sessions.' }];
  }
  return null;
}

function buildActionDependencyMeta(
  actions: Array<{ id?: string; dependencies?: string[]; dependencyDetails?: DependencyDetail[] }>
) {
  const directByActionId = new Map<string, string[]>();
  const directDetailsByActionId = new Map<string, DependencyDetail[]>();
  const byId = new Map<string, { id?: string; dependencies?: string[]; dependencyDetails?: DependencyDetail[] }>();
  (actions || []).forEach((action) => {
    const actionId = String(action?.id || '').trim();
    if (!actionId) {
      return;
    }
    byId.set(actionId, action);
    const directDetails = normalizeDependencyDetails(
      Array.isArray(action?.dependencyDetails) ? action.dependencyDetails : [],
      Array.isArray(action?.dependencies) ? action.dependencies : []
    );
    directByActionId.set(
      actionId,
      directDetails.map((detail) => detail.actionId)
    );
    directDetailsByActionId.set(actionId, directDetails);
  });

  const memo = new Map<string, Map<string, DependencyType>>();
  const resolve = (actionId: string, stack = new Set<string>()) => {
    if (!actionId || memo.has(actionId)) {
      return memo.get(actionId) || new Map<string, DependencyType>();
    }
    if (stack.has(actionId)) {
      return new Map<string, DependencyType>();
    }
    stack.add(actionId);
    const collected = new Map<string, DependencyType>();
    (directDetailsByActionId.get(actionId) || []).forEach((detail) => {
      mergeDependencyType(collected, detail.actionId, detail.dependencyType);
      const childDependencies = resolve(detail.actionId, stack);
      childDependencies.forEach((childType, childActionId) => {
        mergeDependencyType(
          collected,
          childActionId,
          composeDependencyType(detail.dependencyType, childType)
        );
      });
    });
    stack.delete(actionId);
    memo.set(actionId, collected);
    return collected;
  };

  const transitiveByActionId = new Map<string, string[]>();
  const transitiveDetailsByActionId = new Map<string, DependencyDetail[]>();
  byId.forEach((_, actionId) => {
    const transitiveMap = resolve(actionId);
    transitiveByActionId.set(actionId, Array.from(transitiveMap.keys()));
    transitiveDetailsByActionId.set(
      actionId,
      Array.from(transitiveMap.entries()).map(([dependencyActionId, dependencyType]) => ({
        actionId: dependencyActionId,
        dependencyType,
      }))
    );
  });

  return { directByActionId, directDetailsByActionId, transitiveByActionId, transitiveDetailsByActionId };
}

function sortDraftsByDependency(drafts: any[] = []) {
  const draftsByIdentity = new Map(drafts.map((draft) => [String(draft?.identityKey || draft?.id || ''), draft]));
  const draftsByActionId = new Map<string, any[]>();
  drafts.forEach((draft) => {
    const actionId = String(draft?.actionId || '').trim();
    if (!actionId) {
      return;
    }
    if (!draftsByActionId.has(actionId)) {
      draftsByActionId.set(actionId, []);
    }
    draftsByActionId.get(actionId)!.push(draft);
  });
  draftsByActionId.forEach((items) => {
    items.sort((left, right) => {
      const leftIndex = Number.isFinite(left?.sessionIndex) ? Number(left.sessionIndex) : 0;
      const rightIndex = Number.isFinite(right?.sessionIndex) ? Number(right.sessionIndex) : 0;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
      return String(left?.id || '').localeCompare(String(right?.id || ''));
    });
  });

  const actionIds = Array.from(draftsByActionId.keys());
  const indegree = new Map<string, number>(actionIds.map((actionId) => [actionId, 0]));
  const outgoing = new Map<string, string[]>(actionIds.map((actionId) => [actionId, []]));

  actionIds.forEach((actionId) => {
    const sampleDraft = draftsByActionId.get(actionId)?.[0];
    const deps = Array.isArray(sampleDraft?.directDependencyDetails)
      ? sampleDraft.directDependencyDetails.filter((detail: DependencyDetail) => detail?.dependencyType === 'hard_gate')
      : [];
    deps.forEach((detail: DependencyDetail) => {
      const dependencyId = String(detail?.actionId || '').trim();
      if (!draftsByActionId.has(dependencyId) || dependencyId === actionId) {
        return;
      }
      outgoing.get(dependencyId)!.push(actionId);
      indegree.set(actionId, (indegree.get(actionId) || 0) + 1);
    });
  });

  const queue = actionIds
    .filter((actionId) => (indegree.get(actionId) || 0) === 0)
    .sort((left, right) => left.localeCompare(right));
  const orderedActionIds: string[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const actionId = queue.shift() as string;
    if (visited.has(actionId)) {
      continue;
    }
    visited.add(actionId);
    orderedActionIds.push(actionId);
    (outgoing.get(actionId) || []).forEach((nextId) => {
      indegree.set(nextId, (indegree.get(nextId) || 0) - 1);
      if ((indegree.get(nextId) || 0) === 0) {
        queue.push(nextId);
        queue.sort((left, right) => left.localeCompare(right));
      }
    });
  }

  actionIds.forEach((actionId) => {
    if (!visited.has(actionId)) {
      orderedActionIds.push(actionId);
    }
  });

  const orderedDrafts = orderedActionIds.flatMap((actionId) => draftsByActionId.get(actionId) || []);
  const remainingDrafts = drafts.filter((draft) => !orderedDrafts.includes(draft) && draftsByIdentity.has(String(draft?.identityKey || draft?.id || '')));
  return [...orderedDrafts, ...remainingDrafts];
}

function buildAcceptedCompletionByActionId(
  acceptedBlocks: Array<{ actionId?: string | null; startISO?: string; durationMinutes?: number; endISO?: string }>
) {
  const completionByActionId = new Map<string, string>();
  (acceptedBlocks || []).forEach((block) => {
    updateCompletionByActionId(
      completionByActionId,
      block?.actionId || null,
      block?.startISO || null,
      Number(block?.durationMinutes) || 0,
      block?.endISO || null
    );
  });
  return completionByActionId;
}

function updateCompletionByActionId(
  completionByActionId: Map<string, string>,
  actionId: string | null | undefined,
  startISO: string | null | undefined,
  durationMinutes: number,
  explicitEndISO?: string | null
) {
  const normalizedActionId = String(actionId || '').trim();
  if (!normalizedActionId) {
    return;
  }
  const computedEndISO =
    explicitEndISO ||
    (startISO && Number.isFinite(Date.parse(startISO)) && Number.isFinite(durationMinutes)
      ? new Date(Date.parse(startISO) + durationMinutes * 60 * 1000).toISOString()
      : null);
  if (!computedEndISO) {
    return;
  }
  const existing = completionByActionId.get(normalizedActionId);
  if (!existing || Date.parse(computedEndISO) > Date.parse(existing)) {
    completionByActionId.set(normalizedActionId, computedEndISO);
  }
}

function resolveDependencyPlacementRequirements(draft: any, completionByActionId: Map<string, string>) {
  const dependencyDetails = normalizeDependencyDetails(
    Array.isArray(draft?.transitiveDependencyDetails) ? draft.transitiveDependencyDetails : [],
    Array.isArray(draft?.transitiveDependencyIds) ? draft.transitiveDependencyIds : []
  );
  let hardGateStartISO: string | null = null;
  let directionalStartISO: string | null = null;
  const missingHardGateDependencyIds: string[] = [];
  const assumedDirectionalDependencyIds: string[] = [];

  dependencyDetails.forEach((detail) => {
    const dependencyId = String(detail?.actionId || '').trim();
    if (!dependencyId) {
      return;
    }
    const completionISO = completionByActionId.get(dependencyId);
    if (detail.dependencyType === 'hard_gate') {
      if (!completionISO) {
        missingHardGateDependencyIds.push(dependencyId);
        return;
      }
      if (!hardGateStartISO || Date.parse(completionISO) > Date.parse(hardGateStartISO)) {
        hardGateStartISO = completionISO;
      }
      return;
    }
    if (detail.dependencyType === 'directional') {
      if (!completionISO) {
        assumedDirectionalDependencyIds.push(dependencyId);
        return;
      }
      if (!directionalStartISO || Date.parse(completionISO) > Date.parse(directionalStartISO)) {
        directionalStartISO = completionISO;
      }
    }
  });

  return {
    hardGateStartISO,
    directionalStartISO,
    missingHardGateDependencyIds,
    assumedDirectionalDependencyIds,
  };
}

function validatePlacedBlockDependencies(
  placed: Array<{
    actionId?: string | null;
    startISO?: string;
    endISO?: string | null;
    durationMinutes?: number;
    transitiveDependencyIds?: string[];
    transitiveDependencyDetails?: DependencyDetail[];
    id?: string;
  }>
) {
  const completionByActionId = new Map<string, string>();
  placed.forEach((block) => {
    updateCompletionByActionId(
      completionByActionId,
      block?.actionId || null,
      block?.startISO || null,
      Number(block?.durationMinutes) || 0,
      block?.endISO || null
    );
  });
  const violations: Array<Record<string, unknown>> = [];
  placed.forEach((block) => {
    const scheduledStart = Date.parse(String(block?.startISO || ''));
    if (!Number.isFinite(scheduledStart)) {
      return;
    }
    const dependencyDetails = normalizeDependencyDetails(
      Array.isArray(block?.transitiveDependencyDetails) ? block.transitiveDependencyDetails : [],
      Array.isArray(block?.transitiveDependencyIds) ? block.transitiveDependencyIds : []
    );
    dependencyDetails
      .filter((detail) => detail.dependencyType === 'hard_gate')
      .forEach((detail) => {
      const dependencyId = detail.actionId;
      const completionISO = completionByActionId.get(String(dependencyId || '').trim());
      if (!completionISO) {
        return;
      }
      if (scheduledStart < Date.parse(completionISO)) {
        violations.push({
          blockId: block?.id || null,
          actionId: block?.actionId || null,
          scheduledDate: block?.startISO || null,
          dependencyActionId: dependencyId,
          dependencyCompletionDate: completionISO,
        });
      }
      });
  });
  return violations;
}

function getTargetWeekDayKeys(dayKeys: string[], targetDayKey?: string | null) {
  if (!Array.isArray(dayKeys) || dayKeys.length <= 1) return [];
  const target = String(targetDayKey || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return [];

  const targetWeekKey = weekKeyForDay(target);
  return dayKeys.filter((dayKey) => weekKeyForDay(dayKey) === targetWeekKey);
}

function normalizeSessionPlanEntries(
  sessions: Array<{
    date?: string;
    startTime?: string;
    durationMinutes?: number;
    actionSteps?: string[];
    completionCondition?: string;
    deliverableId?: string;
    actionId?: string;
    title?: string;
  }>
) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];
  const counterByAction = new Map<string, number>();
  const normalized = sessions
    .map((session, index) => {
      const date = String(session?.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      const startTime = String(session?.startTime || '').trim();
      const duration = Number(session?.durationMinutes);
      const durationMinutes = Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 60;
      const actionId = String(session?.actionId || '').trim();
      const deliverableId = String(session?.deliverableId || '').trim();
      const actionSteps = Array.isArray(session?.actionSteps)
        ? session.actionSteps.map((step) => String(step || '').trim()).filter(Boolean)
        : [];
      const completionCondition = String(session?.completionCondition || '').trim();
      const explicitTitle = String(session?.title || '').trim();
      const fallbackTitle = `Execution session ${index + 1}`;
      const title = explicitTitle || actionSteps[0] || completionCondition || fallbackTitle;
      const sessionCounterKey = actionId || deliverableId || `synthetic-action-${index + 1}`;
      const sessionIndex = counterByAction.get(sessionCounterKey) || 0;
      counterByAction.set(sessionCounterKey, sessionIndex + 1);
      return {
        date,
        startTime: /^\d{2}:\d{2}$/.test(startTime) ? startTime : '09:00',
        durationMinutes: Math.max(15, durationMinutes),
        actionId,
        deliverableId: deliverableId || `deliv-synthetic-${index + 1}`,
        title,
        sessionIndex,
      };
    })
    .filter(Boolean) as Array<{
    date: string;
    startTime: string;
    durationMinutes: number;
    actionId: string;
    deliverableId: string;
    title: string;
    sessionIndex: number;
  }>;
  normalized.sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    if (left.startTime !== right.startTime) return left.startTime.localeCompare(right.startTime);
    if (left.actionId !== right.actionId) return left.actionId.localeCompare(right.actionId);
    return left.sessionIndex - right.sessionIndex;
  });
  return normalized;
}

function isGenericSessionTitle(value: unknown) {
  const title = String(value || '').trim();
  return /^execution session\s*\d*$/i.test(title) || /^session\s*\d*$/i.test(title) || /^work block$/i.test(title);
}

function isGenericActionTitle(value: unknown) {
  const title = String(value || '').trim();
  return (
    /^execution session\s*\d*$/i.test(title) ||
    /^session\s*\d*$/i.test(title) ||
    /^work block$/i.test(title) ||
    /^record and edit episode set$/i.test(title)
  );
}

function commercialOperationalSessionTitle({
  visibleTitle,
  actionTitle,
  deliverableTitle,
  sessionIndex,
}: {
  visibleTitle?: unknown;
  actionTitle?: unknown;
  deliverableTitle?: unknown;
  sessionIndex: number;
}) {
  const combined = [visibleTitle, actionTitle, deliverableTitle]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const explicitConcreteTitle = String(visibleTitle || '').trim();
  const visibleIsShell =
    !explicitConcreteTitle ||
    /\bsession\s+\d+\s+(?:of|\/)\s+\d+\b/i.test(explicitConcreteTitle) ||
    isCommercialFamilyShellTitle(explicitConcreteTitle);
  if (!visibleIsShell) {
    return '';
  }

  const titles = commercialOperationalTitleBank(combined);
  if (titles.length === 0) {
    return '';
  }
  return titles[Math.max(0, sessionIndex) % titles.length];
}

function isCommercialFamilyShellTitle(value: unknown) {
  const title = String(value || '').trim();
  if (!title) return false;
  return (
    /\bresolve\b.*\bgum\b.*\bformula\b.*\bpackaging\b.*\breadiness\b/i.test(title) ||
    /\bclose\b.*\bsourcing\b.*\bsellable[-\s]?unit\b.*\breadiness\b/i.test(title) ||
    /\bbuild\b.*\bgum\b.*\boffer\b.*\bpricing\b.*\bcheckout\b/i.test(title) ||
    /\bclose\b.*\bordering\b.*\bfulfillment\b.*\breadiness\b/i.test(title) ||
    /\bbuild\b.*\bgum\b.*\bpositioning\b.*\bmessaging\b.*\bassets\b/i.test(title) ||
    /\bclose\b.*\bsales\s+cta\b.*\bcampaign\b.*\bassets\b/i.test(title) ||
    /\bactivate\b.*\bfirst[-\s]?buyer\b.*\boutreach\b.*\bfirst[-\s]?order\b/i.test(title) ||
    /\btrack\b.*\bbuyer\b.*\bresponses\b.*\bconversion\b/i.test(title) ||
    /\bcompile\b.*\bfirst[-\s]?sales\b.*\bevidence\b.*\bconversion\b/i.test(title) ||
    /\bdecide\b.*\bcommercial\b.*\bsales\b.*\bevidence\b/i.test(title)
  );
}

function commercialOperationalTitleBank(value: string) {
  if (/\bformula|sample|packaging|sourcing|sellable[-\s]?unit|manufacturer|moq\b/i.test(value)) {
    return [
      'Document caffeine dosage, flavor, texture, and compliance assumptions for the gum formula',
      'Select viable stimulant dosage and gum base formulation options',
      'Secure sample capability notes from two gum manufacturers',
      'Evaluate manufacturer MOQ, lead time, certifications, and sample cost',
      'Select initial formula direction and sample acceptance criteria',
      'Define packaging format, count size, label claims, and required warnings',
      'Secure packaging quote and dieline requirements from supplier A',
      'Secure packaging quote and dieline requirements from supplier B',
      'Evaluate packaging costs, lead times, minimums, and print constraints',
      'Create sellable unit readiness checklist for formula, packaging, and sourcing',
      'Confirm sample approval path and evidence needed before sales',
      'Finalize sourcing next steps, owner, risk, and fallback manufacturer',
    ];
  }
  if (/\boffer|pricing|product page|checkout|ordering|fulfillment|payment|shipping\b/i.test(value)) {
    return [
      'Define launch offer promise, pack size, price hypothesis, and buyer guarantee',
      'Evaluate unit economics using formula, packaging, shipping, and platform fees',
      'Draft pricing test assumptions and minimum viable margin threshold',
      'Outline product page sections for benefits, ingredients, usage, and proof',
      'Write product page copy for caffeine benefit, flavor, safety, and buyer fit',
      'Select checkout or order-capture path for first real sales',
      'Configure checkout fields, payment method, tax/shipping assumptions, and confirmation flow',
      'Test order path from product page click through payment or order capture',
      'Define fulfillment handling for paid orders, samples, backorders, and refunds',
      'Create purchase-path readiness checklist and failure recovery notes',
      'Run buyer-perspective checkout review and record friction points',
      'Finalize commercial readiness evidence for first-sales execution',
    ];
  }
  if (/\bpositioning|messaging|campaign|assets|sales cta|announcement\b/i.test(value)) {
    return [
      'Define target buyer segment and strongest caffeinated gum use case',
      'Write positioning statement tied to energy, convenience, taste, and trust',
      'Draft three message pillars for product benefit, safety, and buying reason',
      'Create product proof points from formula, packaging, sourcing, and offer assumptions',
      'Draft launch CTA tied to real purchase or order attempt',
      'Build product page hero copy and buyer objection answers',
      'Create starter asset checklist for product image, pack mockup, CTA, and proof',
      'Draft outreach message variant for early buyers',
      'Draft channel announcement variant with purchase-path link',
      'Review messaging against product readiness and commercial truth',
    ];
  }
  if (/\bfirst[-\s]?buyer|outreach|first[-\s]?order|buyer response|conversion attempt|initial buyer\b/i.test(value)) {
    return [
      'Build first-buyer list from warm contacts, niche communities, and likely early adopters',
      'Segment first-buyer list by urgency, relationship strength, and purchase likelihood',
      'Communicate first 10 buyer outreach messages with purchase-path CTA',
      'Record buyer replies, objections, clicks, and order intent evidence',
      'Communicate follow-up wave to non-responders with clearer offer and CTA',
      'Run direct first-order attempt with highest-intent buyer segment',
      'Capture checkout failures, order objections, and fulfillment blockers',
      'Revise CTA or offer language based on first response evidence',
      'Communicate second buyer outreach wave with revised offer or proof point',
      'Track first order attempts, conversions, and blocked transactions',
      'Select working channel and archive nonperforming channel',
      'Prepare evidence packet for first-sales review',
    ];
  }
  if (
    /\bfirst[-\s]?sales evidence|conversion results|next-step decision|commercial step|sales evidence\b/i.test(value)
  ) {
    return [
      'Compile first-sales attempts, paid orders, blocked orders, and buyer response evidence',
      'Evaluate conversion results by outreach segment, message, and purchase path',
      'Review objection patterns around price, trust, ingredients, shipping, and taste',
      'Evaluate whether to adjust formula, offer, purchase path, or buyer segment',
      'Define next commercial milestone from first-sales evidence',
      'Record terminal review evidence and launch continuation decision',
    ];
  }
  return [];
}

function buildProposalIdentityKey({
  cycleId,
  deliverableId,
  actionId,
  sessionIndex,
}: {
  cycleId: string;
  deliverableId?: string | null;
  actionId?: string | null;
  sessionIndex?: number | null;
}) {
  const normalizedCycleId = String(cycleId || 'cycle');
  const normalizedDeliverableId = String(deliverableId || 'deliv-synthetic');
  const normalizedActionId = String(actionId || 'synthetic-action');
  const normalizedSessionIndex = Number.isFinite(Number(sessionIndex)) ? Number(sessionIndex) : 0;
  return `${normalizedCycleId}::${normalizedDeliverableId}::${normalizedActionId}::${normalizedSessionIndex}`;
}

function normalizeWindows(windows: TimeWindow[]) {
  if (!windows || !windows.length) return [];
  const cleaned = windows
    .map((w) => ({
      startMin: Math.max(0, Math.min(1440, Math.floor(w.startMin))),
      endMin: Math.max(0, Math.min(1440, Math.floor(w.endMin))),
    }))
    .filter((w) => w.endMin > w.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  const merged: TimeWindow[] = [];
  cleaned.forEach((w) => {
    const last = merged[merged.length - 1];
    if (!last || w.startMin > last.endMin) {
      merged.push({ ...w });
    } else {
      last.endMin = Math.max(last.endMin, w.endMin);
    }
  });
  return merged;
}

function normalizeHHMMWindows(windows: Array<{ startHHMM: string; endHHMM: string }>, dayEndAtMin: number) {
  return normalizeWindows(
    (windows || []).map((window) => {
      const startMin = parseHHMMToMinutes(window?.startHHMM);
      const endMinRaw = parseHHMMToMinutes(window?.endHHMM);
      const endMin = Math.min(endMinRaw, dayEndAtMin);
      return { startMin, endMin };
    })
  );
}

function parseHHMMToMinutes(value?: string) {
  const text = String(value || '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.min(24 * 60, hours * 60 + minutes));
}

function hasExplicitWeeklyWindows(constraints: Constraints) {
  const weekly = constraints?.weeklyWindows || {};
  return Object.values(weekly).some((entry) => Array.isArray(entry) && entry.length > 0);
}

function dayCodeFromDayKey(dayKey: string, timeZone: string) {
  return DAY_CODE_BY_INDEX[weekdayIndex(dayKey, timeZone)] || 'MON';
}

function clampPlacedBlocksToCycleWindow({
  placed,
  conflicts,
  constraints,
  timeZone,
}: {
  placed: Array<{
    id: string;
    dayKey: string;
    startISO: string;
    durationMinutes: number;
    kind: string;
    title: string;
    identityKey?: string;
    deliverableId?: string | null;
    actionId?: string | null;
    sessionIndex?: number | null;
  }>;
  conflicts: AutoAsanaPlan['conflicts'];
  constraints: Constraints;
  timeZone: string;
}) {
  const startDayKey = constraints?.cycleStartDayKey || null;
  const endDayKey = constraints?.cycleEndDayKey || null;
  const dayEndAtMin = parseHHMMToMinutes(constraints?.dayEndAtHHMM || '23:59');
  if (!startDayKey && !endDayKey) return { placed };

  const filtered: typeof placed = [];
  const droppedIds: string[] = [];

  placed.forEach((block) => {
    const blockDayKey = block.dayKey;
    if (startDayKey && blockDayKey < startDayKey) {
      droppedIds.push(block.id);
      return;
    }
    if (endDayKey && blockDayKey > endDayKey) {
      droppedIds.push(block.id);
      return;
    }
    if (endDayKey && blockDayKey === endDayKey) {
      const startMin = minutesFromISO(block.startISO, timeZone);
      const endMin = startMin + (block.durationMinutes || 0);
      if (endMin > dayEndAtMin) {
        droppedIds.push(block.id);
        return;
      }
    }
    filtered.push(block);
  });

  if (droppedIds.length > 0) {
    conflicts.push({
      kind: 'UNSCHEDULABLE',
      code: 'OUT_OF_CYCLE_RANGE',
      detail: { droppedCount: droppedIds.length, sampleBlockIds: droppedIds.slice(0, 5) },
      candidateResolutions: ['ADJUST_CYCLE_WINDOW', 'REDUCE_SCOPE'],
    });
    conflicts.push({
      kind: 'UNSCHEDULABLE',
      code: 'FILTERED_OUT_OF_RANGE',
      detail: { droppedCount: droppedIds.length, sampleBlockIds: droppedIds.slice(0, 5) },
      candidateResolutions: ['ADJUST_CYCLE_WINDOW', 'REDUCE_SCOPE'],
    });
    if (filtered.length === 0) {
      conflicts.push({
        kind: 'UNSCHEDULABLE',
        code: 'UNSCHEDULABLE',
        detail: 'All candidate blocks were outside cycle date window.',
        candidateResolutions: ['ADJUST_CYCLE_WINDOW', 'REDUCE_SCOPE'],
      });
    }
  }
  return { placed: filtered };
}

function subtractWindows(allowed: TimeWindow[], forbidden: TimeWindow[]) {
  if (!forbidden.length) return [...allowed];
  const result: TimeWindow[] = [];
  allowed.forEach((base) => {
    let segments = [{ ...base }];
    forbidden.forEach((block) => {
      segments = segments.flatMap((seg) => {
        if (block.endMin <= seg.startMin || block.startMin >= seg.endMin) return [seg];
        const parts: TimeWindow[] = [];
        if (block.startMin > seg.startMin) parts.push({ startMin: seg.startMin, endMin: block.startMin });
        if (block.endMin < seg.endMin) parts.push({ startMin: block.endMin, endMin: seg.endMin });
        return parts;
      });
    });
    segments.forEach((seg) => result.push(seg));
  });
  return normalizeWindows(result);
}

function overlapsAny(candidate: TimeWindow, busy: TimeWindow[]) {
  return busy.some((b) => candidate.startMin < b.endMin && candidate.endMin > b.startMin);
}

function busyFromAcceptedBlocks(blocks: Array<{ startISO: string; durationMinutes: number }>, timeZone: string) {
  const byDay: Record<string, TimeWindow[]> = {};
  (blocks || []).forEach((block) => {
    const dayKey = dayKeyFromISO(block.startISO, timeZone);
    const startMin = minutesFromISO(block.startISO, timeZone);
    const endMin = startMin + (block.durationMinutes || 0);
    if (!byDay[dayKey]) byDay[dayKey] = [];
    byDay[dayKey].push({ startMin, endMin });
  });
  Object.keys(byDay).forEach((dayKey) => {
    byDay[dayKey] = normalizeWindows(byDay[dayKey]);
  });
  return byDay;
}

const minutesFromISO = localMinutesFromISO;

function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function weekKeyForDay(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const oneJan = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}
