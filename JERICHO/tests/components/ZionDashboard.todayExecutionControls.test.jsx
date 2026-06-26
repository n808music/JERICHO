import React from 'react';
import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import {
  IdentityProvider,
  DEFAULT_PROFILE_ID,
  buildBlankIdentityState,
  rehydratePersistedState,
  useIdentityStore,
} from '../../src/state/identityStore.js';
import { computeDerivedState, getCanonicalBlocks } from '../../src/state/identityCompute.js';

vi.mock('../../src/services/syncService.js', () => ({
  pushState: vi.fn(async () => {}),
  pullState: vi.fn(async () => null),
}));

const DAY_KEY = '2026-06-08';
const PRE_FLOOR_DAY_KEY = '2026-05-19';
const NEXT_DAY_KEY = '2026-06-09';
const CYCLE_ID = 'cycle-today-execution';
const GOAL_ID = 'goal-today-execution';

let capturedStore = null;

function StoreProbe() {
  capturedStore = useIdentityStore();
  return null;
}

function latestEventForBlock(events, blockId) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.blockId === blockId) {
      return event;
    }
  }
  return null;
}

function buildExecutionState() {
  const state = buildBlankIdentityState({
    activeProfileId: DEFAULT_PROFILE_ID,
    todayDate: DAY_KEY,
    nowISO: `${DAY_KEY}T12:00:00.000Z`,
    timeZone: 'UTC',
  });

  state.meta = {
    ...state.meta,
    onboardingComplete: true,
  };
  state.activeGoalId = GOAL_ID;
  state.activeCycleId = CYCLE_ID;
  state.profileAccess = {
    status: 'profile_selected',
    selectedProfileId: DEFAULT_PROFILE_ID,
    lastSelectedAtISO: `${DAY_KEY}T12:00:00.000Z`,
  };
  state.scheduleApplied = true;
  state.scheduleLifecycle = 'active_schedule';
  state.scheduleLifecycleState = 'in_execution';
  state.profilesById[DEFAULT_PROFILE_ID] = {
    ...state.profilesById[DEFAULT_PROFILE_ID],
    goalIds: [GOAL_ID],
    activeGoalId: GOAL_ID,
    status: 'active',
  };
  state.goalsById = {
    [GOAL_ID]: {
      id: GOAL_ID,
      title: 'Repair live execution truth',
      profileId: DEFAULT_PROFILE_ID,
      activeCycleId: CYCLE_ID,
    },
  };
  state.goalAdmissionByGoal = {
    [GOAL_ID]: {
      status: 'ADMITTED',
      reasonCodes: [],
      admittedAtISO: `${DAY_KEY}T12:00:00.000Z`,
    },
  };
  state.goalExecutionContract = {
    goalId: GOAL_ID,
    startDayKey: PRE_FLOOR_DAY_KEY,
    endDayKey: '2026-06-30',
    phaseLabel: 'P1',
  };

  const staleBlock = {
    id: 'blk-stale',
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    origin: 'schedule_active',
    requiredSystemBlock: true,
    practice: 'Focus',
    domain: 'Focus',
    title: 'Stale pre-floor block',
    label: 'Stale pre-floor block',
    start: '2026-05-19T09:00:00.000Z',
    end: '2026-05-19T10:00:00.000Z',
    status: 'planned',
  };
  const todayBlock = {
    id: 'blk-today',
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    origin: 'schedule_active',
    requiredSystemBlock: true,
    practice: 'Focus',
    domain: 'Focus',
    title: 'Today live block',
    label: 'Today live block',
    start: '2026-06-08T15:00:00.000Z',
    end: '2026-06-08T15:45:00.000Z',
    status: 'planned',
  };
  const nextBlock = {
    id: 'blk-next',
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    origin: 'schedule_active',
    requiredSystemBlock: true,
    practice: 'Focus',
    domain: 'Focus',
    title: 'Next day live block',
    label: 'Next day live block',
    start: '2026-06-09T10:00:00.000Z',
    end: '2026-06-09T10:45:00.000Z',
    status: 'planned',
  };

  state.blockStore = {
    blocks: {
      [staleBlock.id]: staleBlock,
      [todayBlock.id]: todayBlock,
      [nextBlock.id]: nextBlock,
    },
  };
  state.executionEvents = [
    {
      id: 'evt-stale',
      blockId: staleBlock.id,
      dateISO: PRE_FLOOR_DAY_KEY,
      minutes: 60,
      rawLabel: staleBlock.title,
      canonicalTitle: staleBlock.title,
      domain: 'Focus',
      cycleId: CYCLE_ID,
      goalId: GOAL_ID,
      origin: 'schedule_active',
      requiredSystemBlock: true,
      completed: false,
      kind: 'create',
      startISO: staleBlock.start,
      endISO: staleBlock.end,
      status: 'planned',
    },
    {
      id: 'evt-today',
      blockId: todayBlock.id,
      dateISO: DAY_KEY,
      minutes: 45,
      rawLabel: todayBlock.title,
      canonicalTitle: todayBlock.title,
      domain: 'Focus',
      cycleId: CYCLE_ID,
      goalId: GOAL_ID,
      origin: 'schedule_active',
      requiredSystemBlock: true,
      completed: false,
      kind: 'create',
      startISO: todayBlock.start,
      endISO: todayBlock.end,
      status: 'planned',
    },
    {
      id: 'evt-next',
      blockId: nextBlock.id,
      dateISO: NEXT_DAY_KEY,
      minutes: 45,
      rawLabel: nextBlock.title,
      canonicalTitle: nextBlock.title,
      domain: 'Focus',
      cycleId: CYCLE_ID,
      goalId: GOAL_ID,
      origin: 'schedule_active',
      requiredSystemBlock: true,
      completed: false,
      kind: 'create',
      startISO: nextBlock.start,
      endISO: nextBlock.end,
      status: 'planned',
    },
  ];
  state.cyclesById = {
    [CYCLE_ID]: {
      id: CYCLE_ID,
      profileId: DEFAULT_PROFILE_ID,
      status: 'active',
      scheduleLifecycle: 'active_schedule',
      startedAtDayKey: PRE_FLOOR_DAY_KEY,
      executionStartDayKey: DAY_KEY,
      scheduleGeneratedAtISO: '2026-06-07T03:11:21.442Z',
      scheduleReviewBlocks: [],
      executionEvents: [...state.executionEvents],
      goalContract: {
        goalId: GOAL_ID,
        startDayKey: PRE_FLOOR_DAY_KEY,
        endDayKey: '2026-06-30',
        phaseLabel: 'P1',
      },
    },
  };

  state.viewDate = DAY_KEY;

  return computeDerivedState(state, { type: 'NO_OP' });
}

function renderExecutionDashboard(initialState) {
  capturedStore = null;
  const user = userEvent.setup();
  const result = render(
    <IdentityProvider initialState={initialState}>
      <StoreProbe />
      <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
    </IdentityProvider>
  );
  expect(capturedStore).toBeTruthy();
  return { user, ...result };
}

describe('ZionDashboard today execution controls', () => {
  beforeEach(() => {
    capturedStore = null;
    cleanup();
    if (typeof localStorage !== 'undefined') {
      if (typeof localStorage.clear === 'function') {
        localStorage.clear();
      } else if (typeof localStorage.removeItem === 'function') {
        localStorage.removeItem('jericho-identity');
      }
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes the active today block and preserves completion across restore', async () => {
    const initialState = buildExecutionState();
    const { user, unmount } = renderExecutionDashboard(initialState);

    await user.click(await screen.findByTestId('block-blk-today'));
    await user.click(screen.getByRole('button', { name: /^Complete$/i }));

    await waitFor(() => {
      const latest = latestEventForBlock(capturedStore.getState().executionEvents || [], 'blk-today');
      expect(latest?.kind).toBe('complete');
      expect(latest?.status).toBe('completed');
      expect(capturedStore.getState().today.blocks.find((block) => block.id === 'blk-today')?.status).toBe('completed');
    });

    expect(capturedStore.getState().today.blocks.some((block) => block.id === 'blk-today' && block.status === 'planned')).toBe(false);

    const snapshot = capturedStore.getState();
    unmount();

    renderExecutionDashboard(snapshot);

    await waitFor(() => {
      expect(capturedStore.getState().today.blocks.find((block) => block.id === 'blk-today')?.status).toBe('completed');
    });
  });

  it('marks the active today block missed and surfaces missed-work pressure', async () => {
    const { user } = renderExecutionDashboard(buildExecutionState());

    await user.click(await screen.findByTestId('block-blk-today'));
    await user.click(screen.getByRole('button', { name: /^Missed$/i }));

    await waitFor(() => {
      const latest = latestEventForBlock(capturedStore.getState().executionEvents || [], 'blk-today');
      expect(latest?.kind).toBe('missed');
      expect(latest?.status).toBe('missed');
      expect(capturedStore.getState().today.blocks.find((block) => block.id === 'blk-today')?.status).toBe('missed');
      expect(capturedStore.getState().cycleDynamicsByCycleId?.[CYCLE_ID]?.totals?.missed || 0).toBeGreaterThan(0);
    });
  });

  it('opens the reschedule flow for the selected block and moves that block to the new scheduled slot', async () => {
    const { user } = renderExecutionDashboard(buildExecutionState());

    await user.click(await screen.findByTestId('block-blk-today'));
    expect(screen.getByRole('button', { name: /^Delete$/i })).toBeDisabled();

    const detailsCard = screen.getByText(/Block details/i).closest('div');
    expect(detailsCard).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^Reschedule$/i }));

    const saveButton = await within(detailsCard).findByRole('button', { name: /^Save$/i });
    const dateInput = detailsCard.querySelector('input[type="date"]');
    const timeInput = detailsCard.querySelector('input[type="time"]');
    const durationInput = detailsCard.querySelector('input[type="number"]');

    expect(dateInput).toBeTruthy();
    expect(timeInput).toBeTruthy();
    expect(durationInput).toBeTruthy();

    await act(async () => {
      fireEvent.change(dateInput, { target: { value: NEXT_DAY_KEY } });
      fireEvent.change(timeInput, { target: { value: '11:30' } });
      fireEvent.change(durationInput, { target: { value: '90' } });
    });

    await user.click(saveButton);

    await waitFor(() => {
      const rescheduledBlock = getCanonicalBlocks(capturedStore.getState()).find((block) => block.id === 'blk-today');
      expect(rescheduledBlock?.start).toBe('2026-06-09T11:30:00.000Z');
    });

    expect(capturedStore.getState().viewDate).toBe(NEXT_DAY_KEY);
    expect(capturedStore.getState().appTime.activeDayKey).toBe(DAY_KEY);
  });

  it('does not offer pre-floor stale blocks in today execution', async () => {
    renderExecutionDashboard(buildExecutionState());

    await waitFor(() => {
      expect(capturedStore.getState().today.blocks.some((block) => block.id === 'blk-stale')).toBe(false);
    });

    expect(screen.queryByTestId('block-blk-stale')).not.toBeInTheDocument();
    expect(screen.getByTestId('block-blk-today')).toBeInTheDocument();
  });

  it('clamps stale active-day rendering to the effective executable floor after reassessment', async () => {
    const initialState = buildExecutionState();
    initialState.appTime = {
      ...initialState.appTime,
      activeDayKey: '2026-05-26',
      nowISO: '2026-06-08T12:00:00.000Z',
    };
    initialState.today = {
      ...initialState.today,
      date: '2026-05-26',
    };

    renderExecutionDashboard(initialState);

    expect(screen.getByText(/Day details — 2026-06-08/i)).toBeInTheDocument();
    expect(screen.getByTestId('block-blk-today')).toBeInTheDocument();
    expect(screen.queryByTestId('block-blk-stale')).not.toBeInTheDocument();
    expect(screen.queryByText(/Day details — 2026-05-26/i)).not.toBeInTheDocument();
  });

  it('does not repopulate pre-floor May blocks after a refresh on the master-plan path', async () => {
    const initialState = buildExecutionState();
    initialState.cyclesById[CYCLE_ID] = {
      ...initialState.cyclesById[CYCLE_ID],
      source: 'master_plan',
      masterPlanId: 'plan-1',
      executionStartDayKey: null,
      reassessmentCompletedAtISO: '2026-06-07T02:29:09.880Z',
      scheduleGeneratedAtISO: '2026-06-07T03:11:21.442Z',
    };
    initialState.profilesById[DEFAULT_PROFILE_ID] = {
      ...initialState.profilesById[DEFAULT_PROFILE_ID],
      activeMasterPlanId: 'plan-1',
      masterPlanIds: ['plan-1'],
    };
    initialState.masterPlansById = {
      'plan-1': {
        id: 'plan-1',
        profileId: DEFAULT_PROFILE_ID,
        horizonStart: PRE_FLOOR_DAY_KEY,
        horizonEnd: '2031-05-19',
        fullHorizonEndDayKey: '2031-05-19',
      },
    };

    const rehydrated = rehydratePersistedState(JSON.parse(JSON.stringify(initialState)));
    renderExecutionDashboard(rehydrated);

    await waitFor(() => {
      expect(capturedStore.getState().today.blocks.some((block) => block.id === 'blk-stale')).toBe(false);
    });

    expect(capturedStore.getState().cyclesById[CYCLE_ID].executionStartDayKey).toBe('2026-06-07');
    expect(capturedStore.getState().scheduleLifecycle).toBe('applied_review');
    expect(screen.queryByTestId('block-blk-stale')).not.toBeInTheDocument();
    expect(screen.getByTestId('block-blk-today')).toBeInTheDocument();
  });

  it('keeps an explicitly selected day instead of snapping back to a stale pre-floor anchor', async () => {
    const initialState = buildExecutionState();
    initialState.appTime = {
      ...initialState.appTime,
      activeDayKey: PRE_FLOOR_DAY_KEY,
      nowISO: `${DAY_KEY}T12:00:00.000Z`,
    };
    initialState.today = {
      ...initialState.today,
      date: PRE_FLOOR_DAY_KEY,
    };
    initialState.viewDate = NEXT_DAY_KEY;
    initialState.cyclesById[CYCLE_ID] = {
      ...initialState.cyclesById[CYCLE_ID],
      executionStartDayKey: null,
      goalContract: {
        ...initialState.cyclesById[CYCLE_ID].goalContract,
        startDayKey: PRE_FLOOR_DAY_KEY,
      },
    };

    renderExecutionDashboard(initialState);

    await waitFor(() => {
      expect(screen.getByText(/Day details — 2026-06-09/i)).toBeInTheDocument();
      expect(screen.getByTestId('block-blk-next')).toBeInTheDocument();
      expect(screen.queryByText(/Day details — 2026-05-19/i)).not.toBeInTheDocument();
    });

    act(() => {
      capturedStore.setViewDate?.(DAY_KEY);
    });

    await waitFor(() => {
      expect(screen.getByText(/Day details — 2026-06-08/i)).toBeInTheDocument();
      expect(screen.getByTestId('block-blk-today')).toBeInTheDocument();
      expect(screen.queryByText(/Day details — 2026-05-19/i)).not.toBeInTheDocument();
    });
  });

  it('updates the day-view header to the selected day instead of the stale execution floor', async () => {
    const initialState = buildExecutionState();
    initialState.appTime = {
      ...initialState.appTime,
      timeZone: 'America/Chicago',
      activeDayKey: PRE_FLOOR_DAY_KEY,
      nowISO: '2026-05-19T12:00:00.000Z',
    };
    initialState.today = {
      ...initialState.today,
      date: PRE_FLOOR_DAY_KEY,
    };
    initialState.viewDate = NEXT_DAY_KEY;

    renderExecutionDashboard(initialState);

    expect(screen.getByText(/Day details — 2026-06-09/i)).toBeInTheDocument();
    expect(screen.getByText('Jun 9, 2026')).toBeInTheDocument();

    act(() => {
      capturedStore.setViewDate?.(DAY_KEY);
    });

    await waitFor(() => {
      expect(screen.getByText(/Day details — 2026-06-08/i)).toBeInTheDocument();
      expect(screen.getByText('Jun 8, 2026')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('block-blk-stale')).not.toBeInTheDocument();
    expect(capturedStore.getState().viewDate).toBe(DAY_KEY);
  });
});
