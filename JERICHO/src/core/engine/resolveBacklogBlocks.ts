/**
 * Item 2 Step 4: Resolve Backlog Blocks Selector
 *
 * Derives Backlog membership from the event ledger:
 * A block is in Backlog if:
 * 1. Its most recent event is 'missed', AND
 * 2. There is NO later reschedule/complete/delete event for that blockId
 *
 * Architectural pattern (locked, Option 2):
 * - Computed fresh from events, never hand-written state
 * - Pure selector: reads state, returns derived data
 * - No side effects, no field mutations
 * - Matches Item 1's resolver pattern
 */

import type { ExecutionEvent } from '../../state/engine/todayAuthority.ts';

export interface BacklogBlock {
  id: string;
  [key: string]: any; // Allow pass-through of original block properties
}

/**
 * Compute Backlog membership from the event ledger.
 *
 * Backlog = blocks where most recent event is 'missed' + no later action.
 * This derivation ensures:
 * - No manual field writes to state (fully computed)
 * - Single source of truth: the event ledger
 * - Blocks can reschedule/complete out of Backlog via events
 * - Scope-filtering ready: supports cycleId, goalId, entityId filters (added 2026-08-20)
 *
 * @param state Full state with executionEvents and today.blocks
 * @param scope Optional filter: { cycleId?, goalId?, entityId? }. Defaults to unfiltered (all backlog blocks).
 * @returns Array of blocks that are in Backlog (most recent event is 'missed'), filtered by scope if provided
 */
export function resolveBacklogBlocks(
  state: any,
  scope?: { cycleId?: string; goalId?: string; entityId?: string }
): BacklogBlock[] {
  if (!state || !state.executionEvents) {
    return [];
  }

  const events = state.executionEvents as ExecutionEvent[];
  const todayBlocks = state.today?.blocks || [];

  // Build a map of each blockId to its most recent event
  const mostRecentEventByBlockId = new Map<string, ExecutionEvent>();

  events.forEach((event) => {
    const blockId = event.blockId;
    if (!blockId) return;

    const current = mostRecentEventByBlockId.get(blockId);
    // Assume events are in chronological order; if not, we'd need timestamp comparison
    // For now, rely on insertion order (last event in array is most recent)
    mostRecentEventByBlockId.set(blockId, event);
  });

  // Filter to blocks where most recent event is 'missed'
  const backlogBlockIds = new Set<string>();

  mostRecentEventByBlockId.forEach((event, blockId) => {
    if (event.kind === 'missed') {
      backlogBlockIds.add(blockId);
    }
  });

  // Return blocks from today that are in Backlog
  // (Backlog membership is transient; blocks exist in today.blocks but are marked as in Backlog by event ledger)
  const currentDayKey = state.appTime?.activeDayKey || state.today?.date || new Date().toISOString().split('T')[0];

  const backlogBlocks = todayBlocks
    .filter((block: any) => backlogBlockIds.has(block.id))
    .map((block: any) => {
      // Compute daysInBacklog from the missed event's recorded timestamp
      const missedEvent = mostRecentEventByBlockId.get(block.id);
      let daysInBacklog = 0;

      if (missedEvent?.dateISO) {
        // Simple day-key comparison: parse dates and compute difference
        const missedDate = new Date(missedEvent.dateISO + 'T00:00:00Z');
        const currentDate = new Date(currentDayKey + 'T00:00:00Z');
        const diffMs = currentDate.getTime() - missedDate.getTime();
        daysInBacklog = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }

      return { ...block, daysInBacklog };
    });

  // Apply scope filters (matching Item 4/5 pattern)
  const scopedBlocks = backlogBlocks.filter((block: any) => {
    if (scope?.cycleId && block.cycleId !== scope.cycleId) return false;
    if (scope?.goalId && block.goalId !== scope.goalId) return false;
    if (scope?.entityId && block.entityId !== scope.entityId) return false;
    return true;
  });

  return scopedBlocks;
}

/**
 * Check if a specific block is in Backlog.
 * Helper for queries that check individual block membership.
 *
 * @param state Full state
 * @param blockId Block ID to check
 * @returns true if block is in Backlog, false otherwise
 */
export function isBlockInBacklog(state: any, blockId: string): boolean {
  const backlog = resolveBacklogBlocks(state);
  return backlog.some((block) => block.id === blockId);
}
