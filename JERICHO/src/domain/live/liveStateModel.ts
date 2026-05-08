import type { FeasibilityAssessment } from '../feasibility/feasibilityDerivation';
import type { StructuredPlanningIntake } from '../goal/StructuredPlanningIntake';
import { REGULATED_PHYSICAL_CONSUMABLE_REALISM } from '../goal/regulatedPhysicalConsumableRealism';

export type LiveStatus = 'ON_TRACK' | 'DRIFTING' | 'RECOVERABLE_SLIP' | 'AT_RISK' | 'NON_RECOVERABLE';

export type LiveRuntimeEvent =
  | {
      kind: 'manufacturer_response';
      blockId?: string | null;
      manufacturerName?: string | null;
      respondedAt: string;
      detail?: string | null;
    }
  | {
      kind: 'presale_update';
      recordedAt: string;
      orderCount?: number | null;
      balance?: number | null;
      conversionRate?: number | null;
    }
  | {
      kind: 'content_engagement';
      recordedAt: string;
      engagementRatio: number;
    };

export type CompletionLogEntry = {
  id?: string;
  blockId?: string;
  actionId?: string | null;
  dateISO?: string;
  startISO?: string;
  endISO?: string;
  kind?: 'complete' | 'create' | 'update' | 'delete' | 'reschedule' | 'missed';
  completed?: boolean;
  status?: string;
  canonicalTitle?: string | null;
  rawLabel?: string | null;
};

export type LivePlanBlock = {
  id?: string | null;
  title?: string | null;
  actionId?: string | null;
  startISO?: string | null;
  endISO?: string | null;
  dayKey?: string | null;
  durationMinutes?: number | null;
  blockType?: 'execution' | 'waiting_period' | 'capital_checkpoint' | string | null;
  waitType?: string | null;
  minimumDurationBusinessDays?: number | null;
  parallelWorkSuggestions?: string[];
  transitiveDependencyIds?: string[];
  transitiveDependencyDetails?: Array<{
    actionId: string;
    dependencyType: 'hard_gate' | 'directional' | 'informational';
  }>;
  directDependencyIds?: string[];
  directDependencyDetails?: Array<{
    actionId: string;
    dependencyType: 'hard_gate' | 'directional' | 'informational';
  }>;
  capitalGateId?: string | null;
  requiredWorkFamily?: string | null;
  commerceReadinessLevel?: 'hypothesis' | 'validated' | null;
};

export interface PlanPosition {
  currentWeek: number;
  totalWeeks: number;
  currentPhase: string;
  currentPhaseWeek: number;
  currentPhaseTotalWeeks: number;
  sessionsCompleted: number;
  sessionsTotal: number;
  sessionsRemaining: number;
  sessionsScheduledToDate: number;
  sessionsActualToDate: number;
  sessionGap: number;
  percentComplete: number;
  projectedCompletionDate: string;
  plannedCompletionDate: string;
  daysAhead: number;
}

export interface WaitPeriod {
  blockId: string;
  title: string;
  startDate: string;
  endDate: string;
  minimumDurationBusinessDays: number;
  daysElapsed: number;
  daysRemaining: number;
  parallelWorkSuggestions: string[];
  status: 'active' | 'completed' | 'overdue';
}

export interface DimensionFlag {
  dimension: 'capital' | 'timeline' | 'execution' | 'domain' | 'market';
  severity: 'watch' | 'caution' | 'alert';
  signal: string;
  recommendedAction: string;
  triggeredAt: string;
  autoResolves: boolean;
  resolvedAt: string | null;
}

export interface GateStatus {
  gateId: string;
  gateTitle: string;
  gateDate: string;
  daysUntilGate: number;
  prerequisitesMet: boolean;
  prerequisitesRemaining: string[];
  capitalRequired: number | null;
  capitalAvailable: number | null;
  capitalGap: number | null;
}

export interface CapitalTrackState {
  strategy: 'presale' | 'direct' | 'mixed';
  target: number;
  currentBalance: number;
  percentToTarget: number;
  nextGateAmount: number;
  nextGateName: string;
  nextGateDate: string;
  daysUntilNextGate: number;
  onTrackToMeetGate: boolean;
  presaleOrderCount: number | null;
  presaleOrderTarget: number | null;
  presaleConversionRate: number | null;
}

export interface ScheduledSession {
  blockId: string;
  title: string;
  startISO: string;
  endISO: string;
  durationMinutes: number;
  blockType: string;
  actionId: string | null;
}

export interface CompletedBlock {
  blockId: string;
  title: string;
  completedAt: string;
}

export interface LiveState {
  asOf: string;
  lastCheckIn: string | null;
  daysSinceLastCheckIn: number;
  planPosition: PlanPosition;
  activeWaitPeriods: WaitPeriod[];
  dimensionFlags: DimensionFlag[];
  liveStatus: LiveStatus;
  todaysSessions: ScheduledSession[];
  capitalTrack: CapitalTrackState;
  nextGate: GateStatus;
  recentlyCompleted: CompletedBlock[];
}

export interface LiveStateInput {
  plan: {
    scheduledBlocks: LivePlanBlock[];
    summary?: {
      plannedCompletionDate?: string | null;
      feasibilityAssessment?: FeasibilityAssessment | null;
      capitalAcquisitionFeasibility?: any;
    } | null;
  };
  completionLog?: CompletionLogEntry[];
  runtimeEvents?: LiveRuntimeEvent[];
  asOf: string;
  lastCheckInISO?: string | null;
  feasibilityAssessment?: FeasibilityAssessment | null;
  intake?: StructuredPlanningIntake | null;
}

type PhaseRange = { label: string; startDayKey: string; endDayKey: string };

const ONE_DAY_MS = 86400000;
const PRESALE_ALERT_RATIO = 0.25;
const PRESALE_CAUTION_RATIO = 0.5;
const MANUFACTURER_TIMEOUT_CAUTION_DAYS = 20;
const MANUFACTURER_TIMEOUT_ALERT_DAYS = 30;
const CONTENT_ENGAGEMENT_THRESHOLD = 0.3;

function toDate(value: unknown) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDayKey(value: unknown) {
  return String(value || '').trim().slice(0, 10);
}

function diffCalendarDays(startISO: unknown, endISO: unknown) {
  const start = toDate(startISO);
  const end = toDate(endISO);
  if (!start || !end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / ONE_DAY_MS);
}

function businessDaySpan(startISO: unknown, endISO: unknown) {
  const start = toDate(startISO);
  const end = toDate(endISO);
  if (!start || !end || end < start) {
    return 0;
  }
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const finalDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  let count = 0;
  while (cursor <= finalDay) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function inferPhaseName(block: LivePlanBlock | null) {
  const title = String(block?.title || '').toLowerCase();
  const waitType = String(block?.waitType || '').toLowerCase();
  if (waitType === 'manufacturer_initial_response' || /manufacturer|catalog|sample availability|quote/i.test(title)) {
    return 'Manufacturer outreach';
  }
  if (/presale|founder.?journey|founding customer/i.test(title)) {
    return 'Capital acquisition';
  }
  if (/regulatory|label review|compliance/i.test(title)) {
    return 'Regulatory review';
  }
  if (/packaging|dieline|supplier/i.test(title)) {
    return 'Packaging';
  }
  if (/merchant|underwriting|checkout/i.test(title)) {
    return 'Merchant underwriting';
  }
  if (/production run|deposit|fulfill|first sales|cold sale/i.test(title)) {
    return 'Launch and first sales';
  }
  return 'Execution';
}

function isSessionBlock(block: LivePlanBlock) {
  return String(block?.blockType || 'execution') !== 'waiting_period';
}

function isCompletedEvent(event: CompletionLogEntry) {
  return String(event?.kind || '').trim() === 'complete' || event?.completed === true || event?.status === 'completed';
}

function sortBlocks(blocks: LivePlanBlock[]) {
  return [...blocks].sort((left, right) => String(left?.startISO || '').localeCompare(String(right?.startISO || '')));
}

function getCompletedBlockIds(events: CompletionLogEntry[]) {
  return new Set(
    (events || [])
      .filter(isCompletedEvent)
      .map((event) => String(event?.blockId || '').trim())
      .filter(Boolean)
  );
}

function getLatestCompleted(events: CompletionLogEntry[], blocksById: Map<string, LivePlanBlock>) {
  return (events || [])
    .filter(isCompletedEvent)
    .filter((event) => String(event?.blockId || '').trim())
    .sort((left, right) => String(right?.dateISO || right?.endISO || '').localeCompare(String(left?.dateISO || left?.endISO || '')))
    .slice(0, 3)
    .map((event) => {
      const blockId = String(event?.blockId || '').trim();
      const block = blocksById.get(blockId);
      return {
        blockId,
        title: String(block?.title || event?.canonicalTitle || event?.rawLabel || blockId),
        completedAt: String(event?.dateISO || event?.endISO || event?.startISO || ''),
      };
    });
}

function getLatestCheckIn(events: CompletionLogEntry[], explicitLastCheckInISO?: string | null) {
  if (explicitLastCheckInISO) {
    return explicitLastCheckInISO;
  }
  const relevant = (events || [])
    .map((event) => String(event?.dateISO || event?.endISO || event?.startISO || '').trim())
    .filter(Boolean)
    .sort()
    .pop();
  return relevant || null;
}

function derivePhaseRange(blocks: LivePlanBlock[], phaseLabel: string) {
  const matching = blocks.filter((block) => inferPhaseName(block) === phaseLabel);
  const sorted = sortBlocks(matching);
  const startDayKey = toDayKey(sorted[0]?.startISO);
  const endDayKey = toDayKey(sorted[sorted.length - 1]?.endISO || sorted[sorted.length - 1]?.startISO);
  return {
    label: phaseLabel,
    startDayKey,
    endDayKey,
  } satisfies PhaseRange;
}

function deriveCapitalStrategy(intake: StructuredPlanningIntake | null | undefined) {
  const capitalAvailable = Number(intake?.capitalAvailable || 0);
  const acquisitionRequired = intake?.capitalAcquisitionRequired === true;
  if (acquisitionRequired && capitalAvailable > 0) return 'mixed' as const;
  if (acquisitionRequired) return 'presale' as const;
  return 'direct' as const;
}

function getCapitalGateConfig(gateId: string | null | undefined) {
  return REGULATED_PHYSICAL_CONSUMABLE_REALISM.capitalGates.find((gate) => gate.gateId === gateId) || null;
}

function deriveCapitalTrack(input: LiveStateInput, scheduledBlocks: LivePlanBlock[], asOfDayKey: string) {
  const intake = input.intake || null;
  const runtimeEvents = Array.isArray(input.runtimeEvents) ? input.runtimeEvents : [];
  const strategy = deriveCapitalStrategy(intake);
  const capitalEvents = runtimeEvents.filter((event) => event.kind === 'presale_update') as Array<
    Extract<LiveRuntimeEvent, { kind: 'presale_update' }>
  >;
  const latestCapitalEvent = [...capitalEvents]
    .sort((left, right) => String(right.recordedAt).localeCompare(String(left.recordedAt)))
    .find(Boolean);
  const target = Number(
    input.plan.summary?.capitalAcquisitionFeasibility?.totalCapitalRequired?.criticalGateAmount ||
      input.plan.summary?.capitalAcquisitionFeasibility?.capitalRequired?.phase4_moq_deposit?.max ||
      8000
  );
  const currentBalance = Number(latestCapitalEvent?.balance ?? intake?.capitalAvailable ?? 0);
  const presaleOrderCount = Number.isFinite(Number(latestCapitalEvent?.orderCount))
    ? Number(latestCapitalEvent?.orderCount)
    : null;
  const presaleConversionRate = Number.isFinite(Number(latestCapitalEvent?.conversionRate))
    ? Number(latestCapitalEvent?.conversionRate)
    : null;
  const presaleOrderTarget = target > 0 ? Math.ceil(target / 40) : null;
  const futureCapitalBlocks = sortBlocks(
    scheduledBlocks.filter(
      (block) =>
        String(block?.blockType || '') === 'capital_checkpoint' &&
        toDayKey(block?.startISO) >= asOfDayKey
    )
  );
  const nextGateBlock = futureCapitalBlocks[0] || null;
  const nextGateConfig = getCapitalGateConfig(String(nextGateBlock?.capitalGateId || '').trim());
  const nextGateAmount = Number(nextGateConfig?.typicalCost || target || 0);
  const daysUntilNextGate = diffCalendarDays(`${asOfDayKey}T00:00:00.000Z`, nextGateBlock?.startISO || null);
  const expectedRate =
    Number(input.plan.summary?.capitalAcquisitionFeasibility?.capitalAcquisitionPath?.presaleMath?.audienceConversionRequired || 0.0087);
  const onTrackToMeetGate =
    strategy !== 'presale'
      ? currentBalance >= nextGateAmount
      : currentBalance >= nextGateAmount ||
        (Number.isFinite(presaleConversionRate) && Number(presaleConversionRate) >= expectedRate * PRESALE_CAUTION_RATIO);

  return {
    strategy,
    target,
    currentBalance,
    percentToTarget: target > 0 ? Math.max(0, Math.min(1, currentBalance / target)) : 0,
    nextGateAmount,
    nextGateName: nextGateConfig?.label || String(nextGateBlock?.title || 'Capital gate'),
    nextGateDate: String(nextGateBlock?.startISO || ''),
    daysUntilNextGate,
    onTrackToMeetGate,
    presaleOrderCount,
    presaleOrderTarget,
    presaleConversionRate,
  } satisfies CapitalTrackState;
}

function deriveNextGate(
  scheduledBlocks: LivePlanBlock[],
  completedBlockIds: Set<string>,
  capitalTrack: CapitalTrackState,
  asOfDayKey: string,
  actionTitleById: Map<string, string>
) {
  const actionStartById = new Map<string, string>();
  scheduledBlocks.forEach((block) => {
    const actionId = String(block?.actionId || '').trim();
    const startISO = String(block?.startISO || '').trim();
    if (!actionId || !startISO) return;
    const existing = actionStartById.get(actionId);
    if (!existing || startISO < existing) {
      actionStartById.set(actionId, startISO);
    }
  });
  const unresolvedGates = sortBlocks(
    scheduledBlocks.filter(
      (block) =>
        String(block?.blockType || '') === 'capital_checkpoint' && !completedBlockIds.has(String(block?.id || '').trim())
    )
  );
  const strategicGate =
    capitalTrack.strategy === 'presale'
      ? unresolvedGates.find((block) => String(block?.capitalGateId || '') === 'moq_production_deposit') || null
      : null;
  const gate = strategicGate || unresolvedGates[0] || null;
  const dependencies = Array.isArray(gate?.directDependencyDetails) ? gate.directDependencyDetails : [];
  const hardGateDependencies = dependencies.filter((detail) => detail?.dependencyType === 'hard_gate');
  const prerequisitesRemaining = hardGateDependencies
    .filter((detail) => {
      const actionId = String(detail?.actionId || '').trim();
      if (completedBlockIds.has(actionId)) {
        return false;
      }
      const prerequisiteStart = actionStartById.get(actionId);
      if (!prerequisiteStart) {
        return true;
      }
      return toDayKey(prerequisiteStart) <= asOfDayKey;
    })
    .map((detail) => actionTitleById.get(String(detail?.actionId || '').trim()) || String(detail?.actionId || '').trim())
    .filter(Boolean);
  const gateConfig = getCapitalGateConfig(String(gate?.capitalGateId || '').trim());
  const capitalRequired = Number(gateConfig?.typicalCost || 0) || null;
  const capitalAvailable = Number.isFinite(capitalTrack.currentBalance) ? capitalTrack.currentBalance : null;
  return {
    gateId: String(gate?.capitalGateId || gate?.id || 'none'),
    gateTitle: String(gate?.title || gateConfig?.label || 'No upcoming gate'),
    gateDate: String(gate?.startISO || ''),
    daysUntilGate: gate ? diffCalendarDays(`${asOfDayKey}T00:00:00.000Z`, gate.startISO || null) : 9999,
    prerequisitesMet: prerequisitesRemaining.length === 0 && (capitalRequired === null || (capitalAvailable || 0) >= capitalRequired),
    prerequisitesRemaining,
    capitalRequired,
    capitalAvailable,
    capitalGap:
      capitalRequired !== null && capitalAvailable !== null ? Math.max(0, capitalRequired - capitalAvailable) : null,
  } satisfies GateStatus;
}

function deriveActiveWaitPeriods(
  scheduledBlocks: LivePlanBlock[],
  asOfISO: string,
  completedBlockIds: Set<string>
) {
  return sortBlocks(scheduledBlocks)
    .filter((block) => String(block?.blockType || '') === 'waiting_period')
    .map((block) => {
      const startISO = String(block?.startISO || '');
      const endISO = String(block?.endISO || '');
      const minimumDurationBusinessDays = Number(block?.minimumDurationBusinessDays || 0);
      const isCompleted = completedBlockIds.has(String(block?.id || '').trim());
      const active = startISO <= asOfISO && asOfISO <= endISO;
      const overdue = !isCompleted && endISO < asOfISO;
      const daysElapsed = active || overdue ? businessDaySpan(startISO, active || overdue ? asOfISO : endISO) : 0;
      const daysRemaining = active ? Math.max(0, minimumDurationBusinessDays - daysElapsed) : 0;
      const status = overdue ? 'overdue' : isCompleted || endISO < asOfISO ? 'completed' : active ? 'active' : 'completed';
      return {
        blockId: String(block?.id || ''),
        title: String(block?.title || ''),
        startDate: startISO,
        endDate: endISO,
        minimumDurationBusinessDays,
        daysElapsed,
        daysRemaining,
        parallelWorkSuggestions: Array.isArray(block?.parallelWorkSuggestions) ? [...block.parallelWorkSuggestions] : [],
        status,
      } satisfies WaitPeriod;
    })
    .filter((wait) => wait.status === 'active' || wait.status === 'overdue');
}

function derivePlanPosition(
  scheduledBlocks: LivePlanBlock[],
  completedBlockIds: Set<string>,
  asOfISO: string
) {
  const sorted = sortBlocks(scheduledBlocks);
  const sessionBlocks = sorted.filter(isSessionBlock);
  const planStartISO = String(sorted[0]?.startISO || asOfISO);
  const planEndISO = String(sorted[sorted.length - 1]?.endISO || sorted[sorted.length - 1]?.startISO || asOfISO);
  const currentCandidate =
    sorted.find((block) => {
      const startISO = String(block?.startISO || '');
      const endISO = String(block?.endISO || block?.startISO || '');
      return startISO <= asOfISO && asOfISO <= endISO;
    }) ||
    sorted.find((block) => String(block?.startISO || '') >= asOfISO) ||
    sorted[sorted.length - 1] ||
    null;
  const currentPhase = inferPhaseName(currentCandidate);
  const phaseRange = derivePhaseRange(sorted, currentPhase);
  const totalWeeks = Math.max(1, Math.ceil((diffCalendarDays(planStartISO, planEndISO) + 1) / 7));
  const currentWeek = Math.max(1, Math.min(totalWeeks, Math.floor(diffCalendarDays(planStartISO, asOfISO) / 7) + 1));
  const currentPhaseTotalWeeks = Math.max(
    1,
    Math.ceil((diffCalendarDays(`${phaseRange.startDayKey}T00:00:00.000Z`, `${phaseRange.endDayKey}T23:59:59.000Z`) + 1) / 7)
  );
  const currentPhaseWeek = Math.max(
    1,
    Math.min(
      currentPhaseTotalWeeks,
      Math.floor(diffCalendarDays(`${phaseRange.startDayKey}T00:00:00.000Z`, asOfISO) / 7) + 1
    )
  );
  const sessionsTotal = sessionBlocks.length;
  const sessionsCompleted = sessionBlocks.filter((block) => completedBlockIds.has(String(block?.id || '').trim())).length;
  const sessionsScheduledToDate = sessionBlocks.filter((block) => String(block?.startISO || '') <= asOfISO).length;
  const sessionsActualToDate = sessionBlocks.filter(
    (block) => String(block?.startISO || '') <= asOfISO && completedBlockIds.has(String(block?.id || '').trim())
  ).length;
  const sessionGap = sessionsActualToDate - sessionsScheduledToDate;
  const percentComplete = sessionsTotal > 0 ? sessionsCompleted / sessionsTotal : 0;
  const elapsedDays = Math.max(1, diffCalendarDays(planStartISO, asOfISO) + 1);
  const currentPacePerDay = sessionsCompleted > 0 ? sessionsCompleted / elapsedDays : 0;
  const remainingSessions = Math.max(0, sessionsTotal - sessionsCompleted);
  const projectedCompletionDate =
    currentPacePerDay > 0
      ? new Date(toDate(asOfISO)!.getTime() + Math.ceil(remainingSessions / currentPacePerDay) * ONE_DAY_MS).toISOString()
      : planEndISO;
  const daysAhead = diffCalendarDays(projectedCompletionDate, planEndISO) * -1;

  return {
    currentWeek,
    totalWeeks,
    currentPhase,
    currentPhaseWeek,
    currentPhaseTotalWeeks,
    sessionsCompleted,
    sessionsTotal,
    sessionsRemaining: Math.max(0, sessionsTotal - sessionsCompleted),
    sessionsScheduledToDate,
    sessionsActualToDate,
    sessionGap,
    percentComplete,
    projectedCompletionDate,
    plannedCompletionDate: planEndISO,
    daysAhead,
  } satisfies PlanPosition;
}

function deriveTodaysSessions(scheduledBlocks: LivePlanBlock[], asOfDayKey: string) {
  return sortBlocks(
    scheduledBlocks.filter((block) => isSessionBlock(block) && toDayKey(block?.startISO || block?.dayKey) === asOfDayKey)
  ).map((block) => ({
    blockId: String(block?.id || ''),
    title: String(block?.title || ''),
    startISO: String(block?.startISO || ''),
    endISO: String(block?.endISO || ''),
    durationMinutes: Number(block?.durationMinutes || 30),
    blockType: String(block?.blockType || 'execution'),
    actionId: block?.actionId ? String(block.actionId) : null,
  }));
}

function deriveDimensionFlags(
  input: LiveStateInput,
  planPosition: PlanPosition,
  activeWaitPeriods: WaitPeriod[],
  nextGate: GateStatus,
  capitalTrack: CapitalTrackState,
  asOfISO: string
) {
  const flags: DimensionFlag[] = [];
  const runtimeEvents = Array.isArray(input.runtimeEvents) ? input.runtimeEvents : [];
  const latestPresaleUpdate = [...runtimeEvents]
    .filter((event): event is Extract<LiveRuntimeEvent, { kind: 'presale_update' }> => event.kind === 'presale_update')
    .sort((left, right) => String(right.recordedAt).localeCompare(String(left.recordedAt)))[0];

  if (planPosition.sessionGap <= -8) {
    flags.push({
      dimension: 'execution',
      severity: planPosition.sessionGap <= -20 ? 'alert' : 'caution',
      signal: `${Math.abs(planPosition.sessionGap)} scheduled sessions have passed without completion.`,
      recommendedAction: 'Clear the oldest overdue session or explicitly skip it so the plan position is honest again.',
      triggeredAt: asOfISO,
      autoResolves: false,
      resolvedAt: null,
    });
  }

  activeWaitPeriods
    .filter((wait) => /manufacturer/i.test(wait.title))
    .forEach((wait) => {
      if (wait.daysElapsed > MANUFACTURER_TIMEOUT_ALERT_DAYS) {
        flags.push({
          dimension: 'domain',
          severity: 'alert',
          signal: `${wait.title} has been open ${wait.daysElapsed} business days without a logged response.`,
          recommendedAction: 'Follow up with the manufacturer today and expand the outreach list if the response is still missing.',
          triggeredAt: asOfISO,
          autoResolves: false,
          resolvedAt: null,
        });
      } else if (wait.daysElapsed > MANUFACTURER_TIMEOUT_CAUTION_DAYS) {
        flags.push({
          dimension: 'domain',
          severity: 'caution',
          signal: `${wait.title} has been open ${wait.daysElapsed} business days and is approaching the timeout threshold.`,
          recommendedAction: 'Send a manufacturer follow-up before the response window turns into a schedule risk.',
          triggeredAt: asOfISO,
          autoResolves: false,
          resolvedAt: null,
        });
      }
    });

  const presaleStartBlock = sortBlocks(
    input.plan.scheduledBlocks.filter((block) =>
      /presale|founder.?journey|founding customer|founder.?kit|build the presale offer|capital acquisition|warm list|audience/i.test(
        String(block?.title || '')
      )
    )
  ).find((block) => String(block?.startISO || '') <= asOfISO);
  if (presaleStartBlock || latestPresaleUpdate) {
    const presaleDays = presaleStartBlock ? diffCalendarDays(presaleStartBlock.startISO, asOfISO) : 31;
    const actualRate = Number(capitalTrack.presaleConversionRate || 0);
    const projectedRate = Number(
      input.plan.summary?.capitalAcquisitionFeasibility?.capitalAcquisitionPath?.presaleMath?.audienceConversionRequired || 0.0087
    );
    if (presaleDays > 30 && projectedRate > 0) {
      if (actualRate > 0 && actualRate < projectedRate * PRESALE_ALERT_RATIO) {
        flags.push({
          dimension: 'capital',
          severity: 'alert',
          signal: `Presale conversion is ${(actualRate * 100).toFixed(2)}% against a projected ${(projectedRate * 100).toFixed(
            2
          )}% after ${presaleDays} days.`,
          recommendedAction:
            'Rework the Founder Journey offer and ask directly for presale commitments before assuming the MOQ gate will clear.',
          triggeredAt: asOfISO,
          autoResolves: false,
          resolvedAt: null,
        });
      } else if (actualRate >= 0 && actualRate < projectedRate * PRESALE_CAUTION_RATIO) {
        flags.push({
          dimension: 'capital',
          severity: 'caution',
          signal: `Presale conversion is trailing plan after ${presaleDays} days.`,
          recommendedAction: 'Review presale engagement and tighten the offer before the deposit gate gets closer.',
          triggeredAt: asOfISO,
          autoResolves: false,
          resolvedAt: null,
        });
      }
    }
  }

  const latestEngagement = [...runtimeEvents]
    .filter((event) => event.kind === 'content_engagement')
    .sort((left, right) => String(right.recordedAt).localeCompare(String(left.recordedAt)))[0] as
    | Extract<LiveRuntimeEvent, { kind: 'content_engagement' }>
    | undefined;
  if (latestEngagement && Number(latestEngagement.engagementRatio) < CONTENT_ENGAGEMENT_THRESHOLD) {
    flags.push({
      dimension: 'market',
      severity: 'caution',
      signal: `Product-building content is at ${(latestEngagement.engagementRatio * 100).toFixed(
        0
      )}% of the normal audience baseline.`,
      recommendedAction: 'Revise the Founder Journey content angle before treating the audience as presale-ready.',
      triggeredAt: String(latestEngagement.recordedAt),
      autoResolves: false,
      resolvedAt: null,
    });
  }

  if (nextGate.daysUntilGate <= 7 && !nextGate.prerequisitesMet) {
    flags.push({
      dimension: 'timeline',
      severity: 'alert',
      signal: `${nextGate.gateTitle} is ${nextGate.daysUntilGate} days away and prerequisites are still open.`,
      recommendedAction: `Resolve ${nextGate.prerequisitesRemaining[0] || 'the remaining gate prerequisites'} before the gate date passes.`,
      triggeredAt: asOfISO,
      autoResolves: true,
      resolvedAt: null,
    });
  } else if (nextGate.daysUntilGate <= 14 && !nextGate.prerequisitesMet) {
    flags.push({
      dimension: 'timeline',
      severity: 'caution',
      signal: `${nextGate.gateTitle} is ${nextGate.daysUntilGate} days away with remaining prerequisites.`,
      recommendedAction: `Use today's session to clear ${nextGate.prerequisitesRemaining[0] || 'the nearest prerequisite'}.`,
      triggeredAt: asOfISO,
      autoResolves: true,
      resolvedAt: null,
    });
  }

  if (!capitalTrack.onTrackToMeetGate && nextGate.daysUntilGate <= 21 && (latestPresaleUpdate || presaleStartBlock || capitalTrack.strategy !== 'presale')) {
    flags.push({
      dimension: 'capital',
      severity: 'alert',
      signal: `${nextGate.gateTitle} requires ${capitalTrack.nextGateAmount ? `$${capitalTrack.nextGateAmount.toLocaleString()}` : 'capital'} within ${nextGate.daysUntilGate} days, and current progress is off pace.`,
      recommendedAction: 'Make the capital-closing action the primary task until the gate math changes.',
      triggeredAt: asOfISO,
      autoResolves: false,
      resolvedAt: null,
    });
  }

  return flags;
}

function classifyLiveStatus(liveStateLike: {
  planPosition: PlanPosition;
  dimensionFlags: DimensionFlag[];
  nextGate: GateStatus;
  capitalTrack: CapitalTrackState;
}) {
  const sessionGap = liveStateLike.planPosition.sessionGap;
  const hasAlert = liveStateLike.dimensionFlags.some((flag) => flag.severity === 'alert');
  const hasCaution = liveStateLike.dimensionFlags.some((flag) => flag.severity === 'caution');
  const urgentAlert = liveStateLike.dimensionFlags.some(
    (flag) => flag.severity === 'alert' && (flag.dimension === 'execution' || flag.dimension === 'timeline' || flag.dimension === 'domain')
  );
  const softAlertOnly =
    hasAlert &&
    !urgentAlert &&
    liveStateLike.dimensionFlags.every((flag) => flag.severity !== 'alert' || flag.dimension === 'capital' || flag.dimension === 'market');
  const unmetGateSoon =
    liveStateLike.nextGate.daysUntilGate <= 14 &&
    !liveStateLike.nextGate.prerequisitesMet &&
    liveStateLike.nextGate.prerequisitesRemaining.length > 0;
  const missedGate =
    liveStateLike.nextGate.daysUntilGate <= 0 && !liveStateLike.nextGate.prerequisitesMet;

  if (
    missedGate &&
    (!liveStateLike.capitalTrack.onTrackToMeetGate || (liveStateLike.capitalTrack.currentBalance === 0 && liveStateLike.capitalTrack.strategy === 'presale'))
  ) {
    return 'NON_RECOVERABLE' as const;
  }
  if (sessionGap <= -20 || (liveStateLike.nextGate.daysUntilGate <= 7 && !liveStateLike.nextGate.prerequisitesMet)) {
    return 'AT_RISK' as const;
  }
  if (sessionGap <= -8 || urgentAlert || unmetGateSoon) {
    return 'RECOVERABLE_SLIP' as const;
  }
  if (
    (sessionGap <= -3 && sessionGap >= -7) ||
    (hasCaution && liveStateLike.nextGate.daysUntilGate > 14) ||
    (softAlertOnly && liveStateLike.nextGate.daysUntilGate > 14)
  ) {
    return 'DRIFTING' as const;
  }
  return 'ON_TRACK' as const;
}

export function deriveLiveState(input: LiveStateInput): LiveState {
  const asOfISO = String(input?.asOf || new Date().toISOString());
  const asOfDayKey = toDayKey(asOfISO);
  const scheduledBlocks = sortBlocks(Array.isArray(input?.plan?.scheduledBlocks) ? input.plan.scheduledBlocks : []);
  const completionLog = Array.isArray(input?.completionLog) ? input.completionLog : [];
  const completedBlockIds = getCompletedBlockIds(completionLog);
  const blocksById = new Map(
    scheduledBlocks
      .map((block) => [String(block?.id || '').trim(), block] as const)
      .filter(([id]) => Boolean(id))
  );
  const actionTitleById = new Map(
    scheduledBlocks
      .map((block) => [String(block?.actionId || '').trim(), String(block?.title || '').trim()] as const)
      .filter(([id]) => Boolean(id))
  );
  const lastCheckIn = getLatestCheckIn(completionLog, input.lastCheckInISO);
  const daysSinceLastCheckIn = lastCheckIn ? Math.max(0, diffCalendarDays(lastCheckIn, asOfISO)) : 0;
  const planPosition = derivePlanPosition(scheduledBlocks, completedBlockIds, asOfISO);
  const activeWaitPeriods = deriveActiveWaitPeriods(scheduledBlocks, asOfISO, completedBlockIds);
  const capitalTrack = deriveCapitalTrack(input, scheduledBlocks, asOfDayKey);
  const nextGate = deriveNextGate(scheduledBlocks, completedBlockIds, capitalTrack, asOfDayKey, actionTitleById);
  const dimensionFlags = deriveDimensionFlags(input, planPosition, activeWaitPeriods, nextGate, capitalTrack, asOfISO);
  const liveStatus = classifyLiveStatus({ planPosition, dimensionFlags, nextGate, capitalTrack });
  const todaysSessions = deriveTodaysSessions(scheduledBlocks, asOfDayKey);
  const recentlyCompleted = getLatestCompleted(completionLog, blocksById);

  return {
    asOf: asOfISO,
    lastCheckIn,
    daysSinceLastCheckIn,
    planPosition,
    activeWaitPeriods,
    dimensionFlags,
    liveStatus,
    todaysSessions,
    capitalTrack,
    nextGate,
    recentlyCompleted,
  };
}

export function isAppendOnlyCompletionLog(log: CompletionLogEntry[]) {
  return Array.isArray(log);
}
