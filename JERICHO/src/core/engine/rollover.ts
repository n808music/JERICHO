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
import { flowIncompleteBlocksToBacklog } from './flowIncompleteToBacklog.ts';

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

  // Item 2 Fix: Flow incomplete blocks to Backlog (vs. old broken regeneration as "overdue")
  // Call pure function to generate MISSED events only, without CREATE events or overdue blocks
  const flowOutResult = flowIncompleteBlocksToBacklog(yesterdayCommittedBlocks, yesterdayDayKey, nowISO);
  eventsEmitted.push(...flowOutResult.missedEvents);

  // Track carried block IDs for telemetry (all incomplete blocks flow to Backlog)
  yesterdayCommittedBlocks.forEach((block: any) => {
    carriedBlockIds.push(block.id);
  });

  // NOTE: Intentionally NOT creating CREATE events or overdueBlocks
  // Incomplete blocks now flow to Backlog (derived from missed events)
  // vs. old broken behavior of regenerating as "overdue" on today.blocks
  // See Item 2 design decision: https://github.com/anthropic-ai/jericho/issues/xxx

  const nextState = { ...state };

  nextState.executionEvents = [...(nextState.executionEvents || []), ...eventsEmitted];

  // Item 2 Fix: Do NOT add overdueBlocks to state
  // Incomplete blocks are now derived to Backlog via resolveBacklogBlocks() selector
  // vs. old broken behavior of storing them as separate state blocks
  if (!nextState.today) nextState.today = {};
  // Keep existing today.blocks unchanged (no overdue regeneration)

  // Keep existing currentWeek blocks unchanged (no overdue regeneration)
  // No need to modify currentWeek.days since we're not creating overdueBlocks

  // Keep existing cyclesById blocks unchanged (no overdue regeneration)
  // No need to modify cycle.blocks since we're not creating overdueBlocks

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
