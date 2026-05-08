// Status enums
export const MASTER_PLAN_STATUS = /** @type {const} */ ({
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETE: 'complete',
  ARCHIVED: 'archived',
});

export const LANE_DOMAIN = /** @type {const} */ ({
  CREATIVE: 'creative',
  PRODUCT: 'product',
  BRAND: 'brand',
  INCOME: 'income',
  MEDIA: 'media',
});

export const LANE_ROLE = /** @type {const} */ ({
  PROOF_ARTIFACT: 'proof-artifact',
  ATTENTION_ENGINE: 'attention-engine',
  REVENUE_ENGINE: 'revenue-engine',
  LEGITIMACY_WRAPPER: 'legitimacy-wrapper',
  INFRASTRUCTURE: 'infrastructure',
  INSTITUTION: 'institution',
});

export const LANE_ACTIVATION_STATE = /** @type {const} */ ({
  ACTIVE: 'active',
  INCUBATING: 'incubating',
  PARKED: 'parked',
});

export const LANE_ASSESSED_CONFIDENCE = /** @type {const} */ ({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
});

export const MILESTONE_TYPE = /** @type {const} */ ({
  GATE: 'gate',          // blocks next milestone
  CHECKPOINT: 'checkpoint', // progress marker, doesn't block
  ANCHOR: 'anchor',      // terminus of the lane
});

export const MILESTONE_FLEX = /** @type {const} */ ({
  NONE: 'none',   // fixed — e.g. distribution processing time
  LOW: 'low',     // standard path, known window
  HIGH: 'high',   // user-driven, can compress or expand
});

export const MILESTONE_STATUS = /** @type {const} */ ({
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  COMPLETE: 'complete',
  AT_RISK: 'at-risk',
  MISSED: 'missed',
});

export const REQUIREMENT_TYPE = /** @type {const} */ ({
  // Blocks progression — non-negotiable
  LEGAL: 'legal',
  // Jericho schedules canonical action; accepts any completion without judgment
  STANDARD: 'standard',
});

export const REQUIREMENT_STATUS = /** @type {const} */ ({
  SCHEDULED: 'scheduled',
  COMPLETE: 'complete',
  BLOCKED: 'blocked',
});

export const FINANCIAL_URGENCY = /** @type {const} */ ({
  IMMEDIATE: 'immediate',
  NEAR_TERM: 'near-term',
  COMFORTABLE: 'comfortable',
  NOT_A_FACTOR: 'not-a-factor',
});

// Throws if the inputs cannot produce a valid master plan.
// Milestone placement requires at least one anchor OR a horizonEnd to derive from.
export function validateMasterPlanInputs(inputs) {
  const hasAnchors = Array.isArray(inputs.anchors) && inputs.anchors.length > 0;
  const hasHorizonEnd = Boolean(inputs.horizonEnd);
  if (!hasAnchors && !hasHorizonEnd) {
    throw new Error(
      'MASTER_PLAN_INVALID: An anchor date or horizonEnd is required before milestones can be placed. ' +
        'Milestones are always derived backward from a fixed point — there is no forward reference.'
    );
  }
}
