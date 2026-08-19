import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const stub = vi.fn();
let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore() {
  const setActiveDayKey = vi.fn();
  const setViewDate = vi.fn();
  const actions = {
    completeBlock: stub,
    missBlock: stub,
    skipBlock: stub,
    setDefiniteGoal: stub,
    setPatternTargets: stub,
    createBlock: stub,
    updateBlock: stub,
    deleteBlock: stub,
    rescheduleBlock: stub,
    setActiveDayKey,
    setViewDate,
    jumpToToday: stub,
    tickNow: stub,
    acceptSuggestedBlock: stub,
    acceptSuggestedBlockWithPlacement: stub,
    rejectSuggestedBlock: stub,
    ignoreSuggestedBlock: stub,
    dismissSuggestedBlock: stub,
    setActiveCycle: stub,
    deleteCycle: stub,
    startNewCycle: stub,
    startNewCycleWithDecision: stub,
    generateScheduleForActiveCycle: stub,
    generatePlanWithLLM: stub,
    createDeliverable: stub,
    updateDeliverable: stub,
    deleteDeliverable: stub,
    createCriterion: stub,
    toggleCriterionDone: stub,
    deleteCriterion: stub,
    linkBlockToDeliverable: stub,
    assignSuggestionLink: stub,
    generatePlan: stub,
    commitPreviewItems: stub,
    applyPlan: stub,
    setPlanResolutionKind: stub,
    activateSchedule: stub,
    rebaseSchedule: stub,
    applyRenegotiationOption: stub,
    resetIdentity: stub,
    upsertProfileDetails: stub,
    addFrictionEvent: stub,
    completeCycleReassessment: stub,
    setSelectedHorizonMode: stub,
  };
  return {
    activeProfileId: 'profile-1',
    activeGoalId: 'goal-1',
    profileAccess: { status: 'profile_selected', selectedProfileId: 'profile-1' },
    profilesById: {
      'profile-1': {
        id: 'profile-1',
        displayName: 'James',
        label: 'James',
        activeGoalId: 'goal-1',
        activeMasterPlanId: null,
        masterCalendarId: 'calendar-1',
      },
    },
    goalsById: { 'goal-1': { id: 'goal-1', activeCycleId: null } },
    today: { date: '2026-06-16', blocks: [] },
    currentWeek: { weekStart: '2026-06-15', days: [] },
    cycle: [],
    executionEvents: [],
    lastPlanError: null,
    proposedBlocks: [],
    suggestedBlocks: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    appTime: { nowISO: '2026-06-16T12:00:00.000Z', activeDayKey: '2026-06-16', timeZone: 'America/Chicago' },
    viewDate: '2026-06-16',
    goalWorkById: {},
    constraints: {},
    availabilityPolicy: {},
    debug: {},
    cyclesById: {},
    cycleDynamicsByCycleId: {},
    activeCycleId: null,
    blockStore: { blocks: {} },
    goalExecutionContract: null,
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
    goalRelations: {},
    constraintRelations: {},
    frictionEvents: [],
    frictionPropagationResults: {},
    profileLearning: {},
    planRecovery: null,
    pendingPlanConfirmation: false,
    scheduleApplied: false,
    coreContinuity: {},
    coreMissionContractsById: {},
    selectedHorizonMode: 'current_cycle',
    calendarDisplayBlocks: [],
    fullHorizonScheduleBlocks: [],
    scheduleLifecycleState: 'goal_admitted',
    setActiveDayKey,
    setViewDate,
    ...actions,
    actions,
  };
}

describe('ZionDashboard calendar authority', () => {
  beforeEach(() => {
    mockStore = buildStore();
    stub.mockClear();
  });

  it('clicking a month date selects that exact date without mutating live today', async () => {
    const { container } = render(
      <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey="2026-06-01" />
    );

    const user = userEvent.setup();
    const dayButton = container.querySelector('[data-day="2026-06-15"]');
    expect(dayButton).not.toBeNull();
    await user.click(dayButton);

    expect(mockStore.actions.setViewDate).toHaveBeenCalledWith('2026-06-15');
    expect(mockStore.actions.setActiveDayKey).not.toHaveBeenCalled();
  });

  it('suppresses pre-floor May forecast blocks in full horizon mode after reassessment', () => {
    mockStore.selectedHorizonMode = 'full_horizon';
    mockStore.activeCycleId = 'cycle-1';
    mockStore.goalsById['goal-1'].activeCycleId = 'cycle-1';
    mockStore.profilesById['profile-1'].activeMasterPlanId = 'plan-1';
    mockStore.masterPlansById = {
      'plan-1': {
        id: 'plan-1',
        profileId: 'profile-1',
        horizonStart: '2026-05-19',
        fullHorizonEndDayKey: '2026-06-30',
        laneIds: [],
        anchors: [],
      },
    };
    mockStore.cyclesById = {
      'cycle-1': {
        id: 'cycle-1',
        source: 'master_plan',
        masterPlanId: 'plan-1',
        goalContract: {
          goalId: 'goal-1',
          startDayKey: '2026-05-19',
          endDayKey: '2026-06-30',
        },
        executionStartDayKey: '2026-06-15',
        reassessmentCompletedAtISO: '2026-06-17T12:00:00.000Z',
        scheduleGeneratedAtISO: '2026-06-17T12:30:00.000Z',
      },
    };
    mockStore.calendarDisplayBlocks = [
      {
        id: 'forecast-may-19',
        dayKey: '2026-05-19',
        date: '2026-05-19',
        start: '2026-05-19T16:00:00.000Z',
        title: 'May floor leak block',
      },
      {
        id: 'forecast-june-15',
        dayKey: '2026-06-15',
        date: '2026-06-15',
        start: '2026-06-15T16:00:00.000Z',
        title: 'June valid block',
      },
    ];
    mockStore.fullHorizonScheduleBlocks = [...mockStore.calendarDisplayBlocks];

    const { container } = render(
      <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey="2026-06-01" />
    );

    expect(container.textContent).not.toContain('May floor leak block');
    expect(container.textContent).toContain('June 2026');
    expect(container.textContent).not.toContain('May 2026');
  });
});
