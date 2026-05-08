// Minimal Core Mission Contract runtime shape for canonical state integration
// This provides the essential fields needed for Stability UI display

export interface MinimalCoreMissionContract {
  missionId: string;
  profileId: string;
  durableObjective: string;
  magnitudeTarget: string;
  horizonYears: number;
  currentPhase: string;
  strategicThesis: string;
  nonNegotiables: string[];
  allowedTradeoffs: string[];
  forbiddenTradeoffs: string[];
  continuitySignals: string[];
  derailmentSignals: string[];
  revisionHistory: Array<{
    timestamp: string;
    note: string;
    changes: Record<string, any>;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Creates a minimal Core Mission Contract for runtime integration
 */
export function createMinimalCoreMissionContract(params: {
  profileId: string;
  durableObjective: string;
  magnitudeTarget?: string;
  horizonYears?: number;
  currentPhase?: string;
  strategicThesis?: string;
  nonNegotiables?: string[];
  allowedTradeoffs?: string[];
  forbiddenTradeoffs?: string[];
  continuitySignals?: string[];
  derailmentSignals?: string[];
}): MinimalCoreMissionContract {
  const now = new Date().toISOString();
  const missionId = `mission-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return {
    missionId,
    profileId: params.profileId,
    durableObjective: params.durableObjective,
    magnitudeTarget: params.magnitudeTarget || '',
    horizonYears: params.horizonYears || 3,
    currentPhase: params.currentPhase || 'foundation',
    strategicThesis: params.strategicThesis || '',
    nonNegotiables: params.nonNegotiables || [],
    allowedTradeoffs: params.allowedTradeoffs || [],
    forbiddenTradeoffs: params.forbiddenTradeoffs || [],
    continuitySignals: params.continuitySignals || [],
    derailmentSignals: params.derailmentSignals || [],
    revisionHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Records a revision to a Core Mission Contract
 */
export function recordMissionRevision(
  contract: MinimalCoreMissionContract,
  note: string,
  changes: Record<string, any> = {}
): MinimalCoreMissionContract {
  return {
    ...contract,
    revisionHistory: [
      ...contract.revisionHistory,
      {
        timestamp: new Date().toISOString(),
        note,
        changes,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}