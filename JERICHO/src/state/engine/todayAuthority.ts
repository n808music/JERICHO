import { dayKeyFromDate, dayKeyFromISO, nowDayKey } from '../time/time.ts';

export type LinkageStatus = 'LINKED' | 'UNLINKED_ACTIVITY';

export type ExecutionEvent = {
  id: string;
  blockId?: string;
  dateISO: string;
  scheduledDate?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  recordedAtISO?: string | null;
  temporalRelation?: 'on_time' | 'early' | 'late' | 'past_log' | 'future_claim';
  dependencyRelation?:
    | 'not_applicable'
    | 'dependency_clear'
    | 'dependency_unknown'
    | 'dependency_suspicious'
    | 'dependency_order_violation';
  source?: 'user_action' | 'schedule_activation' | 'system';
  requiresReview?: boolean;
  reasonCode?: string | null;
  note?: string | null;
  minutes: number;
  rawLabel: string;
  canonicalTitle?: string | null;
  domain: 'Body' | 'Focus' | 'Creation' | 'Resources' | 'Unclassified';
  cycleId?: string;
  goalId?: string;
  origin?: 'manual' | 'suggestion' | 'schedule_active';
  suggestionId?: string;
  deliverableId?: string | null;
  actionId?: string | null;
  sessionIndex?: number | null;
  identityKey?: string | null;
  criterionId?: string | null;
  lockedUntilDayKey?: string | null;
  requiredSystemBlock?: boolean;
  completed: boolean;
  kind?: 'complete' | 'create' | 'update' | 'delete' | 'reschedule' | 'missed' | 'skipped' | 'backlog_accept';
  startISO?: string;
  endISO?: string;
  status?: string;
  missedAtISO?: string;
  completedAtISO?: string;
  reason?: string;
  linkageStatus?: LinkageStatus; // MVP 3.0: track whether this activity is linked to goal/deliverable
};

export type PlanMutationEvent = {
  id: string;
  kind: 'remove_block';
  mutationType: 'plan_block_removed';
  blockId: string;
  goalId?: string | null;
  cycleId?: string | null;
  actionId?: string | null;
  deliverableId?: string | null;
  scheduledDate?: string | null;
  removedAtISO: string;
  source?: 'user_action' | 'system';
  reasonCode?: string | null;
  note?: string | null;
  requiredSystemBlock?: boolean;
};

export type ExternalEvidenceEvent = {
  id: string;
  kind: 'external_evidence';
  evidenceType:
    | 'positive_response'
    | 'negative_response'
    | 'no_response'
    | 'submission_confirmed'
    | 'approval_received'
    | 'rejection_received'
    | 'quote_received'
    | 'quote_blocking'
    | 'sample_ordered'
    | 'sample_failed'
    | 'sale_occurred'
    | 'payment_failed'
    | 'artifact_published'
    | 'external_dependency_blocked';
  goalId: string;
  cycleId?: string | null;
  blockId?: string | null;
  actionId?: string | null;
  relatedExecutionEventId?: string | null;
  dateISO: string;
  recordedAtISO: string;
  source: 'user_confirmed' | 'integration_verified' | 'system_inferred_candidate';
  confidence: 'low' | 'moderate' | 'high';
  value?: number | null;
  unit?: string | null;
  counterparty?: string | null;
  note?: string | null;
  requiresReview?: boolean;
  stage?: string | null;
  confirmed?: boolean;
};

const DEFAULT_DOMAIN: ExecutionEvent['domain'] = 'Unclassified';
const SESSION_LABEL_PATTERN = /\bSession\s+\d+\s+(?:of|\/)\s+\d+\b/i;

export function buildExecutionEventFromBlock(block: any, overrides: Partial<ExecutionEvent> = {}) {
  const hasDateOverride = Object.prototype.hasOwnProperty.call(overrides, 'dateISO');
  const hasStartOverride = Object.prototype.hasOwnProperty.call(overrides, 'startISO');
  const hasEndOverride = Object.prototype.hasOwnProperty.call(overrides, 'endISO');
  const dateISO =
    (hasDateOverride ? overrides.dateISO : null) ||
    block?.date ||
    (block?.start ? dayKeyFromDate(new Date(block.start)) : nowDayKey());
  const rawLabel = overrides.rawLabel || block?.title || block?.label || block?.practice || 'Block';
  const canonicalTitle =
    overrides.canonicalTitle || block?.title || block?.label || block?.practice || rawLabel || 'Block';
  const domain = overrides.domain || block?.domain || block?.practice || DEFAULT_DOMAIN;
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
  const scheduledDate =
    overrides.scheduledDate ||
    block?.scheduledDate ||
    block?.date ||
    (block?.start ? dayKeyFromDate(new Date(block.start)) : null);
  const eventDate = overrides.eventDate || block?.eventDate || dateISO;
  const eventTime = overrides.eventTime || block?.eventTime || null;
  const recordedAtISO = overrides.recordedAtISO || block?.recordedAtISO || null;
  const temporalRelation = overrides.temporalRelation || block?.temporalRelation || null;
  const dependencyRelation = overrides.dependencyRelation || block?.dependencyRelation || 'not_applicable';
  const source = overrides.source || block?.source || undefined;
  const requiresReview = overrides.requiresReview ?? block?.requiresReview ?? false;
  const reasonCode = overrides.reasonCode ?? block?.reasonCode ?? null;
  const note = overrides.note ?? block?.note ?? null;
  const missedAtISO = overrides.missedAtISO || block?.missedAtISO;
  const completedAtISO = overrides.completedAtISO || block?.completedAtISO;
  const lockedUntilDayKey = overrides.lockedUntilDayKey || block?.lockedUntilDayKey || null;
  const requiredSystemBlock = overrides.requiredSystemBlock ?? block?.requiredSystemBlock ?? false;

  const deterministicId =
    overrides.id ||
    `evt:${overrides.kind || 'update'}:${overrides.blockId || block?.id || 'unknown'}:${dateISO}:${Math.max(0, Math.round(minutes))}`;
  return {
    id: deterministicId,
    blockId: overrides.blockId || block?.id,
    dateISO,
    scheduledDate,
    eventDate,
    eventTime,
    recordedAtISO,
    temporalRelation: temporalRelation as ExecutionEvent['temporalRelation'],
    dependencyRelation: dependencyRelation as ExecutionEvent['dependencyRelation'],
    source,
    requiresReview,
    reasonCode,
    note,
    minutes: Math.max(0, Math.round(minutes)),
    rawLabel,
    canonicalTitle,
    domain,
    cycleId: overrides.cycleId || block?.cycleId,
    goalId: overrides.goalId || block?.goalId,
    origin: overrides.origin || block?.origin,
    suggestionId: overrides.suggestionId || block?.suggestionId,
    deliverableId: overrides.deliverableId ?? block?.deliverableId ?? null,
    actionId: overrides.actionId ?? block?.actionId ?? null,
    sessionIndex: overrides.sessionIndex ?? block?.sessionIndex ?? null,
    identityKey: overrides.identityKey ?? block?.identityKey ?? null,
    criterionId: overrides.criterionId ?? block?.criterionId ?? null,
    lockedUntilDayKey,
    requiredSystemBlock,
    completed: overrides.completed ?? true,
    kind: overrides.kind,
    startISO,
    endISO,
    status,
    missedAtISO,
    completedAtISO,
    linkageStatus: computeLinkageStatus({
      deliverableId: overrides.deliverableId ?? block?.deliverableId,
      criterionId: overrides.criterionId ?? block?.criterionId,
    }),
  } as ExecutionEvent;
}

function formatEventTime(nowISO: string, timeZone = 'UTC') {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(new Date(nowISO));
    const hour = parts.find((part) => part.type === 'hour')?.value || '';
    const minute = parts.find((part) => part.type === 'minute')?.value || '';
    const period = parts.find((part) => part.type === 'dayPeriod')?.value || '';
    return `${hour}:${minute} ${period}`.trim();
  } catch {
    return String(nowISO).slice(11, 16);
  }
}

export function deriveExecutionTruthClassification({
  block,
  nowISO,
  activeDayKey,
  timeZone = 'UTC',
  executionEvents = [],
  canonicalActions = [],
  dependenciesById = {},
  source = 'user_action',
  reasonCode = null,
  note = null,
}: {
  block: any;
  nowISO: string;
  activeDayKey?: string | null;
  timeZone?: string;
  executionEvents?: ExecutionEvent[];
  canonicalActions?: any[];
  dependenciesById?: Record<string, any>;
  source?: ExecutionEvent['source'];
  reasonCode?: string | null;
  note?: string | null;
}) {
  const actualDate = dayKeyFromISO(nowISO, timeZone);
  const scheduledDate =
    block?.date || (block?.start ? dayKeyFromDate(new Date(block.start)) : null) || activeDayKey || actualDate;
  const eventDate = activeDayKey || actualDate;
  let temporalRelation: NonNullable<ExecutionEvent['temporalRelation']> = 'on_time';
  if (eventDate > actualDate) {
    temporalRelation = 'future_claim';
  } else if (eventDate < actualDate) {
    temporalRelation = 'past_log';
  } else if (scheduledDate && eventDate < scheduledDate) {
    temporalRelation = 'early';
  } else if (scheduledDate && eventDate > scheduledDate) {
    temporalRelation = 'late';
  }

  const actionId = String(block?.actionId || '').trim();
  const action = Array.isArray(canonicalActions)
    ? canonicalActions.find((candidate) => String(candidate?.id || '').trim() === actionId) || null
    : null;
  const dependencyDetails = Array.isArray(action?.dependencyDetails)
    ? action.dependencyDetails
        .map((detail) => ({
          actionId: String(detail?.actionId || detail?.dependencyId || detail?.id || '').trim(),
          dependencyType: String(detail?.dependencyType || '').trim().toLowerCase() || 'directional',
        }))
        .filter((detail) => detail.actionId)
    : [];
  const dependencyIds = dependencyDetails.length
    ? dependencyDetails.map((detail) => detail.actionId)
    : Array.isArray(action?.dependencies)
      ? action.dependencies.map((dependencyId: unknown) => String(dependencyId || '').trim()).filter(Boolean)
      : Array.isArray(action?.dependencyIds)
        ? action.dependencyIds.map((dependencyId: unknown) => String(dependencyId || '').trim()).filter(Boolean)
        : [];
  const completedActionIds = new Set(
    (Array.isArray(executionEvents) ? executionEvents : [])
      .filter((event) => event?.kind === 'complete')
      .map((event) => String(event?.actionId || '').trim())
      .filter(Boolean)
  );
  const suspenseTitle = String(block?.title || block?.label || '')
    .trim()
    .toLowerCase();
  const titleSuggestsDependencySensitiveStage =
    /\b(review|finalize|approve|decision|respond|reply|selection|select|compare|sign[- ]off)\b/.test(suspenseTitle);

  let dependencyRelation: NonNullable<ExecutionEvent['dependencyRelation']> = 'not_applicable';
  if (temporalRelation === 'early' || temporalRelation === 'future_claim') {
    if (dependencyIds.length === 0) {
      if (titleSuggestsDependencySensitiveStage) {
        dependencyRelation = 'dependency_unknown';
      } else if (actionId || action) {
        dependencyRelation = 'not_applicable';
      } else {
        dependencyRelation = 'dependency_clear';
      }
    } else {
      // Dependency satisfaction mode: per-edge evaluation
      // - ALL-mode edges: each upstream must be complete
      // - ANY_ONE-mode edges: at least one upstream among them must be complete
      // Phase ordering (phaseFromDependencies) uses ALL-semantics for depth calculation, which is
      // conservative-but-correct: may place later than necessary but won't break execution ordering.
      // This is documented in Phase Ordering Limitation section of todayAuthority.ts spec.

      // Partition dependencies into ALL-mode and ANY_ONE-mode groups
      const allModeDeps: string[] = [];
      const anyOneModeDeps: string[] = [];

      for (const depId of dependencyIds) {
        const edge = Object.values(dependenciesById).find(
          (e: any) => e?.upstreamId === depId && e?.downstreamId === actionId
        );
        const mode = edge?.satisfactionMode === 'ANY_ONE' ? 'ANY_ONE' : 'ALL';
        if (mode === 'ANY_ONE') {
          anyOneModeDeps.push(depId);
        } else {
          allModeDeps.push(depId);
        }
      }

      // Check satisfaction: ALL-mode edges each required, ANY_ONE-mode edges need at least one
      const allModesSatisfied = allModeDeps.every((depId) => completedActionIds.has(depId));
      const anyOneGroupSatisfied =
        anyOneModeDeps.length === 0 || anyOneModeDeps.some((depId) => completedActionIds.has(depId));

      const isSatisfied = allModesSatisfied && anyOneGroupSatisfied;

      if (isSatisfied) {
        dependencyRelation = 'dependency_clear';
      } else {
        const unmetDependencyIds = dependencyIds.filter((dependencyId) => !completedActionIds.has(dependencyId));
        const unmetIsHardGate = unmetDependencyIds.some((dependencyId) =>
          dependencyDetails.some(
            (detail) => detail.actionId === dependencyId && String(detail.dependencyType || '').toLowerCase() === 'hard_gate'
          )
        );
        dependencyRelation = unmetIsHardGate ? 'dependency_order_violation' : 'dependency_suspicious';
      }
    }
  }

  const requiresReview =
    temporalRelation === 'future_claim' ||
    temporalRelation === 'past_log' ||
    dependencyRelation === 'dependency_unknown' ||
    dependencyRelation === 'dependency_suspicious' ||
    dependencyRelation === 'dependency_order_violation';

  return {
    scheduledDate,
    eventDate,
    eventTime: formatEventTime(nowISO, timeZone),
    recordedAtISO: nowISO,
    temporalRelation,
    dependencyRelation,
    source,
    requiresReview,
    reasonCode,
    note,
  };
}

/**
 * Determine linkage status: linked if the event has deliverable or criterion linkage.
 * @param {{deliverableId?: string | null, criterionId?: string | null}} payload
 * @returns {LinkageStatus}
 */
export function computeLinkageStatus({ deliverableId = null, criterionId = null }): LinkageStatus {
  return deliverableId || criterionId ? 'LINKED' : 'UNLINKED_ACTIVITY';
}

function getSessionGroupingKey(block: any) {
  const cycleId = String(block?.cycleId || '').trim();
  const deliverableId = String(block?.deliverableId || '').trim();
  const actionId = String(block?.actionId || '').trim();
  if (!deliverableId && !actionId) {
    return '';
  }
  return `${cycleId || 'cycle'}::${deliverableId || 'no-deliverable'}::${actionId || 'no-action'}`;
}

function compareMaterializedBlocks(left: any, right: any) {
  const leftStart = String(left?.start || '');
  const rightStart = String(right?.start || '');
  if (leftStart !== rightStart) {
    return leftStart.localeCompare(rightStart);
  }
  const leftEnd = String(left?.end || '');
  const rightEnd = String(right?.end || '');
  if (leftEnd !== rightEnd) {
    return leftEnd.localeCompare(rightEnd);
  }
  const leftLabel = String(left?.displayTitle || left?.title || left?.label || '');
  const rightLabel = String(right?.displayTitle || right?.title || right?.label || '');
  if (leftLabel !== rightLabel) {
    return leftLabel.localeCompare(rightLabel);
  }
  return String(left?.id || '').localeCompare(String(right?.id || ''));
}

export function annotateRepeatedSessionTitles(blocks: any[] = []) {
  const groups = new Map<string, any[]>();
  blocks.forEach((block) => {
    const key = getSessionGroupingKey(block);
    if (!key) {
      return;
    }
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(block);
  });

  groups.forEach((groupBlocks) => {
    if (!Array.isArray(groupBlocks) || groupBlocks.length <= 1) {
      return;
    }
    groupBlocks.sort(compareMaterializedBlocks);
    const total = groupBlocks.length;
    const distinctBaseTitles = new Set(
      groupBlocks
        .map((block) => String(block?.displayTitle || block?.title || block?.label || '').trim())
        .filter(Boolean)
    );
    groupBlocks.forEach((block, index) => {
      const baseTitle = String(block?.displayTitle || block?.title || block?.label || 'Block').trim();
      if (!baseTitle) {
        return;
      }
      block.sessionOrdinal = index + 1;
      block.sessionCount = total;
      if (distinctBaseTitles.size > 1) {
        block.displayTitle = baseTitle;
        return;
      }
      if (SESSION_LABEL_PATTERN.test(baseTitle)) {
        block.displayTitle = baseTitle;
        return;
      }
      block.displayTitle = `${baseTitle} — Session ${index + 1} of ${total}`;
    });
  });

  blocks.forEach((block) => {
    if (!block) {
      return;
    }
    const baseTitle = String(block?.displayTitle || block?.title || block?.label || 'Block').trim();
    if (!baseTitle) {
      block.displayTitle = 'Block';
      return;
    }
    if (!block.displayTitle) {
      block.displayTitle = baseTitle;
    }
  });
}

export function appendExecutionEvent(state: any, event: ExecutionEvent) {
  if (!state.executionEvents) state.executionEvents = [];
  state.executionEvents.push(event);
}

export function buildPlanMutationEventFromBlock(block: any, overrides: Partial<PlanMutationEvent> = {}): PlanMutationEvent {
  const removedAtISO = overrides.removedAtISO || new Date().toISOString();
  const scheduledDate =
    overrides.scheduledDate ||
    block?.scheduledDate ||
    block?.date ||
    (block?.start ? dayKeyFromDate(new Date(block.start)) : null) ||
    null;
  return {
    id: overrides.id || `mut:remove:${overrides.blockId || block?.id || 'unknown'}:${removedAtISO}`,
    kind: 'remove_block',
    mutationType: 'plan_block_removed',
    blockId: overrides.blockId || block?.id,
    goalId: overrides.goalId ?? block?.goalId ?? null,
    cycleId: overrides.cycleId ?? block?.cycleId ?? null,
    actionId: overrides.actionId ?? block?.actionId ?? null,
    deliverableId: overrides.deliverableId ?? block?.deliverableId ?? null,
    scheduledDate,
    removedAtISO,
    source: overrides.source || 'user_action',
    reasonCode: overrides.reasonCode ?? null,
    note: overrides.note ?? null,
    requiredSystemBlock: overrides.requiredSystemBlock ?? block?.requiredSystemBlock ?? false,
  };
}

export function appendPlanMutationEvent(state: any, event: PlanMutationEvent) {
  if (!state.planMutationEvents) state.planMutationEvents = [];
  state.planMutationEvents.push(event);
  const cycleId = String(event?.cycleId || '').trim();
  if (cycleId && state?.cyclesById?.[cycleId]) {
    if (!Array.isArray(state.cyclesById[cycleId].planMutationEvents)) {
      state.cyclesById[cycleId].planMutationEvents = [];
    }
    state.cyclesById[cycleId].planMutationEvents.push(event);
  }
}

export function buildExternalEvidenceEvent(
  payload: Partial<ExternalEvidenceEvent> & {
    evidenceType: ExternalEvidenceEvent['evidenceType'];
    goalId: string;
  }
): ExternalEvidenceEvent {
  const recordedAtISO = String(payload?.recordedAtISO || new Date().toISOString()).trim();
  const dateISO =
    String(payload?.dateISO || '').trim() ||
    dayKeyFromDate(new Date(recordedAtISO)) ||
    nowDayKey();
  const source = payload?.source || 'user_confirmed';
  const confidence = payload?.confidence || (source === 'integration_verified' ? 'high' : 'moderate');
  const stage =
    payload?.stage ??
    (payload?.evidenceType === 'sale_occurred'
      ? 'sale_occurred'
      : payload?.evidenceType === 'approval_received'
        ? 'approval_received'
        : payload?.evidenceType === 'submission_confirmed'
          ? 'submission_confirmed'
          : payload?.evidenceType === 'rejection_received'
            ? 'rejection_received'
            : null);

  return {
    id: String(payload?.id || `ext:${payload.evidenceType}:${payload.goalId}:${dateISO}:${recordedAtISO}`).trim(),
    kind: 'external_evidence',
    evidenceType: payload.evidenceType,
    goalId: String(payload.goalId).trim(),
    cycleId: payload?.cycleId ?? null,
    blockId: payload?.blockId ?? null,
    actionId: payload?.actionId ?? null,
    relatedExecutionEventId: payload?.relatedExecutionEventId ?? null,
    dateISO,
    recordedAtISO,
    source,
    confidence,
    value: Number.isFinite(Number(payload?.value)) ? Number(payload.value) : null,
    unit: payload?.unit ?? null,
    counterparty: payload?.counterparty ?? null,
    note: payload?.note ?? null,
    requiresReview: payload?.requiresReview ?? source === 'system_inferred_candidate',
    stage,
    confirmed: payload?.confirmed ?? source !== 'system_inferred_candidate',
  };
}

export function appendExternalEvidenceEvent(state: any, event: ExternalEvidenceEvent) {
  if (!Array.isArray(state.externalEvidenceEvents)) {
    state.externalEvidenceEvents = [];
  }
  state.externalEvidenceEvents.push(event);
  const cycleId = String(event?.cycleId || '').trim();
  if (cycleId && state?.cyclesById?.[cycleId]) {
    if (!Array.isArray(state.cyclesById[cycleId].externalEvidenceEvents)) {
      state.cyclesById[cycleId].externalEvidenceEvents = [];
    }
    if (state.cyclesById[cycleId].externalEvidenceEvents !== state.externalEvidenceEvents) {
      state.cyclesById[cycleId].externalEvidenceEvents.push(event);
    }
  }
}

type MaterializedDay = {
  date: string;
  blocks: any[];
  completionRate: number;
  driftSignal: string;
  loadByPractice: Record<string, number>;
  practices: any[];
};

// Canonical identity / artifact / dependency fields that the proposal phase
// populates but execution events do not carry. When materializing blocks from
// events, these must be carried over from the canonical block store so that
// BlockDetailsPanel detail authority continues to recognize the lane context
// after a status transition (COMPLETE, MISSED, RESCHEDULE) rebuilds the block.
const CANONICAL_BLOCK_CONTEXT_FIELDS = [
  'laneId',
  'laneLabel',
  'entityId',
  'entityLabel',
  'phaseId',
  'phaseLabel',
  'workType',
  'masterPlanId',
  'masterPlanLaneId',
  'masterCalendarId',
  'coreMissionContractId',
  'initiativeLabel',
  'projectLabel',
  'milestoneType',
  'derivedFrom',
  'derivationReason',
  'placementBasis',
  'phaseJustification',
  'producesArtifact',
  'expectedOutput',
  'passEvidence',
  'acceptanceEvidence',
  'missConsequence',
  'completionAssertion',
  'consumedBy',
  'consumedByRef',
  'directDependencyIds',
  'directDependencyDetails',
  'owner',
  'executionOwner',
  'displayTitle',
  // Attestation contract — operator verifies, Jericho does not. The canonical
  // triple must survive every materialization boundary so that the panel can
  // always show Target / Source / Attestation directly from the block.
  'target',
  'verificationSource',
  'operatorAttestation',
] as const;

function mergeCanonicalContext(block: any, source: any): any {
  if (!block || !source) return block;
  CANONICAL_BLOCK_CONTEXT_FIELDS.forEach((field) => {
    if (block[field] == null && source[field] != null) {
      block[field] = source[field];
    }
  });
  return block;
}

export function materializeBlocksFromEvents(
  events: ExecutionEvent[] = [],
  { todayISO, canonicalBlocks = null }: { todayISO?: string; canonicalBlocks?: Record<string, any> | null } = {}
) {
  const byId = new Map<string, any>();
  const completedIds = new Set<string>();
  const deletedIds = new Set<string>();

  const buildBlockFromEvent = (event: ExecutionEvent, fallback: any = null) => {
    const baseDate = event.dateISO || (event.startISO ? dayKeyFromDate(new Date(event.startISO)) : nowDayKey());
    const startISO = event.startISO || `${baseDate}T08:00:00.000Z`;
    const minutes = Number.isFinite(event.minutes) ? Math.max(0, Math.round(event.minutes)) : 30;
    const endISO = event.endISO || new Date(new Date(startISO).getTime() + minutes * 60 * 1000).toISOString();
    const label = event.canonicalTitle || event.rawLabel || fallback?.title || fallback?.label || 'Block';
    const domain =
      event.domain && event.domain !== 'Unclassified'
        ? event.domain
        : fallback?.domain || fallback?.practice || 'Focus';
    const practice = fallback?.practice || domain;
    const status = event.status || (event.completed ? 'completed' : fallback?.status || 'planned');
    return {
      id: event.blockId,
      cycleId: event.cycleId || fallback?.cycleId,
      goalId: event.goalId || fallback?.goalId,
      origin: event.origin || fallback?.origin,
      suggestionId: event.suggestionId || fallback?.suggestionId,
      deliverableId: event.deliverableId ?? fallback?.deliverableId ?? null,
      actionId: event.actionId ?? fallback?.actionId ?? null,
      sessionIndex: event.sessionIndex ?? fallback?.sessionIndex ?? null,
      identityKey: event.identityKey ?? fallback?.identityKey ?? null,
      criterionId: event.criterionId ?? fallback?.criterionId ?? null,
      lockedUntilDayKey: event.lockedUntilDayKey ?? fallback?.lockedUntilDayKey ?? null,
      requiredSystemBlock: Boolean(event.requiredSystemBlock ?? fallback?.requiredSystemBlock ?? false),
      practice,
      domain,
      title: label,
      label,
      start: startISO,
      end: endISO,
      status,
      missedAtISO: event.missedAtISO ?? fallback?.missedAtISO ?? null,
    };
  };

  (events || []).forEach((event) => {
    if (!event?.blockId) return;
    if (event.kind === 'missed' || event.kind === 'skipped') return;
    if (deletedIds.has(event.blockId)) return;
    if (event.kind === 'delete') {
      deletedIds.add(event.blockId);
      byId.delete(event.blockId);
      return;
    }

    const fallback = byId.get(event.blockId) || (canonicalBlocks ? canonicalBlocks[event.blockId] : null) || null;
    if (!fallback && event.kind && event.kind !== 'create' && event.kind !== 'complete') {
      return;
    }

    let block = fallback ? { ...fallback } : buildBlockFromEvent(event);
    // Preserve canonical identity context from the canonical block store, even
    // when starting from an event-derived block. Events do not carry lane /
    // master plan / artifact context; the block store is the canonical source.
    if (canonicalBlocks && canonicalBlocks[event.blockId]) {
      mergeCanonicalContext(block, canonicalBlocks[event.blockId]);
    }
    if (event.canonicalTitle || event.rawLabel) {
      const preferredTitle = event.canonicalTitle || event.rawLabel;
      block.label = preferredTitle;
      block.title = preferredTitle;
    }
    if (event.kind === 'reschedule' || event.kind === 'create' || event.kind === 'backlog_accept') {
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
    if (event.actionId !== undefined) {
      block.actionId = event.actionId;
    }
    if (event.sessionIndex !== undefined) {
      block.sessionIndex = event.sessionIndex;
    }
    if (event.identityKey !== undefined) {
      block.identityKey = event.identityKey;
    }
    if (event.criterionId !== undefined) {
      block.criterionId = event.criterionId;
    }
    if (event.lockedUntilDayKey !== undefined) {
      block.lockedUntilDayKey = event.lockedUntilDayKey;
    }
    if (event.missedAtISO !== undefined) {
      block.missedAtISO = event.missedAtISO;
    }
    if ((event.kind === 'reschedule' || event.kind === 'create' || event.kind === 'backlog_accept') && event.minutes && !event.endISO && block.start) {
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
  annotateRepeatedSessionTitles(blocks);
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
        practices: [],
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
    todayBlocks: today ? today.blocks : [],
  };
}

/**
 * Item 3: Validate Backlog re-entry constraints.
 *
 * Checks:
 * 1. Block is in Backlog (most recent event is 'missed')
 * 2. Target date is within contract window
 * 3. No time conflicts with existing blocks on target day
 *
 * Returns { valid: true } or { valid: false, code, message }
 */
export function validateBacklogReEntry(
  state: any,
  blockId: string,
  targetDateISO: string,
  targetStartISO?: string,
  targetEndISO?: string,
): { valid: boolean; code?: string; message?: string } {
  // Check 1: Block must be in Backlog
  const events = state.executionEvents || [];
  const mostRecentEvent = [...events].reverse().find((e) => e.blockId === blockId);

  if (!mostRecentEvent || mostRecentEvent.kind !== 'missed') {
    return {
      valid: false,
      code: 'NOT_IN_BACKLOG',
      message: `Block ${blockId} is not in Backlog`,
    };
  }

  // Check 2: Target date within contract window
  const goalContract = state.goalExecutionContract || state.cyclesById?.[mostRecentEvent.cycleId]?.goalContract;
  if (goalContract) {
    const startDay = goalContract.startDayKey || goalContract.startDate;
    const endDay = goalContract.endDayKey || goalContract.endDate;

    if (targetDateISO < startDay || targetDateISO > endDay) {
      return {
        valid: false,
        code: 'OUTSIDE_CONTRACT_WINDOW',
        message: `Target date ${targetDateISO} is outside contract window (${startDay} to ${endDay})`,
      };
    }
  }

  // Check 3: No time conflicts on target day
  if (targetStartISO && targetEndISO) {
    const todayBlocks = state.today?.blocks || [];
    const targetStart = new Date(targetStartISO).getTime();
    const targetEnd = new Date(targetEndISO).getTime();

    const hasConflict = todayBlocks.some((block: any) => {
      if (block.id === blockId) return false; // Ignore self
      if (!block.start || !block.end) return false;

      const blockStart = new Date(block.start).getTime();
      const blockEnd = new Date(block.end).getTime();

      // Check for overlap
      return !(targetEnd <= blockStart || targetStart >= blockEnd);
    });

    if (hasConflict) {
      return {
        valid: false,
        code: 'TIME_CONFLICT',
        message: `Target time slot conflicts with existing block on ${targetDateISO}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Item 3: Build a Backlog re-entry execution event.
 *
 * Creates a 'reschedule' event with reasonCode 'BACKLOG_ACCEPT' or 'BACKLOG_RESCHEDULE'
 * to represent a block being pulled out of Backlog.
 */
export function buildBacklogReEntryEvent(params: {
  blockId: string;
  reasonCode: 'BACKLOG_ACCEPT' | 'BACKLOG_RESCHEDULE';
  targetDateISO: string;
  originalStartISO?: string;
  originalEndISO?: string;
  newStartISO?: string;
  newEndISO?: string;
  cycleId?: string;
  goalId?: string;
  nowISO?: string;
}): ExecutionEvent {
  const {
    blockId,
    reasonCode,
    targetDateISO,
    originalStartISO,
    originalEndISO,
    newStartISO,
    newEndISO,
    cycleId,
    goalId,
    nowISO = new Date().toISOString(),
  } = params;

  // For ACCEPT, use original times; for RESCHEDULE, use new times
  const useOriginal = reasonCode === 'BACKLOG_ACCEPT';
  const startISO = useOriginal ? originalStartISO : newStartISO;
  const endISO = useOriginal ? originalEndISO : newEndISO;

  const event: ExecutionEvent = {
    id: `evt-reentry-${blockId}-${Date.now()}`,
    blockId,
    kind: 'backlog_accept',
    reasonCode,
    dateISO: targetDateISO,
    startISO: startISO || `${targetDateISO}T09:00:00.000Z`,
    endISO: endISO || `${targetDateISO}T10:00:00.000Z`,
    status: 'in_progress',
    recordedAtISO: nowISO,
    cycleId,
    goalId,
    minutes: 60,
    completed: false,
    rawLabel: `Backlog re-entry: ${reasonCode}`,
    domain: 'Creation',
  };

  return event;
}
