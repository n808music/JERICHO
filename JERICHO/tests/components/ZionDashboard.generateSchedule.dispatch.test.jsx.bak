import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const generateScheduleForActiveCycle = vi.fn();
const completeCycleReassessment = vi.fn();
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
    suggestedBlocks: [],
    deliverablesByCycleId: { [cycleId]: { deliverables: [], suggestionLinks: {} } },
    goalAdmissionByGoal: {},
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    goalWorkById: {},
    constraints: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        reassessmentStatus: 'complete',
        goalContract: {
          goalId: 'goal-1',
          startDayKey: '2026-02-01',
          endDayKey: '2026-03-01',
          workWindows: {
            mon: [{ start: '09:00', end: '12:00' }],
            tue: [{ start: '09:00', end: '12:00' }],
            wed: [{ start: '09:00', end: '12:00' }],
            thu: [{ start: '09:00', end: '12:00' }],
            fri: [{ start: '09:00', end: '12:00' }],
            sat: [],
            sun: [],
          },
          workWindowsSource: 'user_defined',
          constraintsStatus: 'approved',
          capacityValidation: {
            status: 'approved',
            availableWeeklyMinutes: 900,
            requiredWeeklyMinutes: 180,
            gapWeeklyMinutes: 0,
            mitigationSuggestions: [],
          },
        },
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: {
      goalId: 'goal-1',
      startDayKey: '2026-02-01',
      endDayKey: '2026-03-01',
      workWindows: {
        mon: [{ start: '09:00', end: '12:00' }],
        tue: [{ start: '09:00', end: '12:00' }],
        wed: [{ start: '09:00', end: '12:00' }],
        thu: [{ start: '09:00', end: '12:00' }],
        fri: [{ start: '09:00', end: '12:00' }],
        sat: [],
        sun: [],
      },
      workWindowsSource: 'user_defined',
      constraintsStatus: 'approved',
      capacityValidation: {
        status: 'approved',
        availableWeeklyMinutes: 900,
        requiredWeeklyMinutes: 180,
        gapWeeklyMinutes: 0,
        mitigationSuggestions: [],
      },
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    profileLearning: {},
    actions: {},
    generateScheduleForActiveCycle,
    completeCycleReassessment,
    generatePlan: noop,
    commitPreviewItems: noop,
    applyPlan: noop,
    setActiveCycle: noop,
    deleteCycle: noop,
    startNewCycle: noop,
    startNewCycleWithDecision: noop,
    completeBlock: noop,
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

function buildMasterPlanOnlyStore() {
  const dayKey = '2026-05-04';
  const profileId = 'profile-local-default';
  const masterPlanId = 'masterplan-1';
  return {
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    planDraft: null,
    planCalibration: null,
    correctionSignals: null,
    suggestionEvents: [],
    suggestedBlocks: [],
    proposedBlocks: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    goalWorkById: {},
    constraints: {},
    profilesById: {
      [profileId]: {
        id: profileId,
        label: 'Local Profile',
        goalIds: [],
        activeGoalId: null,
        activeMasterPlanId: masterPlanId,
        masterCalendarId: `calendar-${profileId}`,
        strategicClusterIds: [],
        status: 'active',
      },
    },
    activeProfileId: profileId,
    masterPlansById: {
      [masterPlanId]: {
        id: masterPlanId,
        profileId,
        title: 'Operation Endgame',
        northStarOutcome: 'Build and coordinate a multi-lane master plan through October 17.',
        laneIds: ['lane-app', 'lane-album'],
        anchors: [{ id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17', isFixed: true }],
      },
    },
    masterPlanLanesById: {
      'lane-app': { id: 'lane-app', title: 'Jericho app', domain: 'product', milestoneIds: ['m1'] },
      'lane-album': { id: 'lane-album', title: 'Album rollout', domain: 'creative', milestoneIds: ['m2'] },
    },
    masterPlanMilestonesById: {
      m1: { id: 'm1', laneId: 'lane-app', title: 'Feature freeze', targetDate: '2026-05-20' },
      m2: { id: 'm2', laneId: 'lane-album', title: 'Distribution submitted', targetDate: '2026-05-30' },
    },
    cyclesById: {},
    activeCycleId: null,
    goalExecutionContract: null,
    probabilityByGoal: {},
    feasibilityByGoal: {},
    profileLearning: {},
    actions: {},
    generateScheduleForActiveCycle,
    generatePlan: noop,
    commitPreviewItems: noop,
    applyPlan: noop,
    setActiveCycle: noop,
    deleteCycle: noop,
    startNewCycle: noop,
    startNewCycleWithDecision: noop,
    completeBlock: noop,
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
    resetIdentity: noop,
  };
}

describe('ZionDashboard schedule generation dispatch wiring', () => {
  beforeEach(() => {
    window.location.hash = '';
    generateScheduleForActiveCycle.mockClear();
    completeCycleReassessment.mockClear();
    mockStore = buildStore();
  });

  it('keeps Today active when schedule generation is the next step from structure', async () => {
    window.location.hash = '#/structure';

    render(<ZionDashboard initialView="structure" initialZionView="day" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /today execution/i }));

    expect(window.location.hash).toBe('#/today');
    expect(screen.getByRole('button', { name: /generate schedule/i })).toBeEnabled();
  });

  it('generate schedule button uses canonical active-cycle scheduler action', async () => {
    render(<ZionDashboard initialView="today" initialZionView="day" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /generate schedule/i }));

    expect(generateScheduleForActiveCycle).toHaveBeenCalledTimes(1);
  });

  it('treats ACTIVE admission status as schedulable and does not block generation', async () => {
    mockStore.goalAdmissionByGoal = { 'goal-1': { status: 'ACTIVE', reasonCodes: [] } };

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /generate schedule/i }));

    expect(generateScheduleForActiveCycle).toHaveBeenCalledTimes(1);
  });

  it('does not allow schedule generation from a finalized master plan before an execution cycle exists', async () => {
    mockStore = buildMasterPlanOnlyStore();

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /today execution/i }));
    expect(screen.getByRole('button', { name: /generate schedule/i })).toBeDisabled();

    expect(generateScheduleForActiveCycle).not.toHaveBeenCalled();
  });

  it('blocks schedule generation when work windows have not been defined and saved', () => {
    mockStore = buildStore();
    mockStore.cyclesById['cycle-active'].goalContract.workWindows = {
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    };
    mockStore.cyclesById['cycle-active'].goalContract.workWindowsSource = 'unset';
    mockStore.cyclesById['cycle-active'].goalContract.constraintsStatus = 'unsaved';
    mockStore.goalExecutionContract = {
      ...mockStore.goalExecutionContract,
      workWindows: mockStore.cyclesById['cycle-active'].goalContract.workWindows,
      workWindowsSource: 'unset',
      constraintsStatus: 'unsaved',
    };

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    expect(screen.getByRole('button', { name: /generate schedule/i })).toBeDisabled();
    expect(screen.getByText(/Define and save work windows before generating a schedule\./i)).toBeInTheDocument();
  });

  it('blocks schedule generation when saved availability is insufficient', () => {
    mockStore = buildStore();
    mockStore.cyclesById['cycle-active'].goalContract.capacityValidation = {
      status: 'insufficient',
      availableWeeklyMinutes: 60,
      requiredWeeklyMinutes: 240,
      gapWeeklyMinutes: 180,
      mitigationSuggestions: ['Expand availability', 'Reduce first-cycle scope'],
    };
    mockStore.cyclesById['cycle-active'].goalContract.constraintsStatus = 'insufficient';
    mockStore.goalExecutionContract = {
      ...mockStore.goalExecutionContract,
      constraintsStatus: 'insufficient',
      capacityValidation: mockStore.cyclesById['cycle-active'].goalContract.capacityValidation,
    };

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    expect(screen.getByRole('button', { name: /generate schedule/i })).toBeDisabled();
    expect(screen.getByText(/Availability is insufficient for the first-cycle workload\./i)).toBeInTheDocument();
    expect(screen.getByText(/Jericho will not cram the plan into unrealistic time\./i)).toBeInTheDocument();
  });

  it('explains the reassessment blocker and lets Today accept reassessment directly', async () => {
    mockStore = buildStore();
    mockStore.cyclesById['cycle-active'].reassessmentStatus = 'required';

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    expect(screen.getByRole('button', { name: /generate schedule/i })).toBeDisabled();
    expect(screen.getAllByText(/Current-state reassessment is required before schedule generation/i).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Accept current-state reassessment/i }));

    expect(completeCycleReassessment).toHaveBeenCalledWith('cycle-active');
  });

  it('does not let a stale future startedAtDayKey suppress first-cycle generation when the canonical start is today', async () => {
    mockStore = buildStore();
    mockStore.activeProfileId = 'profile-1';
    mockStore.profilesById = {
      'profile-1': {
        id: 'profile-1',
        label: 'Local Profile',
        goalIds: ['goal-1'],
        activeGoalId: 'goal-1',
        activeMasterPlanId: 'masterplan-1',
        masterCalendarId: 'calendar-profile-1',
        strategicClusterIds: [],
        status: 'active',
      },
    };
    mockStore.masterCalendarsById = {
      'calendar-profile-1': {
        id: 'calendar-profile-1',
        profileId: 'profile-1',
        availableCapacityHours: 30,
      },
    };
    mockStore.masterPlansById = {
      'masterplan-1': {
        id: 'masterplan-1',
        profileId: 'profile-1',
        title: 'Operation Endgame',
        horizonStart: '2026-05-19',
        horizonEnd: '2031-05-19',
        fullHorizonEndDayKey: '2031-05-19',
        laneIds: [],
        anchors: [{ id: 'anchor-oct17', date: '2026-10-17', label: 'Oct 17', isFixed: true }],
      },
    };
    mockStore.today.date = '2026-06-04';
    mockStore.appTime = {
      nowISO: '2026-06-04T12:00:00.000Z',
      activeDayKey: '2026-06-04',
      timeZone: 'America/Chicago',
    };
    mockStore.cyclesById['cycle-active'].source = 'master_plan';
    mockStore.cyclesById['cycle-active'].masterPlanId = 'masterplan-1';
    mockStore.cyclesById['cycle-active'].startedAtDayKey = '2026-08-04';
    mockStore.cyclesById['cycle-active'].goalContract.startDayKey = '2026-06-04';
    mockStore.cyclesById['cycle-active'].goalContract.endDayKey = '2026-10-17';
    mockStore.cyclesById['cycle-active'].goalContract.masterPlanId = 'masterplan-1';
    mockStore.cyclesById['cycle-active'].goalContract.constraintsStatus = 'approved';
    mockStore.cyclesById['cycle-active'].goalContract.capacityValidation = {
      status: 'approved',
      availableWeeklyMinutes: 1800,
      requiredWeeklyMinutes: 528,
      gapWeeklyMinutes: 0,
      mitigationSuggestions: [],
    };
    mockStore.goalExecutionContract = {
      ...mockStore.goalExecutionContract,
      startDayKey: '2026-06-04',
      endDayKey: '2026-10-17',
      constraintsStatus: 'approved',
      capacityValidation: mockStore.cyclesById['cycle-active'].goalContract.capacityValidation,
    };

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    expect(document.body.textContent).not.toMatch(/Drafts begin on Aug 4/i);
    expect(screen.getByRole('button', { name: /generate schedule/i })).toBeEnabled();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /generate schedule/i }));

    expect(generateScheduleForActiveCycle).toHaveBeenCalledTimes(1);
  });

  it('renders expected output and partial first-cycle coverage for proposed draft blocks', () => {
    mockStore = buildStore();
    mockStore.proposedBlocks = [
      {
        id: 'block-1',
        cycleId: 'cycle-active',
        goalId: 'goal-1',
        title: 'Define timing-slip non-negotiables',
        expectedOutput: 'Written list of what cannot be sacrificed if anchor dates slip.',
        startISO: '2026-02-03T09:00:00.000Z',
        endISO: '2026-02-03T09:30:00.000Z',
        durationMinutes: 30,
        status: 'suggested',
      },
    ];
    mockStore.suggestedBlocks = mockStore.proposedBlocks;
    mockStore.cyclesById['cycle-active'].proposedBlocks = mockStore.proposedBlocks;
    mockStore.cyclesById['cycle-active'].autoAsanaPlan = {
      summary: {
        scheduledBlockCount: 1,
        scheduledMinutes: 30,
        unscheduledBlockCount: 2,
        unscheduledMinutes: 120,
        partialScheduleReason:
          'Only part of the first execution cycle could be scheduled inside the current preview window and confirmed work windows.',
        unscheduledReasons: [{ reasonCode: 'INSUFFICIENT_SCHEDULE_SLOTS', count: 2, minutes: 120 }],
      },
    };

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    expect(screen.getByText(/First-cycle coverage:/i)).toBeInTheDocument();
    expect(screen.getByText(/1 scheduled block/i)).toBeInTheDocument();
    expect(screen.getByText(/2 unscheduled blocks/i)).toBeInTheDocument();
    expect(screen.getByText(/Expected output: Written list of what cannot be sacrificed if anchor dates slip\./i)).toBeInTheDocument();
    expect(screen.getByText(/Unscheduled remaining workload: 2 blocks \/ 2h due to current preview-window capacity\./i)).toBeInTheDocument();
  });
});
