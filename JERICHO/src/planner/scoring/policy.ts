import { BASELINE_WEIGHTS, type QualityScoreWeights } from './weights.ts';

export type QualityPolicyId = 'BALANCED' | 'DEADLINE_FIRST' | 'DEEP_WORK' | 'DEPENDENCY_SAFETY' | 'THROUGHPUT';

export type QualityPolicy = {
  policyId: QualityPolicyId;
  weights: QualityScoreWeights;
  thresholds: {
    maxContextSwitchesPerDay: number;
    maxDailyLoadStdDev: number;
    depTightMarginMin: number;
    milestoneAtRiskSlackRatio: number;
    deferralOutsideHorizonPenaltyPerHour: number;
  };
  optimizerGuardrails: {
    allowDeadlineRiskIncrease: number;
    allowMilestoneRiskIncrease: number;
    allowDependencyRiskIncrease: number;
    allowDeferralPenaltyIncrease: number;
  };
};

const POLICIES: Record<QualityPolicyId, QualityPolicy> = {
  BALANCED: {
    policyId: 'BALANCED',
    weights: { ...BASELINE_WEIGHTS },
    thresholds: {
      maxContextSwitchesPerDay: 4,
      maxDailyLoadStdDev: 90,
      depTightMarginMin: 60,
      milestoneAtRiskSlackRatio: 1.2,
      deferralOutsideHorizonPenaltyPerHour: 3,
    },
    optimizerGuardrails: {
      allowDeadlineRiskIncrease: 0,
      allowMilestoneRiskIncrease: 0,
      allowDependencyRiskIncrease: 1,
      allowDeferralPenaltyIncrease: 0,
    },
  },
  DEADLINE_FIRST: {
    policyId: 'DEADLINE_FIRST',
    weights: {
      deadlineRisk: 7,
      milestoneRisk: 7,
      dependencyRisk: 3,
      contextSwitching: 1,
      loadSmoothness: 1,
      deferralPenalty: 4,
    },
    thresholds: {
      maxContextSwitchesPerDay: 5,
      maxDailyLoadStdDev: 110,
      depTightMarginMin: 60,
      milestoneAtRiskSlackRatio: 1.3,
      deferralOutsideHorizonPenaltyPerHour: 4,
    },
    optimizerGuardrails: {
      allowDeadlineRiskIncrease: 0,
      allowMilestoneRiskIncrease: 0,
      allowDependencyRiskIncrease: 1,
      allowDeferralPenaltyIncrease: 0,
    },
  },
  DEEP_WORK: {
    policyId: 'DEEP_WORK',
    weights: {
      deadlineRisk: 3,
      milestoneRisk: 3,
      dependencyRisk: 3,
      contextSwitching: 6,
      loadSmoothness: 5,
      deferralPenalty: 2,
    },
    thresholds: {
      maxContextSwitchesPerDay: 3,
      maxDailyLoadStdDev: 70,
      depTightMarginMin: 60,
      milestoneAtRiskSlackRatio: 1.2,
      deferralOutsideHorizonPenaltyPerHour: 2,
    },
    optimizerGuardrails: {
      allowDeadlineRiskIncrease: 0,
      allowMilestoneRiskIncrease: 0,
      allowDependencyRiskIncrease: 1,
      allowDeferralPenaltyIncrease: 0,
    },
  },
  DEPENDENCY_SAFETY: {
    policyId: 'DEPENDENCY_SAFETY',
    weights: {
      deadlineRisk: 4,
      milestoneRisk: 4,
      dependencyRisk: 7,
      contextSwitching: 1,
      loadSmoothness: 1,
      deferralPenalty: 2,
    },
    thresholds: {
      maxContextSwitchesPerDay: 5,
      maxDailyLoadStdDev: 110,
      depTightMarginMin: 90,
      milestoneAtRiskSlackRatio: 1.2,
      deferralOutsideHorizonPenaltyPerHour: 2,
    },
    optimizerGuardrails: {
      allowDeadlineRiskIncrease: 0,
      allowMilestoneRiskIncrease: 0,
      allowDependencyRiskIncrease: 0,
      allowDeferralPenaltyIncrease: 0,
    },
  },
  THROUGHPUT: {
    policyId: 'THROUGHPUT',
    weights: {
      deadlineRisk: 3,
      milestoneRisk: 3,
      dependencyRisk: 2,
      contextSwitching: 1,
      loadSmoothness: 2,
      deferralPenalty: 7,
    },
    thresholds: {
      maxContextSwitchesPerDay: 5,
      maxDailyLoadStdDev: 100,
      depTightMarginMin: 60,
      milestoneAtRiskSlackRatio: 1.2,
      deferralOutsideHorizonPenaltyPerHour: 5,
    },
    optimizerGuardrails: {
      allowDeadlineRiskIncrease: 0,
      allowMilestoneRiskIncrease: 0,
      allowDependencyRiskIncrease: 1,
      allowDeferralPenaltyIncrease: 0,
    },
  },
};

export function getQualityPolicy(policyId?: string): QualityPolicy {
  const resolved = (policyId || 'BALANCED') as QualityPolicyId;
  return POLICIES[resolved] || POLICIES.BALANCED;
}
