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
 *
 * @param state Full state with executionEvents and today.blocks
 * @returns Array of blocks that are in Backlog (most recent event is 'missed')
 */
export function resolveBacklogBlocks(state: any): BacklogBlock[] {
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
  const backlogBlocks = todayBlocks.filter((block: any) => backlogBlockIds.has(block.id));

  return backlogBlocks;
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
