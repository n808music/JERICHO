/**
 * Item 5: CONSTRAINT Escalation Bypass Selector
 *
 * Pure selector computing urgency escalation signal for CONSTRAINT-tagged Backlog items
 * based on daysInBacklog, with discrete tier classification.
 *
 * Architecture (locked, 2026-08-20):
 * - No new event kinds; escalation computed from daysInBacklog only
 * - Three discrete urgency tiers: NORMAL (>7 days), ELEVATED (3-7 days), URGENT (<=3 days)
 * - Reuses Item 2's resolveBacklogBlocks() daysInBacklog computation
 * - Scope filtering: optional cycleId/goalId/entityId filters (aggregation-ready)
 * - Fresh-on-read: no caching, no state writes, pure function
 */

import { resolveBacklogBlocks } from './resolveBacklogBlocks';

export interface ConstraintEscalationEntry {
  blockId: string;
  daysInBacklog: number;
  urgencyTier: 'NORMAL' | 'ELEVATED' | 'URGENT';
  escalatedAtISO: string; // ISO timestamp when escalation result was computed
}

export interface ConstraintEscalationResult {
  items: ConstraintEscalationEntry[];
  urgentCount: number;
  elevatedCount: number;
  normalCount: number;
}

/**
 * Resolve CONSTRAINT escalation urgency for Backlog items.
 *
 * Classifies CONSTRAINT-tagged Backlog items by daysInBacklog into discrete urgency tiers:
 * - URGENT: daysInBacklog <= 3
 * - ELEVATED: 3 < daysInBacklog <= 7
 * - NORMAL: daysInBacklog > 7
 *
 * Only CONSTRAINT-tagged blocks are included; INTENT/ADVISORY and untagged blocks are filtered.
 * Non-Backlog blocks (status != 'missed') are implicitly excluded.
 *
 * @param state Full identity state with appTime, executionEvents, today.blocks
 * @param scope Optional filter: { cycleId?, goalId?, entityId? }
 * @returns ConstraintEscalationResult with entries and aggregated counts
 */
export function resolveConstraintEscalation(
  state: any,
  scope?: { cycleId?: string; goalId?: string; entityId?: string }
): ConstraintEscalationResult {
  if (!state) {
    return { items: [], urgentCount: 0, elevatedCount: 0, normalCount: 0 };
  }

  // Get Backlog blocks with daysInBacklog already computed (Item 2)
  const backlogBlocks = resolveBacklogBlocks(state);

  // Filter to CONSTRAINT-tagged blocks only
  const constraintBacklogBlocks = backlogBlocks.filter((block: any) => block.constraintTag === 'CONSTRAINT');

  // Apply scope filters
  const scopedBlocks = constraintBacklogBlocks.filter((block: any) => {
    if (scope?.cycleId && block.cycleId !== scope.cycleId) return false;
    if (scope?.goalId && block.goalId !== scope.goalId) return false;
    if (scope?.entityId && block.entityId !== scope.entityId) return false;
    return true;
  });

  // Classify by urgency tier and build entries
  const entries: ConstraintEscalationEntry[] = scopedBlocks.map((block: any) => {
    const daysInBacklog = block.daysInBacklog || 0;
    let urgencyTier: 'NORMAL' | 'ELEVATED' | 'URGENT';

    if (daysInBacklog <= 3) {
      urgencyTier = 'URGENT';
    } else if (daysInBacklog <= 7) {
      urgencyTier = 'ELEVATED';
    } else {
      urgencyTier = 'NORMAL';
    }

    return {
      blockId: block.id,
      daysInBacklog,
      urgencyTier,
      escalatedAtISO: state.appTime?.nowISO || new Date().toISOString(),
    };
  });

  // Aggregate counts
  const urgentCount = entries.filter((e) => e.urgencyTier === 'URGENT').length;
  const elevatedCount = entries.filter((e) => e.urgencyTier === 'ELEVATED').length;
  const normalCount = entries.filter((e) => e.urgencyTier === 'NORMAL').length;

  return {
    items: entries,
    urgentCount,
    elevatedCount,
    normalCount,
  };
}
