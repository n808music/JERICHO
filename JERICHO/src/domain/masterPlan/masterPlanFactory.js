import {
  MASTER_PLAN_STATUS,
  LANE_ACTIVATION_STATE,
  LANE_ASSESSED_CONFIDENCE,
  MILESTONE_TYPE,
  MILESTONE_FLEX,
  MILESTONE_STATUS,
  REQUIREMENT_STATUS,
  validateMasterPlanInputs,
} from './masterPlanSchema.js';

function generateId() {
  return crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function prefixedId(prefix) {
  return `${prefix}-${generateId()}`;
}

// ─── Anchor ──────────────────────────────────────────────────────────────────

export function buildAnchor({ date, label, isFixed = true, affectedLaneIds = [], priority = 0 } = {}) {
  if (!date) {
    throw new Error('ANCHOR_INVALID: date is required');
  }
  if (!label) {
    throw new Error('ANCHOR_INVALID: label is required');
  }
  return {
    id: prefixedId('anchor'),
    date,
    label,
    isFixed,
    affectedLaneIds,
    priority,
  };
}

// ─── Requirement ─────────────────────────────────────────────────────────────

export function buildRequirement({
  description,
  requirementType,
  scheduledAction = null,
  completionQuestion,
  blocksProgress,
} = {}) {
  if (!description) {
    throw new Error('REQUIREMENT_INVALID: description is required');
  }
  if (!requirementType) {
    throw new Error('REQUIREMENT_INVALID: requirementType is required');
  }
  if (!completionQuestion) {
    throw new Error('REQUIREMENT_INVALID: completionQuestion is required');
  }

  const isLegal = requirementType === 'legal';
  return {
    id: prefixedId('req'),
    description,
    requirementType,
    scheduledAction: scheduledAction || null,
    completionQuestion,
    status: REQUIREMENT_STATUS.SCHEDULED,
    // Legal requirements always block. Standard requirements never block.
    blocksProgress: isLegal ? true : Boolean(blocksProgress),
  };
}

// ─── Milestone ───────────────────────────────────────────────────────────────

/**
 * Builds a milestone. targetDate must be derived backward from an anchor —
 * the caller owns the arithmetic; derivedFrom is the audit trail string.
 *
 * derivedFrom format: "anchorId:<id> - <offset>" e.g. "anchorId:oct17 - 6 weeks"
 */
export function buildMilestone({
  laneId,
  anchorId = null,
  title,
  description = '',
  milestoneType = MILESTONE_TYPE.CHECKPOINT,
  targetDate,
  derivedFrom,
  flex = MILESTONE_FLEX.LOW,
  requirementIds = [],
  missConsequence = '',
  origin = null,
  userWeight = null,
} = {}) {
  if (!laneId) {
    throw new Error('MILESTONE_INVALID: laneId is required');
  }
  if (!title) {
    throw new Error('MILESTONE_INVALID: title is required');
  }
  if (!targetDate) {
    throw new Error('MILESTONE_INVALID: targetDate is required — milestones must derive from an anchor');
  }
  if (!derivedFrom) {
    throw new Error('MILESTONE_INVALID: derivedFrom is required — system must explain placement');
  }
  // CRITICAL: origin must be explicitly set to avoid silently treating user-created milestones
  // as auto-generated (which would cause them to be excluded from pacing doctrine).
  // This validation ensures callers are explicit about milestone provenance.
  if (!origin || !['system', 'user'].includes(origin)) {
    throw new Error(`MILESTONE_INVALID: origin must be 'system' or 'user', got: ${origin}`);
  }

  return {
    id: prefixedId('milestone'),
    laneId,
    anchorId,
    title,
    description,
    milestoneType,
    targetDate,
    derivedFrom,
    flex,
    status: MILESTONE_STATUS.PENDING,
    requirementIds,
    missConsequence,
    origin,
    userWeight: origin === 'user' ? (userWeight || null) : null,
    // generated: true if origin is 'system' (auto-generated via generateMilestonesForLane)
    // generated: false if origin is 'user' or other (manually created)
    // Used to distinguish real commitments from system-generated entries in pacing analysis
    generated: origin === 'system',
  };
}

// ─── Lane ────────────────────────────────────────────────────────────────────

export function buildLane({
  masterPlanId,
  title,
  domain,
  role,
  activationState = LANE_ACTIVATION_STATE.INCUBATING,
  userDescription = '',
  assessedStage = '',
  assessedConfidence = LANE_ASSESSED_CONFIDENCE.LOW,
  assessmentNotes = '',
  anchorIds = [],
  capitalRequired = false,
  legalRequired = false,
  dependsOnLaneIds = [],
  laneStart = null,
  laneEnd = null,
  requirements = [],
} = {}) {
  if (!masterPlanId) {
    throw new Error('LANE_INVALID: masterPlanId is required');
  }
  if (!title) {
    throw new Error('LANE_INVALID: title is required');
  }
  if (!domain) {
    throw new Error('LANE_INVALID: domain is required');
  }
  if (!role) {
    throw new Error('LANE_INVALID: role is required');
  }

  return {
    id: prefixedId('lane'),
    masterPlanId,
    title,
    domain,
    role,
    activationState,
    userDescription,
    assessedStage,
    assessedConfidence,
    assessmentNotes,
    anchorIds,
    capitalRequired,
    legalRequired,
    dependsOnLaneIds,
    laneStart,
    laneEnd,
    requirements,
    milestoneIds: [],
    // Derived downstream once milestones and dependencies are known
    priorityScore: 0,
  };
}

// ─── Master Plan ─────────────────────────────────────────────────────────────

/**
 * Creates a blank master plan from intake answers.
 * anchors must be non-empty OR horizonEnd must be set — validated before any
 * milestone placement can occur (milestones are always worked backward from a
 * fixed point; forward-from-today placement is not supported).
 */
export function buildMasterPlan({
  profileId,
  title,
  northStarOutcome,
  coreMission = '',
  outcomeTarget = '',
  successStandard = '',
  masterPlanSummary = '',
  executionHorizon = '',
  controllableSuccessSignals = [],
  externallyMediatedTargets = [],
  controllabilityClass = 'controllable',
  terminalTargetClass = 'controllable',
  goalArchitecture = 'single_lane_goal',
  executionModel = 'single_track',
  primaryLane = null,
  supportingLanes = [],
  laneComposition = [],
  laneClassificationConfidence = 'low',
  classificationSource = 'fallback',
  horizonStart,
  horizonEnd = null,
  declaredHorizonMonths = null,
  anchors = [],
  financialConstraint = null,
  coreMissionContractId = null,
  officialStartDate = null,
  status = MASTER_PLAN_STATUS.DRAFT,
  nowISO = null,
} = {}) {
  if (!profileId) {
    throw new Error('MASTER_PLAN_INVALID: profileId is required');
  }
  if (!title) {
    throw new Error('MASTER_PLAN_INVALID: title is required');
  }
  if (!northStarOutcome) {
    throw new Error('MASTER_PLAN_INVALID: northStarOutcome is required');
  }

  validateMasterPlanInputs({ anchors, horizonEnd });

  const createdAt = nowISO || new Date().toISOString();

  const builtAnchors = anchors.map((a) => (a.id ? a : buildAnchor(a)));

  return {
    id: prefixedId('masterplan'),
    profileId,
    title,
    status,
    createdAt,
    updatedAt: createdAt,

    horizonStart: horizonStart || null,
    horizonEnd: horizonEnd || null,
    fullHorizonEndDayKey: horizonEnd || null,
    // Months between horizonStart and horizonEnd as declared at intake time.
    // Used by the normalization pass in applyGoalPolicy so existing plans with a
    // truncated horizonEnd (e.g., form defaulted to 2 years despite 5-year intent)
    // are extended correctly even when the northStarOutcome text contains no explicit
    // year-count phrase.
    declaredHorizonMonths: Number.isFinite(Number(declaredHorizonMonths)) && Number(declaredHorizonMonths) > 0
      ? Math.round(Number(declaredHorizonMonths))
      : null,
    northStarOutcome,
    coreMission: coreMission || title,
    outcomeTarget: outcomeTarget || northStarOutcome,
    successStandard: successStandard || northStarOutcome,
    masterPlanSummary: masterPlanSummary || northStarOutcome,
    executionHorizon: executionHorizon || null,
    controllableSuccessSignals: Array.isArray(controllableSuccessSignals) ? [...controllableSuccessSignals] : [],
    externallyMediatedTargets: Array.isArray(externallyMediatedTargets) ? [...externallyMediatedTargets] : [],
    controllabilityClass,
    terminalTargetClass,
    goalArchitecture,
    executionModel,
    primaryLane,
    supportingLanes: Array.isArray(supportingLanes) ? [...supportingLanes] : [],
    laneComposition: Array.isArray(laneComposition) ? [...laneComposition] : [],
    laneClassificationConfidence,
    classificationSource,

    coreMissionContractId,

    // Start-date contract: these are distinct and must not be conflated.
    // officialStartDate — declared plan start (set at intake completion)
    // intakeCreatedAt   — when the intake was submitted (same as createdAt)
    // scheduleAppliedDate — set when the user first applies a schedule (null until then)
    officialStartDate: officialStartDate || horizonStart || null,
    intakeCreatedAt: createdAt,
    scheduleAppliedDate: null,

    anchors: builtAnchors,

    financialConstraint: financialConstraint
      ? {
          exists: Boolean(financialConstraint.exists),
          urgency: financialConstraint.urgency || null,
          notes: financialConstraint.notes || '',
        }
      : { exists: false, urgency: null, notes: '' },

    laneIds: [],
  };
}

// ─── Milestone backward-scheduling helper ────────────────────────────────────

/**
 * Derives a target date by stepping backward from an anchor date.
 * offsetWeeks is the number of weeks before the anchor.
 * Returns { targetDate: string, derivedFrom: string }.
 */
export function deriveTargetDateFromAnchor(anchorDate, offsetWeeks, anchorId) {
  const anchor = new Date(anchorDate);
  const target = new Date(anchor);
  target.setDate(target.getDate() - offsetWeeks * 7);
  const targetDate = target.toISOString().slice(0, 10);
  const derivedFrom = `anchorId:${anchorId} - ${offsetWeeks} week${offsetWeeks !== 1 ? 's' : ''}`;
  return { targetDate, derivedFrom };
}
