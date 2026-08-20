/**
 * Item 4: Completed/Narrative Feed Selector
 *
 * Pure selector computing completed work narrative from event ledger + canonical blocks.
 *
 * Architecture (locked, 2026-08-20):
 * - No new event kinds: `complete` events + canonical attestation fields + optional `external_evidence`
 * - Evidence-matching priority: blockId > relatedExecutionEventId (grounds narrative in producer)
 * - Aggregation-ready: accepts scope filters (cycleId, goalId, entityId), does not assume single scope
 * - Fresh-on-read: no caching, no state writes, pure function
 * - Follows Item 1–3 selector pattern (`resolveBacklogBlocks.ts` template)
 */

import type { ExecutionEvent, ExternalEvidenceEvent } from '../../state/engine/todayAuthority';

export interface NarrativeEntry {
  blockId: string;
  goalId?: string;
  cycleId?: string;
  entityId?: string;
  deliverableId?: string | null;
  actionId?: string | null;
  completedAtISO: string;
  dateISO: string;
  canonicalTitle: string;
  domain: string;
  minutes: number;
  linkageStatus: 'LINKED' | 'UNLINKED_ACTIVITY';

  // Attestation triple (canonical-only per Attestation Contract law)
  target?: string | null;
  verificationSource?: string | null;
  operatorAttestation?: string | null;

  // Optional enrichment from external_evidence
  externalEvidence: ExternalEvidenceEvent[];

  // Temporal classification (from event)
  temporalRelation?: ExecutionEvent['temporalRelation'];
  requiresReview?: boolean;
}

export interface CompletedNarrativeResult {
  entries: NarrativeEntry[];
  completedCount: number;
  linkedCount: number;
  unlinkedCount: number;
}

/**
 * Resolve completed work narrative from event ledger.
 *
 * Filters executionEvents to `kind === 'complete' && completed === true`,
 * joins canonical attestation fields via materializeBlocksFromEvents,
 * attaches optional external_evidence by blockId (priority) then relatedExecutionEventId.
 *
 * @param state Full state with executionEvents, externalEvidenceEvents, blockStore
 * @param scope Optional filter: { cycleId?, goalId?, entityId? }
 * @returns CompletedNarrativeResult with entries and summary counts
 */
export function resolveCompletedNarrative(
  state: any,
  scope?: { cycleId?: string; goalId?: string; entityId?: string }
): CompletedNarrativeResult {
  if (!state || !state.executionEvents) {
    return { entries: [], completedCount: 0, linkedCount: 0, unlinkedCount: 0 };
  }

  const events = state.executionEvents as ExecutionEvent[];
  const externalEvidenceEvents = (state.externalEvidenceEvents || []) as ExternalEvidenceEvent[];
  const canonicalBlocks = state.blockStore?.blocks || {};

  // Filter to complete events only
  const completeEvents = events.filter(
    (event) => event?.kind === 'complete' && event?.completed === true
  );

  // Apply scope filters
  const scopedEvents = completeEvents.filter((event) => {
    if (scope?.cycleId && event.cycleId !== scope.cycleId) return false;
    if (scope?.goalId && event.goalId !== scope.goalId) return false;
    if (scope?.entityId && event.entityId !== scope.entityId) return false;
    return true;
  });

  // Build narrative entries
  const entries: NarrativeEntry[] = scopedEvents.map((event) => {
    const blockId = event.blockId || '';
    const canonicalBlock = canonicalBlocks[blockId] || {};

    // Determine linkage status (from canonical block or event)
    const deliverableId = event.deliverableId !== undefined ? event.deliverableId : canonicalBlock.deliverableId;
    const criterionId = event.criterionId !== undefined ? event.criterionId : canonicalBlock.criterionId;
    const linkageStatus: 'LINKED' | 'UNLINKED_ACTIVITY' = (deliverableId || criterionId) ? 'LINKED' : 'UNLINKED_ACTIVITY';

    // Match external evidence by blockId (priority) then relatedExecutionEventId
    const matchedEvidence = externalEvidenceEvents.filter((evidence) => {
      // Priority 1: blockId match
      if (evidence.blockId === blockId) return true;
      // Fallback: relatedExecutionEventId match
      if (evidence.relatedExecutionEventId === event.id) return true;
      return false;
    });

    return {
      blockId,
      goalId: event.goalId || canonicalBlock.goalId,
      cycleId: event.cycleId || canonicalBlock.cycleId,
      entityId: event.entityId || canonicalBlock.entityId,
      deliverableId,
      actionId: event.actionId !== undefined ? event.actionId : canonicalBlock.actionId,
      completedAtISO: event.completedAtISO || event.recordedAtISO || new Date().toISOString(),
      dateISO: event.dateISO || '',
      canonicalTitle: event.canonicalTitle || event.rawLabel || canonicalBlock.title || canonicalBlock.label || 'Completed work',
      domain: event.domain !== 'Unclassified' ? event.domain : (canonicalBlock.domain || 'Focus'),
      minutes: Number.isFinite(event.minutes) ? event.minutes : 0,
      linkageStatus,

      // Attestation triple (canonical-only, per Attestation Contract law)
      target: canonicalBlock.hasOwnProperty('target') ? canonicalBlock.target : undefined,
      verificationSource: canonicalBlock.hasOwnProperty('verificationSource') ? canonicalBlock.verificationSource : undefined,
      operatorAttestation: canonicalBlock.hasOwnProperty('operatorAttestation') ? canonicalBlock.operatorAttestation : undefined,

      // External evidence enrichment
      externalEvidence: matchedEvidence,

      // Temporal classification
      temporalRelation: event.temporalRelation,
      requiresReview: event.requiresReview ?? false,
    };
  });

  // Compute summary counts
  const linkedCount = entries.filter((e) => e.linkageStatus === 'LINKED').length;
  const unlinkedCount = entries.filter((e) => e.linkageStatus === 'UNLINKED_ACTIVITY').length;

  return {
    entries,
    completedCount: entries.length,
    linkedCount,
    unlinkedCount,
  };
}

/**
 * Helper: check if a block has narrative evidence (completed with attestation).
 * Useful for UI to decide whether to show an "attested" badge.
 */
export function hasNarrativeEvidence(entry: NarrativeEntry): boolean {
  const hasAttestation = !!(entry.target || entry.verificationSource || entry.operatorAttestation);
  const hasExternal = entry.externalEvidence.length > 0;
  return hasAttestation || hasExternal;
}

/**
 * Helper: format a narrative entry as a brief human-readable string.
 * Used by UI presentation layer (not system computation).
 */
export function formatNarrativeEntry(entry: NarrativeEntry): string {
  const date = entry.dateISO || 'Unknown date';
  const title = entry.canonicalTitle || 'Completed work';
  const evidence = entry.target ? ` (verified via ${entry.target})` : '';
  return `${title} on ${date}${evidence}`;
}
