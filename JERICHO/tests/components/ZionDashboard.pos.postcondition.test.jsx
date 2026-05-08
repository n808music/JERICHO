import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const stubAction = vi.fn();
const actionsProxy = new Proxy({}, { get: () => stubAction });
let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore({ withPlan = true, explanationMode = 'none', livePos = null, planQualityGate = null } = {}) {
  const dayKey = '2026-03-10';
  const cycleId = 'cycle-1';
  const goalId = 'goal-1';
  const canonicalLivePos =
    livePos ||
    (withPlan
      ? {
          state: 'eligible',
          liveState: 'stable',
          liveStateReasonCodes: ['LIVE_POS_STABLE_LINKED_EXECUTION_CONTINUITY'],
          reasonCodes: [],
          score: {
            state: 'available',
            value: 0.74,
            lowerBound: 0.72,
            upperBound: 0.86,
            capped: false,
            evidenceDensity: 'strong',
            reasonCodes: ['LIVE_POS_SCORE_STABLE_CONTINUITY', 'LIVE_POS_SCORE_EVIDENCE_DENSITY_STRONG'],
          },
        }
      : {
          state: 'withheld',
          liveState: 'withheld',
          liveStateReasonCodes: ['LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE'],
          reasonCodes: ['LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE'],
          score: {
            state: 'withheld',
            value: null,
            lowerBound: null,
            upperBound: null,
            capped: false,
            evidenceDensity: 'unavailable',
            reasonCodes: ['LIVE_POS_SCORE_WITHHELD'],
          },
        });
  const committedBlocks = [
    {
      id: 'blk-march',
      cycleId,
      goalId,
      title: 'Complete episode 1 outline',
      start: '2026-03-18T09:00:00.000Z',
      end: '2026-03-18T10:00:00.000Z',
      status: 'planned',
    },
  ];

  return {
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: {
      weekStart: dayKey,
      days: [
        { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
      ],
      metrics: {},
    },
    cycle: [
      {
        date: '2026-03-18',
        blocks: committedBlocks,
        completionRate: 0,
        driftSignal: 'contained',
        loadByPractice: {},
        practices: [],
      },
    ],
    planDraft: null,
    planCalibration: null,
    correctionSignals: null,
    suggestionEvents: [],
    suggestedBlocks: [],
    overdueBlockIds: [],
    lastPlanError: null,
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    goalWorkById: {},
    constraints: {},
    cycleDynamicsByCycleId: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: {
          goalId,
          startDayKey: '2026-03-01',
          endDayKey: '2026-04-01',
        },
        metrics: withPlan
          ? {
              posScore: 0.62,
              feasibilityScore: 0.8,
              integrityScore: 0.7,
              contractFailureState: 'ON_TRACK',
              contractFailureReasons: ['CONTRACT_CAPACITY_AND_DEADLINE_ALIGNED'],
              contractRenegotiationRequired: false,
              recoveryState: 'RECOVERY_WITHIN_CONTRACT',
              recoveryReasons: ['RECOVERY_WITHIN_CONTRACT'],
              recoveryMetrics: {
                remainingRequiredBurden: 6,
                projectedSlackAfterRecovery: 2,
                requiredWeeklyThroughputAfterRecovery: 5,
              },
              renegotiationRequired: false,
              renegotiationOptions: [],
              posExplanation:
                explanationMode === 'delta'
                  ? {
                      delta: -0.1,
                      reasons: [
                        {
                          code: 'POS_DOWN_MISSED_WORK',
                          direction: 'DOWN',
                          magnitude: 0.2,
                          evidence: 'missed 60m',
                        },
                      ],
                      conflicts: [],
                      generatedAtISO: `${dayKey}T12:00:00.000Z`,
                    }
                  : explanationMode === 'unschedulable'
                    ? {
                        delta: -0.62,
                        reasons: [{ code: 'POS_UNSCHEDULABLE', direction: 'DOWN', magnitude: 0.62 }],
                        conflicts: ['UNSCHEDULABLE', 'NO_ALLOWED_WINDOWS'],
                        generatedAtISO: `${dayKey}T12:00:00.000Z`,
                      }
                    : null,
            }
          : {
              posScore: null,
              feasibilityScore: null,
              integrityScore: 1,
              posExplanation:
                explanationMode === 'no-plan'
                  ? {
                      delta: null,
                      reasons: [{ code: 'POS_NO_PLAN', direction: 'NEUTRAL', magnitude: 1 }],
                      conflicts: [],
                      generatedAtISO: `${dayKey}T12:00:00.000Z`,
                    }
                  : null,
            },
        policyState: {
          goalPolicy: {
            intakeReadiness: { state: 'fully_admitted' },
            planQuality: { state: 'policy_clean' },
            posTrust: { state: 'trusted' },
            feasibility: { state: withPlan ? 'feasible' : 'withheld' },
            livePos: canonicalLivePos,
          },
        },
        ...(planQualityGate ? { planQualityGate } : {}),
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-04-01' },
    probabilityByGoal: {
      [goalId]: {
        value: 0.4,
        status: 'ELIGIBLE',
        scoringSummary: { K: 14, mu: 1.2 },
      },
    },
    feasibilityByGoal: {
      [goalId]: {
        status: 'FEASIBLE',
        workableDaysRemaining: 12,
        requiredBlocksPerDay: 0.5,
      },
    },
    planQualityGateByGoal: planQualityGate ? { [goalId]: planQualityGate } : {},
    profileLearning: {},
    draftScheduleAppliedAtISO: null,
    actions: actionsProxy,
    completeBlock: stubAction,
    cancelBlock: stubAction,
    splitBlock: stubAction,
    setDefiniteGoal: stubAction,
    setPatternTargets: stubAction,
    createBlock: stubAction,
    updateBlock: stubAction,
    deleteBlock: stubAction,
    rescheduleBlock: stubAction,
    setActiveDayKey: stubAction,
    jumpToToday: stubAction,
    tickNow: stubAction,
    setCalibrationDays: stubAction,
    acceptSuggestedBlock: stubAction,
    acceptSuggestedBlockWithPlacement: stubAction,
    rejectSuggestedBlock: stubAction,
    ignoreSuggestedBlock: stubAction,
    dismissSuggestedBlock: stubAction,
    setActiveCycle: stubAction,
    deleteCycle: stubAction,
    startNewCycle: stubAction,
    createDeliverable: stubAction,
    updateDeliverable: stubAction,
    deleteDeliverable: stubAction,
    createCriterion: stubAction,
    toggleCriterionDone: stubAction,
    deleteCriterion: stubAction,
    linkBlockToDeliverable: stubAction,
    assignSuggestionLink: stubAction,
    generatePlan: stubAction,
    generatePlanWithLLM: stubAction,
    commitPreviewItems: stubAction,
    applyPlan: stubAction,
    applyRenegotiationOption: stubAction,
  };
}

describe('ZionDashboard POS postcondition', () => {
  beforeEach(() => {
    stubAction.mockClear();
  });

  it('renders canonical live P.O.S. score when active cycle has admitted live evidence', () => {
    mockStore = buildStore({ withPlan: true });
    const { container } = render(<ZionDashboard initialView="stability" />);

    expect(screen.getByText(/Probability of Success/i)).toBeInTheDocument();
    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/^Live P\.O\.S\.$/i)).toBeInTheDocument();
    expect(within(posCard).getAllByText('74%').length).toBeGreaterThanOrEqual(1);
    expect(within(posCard).getByText(/Live state: Stable/i)).toBeInTheDocument();
    expect(within(posCard).getByText('72-86%')).toBeInTheDocument();
    expect(within(posCard).getByText(/Strong evidence/i)).toBeInTheDocument();
  });

  it('renders remaining schedule-fit context alongside the Live P.O.S. surface', () => {
    mockStore = buildStore({ withPlan: true });
    const { container } = render(<ZionDashboard initialView="stability" />);

    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/Workable days remaining/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Required weekly throughput/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Actual avg per week/i)).toBeInTheDocument();
  });

  it('surfaces canonical long-horizon tail-gap plan-quality diagnostics', () => {
    mockStore = buildStore({
      withPlan: true,
      planQualityGate: {
        status: 'PLAN_QUALITY_WITHHELD',
        failureCodes: ['LONG_HORIZON_UNJUSTIFIED_TAIL_GAP'],
        reasonCodes: ['LONG_HORIZON_UNJUSTIFIED_TAIL_GAP'],
        meta: {
          temporalDistribution: {
            contractStartDayKey: '2026-04-13',
            contractEndDayKey: '2027-04-12',
            firstScheduledDayKey: '2026-04-20',
            lastScheduledDayKey: '2026-11-09',
            horizonDays: 365,
            scheduledSpanDays: 204,
            occupiedMonths: ['2026-04', '2026-06', '2026-08', '2026-09', '2026-11'],
            latestScheduledHorizonRatio: 0.57,
            requiredLatestHorizonRatio: 0.67,
            requiredOccupiedMonths: 7,
            remainingTailDays: 154,
            remainingTailRatio: 0.42,
            maxUnjustifiedTailRatio: 0.25,
          },
        },
      },
    });
    const { container } = render(<ZionDashboard initialView="stability" />);
    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');

    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/Plan-quality diagnostics/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/PLAN QUALITY WITHHELD/i)).toBeInTheDocument();
    expect(
      within(posCard).getByText(/Long-horizon issue: work ends on Nov 9, 2026, leaving an unjustified tail before Apr 12, 2027\./i)
    ).toBeInTheDocument();
    expect(within(posCard).getByText(/large unexplained tail before the contract end/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Temporal truth: last scheduled Nov 9, 2026 · contract end Apr 12, 2027/i)).toBeInTheDocument();
    fireEvent.click(within(posCard).getByText(/Live canonical trace/i));
    expect(within(posCard).getByText(/"reasonCodes":/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/LONG_HORIZON_UNJUSTIFIED_TAIL_GAP/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/"closureCheckpoint":/i)).toBeInTheDocument();
  });

  it('renders intentional Live P.O.S. withholding when no live execution evidence exists', () => {
    mockStore = buildStore({ withPlan: false });
    const { container } = render(<ZionDashboard initialView="stability" />);

    expect(screen.getByText(/Probability of Success/i)).toBeInTheDocument();
    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(posCard).toHaveTextContent(/^Probability of Success[\s\S]*Live P\.O\.S\.[\s\S]*Withheld/i);
    expect(within(posCard).getByText(/Live P\.O\.S\. is intentionally withheld/i)).toBeInTheDocument();
  });

  it('renders canonical live-state and score explanations from reason codes', () => {
    mockStore = buildStore({
      withPlan: true,
      livePos: {
        state: 'eligible',
        liveState: 'at_risk',
        liveStateReasonCodes: ['LIVE_POS_AT_RISK_MISSED_EXECUTION_BURDEN', 'LIVE_POS_AT_RISK_DRIFT_ACCUMULATING'],
        reasonCodes: [],
        score: {
          state: 'available',
          value: 0.38,
          lowerBound: 0.2,
          upperBound: 0.55,
          capped: false,
          evidenceDensity: 'thin',
          reasonCodes: ['LIVE_POS_SCORE_AT_RISK_RANGE', 'LIVE_POS_SCORE_EVIDENCE_DENSITY_THIN'],
        },
      },
    });
    const { container } = render(<ZionDashboard initialView="stability" />);
    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/Live state: At risk/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Missed execution burden is materially present\./i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Schedule drift is accumulating\./i)).toBeInTheDocument();
    expect(within(posCard).getByText(/The score reflects at-risk execution conditions\./i)).toBeInTheDocument();
  });

  it('renders missed-block signal when overdue or missed burden exists', () => {
    mockStore = buildStore({ withPlan: true });
    mockStore.cyclesById['cycle-1'].metrics.dynamicOutcome = {
      missedBlocks: 1,
      expiredBlocks: 0,
      overdueUnfinished: 2,
    };
    mockStore.cycleDynamicsByCycleId['cycle-1'] = {
      totals: { missed: 1, expired: 0, overdueUnfinished: 2 },
      recommendedTransitions: [{ blockId: 'blk-march', toStatus: 'MISSED' }],
    };

    const { container } = render(<ZionDashboard initialView="stability" />);
    const diagnosticsCard = within(container)
      .getByText(/Integrity \+ risk/i)
      .closest('.rounded-xl');
    expect(diagnosticsCard).toBeTruthy();
    expect(within(diagnosticsCard).getByText(/Missed block signal/i)).toBeInTheDocument();
    expect(within(diagnosticsCard).getByText(/2 overdue blocks require missed-work recovery/i)).toBeInTheDocument();
    expect(within(diagnosticsCard).getByText(/2 overdue unfinished · 1 missed/i)).toBeInTheDocument();
  });

  it('renders withheld reasons from canonical live-pos reason codes', () => {
    mockStore = buildStore({
      withPlan: false,
      livePos: {
        state: 'withheld',
        liveState: 'withheld',
        liveStateReasonCodes: ['LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE'],
        reasonCodes: ['LIVE_POS_WITHHELD_SCHEDULE_NOT_LIVE', 'LIVE_POS_WITHHELD_UNTIL_EXECUTION_EVIDENCE'],
        score: {
          state: 'withheld',
          value: null,
          lowerBound: null,
          upperBound: null,
          capped: false,
          evidenceDensity: 'unavailable',
          reasonCodes: ['LIVE_POS_SCORE_WITHHELD'],
        },
      },
    });
    const { container } = render(<ZionDashboard initialView="stability" />);
    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/The schedule is not live yet\./i)).toBeInTheDocument();
    expect(within(posCard).getByText(/No linked execution evidence exists yet\./i)).toBeInTheDocument();
  });

  it('renders evidence density and cap indicators from canonical score fields', () => {
    mockStore = buildStore({
      withPlan: true,
      livePos: {
        state: 'eligible',
        liveState: 'recovering',
        liveStateReasonCodes: ['LIVE_POS_RECOVERING_AFTER_RISK', 'LIVE_POS_RECOVERING_LINKED_RECOVERY_EVIDENCE'],
        reasonCodes: [],
        score: {
          state: 'available',
          value: 0.58,
          lowerBound: 0.46,
          upperBound: 0.72,
          capped: true,
          evidenceDensity: 'moderate',
          reasonCodes: ['LIVE_POS_SCORE_RECOVERY_UPLIFT', 'LIVE_POS_SCORE_CAPPED_RECOVERY_EARLY'],
        },
      },
    });
    const { container } = render(<ZionDashboard initialView="stability" />);
    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/Live state: Recovering/i)).toBeInTheDocument();
    expect(within(posCard).getByText('46-72%')).toBeInTheDocument();
    expect(within(posCard).getByText(/Moderate evidence/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/^Capped$/i)).toBeInTheDocument();
  });

  it('renders canonical contract failure state and renegotiation signal', () => {
    mockStore = buildStore({ withPlan: true });
    mockStore.cyclesById['cycle-1'].metrics.contractFailureState = 'DEADLINE_FAILED_RENEGOTIATION_REQUIRED';
    mockStore.cyclesById['cycle-1'].metrics.contractFailureReasons = ['DEADLINE_PASSED_WITH_REMAINING_WORK'];
    mockStore.cyclesById['cycle-1'].metrics.contractRenegotiationRequired = true;

    const { container } = render(<ZionDashboard initialView="stability" />);
    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/Contract reasons: DEADLINE_PASSED_WITH_REMAINING_WORK/i)).toBeInTheDocument();
  });

  it('renders recovery state and deterministic option summaries', () => {
    mockStore = buildStore({ withPlan: true });
    mockStore.cyclesById['cycle-1'].metrics.recoveryState = 'RECOVERY_RENEGOTIATION_REQUIRED';
    mockStore.cyclesById['cycle-1'].metrics.recoveryReasons = ['RECOVERY_OVER_MAX_BLOCKS_PER_DAY'];
    mockStore.cyclesById['cycle-1'].metrics.recoveryMetrics = {
      remainingRequiredBurden: 14,
      projectedSlackAfterRecovery: -4,
      requiredWeeklyThroughputAfterRecovery: 12,
    };
    mockStore.cyclesById['cycle-1'].metrics.renegotiationRequired = true;
    mockStore.cyclesById['cycle-1'].metrics.renegotiationOptions = [
      { type: 'EXTEND_DEADLINE', summary: 'Extend deadline by 4 day(s) to restore capacity fit.' },
      { type: 'REDUCE_SCOPE', summary: 'Reduce required scope by 4 block(s) to restore viability.' },
    ];

    const { container } = render(<ZionDashboard initialView="stability" />);
    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/Recovery reasons: RECOVERY_OVER_MAX_BLOCKS_PER_DAY/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Extend deadline by 4 day\(s\) to restore capacity fit\./i)).toBeInTheDocument();
    expect(within(posCard).getByRole('button', { name: /Apply/i })).toBeInTheDocument();
  });

  it('dispatches canonical renegotiation apply for supported options and marks unsupported honestly', () => {
    mockStore = buildStore({ withPlan: true });
    mockStore.cyclesById['cycle-1'].metrics.recoveryState = 'RECOVERY_RENEGOTIATION_REQUIRED';
    mockStore.cyclesById['cycle-1'].metrics.renegotiationOptions = [
      {
        type: 'EXTEND_DEADLINE',
        summary: 'Extend deadline by 3 day(s) to restore capacity fit.',
        delta: 3,
        unit: 'days',
      },
      {
        type: 'REDUCE_SCOPE',
        summary: 'Reduce required scope by 2 block(s) to restore viability.',
        delta: 2,
        unit: 'blocks',
      },
    ];

    const { container } = render(<ZionDashboard initialView="stability" />);
    const posCard = within(container)
      .getByText(/Probability of Success/i)
      .closest('.rounded-xl');
    expect(posCard).toBeTruthy();

    const applyButtons = within(posCard).getAllByRole('button', { name: /Apply/i });
    fireEvent.click(applyButtons[0]);
    expect(stubAction).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleId: 'cycle-1',
        optionType: 'EXTEND_DEADLINE',
        optionIndex: 0,
        option: expect.objectContaining({
          type: 'EXTEND_DEADLINE',
          delta: 3,
        }),
      })
    );
    expect(within(posCard).getByRole('button', { name: /Unsupported/i })).toBeDisabled();
  });

  it('does not render legacy Pattern module in Stability view', () => {
    mockStore = buildStore({ withPlan: true });
    render(<ZionDashboard initialView="stability" />);
    expect(screen.queryByText(/^Pattern$/i)).not.toBeInTheDocument();
  });

  it('does not render legacy Distribution-by-category module in Stability view', () => {
    mockStore = buildStore({ withPlan: true });
    render(<ZionDashboard initialView="stability" />);
    expect(screen.queryByText(/Distribution \(completed\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Body:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Resources:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Creation:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Focus:/i)).not.toBeInTheDocument();
  });

  it('does not render legacy Today control panels on execution surface', () => {
    mockStore = buildStore({ withPlan: true });
    render(<ZionDashboard initialView="today" initialZionView="day" />);
    expect(screen.queryByText(/Control panels/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Calibrate capacity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Correction signals \(14d\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Suggestion history \(14d\)/i)).not.toBeInTheDocument();
  });
});
