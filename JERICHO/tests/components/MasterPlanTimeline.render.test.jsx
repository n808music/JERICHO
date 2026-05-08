import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import MasterPlanTimeline from '../../src/ui/masterPlan/MasterPlanTimeline.jsx';

let mockStore = {};

vi.mock('../../src/state/identityStore.js', async () => {
  const actual = await vi.importActual('../../src/state/identityStore.js');
  return {
    ...actual,
    useIdentityStore: () => mockStore,
  };
});

function buildFinalizedMasterPlanState({ withCriticDebt = false, withGeneratedSchedule = false } = {}) {
  const state = buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: '2026-05-04T12:00:00.000Z',
    todayDate: '2026-05-04',
  });
  state.masterPlanIntake = {
    status: 'in-progress',
    phase: 4,
    step: 13,
    profileId: DEFAULT_PROFILE_ID,
    answers: {
      step_2:
        'Build and coordinate a multi-lane master plan from today through October 17, centered on releasing my album and launching the supporting ecosystem around it.',
      step_3: { horizonEnd: '2026-11-01', months: 6, label: 'Oct 17' },
      step_5: withCriticDebt ? 'not sure yet' : { exists: true, urgency: 'immediate', notes: 'Need first revenue soon.' },
      step_6: 'Ownership, creative control, and execution discipline cannot slip.',
      lane_0_description: withCriticDebt
        ? 'unknown album asset state'
        : 'EP is ready to launch with masters done, artwork in progress, and release prep underway.',
      lane_0_system_assessment: {
        assessedStage: 'ready-to-launch',
        assessedConfidence: 'high',
        assessmentNotes: 'Creative artifact is in release-prep corridor.',
      },
      lane_0_activation: 'active',
      lane_0_clarifying_0: withCriticDebt ? 'unknown' : 'masters, artwork, and distro prep are in progress',
      lane_1_description: '7 months into development, core architecture working, preparing for beta.',
      lane_1_system_assessment: {
        assessedStage: 'in-development',
        assessedConfidence: 'high',
        assessmentNotes: 'Product lane is mid-build.',
      },
      lane_1_activation: 'active',
      lane_1_clarifying_0: 'core architecture works and beta readiness is the next gate',
      lane_2_description: 'Podcast is being built to support both the album launch and the app story.',
      lane_2_system_assessment: {
        assessedStage: 'pre-launch',
        assessedConfidence: 'medium',
        assessmentNotes: 'Media lane is in support role.',
      },
      lane_2_activation: 'active',
      lane_2_clarifying_0: 'both album and app',
      lane_3_description: 'Starting from scratch on positioning and outreach for the PM company.',
      lane_3_system_assessment: {
        assessedStage: 'pre-concept',
        assessedConfidence: 'medium',
        assessmentNotes: 'Brand lane is still early.',
      },
      lane_3_activation: 'incubating',
      lane_3_clarifying_0: 'positioning and outreach assets still need to be built',
      lane_4_description: 'Income is urgent and first revenue needs to happen quickly.',
      lane_4_system_assessment: {
        assessedStage: 'pre-concept',
        assessedConfidence: 'medium',
        assessmentNotes: 'Income lane is urgent and early.',
      },
      lane_4_activation: 'active',
      lane_4_clarifying_0: 'need a near-term revenue event to relieve pressure',
    },
    extractedLanes: [
      { title: 'Album rollout', domain: 'creative', role: 'proof-artifact' },
      { title: 'App launch', domain: 'product', role: 'revenue-engine' },
      { title: 'Podcast rollout', domain: 'media', role: 'support-media' },
      { title: 'PM company', domain: 'brand', role: 'revenue-engine' },
      { title: 'Income stream', domain: 'income', role: 'revenue-engine' },
    ],
    anchors: [
      {
        id: 'anchor-oct17',
        date: '2026-10-17',
        label: 'Oct 17 launch target',
        isFixed: true,
        affectedLaneIds: [],
        priority: 0,
      },
    ],
    currentLaneIdx: 0,
    clarifyingQuestionIdx: 0,
    draft: null,
    errorMessage: null,
  };

  applyMasterPlanAction(state, {
    type: 'MASTER_PLAN_INTAKE_COMPLETE',
    nowISO: '2026-05-04T12:00:00.000Z',
  });

  let next = computeDerivedState(state, { type: 'NO_OP' });
  const planId = next.masterPlanIntake.draft.masterPlanId;
  if (withGeneratedSchedule) {
    next = computeDerivedState(next, {
      type: 'GENERATE_PLAN',
      payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
    });
  }

  next.profilesById[DEFAULT_PROFILE_ID].masterCalendarId = `calendar-${DEFAULT_PROFILE_ID}`;
  next.profilesById[DEFAULT_PROFILE_ID].goalIds = ['goal-album', 'goal-app', 'goal-podcast', 'goal-pm', 'goal-income'];
  next.profilesById[DEFAULT_PROFILE_ID].strategicClusterIds = ['cluster-oct17'];
  next.goalsById = {
    'goal-album': { id: 'goal-album', title: 'Album rollout', activeCycleId: 'cycle-album' },
    'goal-app': { id: 'goal-app', title: 'App launch', activeCycleId: 'cycle-app' },
    'goal-podcast': { id: 'goal-podcast', title: 'Podcast rollout', activeCycleId: 'cycle-podcast' },
    'goal-pm': { id: 'goal-pm', title: 'PM company', activeCycleId: 'cycle-pm' },
    'goal-income': { id: 'goal-income', title: 'Income stream', activeCycleId: 'cycle-income' },
  };
  next.masterCalendarsById = {
    [`calendar-${DEFAULT_PROFILE_ID}`]: {
      id: `calendar-${DEFAULT_PROFILE_ID}`,
      activeGoalIds: ['goal-album', 'goal-app', 'goal-podcast', 'goal-pm', 'goal-income'],
      activeCycleIds: ['cycle-album', 'cycle-app', 'cycle-podcast', 'cycle-pm', 'cycle-income'],
      baseWeeklyCapacityHours: 40,
      availableCapacityHours: 32,
    },
  };
  next.strategicClustersById = {
    'cluster-oct17': {
      id: 'cluster-oct17',
      label: 'oct17 launch',
      goalIds: ['goal-album', 'goal-app', 'goal-podcast'],
      cycleIds: ['cycle-album', 'cycle-app', 'cycle-podcast'],
      sharedAnchorDayKey: '2026-10-17',
    },
  };
  next.constraintRelations = [
    {
      profileId: DEFAULT_PROFILE_ID,
      sourceGoalId: 'goal-income',
      targetGoalId: 'goal-album',
      relationType: 'capital_pressure',
      severity: 'high',
      scope: 'global',
    },
  ];
  return next;
}

function buildEmptyMasterPlanState() {
  return buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: '2026-05-04T12:00:00.000Z',
    todayDate: '2026-05-04',
  });
}

describe('MasterPlanTimeline rendering', () => {
  it('stays read-only and points users back to Structure when no master plan exists', async () => {
    mockStore = buildEmptyMasterPlanState();

    await act(async () => {
      render(<MasterPlanTimeline />);
    });

    expect(
      screen.getByText(/No master plan established yet\. Complete Structure intake first\./i)
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/type your answer/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /build your plan/i })).not.toBeInTheDocument();
  });

  it('renders lanes, anchors, milestones, and first-cycle preview from canonical master-plan state', async () => {
    mockStore = buildFinalizedMasterPlanState({ withGeneratedSchedule: true });
    const laneIdByTitle = Object.values(mockStore.masterPlanLanesById).reduce((acc, lane) => {
      acc[lane.title] = lane.id;
      return acc;
    }, {});

    await act(async () => {
      render(<MasterPlanTimeline />);
    });

    expect(
      screen.getByRole('heading', { name: /Build and coordinate a multi-lane master plan/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Master Calendar Context/i)).toBeInTheDocument();
    expect(screen.getByText(/Integrated strategic clusters/i)).toBeInTheDocument();
    expect(screen.getByText(/Oct17 Launch/i)).toBeInTheDocument();
    expect(screen.getByText(/Album rollout · App launch · Podcast rollout/i)).toBeInTheDocument();
    expect(screen.getByText(/Independent goals on the same calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/PM company · Income stream/i)).toBeInTheDocument();
    expect(screen.getByText(/Global pressure/i)).toBeInTheDocument();
    expect(screen.getByText(/Income stream · Capital Pressure/i)).toBeInTheDocument();
    expect(screen.getByTestId('masterplan-first-cycle-summary')).toBeInTheDocument();
    expect(screen.getByText(/First executable cycle preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Oct 17 launch target/i)).toBeInTheDocument();
    expect(screen.getAllByTestId(/milestone-dot-/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/planned-block-/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Album rollout')).toBeInTheDocument();
    expect(screen.getByText('App launch')).toBeInTheDocument();
    expect(screen.getByText('Podcast rollout')).toBeInTheDocument();
    expect(screen.getByText('PM company')).toBeInTheDocument();
    expect(screen.getByText('Income stream')).toBeInTheDocument();

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByTestId(`timeline-lane-${laneIdByTitle['App launch']}`));
    });

    expect(screen.getByText('Feature freeze')).toBeInTheDocument();
    expect(screen.getByText('Internal test complete')).toBeInTheDocument();
    expect(screen.getByText('Closed beta')).toBeInTheDocument();
    expect(screen.getByText('App store submitted')).toBeInTheDocument();
    expect(screen.getByText('LAUNCH')).toBeInTheDocument();
    expect(screen.getAllByText(/First executable cycle preview/i).length).toBeGreaterThan(0);

    await act(async () => {
      await user.click(screen.getByLabelText(/close lane detail/i));
      await user.click(screen.getByTestId(`timeline-lane-${laneIdByTitle['Album rollout']}`));
    });

    expect(screen.getAllByText('Distribution submitted').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Artwork finalized').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pre-release single 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pre-release single 2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Final promo push begins').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DROP').length).toBeGreaterThan(0);

    await act(async () => {
      await user.click(screen.getByLabelText(/close lane detail/i));
      await user.click(screen.getByTestId(`timeline-lane-${laneIdByTitle['Podcast rollout']}`));
    });

    expect(screen.getAllByText(/Episodes 1.?3 recorded/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Distribution set up/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Launch episode live/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Album promo episodes/i).length).toBeGreaterThan(0);

    await act(async () => {
      await user.click(screen.getByLabelText(/close lane detail/i));
      await user.click(screen.getByTestId(`timeline-lane-${laneIdByTitle['PM company']}`));
    });

    expect(screen.getAllByText('Positioning complete').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Outreach started').length).toBeGreaterThan(0);

    await act(async () => {
      await user.click(screen.getByLabelText(/close lane detail/i));
      await user.click(screen.getByTestId(`timeline-lane-${laneIdByTitle['Income stream']}`));
    });

    expect(screen.getAllByText('First revenue event').length).toBeGreaterThan(0);
    expect(screen.getByText(/flex: none/i)).toBeInTheDocument();
  });

  it('surfaces unresolved structure critic debt as chart inspection risk', async () => {
    mockStore = buildFinalizedMasterPlanState({ withCriticDebt: true, withGeneratedSchedule: true });
    const laneIdByTitle = Object.values(mockStore.masterPlanLanesById).reduce((acc, lane) => {
      acc[lane.title] = lane.id;
      return acc;
    }, {});

    await act(async () => {
      render(<MasterPlanTimeline />);
    });

    expect(screen.getByTestId('masterplan-critic-summary')).toBeInTheDocument();
    expect(screen.getByText(/STRUCTURE_WEEKLY_CAPACITY_UNRESOLVED/i)).toBeInTheDocument();
    expect(screen.getAllByText(/critic debt/i).length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByTestId(`timeline-lane-${laneIdByTitle['Album rollout']}`));
    });

    expect(screen.getAllByText(/Structure critic debt/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/What album or release assets already exist\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Masters, artwork, distribution setup, and promo assets/i)).toBeInTheDocument();
  });
});
