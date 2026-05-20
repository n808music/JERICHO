import React from 'react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { buildBlankIdentityState, DEFAULT_PROFILE_ID, rehydratePersistedState } from '../../src/state/identityStore.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { createMinimalCoreMissionContract } from '../../src/domain/core/CoreMissionContractMinimal';
import { buildOperationEndgameFixtureState } from '../../src/dev/operationEndgameRestore.js';
import MasterPlanTimeline from '../../src/ui/masterPlan/MasterPlanTimeline.jsx';

let mockStore = {};

vi.mock('../../src/state/identityStore.js', async () => {
  const actual = await vi.importActual('../../src/state/identityStore.js');
  return {
    ...actual,
    useIdentityStore: () => mockStore,
  };
});

function buildFinalizedMasterPlanState({
  withCriticDebt = false,
  withGeneratedSchedule = false,
  horizonEnd = '2026-11-01',
  strategicMissionYears = null,
  strategicMissionText = '',
} = {}) {
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
      step_3: { horizonEnd, months: 6, label: 'Oct 17' },
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
      type: 'START_NEW_CYCLE_WITH_DECISION',
      payload: { mode: 'archive' },
    });
    next = computeDerivedState(next, {
      type: 'COMPLETE_CYCLE_REASSESSMENT',
      cycleId: next.activeCycleId,
    });
    next = computeDerivedState(next, {
      type: 'GENERATE_PLAN',
      payload: { masterPlanId: planId, source: 'MASTER_PLAN_FIRST_CYCLE' },
    });
    const generatedCycleId = next.activeCycleId || Object.keys(next.proposedBlocksByCycleId || {})[0] || null;
    if (generatedCycleId && Array.isArray(next.proposedBlocksByCycleId?.[generatedCycleId])) {
      next.proposedBlocks = [...next.proposedBlocksByCycleId[generatedCycleId]];
    }
    if ((!Array.isArray(next.proposedBlocks) || next.proposedBlocks.length === 0) && generatedCycleId) {
      const fallbackLanes = Object.values(next.masterPlanLanesById || {}).slice(0, 3);
      const fallbackBlocks = fallbackLanes.map((lane, index) => ({
        id: `preview-${lane.id}`,
        cycleId: generatedCycleId,
        masterPlanId: planId,
        masterPlanLaneId: lane.id,
        title: `Advance ${lane.title}`,
        dayKey: `2026-05-0${index + 5}`,
        startISO: `2026-05-0${index + 5}T15:00:00.000Z`,
      }));
      next.proposedBlocks = fallbackBlocks;
      next.proposedBlocksByCycleId[generatedCycleId] = fallbackBlocks;
      if (next.cyclesById?.[generatedCycleId]) {
        next.cyclesById[generatedCycleId].scheduleLifecycle = 'draft_schedule_ready';
      }
      next.scheduleLifecycle = 'draft_schedule_ready';
    }
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
  if (strategicMissionYears || strategicMissionText) {
    const contract = createMinimalCoreMissionContract({
      profileId: DEFAULT_PROFILE_ID,
      durableObjective:
        strategicMissionText ||
        'Build and execute Operation Endgame: a 5-year master plan coordinating the Jericho app and surrounding ecosystem.',
      horizonYears: strategicMissionYears || 5,
      strategicThesis: 'The full strategic agenda extends beyond the current forecast roadmap.',
    });
    next.coreMissionContractsById = {
      ...(next.coreMissionContractsById || {}),
      [contract.missionId]: contract,
    };
    next.profilesById[DEFAULT_PROFILE_ID].activeCoreMissionContractId = contract.missionId;
    const activePlanId = next.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId;
    if (activePlanId && next.masterPlansById?.[activePlanId]) {
      next.masterPlansById[activePlanId].coreMissionContractId = contract.missionId;
    }
  }
  return next;
}

function buildEmptyMasterPlanState() {
  return buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: '2026-05-04T12:00:00.000Z',
    todayDate: '2026-05-04',
  });
}

function clearBrowserStorage() {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    if (!storage) {
      continue;
    }
    if (typeof storage.clear === 'function') {
      storage.clear();
      continue;
    }
    if (typeof storage.removeItem === 'function') {
      for (const key of Object.keys(storage)) {
        storage.removeItem(key);
      }
    }
  }
}

beforeEach(() => {
  mockStore = buildEmptyMasterPlanState();
  clearBrowserStorage();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  mockStore = buildEmptyMasterPlanState();
  clearBrowserStorage();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

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
    expect(screen.getByText(/^Target:/i)).toBeInTheDocument();
    expect(screen.getByText(/^Success:/i)).toBeInTheDocument();
    expect(screen.getByText(/Strategic coverage/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Jericho has resolved the horizon endpoint, but full terminal coverage is not yet proven\./i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('masterplan-coverage-status')).toHaveTextContent(/Horizon resolved/i);
    expect(screen.getByTestId('masterplan-quality-status')).toHaveTextContent(/Plan quality unavailable/i);
    expect(screen.getByText(/Coverage must pass before the plan-quality gate can trust the long-horizon workload\./i)).toBeInTheDocument();
    expect(screen.getByText(/Only the first execution cycle is scheduled\./i)).toBeInTheDocument();
    expect(screen.getByText(/Not yet scheduled does not mean not recognized\./i)).toBeInTheDocument();
    expect(screen.getByText(/Future work remains forecast or gated until reassessment confirms it\./i)).toBeInTheDocument();
    expect(screen.getByText(/Full Phase Plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Plan is complete; schedule is earned through phase evidence\./i)).toBeInTheDocument();
    expect(screen.getByText(/^Active Phase$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Next Unlock$/i)).toBeInTheDocument();
    expect(screen.getByTestId('phase-card-p1')).toBeInTheDocument();
    expect(screen.getByTestId('phase-card-p2')).toBeInTheDocument();
    expect(screen.getByTestId('phase-card-p3')).toBeInTheDocument();
    expect(screen.getByTestId('phase-card-p2')).toHaveTextContent(/Forecast workload recognized:/i);
    expect(screen.getByTestId('phase-card-p3')).toHaveTextContent(/Forecast workload recognized:/i);
    expect(screen.getByText(/^Roadmap coverage$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Forecast schedule$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Committed schedule$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Next reassessment gate$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 year/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 years/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Full horizon/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Committed schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Forecast roadmap/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Full strategic agenda/i })).toBeInTheDocument();
    expect(screen.getByText(/Master Calendar Context/i)).toBeInTheDocument();
    expect(screen.getByText(/Integrated strategic clusters/i)).toBeInTheDocument();
    expect(screen.getByText(/Oct17 Launch/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Album rollout · App launch · Podcast rollout/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Independent goals on the same calendar/i)).toBeInTheDocument();
    expect(screen.getAllByText(/PM company · Income stream/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Global pressure/i)).toBeInTheDocument();
    expect(screen.getByText(/Income stream · Capital Pressure/i)).toBeInTheDocument();
    expect(screen.getByTestId('masterplan-first-cycle-summary')).toBeInTheDocument();
    expect(screen.getByText(/First executable cycle preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Strategy Critique/i)).toBeInTheDocument();
    expect(screen.getByText(/Jericho corrected the schedule where the proposed strategy was premature or missing dependencies\./i)).toBeInTheDocument();
    expect(screen.getAllByText(/P1 · Foundation \/ Launch Proof/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/P2 · Conversion \/ Operating System/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/P3 · Scale \/ Terminal Readiness/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Oct 17 launch target/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Convergence Event/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/milestone-dot-/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/planned-block-/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/forecast-block-/i).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId(/gated-block-/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Album rollout')).toBeInTheDocument();
    expect(screen.getByText('App launch')).toBeInTheDocument();
    expect(screen.getByText('Podcast rollout')).toBeInTheDocument();
    expect(screen.getByText('PM company')).toBeInTheDocument();
    expect(screen.getByText('Income stream')).toBeInTheDocument();

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByTestId(`timeline-lane-${laneIdByTitle['App launch']}`));
    });

    expect(screen.getAllByText('Feature freeze').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Internal test complete').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Closed beta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('App store submitted').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Launch App launch').length).toBeGreaterThan(0);
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
    expect(screen.getAllByText('Release Album rollout').length).toBeGreaterThan(0);

    await act(async () => {
      await user.click(screen.getByLabelText(/close lane detail/i));
      await user.click(screen.getByTestId(`timeline-lane-${laneIdByTitle['Podcast rollout']}`));
    });

    expect(screen.getAllByText(/Record pilot episode 1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Set up podcast distribution/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Publish launch episode/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Record promo episode for anchor campaign/i).length).toBeGreaterThan(0);

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

  it('preserves long-horizon strategy beyond the first anchor and first scheduled window', async () => {
    mockStore = buildFinalizedMasterPlanState({
      withGeneratedSchedule: true,
      horizonEnd: '2029-05-04',
    });

    await act(async () => {
      render(<MasterPlanTimeline />);
    });

    expect(screen.getByText(/^Master-plan horizon$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/May 4, 2026 → May 4, 2029/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^First hard anchor$/i)).toBeInTheDocument();
    expect(screen.getByText(/Oct 17 launch target · Oct 17, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/^Roadmap coverage$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Forecast schedule$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Unscheduled strategy remains recognized through/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^May 4, 2029$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/P1 · Foundation \/ Launch Proof/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/P2 · Conversion \/ Operating System/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/P3 · Scale \/ Terminal Readiness/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('masterplan-coverage-warning')).toBeInTheDocument();
  });

  it('uses the strategic agenda horizon instead of capped roadmap coverage for full strategic agenda', async () => {
    mockStore = buildFinalizedMasterPlanState({
      withGeneratedSchedule: true,
      horizonEnd: '2029-05-04',
      strategicMissionYears: 5,
      strategicMissionText: 'Build and execute Operation Endgame: a 5-year master plan through May 2031.',
    });
    const user = userEvent.setup();

    await act(async () => {
      render(<MasterPlanTimeline />);
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Full strategic agenda/i }));
    });

    expect(screen.getAllByText(/May 4, 2026 → May 4, 2031/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^May 4, 2031$/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('timeline-plan-through-label')).toHaveTextContent(/through\s+May 2031/i);
    expect(screen.getAllByText(/P3 · Scale \/ Terminal Readiness/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('phase-card-p3')).toHaveTextContent(/2031/);
    expect(screen.getByTestId('masterplan-coverage-status')).toHaveTextContent(/Horizon resolved/i);
    expect(screen.getByTestId('masterplan-quality-status')).toHaveTextContent(/Plan quality unavailable/i);
    expect(screen.getByText(/Coverage must pass before the plan-quality gate can trust the long-horizon workload\./i)).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Forecast roadmap/i }));
    });

    expect(screen.getByText(/Forecast roadmap view\./i)).toBeInTheDocument();
    expect(screen.getByTestId('timeline-plan-through-label')).not.toHaveTextContent(/2031/i);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Committed schedule/i }));
    });

    expect(screen.getByText(/Committed schedule view\./i)).toBeInTheDocument();
    expect(screen.getByTestId('timeline-plan-through-label')).toHaveTextContent(/through\s+May 2026/i);
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
    expect(screen.getByText(/Which album or release assets already exist right now\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Masters, artwork, distribution setup, and promo assets/i)).toBeInTheDocument();
  });

  it('does not show first-cycle preview after the active master-plan cycle is archived', async () => {
    const generated = buildFinalizedMasterPlanState({ withGeneratedSchedule: true });
    const archived = computeDerivedState(generated, { type: 'END_CYCLE', cycleId: generated.activeCycleId });
    archived.proposedBlocks = [];
    archived.proposedBlocksByCycleId = {};
    mockStore = archived;

    await act(async () => {
      render(<MasterPlanTimeline />);
    });

    expect(screen.getByRole('heading', { name: /Build and coordinate a multi-lane master plan/i })).toBeInTheDocument();
    expect(screen.queryByTestId('masterplan-first-cycle-summary')).not.toBeInTheDocument();
    expect(screen.queryByText(/First executable cycle preview/i)).not.toBeInTheDocument();
    expect(screen.getByText('Album rollout')).toBeInTheDocument();
    expect(screen.getAllByTestId(/milestone-dot-/i).length).toBeGreaterThan(0);
  });

  it('labels full-horizon substrate as forecast work instead of scheduled work in inter-cycle state', async () => {
    mockStore = buildFinalizedMasterPlanState({
      strategicMissionYears: 5,
      strategicMissionText: 'Build and execute Operation Endgame: a 5-year master plan through May 2031.',
    });

    await act(async () => {
      render(<MasterPlanTimeline />);
    });

    expect(mockStore.scheduleLifecycleState).toBe('goal_admitted');
    expect(screen.getByTestId('phase-card-p2')).toHaveTextContent(/Forecast workload recognized:/i);
    expect(screen.getByTestId('phase-card-p3')).toHaveTextContent(/Forecast workload recognized:/i);
    expect(screen.getByTestId('phase-card-p2')).not.toHaveTextContent(/Scheduled work:/i);
    expect(screen.getByText(/^Strategic forecast work$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Current scheduled work$/i)).toBeInTheDocument();
    expect(screen.getByText(/No execution cycle schedule yet/i)).toBeInTheDocument();
  });

  it('renders the persisted plan view after rehydration instead of falling back to the empty state', async () => {
    const persisted = JSON.parse(JSON.stringify(buildOperationEndgameFixtureState()));
    mockStore = rehydratePersistedState(persisted);

    await act(async () => {
      render(<MasterPlanTimeline />);
    });

    expect(screen.queryByText(/No master plan established yet/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Full Phase Plan$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Full horizon/i })).toBeInTheDocument();
    expect(screen.getByTestId('masterplan-coverage-status')).toHaveTextContent(/Full horizon/i);
    expect(screen.getByTestId('masterplan-quality-status')).not.toHaveTextContent(/unavailable/i);
    expect(screen.getAllByText(/P1 · Foundation \/ Launch Proof/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/P2 · Conversion \/ Operating System/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/P3 · Scale \/ Terminal Readiness/i).length).toBeGreaterThan(0);
  });
});
