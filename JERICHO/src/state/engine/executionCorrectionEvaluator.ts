import type { ExecutionEvent } from './todayAuthority.ts';
import type { ExternalEvidenceEvent } from './todayAuthority.ts';
import type { PlanMutationEvent } from './todayAuthority.ts';

export type CorrectionState =
  | 'insufficient_evidence'
  | 'on_track'
  | 'watch'
  | 'adjustment_recommended'
  | 'recovery_required';

export type CorrectionLevel =
  | 'none'
  | 'reschedule'
  | 'compression_warning'
  | 'dependency_impact'
  | 'plan_evolution_required';

export type ExecutionCorrectionSignal = {
  goalId: string;
  cycleId: string | null;
  level: CorrectionLevel;
  state: string;
  executionEvidenceCount: number;
  evidenceCount: number;
  completedCount: number;
  missedCount: number;
  skippedCount: number;
  completionRate: number;
  missedRequiredWork: number;
  skippedRequiredWork: number;
  blockedDownstreamCount: number;
  timedDeadlineRiskCount: number;
  eventReasonCodes: string[];
  eventDependencyRelations: string[];
  dependencyRiskCount: number;
  externalEvidenceCount: number;
  positiveExternalEvidenceCount: number;
  negativeExternalEvidenceCount: number;
  noResponseExternalEvidenceCount: number;
  blockedExternalEvidenceCount: number;
  planMutationCount: number;
  requiredRemovedBlockCount: number;
  mutationReasonCodes: string[];
  correctionState: CorrectionState;
  recommendedActions: string[];
  reasonCodes: string[];
};

type CanonicalAction = {
  id: string;
  dependencyDetails?: { actionId: string; dependencyType: string }[];
  [key: string]: unknown;
};

export type ExecutionCorrectionInput = {
  goalId: string;
  cycleId: string | null;
  executionEvents: ExecutionEvent[];
  planMutationEvents?: PlanMutationEvent[];
  externalEvidenceEvents?: ExternalEvidenceEvent[];
  canonicalActions: CanonicalAction[];
  shotClock?: {
    paceState?: string | null;
    timedDeadlines?: Array<{ deadlineState?: string | null; blockId?: string | null }>;
  } | null;
};

function countBlockedDownstream(missedActionIds: Set<string>, canonicalActions: CanonicalAction[]): number {
  const blocked = new Set<string>();
  for (const action of canonicalActions) {
    if (!action?.id) continue;
    const deps = Array.isArray(action.dependencyDetails) ? action.dependencyDetails : [];
    for (const dep of deps) {
      if (dep?.dependencyType === 'hard_gate' && dep?.actionId && missedActionIds.has(dep.actionId)) {
        blocked.add(action.id);
        break;
      }
    }
  }
  return blocked.size;
}

export function evaluateExecutionCorrection(input: ExecutionCorrectionInput): ExecutionCorrectionSignal {
  const { goalId, cycleId, executionEvents, planMutationEvents, externalEvidenceEvents, canonicalActions, shotClock } =
    input;

  const relevant = (executionEvents || []).filter((e) => {
    if (!e?.blockId) return false;
    return e.kind === 'complete' || e.kind === 'missed' || e.kind === 'skipped';
  });

  const completedEvents = relevant.filter((e) => e.kind === 'complete');
  const missedEvents = relevant.filter((e) => e.kind === 'missed' && e.status === 'missed');
  const skippedEvents = relevant.filter(
    (e) => e.kind === 'skipped' || (e.kind === 'missed' && e.status === 'skipped')
  );

  const executionEvidenceCount = relevant.length;
  const completedCount = completedEvents.length;
  const missedCount = missedEvents.length;
  const skippedCount = skippedEvents.length;
  const completionRate = executionEvidenceCount > 0 ? completedCount / executionEvidenceCount : 0;

  const missedRequiredWork = missedEvents.filter((e) => e.requiredSystemBlock).length;
  const skippedRequiredWork = skippedEvents.filter((e) => e.requiredSystemBlock).length;

  const missedActionIds = new Set<string>(
    missedEvents.map((e) => e.actionId).filter((id): id is string => Boolean(id))
  );

  const blockedDownstreamCount =
    missedActionIds.size > 0 ? countBlockedDownstream(missedActionIds, canonicalActions || []) : 0;

  const timedDeadlineRiskCount = Array.isArray(shotClock?.timedDeadlines)
    ? shotClock.timedDeadlines.filter((item) => {
        const state = String(item?.deadlineState || '')
          .trim()
          .toLowerCase();
        return state === 'due_soon' || state === 'due_now' || state === 'missed' || state === 'missed_candidate';
      }).length
    : 0;
  const eventReasonCodes = Array.from(
    new Set(
      relevant
        .map((event) => String(event?.reasonCode || '').trim())
        .filter(Boolean)
    )
  );
  const eventDependencyRelations = Array.from(
    new Set(
      relevant
        .map((event) => String(event?.dependencyRelation || '').trim())
        .filter(Boolean)
    )
  );
  const dependencyRiskCount = relevant.filter((event) => {
    const relation = String(event?.dependencyRelation || '').trim();
    return (
      relation === 'dependency_unknown' ||
      relation === 'dependency_suspicious' ||
      relation === 'dependency_order_violation'
    );
  }).length;
  const relevantExternalEvidence = (externalEvidenceEvents || []).filter((event) => {
    if (String(event?.kind || '').trim().toLowerCase() !== 'external_evidence') {
      return false;
    }
    if (goalId && event?.goalId && event.goalId !== goalId) return false;
    if (cycleId && event?.cycleId && event.cycleId !== cycleId) return false;
    return true;
  });
  const positiveExternalEvidenceTypes = new Set([
    'positive_response',
    'submission_confirmed',
    'approval_received',
    'quote_received',
    'sample_ordered',
    'sale_occurred',
    'artifact_published',
  ]);
  const negativeExternalEvidenceTypes = new Set([
    'negative_response',
    'rejection_received',
    'quote_blocking',
    'sample_failed',
    'payment_failed',
  ]);
  const positiveExternalEvidenceCount = relevantExternalEvidence.filter((event) =>
    positiveExternalEvidenceTypes.has(String(event?.evidenceType || '').trim().toLowerCase())
  ).length;
  const negativeExternalEvidenceCount = relevantExternalEvidence.filter((event) =>
    negativeExternalEvidenceTypes.has(String(event?.evidenceType || '').trim().toLowerCase())
  ).length;
  const noResponseExternalEvidenceCount = relevantExternalEvidence.filter(
    (event) => String(event?.evidenceType || '').trim().toLowerCase() === 'no_response'
  ).length;
  const blockedExternalEvidenceCount = relevantExternalEvidence.filter(
    (event) => String(event?.evidenceType || '').trim().toLowerCase() === 'external_dependency_blocked'
  ).length;
  const relevantMutations = (planMutationEvents || []).filter((event) => {
    if (!event?.blockId) return false;
    if (goalId && event?.goalId && event.goalId !== goalId) return false;
    if (cycleId && event?.cycleId && event.cycleId !== cycleId) return false;
    return event.kind === 'remove_block';
  });
  const planMutationCount = relevantMutations.length;
  const requiredRemovedBlockCount = relevantMutations.filter((event) => Boolean(event.requiredSystemBlock)).length;
  const mutationReasonCodes = Array.from(
    new Set(
      relevantMutations
        .map((event) => String(event?.reasonCode || '').trim())
        .filter(Boolean)
    )
  );
  const normalizedPaceState = String(shotClock?.paceState || '')
    .trim()
    .toLowerCase();
  const repeatedMisses = missedCount >= 2;
  const repeatedSkips = skippedCount >= 2;
  const totalRecoverabilityFailures = missedCount + skippedCount;

  const reasonCodes: string[] = [];
  let correctionState: CorrectionState;
  let level: CorrectionLevel;
  let state: string;
  const recommendedActions: string[] = [];

  if (requiredRemovedBlockCount > 0) {
    level = 'compression_warning';
    state = 'compression_warning';
    correctionState = 'adjustment_recommended';
    reasonCodes.push('required_block_removed', 'plan_mutation_review_required');
    recommendedActions.push('Review the plan mutation before removing required work from the canonical path.');
  } else if (noResponseExternalEvidenceCount >= 2) {
    level = 'plan_evolution_required';
    state = 'plan_evolution_required';
    correctionState = 'recovery_required';
    reasonCodes.push('external_no_response_pattern');
    recommendedActions.push('Change the outreach or dependency strategy; the current external path is not responding.');
  } else if (blockedExternalEvidenceCount > 0) {
    level = 'dependency_impact';
    state = 'dependency_impact';
    correctionState = 'recovery_required';
    reasonCodes.push('external_dependency_blocked');
    recommendedActions.push('Resolve the blocked external dependency before relying on downstream work.');
  } else if (executionEvidenceCount === 0 && negativeExternalEvidenceCount === 0 && positiveExternalEvidenceCount === 0) {
    level = 'none';
    state = 'insufficient_evidence';
    correctionState = 'insufficient_evidence';
    reasonCodes.push('insufficient_execution_evidence');
    recommendedActions.push('Accumulate execution evidence before invoking course correction.');
  } else if (negativeExternalEvidenceCount > 0) {
    level = 'compression_warning';
    state = 'compression_warning';
    correctionState = 'adjustment_recommended';
    reasonCodes.push('negative_external_evidence');
    recommendedActions.push('Reassess the next action path in response to the negative external signal.');
  } else if (repeatedMisses || totalRecoverabilityFailures >= 3 || repeatedSkips) {
    level = 'plan_evolution_required';
    state = 'plan_evolution_required';
    correctionState = 'recovery_required';
    if (repeatedMisses) {
      reasonCodes.push('repeated_missed_work');
    }
    if (repeatedSkips) {
      reasonCodes.push('repeated_skipped_work');
    }
    if (totalRecoverabilityFailures >= 3) {
      reasonCodes.push('failure_pattern_exceeds_simple_recovery');
    }
    recommendedActions.push('Re-evaluate the current plan and replace or sequence-shift invalidated work.');
  } else if (missedRequiredWork > 0 && blockedDownstreamCount > 0) {
    level = 'dependency_impact';
    state = 'dependency_impact';
    correctionState = 'recovery_required';
    reasonCodes.push('missed_required_with_blocked_downstream');
    recommendedActions.push('Repair the blocked dependency path before advancing downstream work.');
  } else if (
    missedCount > 0 ||
    skippedCount > 0
  ) {
    const hasCompressionPressure =
      timedDeadlineRiskCount > 0 || normalizedPaceState === 'behind' || normalizedPaceState === 'critical';
    if (hasCompressionPressure || missedRequiredWork > 0 || skippedRequiredWork > 0) {
      level = 'compression_warning';
      state = 'compression_warning';
      correctionState = 'adjustment_recommended';
    if (missedRequiredWork > 0) {
      reasonCodes.push('missed_required_work');
    }
    if (dependencyRiskCount > 0) {
      reasonCodes.push('dependency_suspicious_execution');
    }
    if (timedDeadlineRiskCount > 0) {
      reasonCodes.push('timed_deadline_risk');
      }
      if (normalizedPaceState === 'behind' || normalizedPaceState === 'critical') {
        reasonCodes.push('pace_compression_risk');
      }
      recommendedActions.push('Recover the missed work while protecting near-term deadlines and remaining slack.');
    } else {
      level = 'reschedule';
      state = 'reschedule';
      correctionState = 'watch';
      if (missedCount > 0) reasonCodes.push('missed_non_required');
      if (skippedCount > 0) reasonCodes.push('skipped_work');
      recommendedActions.push('Reschedule the recoverable work into the next available slot.');
    }
  } else {
    level = 'none';
    state = 'on_track';
    correctionState = 'on_track';
    recommendedActions.push('No correction required.');
  }

  return {
    goalId,
    cycleId: cycleId ?? null,
    level,
    state,
    executionEvidenceCount,
    evidenceCount: executionEvidenceCount,
    completedCount,
    missedCount,
    skippedCount,
    completionRate,
    missedRequiredWork,
    skippedRequiredWork,
    blockedDownstreamCount,
    timedDeadlineRiskCount,
    eventReasonCodes,
    eventDependencyRelations,
    dependencyRiskCount,
    externalEvidenceCount: relevantExternalEvidence.length,
    positiveExternalEvidenceCount,
    negativeExternalEvidenceCount,
    noResponseExternalEvidenceCount,
    blockedExternalEvidenceCount,
    planMutationCount,
    requiredRemovedBlockCount,
    mutationReasonCodes,
    correctionState,
    recommendedActions,
    reasonCodes,
  };
}
