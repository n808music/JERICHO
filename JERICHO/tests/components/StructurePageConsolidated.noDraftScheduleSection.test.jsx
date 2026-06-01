import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

const noop = vi.fn();
let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore() {
  const cycleId = 'cycle-1';
  return {
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: {
          goalId: 'goal-1',
          workWindows: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
        },
        policyState: {
          goalPolicy: {
            intakeReadiness: { state: 'fully_admitted' },
            planQuality: { state: 'policy_clean' },
            posTrust: { state: 'trusted' },
            feasibility: {
              state: 'withheld',
              substrateLevel: 'withheld',
              reasonCodes: ['FEASIBILITY_TEMPORAL_QUALITY_WEAK'],
            },
          },
        },
      },
    },
    aspirations: [],
    appTime: { activeDayKey: '2026-03-04', nowISO: '2026-03-04T12:00:00.000Z', timeZone: 'UTC' },
    debug: { lastGenerateResult: { proposedBlocksCount: 0, lastPlanErrorCode: null } },
    proposedBlocks: [],
    suggestedBlocks: [],
    lastPlanError: null,
    pendingOnboardingInputs: null,
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    updateWorkWindows: noop,
    attemptGoalAdmission: noop,
    updatePendingOnboardingInputs: noop,
    setPlanResolutionKind: noop,
    resetActiveCycle: noop,
    completeCycleReassessment: noop,
    startNewCycleWithDecision: noop,
    deleteCycle: noop,
    endCycle: noop,
    resetIdentity: noop,
  };
}

describe('StructurePageConsolidated keeps schedule generation on Today only', () => {
  beforeEach(() => {
    mockStore = buildStore();
  });

  it('does not render generate/apply/activate schedule controls in Structure', () => {
    render(<StructurePageConsolidated />);

    expect(screen.getByText(/schedule status/i)).toBeInTheDocument();
    expect(screen.getByText(/no schedule proposal yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /apply schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activate schedule/i })).not.toBeInTheDocument();
  });

  it('navigates to Today via callback when schedule status offers View in Today', () => {
    const onOpenToday = vi.fn();
    mockStore.proposedBlocks = [
      {
        id: 'pb-1',
        goalId: 'goal-1',
        cycleId: 'cycle-1',
        title: 'Draft block',
        status: 'suggested',
        startISO: '2026-03-04T09:00:00.000Z',
      },
    ];
    render(<StructurePageConsolidated onOpenToday={onOpenToday} />);

    const button = screen.getByRole('button', { name: /view in today/i });
    fireEvent.click(button);
    expect(onOpenToday).toHaveBeenCalledTimes(1);
  });

  it('shows explicit start date in definite goal overview', () => {
    mockStore.cyclesById['cycle-1'].goalContract.startDayKey = '2026-03-01';
    mockStore.cyclesById['cycle-1'].goalContract.deadlineISO = '2026-03-31T23:59:59.000Z';
    render(<StructurePageConsolidated />);

    const startDateRow = screen.getByText(/start date:/i).closest('div');
    expect(startDateRow).toBeInTheDocument();
    expect(startDateRow.textContent).not.toMatch(/n\/a/i);
  });

  it('surfaces initial feasibility separately from support forecast in policy advisory', () => {
    render(<StructurePageConsolidated />);

    expect(screen.getByText(/Initial feasibility:/i)).toBeInTheDocument();
    expect(screen.getByText(/Support forecast:/i)).toBeInTheDocument();
    expect(screen.getByText(/substrate: withheld/i)).toBeInTheDocument();
    expect(screen.getByText(/temporal quality weak/i)).toBeInTheDocument();
  });

  it('renders horizon resolution cards when the draft is horizon insufficient', () => {
    mockStore.cyclesById['cycle-1'].autoAsanaPlan = {
      summary: {
        planStatus: 'VALID_BUT_HORIZON_INSUFFICIENT',
        requiredBlockCount: 45,
        scheduledBlockCount: 26,
        unscheduledBlockCount: 19,
        candidateResolutionKinds: ['EXTEND_HORIZON', 'REDUCE_CYCLE_COUNT', 'ACCEPT_PARTIAL_PLAN'],
        recommendations: [
          {
            kind: 'EXTEND_HORIZON',
            extensionDays: 20,
            extensionWeeks: 4,
            earliestFeasibleCompletionDate: '2026-06-30',
            unscheduledBlockCount: 19,
          },
          {
            kind: 'REDUCE_CYCLE_COUNT',
            currentCycleCount: 5,
            recommendedCycleCount: 3,
            removedCycles: [4, 5],
            recoveredDays: 16,
          },
          {
            kind: 'ACCEPT_PARTIAL_PLAN',
            scheduledBlockCount: 26,
            unscheduledBlockCount: 19,
            scheduledThroughDate: '2026-06-12',
            unscheduledFromDate: '2026-06-13',
          },
        ],
      },
    };
    mockStore.proposedBlocks = [
      {
        id: 'pb-1',
        goalId: 'goal-1',
        cycleId: 'cycle-1',
        title: 'Draft block',
        status: 'suggested',
        startISO: '2026-03-04T09:00:00.000Z',
      },
    ];

    render(<StructurePageConsolidated />);

    expect(screen.getByText(/add 4 weeks to fit all 45 blocks/i)).toBeInTheDocument();
    expect(screen.getByText(/reduce from 5 to 3 cycles/i)).toBeInTheDocument();
    expect(screen.getByText(/commit 26 of 45 blocks now/i)).toBeInTheDocument();
  });

  it('dispatches cycle-only reset from cycle management', () => {
    const resetActiveCycle = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockStore.resetActiveCycle = resetActiveCycle;

    render(<StructurePageConsolidated />);

    fireEvent.click(screen.getByRole('button', { name: /Reset Cycle/i }));

    expect(resetActiveCycle).toHaveBeenCalledWith('cycle-1');
    confirmSpy.mockRestore();
  });
});
