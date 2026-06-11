export type OperatingLifecycleState =
  | 'SIGNED_OUT'
  | 'PROFILE_REQUIRED'
  | 'GOAL_REQUIRED'
  | 'SCHEDULE_REQUIRED'
  | 'SCHEDULE_GENERATED'
  | 'PLAN_REVIEW_REQUIRED'
  | 'READY_TO_ACTIVATE'
  | 'ACTIVE_EXECUTION'
  | 'COURSE_CORRECTION_REQUIRED'
  | 'REASSESSMENT_PENDING'
  | 'REASSESSMENT_ACCEPTED'
  | 'REGENERATION_REQUIRED';

export type OperatingLifecycleAudit = 'PASS' | 'FAIL' | 'UNKNOWN';

export type OperatingLifecycleReadinessSummary = {
  profile?: string;
  goal?: string;
  schedule?: string;
  phase?: string;
  today?: string;
  planQuality?: OperatingLifecycleAudit;
  dependencyAudit?: OperatingLifecycleAudit;
  ownerCoverage?: OperatingLifecycleAudit;
  gateIntegrity?: OperatingLifecycleAudit;
  exportStatus?: string;
  firstExecutableDate?: string;
  blockCount?: number;
};

export type OperatingLifecycleResolution = {
  state: OperatingLifecycleState;
  label: string;
  reason: string;
  nextAction: string;
  blockingIssues: string[];
  readinessSummary: OperatingLifecycleReadinessSummary;
};

type ProfileRecord = {
  id?: string | null;
  activeGoalId?: string | null;
  masterCalendarId?: string | null;
  activeMasterPlanId?: string | null;
};

type GoalRecord = {
  id?: string | null;
  activeCycleId?: string | null;
};

type CycleRecord = {
  id?: string | null;
  scheduleLifecycle?: string | null;
  reassessmentStatus?: string | null;
  startedAtDayKey?: string | null;
  goalContract?: {
    startDayKey?: string | null;
    phaseId?: string | null;
    phaseLabel?: string | null;
  } | null;
  proposedBlocks?: unknown[] | null;
  scheduleReviewBlocks?: unknown[] | null;
  executionEvents?: unknown[] | null;
  planQualityGate?: PlanQualityGateLike | null;
};

type PlanQualityGateLike = {
  passed?: boolean | null;
  status?: string | null;
  failureCodes?: string[] | null;
  reasonCodes?: string[] | null;
  dependencyAudit?: unknown;
  ownerCoverage?: unknown;
  gateIntegrity?: unknown;
  firstExecutableDate?: string | null;
  blockCount?: number | null;
};

type ExecutionCorrectionLike = {
  correctionState?: string | null;
  recommendedActions?: string[] | null;
  reasonCodes?: string[] | null;
};

export type OperatingLifecycleInput = {
  authenticatedUser?: unknown;
  isAuthenticated?: boolean | null;
  activeProfileId?: string | null;
  activeGoalId?: string | null;
  activeCycleId?: string | null;
  profilesById?: Record<string, ProfileRecord | undefined> | null;
  goalsById?: Record<string, GoalRecord | undefined> | null;
  cyclesById?: Record<string, CycleRecord | undefined> | null;
  profileAccess?: {
    status?: string | null;
    selectedProfileId?: string | null;
  } | null;
  scheduleLifecycleState?: string | null;
  planQualityGate?: PlanQualityGateLike | null;
  executionCorrection?: ExecutionCorrectionLike | null;
  planReviewRequired?: boolean | null;
  pendingPlanConfirmation?: boolean | null;
  regenerationRequired?: boolean | null;
  todayBlocks?: unknown[] | null;
  activeTodayBlockCount?: number | null;
  readinessSummary?: Partial<OperatingLifecycleReadinessSummary> | null;
};

type ResolutionDescriptor = Omit<OperatingLifecycleResolution, 'readinessSummary'>;

const STATE_DESCRIPTORS: Record<OperatingLifecycleState, ResolutionDescriptor> = {
  SIGNED_OUT: {
    state: 'SIGNED_OUT',
    label: 'Sign In Required',
    reason: 'Jericho cannot restore product context until an authenticated account is present.',
    nextAction: 'Sign in or create/link an account.',
    blockingIssues: ['AUTH_REQUIRED'],
  },
  PROFILE_REQUIRED: {
    state: 'PROFILE_REQUIRED',
    label: 'Profile Required',
    reason: 'The account is present, but the active product profile is missing or incoherent.',
    nextAction: 'Select or restore the correct profile before continuing.',
    blockingIssues: ['PROFILE_CONTEXT_MISSING'],
  },
  GOAL_REQUIRED: {
    state: 'GOAL_REQUIRED',
    label: 'Goal Required',
    reason: 'A profile is active, but no admitted goal is driving the operating loop.',
    nextAction: 'Admit or select the active goal.',
    blockingIssues: ['ACTIVE_GOAL_REQUIRED'],
  },
  SCHEDULE_REQUIRED: {
    state: 'SCHEDULE_REQUIRED',
    label: 'Schedule Required',
    reason: 'The active goal does not yet have a generated Sprint schedule.',
    nextAction: 'Generate the first Sprint.',
    blockingIssues: ['GENERATED_SCHEDULE_MISSING'],
  },
  SCHEDULE_GENERATED: {
    state: 'SCHEDULE_GENERATED',
    label: 'Schedule Generated',
    reason: 'A Sprint draft exists, but it has not yet been moved through the explicit review flow.',
    nextAction: 'Inspect the generated Sprint and decide whether to review or revise it.',
    blockingIssues: ['SCHEDULE_DRAFT_UNCONFIRMED'],
  },
  PLAN_REVIEW_REQUIRED: {
    state: 'PLAN_REVIEW_REQUIRED',
    label: 'Plan Review Required',
    reason: 'A generated Sprint exists, but review or repair is still required before activation.',
    nextAction: 'Review the plan quality, Sprint fit, and activation readiness.',
    blockingIssues: ['PLAN_REVIEW_REQUIRED'],
  },
  READY_TO_ACTIVATE: {
    state: 'READY_TO_ACTIVATE',
    label: 'Ready To Activate',
    reason: 'The Sprint has passed review and can be promoted into the Activated Plan.',
    nextAction: 'Activate the plan.',
    blockingIssues: [],
  },
  ACTIVE_EXECUTION: {
    state: 'ACTIVE_EXECUTION',
    label: 'Active Execution',
    reason: 'The operating loop has an Activated Plan and can be executed from Today.',
    nextAction: 'Work the current Activated Plan and log execution evidence.',
    blockingIssues: [],
  },
  COURSE_CORRECTION_REQUIRED: {
    state: 'COURSE_CORRECTION_REQUIRED',
    label: 'Course Correction Required',
    reason: 'Live execution evidence shows enough missed, blocked, or degraded work to require intervention.',
    nextAction: 'Review the correction signal and adjust the plan or dependencies.',
    blockingIssues: ['COURSE_CORRECTION_REQUIRED'],
  },
  REASSESSMENT_PENDING: {
    state: 'REASSESSMENT_PENDING',
    label: 'Reassessment Pending',
    reason: 'Current-state reassessment is required before Jericho can generate the next valid Sprint.',
    nextAction: 'Accept the reassessment prompt to refresh the operating cycle state.',
    blockingIssues: ['REASSESSMENT_REQUIRED'],
  },
  REASSESSMENT_ACCEPTED: {
    state: 'REASSESSMENT_ACCEPTED',
    label: 'Reassessment Accepted',
    reason: 'The reassessment has been accepted and the product is ready for the next planning step.',
    nextAction: 'Regenerate the Sprint from the accepted current state.',
    blockingIssues: [],
  },
  REGENERATION_REQUIRED: {
    state: 'REGENERATION_REQUIRED',
    label: 'Regeneration Required',
    reason: 'The previous Sprint is stale or invalid for the current state and must be regenerated.',
    nextAction: 'Generate a fresh Sprint from the current reassessed state.',
    blockingIssues: ['REGENERATION_REQUIRED'],
  },
};

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeAuditStatus(value: unknown): OperatingLifecycleAudit {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === 'PASS') return 'PASS';
  if (normalized === 'FAIL') return 'FAIL';
  return 'UNKNOWN';
}

function hasPlanQualityFailures(gate: PlanQualityGateLike | null | undefined): boolean {
  if (!gate) return false;
  if (gate.passed === false) return true;
  const status = normalizeText(gate.status).toLowerCase();
  if (status === 'fail' || status === 'failed') return true;
  return Array.isArray(gate.failureCodes) && gate.failureCodes.length > 0;
}

function resolvePlanQualityStatus(gate: PlanQualityGateLike | null | undefined): OperatingLifecycleAudit {
  if (!gate) return 'UNKNOWN';
  if (gate.passed === true) return 'PASS';
  if (hasPlanQualityFailures(gate)) return 'FAIL';
  return 'UNKNOWN';
}

function resolveAuditFromGate(
  explicitValue: unknown,
  gateValue: unknown
): OperatingLifecycleAudit {
  const explicit = normalizeAuditStatus(explicitValue);
  if (explicit !== 'UNKNOWN') return explicit;
  if (gateValue && typeof gateValue === 'object') {
    const status = normalizeAuditStatus((gateValue as { status?: unknown }).status);
    if (status !== 'UNKNOWN') return status;
    const passed = (gateValue as { passed?: unknown }).passed;
    if (passed === true) return 'PASS';
    if (passed === false) return 'FAIL';
  }
  return normalizeAuditStatus(gateValue);
}

function resolveActiveRecords(input: OperatingLifecycleInput) {
  const activeProfileId = normalizeText(input.activeProfileId);
  const activeProfile = activeProfileId ? input.profilesById?.[activeProfileId] || null : null;
  const activeGoalId = normalizeText(input.activeGoalId || activeProfile?.activeGoalId);
  const activeGoal = activeGoalId ? input.goalsById?.[activeGoalId] || null : null;
  const activeCycleId = normalizeText(input.activeCycleId || activeGoal?.activeCycleId);
  const activeCycle = activeCycleId ? input.cyclesById?.[activeCycleId] || null : null;

  return { activeProfileId, activeProfile, activeGoalId, activeGoal, activeCycleId, activeCycle };
}

function resolveProfileCoherence(
  input: OperatingLifecycleInput,
  activeProfileId: string,
  activeProfile: ProfileRecord | null
) {
  const issues: string[] = [];
  if (!activeProfileId) {
    issues.push('ACTIVE_PROFILE_MISSING');
  }
  if (!activeProfile) {
    issues.push('ACTIVE_PROFILE_RECORD_MISSING');
  }

  const accessStatus = normalizeText(input.profileAccess?.status).toLowerCase();
  const selectedProfileId = normalizeText(input.profileAccess?.selectedProfileId);
  if (input.profileAccess) {
    if (accessStatus !== 'profile_selected') {
      issues.push('PROFILE_NOT_SELECTED');
    }
    if (selectedProfileId && activeProfileId && selectedProfileId !== activeProfileId) {
      issues.push('PROFILE_SELECTION_MISMATCH');
    }
  }

  return {
    coherent: issues.length === 0,
    issues,
  };
}

function resolveScheduleLifecycle(input: OperatingLifecycleInput, activeCycle: CycleRecord | null): string {
  const explicit = normalizeText(input.scheduleLifecycleState).toLowerCase();
  if (explicit) return explicit;

  const cycleLifecycle = normalizeText(activeCycle?.scheduleLifecycle).toLowerCase();
  if (cycleLifecycle === 'active_schedule') return 'in_execution';
  if (cycleLifecycle === 'applied_review') return 'schedule_applied';
  if (cycleLifecycle === 'draft_schedule_ready') return 'schedule_preview_ready';
  if (cycleLifecycle === 'reschedule_pending') return 'reschedule_pending';
  if (cycleLifecycle === 'stale_draft_invalidated') return 'stale_draft_invalidated';

  const proposedBlockCount = Array.isArray(activeCycle?.proposedBlocks) ? activeCycle.proposedBlocks.length : 0;
  if (proposedBlockCount > 0) return 'schedule_preview_ready';

  return activeCycle ? 'inter_cycle' : 'no_goal';
}

function resolveReadinessSummary(
  input: OperatingLifecycleInput,
  activeProfile: ProfileRecord | null,
  activeGoalId: string,
  activeCycle: CycleRecord | null,
  gate: PlanQualityGateLike | null
): OperatingLifecycleReadinessSummary {
  const explicit = input.readinessSummary || {};
  const todayBlockCount =
    Number.isFinite(input.activeTodayBlockCount) && input.activeTodayBlockCount !== null
      ? Number(input.activeTodayBlockCount)
      : Array.isArray(input.todayBlocks)
        ? input.todayBlocks.length
        : null;
  const proposedBlockCount = Array.isArray(activeCycle?.proposedBlocks) ? activeCycle.proposedBlocks.length : 0;
  const reviewBlockCount = Array.isArray(activeCycle?.scheduleReviewBlocks) ? activeCycle.scheduleReviewBlocks.length : 0;
  const blockCountCandidate = proposedBlockCount > 0 ? proposedBlockCount : reviewBlockCount > 0 ? reviewBlockCount : null;

  return {
    profile: explicit.profile || (activeProfile ? 'READY' : 'MISSING'),
    goal: explicit.goal || (activeGoalId ? 'READY' : 'MISSING'),
    schedule: explicit.schedule || (activeCycle ? 'PRESENT' : 'MISSING'),
    phase:
      explicit.phase ||
      normalizeText(activeCycle?.goalContract?.phaseLabel) ||
      normalizeText(activeCycle?.goalContract?.phaseId) ||
      undefined,
    today:
      explicit.today ||
      (todayBlockCount === null ? undefined : todayBlockCount > 0 ? 'WORK_PRESENT' : 'NO_WORK_TODAY'),
    planQuality: explicit.planQuality || resolvePlanQualityStatus(gate),
    dependencyAudit: resolveAuditFromGate(explicit.dependencyAudit, gate?.dependencyAudit),
    ownerCoverage: resolveAuditFromGate(explicit.ownerCoverage, gate?.ownerCoverage),
    gateIntegrity: resolveAuditFromGate(explicit.gateIntegrity, gate?.gateIntegrity),
    firstExecutableDate:
      explicit.firstExecutableDate ||
      normalizeText(gate?.firstExecutableDate) ||
      normalizeText(activeCycle?.goalContract?.startDayKey) ||
      normalizeText(activeCycle?.startedAtDayKey) ||
      undefined,
    blockCount:
      explicit.blockCount ??
      gate?.blockCount ??
      blockCountCandidate ??
      undefined,
  };
}

function buildResolution(
  state: OperatingLifecycleState,
  readinessSummary: OperatingLifecycleReadinessSummary,
  extraBlockingIssues: string[] = []
): OperatingLifecycleResolution {
  const descriptor = STATE_DESCRIPTORS[state];
  const blockingIssues = Array.from(new Set([...descriptor.blockingIssues, ...extraBlockingIssues]));
  return {
    ...descriptor,
    blockingIssues,
    readinessSummary,
  };
}

export function resolveOperatingLifecycleState(input: OperatingLifecycleInput): OperatingLifecycleResolution {
  const authenticated = input.isAuthenticated ?? Boolean(input.authenticatedUser);
  if (!authenticated) {
    return buildResolution('SIGNED_OUT', resolveReadinessSummary(input, null, '', null, null));
  }

  const { activeProfileId, activeProfile, activeGoalId, activeCycle } = resolveActiveRecords(input);
  const profileCoherence = resolveProfileCoherence(input, activeProfileId, activeProfile);
  const gate = input.planQualityGate || activeCycle?.planQualityGate || null;
  const readinessSummary = resolveReadinessSummary(input, activeProfile, activeGoalId, activeCycle, gate);

  if (!profileCoherence.coherent) {
    return buildResolution('PROFILE_REQUIRED', readinessSummary, profileCoherence.issues);
  }

  if (!activeGoalId) {
    return buildResolution('GOAL_REQUIRED', readinessSummary);
  }

  const reassessmentStatus = normalizeText(activeCycle?.reassessmentStatus).toLowerCase();
  const scheduleLifecycle = resolveScheduleLifecycle(input, activeCycle);
  const correctionState = normalizeText(input.executionCorrection?.correctionState).toLowerCase();
  const planReviewRequired = Boolean(input.planReviewRequired || input.pendingPlanConfirmation);
  const regenerationRequired =
    Boolean(input.regenerationRequired) ||
    scheduleLifecycle === 'reschedule_pending' ||
    scheduleLifecycle === 'stale_draft_invalidated';

  if (regenerationRequired && reassessmentStatus === 'complete') {
    return buildResolution('REGENERATION_REQUIRED', readinessSummary, ['REASSESSMENT_ACCEPTED']);
  }
  if (regenerationRequired) {
    return buildResolution('REGENERATION_REQUIRED', readinessSummary);
  }
  if (reassessmentStatus === 'complete') {
    return buildResolution('REASSESSMENT_ACCEPTED', readinessSummary);
  }
  if (reassessmentStatus === 'required') {
    return buildResolution('REASSESSMENT_PENDING', readinessSummary);
  }
  if (correctionState === 'adjustment_recommended' || correctionState === 'recovery_required') {
    return buildResolution(
      'COURSE_CORRECTION_REQUIRED',
      readinessSummary,
      Array.isArray(input.executionCorrection?.reasonCodes) ? input.executionCorrection?.reasonCodes || [] : []
    );
  }

  if (scheduleLifecycle === 'no_goal' || scheduleLifecycle === 'goal_admitted' || scheduleLifecycle === 'inter_cycle') {
    return buildResolution('SCHEDULE_REQUIRED', readinessSummary);
  }
  if (scheduleLifecycle === 'schedule_preview_ready') {
    if (planReviewRequired || hasPlanQualityFailures(gate)) {
      return buildResolution('PLAN_REVIEW_REQUIRED', readinessSummary);
    }
    return buildResolution('SCHEDULE_GENERATED', readinessSummary);
  }
  if (scheduleLifecycle === 'schedule_applied') {
    if (hasPlanQualityFailures(gate)) {
      return buildResolution('PLAN_REVIEW_REQUIRED', readinessSummary, ['PLAN_QUALITY_GATE_FAILED']);
    }
    return buildResolution('READY_TO_ACTIVATE', readinessSummary);
  }
  if (scheduleLifecycle === 'activated' || scheduleLifecycle === 'in_execution') {
    return buildResolution('ACTIVE_EXECUTION', readinessSummary);
  }

  return buildResolution('SCHEDULE_REQUIRED', readinessSummary);
}

export default resolveOperatingLifecycleState;
