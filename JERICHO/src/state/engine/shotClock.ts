import { APP_TIME_ZONE, buildLocalStartISO, dayKeyFromISO, formatCanonicalTime, parseTimeString } from '../time/time.ts';
import { getDeadlineDayKey } from '../../core/deadline.ts';

type ShotClockPaceState = 'insufficient_evidence' | 'ahead' | 'on_track' | 'behind' | 'critical';
type ShotClockDeadlineState =
  | 'upcoming'
  | 'due_soon'
  | 'due_now'
  | 'missed_candidate'
  | 'missed'
  | 'completed';

type ShotClockDeadline = {
  blockId: string;
  goalId: string | null;
  cycleId: string | null;
  dateISO: string | null;
  deadlineTime: string | null;
  deadlineDateTime: string;
  deadlineLabel: string;
  minutesRemaining: number;
  deadlineState: ShotClockDeadlineState;
  completedLate?: boolean;
  completedAtISO?: string | null;
};

type DeriveShotClockInput = {
  goalId: string;
  cycleId?: string | null;
  contract?: any;
  blocks?: any[];
  executionEvents?: any[];
  nowISO?: string | null;
  timeZone?: string | null;
};

function clampRatio(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function dayKeyToNoonMs(dayKey: string | null) {
  if (!dayKey) return NaN;
  return new Date(`${dayKey}T12:00:00.000Z`).getTime();
}

function diffCalendarDays(startDayKey: string | null, endDayKey: string | null) {
  const startMs = dayKeyToNoonMs(startDayKey);
  const endMs = dayKeyToNoonMs(endDayKey);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000));
}

function formatCurrentTime(nowISO: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(nowISO));
}

function normalizeScheduledBlocks(blocks: any[] = [], goalId: string, cycleId: string | null) {
  return (Array.isArray(blocks) ? blocks : []).filter((block) => {
    if (!block?.id) return false;
    if (goalId && block?.goalId && block.goalId !== goalId) return false;
    if (cycleId && block?.cycleId && block.cycleId !== cycleId) return false;
    return true;
  });
}

function latestCompletionByBlock(executionEvents: any[] = [], goalId: string, cycleId: string | null) {
  const byBlock = new Map<string, any>();
  (Array.isArray(executionEvents) ? executionEvents : []).forEach((event) => {
    if (!event?.blockId || event?.kind !== 'complete') return;
    if (goalId && event?.goalId && event.goalId !== goalId) return;
    if (cycleId && event?.cycleId && event.cycleId !== cycleId) return;
    byBlock.set(event.blockId, event);
  });
  return byBlock;
}

function deriveDeadlineIso(block: any, timeZone: string) {
  if (block?.deadlineDateTime && Number.isFinite(Date.parse(block.deadlineDateTime))) {
    return String(block.deadlineDateTime);
  }
  if (block?.deadlineISO && Number.isFinite(Date.parse(block.deadlineISO))) {
    return String(block.deadlineISO);
  }
  if (!block?.deadlineTime) {
    return null;
  }
  const dateISO =
    block?.dateISO || block?.date || (block?.start ? dayKeyFromISO(block.start, timeZone || APP_TIME_ZONE) : null);
  if (!dateISO) {
    return null;
  }
  const derived = buildLocalStartISO(dateISO, String(block.deadlineTime), timeZone || APP_TIME_ZONE);
  return derived?.ok ? derived.startISO : null;
}

function deriveDeadlineTimeLabel(block: any, deadlineDateTime: string | null) {
  if (block?.deadlineTime) {
    const parsed = parseTimeString(String(block.deadlineTime));
    return parsed.ok ? formatCanonicalTime(parsed) : String(block.deadlineTime);
  }
  if (!deadlineDateTime || !Number.isFinite(Date.parse(deadlineDateTime))) {
    return null;
  }
  const date = new Date(deadlineDateTime);
  return formatCanonicalTime({ hours: date.getUTCHours(), minutes: date.getUTCMinutes() });
}

function deriveTimedDeadlines({
  goalId,
  cycleId,
  blocks,
  executionEvents,
  nowISO,
  timeZone,
}: {
  goalId: string;
  cycleId: string | null;
  blocks: any[];
  executionEvents: any[];
  nowISO: string;
  timeZone: string;
}): ShotClockDeadline[] {
  const completionByBlock = latestCompletionByBlock(executionEvents, goalId, cycleId);
  const nowMs = new Date(nowISO).getTime();
  return blocks
    .map((block) => {
      const deadlineDateTime = deriveDeadlineIso(block, timeZone);
      if (!deadlineDateTime || !Number.isFinite(Date.parse(deadlineDateTime))) {
        return null;
      }
      const deadlineMs = new Date(deadlineDateTime).getTime();
      const minutesRemaining = Math.floor((deadlineMs - nowMs) / 60000);
      const completionEvent = completionByBlock.get(block.id) || null;
      const completedAtISO =
        completionEvent?.completedAtISO ||
        completionEvent?.timestamp ||
        (completionEvent?.dateISO ? `${completionEvent.dateISO}T23:59:59.999Z` : null);
      const completedAtMs =
        completedAtISO && Number.isFinite(Date.parse(completedAtISO)) ? Date.parse(completedAtISO) : null;
      let deadlineState: ShotClockDeadlineState = 'upcoming';
      let completedLate = false;
      if (completionEvent) {
        deadlineState = 'completed';
        if (completedAtMs !== null) {
          completedLate = completedAtMs > deadlineMs;
        }
      } else if (minutesRemaining < 0) {
        deadlineState = 'missed_candidate';
      } else if (minutesRemaining <= 15) {
        deadlineState = 'due_now';
      } else if (minutesRemaining <= 120) {
        deadlineState = 'due_soon';
      }
      return {
        blockId: block.id,
        goalId: block?.goalId || goalId || null,
        cycleId: block?.cycleId || cycleId || null,
        dateISO: block?.dateISO || block?.date || (block?.start ? dayKeyFromISO(block.start, timeZone) : null),
        deadlineTime: deriveDeadlineTimeLabel(block, deadlineDateTime),
        deadlineDateTime,
        deadlineLabel: String(block?.deadlineLabel || block?.title || block?.label || 'Timed deadline'),
        minutesRemaining,
        deadlineState,
        completedLate,
        completedAtISO: completedAtISO || null,
      } as ShotClockDeadline;
    })
    .filter(Boolean)
    .sort((left, right) => String(left?.deadlineDateTime || '').localeCompare(String(right?.deadlineDateTime || '')));
}

function derivePaceState({
  totalHorizonDays,
  elapsedRatio,
  completionRatio,
  evidenceCount,
  scheduledBlockCount,
}: {
  totalHorizonDays: number;
  elapsedRatio: number;
  completionRatio: number;
  evidenceCount: number;
  scheduledBlockCount: number;
}): ShotClockPaceState {
  if (scheduledBlockCount <= 0 || totalHorizonDays <= 0 || evidenceCount <= 0) {
    return 'insufficient_evidence';
  }
  const delta = completionRatio - elapsedRatio;
  if (delta >= 0.1) return 'ahead';
  if (delta >= -0.08) return 'on_track';
  if (delta >= -0.2) return 'behind';
  return 'critical';
}

export function deriveSystemShotClock({
  goalId,
  cycleId = null,
  contract = null,
  blocks = [],
  executionEvents = [],
  nowISO = null,
  timeZone = null,
}: DeriveShotClockInput) {
  const timezone = timeZone || APP_TIME_ZONE;
  const resolvedNowISO = nowISO || new Date().toISOString();
  const currentDate = dayKeyFromISO(resolvedNowISO, timezone);
  const currentTime = formatCurrentTime(resolvedNowISO, timezone);
  const contractStartDate = contract?.startDayKey || null;
  const contractEndDate = getDeadlineDayKey(contract, timezone) || contract?.endDayKey || null;
  const totalHorizonDaysRaw = diffCalendarDays(contractStartDate, contractEndDate);
  const elapsedDaysRaw = diffCalendarDays(contractStartDate, currentDate);
  const remainingDaysRaw = diffCalendarDays(currentDate, contractEndDate);
  const totalHorizonDays = Math.max(0, Number.isFinite(totalHorizonDaysRaw) ? Number(totalHorizonDaysRaw) : 0);
  const elapsedDays = Math.max(0, Math.min(totalHorizonDays, Number.isFinite(elapsedDaysRaw) ? Number(elapsedDaysRaw) : 0));
  const remainingDays = Math.max(
    0,
    Math.min(totalHorizonDays, Number.isFinite(remainingDaysRaw) ? Number(remainingDaysRaw) : 0)
  );
  const elapsedRatio = totalHorizonDays > 0 ? clampRatio(elapsedDays / totalHorizonDays) : 0;
  const remainingRatio = totalHorizonDays > 0 ? clampRatio(remainingDays / totalHorizonDays) : 0;
  const scheduledBlocks = normalizeScheduledBlocks(blocks, goalId, cycleId);
  const completionEvents = (Array.isArray(executionEvents) ? executionEvents : []).filter((event) => {
    if (!event?.blockId || event?.kind !== 'complete') return false;
    if (goalId && event?.goalId && event.goalId !== goalId) return false;
    if (cycleId && event?.cycleId && event.cycleId !== cycleId) return false;
    return true;
  });
  const evidenceEvents = (Array.isArray(executionEvents) ? executionEvents : []).filter((event) => {
    if (!event?.blockId) return false;
    if (goalId && event?.goalId && event.goalId !== goalId) return false;
    if (cycleId && event?.cycleId && event.cycleId !== cycleId) return false;
    return event.kind === 'complete' || event.kind === 'missed' || event.kind === 'skipped';
  });
  const completedBlockCount = new Set(completionEvents.map((event) => event.blockId)).size;
  const scheduledBlockCount = scheduledBlocks.length;
  const completionRatio = scheduledBlockCount > 0 ? clampRatio(completedBlockCount / scheduledBlockCount) : 0;
  const timedDeadlines = deriveTimedDeadlines({
    goalId,
    cycleId,
    blocks: scheduledBlocks,
    executionEvents,
    nowISO: resolvedNowISO,
    timeZone: timezone,
  });

  return {
    goalId,
    cycleId,
    currentDate,
    currentTime,
    currentDateTimeISO: resolvedNowISO,
    timezone,
    contractStartDate,
    contractEndDate,
    totalHorizonDays,
    elapsedDays,
    remainingDays,
    elapsedRatio,
    remainingRatio,
    scheduledBlockCount,
    completedBlockCount,
    completionRatio,
    paceState: derivePaceState({
      totalHorizonDays,
      elapsedRatio,
      completionRatio,
      evidenceCount: evidenceEvents.length,
      scheduledBlockCount,
    }),
    timedDeadlines,
  };
}
