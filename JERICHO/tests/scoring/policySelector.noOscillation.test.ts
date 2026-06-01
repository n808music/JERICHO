import { describe, expect, it } from 'vitest';
import { computePolicySelection } from '../../src/planner/scoring/policySelector.ts';

const base = {
  horizonDays: 90,
  executionHorizonDays: 30,
  hasMilestones: false,
  milestoneCount: 0,
  unplacedEstimateMinTotal: 0,
  outsideExecutionHorizonEstimateMinTotal: 0,
  scheduleCoverageRatio: 1,
  scheduleTruthRatio: 1,
  capacityPressureRatio: 0.5,
  deadlineRisk: 10,
  milestoneRisk: 10,
  dependencyRisk: 10,
  contextSwitching: 70,
  loadSmoothness: 40,
  deferralPenalty: 10,
  milestoneAtRiskCount: 0,
  depTightCount: 0,
  contextSwitchCount: 12,
  dailyLoadStdDev: 10,
};

describe('policy selector no oscillation', () => {
  it('does not flip on tiny perturbation below deltas', () => {
    const first = computePolicySelection(base, {
      priorPolicyId: 'DEEP_WORK',
      priorPolicyAgeDays: 7,
      minPolicyHoldDays: 7,
      priorSignalsSnapshot: base,
    });
    const second = computePolicySelection(
      { ...base, contextSwitchCount: base.contextSwitchCount + 1 },
      {
        priorPolicyId: 'DEEP_WORK',
        priorPolicyAgeDays: 8,
        minPolicyHoldDays: 7,
        priorSignalsSnapshot: base,
      }
    );
    expect(first.selectedPolicyId).toBe('DEEP_WORK');
    expect(second.selectedPolicyId).toBe('DEEP_WORK');
  });
});
