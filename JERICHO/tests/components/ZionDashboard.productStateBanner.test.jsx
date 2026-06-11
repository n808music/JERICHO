import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import ZionDashboard from '../../src/components/ZionDashboard.jsx';

let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

const noop = vi.fn();

function buildBaseStore(overrides = {}) {
  const dayKey = '2026-06-08';
  const profileId = 'profile-1';
  const goalId = 'goal-1';
  const cycleId = 'cycle-1';

  return {
    activeProfileId: profileId,
    activeGoalId: goalId,
    activeCycleId: cycleId,
    profileAccess: {
      status: 'profile_selected',
      selectedProfileId: profileId,
    },
    profilesById: {
      [profileId]: {
        id: profileId,
        label: 'Local Profile',
        goalIds: [goalId],
        activeGoalId: goalId,
        masterCalendarId: 'calendar-1',
        strategicClusterIds: [],
      },
    },
    goalsById: {
      [goalId]: {
        id: goalId,
        title: 'Launch Jericho',
        activeCycleId: cycleId,
      },
    },
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    executionEvents: [],
    lastPlanError: null,
    proposedBlocks: [],
    suggestedBlocks: [],
    deliverablesByCycleId: { [cycleId]: { deliverables: [], suggestionLinks: {} } },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    goalWorkById: {},
    constraints: {},
    availabilityPolicy: {},
    debug: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        reassessmentStatus: 'complete',
        scheduleLifecycle: 'active_schedule',
        goalContract: {
          goalId,
          startDayKey: '2026-06-08',
          endDayKey: '2026-07-08',
          phaseLabel: 'P1',
        },
        executionEvents: [],
      },
    },
    cycleDynamicsByCycleId: {},
    blockStore: { blocks: {} },
    goalExecutionContract: {
      goalId,
      startDayKey: '2026-06-08',
      endDayKey: '2026-07-08',
      phaseLabel: 'P1',
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    planQualityGateByGoal: {},
    executionCorrectionByGoal: {},
    systemShotClockByGoal: {},
    masterPlansById: {},
    masterPlanLanesById: {},
    masterPlanMilestonesById: {},
    masterCalendarsById: {},
    strategicClustersById: {},
    goalRelations: [],
    constraintRelations: [],
    frictionEvents: [],
    frictionPropagationResults: [],
    profileLearning: {},
    planRecovery: null,
    pendingPlanConfirmation: false,
    scheduleApplied: false,
    coreContinuity: null,
    coreMissionContractsById: {},
    scheduleLifecycleState: 'in_execution',
    selectedHorizonMode: 'current_cycle',
    calendarDisplayBlocks: [],
    fullHorizonScheduleBlocks: [],
    setActiveCycle: noop,
    deleteCycle: noop,
    startNewCycle: noop,
    startNewCycleWithDecision: noop,
    generateScheduleForActiveCycle: noop,
    generatePlanWithLLM: noop,
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
    generatePlan: noop,
    commitPreviewItems: noop,
    applyPlan: noop,
    setPlanResolutionKind: noop,
    activateSchedule: noop,
    rebaseSchedule: noop,
    applyRenegotiationOption: noop,
    resetIdentity: noop,
    upsertProfileDetails: noop,
    addFrictionEvent: noop,
    completeCycleReassessment: noop,
    setSelectedHorizonMode: noop,
    ...overrides,
  };
}

describe('ZionDashboard product state banner integration', () => {
  beforeEach(() => {
    mockStore = buildBaseStore();
  });

  it('renders schedule required when a goal exists without a generated schedule', () => {
    mockStore = buildBaseStore({
      activeCycleId: null,
      goalsById: {
        'goal-1': {
          id: 'goal-1',
          title: 'Launch Jericho',
          activeCycleId: null,
        },
      },
      cyclesById: {},
      deliverablesByCycleId: {},
      scheduleLifecycleState: 'goal_admitted',
      goalExecutionContract: { goalId: 'goal-1', startDayKey: '2026-06-08', endDayKey: '2026-07-08' },
    });

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    const banner = screen.getByRole('region', { name: /product state banner/i });
    expect(within(banner).getByRole('heading', { name: /schedule required/i })).toBeInTheDocument();
    expect(within(banner).getByText('Profile')).toBeInTheDocument();
    expect(within(banner).getByText('Goal')).toBeInTheDocument();
    expect(within(banner).getByText('Activated Plan')).toBeInTheDocument();
    expect(within(banner).getByText('Phase')).toBeInTheDocument();
    expect(within(banner).getByText('Today')).toBeInTheDocument();
    expect(within(banner).getByText('Next Action')).toBeInTheDocument();
  });

  it('renders ready to activate for an applied review schedule', () => {
    mockStore = buildBaseStore({
      scheduleLifecycleState: 'schedule_applied',
      cyclesById: {
        'cycle-1': {
          id: 'cycle-1',
          status: 'active',
          reassessmentStatus: 'complete',
          scheduleLifecycle: 'applied_review',
          scheduleReviewBlocks: [{ id: 'review-1', cycleId: 'cycle-1', goalId: 'goal-1' }],
          goalContract: {
            goalId: 'goal-1',
            startDayKey: '2026-06-08',
            endDayKey: '2026-07-08',
            phaseLabel: 'P1',
          },
          planQualityGate: { passed: true, dependencyAudit: 'PASS' },
        },
      },
    });

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    const banner = screen.getByRole('region', { name: /product state banner/i });
    expect(within(banner).getByRole('heading', { name: /ready to activate/i })).toBeInTheDocument();
    expect(within(banner).getByText(/activation readiness/i)).toBeInTheDocument();
    expect(within(banner).getByText('Block Count')).toBeInTheDocument();
    expect(within(banner).getByText('First Executable Date')).toBeInTheDocument();
  });

  it('renders active execution when the live schedule is active', () => {
    mockStore = buildBaseStore({
      today: {
        date: '2026-06-08',
        blocks: [
          {
            id: 'block-1',
            cycleId: 'cycle-1',
            goalId: 'goal-1',
            title: 'Ship launch checklist',
            label: 'Ship launch checklist',
            start: '2026-06-08T10:00:00.000Z',
            end: '2026-06-08T10:30:00.000Z',
          },
        ],
        completionRate: 0,
        driftSignal: 'contained',
        loadByPractice: {},
        practices: [],
      },
      cycle: [
        {
          date: '2026-06-08',
          blocks: [
            {
              id: 'block-1',
              cycleId: 'cycle-1',
              goalId: 'goal-1',
              title: 'Ship launch checklist',
              label: 'Ship launch checklist',
              start: '2026-06-08T10:00:00.000Z',
              end: '2026-06-08T10:30:00.000Z',
            },
          ],
        },
      ],
      blockStore: {
        blocks: {
          'block-1': {
            id: 'block-1',
            cycleId: 'cycle-1',
            goalId: 'goal-1',
            title: 'Ship launch checklist',
            label: 'Ship launch checklist',
            start: '2026-06-08T10:00:00.000Z',
            end: '2026-06-08T10:30:00.000Z',
          },
        },
      },
    });

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    const banner = screen.getByRole('region', { name: /product state banner/i });
    expect(within(banner).getByRole('heading', { name: /active execution/i })).toBeInTheDocument();
    expect(within(banner).queryByText(/activation readiness/i)).not.toBeInTheDocument();
  });

  it('renders course correction required when execution correction is elevated', () => {
    mockStore = buildBaseStore({
      executionCorrectionByGoal: {
        'goal-1': {
          correctionState: 'recovery_required',
          reasonCodes: ['dependency_blocked'],
        },
      },
    });

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    const banner = screen.getByRole('region', { name: /product state banner/i });
    expect(within(banner).getByRole('heading', { name: /course correction required/i })).toBeInTheDocument();
    expect(within(banner).getByText('dependency blocked')).toBeInTheDocument();
    expect(within(banner).queryByText(/activation readiness/i)).not.toBeInTheDocument();
  });
});
