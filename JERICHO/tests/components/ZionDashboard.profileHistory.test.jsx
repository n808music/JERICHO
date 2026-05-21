import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const noop = vi.fn();
let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore() {
  const upsertProfileDetails = vi.fn();
  const activeCycleId = 'cycle-operation-endgame';
  const archivedCycleId = 'cycle-operation-endgame-archive';
  const activeGoalId = 'goal-operation-endgame';
  const archivedGoalId = 'goal-revenue-bridge';
  return {
    activeProfileId: 'profile-local-default',
    activeGoalId,
    profilesById: {
      'profile-local-default': {
        id: 'profile-local-default',
        displayName: 'James Dotson',
        label: 'James Dotson',
        roleLabel: 'Founder / Operator',
        goalIds: [activeGoalId, archivedGoalId],
        activeGoalId,
        masterPlanIds: ['masterplan-operation-endgame'],
        activeMasterPlanId: 'masterplan-operation-endgame',
        masterCalendarId: 'calendar-profile-local-default',
        strategicClusterIds: [],
      },
    },
    goalsById: {
      [activeGoalId]: { id: activeGoalId, title: 'Operation Endgame', activeCycleId: activeCycleId },
      [archivedGoalId]: { id: archivedGoalId, title: 'Grow revenue to $10k/month', activeCycleId: archivedCycleId },
    },
    masterPlansById: {
      'masterplan-operation-endgame': {
        id: 'masterplan-operation-endgame',
        title: 'Operation Endgame',
        horizonStart: '2026-05-19',
        horizonEnd: '2031-05-19',
        fullHorizonEndDayKey: '2031-05-19',
        laneIds: [],
        anchors: [],
      },
    },
    today: { date: '2026-05-21', blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: '2026-05-18', days: [], metrics: {} },
    cycle: [],
    executionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: { [activeGoalId]: { status: 'ADMITTED', reasonCodes: [] } },
    appTime: { nowISO: '2026-05-21T12:00:00.000Z', activeDayKey: '2026-05-21', timeZone: 'UTC' },
    goalWorkById: {},
    constraints: {},
    availabilityPolicy: {},
    debug: {},
    lastPlanError: null,
    cyclesById: {
      [activeCycleId]: {
        id: activeCycleId,
        profileId: 'profile-local-default',
        goalId: activeGoalId,
        masterPlanId: 'masterplan-operation-endgame',
        status: 'active',
        startedAtDayKey: '2026-05-19',
        goalContract: { goalId: activeGoalId, startDayKey: '2026-05-19', endDayKey: '2026-06-19' },
        metrics: {},
      },
      [archivedCycleId]: {
        id: archivedCycleId,
        profileId: 'profile-local-default',
        goalId: archivedGoalId,
        status: 'archived',
        startedAtDayKey: '2026-04-01',
        endedAtDayKey: '2026-04-30',
        archivedAtISO: '2026-05-01T12:00:00.000Z',
        goalContract: { goalId: archivedGoalId, startDayKey: '2026-04-01', endDayKey: '2026-04-30' },
        metrics: {},
      },
    },
    cycleDynamicsByCycleId: {},
    activeCycleId,
    blockStore: { blocks: {} },
    goalExecutionContract: { goalId: activeGoalId, startDayKey: '2026-05-19', endDayKey: '2026-06-19' },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    planQualityGateByGoal: {},
    executionCorrectionByGoal: {},
    systemShotClockByGoal: {},
    masterPlanLanesById: {},
    masterPlanMilestonesById: {},
    masterCalendarsById: {
      'calendar-profile-local-default': {
        id: 'calendar-profile-local-default',
        activeGoalIds: [activeGoalId, archivedGoalId],
        activeCycleIds: [activeCycleId, archivedCycleId],
      },
    },
    strategicClustersById: {},
    goalRelations: [],
    constraintRelations: [],
    frictionEvents: [],
    frictionPropagationResults: [],
    profileLearning: {},
    planRecovery: null,
    pendingPlanConfirmation: false,
    scheduleApplied: false,
    coreContinuity: {},
    coreMissionContractsById: {},
    scheduleLifecycleState: 'goal_admitted',
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
    applyRenegotiationOption: noop,
    resetIdentity: noop,
    upsertProfileDetails,
    addFrictionEvent: noop,
    completeCycleReassessment: noop,
    setSelectedHorizonMode: noop,
  };
}

describe('ZionDashboard profile history shell', () => {
  beforeEach(() => {
    noop.mockClear();
    mockStore = buildStore();
  });

  it('renders the active profile container with goal, master-plan, and cycle history', () => {
    render(<ZionDashboard initialView="structure" />);

    fireEvent.click(screen.getByRole('button', { name: /James Dotson/i }));

    expect(screen.getByText(/Profile Container/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Founder \/ Operator/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Profile id: profile-local-default/i)).toBeInTheDocument();
    expect(screen.getByText(/^Master Plans$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Goal History$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Cycle History$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Operation Endgame/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Grow revenue to \$10k\/month/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/May 19, 2026 → May 19, 2031/i)).toBeInTheDocument();
    expect(screen.getByText(/Archived · Apr 1, 2026 → Apr 30, 2026/i)).toBeInTheDocument();
  });

  it('routes cycle selection through the existing setActiveCycle action', () => {
    render(<ZionDashboard initialView="structure" />);

    fireEvent.click(screen.getByRole('button', { name: /James Dotson/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /View Cycle/i })[1]);

    expect(noop).toHaveBeenCalledWith('cycle-operation-endgame-archive');
  });

  it('lets the user edit the profile display name and role', () => {
    render(<ZionDashboard initialView="structure" />);

    fireEvent.click(screen.getByRole('button', { name: /James Dotson/i }));
    fireEvent.click(screen.getByRole('button', { name: /Edit Profile/i }));
    fireEvent.change(screen.getByLabelText(/Display name/i), { target: { value: 'James Nathaniel Dotson' } });
    fireEvent.change(screen.getByLabelText(/Profile label \/ role/i), { target: { value: 'Founder' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));

    expect(mockStore.upsertProfileDetails).toHaveBeenCalledWith({
      profileId: 'profile-local-default',
      displayName: 'James Nathaniel Dotson',
      roleLabel: 'Founder',
    });
  });

  it('surfaces a create-profile state when only the default local profile exists', () => {
    mockStore = buildStore();
    mockStore.profilesById['profile-local-default'].displayName = null;
    mockStore.profilesById['profile-local-default'].label = 'Local Profile';
    mockStore.profilesById['profile-local-default'].roleLabel = null;

    render(<ZionDashboard initialView="structure" />);

    fireEvent.click(screen.getByRole('button', { name: /Create profile/i }));

    expect(screen.getByLabelText(/Display name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Profile/i })).toBeInTheDocument();
  });
});
