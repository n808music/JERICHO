/**
 * Midnight Rollover Engine
 *
 * Implements canonical rollover model where committed blocks that are not DONE
 * when local day changes create MISSED events and new overdue blocks
 * on the next day at the same time slot.
 */

import { addDays, dayKeyFromISO, buildLocalStartISO, APP_TIME_ZONE } from '../../state/time/time.ts';
import { materializeBlocksFromEvents } from '../../state/engine/todayAuthority.ts';
import type { ExecutionEvent } from '../../state/engine/todayAuthority.ts';

// Types for rollover result
export interface RolloverResult {
  nextState: any;
  eventsEmitted: ExecutionEvent[];
  lastRolloverDayISO?: string;
  carriedBlockIds?: string[];
}

export interface OverdueBlock {
  originalId: string;
  newId: string;
  originalDayKey: string;
  newDayKey: string;
  startISO: string;
  endISO: string;
  durationMinutes: number;
  // Preserve all original block properties
  origin: string;
  domain?: string;
  practice?: string;
  label?: string;
  cycleId?: string;
  goalId?: string;
  deliverableId?: string;
  criterionId?: string;
}

/**
 * Pure rollover function for midnight boundary crossing
 */
export function rolloverAtMidnight({
  state,
  nowISO,
  timezone,
  timeZone,
}: {
  state: any;
  nowISO: string;
  timezone?: string;
  timeZone?: string;
}): RolloverResult {
  const tz = resolveTimeZone(timezone, timeZone, state);
  const currentDayKey = dayKeyFromISO(nowISO, tz);
  const lastRolloverDayISO = state.lastRolloverDayISO;

  // Idempotence check: if rollover already processed for today, do nothing
  if (lastRolloverDayISO === currentDayKey) {
    return {
      nextState: state,
      eventsEmitted: [],
      lastRolloverDayISO,
    };
  }

  const yesterdayDayKey = addDays(currentDayKey, -1, tz);

  const eventsEmitted: ExecutionEvent[] = [];
  const overdueBlocks: OverdueBlock[] = [];
  const carriedBlockIds: string[] = [];

  const yesterdayCommittedBlocks = getYesterdayCommittedBlocks({
    state,
    nowISO,
    timezone: tz,
  });
  // For each committed block, create MISSED event and new overdue block
  yesterdayCommittedBlocks.forEach((originalBlock: any) => {
    const originalStartISO = originalBlock.start || `${originalBlock.date}T08:00:00.000Z`;
    const originalDate = new Date(originalStartISO);
    const durationMinutes = originalBlock.plannedMinutes || originalBlock.durationMinutes || 30;
    carriedBlockIds.push(originalBlock.id);
    const eventSuffix = `${originalBlock.id}-${currentDayKey}`;

    const missedEvent: ExecutionEvent = {
      id: `missed-${eventSuffix}`,
      blockId: originalBlock.id,
      dateISO: yesterdayDayKey,
      minutes: durationMinutes,
      rawLabel: originalBlock.label || originalBlock.practice || 'Missed Block',
      domain: originalBlock.domain || originalBlock.practice || 'Unclassified',
      cycleId: originalBlock.cycleId,
      goalId: originalBlock.goalId,
      origin: originalBlock.origin || 'system',
      suggestionId: originalBlock.suggestionId,
      deliverableId: originalBlock.deliverableId,
      criterionId: originalBlock.criterionId,
      completed: false,
      kind: 'missed',
      startISO: originalStartISO,
      endISO: originalBlock.end || new Date(originalDate.getTime() + durationMinutes * 60 * 1000).toISOString(),
      status: 'missed',
      missedAtISO: nowISO,
      linkageStatus: originalBlock.deliverableId ? 'LINKED' : 'UNLINKED_ACTIVITY',
    };

    eventsEmitted.push(missedEvent);

    const localTimeString = buildLocalTimeStringFromISO(originalStartISO, tz);
    const startResult = buildLocalStartISO(currentDayKey, localTimeString, tz);
    const fallbackStartISO = buildFallbackStartISO(currentDayKey, localTimeString);
    const nextStartISO = startResult.ok ? startResult.startISO : fallbackStartISO;
    const nextEndISO = new Date(new Date(nextStartISO).getTime() + durationMinutes * 60 * 1000).toISOString();

    const newId = `overdue-${originalBlock.id}-${currentDayKey}`;

    const createEvent: ExecutionEvent = {
      id: `create-${newId}`,
      blockId: newId,
      dateISO: currentDayKey,
      minutes: durationMinutes,
      rawLabel: originalBlock.label || originalBlock.practice || 'Overdue Block',
      domain: originalBlock.domain || originalBlock.practice || 'Unclassified',
      cycleId: originalBlock.cycleId,
      goalId: originalBlock.goalId,
      origin: originalBlock.origin || 'system',
      suggestionId: originalBlock.suggestionId,
      deliverableId: originalBlock.deliverableId ?? null,
      criterionId: originalBlock.criterionId ?? null,
      completed: false,
      kind: 'create',
      startISO: nextStartISO,
      endISO: nextEndISO,
      status: originalBlock.status || 'in_progress',
      placementState: 'COMMITTED',
    };

    eventsEmitted.push(createEvent);

    const overdueBlock: OverdueBlock = {
      originalId: originalBlock.id,
      newId,
      originalDayKey: yesterdayDayKey,
      newDayKey: currentDayKey,
      startISO: nextStartISO,
      endISO: nextEndISO,
      durationMinutes,
      origin: originalBlock.origin || 'system',
      domain: originalBlock.domain || originalBlock.practice,
      practice: originalBlock.practice,
      label: originalBlock.label || originalBlock.practice,
      cycleId: originalBlock.cycleId,
      goalId: originalBlock.goalId,
      deliverableId: originalBlock.deliverableId,
      criterionId: originalBlock.criterionId,
    };

    overdueBlocks.push(overdueBlock);
  });

  const nextState = { ...state };

  nextState.executionEvents = [...(nextState.executionEvents || []), ...eventsEmitted];

  if (!nextState.today) nextState.today = {};
  nextState.today.blocks = [
    ...(nextState.today.blocks || []),
    ...overdueBlocks.map((block) => ({
      id: block.newId,
      practice: block.practice,
      label: block.label,
      start: block.startISO,
      end: block.endISO,
      status: 'in_progress',
      placementState: 'COMMITTED',
      origin: block.origin,
      domain: block.domain,
      cycleId: block.cycleId,
      goalId: block.goalId,
      deliverableId: block.deliverableId,
      criterionId: block.criterionId,
      plannedMinutes: block.durationMinutes,
    })),
  ];

  if (nextState.currentWeek?.days) {
    const todayDay = nextState.currentWeek.days.find((d: any) => d.date === currentDayKey);
    if (todayDay) {
      todayDay.blocks = [
        ...todayDay.blocks,
        ...overdueBlocks.map((block) => ({
          id: block.newId,
          practice: block.practice,
          label: block.label,
          start: block.startISO,
          end: block.endISO,
          status: 'in_progress',
          placementState: 'COMMITTED',
          origin: block.origin,
          domain: block.domain,
          cycleId: block.cycleId,
          goalId: block.goalId,
          deliverableId: block.deliverableId,
          criterionId: block.criterionId,
          plannedMinutes: block.durationMinutes,
        })),
      ];
    }
  }

  if (nextState.cyclesById) {
    Object.values(nextState.cyclesById).forEach((cycle: any) => {
      const cycleDayKey = dayKeyFromISO(cycle.startedAtDayKey || nowISO, tz);
      if (cycleDayKey === currentDayKey) {
        cycle.blocks = [
          ...cycle.blocks,
          ...overdueBlocks.map((block) => ({
            id: block.newId,
            practice: block.practice,
            label: block.label,
            start: block.startISO,
            end: block.endISO,
            status: 'in_progress',
            placementState: 'COMMITTED',
            origin: block.origin,
            domain: block.domain,
            cycleId: block.cycleId,
            goalId: block.goalId,
            deliverableId: block.deliverableId,
            criterionId: block.criterionId,
            plannedMinutes: block.durationMinutes,
          })),
        ];
      }
    });
  }

  nextState.lastRolloverDayISO = currentDayKey;

  return {
    nextState,
    eventsEmitted,
    lastRolloverDayISO: currentDayKey,
    carriedBlockIds,
  };
}

export function shouldRollover({
  state,
  nowISO,
  timezone,
  timeZone,
}: {
  state: any;
  nowISO: string;
  timezone?: string;
  timeZone?: string;
}): boolean {
  const tz = resolveTimeZone(timezone, timeZone, state);
  const currentDayKey = dayKeyFromISO(nowISO, tz);
  const lastRolloverDayISO = state.lastRolloverDayISO;

  return lastRolloverDayISO !== currentDayKey;
}

/**
 * Helper to get yesterday's committed blocks
 */
export function getYesterdayCommittedBlocks({
  state,
  nowISO,
  timezone,
  timeZone,
}: {
  state: any;
  nowISO: string;
  timezone?: string;
  timeZone?: string;
}): any[] {
  const tz = resolveTimeZone(timezone, timeZone, state);
  const currentDayKey = dayKeyFromISO(nowISO, tz);
  const yesterdayDayKey = addDays(currentDayKey, -1, tz);

  const { days = [] } = materializeBlocksFromEvents(state.executionEvents || [], {
    todayISO: state.today?.date || nowISO,
  });
  const yesterdayDay = days.find((day) => day.date === yesterdayDayKey);
  let allYesterdayBlocks = yesterdayDay?.blocks || [];

  if (!allYesterdayBlocks.length) {
    allYesterdayBlocks = [
      ...(state.today?.blocks || []),
      ...((state.currentWeek?.days || []).find((d) => d.date === yesterdayDayKey)?.blocks || []),
      ...Object.values(state.cyclesById || {}).flatMap((cycle: any) => cycle.blocks || []),
    ];
  }

  return allYesterdayBlocks.filter((block: any) => {
    const rawIso = block.start || block.date;
    const isDateOnly = typeof rawIso === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(rawIso);
    const blockDayKey = rawIso ? (isDateOnly ? rawIso : dayKeyFromISO(rawIso, tz)) : yesterdayDayKey;
    return (
      blockDayKey === yesterdayDayKey &&
      (block.placementState === 'COMMITTED' || block.status === 'in_progress') &&
      block.status !== 'completed'
    );
  });
}

function resolveTimeZone(timezone?: string, timeZone?: string, state?: any) {
  return timezone || timeZone || state?.appTime?.timeZone || APP_TIME_ZONE;
}

function buildLocalTimeStringFromISO(iso: string, timezone: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '08:00:00';
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone,
  });
  const parts: { type: string; value: string }[] = formatter.formatToParts(date);
  const map: Record<string, string> = { hour: '08', minute: '00', second: '00' };
  parts.forEach((part) => {
    if (part.type in map) {
      map[part.type] = part.value;
    }
  });
  return `${map.hour}:${map.minute}:${map.second}`;
}

function buildFallbackStartISO(dayKey: string, timeString: string) {
  const safeTime = timeString || '08:00:00';
  const fallback = new Date(`${dayKey}T${safeTime}Z`);
  if (Number.isNaN(fallback.getTime())) {
    return new Date(`${dayKey}T08:00:00Z`).toISOString();
  }
  return fallback.toISOString();
}
