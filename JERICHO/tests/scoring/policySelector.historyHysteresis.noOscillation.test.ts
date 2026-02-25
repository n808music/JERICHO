import { describe, expect, it } from 'vitest';
import { computePolicySelection } from '../../src/planner/scoring/policySelector.ts';
import type { HistoryProfile } from '../../src/planner/scoring/historySignals.ts';

const historyProfile: HistoryProfile = {
  window: {
    cycleCount: 5,
    usedCycleIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
    minEndDayKey: '2026-01-01',
    maxEndDayKey: '2026-03-01',
  },
  aggregates: {
    avgCompletionRate: 0.38,
    avgVelocityMinPerDay: 44,
    avgChurnIndex: 14,
    avgDepTightCount: 1,
    avgMilestoneAtRiskCount: 0,
    avgAnchoringMissCount: 0,
    avgDeferralMinutes: 220,
  },
  trends: {
    completionRateTrend: 'down',
    churnTrend: 'flat',
  },
};

const signals = {
  horizonDays: 120,
  executionHorizonDays: 30,
  hasMilestones: false,
  milestoneCount: 0,
  unplacedEstimateMinTotal: 0,
  outsideExecutionHorizonEstimateMinTotal: 0,
  scheduleCoverageRatio: 1,
  scheduleTruthRatio: 1,
  capacityPressureRatio: 0.6,
  deadlineRisk: 24,
  milestoneRisk: 20,
  dependencyRisk: 20,
  contextSwitching: 25,
  loadSmoothness: 18,
  deferralPenalty: 16,
  milestoneAtRiskCount: 0,
  depTightCount: 0,
  contextSwitchCount: 4,
  dailyLoadStdDev: 11,
};

describe('policy selector history + hysteresis no oscillation', () => {
  it('does not flip when hold duration is not met even with tiny perturbation', () => {
    const one = computePolicySelection(signals, {
      enableHistoryInfluence: true,
      historyProfile,
      priorPolicyId: 'BALANCED',
      priorPolicyAgeDays: 2,
      minPolicyHoldDays: 7,
      priorSignalsSnapshot: signals,
    });

    const two = computePolicySelection(
      {
        ...signals,
        contextSwitchCount: signals.contextSwitchCount + 1,
      },
      {
        enableHistoryInfluence: true,
        historyProfile,
        priorPolicyId: 'BALANCED',
        priorPolicyAgeDays: 3,
        minPolicyHoldDays: 7,
        priorSignalsSnapshot: signals,
      }
    );

    expect(one.selectedPolicyId).toBe('BALANCED');
    expect(one.hysteresis.blockedBy).toBe('HYSTERESIS_MIN_DURATION');
    expect(two.selectedPolicyId).toBe('BALANCED');
    expect(two.hysteresis.blockedBy).toBe('HYSTERESIS_MIN_DURATION');
  });
});
