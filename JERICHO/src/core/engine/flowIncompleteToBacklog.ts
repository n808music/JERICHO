/**
 * Item 2 Step 3: Flow Incomplete Blocks to Backlog
 *
 * Pure function that generates MISSED events for incomplete blocks.
 * Called before rolloverAtMidnight to divert incomplete blocks to Backlog
 * instead of regenerating them as "overdue" on the next day.
 *
 * Architectural constraint (locked):
 * - Pure function, no state mutation
 * - Returns MISSED events only (no CREATE events, no block regeneration)
 * - Selector pattern: same structure as Item 1's resolvers
 * - Backlog membership is derived later via resolveBacklogBlocks() selector
 */

import type { ExecutionEvent } from '../../state/engine/todayAuthority.ts';

export interface FlowOutResult {
  missedEvents: ExecutionEvent[];
}

/**
 * Generate MISSED events for incomplete committed blocks.
 * This function is called during rollover to record execution failures
 * before blocks are diverted to Backlog (vs. current broken behavior of
 * regenerating them as "overdue").
 *
 * @param incompleteBlocks Committed blocks from yesterday that are still incomplete
 * @param yesterdayDayKey Date key for yesterday (YYYY-MM-DD format)
 * @param nowISO Current time in ISO format
 * @returns FlowOutResult containing only MISSED events (pure, no state mutation)
 */
export function flowIncompleteBlocksToBacklog(
  incompleteBlocks: any[],
  yesterdayDayKey: string,
  nowISO: string
): FlowOutResult {
  const missedEvents: ExecutionEvent[] = [];

  incompleteBlocks.forEach((block) => {
    const originalStartISO = block.start || `${block.date}T08:00:00.000Z`;
    const durationMinutes = block.plannedMinutes || block.durationMinutes || 30;
    const eventSuffix = `${block.id}-${yesterdayDayKey}`;

    const missedEvent: ExecutionEvent = {
      id: `missed-${eventSuffix}`,
      blockId: block.id,
      dateISO: yesterdayDayKey,
      minutes: durationMinutes,
      rawLabel: block.label || block.practice || 'Missed Block',
      domain: block.domain || block.practice || 'Unclassified',
      cycleId: block.cycleId,
      goalId: block.goalId,
      origin: block.origin || 'system',
      suggestionId: block.suggestionId,
      deliverableId: block.deliverableId,
      criterionId: block.criterionId,
      completed: false,
      kind: 'missed',
      startISO: originalStartISO,
      endISO: block.end || new Date(new Date(originalStartISO).getTime() + durationMinutes * 60 * 1000).toISOString(),
      status: 'missed',
      missedAtISO: nowISO,
      linkageStatus: block.deliverableId ? 'LINKED' : 'UNLINKED_ACTIVITY',
    };

    missedEvents.push(missedEvent);
  });

  return { missedEvents };
}
