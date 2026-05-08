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
  origin = 'system',
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
  horizonStart,
  horizonEnd = null,
  anchors = [],
  financialConstraint = null,
  coreMissionContractId = null,
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
    northStarOutcome,

    coreMissionContractId,

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
