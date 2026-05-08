import podcastScenario from '../../fixtures/goals/podcast_30d.json';
import doctorScenario from '../../fixtures/goals/doctor_10y.json';
import doctorTightScenario from '../../fixtures/goals/doctor_10y_tight_capacity.json';

export type StressScenarioId = 'podcast_30d' | 'doctor_10y' | 'doctor_10y_tight_capacity';

export type StressAction = {
  id: string;
  title: string;
  detail?: string;
  estimateMin?: number;
  category?: string;
  deps?: string[];
  topoIndex?: number;
  priority?: number;
  status?: string;
};

export type MilestoneWindow = {
  id: string;
  title: string;
  windowStartDayKey: string;
  windowEndDayKey: string;
  actionIds?: string[];
  checkpointActionIds?: string[];
};

export type RealismConstraints = {
  maxScheduledMinutesPerDay?: number;
  maxScheduledMinutesPerWeek?: number;
  toleranceMinutes?: number;
};

export type DependencyRules = {
  defaultBufferMinutes?: number;
};

export type ExpectedRealityProfile = {
  requireAtLeastOneViolation?: boolean;
};

export type ExpectedTargetRange = {
  min?: number;
  max?: number;
};

export type ExpectedTargets = {
  hard?: {
    maxHardViolations?: number;
  };
  realism?: {
    podcastMustBeClean?: boolean;
    requireAtLeastOneViolation?: boolean;
    requiredSignalsAnyOf?: string[];
  };
  metrics?: {
    scheduleTruthRatio?: ExpectedTargetRange;
    scheduleCoverageRatio?: ExpectedTargetRange;
    milestoneWindowMissCount?: ExpectedTargetRange;
    capacityOverageDaysCount?: ExpectedTargetRange;
    depCheckedActions?: ExpectedTargetRange;
    depEligibleActions?: ExpectedTargetRange;
    churnIndex?: ExpectedTargetRange;
    unplacedEstimateMinTotal?: ExpectedTargetRange;
    milestonePlacedRatioMin?: ExpectedTargetRange;
    milestonePlacedRatioAvg?: ExpectedTargetRange;
    placementAnchoringMissCount?: ExpectedTargetRange;
    anchoringMissDelta?: ExpectedTargetRange;
    depWindowBlockedCount?: ExpectedTargetRange;
    depBufferBlockedCount?: ExpectedTargetRange;
    preservedChunkCount?: ExpectedTargetRange;
    movedChunkCount?: ExpectedTargetRange;
    droppedChunkCount?: ExpectedTargetRange;
    churnMovedMinutesTotal?: ExpectedTargetRange;
    outsideExecutionHorizonCount?: ExpectedTargetRange;
    outsideExecutionHorizonEstimateMinTotal?: ExpectedTargetRange;
    milestoneWindowSlackRatioMin?: ExpectedTargetRange;
    infeasibleMilestonesCount?: ExpectedTargetRange;
    prescriptionsCount?: ExpectedTargetRange;
    qualityScoreTotal?: ExpectedTargetRange;
    contextSwitchCount?: ExpectedTargetRange;
    dailyLoadStdDev?: ExpectedTargetRange;
    milestoneAtRiskCount?: ExpectedTargetRange;
    depTightCount?: ExpectedTargetRange;
  };
  prescriptions?: {
    primaryConstraint?: string;
    mustIncludeCodes?: string[];
  };
};

export type StressScenarioFixture = {
  scenarioId: StressScenarioId;
  goalText: string;
  prompt: string;
  horizon: {
    startDayKey: string;
    endDayKey: string;
  };
  availability: {
    daysPerWeek: number;
    specificDays: string;
    maxBlocksPerDay: number;
    routeMinutesDefault: number;
  };
  energyWindows?: Array<Record<string, string>>;
  milestones?: MilestoneWindow[];
  preCompletedActionIds?: string[];
  realismConstraints?: RealismConstraints;
  dependencies?: DependencyRules;
  expectedRealityProfile?: ExpectedRealityProfile;
  planDraft?: {
    executionHorizonDays?: number;
    enableQualityOptimizer?: boolean;
    optimizerMaxIterations?: number;
    optimizerMaxCandidates?: number;
  };
  expectedTargets?: ExpectedTargets;
  inferredGraph: {
    source: string;
    snapshotVersion: string;
    actions: StressAction[];
  };
};

const SCENARIOS: Record<StressScenarioId, StressScenarioFixture> = {
  podcast_30d: podcastScenario as StressScenarioFixture,
  doctor_10y: doctorScenario as StressScenarioFixture,
  doctor_10y_tight_capacity: doctorTightScenario as StressScenarioFixture,
};

export function loadStressScenario(scenarioId: StressScenarioId): StressScenarioFixture {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) {
    throw new Error(`Unknown stress scenario: ${scenarioId}`);
  }
  return JSON.parse(JSON.stringify(scenario));
}
