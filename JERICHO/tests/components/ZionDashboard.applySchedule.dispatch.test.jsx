import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const applyPlan = vi.fn();
const activateSchedule = vi.fn();
const rebaseSchedule = vi.fn();
const commitPreviewItems = vi.fn();
const setPlanResolutionKind = vi.fn();
const noop = vi.fn();
let mockStore = {};

function hasExactTextContent(fragment) {
  return (_, node) => Boolean(node?.textContent?.includes(fragment));
}

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore() {
  const dayKey = '2026-02-03';
  const cycleId = 'cycle-active';
  return {
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    planDraft: null,
    planCalibration: null,
    correctionSignals: null,
    suggestionEvents: [],
    proposedBlocks: [
      {
        id: 's1',
        cycleId,
        goalId: 'goal-1',
        status: 'suggested',
        title: 'Draft block',
        domain: 'FOCUS',
        durationMinutes: 45,
        dayKey,
        startISO: `${dayKey}T09:00:00.000Z`,
      },
      {
        id: 's2',
        cycleId,
        goalId: 'goal-1',
        status: 'suggested',
        title: 'Draft block day 2',
        domain: 'FOCUS',
        durationMinutes: 30,
        dayKey: '2026-02-04',
        startISO: '2026-02-04T10:00:00.000Z',
      },
    ],
    suggestedBlocks: [],
    deliverablesByCycleId: { [cycleId]: { deliverables: [], suggestionLinks: {} } },
    goalAdmissionByGoal: { 'goal-1': { status: 'ADMITTED', reasonCodes: [] } },
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    goalWorkById: {},
    constraints: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId: 'goal-1', startDayKey: '2026-02-01', endDayKey: '2026-03-01' },
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId: 'goal-1', startDayKey: '2026-02-01', endDayKey: '2026-03-01' },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    profileLearning: {},
    actions: {},
    pendingPlanConfirmation: true,
    generateScheduleForActiveCycle: noop,
    generatePlanWithLLM: noop,
    generatePlan: noop,
    commitPreviewItems,
    applyPlan,
    setPlanResolutionKind,
    activateSchedule,
    rebaseSchedule,
    resetIdentity: noop,
    setActiveCycle: noop,
    deleteCycle: noop,
    startNewCycle: noop,
    startNewCycleWithDecision: noop,
    completeBlock: noop,
    missBlock: noop,
    skipBlock: noop,
    setDefiniteGoal: noop,
    setPatternTargets: noop,
    createBlock: noop,
    updateBlock: noop,
    deleteBlock: noop,
    rescheduleBlock: noop,
    setActiveDayKey: noop,
    jumpToToday: noop,
    tickNow: noop,
    setCalibrationDays: noop,
    acceptSuggestedBlock: noop,
    acceptSuggestedBlockWithPlacement: noop,
    rejectSuggestedBlock: noop,
    ignoreSuggestedBlock: noop,
    dismissSuggestedBlock: noop,
    createDeliverable: noop,
    updateDeliverable: noop,
    deleteDeliverable: noop,
    createCriterion: noop,
    toggleCriterionDone: noop,
    deleteCriterion: noop,
    linkBlockToDeliverable: noop,
    assignSuggestionLink: noop,
  };
}

describe('ZionDashboard apply schedule dispatch wiring', () => {
  beforeEach(() => {
    applyPlan.mockClear();
    activateSchedule.mockClear();
    rebaseSchedule.mockClear();
    commitPreviewItems.mockClear();
    setPlanResolutionKind.mockClear();
    mockStore = buildStore();
  });

  async function renderDashboard() {
    let view;
    await act(async () => {
      view = render(<ZionDashboard initialView="today" initialZionView="day" />);
    });
    return view;
  }

  it('Apply schedule dispatches applyPlan for active cycle', async () => {
    await renderDashboard();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /apply schedule/i }));
    });

    expect(applyPlan).toHaveBeenCalledTimes(1);
    expect(applyPlan).toHaveBeenCalledWith({ cycleId: 'cycle-active' });
    expect(commitPreviewItems).not.toHaveBeenCalled();
  });

  it('uses cycle-local proposed blocks to enable apply and mark the active phase as generated', async () => {
    mockStore = buildStore();
    mockStore.proposedBlocks = [];
    mockStore.cyclesById['cycle-active'] = {
      ...mockStore.cyclesById['cycle-active'],
      proposedBlocks: [
        {
          id: 'cycle-proposal-1',
          cycleId: 'cycle-active',
          goalId: 'goal-1',
          status: 'suggested',
          title: 'Cycle-local draft block',
          domain: 'FOCUS',
          durationMinutes: 45,
          dayKey: '2026-02-03',
          startISO: '2026-02-03T09:00:00.000Z',
        },
      ],
    };
    mockStore.lastPlanError = {
      code: 'FEASIBILITY_MISSING_FOR_PLAN',
      reasonCodes: ['POS_FEASIBILITY_INPUT_MISSING'],
    };

    await renderDashboard();

    expect(screen.getAllByText(hasExactTextContent('Apply schedule: Ready')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Generate failed: FEASIBILITY_MISSING_FOR_PLAN/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /apply schedule/i }));
    });

    expect(applyPlan).toHaveBeenCalledTimes(1);
    expect(applyPlan).toHaveBeenCalledWith({ cycleId: 'cycle-active' });
  });

  it('shows the full proposed Sprint window when the selected day has no proposed blocks', async () => {
    mockStore = buildStore();
    mockStore.appTime = {
      nowISO: '2026-02-05T12:00:00.000Z',
      activeDayKey: '2026-02-05',
      timeZone: 'UTC',
    };
    mockStore.today = {
      ...mockStore.today,
      date: '2026-02-05',
    };
    mockStore.proposedBlocks = [
      {
        id: 'proposal-1',
        cycleId: 'cycle-active',
        goalId: 'goal-1',
        status: 'suggested',
        title: 'Draft block',
        domain: 'FOCUS',
        durationMinutes: 45,
        dayKey: '2026-02-03',
        startISO: '2026-02-03T09:00:00.000Z',
      },
      {
        id: 'proposal-2',
        cycleId: 'cycle-active',
        goalId: 'goal-1',
        status: 'suggested',
        title: 'Draft block day 2',
        domain: 'FOCUS',
        durationMinutes: 30,
        dayKey: '2026-02-04',
        startISO: '2026-02-04T10:00:00.000Z',
      },
    ];

    await renderDashboard();

    expect(
      screen.getByText(/proposed blocks exist across the sprint window\. showing full proposal:/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Draft block')).toBeInTheDocument();
    expect(screen.getByText('Draft block day 2')).toBeInTheDocument();
    expect(screen.queryByText(/no proposed schedule blocks yet/i)).not.toBeInTheDocument();
  });

  it('surfaces master-plan first-cycle proposals even when classic goal admission is not present', async () => {
    mockStore = buildStore();
    mockStore.activeProfileId = 'profile-1';
    mockStore.appTime = {
      nowISO: '2026-02-05T12:00:00.000Z',
      activeDayKey: '2026-02-05',
      timeZone: 'UTC',
    };
    mockStore.today = {
      ...mockStore.today,
      date: '2026-02-05',
    };
    mockStore.profilesById = {
      'profile-1': {
        id: 'profile-1',
        activeMasterPlanId: 'plan-1',
        goalIds: ['goal-1'],
      },
    };
    mockStore.masterPlansById = {
      'plan-1': {
        id: 'plan-1',
        laneIds: ['lane-1'],
      },
    };
    mockStore.goalAdmissionByGoal = {
      'goal-1': { status: 'PENDING' },
    };

    await renderDashboard();

    expect(screen.getByText(/showing full proposal:/i)).toBeInTheDocument();
    expect(screen.getByText('Draft block')).toBeInTheDocument();
    expect(screen.queryByText(/no proposed schedule blocks yet/i)).not.toBeInTheDocument();
  });

  it('keeps pending first-cycle proposals visible and applicable even when the executable floor moves later', async () => {
    mockStore = buildStore();
    mockStore.appTime = {
      nowISO: '2026-06-15T12:00:00.000Z',
      activeDayKey: '2026-06-15',
      timeZone: 'America/Chicago',
    };
    mockStore.today = {
      ...mockStore.today,
      date: '2026-06-15',
    };
    mockStore.proposedBlocks = [
      {
        id: 'proposal-1',
        cycleId: 'cycle-active',
        goalId: 'goal-1',
        status: 'suggested',
        title: 'Draft block before floor',
        domain: 'FOCUS',
        durationMinutes: 45,
        dayKey: '2026-06-12',
        startISO: '2026-06-12T14:00:00.000Z',
      },
      {
        id: 'proposal-2',
        cycleId: 'cycle-active',
        goalId: 'goal-1',
        status: 'suggested',
        title: 'Draft block before floor day 2',
        domain: 'FOCUS',
        durationMinutes: 30,
        dayKey: '2026-06-13',
        startISO: '2026-06-13T14:00:00.000Z',
      },
    ];
    mockStore.cyclesById['cycle-active'] = {
      ...mockStore.cyclesById['cycle-active'],
      source: 'master_plan',
      startedAtDayKey: '2026-06-12',
      reassessmentCompletedAtISO: '2026-06-15T12:00:00.000Z',
      scheduleGeneratedAtISO: '2026-06-15T12:05:00.000Z',
      goalContract: {
        ...mockStore.cyclesById['cycle-active'].goalContract,
        startDayKey: '2026-06-12',
        endDayKey: '2026-06-15',
      },
      autoAsanaPlan: {
        summary: {
          scheduledBlockCount: 2,
          scheduledMinutes: 75,
          unscheduledBlockCount: 0,
          unscheduledMinutes: 0,
          calendarCoverageThroughDayKey: '2026-06-15',
          coverageStatus: 'complete_to_anchor',
          activePhaseDeadlineDayKey: '2026-06-15',
        },
      },
    };

    await renderDashboard();

    expect(screen.queryByText(/no proposed schedule blocks yet/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(hasExactTextContent('Apply schedule: Ready')).length).toBeGreaterThan(0);
    expect(screen.getByText(/proposed blocks exist across the sprint window\. showing full proposal:/i)).toBeInTheDocument();
    expect(screen.getByText('Draft block before floor')).toBeInTheDocument();
    expect(screen.getByText('Draft block before floor day 2')).toBeInTheDocument();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /apply schedule/i }));
    });

    expect(applyPlan).toHaveBeenCalledWith({ cycleId: 'cycle-active' });
  });

  it('falls back to commitPreviewItems only when applyPlan is unavailable', async () => {
    mockStore = buildStore();
    mockStore.applyPlan = undefined;

    await renderDashboard();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /apply schedule/i }));
    });

    expect(commitPreviewItems).toHaveBeenCalledTimes(1);
    expect(applyPlan).not.toHaveBeenCalled();
  });

  it('blocks stale generated proposals from being applied on the next local day', async () => {
    mockStore = buildStore();
    mockStore.appTime = {
      nowISO: '2026-02-04T12:00:00.000Z',
      activeDayKey: '2026-02-04',
      timeZone: 'UTC',
    };
    mockStore.today = {
      ...mockStore.today,
      date: '2026-02-04',
    };
    mockStore.cyclesById['cycle-active'] = {
      ...mockStore.cyclesById['cycle-active'],
      scheduleGeneratedAtISO: '2026-02-03T12:00:00.000Z',
    };

    await renderDashboard();

    expect(screen.getByText(/Generated Sprint expired/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply schedule/i })).toBeDisabled();
  });

  it('Activate schedule dispatches activateSchedule once review blocks exist', async () => {
    mockStore = buildStore();
    mockStore.proposedBlocks = [];
    mockStore.pendingPlanConfirmation = false;
    mockStore.cyclesById['cycle-active'] = {
      ...mockStore.cyclesById['cycle-active'],
      scheduleLifecycle: 'applied_review',
      scheduleReviewBlocks: [
        {
          id: 'review-1',
          cycleId: 'cycle-active',
          goalId: 'goal-1',
          status: 'planned',
          title: 'Review block',
          domain: 'FOCUS',
          durationMinutes: 45,
          dayKey: '2026-02-03',
          startISO: '2026-02-03T09:00:00.000Z',
        },
      ],
    };

    await renderDashboard();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /activate schedule/i })[1]);
    });

    expect(activateSchedule).toHaveBeenCalledTimes(1);
    expect(activateSchedule).toHaveBeenCalledWith({ cycleId: 'cycle-active' });
    expect(applyPlan).not.toHaveBeenCalled();
  });

  it('renders applied review times in the app timezone instead of browser-local time', async () => {
    mockStore = buildStore();
    mockStore.proposedBlocks = [];
    mockStore.pendingPlanConfirmation = false;
    mockStore.appTime = {
      nowISO: '2026-02-03T12:00:00.000Z',
      activeDayKey: '2026-02-03',
      timeZone: 'America/Chicago',
    };
    mockStore.cyclesById['cycle-active'] = {
      ...mockStore.cyclesById['cycle-active'],
      scheduleLifecycle: 'applied_review',
      scheduleReviewBlocks: [
        {
          id: 'review-1',
          cycleId: 'cycle-active',
          goalId: 'goal-1',
          status: 'planned',
          title: 'Review block',
          label: 'Review block',
          practice: 'FOCUS',
          domain: 'FOCUS',
          durationMinutes: 45,
          dayKey: '2026-06-15',
          startISO: '2026-06-15T14:00:00.000Z',
          endISO: '2026-06-15T14:45:00.000Z',
          start: '2026-06-15T14:00:00.000Z',
          end: '2026-06-15T14:45:00.000Z',
          requiredSystemBlock: true,
        },
      ],
    };

    await renderDashboard();

    expect(screen.getByText('09:00')).toBeInTheDocument();
  });

  it('surfaces applied-but-not-active state and disables execution controls before activation', async () => {
    mockStore = buildStore();
    mockStore.proposedBlocks = [];
    mockStore.pendingPlanConfirmation = false;
    mockStore.today.blocks = [
      {
        id: 'review-1',
        cycleId: 'cycle-active',
        goalId: 'goal-1',
        status: 'planned',
        title: 'Review block',
        label: 'Review block',
        practice: 'FOCUS',
        domain: 'FOCUS',
        start: '2026-02-03T09:00:00.000Z',
        end: '2026-02-03T09:45:00.000Z',
      },
    ];
    mockStore.cycle = [{ date: '2026-02-03', blocks: [...mockStore.today.blocks] }];
    mockStore.blockStore = { blocks: { 'review-1': { ...mockStore.today.blocks[0] } } };
    mockStore.cyclesById['cycle-active'] = {
      ...mockStore.cyclesById['cycle-active'],
      scheduleLifecycle: 'applied_review',
      scheduleReviewBlocks: [
        {
          id: 'review-1',
          cycleId: 'cycle-active',
          goalId: 'goal-1',
          status: 'planned',
          title: 'Review block',
          label: 'Review block',
          practice: 'FOCUS',
          domain: 'FOCUS',
          durationMinutes: 45,
          dayKey: '2026-02-03',
          startISO: '2026-02-03T09:00:00.000Z',
          endISO: '2026-02-03T09:45:00.000Z',
          start: '2026-02-03T09:00:00.000Z',
          end: '2026-02-03T09:45:00.000Z',
          requiredSystemBlock: true,
        },
      ],
    };

    await renderDashboard();

    expect(screen.getByText(/Schedule applied — not active yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Today completion, miss, and reschedule controls stay disabled until activation/i)
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getAllByText(/Review block/i)[0]);
    });

    expect(screen.getByRole('button', { name: /^Complete$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Missed$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Reschedule$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Edit$/i })).toBeDisabled();
  });

  it('offers Rebase from today and dispatches rebaseSchedule when temporal drift blocks activation', async () => {
    mockStore = buildStore();
    mockStore.proposedBlocks = [];
    mockStore.pendingPlanConfirmation = false;
    mockStore.lastPlanError = {
      code: 'SCHEDULE_REBASE_REQUIRED',
      reasonCodes: ['PAST_DATED_UNEXECUTED_BLOCKS', 'SCHEDULE_REBASE_REQUIRED'],
      meta: { executionStartDayKey: '2026-02-03' },
    };
    mockStore.cyclesById['cycle-active'] = {
      ...mockStore.cyclesById['cycle-active'],
      scheduleLifecycle: 'applied_review',
      temporalStatus: 'rebase_required',
      scheduleReviewBlocks: [
        {
          id: 'review-1',
          cycleId: 'cycle-active',
          goalId: 'goal-1',
          status: 'planned',
          title: 'Review block',
          label: 'Review block',
          practice: 'FOCUS',
          domain: 'FOCUS',
          durationMinutes: 45,
          dayKey: '2026-01-29',
          startISO: '2026-01-29T09:00:00.000Z',
          endISO: '2026-01-29T09:45:00.000Z',
          start: '2026-01-29T09:00:00.000Z',
          end: '2026-01-29T09:45:00.000Z',
        },
      ],
    };

    await renderDashboard();

    expect(screen.getByRole('button', { name: /rebase from today/i })).toBeInTheDocument();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /rebase from today/i }));
    });

    expect(rebaseSchedule).toHaveBeenCalledTimes(1);
    expect(rebaseSchedule).toHaveBeenCalledWith({
      cycleId: 'cycle-active',
      executionStartDayKey: '2026-02-03',
    });
  });

  it('asks what happened during an activation delay and dispatches none-happened rebase resolution', async () => {
    mockStore = buildStore();
    mockStore.proposedBlocks = [];
    mockStore.pendingPlanConfirmation = false;
    mockStore.lastPlanError = {
      code: 'ACTIVATION_DELAY_REASSESSMENT_REQUIRED',
      reasonCodes: [
        'ACTIVATION_DELAY_REASSESSMENT_REQUIRED',
        'APPLIED_TO_ACTIVATION_GAP_DETECTED',
        'USER_CONFIRMATION_REQUIRED_FOR_DELAY_WINDOW',
        'DELAY_WINDOW_EXECUTION_UNKNOWN',
      ],
      meta: {
        appliedStartDayKey: '2026-01-29',
        requestedExecutionStartDayKey: '2026-02-03',
        executionStartDayKey: '2026-02-03',
      },
    };
    mockStore.cyclesById['cycle-active'] = {
      ...mockStore.cyclesById['cycle-active'],
      scheduleLifecycle: 'applied_review',
      activationDelayAssessment: {
        status: 'requires_user_investigation',
        appliedStartDayKey: '2026-01-29',
        requestedExecutionStartDayKey: '2026-02-03',
      },
      scheduleReviewBlocks: [
        {
          id: 'review-1',
          cycleId: 'cycle-active',
          goalId: 'goal-1',
          status: 'planned',
          title: 'Review block',
          label: 'Review block',
          practice: 'FOCUS',
          domain: 'FOCUS',
          durationMinutes: 45,
          dayKey: '2026-01-29',
          startISO: '2026-01-29T09:00:00.000Z',
          endISO: '2026-01-29T09:45:00.000Z',
          start: '2026-01-29T09:00:00.000Z',
          end: '2026-01-29T09:45:00.000Z',
        },
      ],
    };

    await renderDashboard();

    expect(screen.getAllByRole('button', { name: /none happened - rebase from today/i }).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /none happened - rebase from today/i })[0]);
    });

    expect(rebaseSchedule).toHaveBeenCalledTimes(1);
    expect(rebaseSchedule).toHaveBeenCalledWith({
      cycleId: 'cycle-active',
      executionStartDayKey: '2026-02-03',
      activationDelayResolution: 'rebase',
      workHappenedDuringDelay: 'none',
    });
  });

  it('locks apply until a horizon resolution is selected and forwards the selected kind', async () => {
    mockStore = {
      ...buildStore(),
      cyclesById: {
        'cycle-active': {
          ...buildStore().cyclesById['cycle-active'],
          autoAsanaPlan: {
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
                  earliestFeasibleCompletionDate: '2026-03-30',
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
                  scheduledThroughDate: '2026-03-12',
                  unscheduledFromDate: '2026-03-13',
                },
              ],
            },
          },
        },
      },
    };

    const user = userEvent.setup();
    const view = await renderDashboard();

    expect(screen.getByRole('button', { name: /resolve horizon conflict to apply/i })).toBeDisabled();

    await act(async () => {
      await user.click(screen.getAllByRole('button', { name: /^select$/i })[0]);
    });
    expect(setPlanResolutionKind).toHaveBeenCalledWith({ cycleId: 'cycle-active', kind: 'EXTEND_HORIZON' });

    mockStore = {
      ...mockStore,
      cyclesById: {
        ...mockStore.cyclesById,
        'cycle-active': {
          ...mockStore.cyclesById['cycle-active'],
          selectedPlanResolutionKind: 'EXTEND_HORIZON',
        },
      },
    };

    await act(async () => {
      view.rerender(<ZionDashboard initialView="today" initialZionView="day" />);
    });
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /apply schedule/i }));
    });

    expect(applyPlan).toHaveBeenCalledWith({ cycleId: 'cycle-active', resolutionKind: 'EXTEND_HORIZON' });
  });

  it('renders commerce readiness metadata on proposed commerce blocks', async () => {
    mockStore = buildStore();
    mockStore.proposedBlocks = [
      {
        id: 's1',
        cycleId: 'cycle-active',
        goalId: 'goal-1',
        status: 'suggested',
        title: 'Define launch offer promise, pack size, price hypothesis, and buyer guarantee',
        domain: 'FOCUS',
        durationMinutes: 45,
        dayKey: '2026-02-03',
        startISO: '2026-02-03T09:00:00.000Z',
        commerceReadinessLevel: 'hypothesis',
      },
    ];

    await renderDashboard();

    expect(screen.getByText(/commerce readiness: hypothesis/i)).toBeInTheDocument();
  });
});
