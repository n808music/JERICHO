/**
 * CoreMissionContractFactory: Create and manage CoreMissionContract instances
 *
 * Handles validation, initialization, and continuity assessment
 */

import {
  CoreMissionContract,
  CoreContinuityStatus,
  validateCoreMissionContract,
  assessContinuityStatus,
} from './CoreMissionContract';

/**
 * Factory for creating a new CoreMissionContract
 */
export function createCoreMissionContract(
  inputs: Omit<
    CoreMissionContract,
    'missionId' | 'createdAt' | 'updatedAt' | 'entropyEvents' | 'revisionHistory' | 'campaignRegistry' | 'continuityStatus'
  >
): CoreMissionContract {
  const now = new Date().toISOString();

  // Generate mission ID: mission-<uuid>
  const missionId = `mission-${generateUuid()}`;

  const contract: CoreMissionContract = {
    ...inputs,
    missionId,
    createdAt: now,
    updatedAt: now,
    entropyEvents: [],
    revisionHistory: [],
    campaignRegistry: inputs.activeCampaignIds.map(id => ({
      id,
      name: '',
      contributionDescription: '',
      status: 'active',
    })),
    continuityStatus: 'aligned',
  };

  // Assess continuity status based on actual signals provided at creation time
  contract.continuityStatus = assessContinuityStatus(contract);

  // Validate before returning
  const validation = validateCoreMissionContract(contract);
  if (!validation.valid) {
    throw new Error(`Invalid CoreMissionContract: ${validation.errors.join('; ')}`);
  }

  return contract;
}

/**
 * Record an entropy event and update continuity status
 */
export function recordEntropyEvent(
  contract: CoreMissionContract,
  event: {
    category: string;
    description: string;
    impactedCampaignIds: string[];
    correctionApplied: string;
    continuityPreserved: boolean;
  }
): CoreMissionContract {
  const entropyEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  const updated = {
    ...contract,
    entropyEvents: [...contract.entropyEvents, entropyEvent],
    updatedAt: new Date().toISOString(),
  };

  // Re-assess continuity status
  updated.continuityStatus = assessContinuityStatus(updated);

  return updated;
}

/**
 * Record a revision to the mission contract
 */
export function recordRevision(
  contract: CoreMissionContract,
  revision: {
    revisionType: 'objective-update' | 'thesis-refinement' | 'campaign-adjustment' | 'tradeoff-decision';
    description: string;
    rationale: string;
    continuousElements: string[];
    updatedFields: Partial<CoreMissionContract>;
  }
): CoreMissionContract {
  const revisionEvent = {
    ...revision,
    timestamp: new Date().toISOString(),
    previousState: JSON.stringify(contract),
  };

  const updated = {
    ...contract,
    ...revision.updatedFields,
    revisionHistory: [...contract.revisionHistory, revisionEvent],
    updatedAt: new Date().toISOString(),
  };

  // Re-assess continuity status after update
  updated.continuityStatus = assessContinuityStatus(updated);

  return updated;
}

/**
 * Add or update a campaign
 */
export function addOrUpdateCampaign(
  contract: CoreMissionContract,
  campaign: {
    id: string;
    name: string;
    contributionDescription: string;
    status: 'active' | 'paused' | 'merged' | 'killed';
    startedAt?: string;
    endedAt?: string;
  }
): CoreMissionContract {
  const existingIndex = contract.campaignRegistry.findIndex(c => c.id === campaign.id);

  let updated: CoreMissionContract;

  if (existingIndex >= 0) {
    // Update existing campaign
    const updatedRegistry = [...contract.campaignRegistry];
    updatedRegistry[existingIndex] = campaign;
    updated = {
      ...contract,
      campaignRegistry: updatedRegistry,
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Add new campaign
    const newActiveCampaigns = [...contract.activeCampaignIds];
    if (!newActiveCampaigns.includes(campaign.id)) {
      newActiveCampaigns.push(campaign.id);
    }

    updated = {
      ...contract,
      activeCampaignIds: newActiveCampaigns,
      campaignRegistry: [...contract.campaignRegistry, campaign],
      updatedAt: new Date().toISOString(),
    };
  }

  return updated;
}

/**
 * Pause or resume a campaign
 */
export function pauseCampaign(contract: CoreMissionContract, campaignId: string): CoreMissionContract {
  const campaign = contract.campaignRegistry.find(c => c.id === campaignId);
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  return addOrUpdateCampaign(contract, {
    ...campaign,
    status: 'paused',
  });
}

/**
 * Kill a campaign (mark as ended)
 */
export function killCampaign(contract: CoreMissionContract, campaignId: string, rationale: string): CoreMissionContract {
  const campaign = contract.campaignRegistry.find(c => c.id === campaignId);
  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  const updated = addOrUpdateCampaign(contract, {
    ...campaign,
    status: 'killed',
    endedAt: new Date().toISOString(),
  });

  // Record the revision
  return recordRevision(updated, {
    revisionType: 'campaign-adjustment',
    description: `Campaign "${campaign.name}" was killed`,
    rationale,
    continuousElements: ['durable objective', 'strategic thesis'],
    updatedFields: {
      activeCampaignIds: updated.activeCampaignIds.filter(id => id !== campaignId),
    },
  });
}

/**
 * Check whether a proposed tradeoff violates the contract
 */
export function validateTradeoff(
  contract: CoreMissionContract,
  tradeoff: string
): { valid: boolean; reason?: string } {
  // Is it in forbidden list?
  if (contract.forbiddenTradeoffs.some(f => f.toLowerCase() === tradeoff.toLowerCase())) {
    return {
      valid: false,
      reason: `Tradeoff "${tradeoff}" is explicitly forbidden in this mission`,
    };
  }

  // Is it in allowed list?
  if (contract.allowedTradeoffs.some(a => a.toLowerCase() === tradeoff.toLowerCase())) {
    return {
      valid: true,
    };
  }

  // If not explicitly allowed or forbidden, it's questionable
  return {
    valid: false,
    reason: `Tradeoff "${tradeoff}" is not in the allowed tradeoffs list. Requires mission review.`,
  };
}

/**
 * Check whether a decision violates a non-negotiable
 */
export function validateNonNegotiable(contract: CoreMissionContract, decision: string): { valid: boolean } {
  // This is a rough check based on string matching
  // In practice, would need more sophisticated semantic analysis

  const nonNegotiableLowercase = contract.nonNegotiables.map(n => n.toLowerCase());
  const decisionLowercase = decision.toLowerCase();

  // Simple heuristic: if the decision mentions something like "abandon" + objective, it's invalid
  if (decisionLowercase.includes('abandon') && decisionLowercase.includes('company')) {
    return { valid: false };
  }

  // If decision is about giving up ownership entirely
  if (decisionLowercase.includes('give up ownership') || decisionLowercase.includes('sell company')) {
    if (nonNegotiableLowercase.includes('ownership')) {
      return { valid: false };
    }
  }

  return { valid: true };
}

/**
 * Generate continuity status explanation based on signals
 */
export function generateContinuityStatusRationale(contract: CoreMissionContract): string {
  const criticalDerailments = contract.derailmentSignals.filter(s => s.currentSeverity === 'critical');
  const highDerailments = contract.derailmentSignals.filter(s => s.currentSeverity === 'high');
  const continuityGreen = contract.continuitySignals.filter(s => s.currentState === 'on-track');
  const recentEntropy = contract.entropyEvents.filter(e => {
    const eventDate = new Date(e.timestamp);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return eventDate > thirtyDaysAgo;
  });

  let rationale = '';

  if (contract.continuityStatus === 'endangered') {
    rationale = `ENDANGERED: ${criticalDerailments.length} critical derailment signal(s) active. `;
    rationale += `Immediate mission review required. `;
    if (criticalDerailments.length > 0) {
      rationale += `Critical issues: ${criticalDerailments.map(d => d.name).join(', ')}.`;
    }
  } else if (contract.continuityStatus === 'drifting') {
    rationale = `DRIFTING: ${highDerailments.length} high-severity signal(s) detected. `;
    rationale += `Strategic review recommended within 1-2 weeks. `;
    if (highDerailments.length > 0) {
      rationale += `Key concerns: ${highDerailments.map(d => d.name).join(', ')}.`;
    }
  } else if (contract.continuityStatus === 'strained') {
    rationale = `STRAINED: Recent entropy event(s) being managed. `;
    rationale += `${recentEntropy.length} event(s) in last 30 days, `;
    rationale += `${recentEntropy.filter(e => e.continuityPreserved).length} with continuity preserved. `;
    rationale += `Monitor closely; increase review frequency.`;
  } else {
    // Aligned
    rationale = `ALIGNED: On course toward durable objective. `;
    rationale += `${continuityGreen.length} continuity signal(s) on-track. `;
    rationale += `No critical or high-severity derailment signals. Continue execution.`;
  }

  return rationale;
}

// Utility
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default {
  createCoreMissionContract,
  recordEntropyEvent,
  recordRevision,
  addOrUpdateCampaign,
  pauseCampaign,
  killCampaign,
  validateTradeoff,
  validateNonNegotiable,
  generateContinuityStatusRationale,
};
