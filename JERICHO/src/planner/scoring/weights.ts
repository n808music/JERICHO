export type QualityScoreWeights = {
  deadlineRisk: number;
  milestoneRisk: number;
  dependencyRisk: number;
  contextSwitching: number;
  loadSmoothness: number;
  deferralPenalty: number;
};

export const BASELINE_WEIGHTS: QualityScoreWeights = {
  deadlineRisk: 4,
  milestoneRisk: 4,
  dependencyRisk: 3,
  contextSwitching: 2,
  loadSmoothness: 2,
  deferralPenalty: 3,
};
