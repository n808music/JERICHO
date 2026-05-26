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
      screen.getByText(/Today completion, miss, and skip logging stay disabled until activation/i)
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getAllByText(/Review block/i)[0]);
    });

    expect(screen.queryByRole('button', { name: /^Complete$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Missed$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Skipped$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit$/i })).not.toBeInTheDocument();
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
