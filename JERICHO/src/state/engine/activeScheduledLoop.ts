/**
 * Active/Scheduled Loop Selector Module (Phase 2, Item 1)
 *
 * CRITICAL: All functions in this module are PURE and STATELESS.
 * DO NOT persist any return value onto `state` or `cycle` fields.
 * Every call recomputes fresh from its inputs — this is the entire point.
 *
 * This module eliminates the staleness bug in recoverCanonicalContractForCycle
 * by ensuring time-relative state (startDayKey, deadlines, daysRemaining) is
 * always derived fresh on access, never cached or frozen into state.
 *
 * Pattern template: src/state/cycleSelectors.js:205 (getCanonicalCycleContract)
 *                   src/state/engine/executionContract.ts:11 (buildSnapshot)
 */

import { APP_TIME_ZONE, dayKeyFromISO, nowDayKey } from '../time/time.ts';
import type { ExecutionEvent } from './todayAuthority.ts';

/**
 * ResolvedCycleContract: the canonical view of what the cycle's active contract is,
 * with all time-relative fields resolved fresh on every read.
 */
export type ResolvedCycleContract = {
  goalId: string | null;
  goalText: string | null;
  startDayKey: string; // NEVER null — always resolved to at least nowDayKey()
  endDayKey: string | null;
  deadlineISO: string | null;
  timezone: string;
};

/**
 * resolveStartDayKey: Derive the effective start day of an Active/Scheduled cycle.
 *
 * Priority (first non-null wins, recomputed every call):
 * 1. cycle.startedAtDayKey — explicit activation date set by the system
 * 2. contract.startDayKey — operator-supplied goal start date
 * 3. state.goalExecutionContract.startDayKey — mirror value
 * 4. dayKeyFromISO(nowISO) — fallback to "today" (recomputed fresh from nowISO on every call)
 *
 * NEVER null. NEVER cached. Takes explicit nowISO parameter (not wall-clock) to ensure
 * determinism and testability. Matches pattern from src/state/engine/feasibility.ts:80.
 *
 * @param cycle The active cycle object (may have startedAtDayKey)
 * @param contract The goal contract (may have startDayKey)
 * @param state The global state (may have goalExecutionContract.startDayKey)
 * @param nowISO Explicit "now" timestamp (e.g., state.appTime.nowISO). If absent, uses Date.now()
 * @param timeZone Timezone for dayKeyFromISO fallback
 * @returns A dayKey string, never null
 */
export function resolveStartDayKey(
  cycle: any,
  contract: any,
  state: any,
  nowISO?: string,
  timeZone: string = APP_TIME_ZONE
): string {
  const explicit = cycle?.startedAtDayKey;
  if (explicit) return explicit;

  const contractStart = contract?.startDayKey;
  if (contractStart) return contractStart;

  const mirrorStart = state?.goalExecutionContract?.startDayKey;
  if (mirrorStart) return mirrorStart;

  // Fallback: derive from nowISO (recomputed on every call, not baked in once)
  const now = nowISO || state?.appTime?.nowISO || new Date().toISOString();
  return dayKeyFromISO(now, timeZone);
}

/**
 * resolveEndDayKey: Derive the effective end/deadline day of a cycle.
 *
 * Similar priority to resolveStartDayKey. May be null if no deadline is set.
 * NEVER cached.
 *
 * @param cycle The active cycle object
 * @param contract The goal contract
 * @param state The global state
 * @returns A dayKey string, or null if no deadline exists
 */
export function resolveEndDayKey(
  cycle: any,
  contract: any,
  state: any
): string | null {
  const explicit = cycle?.endedAtDayKey;
  if (explicit) return explicit;

  const contractEnd = contract?.endDayKey;
  if (contractEnd) return contractEnd;

  const mirrorEnd = state?.goalExecutionContract?.endDayKey;
  if (mirrorEnd) return mirrorEnd;

  return null;
}

/**
 * resolveDeadlineISO: Compute deadline as an ISO timestamp from endDayKey.
 *
 * Returns the end-of-day timestamp for the endDayKey (23:59:59 on that day).
 *
 * @param endDayKey The resolved end day (from resolveEndDayKey)
 * @param timeZone Timezone to use for conversion
 * @returns An ISO timestamp at the end of the endDayKey day, or null if no endDayKey
 */
export function resolveDeadlineISO(
  endDayKey: string | null,
  timeZone: string = APP_TIME_ZONE
): string | null {
  if (!endDayKey) return null;

  const [year, month, day] = endDayKey.split('-');
  if (!year || !month || !day) return null;

  const yearNum = Number(year);
  const monthNum = Number(month);
  const dayNum = Number(day);

  if (!Number.isFinite(yearNum) || !Number.isFinite(monthNum) || !Number.isFinite(dayNum)) {
    return null;
  }

  // End of the specified day: 23:59:59 UTC
  const endOfDayDate = new Date(Date.UTC(yearNum, monthNum - 1, dayNum, 23, 59, 59, 999));
  return endOfDayDate.toISOString();
}

/**
 * daysRemaining: Compute days from startDayKey to endDayKey (inclusive).
 *
 * Recomputed on every call against the resolved start/end keys.
 * NEVER cached.
 *
 * @param startDayKey The resolved start day
 * @param endDayKey The resolved end day
 * @returns Number of days (inclusive), or null if dates are invalid
 */
export function daysRemaining(startDayKey: string, endDayKey: string | null): number | null {
  if (!endDayKey) return null;

  const startMs = Date.parse(`${startDayKey}T12:00:00Z`);
  const endMs = Date.parse(`${endDayKey}T12:00:00Z`);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }

  if (endMs < startMs) {
    return null; // deadline is before start (invalid)
  }

  return Math.floor((endMs - startMs) / 86400000) + 1; // inclusive
}

/**
 * resolveActiveScheduledContract: Unified resolver for all Active/Scheduled cycle state.
 *
 * This is the primary entry point for consumers that need the canonical contract
 * with all time-relative fields resolved fresh.
 *
 * Composes:
 * - getCanonicalCycleContract() for goalId/goalText/governance logic
 * - resolveStartDayKey/resolveEndDayKey for fresh time resolution
 *
 * NEVER writes back to cycle or state. Returns a new plain object only.
 * Takes explicit nowISO parameter to ensure time is deterministic (not wall-clock).
 *
 * @param cycle The active cycle
 * @param state The global state
 * @param nowISO Explicit "now" timestamp (e.g., state.appTime.nowISO). If absent, uses wall-clock.
 * @param timeZone Timezone
 * @returns ResolvedCycleContract with all fields resolved fresh
 */
export function resolveActiveScheduledContract(
  cycle: any,
  state: any,
  nowISO?: string,
  timeZone: string = APP_TIME_ZONE
): ResolvedCycleContract {
  // Import here to avoid circular dependencies
  const { getCanonicalCycleContract } = require('../cycleSelectors.js');

  const baseContract = getCanonicalCycleContract(
    cycle,
    state?.goalExecutionContract || null,
    cycle?.contract || null
  );

  const startDayKey = resolveStartDayKey(cycle, baseContract, state, nowISO, timeZone);
  const endDayKey = resolveEndDayKey(cycle, baseContract, state);
  const deadlineISO = resolveDeadlineISO(endDayKey, timeZone);

  return {
    goalId: baseContract?.goalId || null,
    goalText: baseContract?.goalText || null,
    startDayKey, // NEVER null
    endDayKey, // may be null
    deadlineISO, // may be null
    timezone: timeZone,
  };
}

/**
 * resolvePosInputs: Gather all Active/Scheduled state needed for POS (Probability of Success) computation.
 *
 * This includes:
 * - The resolved contract (fresh)
 * - The resolved startDayKey (fresh)
 * - Active/scheduled blocks filtered from the cycle (status: 'planned' | 'in_progress')
 * - Completed blocks from the execution ledger (rebuilt fresh, not cached)
 *
 * NEVER writes back. Recomputes the execution ledger snapshot on every call.
 * Takes explicit nowISO parameter to ensure time is deterministic (not wall-clock).
 *
 * @param cycle The active cycle
 * @param state The global state
 * @param nowISO Explicit "now" timestamp (e.g., state.appTime.nowISO). If absent, uses wall-clock.
 * @param timeZone Timezone
 * @returns Object with contract, startDayKey, activeBlocks, completedToday
 */
export function resolvePosInputs(
  cycle: any,
  state: any,
  nowISO?: string,
  timeZone: string = APP_TIME_ZONE
): {
  contract: ResolvedCycleContract;
  startDayKey: string;
  activeBlocks: any[];
  completedToday: number;
  completedTotal: number;
} {
  const contract = resolveActiveScheduledContract(cycle, state, nowISO, timeZone);
  const startDayKey = contract.startDayKey;

  // Extract active blocks (status: 'planned' or 'in_progress')
  const activeBlocks = Array.isArray(cycle?.schedule?.blocks)
    ? cycle.schedule.blocks.filter((block: any) => {
        const status = String(block?.status || '').toLowerCase();
        return status === 'planned' || status === 'in_progress';
      })
    : [];

  // Rebuild execution ledger snapshot fresh (matching executionContract.ts:buildSnapshot pattern)
  const executionEvents = state?.executionEvents || [];
  const completedCount = buildExecutionEventSnapshot(executionEvents).filter((event) => event.completed).length;

  // Count completed blocks from today only (derive "today" from nowISO)
  const now = nowISO || state?.appTime?.nowISO || new Date().toISOString();
  const todayDayKey = dayKeyFromISO(now, timeZone);
  const completedToday = executionEvents.filter((event: ExecutionEvent) => {
    if (!event.completed) return false;
    const eventDayKey = dayKeyFromISO(event?.dateISO || event?.completedAtISO || '', timeZone);
    return eventDayKey === todayDayKey;
  }).length;

  return {
    contract,
    startDayKey,
    activeBlocks,
    completedToday,
    completedTotal: completedCount,
  };
}

/**
 * buildExecutionEventSnapshot: Rebuild execution ledger state from the append-only event stream.
 *
 * This mirrors src/state/engine/executionContract.ts:buildSnapshot pattern.
 * Runs on every call to resolvePosInputs — no caching, no incremental updates.
 *
 * @param events The execution event ledger
 * @returns Array of { blockId, completed, exists, deleted } snapshots
 */
function buildExecutionEventSnapshot(
  events: ExecutionEvent[] = []
): Array<{ blockId?: string; completed: boolean; exists: boolean; deleted: boolean }> {
  const map = new Map<string, { blockId?: string; exists: boolean; deleted: boolean; completed: boolean }>();

  (events || []).forEach((event) => {
    if (!event?.blockId) return;

    const current = map.get(event.blockId) || {
      blockId: event.blockId,
      exists: false,
      deleted: false,
      completed: false,
    };

    if (event.kind === 'delete') {
      map.set(event.blockId, { ...current, exists: false, deleted: true, completed: false });
      return;
    }

    if (current.deleted) {
      map.set(event.blockId, current);
      return;
    }

    if (event.kind === 'create') {
      map.set(event.blockId, { ...current, exists: true });
      return;
    }

    if (event.kind === 'complete') {
      map.set(event.blockId, { ...current, exists: true, completed: true });
      return;
    }

    if (event.kind === 'update' || event.kind === 'reschedule') {
      map.set(event.blockId, { ...current });
      return;
    }

    if (event.kind === 'missed' || event.kind === 'skipped') {
      map.set(event.blockId, { ...current, exists: true, completed: false });
      return;
    }
  });

  return Array.from(map.values());
}
