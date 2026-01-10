import { dayKeyFromDate, nowDayKey } from '../time/time.ts';

export type LinkageStatus = 'LINKED' | 'UNLINKED_ACTIVITY';

export type ExecutionEvent = {
  id: string;
  blockId?: string;
  dateISO: string;
  minutes: number;
  rawLabel: string;
  domain: 'Body' | 'Focus' | 'Creation' | 'Resources' | 'Unclassified';
  cycleId?: string;
  goalId?: string;
  origin?: 'manual' | 'suggestion';
  suggestionId?: string;
  deliverableId?: string | null;
  criterionId?: string | null;
  lockedUntilDayKey?: string | null;
  completed: boolean;
  kind?: 'complete' | 'create' | 'update' | 'delete' | 'reschedule' | 'missed';
  startISO?: string;
  endISO?: string;
  status?: string;
  missedAtISO?: string;
  reason?: string;
  linkageStatus?: LinkageStatus; // MVP 3.0: track whether this activity is linked to goal/deliverable
};

const DEFAULT_DOMAIN: ExecutionEvent['domain'] = 'Unclassified';

export function buildExecutionEventFromBlock(block: any, overrides: Partial<ExecutionEvent> = {}) {
  const hasDateOverride = Object.prototype.hasOwnProperty.call(overrides, 'dateISO');
  const hasStartOverride = Object.prototype.hasOwnProperty.call(overrides, 'startISO');
  const hasEndOverride = Object.prototype.hasOwnProperty.call(overrides, 'endISO');
  const dateISO =
    (hasDateOverride ? overrides.dateISO : null) ||
    block?.date ||
    (block?.start ? dayKeyFromDate(new Date(block.start)) : nowDayKey());
  const rawLabel = overrides.rawLabel || block?.label || block?.practice || 'Block';
  const domain =
    overrides.domain ||
    (block?.domain || block?.practice || DEFAULT_DOMAIN);
  const minutes = Number.isFinite(overrides.minutes)
    ? overrides.minutes
    : Number.isFinite(block?.plannedMinutes)
    ? block.plannedMinutes
    : Number.isFinite(block?.durationMinutes)
    ? block.durationMinutes
    : 0;

  const startISO = hasStartOverride ? overrides.startISO : block?.start;
  const endISO = hasEndOverride ? overrides.endISO : block?.end;
  const status = overrides.status || block?.status;
  const lockedUntilDayKey = overrides.lockedUntilDayKey || block?.lockedUntilDayKey || null;

  return {
    id: overrides.id || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    blockId: overrides.blockId || block?.id,
    dateISO,
    minutes: Math.max(0, Math.round(minutes)),
    rawLabel,
    domain,
    cycleId: overrides.cycleId || block?.cycleId,
    goalId: overrides.goalId || block?.goalId,
    origin: overrides.origin || block?.origin,
    suggestionId: overrides.suggestionId || block?.suggestionId,
    deliverableId: overrides.deliverableId ?? block?.deliverableId ?? null,
    criterionId: overrides.criterionId ?? block?.criterionId ?? null,
    lockedUntilDayKey,
    completed: overrides.completed ?? true,
    kind: overrides.kind,
    startISO,
    endISO,
    status,
    linkageStatus: computeLinkageStatus({ deliverableId: overrides.deliverableId ?? block?.deliverableId, criterionId: overrides.criterionId ?? block?.criterionId })
  } as ExecutionEvent;
}

/**
 * Determine linkage status: linked if the event has deliverable or criterion linkage.
 * @param {{deliverableId?: string | null, criterionId?: string | null}} payload
 * @returns {LinkageStatus}
 */
export function computeLinkageStatus({ deliverableId = null, criterionId = null }): LinkageStatus {
  return deliverableId || criterionId ? 'LINKED' : 'UNLINKED_ACTIVITY';
}

export function appendExecutionEvent(state: any, event: ExecutionEvent) {
  if (!state.executionEvents) state.executionEvents = [];
  state.executionEvents.push(event);
}

type MaterializedDay = {
  date: string;
  blocks: any[];
  completionRate: number;
  driftSignal: string;
  loadByPractice: Record<string, number>;
  practices: any[];
};

export function materializeBlocksFromEvents(events: ExecutionEvent[] = [], { todayISO }: { todayISO?: string } = {}) {
  const byId = new Map<string, any>();
  const completedIds = new Set<string>();
  const deletedIds = new Set<string>();

  const buildBlockFromEvent = (event: ExecutionEvent, fallback: any = null) => {
    const baseDate = event.dateISO || (event.startISO ? dayKeyFromDate(new Date(event.startISO)) : nowDayKey());
    const startISO = event.startISO || `${baseDate}T08:00:00.000Z`;
    const minutes = Number.isFinite(event.minutes) ? Math.max(0, Math.round(event.minutes)) : 30;
    const endISO = event.endISO || new Date(new Date(startISO).getTime() + minutes * 60 * 1000).toISOString();
    const label = event.rawLabel || fallback?.label || 'Block';
    const domain = event.domain && event.domain !== 'Unclassified' ? event.domain : fallback?.domain || fallback?.practice || 'Focus';
    const practice = fallback?.practice || domain;
    const status = event.status || (event.completed ? 'completed' : fallback?.status || 'planned');
    return {
      id: event.blockId,
      cycleId: event.cycleId || fallback?.cycleId,
      goalId: event.goalId || fallback?.goalId,
      origin: event.origin || fallback?.origin,
      suggestionId: event.suggestionId || fallback?.suggestionId,
      deliverableId: event.deliverableId ?? fallback?.deliverableId ?? null,
      criterionId: event.criterionId ?? fallback?.criterionId ?? null,
      lockedUntilDayKey: event.lockedUntilDayKey ?? fallback?.lockedUntilDayKey ?? null,
      practice,
      domain,
      label,
      start: startISO,
      end: endISO,
      status
    };
  };

  (events || []).forEach((event) => {
    if (!event?.blockId) return;
    if (event.kind === 'missed') return;
    if (deletedIds.has(event.blockId)) return;
    if (event.kind === 'delete') {
      deletedIds.add(event.blockId);
      byId.delete(event.blockId);
      return;
    }

    const fallback = byId.get(event.blockId);
    if (!fallback && event.kind && event.kind !== 'create' && event.kind !== 'complete') {
      return;
    }

    let block = fallback ? { ...fallback } : buildBlockFromEvent(event);
    if (event.rawLabel) block.label = event.rawLabel;
    if (event.kind === 'reschedule' || event.kind === 'create') {
      if (event.startISO) block.start = event.startISO;
      if (event.endISO) block.end = event.endISO;
    }
    if (event.status) block.status = event.status;
    if (event.domain && event.domain !== 'Unclassified') {
      block.domain = event.domain;
      if (!block.practice) block.practice = event.domain;
    }
    if (event.deliverableId !== undefined) {
      block.deliverableId = event.deliverableId;
    }
    if (event.criterionId !== undefined) {
      block.criterionId = event.criterionId;
    }
    if (event.lockedUntilDayKey !== undefined) {
      block.lockedUntilDayKey = event.lockedUntilDayKey;
    }
    if ((event.kind === 'reschedule' || event.kind === 'create') && event.minutes && !event.endISO && block.start) {
      block.end = new Date(new Date(block.start).getTime() + Math.round(event.minutes) * 60 * 1000).toISOString();
    }
    if (event.completed) {
      completedIds.add(event.blockId);
      block.status = 'completed';
    } else if (completedIds.has(event.blockId)) {
      block.status = 'completed';
    }

    byId.set(event.blockId, block);
  });

  const dayMap = new Map<string, MaterializedDay>();
  const blocks = Array.from(byId.values());
  blocks.forEach((block) => {
    if (!block?.start) return;
    const key = dayKeyFromDate(new Date(block.start));
    if (!key) return;
    if (!dayMap.has(key)) {
      dayMap.set(key, {
        date: key,
        blocks: [],
        completionRate: 0,
        driftSignal: 'contained',
        loadByPractice: {},
        practices: []
      });
    }
    dayMap.get(key)!.blocks.push(block);
  });

  const days = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  days.forEach((day) => {
    day.blocks.sort((a, b) => {
      const aStart = a.start || '';
      const bStart = b.start || '';
      if (aStart !== bStart) return aStart.localeCompare(bStart);
      return `${a.id}`.localeCompare(`${b.id}`);
    });
  });

  const todayKey = todayISO || nowDayKey();
  const today = dayMap.get(todayKey);
  return {
    blocksById: byId,
    days,
    todayBlocks: today ? today.blocks : []
  };
}
