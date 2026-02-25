import { POLICY_SELECTOR_THRESHOLDS, type PolicySelectorThresholds } from './policySelectorThresholds.ts';
import type { QualityPolicyId } from './policy.ts';
import type { HistoryProfile } from './historySignals.ts';

export type PolicySelectionSignals = {
  horizonDays: number;
  executionHorizonDays: number;
  hasMilestones: boolean;
  milestoneCount: number;
  unplacedEstimateMinTotal: number;
  outsideExecutionHorizonEstimateMinTotal: number;
  scheduleCoverageRatio: number;
  scheduleTruthRatio: number;
  capacityPressureRatio?: number;
  deadlineRisk: number;
  milestoneRisk: number;
  dependencyRisk: number;
  contextSwitching: number;
  loadSmoothness: number;
  deferralPenalty: number;
  milestoneAtRiskCount: number;
  depTightCount: number;
  contextSwitchCount: number;
  dailyLoadStdDev: number;
};

export type PolicySelectionDecision = {
  selectedPolicyId: QualityPolicyId;
  reasonCodes: string[];
  signals: PolicySelectionSignals;
  hysteresis: {
    priorPolicyId?: string;
    stickyPolicyId?: string;
    changed: boolean;
    blockedBy?: string;
  };
};

type PolicySelectorOpts = {
  priorPolicyId?: string;
  priorPolicyAgeDays?: number;
  minPolicyHoldDays?: number;
  switchThresholds?: Partial<PolicySelectorThresholds>;
  priorSignalsSnapshot?: Partial<PolicySelectionSignals>;
  historyProfile?: HistoryProfile;
  enableHistoryInfluence?: boolean;
  historyInfluenceStrength?: 'light' | 'standard' | 'strong';
};

function mergeThresholds(overrides?: Partial<PolicySelectorThresholds>): PolicySelectorThresholds {
  return {
    ...POLICY_SELECTOR_THRESHOLDS,
    ...(overrides || {})
  };
}

function round6(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1_000_000) / 1_000_000;
}

function chooseByRules(signals: PolicySelectionSignals, t: PolicySelectorThresholds): { policy: QualityPolicyId; reason: string } {
  if (signals.hasMilestones && (signals.milestoneAtRiskCount > 0 || signals.milestoneRisk >= t.milestoneRiskHigh)) {
    return { policy: 'DEADLINE_FIRST', reason: 'MILESTONE_AT_RISK' };
  }
  if (signals.deadlineRisk >= t.deadlineRiskHigh) {
    return { policy: 'DEADLINE_FIRST', reason: 'DEADLINE_RISK_HIGH' };
  }
  if (signals.depTightCount >= t.depTightCountHigh || signals.dependencyRisk >= t.dependencyRiskHigh) {
    return { policy: 'DEPENDENCY_SAFETY', reason: 'DEPENDENCY_TIGHT' };
  }
  if (
    signals.contextSwitchCount >= t.contextSwitchCountHigh &&
    signals.deadlineRisk <= t.deadlineRiskLow &&
    signals.milestoneRisk <= t.milestoneRiskLow
  ) {
    return { policy: 'DEEP_WORK', reason: 'CONTEXT_SWITCHING_HIGH' };
  }
  if (
    (signals.outsideExecutionHorizonEstimateMinTotal >= t.outsideHorizonMinHigh || signals.deferralPenalty >= t.deferralPenaltyHigh) &&
    signals.deadlineRisk <= t.deadlineRiskMid &&
    signals.milestoneRisk <= t.milestoneRiskMid
  ) {
    return { policy: 'THROUGHPUT', reason: 'DEFERRAL_HIGH' };
  }
  return { policy: 'BALANCED', reason: 'DEFAULT_BALANCED' };
}

function chooseEmergencyRule(signals: PolicySelectionSignals, t: PolicySelectorThresholds): { policy: QualityPolicyId; reason: string } | null {
  if (signals.hasMilestones && (signals.milestoneAtRiskCount > 0 || signals.milestoneRisk >= t.milestoneRiskHigh)) {
    return { policy: 'DEADLINE_FIRST', reason: 'MILESTONE_AT_RISK' };
  }
  if (signals.deadlineRisk >= t.deadlineRiskHigh) {
    return { policy: 'DEADLINE_FIRST', reason: 'DEADLINE_RISK_HIGH' };
  }
  return null;
}

function applyHistoryStrength(t: PolicySelectorThresholds, strength: 'light' | 'standard' | 'strong') {
  if (strength === 'light') {
    return {
      completionRateLow: t.histCompletionRateLow - 0.07,
      velocityLow: t.histVelocityLow - 15,
      churnHigh: t.histChurnHigh + 10,
      anchoringHigh: t.histAnchoringMissHigh + 1,
      depTightHigh: t.histDepTightHigh + 1,
    };
  }
  if (strength === 'strong') {
    return {
      completionRateLow: t.histCompletionRateLow + 0.06,
      velocityLow: t.histVelocityLow + 15,
      churnHigh: Math.max(1, t.histChurnHigh - 10),
      anchoringHigh: Math.max(1, t.histAnchoringMissHigh - 1),
      depTightHigh: Math.max(1, t.histDepTightHigh - 1),
    };
  }
  return {
    completionRateLow: t.histCompletionRateLow,
    velocityLow: t.histVelocityLow,
    churnHigh: t.histChurnHigh,
    anchoringHigh: t.histAnchoringMissHigh,
    depTightHigh: t.histDepTightHigh,
  };
}

function chooseByHistory(
  history: HistoryProfile | undefined,
  signals: PolicySelectionSignals,
  t: PolicySelectorThresholds,
  strength: 'light' | 'standard' | 'strong'
): { policy: QualityPolicyId; reason: string } | null {
  if (!history || !history.window?.cycleCount) return null;
  const tuned = applyHistoryStrength(t, strength);
  const avg = history.aggregates || ({} as HistoryProfile['aggregates']);
  const trends = history.trends || ({} as HistoryProfile['trends']);

  if (avg.avgAnchoringMissCount > tuned.anchoringHigh || avg.avgMilestoneAtRiskCount > 0) {
    return { policy: 'DEADLINE_FIRST', reason: 'HISTORY_MILESTONE_STRESS' };
  }
  if (avg.avgDepTightCount > tuned.depTightHigh) {
    return { policy: 'DEPENDENCY_SAFETY', reason: 'HISTORY_DEP_TIGHT' };
  }
  if (avg.avgCompletionRate < tuned.completionRateLow || avg.avgVelocityMinPerDay < tuned.velocityLow) {
    return { policy: 'THROUGHPUT', reason: 'HISTORY_LOW_COMPLETION' };
  }
  if (avg.avgChurnIndex > tuned.churnHigh || trends.churnTrend === 'up') {
    if (signals.depTightCount >= t.depTightCountHigh || signals.dependencyRisk >= t.dependencyRiskHigh) {
      return { policy: 'DEPENDENCY_SAFETY', reason: 'HISTORY_HIGH_CHURN' };
    }
    return { policy: 'BALANCED', reason: 'HISTORY_HIGH_CHURN' };
  }
  return null;
}

function deltaSatisfied(
  current: PolicySelectionSignals,
  prior: Partial<PolicySelectionSignals> | undefined,
  t: PolicySelectorThresholds
): boolean {
  if (!prior) return true;
  const dDeadline = Math.abs(current.deadlineRisk - Number(prior.deadlineRisk || 0));
  const dMilestone = Math.abs(current.milestoneRisk - Number(prior.milestoneRisk || 0));
  const dDependency = Math.abs(current.dependencyRisk - Number(prior.dependencyRisk || 0));
  const dContext = Math.abs(current.contextSwitchCount - Number(prior.contextSwitchCount || 0));
  const rdDeadline = round6(dDeadline);
  const rdMilestone = round6(dMilestone);
  const rdDependency = round6(dDependency);
  const rdContext = round6(dContext);
  return (
    rdDeadline >= t.switchDeltaDeadlineRisk ||
    rdMilestone >= t.switchDeltaMilestoneRisk ||
    rdDependency >= t.switchDeltaDependencyRisk ||
    rdContext >= t.switchDeltaContext
  );
}

export function computePolicySelection(signals: PolicySelectionSignals, opts: PolicySelectorOpts = {}): PolicySelectionDecision {
  const thresholds = mergeThresholds(opts.switchThresholds);
  const minPolicyHoldDays = Number.isFinite(opts.minPolicyHoldDays) ? Number(opts.minPolicyHoldDays) : 7;
  const historyInfluenceStrength = opts.historyInfluenceStrength || 'standard';
  const priorPolicyId = opts.priorPolicyId;
  const priorPolicyAgeDays = Number.isFinite(opts.priorPolicyAgeDays) ? Number(opts.priorPolicyAgeDays) : minPolicyHoldDays;

  const rulePick = chooseByRules(signals, thresholds);
  const emergencyPick = chooseEmergencyRule(signals, thresholds);
  const historyPick =
    opts.enableHistoryInfluence === true
      ? chooseByHistory(opts.historyProfile, signals, thresholds, historyInfluenceStrength)
      : null;

  let candidatePick = rulePick;
  const reasonCodes: string[] = [];
  if (historyPick && !emergencyPick) {
    candidatePick = historyPick;
    reasonCodes.push(historyPick.reason, 'HISTORY_INFLUENCE_APPLIED');
  } else if (historyPick && emergencyPick) {
    candidatePick = emergencyPick;
    reasonCodes.push(emergencyPick.reason, historyPick.reason, 'HISTORY_OVERRIDDEN_BY_EMERGENCY');
  } else {
    reasonCodes.push(rulePick.reason);
  }

  let finalPolicy: QualityPolicyId = rulePick.policy;
  let blockedBy: string | undefined;

  if (priorPolicyId) {
    if (priorPolicyId === candidatePick.policy) {
      finalPolicy = priorPolicyId as QualityPolicyId;
    } else if (priorPolicyAgeDays < minPolicyHoldDays) {
      finalPolicy = priorPolicyId as QualityPolicyId;
      blockedBy = 'HYSTERESIS_MIN_DURATION';
      reasonCodes.push(blockedBy);
    } else if (!deltaSatisfied(signals, opts.priorSignalsSnapshot, thresholds)) {
      finalPolicy = priorPolicyId as QualityPolicyId;
      blockedBy = 'HYSTERESIS_DELTA_TOO_SMALL';
      reasonCodes.push(blockedBy);
    } else {
      finalPolicy = candidatePick.policy;
    }
  } else {
    finalPolicy = candidatePick.policy;
  }

  return {
    selectedPolicyId: finalPolicy,
    reasonCodes,
    signals: { ...signals },
    hysteresis: {
      priorPolicyId,
      stickyPolicyId: finalPolicy,
      changed: Boolean(priorPolicyId && priorPolicyId !== finalPolicy),
      blockedBy
    }
  };
}
