import { describe, expect, it } from 'vitest';
import { computePolicySelection } from '../../src/planner/scoring/policySelector.ts';
import type { HistoryProfile } from '../../src/planner/scoring/historySignals.ts';

const baseSignals = {
  horizonDays: 120,
  executionHorizonDays: 30,
  hasMilestones: false,
  milestoneCount: 0,
  unplacedEstimateMinTotal: 0,
  outsideExecutionHorizonEstimateMinTotal: 0,
  scheduleCoverageRatio: 1,
  scheduleTruthRatio: 1,
  capacityPressureRatio: 0.5,
  deadlineRisk: 20,
  milestoneRisk: 20,
  dependencyRisk: 20,
  contextSwitching: 30,
  loadSmoothness: 20,
  deferralPenalty: 20,
  milestoneAtRiskCount: 0,
  depTightCount: 0,
  contextSwitchCount: 3,
  dailyLoadStdDev: 10,
};

const lowCompletionHistory: HistoryProfile = {
  window: {
    cycleCount: 5,
    usedCycleIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
    minEndDayKey: '2026-01-01',
    maxEndDayKey: '2026-03-01',
  },
  aggregates: {
    avgCompletionRate: 0.4,
    avgVelocityMinPerDay: 40,
    avgChurnIndex: 12,
    avgDepTightCount: 1,
    avgMilestoneAtRiskCount: 0,
    avgAnchoringMissCount: 0,
    avgDeferralMinutes: 180,
  },
  trends: {
    completionRateTrend: 'down',
    churnTrend: 'flat',
  },
};

describe('policy selector history influence', () => {
  it('uses history to select throughput when current signals are ambiguous', () => {
    const out = computePolicySelection(baseSignals, {
      enableHistoryInfluence: true,
      historyProfile: lowCompletionHistory,
      priorPolicyId: 'BALANCED',
      priorPolicyAgeDays: 12,
      minPolicyHoldDays: 7,
    });

    expect(out.selectedPolicyId).toBe('THROUGHPUT');
    expect(out.reasonCodes).toContain('HISTORY_LOW_COMPLETION');
  });

  it('keeps emergency deadline posture and records history override reason', () => {
    const out = computePolicySelection(
      {
        ...baseSignals,
        hasMilestones: true,
        milestoneCount: 1,
        milestoneAtRiskCount: 1,
      },
      {
        enableHistoryInfluence: true,
        historyProfile: lowCompletionHistory,
        priorPolicyId: 'BALANCED',
        priorPolicyAgeDays: 12,
        minPolicyHoldDays: 7,
      }
    );

    expect(out.selectedPolicyId).toBe('DEADLINE_FIRST');
    expect(out.reasonCodes).toContain('MILESTONE_AT_RISK');
    expect(out.reasonCodes).toContain('HISTORY_LOW_COMPLETION');
    expect(out.reasonCodes).toContain('HISTORY_OVERRIDDEN_BY_EMERGENCY');
  });
});
