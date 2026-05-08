import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';
import MasterPlanTimeline from '../../src/ui/masterPlan/MasterPlanTimeline.jsx';

let mockStore = {};

vi.mock('../../src/state/identityStore.js', async () => {
  const actual = await vi.importActual('../../src/state/identityStore.js');
  return {
    ...actual,
    useIdentityStore: () => mockStore,
  };
});

function buildFinalizedMasterPlanState() {
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
      step_2: 'Ship the app, release the EP, and grow the PM brand into revenue.',
      step_3: { horizonEnd: '2026-11-01', months: 6, label: 'Oct 17' },
      step_5: { exists: true, urgency: 'immediate', notes: 'Need first revenue soon.' },
      lane_0_description: 'EP is ready to launch with masters done and release prep underway.',
      lane_0_system_assessment: {
        assessedStage: 'ready-to-launch',
        assessedConfidence: 'high',
        assessmentNotes: 'Creative artifact is in release-prep corridor.',
      },
      lane_0_activation: 'active',
      lane_1_description: '7 months into development, core architecture working, preparing for beta.',
      lane_1_system_assessment: {
        assessedStage: 'in-development',
        assessedConfidence: 'high',
        assessmentNotes: 'Product lane is mid-build.',
      },
      lane_1_activation: 'active',
      lane_2_description: 'Starting from scratch on positioning and outreach for the PM company.',
      lane_2_system_assessment: {
        assessedStage: 'pre-concept',
        assessedConfidence: 'medium',
        assessmentNotes: 'Brand lane is still early.',
      },
      lane_2_activation: 'incubating',
      lane_3_description: 'Income is urgent and first revenue needs to happen quickly.',
      lane_3_system_assessment: {
        assessedStage: 'pre-concept',
        assessedConfidence: 'medium',
        assessmentNotes: 'Income lane is urgent and early.',
      },
      lane_3_activation: 'active',
    },
    extractedLanes: [
      { title: 'Album rollout', domain: 'creative', role: 'proof-artifact' },
      { title: 'App launch', domain: 'product', role: 'revenue-engine' },
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
  state.profilesById[DEFAULT_PROFILE_ID].masterCalendarId = `calendar-${DEFAULT_PROFILE_ID}`;
  state.profilesById[DEFAULT_PROFILE_ID].goalIds = ['goal-album', 'goal-app', 'goal-podcast', 'goal-pm', 'goal-income'];
  state.profilesById[DEFAULT_PROFILE_ID].strategicClusterIds = ['cluster-oct17'];
  state.goalsById = {
    'goal-album': { id: 'goal-album', title: 'Album rollout', activeCycleId: 'cycle-album' },
    'goal-app': { id: 'goal-app', title: 'App launch', activeCycleId: 'cycle-app' },
    'goal-podcast': { id: 'goal-podcast', title: 'Podcast rollout', activeCycleId: 'cycle-podcast' },
    'goal-pm': { id: 'goal-pm', title: 'PM company', activeCycleId: 'cycle-pm' },
    'goal-income': { id: 'goal-income', title: 'Income stream', activeCycleId: 'cycle-income' },
  };
  state.masterCalendarsById = {
    [`calendar-${DEFAULT_PROFILE_ID}`]: {
      id: `calendar-${DEFAULT_PROFILE_ID}`,
      activeGoalIds: ['goal-album', 'goal-app', 'goal-podcast', 'goal-pm', 'goal-income'],
      activeCycleIds: ['cycle-album', 'cycle-app', 'cycle-podcast', 'cycle-pm', 'cycle-income'],
      baseWeeklyCapacityHours: 40,
      availableCapacityHours: 32,
    },
  };
  state.strategicClustersById = {
    'cluster-oct17': {
      id: 'cluster-oct17',
      label: 'oct17 launch',
      goalIds: ['goal-album', 'goal-app', 'goal-podcast'],
      cycleIds: ['cycle-album', 'cycle-app', 'cycle-podcast'],
      sharedAnchorDayKey: '2026-10-17',
    },
  };
  state.constraintRelations = [
    {
      profileId: DEFAULT_PROFILE_ID,
      sourceGoalId: 'goal-income',
      targetGoalId: 'goal-album',
      relationType: 'capital_pressure',
      severity: 'high',
      scope: 'global',
    },
  ];
  return state;
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

  it('renders non-empty canonical milestones after intake completion', async () => {
    mockStore = buildFinalizedMasterPlanState();

    await act(async () => {
      render(<MasterPlanTimeline />);
    });

    expect(
      screen.getByRole('heading', { name: /Ship the app, release the EP/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Master Calendar Context/i)).toBeInTheDocument();
    expect(screen.getByText(/Integrated strategic clusters/i)).toBeInTheDocument();
    expect(screen.getByText(/Oct17 Launch/i)).toBeInTheDocument();
    expect(screen.getByText(/Album rollout · App launch · Podcast rollout/i)).toBeInTheDocument();
    expect(screen.getByText(/Independent goals on the same calendar/i)).toBeInTheDocument();
    expect(screen.getByText(/PM company · Income stream/i)).toBeInTheDocument();
    expect(screen.getByText(/Global pressure/i)).toBeInTheDocument();
    expect(screen.getByText(/Income stream · Capital Pressure/i)).toBeInTheDocument();
    expect(screen.getAllByTestId(/milestone-dot-/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Oct 17 launch target/i)).toBeInTheDocument();

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByText('App launch'));
    });

    expect(screen.getByText('Feature freeze')).toBeInTheDocument();
    expect(screen.getByText('Internal test complete')).toBeInTheDocument();
    expect(screen.getByText('Closed beta')).toBeInTheDocument();
    expect(screen.getByText('App store submitted')).toBeInTheDocument();
    expect(screen.getByText('LAUNCH')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByLabelText(/close lane detail/i));
      await user.click(screen.getByText('Album rollout'));
    });

    expect(screen.getByText('Distribution submitted')).toBeInTheDocument();
    expect(screen.getByText('Artwork finalized')).toBeInTheDocument();
    expect(screen.getByText('Pre-release single 1')).toBeInTheDocument();
    expect(screen.getByText('Pre-release single 2')).toBeInTheDocument();
    expect(screen.getByText('Final promo push begins')).toBeInTheDocument();
    expect(screen.getByText('DROP')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByLabelText(/close lane detail/i));
      await user.click(screen.getByText('PM company'));
    });

    expect(screen.getByText('Positioning complete')).toBeInTheDocument();
    expect(screen.getByText('Outreach started')).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByLabelText(/close lane detail/i));
      await user.click(screen.getByText('Income stream'));
    });

    expect(screen.getByText('First revenue event')).toBeInTheDocument();
    expect(screen.getByText(/flex: none/i)).toBeInTheDocument();
  });
});
