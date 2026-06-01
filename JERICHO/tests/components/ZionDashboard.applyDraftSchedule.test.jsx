import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider, useIdentityStore } from '../../src/state/identityStore.js';

const DAY_KEY = '2026-01-20';
const BASE_PLANNING_ANSWERS = {
  goalClassification: 'other',
  executionContext: 'part_time',
  weeklyHoursAvailable: 10,
  capitalAvailable: 5000,
  hardDeadline: '2026-02-19',
  existingDomainRelationships: [],
};
let capturedStore = null;

function StoreProbe() {
  capturedStore = useIdentityStore();
  return null;
}

function buildDraftState() {
  const cycleId = 'cycle-active';
  return {
    vector: {},
    lenses: {
      aim: { description: '', horizon: '90d' },
      pattern: { dailyTargets: [], flow: { streams: [] } },
      flow: { streams: [] },
    },
    today: { date: DAY_KEY, blocks: [], completionRate: 0, practices: [], loadByPractice: {} },
    currentWeek: { weekStart: DAY_KEY, days: [] },
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    lastAdaptedDate: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    suggestionEvents: [],
    proposedBlocks: [
      {
        id: 's1',
        goalId: 'goal-1',
        cycleId,
        title: 'Write vocals',
        domain: 'CREATION',
        durationMinutes: 60,
        status: 'suggested',
        startISO: '2026-01-20T09:00:00.000Z',
        dayKey: DAY_KEY,
      },
    ],
    proposedBlocksByCycleId: {
      [cycleId]: [
        {
          id: 's1',
          goalId: 'goal-1',
          cycleId,
          title: 'Write vocals',
          domain: 'CREATION',
          durationMinutes: 60,
          status: 'suggested',
          startISO: '2026-01-20T09:00:00.000Z',
          dayKey: DAY_KEY,
        },
      ],
    },
    suggestedBlocks: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    constraints: {},
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    appTime: { timeZone: 'UTC', nowISO: `${DAY_KEY}T08:00:00.000Z`, activeDayKey: DAY_KEY, isFollowingNow: true },
    profileLearning: {},
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId: 'goal-1', startDateISO: `${DAY_KEY}T00:00:00.000Z` },
        coldPlan: {
          forecastByDayKey: {
            [DAY_KEY]: { totalBlocks: 1, summary: 'Forecast' },
          },
          dailyProjection: { forecastByDayKey: {} },
        },
        autoAsanaPlan: {
          horizonBlocks: [
            {
              id: 's1',
              title: 'Write vocals',
              dayKey: DAY_KEY,
              startISO: '2026-01-20T09:00:00.000Z',
              durationMinutes: 60,
            },
          ],
          conflicts: [],
        },
        summary: { completionCount: 0, completionRate: 0 },
      },
    },
    goalExecutionContract: { goalId: 'goal-1', startDateISO: `${DAY_KEY}T00:00:00.000Z` },
    planDraft: { blocksPerWeek: 4, daysPerWeek: 4, primaryDomain: 'CREATION', minutesPerDay: 90 },
    planCalibration: null,
    correctionSignals: null,
    deliverables: [],
    goalDirective: { goalId: 'goal-1', directiveId: 'dir-1' },
    directiveEligibilityByGoal: { 'goal-1': { eligible: true } },
    pendingPlanConfirmation: true,
    scheduleApplied: false,
  };
}

describe('ZionDashboard apply draft schedule', () => {
  it('does not materialize stale seeded preview state when no live canonical proposals remain', async () => {
    capturedStore = null;
    render(
      <IdentityProvider initialState={buildDraftState()}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.queryByTestId('ghost-suggested:s1')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Write vocals/i).length).toBeGreaterThan(0);
    expect(capturedStore).toBeTruthy();

    const applyButton = screen.getByRole('button', { name: /Apply schedule/i });
    const user = userEvent.setup();
    await act(async () => {
      await user.click(applyButton);
    });

    await waitFor(() => {
      expect(capturedStore.getState().lastPlanError?.code).toBe('NO_PROPOSED_BLOCKS');
    });

    expect(screen.queryAllByText(/Write vocals/i)).toHaveLength(0);
  });

  it('surfaces committed schedule state instead of empty draft copy when the cycle already has applied blocks', () => {
    capturedStore = null;
    const state = buildDraftState();
    state.proposedBlocks = [];
    state.proposedBlocksByCycleId = { [state.activeCycleId]: [] };
    state.pendingPlanConfirmation = false;
    state.scheduleApplied = true;
    state.lastPlanError = null;
    state.cycle = [
      {
        date: '2026-01-22',
        blocks: [
          {
            id: 'blk-committed-1',
            cycleId: state.activeCycleId,
            goalId: 'goal-1',
            title: 'Committed mix pass',
            label: 'Committed mix pass',
            start: '2026-01-22T09:00:00.000Z',
            end: '2026-01-22T10:00:00.000Z',
            status: 'planned',
            domain: 'CREATION',
            practice: 'CREATION',
          },
        ],
      },
    ];

    render(
      <IdentityProvider initialState={state}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.getByText(/already has 1 scheduled block across 1 scheduled day/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Jump to first scheduled day/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View review schedule/i })).toBeInTheDocument();
    expect(screen.queryByText(/No proposed schedule blocks yet\. Generate schedule first\./i)).not.toBeInTheDocument();
  });

  it('renders repeated review sessions with distinct labels while preserving canonical titles', () => {
    capturedStore = null;
    const state = buildDraftState();
    state.proposedBlocks = [];
    state.proposedBlocksByCycleId = { [state.activeCycleId]: [] };
    state.pendingPlanConfirmation = false;
    state.scheduleApplied = true;
    state.lastPlanError = null;
    state.cycle = [];
    state.cyclesById[state.activeCycleId].scheduleLifecycle = 'applied_review';
    state.cyclesById[state.activeCycleId].scheduleReviewBlocks = [
      {
        id: 'blk-review-1',
        cycleId: state.activeCycleId,
        goalId: 'goal-1',
        title: 'Draft creative brief',
        displayTitle: 'Draft creative brief — Session 1 of 2',
        label: 'Draft creative brief',
        start: '2026-01-22T09:00:00.000Z',
        end: '2026-01-22T10:00:00.000Z',
        status: 'planned',
        domain: 'CREATION',
        practice: 'CREATION',
        deliverableId: 'deliv-1',
        actionId: 'act-1',
        sessionIndex: 0,
      },
      {
        id: 'blk-review-2',
        cycleId: state.activeCycleId,
        goalId: 'goal-1',
        title: 'Draft creative brief',
        displayTitle: 'Draft creative brief — Session 2 of 2',
        label: 'Draft creative brief',
        start: '2026-01-22T10:00:00.000Z',
        end: '2026-01-22T11:00:00.000Z',
        status: 'planned',
        domain: 'CREATION',
        practice: 'CREATION',
        deliverableId: 'deliv-1',
        actionId: 'act-1',
        sessionIndex: 1,
      },
      {
        id: 'blk-review-3',
        cycleId: state.activeCycleId,
        goalId: 'goal-1',
        title: 'Single pass block',
        label: 'Single pass block',
        start: '2026-01-22T11:00:00.000Z',
        end: '2026-01-22T11:30:00.000Z',
        status: 'planned',
        domain: 'CREATION',
        practice: 'CREATION',
        deliverableId: 'deliv-2',
        actionId: 'act-2',
        sessionIndex: 0,
      },
    ];

    render(
      <IdentityProvider initialState={state}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.getByText(/Draft creative brief — Session 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Draft creative brief — Session 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Single pass block/i)).toBeInTheDocument();
  });

  it('renders committed blocks for the active cycle even if persisted event goal ids lag the current contract goal id', () => {
    capturedStore = null;
    const state = buildDraftState();
    state.proposedBlocks = [];
    state.proposedBlocksByCycleId = { [state.activeCycleId]: [] };
    state.pendingPlanConfirmation = false;
    state.scheduleApplied = true;
    state.lastPlanError = null;
    state.cycle = [
      {
        date: '2026-01-22',
        blocks: [
          {
            id: 'blk-committed-goal-lag',
            cycleId: state.activeCycleId,
            goalId: 'goal-stale',
            title: 'Committed stale-goal block',
            label: 'Committed stale-goal block',
            start: '2026-01-22T09:00:00.000Z',
            end: '2026-01-22T10:00:00.000Z',
            status: 'planned',
            domain: 'CREATION',
            practice: 'CREATION',
          },
        ],
      },
    ];

    render(
      <IdentityProvider initialState={state}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.getByText(/Committed stale-goal block/i)).toBeInTheDocument();
  });

  it('does not place draft proposals on the month calendar before apply', () => {
    capturedStore = null;
    const state = buildDraftState();
    state.scheduleApplied = false;
    state.pendingPlanConfirmation = true;
    state.cyclesById[state.activeCycleId].scheduleLifecycle = 'draft_schedule_ready';
    state.cyclesById[state.activeCycleId].scheduleReviewBlocks = [];

    render(
      <IdentityProvider initialState={state}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.queryByText(/Write vocals/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Review canonical horizon/i)).not.toBeInTheDocument();
  });

  it('ignores inherited review blocks from a previous cycle and goal', () => {
    capturedStore = null;
    const state = buildDraftState();
    state.proposedBlocks = [];
    state.proposedBlocksByCycleId = { [state.activeCycleId]: [] };
    state.pendingPlanConfirmation = false;
    state.scheduleApplied = true;
    state.cyclesById[state.activeCycleId].scheduleLifecycle = 'applied_review';
    state.cyclesById[state.activeCycleId].scheduleReviewBlocks = [
      {
        id: 'old-review-block',
        cycleId: 'cycle-old',
        goalId: 'goal-old',
        title: 'Previous cycle task',
        start: '2026-01-22T09:00:00.000Z',
        end: '2026-01-22T10:00:00.000Z',
        status: 'planned',
        domain: 'CREATION',
        practice: 'CREATION',
      },
    ];

    render(
      <IdentityProvider initialState={state}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.queryByText(/Previous cycle task/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Review canonical horizon/i)).not.toBeInTheDocument();
  });

  it('does not show a full-horizon coverage warning for an applied review schedule with canonical blocks', () => {
    capturedStore = null;
    const state = buildDraftState();
    state.proposedBlocks = [];
    state.proposedBlocksByCycleId = { [state.activeCycleId]: [] };
    state.pendingPlanConfirmation = false;
    state.scheduleApplied = true;
    state.goalExecutionContract = {
      ...state.goalExecutionContract,
      endDayKey: '2026-03-31',
    };
    state.cyclesById[state.activeCycleId].goalContract = {
      ...state.cyclesById[state.activeCycleId].goalContract,
      endDayKey: '2026-03-31',
    };
    state.cyclesById[state.activeCycleId].scheduleLifecycle = 'applied_review';
    state.cyclesById[state.activeCycleId].scheduleReviewBlocks = [
      {
        id: 'review-horizon-1',
        cycleId: state.activeCycleId,
        goalId: 'goal-1',
        title: 'Canonical review block',
        start: '2026-01-22T09:00:00.000Z',
        end: '2026-01-22T10:00:00.000Z',
        status: 'planned',
        domain: 'CREATION',
        practice: 'CREATION',
      },
      {
        id: 'review-horizon-2',
        cycleId: state.activeCycleId,
        goalId: 'goal-1',
        title: 'Later canonical review block',
        start: '2026-03-10T09:00:00.000Z',
        end: '2026-03-10T10:00:00.000Z',
        status: 'planned',
        domain: 'CREATION',
        practice: 'CREATION',
      },
    ];

    render(
      <IdentityProvider initialState={state}>
        <StoreProbe />
        <ZionDashboard initialView="stability" initialZionView="month" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(
      screen.queryByText(/Canonical schedule coverage is not yet visible across the full contract horizon/i)
    ).not.toBeInTheDocument();
  });

  it('renders active schedule blocks from the canonical block store when review and cycle slices are empty', () => {
    capturedStore = null;
    const state = buildDraftState();
    state.proposedBlocks = [];
    state.proposedBlocksByCycleId = { [state.activeCycleId]: [] };
    state.pendingPlanConfirmation = false;
    state.scheduleApplied = true;
    state.lastPlanError = null;
    state.cycle = [];
    state.executionEvents = [];
    state.blockStore = {
      blocks: {
        'blk-store-active-1': {
          id: 'blk-store-active-1',
          cycleId: state.activeCycleId,
          goalId: 'goal-1',
          origin: 'schedule_active',
          requiredSystemBlock: true,
          title: 'Canonical active block',
          label: 'Canonical active block',
          start: '2026-01-22T09:00:00.000Z',
          end: '2026-01-22T10:00:00.000Z',
          status: 'planned',
          domain: 'CREATION',
          practice: 'CREATION',
        },
      },
    };
    state.cyclesById[state.activeCycleId].scheduleLifecycle = 'active_schedule';
    state.cyclesById[state.activeCycleId].scheduleReviewBlocks = [];

    render(
      <IdentityProvider initialState={state}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.getByText(/Canonical active block/i)).toBeInTheDocument();
    expect(screen.getByText(/1 active block across 1 scheduled day/i)).toBeInTheDocument();
  });

  it('falls back to canonical proposed blocks when a refreshed active schedule has no committed visible blocks', () => {
    capturedStore = null;
    const state = buildDraftState();
    state.pendingPlanConfirmation = false;
    state.scheduleApplied = true;
    state.lastPlanError = null;
    state.cycle = [];
    state.executionEvents = [];
    state.blockStore = { blocks: {} };
    state.cyclesById[state.activeCycleId].scheduleLifecycle = 'active_schedule';
    state.cyclesById[state.activeCycleId].scheduleReviewBlocks = [];

    render(
      <IdentityProvider initialState={state}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.getByText(/Write vocals/i)).toBeInTheDocument();
  });

  it('allows Generate schedule to rebuild a stale active cycle with no visible canonical blocks', async () => {
    capturedStore = null;
    const state = buildDraftState();
    state.proposedBlocks = [];
    state.proposedBlocksByCycleId = { [state.activeCycleId]: [] };
    state.pendingPlanConfirmation = false;
    state.scheduleApplied = true;
    state.lastPlanError = null;
    state.cycle = [];
    state.executionEvents = [];
    state.goalDraftV2 = {
      goalText: 'Build job-ready SQL and dashboard analysis skills in 30 days',
      goalLabel: 'Build job-ready SQL and dashboard analysis skills in 30 days',
      executionType: 'SkillAcquisition',
      startDate: DAY_KEY,
      answeredContext: BASE_PLANNING_ANSWERS,
    };
    state.goalExecutionContract = {
      goalId: 'goal-1',
      goalText: 'Build job-ready SQL and dashboard analysis skills in 30 days',
      executionType: 'SkillAcquisition',
      startDayKey: DAY_KEY,
      endDayKey: '2026-02-19',
    };
    state.goalAdmissionByGoal = {
      'goal-1': {
        status: 'ADMITTED',
        reasonCodes: [],
      },
    };
    state.cyclesById[state.activeCycleId].goalDraftV2 = state.goalDraftV2;
    state.cyclesById[state.activeCycleId].goalContract = {
      goalId: 'goal-1',
      goalText: 'Build job-ready SQL and dashboard analysis skills in 30 days',
      executionType: 'SkillAcquisition',
      startDayKey: DAY_KEY,
      endDayKey: '2026-02-19',
      workWindows: {
        mon: [{ startHHMM: '09:00', endHHMM: '17:00' }],
        tue: [{ startHHMM: '09:00', endHHMM: '17:00' }],
        wed: [{ startHHMM: '09:00', endHHMM: '17:00' }],
        thu: [{ startHHMM: '09:00', endHHMM: '17:00' }],
        fri: [{ startHHMM: '09:00', endHHMM: '17:00' }],
      },
    };
    state.cyclesById[state.activeCycleId].scheduleLifecycle = 'active_schedule';
    state.cyclesById[state.activeCycleId].scheduleReviewBlocks = [];
    state.cyclesById[state.activeCycleId].planProof = {
      workableDaysRemaining: 14,
      totalRequiredUnits: 1,
      requiredPacePerDay: 1,
      maxPerDay: 1,
      maxPerWeek: 7,
      slackUnits: 13,
      slackRatio: 13,
      intensityRatio: 1,
    };
    state.blockStore = { blocks: {} };

    render(
      <IdentityProvider initialState={state}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.getByText(/active schedule is currently empty in the visible canonical store/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Generate schedule/i }));
    });

    await waitFor(() => {
      expect((capturedStore.getState().proposedBlocks || []).length).toBeGreaterThan(0);
      expect(capturedStore.getState().pendingPlanConfirmation).toBe(true);
    });
  }, 15000);

  it('rebuilds committed calendar blocks from active cycle execution events when cycle day groups are stale', () => {
    capturedStore = null;
    const state = buildDraftState();
    state.proposedBlocks = [];
    state.proposedBlocksByCycleId = { [state.activeCycleId]: [] };
    state.pendingPlanConfirmation = false;
    state.scheduleApplied = true;
    state.lastPlanError = null;
    state.cycle = [];
    state.executionEvents = [];
    state.cyclesById[state.activeCycleId].executionEvents = [
      {
        id: 'evt-create-stale-cycle',
        blockId: 'blk-evt-only',
        dateISO: '2026-01-24',
        minutes: 60,
        rawLabel: 'Committed from execution events',
        domain: 'Creation',
        cycleId: state.activeCycleId,
        goalId: 'goal-stale',
        completed: false,
        kind: 'create',
        startISO: '2026-01-24T09:00:00.000Z',
        endISO: '2026-01-24T10:00:00.000Z',
        status: 'planned',
        origin: 'suggested_apply',
      },
    ];

    render(
      <IdentityProvider initialState={state}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.getByText(/Committed from execution events/i)).toBeInTheDocument();
  });

  it('renders canonical titles from execution events even when raw labels are generic', () => {
    capturedStore = null;
    const state = buildDraftState();
    state.proposedBlocks = [];
    state.proposedBlocksByCycleId = { [state.activeCycleId]: [] };
    state.pendingPlanConfirmation = false;
    state.scheduleApplied = true;
    state.lastPlanError = null;
    state.cycle = [];
    state.executionEvents = [];
    state.cyclesById[state.activeCycleId].executionEvents = [
      {
        id: 'evt-create-episode-1',
        blockId: 'blk-episode-1',
        dateISO: '2026-01-24',
        minutes: 60,
        rawLabel: 'Create production outline and scene/content map',
        canonicalTitle: 'Record episode 1',
        domain: 'Creation',
        cycleId: state.activeCycleId,
        goalId: 'goal-1',
        completed: false,
        kind: 'create',
        startISO: '2026-01-24T09:00:00.000Z',
        endISO: '2026-01-24T10:00:00.000Z',
        status: 'planned',
        origin: 'suggested_apply',
      },
    ];

    render(
      <IdentityProvider initialState={state}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.getByText(/Record episode 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/Create production outline and scene\/content map/i)).not.toBeInTheDocument();
  });

  it('prefers the fuller committed horizon from execution events when rendered cycle blocks only reflect the current month slice', async () => {
    capturedStore = null;
    const state = buildDraftState();
    state.proposedBlocks = [];
    state.proposedBlocksByCycleId = { [state.activeCycleId]: [] };
    state.pendingPlanConfirmation = false;
    state.scheduleApplied = true;
    state.lastPlanError = null;
    state.cycle = [
      {
        date: '2026-01-20',
        blocks: [
          {
            id: 'blk-march-visible-slice',
            cycleId: state.activeCycleId,
            goalId: 'goal-1',
            title: 'Visible month slice only',
            label: 'Visible month slice only',
            start: '2026-01-20T09:00:00.000Z',
            end: '2026-01-20T10:00:00.000Z',
            status: 'planned',
            domain: 'CREATION',
            practice: 'CREATION',
          },
        ],
      },
    ];
    state.cyclesById[state.activeCycleId].executionEvents = [
      {
        id: 'evt-create-jan',
        blockId: 'blk-march-visible-slice',
        dateISO: '2026-01-20',
        minutes: 60,
        rawLabel: 'Visible month slice only',
        domain: 'Creation',
        cycleId: state.activeCycleId,
        goalId: 'goal-1',
        completed: false,
        kind: 'create',
        startISO: '2026-01-20T09:00:00.000Z',
        endISO: '2026-01-20T10:00:00.000Z',
        status: 'planned',
        origin: 'suggested_apply',
      },
      {
        id: 'evt-create-feb',
        blockId: 'blk-feb-horizon',
        dateISO: '2026-02-03',
        minutes: 60,
        rawLabel: 'Full horizon follow-up',
        domain: 'Creation',
        cycleId: state.activeCycleId,
        goalId: 'goal-1',
        completed: false,
        kind: 'create',
        startISO: '2026-02-03T09:00:00.000Z',
        endISO: '2026-02-03T10:00:00.000Z',
        status: 'planned',
        origin: 'suggested_apply',
      },
    ];

    render(
      <IdentityProvider initialState={state}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.getByText(/Visible month slice only/i)).toBeInTheDocument();
    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Next/i }));
    });
    expect(screen.getByText(/Full horizon follow-up/i)).toBeInTheDocument();
  });
});
