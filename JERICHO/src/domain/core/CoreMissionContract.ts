/**
 * CoreMissionContract: The durable multi-year mission above changing plans
 *
 * Problem: A five-year plan is not a static schedule. It is the current execution phase
 * of a longer durable mission. The system needs to understand that plan changes do not
 * mean goal changes—they mean route corrections toward the same objective.
 *
 * Doctrine:
 * - Core goal is more durable than campaigns
 * - Campaigns are more durable than cycles
 * - Cycles are more durable than blocks
 * - Entropy is expected; correction preserves continuity
 *
 * Hierarchy:
 * 1. Core Goal (most durable)
 * 2. Strategic Thesis (how we get there)
 * 3. Active Campaigns (current routes)
 * 4. Execution Cycles (time-bounded attacks)
 * 5. Blocks (individual tasks/weeks)
 *
 * Key insight: Protect the core. Question the thesis. Adjust the campaign. Rewrite the cycle. Move the block.
 */

export interface EntropyEvent {
  /** Timestamp when entropy was observed */
  timestamp: string; // ISO date string

  /** Category of entropy: job-loss, money-pressure, relocation, technical-delay, bad-partners, fatigue, etc */
  category: string;

  /** Description of what happened */
  description: string;

  /** Which campaigns/cycles were affected */
  impactedCampaignIds: string[];

  /** What adjustment was made in response */
  correctionApplied: string;

  /** Whether core mission continuity was maintained */
  continuityPreserved: boolean;
}

export interface CampaignReference {
  /** Unique campaign ID */
  id: string;

  /** Campaign name (e.g., "Album campaign", "Jericho app campaign") */
  name: string;

  /** What this campaign contributes to the core objective */
  contributionDescription: string;

  /** Current status: active|paused|merged|killed */
  status: 'active' | 'paused' | 'merged' | 'killed';

  /** When this campaign started */
  startedAt?: string; // ISO date string

  /** When this campaign ended or was paused */
  endedAt?: string; // ISO date string
}

export interface RevisionEvent {
  /** When the mission contract was revised */
  timestamp: string; // ISO date string

  /** Type of change: objective-update|thesis-refinement|campaign-adjustment|tradeoff-decision */
  revisionType: 'objective-update' | 'thesis-refinement' | 'campaign-adjustment' | 'tradeoff-decision';

  /** What changed */
  description: string;

  /** Why the change was necessary */
  rationale: string;

  /** What stayed constant through this change */
  continuousElements: string[];

  /** JSON diff or reference to previous state */
  previousState?: string;
}

export interface ContinuitySignal {
  /** Signal name: revenue-growth, ownership-expansion, brand-legitimacy, etc */
  name: string;

  /** How to measure this signal */
  measurementApproach: string;

  /** Target value or direction */
  target?: string;

  /** Current observed state */
  currentState?: string;
}

export interface DerailmentSignal {
  /** Signal name: mission-abandonment, founders-fatigue, core-contradiction, etc */
  name: string;

  /** Description of what would trigger this signal */
  triggerCondition: string;

  /** Current severity: none|low|medium|high|critical */
  currentSeverity: 'none' | 'low' | 'medium' | 'high' | 'critical';

  /** Recommended action if triggered */
  mitigationAction?: string;
}

export type CoreContinuityStatus = 'aligned' | 'strained' | 'drifting' | 'endangered';

export interface CoreMissionContract {
  /** Unique mission ID */
  missionId: string;

  /** Associated profile/user ID */
  profileId: string;

  /** Creation timestamp */
  createdAt: string; // ISO date string

  /** Last update timestamp */
  updatedAt: string; // ISO date string

  /**
   * CORE OBJECTIVE
   * The durable goal that does not change easily
   *
   * Example:
   * "Scale the company through talent, systems, creative output, and disciplined execution."
   */
  durableObjective: string;

  /**
   * MAGNITUDE TARGET
   * Long-horizon numerical target (e.g., "3.5B outcome")
   * This is the scale aspiration for the durable objective
   */
  magnitudeTarget?: string;

  /**
   * HORIZON IN YEARS
   * How many years does this durable objective span?
   * (e.g., 10 for a decade-long mission)
   */
  horizonYears: number;

  /**
   * CURRENT PHASE
   * Where are we in the long-term mission?
   * (e.g., "Second half of original 10-year arc / next five-year execution phase")
   */
  currentPhase: string;

  /**
   * STRATEGIC THESIS
   * The theory for how the core goal becomes real
   *
   * Example:
   * "Use talent, creative output, software, media, brand-building, project-management capability,
   *  and execution infrastructure to compound legitimacy, audience, revenue, and ownership."
   *
   * Can evolve, but should not change every week
   */
  strategicThesis: string;

  /**
   * NON-NEGOTIABLES
   * Values/commitments that cannot be traded away
   * (e.g., "ownership", "creative control", "execution discipline", "company-building")
   */
  nonNegotiables: string[];

  /**
   * ALLOWED TRADEOFFS
   * What can flex when entropy hits
   * (e.g., "route changes", "campaign changes", "timing adjustments", "scope reduction", "tactical pivots")
   */
  allowedTradeoffs: string[];

  /**
   * FORBIDDEN TRADEOFFS
   * Lines that must never be crossed
   * (e.g., "abandoning the company vision", "confusing income security with the mission")
   */
  forbiddenTradeoffs: string[];

  /**
   * ACTIVE CAMPAIGNS
   * Current routes being pursued
   * These can be added, paused, merged, or killed without killing the core goal
   *
   * Examples:
   * - Album/label campaign
   * - Jericho app campaign
   * - Podcast campaign
   * - PM brand campaign
   * - Income/runway campaign
   * - Job-search/security campaign
   */
  activeCampaignIds: string[];

  /**
   * CAMPAIGN REGISTRY
   * Full details of campaigns referenced in activeCampaignIds
   */
  campaignRegistry: CampaignReference[];

  /**
   * CONTINUITY SIGNALS
   * Metrics that indicate the user is still moving toward the durable objective
   * More important than "did every task get done?"
   */
  continuitySignals: ContinuitySignal[];

  /**
   * DERAILMENT SIGNALS
   * Warnings that the core mission may be endangered
   * (e.g., "mission abandonment", "core contradiction", "founder fatigue")
   */
  derailmentSignals: DerailmentSignal[];

  /**
   * ENTROPY EVENTS
   * Log of challenges that forced route corrections
   * (job loss, money pressure, relocation, technical delay, platform friction, etc)
   *
   * This shows that the mission survived entropy by adapting the route
   */
  entropyEvents: EntropyEvent[];

  /**
   * REVISION HISTORY
   * Record of changes to this contract
   * Explains why the route changed and what stayed constant
   */
  revisionHistory: RevisionEvent[];

  /**
   * CORE CONTINUITY STATUS
   * Assessment of whether the user is still aligned with the durable objective
   *
   * - aligned: On course toward the durable objective
   * - strained: Facing entropy but still pursuing mission
   * - drifting: Significant deviation from core thesis
   * - endangered: Risk of mission abandonment
   */
  continuityStatus: CoreContinuityStatus;

  /**
   * CONTINUITY STATUS RATIONALE
   * Explanation of current continuity status
   */
  continuityStatusRationale?: string;

  /** Associated master plan IDs (can be multiple if multi-phase) */
  masterPlanIds: string[];
}

/**
 * CoreMissionContractValidation
 * Ensures the contract is coherent and non-contradictory
 */
export function validateCoreMissionContract(contract: CoreMissionContract): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!contract.missionId || contract.missionId.trim().length === 0) {
    errors.push('missionId is required');
  }

  if (!contract.profileId || contract.profileId.trim().length === 0) {
    errors.push('profileId is required');
  }

  if (!contract.durableObjective || contract.durableObjective.trim().length === 0) {
    errors.push('durableObjective is required');
  }

  if (contract.horizonYears <= 0) {
    errors.push('horizonYears must be greater than 0');
  }

  if (!contract.strategicThesis || contract.strategicThesis.trim().length === 0) {
    errors.push('strategicThesis is required');
  }

  if (!Array.isArray(contract.nonNegotiables) || contract.nonNegotiables.length === 0) {
    errors.push('nonNegotiables array must have at least one entry');
  }

  if (!Array.isArray(contract.allowedTradeoffs) || contract.allowedTradeoffs.length === 0) {
    errors.push('allowedTradeoffs array must have at least one entry');
  }

  if (!Array.isArray(contract.forbiddenTradeoffs) || contract.forbiddenTradeoffs.length === 0) {
    errors.push('forbiddenTradeoffs array must have at least one entry');
  }

  // Check for contradiction: a tradeoff cannot be both allowed and forbidden
  const allowedSet = new Set(contract.allowedTradeoffs.map(t => t.toLowerCase()));
  const forbiddenSet = new Set(contract.forbiddenTradeoffs.map(t => t.toLowerCase()));
  const conflicts = Array.from(allowedSet).filter(t => forbiddenSet.has(t));
  if (conflicts.length > 0) {
    errors.push(`Tradeoff contradiction: "${conflicts.join(', ')}" appears in both allowed and forbidden`);
  }

  if (!contract.continuityStatus) {
    errors.push('continuityStatus is required');
  }

  if (!Array.isArray(contract.masterPlanIds) || contract.masterPlanIds.length === 0) {
    errors.push('masterPlanIds must reference at least one master plan');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Utility: Assess continuity status based on signals and entropy
 */
export function assessContinuityStatus(contract: CoreMissionContract): CoreContinuityStatus {
  // Count derailment signals by severity
  const criticalCount = contract.derailmentSignals.filter(s => s.currentSeverity === 'critical').length;
  const highCount = contract.derailmentSignals.filter(s => s.currentSeverity === 'high').length;
  const mediumCount = contract.derailmentSignals.filter(s => s.currentSeverity === 'medium').length;

  // If critical derailment signals exist, mission is endangered
  if (criticalCount > 0) {
    return 'endangered';
  }

  // If multiple high-severity signals, mission is drifting
  if (highCount >= 2) {
    return 'drifting';
  }

  // If recent entropy events without clear correction, mission is strained
  const recentEntropy = contract.entropyEvents.filter(e => {
    const eventDate = new Date(e.timestamp);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return eventDate > thirtyDaysAgo && !e.continuityPreserved;
  });

  if (recentEntropy.length > 0) {
    return 'strained';
  }

  // Default to aligned if no major signals
  return 'aligned';
}
