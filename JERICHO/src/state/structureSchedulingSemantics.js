import { getCanonicalProposedBlocks } from './cycleSelectors.js';

const PHASE_TITLE_PATTERN =
  /planning\s*&\s*setup|scope definition|resource allocation|core production|execution\s*&\s*iteration|verification\s*&\s*finalization|quality assurance|build\s*&\s*refinement|launch\s*&\s*rollout/i;

function normalizeDeliverables(deliverables = []) {
  return (Array.isArray(deliverables) ? deliverables : []).filter(Boolean);
}

function countCommittedExecutionEvents(executionEvents = [], activeCycleId = null, activeGoalId = null) {
  return (Array.isArray(executionEvents) ? executionEvents : []).filter((event) => {
    if (!event || event.kind !== 'create') {
      return false;
    }
    if (activeCycleId && event.cycleId && event.cycleId !== activeCycleId) {
      return false;
    }
    if (activeGoalId && event.goalId && event.goalId !== activeGoalId) {
      return false;
    }
    return true;
  }).length;
}

export function deriveStructureSchedulingSemanticSummary({
  proposedBlocks = [],
  suggestedBlocks = [],
  deliverables = [],
  workspace = null,
  executionEvents = [],
  activeCycleId = null,
  activeGoalId = null,
  scheduleLifecycle = null,
  scheduleReviewBlocks = [],
  lastPlanError = null,
  activePlanSummary = null,
} = {}) {
  const canonicalProposed = getCanonicalProposedBlocks(proposedBlocks, suggestedBlocks);
  const scopedProposedCalendarBlocks = (Array.isArray(canonicalProposed) ? canonicalProposed : []).filter((block) => {
    if (!block || block.status !== 'suggested') {
      return false;
    }
    if (activeCycleId && block.cycleId && block.cycleId !== activeCycleId) {
      return false;
    }
    if (activeGoalId && block.goalId && block.goalId !== activeGoalId) {
      return false;
    }
    return true;
  });
  const committedCalendarBlockCount = countCommittedExecutionEvents(executionEvents, activeCycleId, activeGoalId);
  const normalizedScheduleLifecycle = String(scheduleLifecycle || '')
    .trim()
    .toLowerCase();
  const reviewCalendarBlockCount = Array.isArray(scheduleReviewBlocks)
    ? scheduleReviewBlocks.filter((block) => {
        if (!block) {
          return false;
        }
        if (activeCycleId && block.cycleId && block.cycleId !== activeCycleId) {
          return false;
        }
        if (activeGoalId && block.goalId && block.goalId !== activeGoalId) {
          return false;
        }
        return true;
      }).length
    : 0;
  const normalizedDeliverables = normalizeDeliverables(deliverables);
  const displayedSessionCount = normalizedDeliverables.reduce(
    (sum, d) => sum + Math.max(0, Number(d?.requiredBlocks) || 0),
    0
  );
  const looksPhaseLike =
    normalizedDeliverables.length > 0 &&
    normalizedDeliverables.every((d) => PHASE_TITLE_PATTERN.test(String(d?.title || '')));
  const displayedGroupType =
    looksPhaseLike || workspace?.autoStrategy?.detectedType === 'generic' ? 'phase' : 'deliverable';
  const normalizedPlanStatus = String(activePlanSummary?.planStatus || '')
    .trim()
    .toUpperCase();
  const normalizedLastPlanErrorCode = String(lastPlanError?.code || '')
    .trim()
    .toUpperCase();
  const hasDraftSchedule = scopedProposedCalendarBlocks.length > 0;
  const hasAppliedReviewSchedule = normalizedScheduleLifecycle === 'applied_review' || reviewCalendarBlockCount > 0;
  const hasActiveSchedule = normalizedScheduleLifecycle === 'active_schedule' || committedCalendarBlockCount > 0;
  const hasCanonicalScheduleSurface = hasDraftSchedule || hasAppliedReviewSchedule || hasActiveSchedule;
  const scheduleStatus = !hasCanonicalScheduleSurface && lastPlanError?.code
    ? normalizedLastPlanErrorCode === 'HORIZON_INSUFFICIENT'
      ? 'horizon_insufficient'
      : 'unknown'
    : normalizedPlanStatus === 'VALID_BUT_HORIZON_INSUFFICIENT'
      ? 'horizon_insufficient'
    : hasActiveSchedule
      ? 'active_schedule'
      : hasAppliedReviewSchedule
        ? 'applied_review'
        : hasDraftSchedule
          ? 'draft_schedule_ready'
          : normalizedScheduleLifecycle === 'stale_draft_invalidated'
            ? 'stale_draft_invalidated'
            : 'no_schedule';

  return {
    displayedGroupType,
    displayedGroupCount: normalizedDeliverables.length,
    displayedSessionCount,
    proposedBlockCount: scopedProposedCalendarBlocks.length,
    proposedBlockScope: 'active_cycle_goal',
    reviewBlockCount: reviewCalendarBlockCount,
    planStatus: normalizedPlanStatus || null,
    requiredBlockCount: Number(activePlanSummary?.requiredBlockCount || 0),
    scheduledBlockCount: Number(activePlanSummary?.scheduledBlockCount || 0),
    unscheduledBlockCount: Number(activePlanSummary?.unscheduledBlockCount || 0),
    candidateResolutionKinds: Array.isArray(activePlanSummary?.candidateResolutionKinds)
      ? [...activePlanSummary.candidateResolutionKinds]
      : [],
    recommendations: Array.isArray(activePlanSummary?.recommendations)
      ? activePlanSummary.recommendations.map((recommendation) => ({ ...recommendation }))
      : [],
    scheduleLifecycle: scheduleStatus,
    scheduleStatus,
    sourcePaths: {
      groups: 'state.deliverablesByCycleId[activeCycleId].deliverables',
      groupCountMetric: 'deliverable.requiredBlocks (abstract required work sessions)',
      proposedBlocks:
        'getCanonicalProposedBlocks(state.proposedBlocks, state.suggestedBlocks) -> status==="suggested" scoped by active cycle/goal',
      scheduleStatus:
        'derived from autoAsanaPlan.summary.planStatus + scheduleLifecycle + proposedBlockCount + reviewBlockCount + committed executionEvents + lastPlanError',
    },
  };
}

export function getStructureSchedulingLabels(summary) {
  const groupSectionLabel = summary?.displayedGroupType === 'phase' ? 'Plan Sections' : 'Deliverable Outputs';
  const groupEffortUnitLabel = 'required work sessions';
  const proposedCountLabel =
    Number(summary?.proposedBlockCount) > 0 ? `${summary.proposedBlockCount} proposed calendar blocks` : null;
  const scheduleStatusLabel =
    summary?.scheduleStatus === 'draft_schedule_ready'
      ? 'Schedule draft ready.'
      : summary?.scheduleStatus === 'horizon_insufficient'
        ? `Schedule draft is partial: ${Number(summary?.scheduledBlockCount || 0)}/${Number(summary?.requiredBlockCount || 0)} blocks fit in the current horizon.`
      : summary?.scheduleStatus === 'applied_review'
        ? 'Schedule applied for review.'
        : summary?.scheduleStatus === 'active_schedule'
          ? 'Schedule active.'
          : summary?.scheduleStatus === 'stale_draft_invalidated'
            ? 'Draft invalidated by new generation.'
            : summary?.scheduleStatus === 'no_schedule'
              ? 'No schedule proposal yet. Go to Today tab to generate.'
              : null;

  return {
    groupSectionLabel,
    groupEffortUnitLabel,
    proposedCountLabel,
    scheduleStatusLabel,
  };
}
