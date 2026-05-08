import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const generateScheduleForActiveCycle = vi.fn();
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
        goalContract: { goalId: 'goal-1', startDayKey: '2026-02-01', endDayKey: '2026-03-01' },
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId: 'goal-1', startDayKey: '2026-02-01', endDayKey: '2026-03-01' },
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
    generateScheduleForActiveCycle.mockClear();
    mockStore = buildStore();
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

  it('allows schedule generation from a finalized master plan before any active cycle exists', async () => {
    mockStore = buildMasterPlanOnlyStore();

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /today execution/i }));
    await user.click(screen.getByRole('button', { name: /generate schedule/i }));

    expect(generateScheduleForActiveCycle).toHaveBeenCalledTimes(1);
  });
});
