export type QualityWeights = {
  deadlineRisk: number;
  milestoneRisk: number;
  dependencyRisk: number;
  contextSwitching: number;
  loadSmoothness: number;
  deferralPenalty: number;
};

// Keep weights explicit and centralized so stress and planner diagnostics stay stable.
export const QUALITY_WEIGHTS: QualityWeights = {
  deadlineRisk: 1.2,
  milestoneRisk: 1.5,
  dependencyRisk: 1.0,
  contextSwitching: 0.8,
  loadSmoothness: 0.7,
  deferralPenalty: 1.1,
};

export const SCORE_ROUNDING_DECIMALS = 6;
