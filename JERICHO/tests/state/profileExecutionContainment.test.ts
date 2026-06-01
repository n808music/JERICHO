import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';

const profileId = DEFAULT_PROFILE_ID;
const calendarId = `calendar-${profileId}`;
const startDayKey = '2026-05-04';
const launchAnchor = '2026-10-17';

function addGoalWithCycle(state: any, goal: any, cycle: any) {
  state.goalsById[goal.id] = goal;
  state.cyclesById[cycle.id] = cycle;
  state.profilesById[profileId].goalIds.push(goal.id);
}

function buildMultiGoalState() {
  const state = buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: `${startDayKey}T12:00:00.000Z`,
    todayDate: startDayKey,
  }) as any;

  state.profilesById[profileId].executionCapacityHoursPerWeek = 40;
  state.profilesById[profileId].goalIds = [];
  state.profilesById[profileId].activeGoalId = 'goal-album';
  state.activeGoalId = 'goal-album';
  state.activeCycleId = 'cycle-album';

  addGoalWithCycle(
    state,
    {
      id: 'goal-album',
      profileId,
      cycleIds: ['cycle-album'],
      activeCycleId: 'cycle-album',
      status: 'active',
      title: 'Release album on October 17',
      strategicClusterKey: 'oct17-launch',
      sharedAnchorDayKey: launchAnchor,
    },
    {
      id: 'cycle-album',
      goalId: 'goal-album',
      profileId,
      status: 'active',
      goalContract: { goalId: 'goal-album', profileId, goalText: 'Release album on October 17', endDayKey: launchAnchor },
      executionEvents: [],
      externalEvidenceEvents: [],
      planMutationEvents: [],
    }
  );

  addGoalWithCycle(
    state,
    {
      id: 'goal-app',
      profileId,
      cycleIds: ['cycle-app'],
      activeCycleId: 'cycle-app',
      status: 'active',
      title: 'Launch Jericho app for October 17 convergence',
      strategicClusterKey: 'oct17-launch',
      sharedAnchorDayKey: launchAnchor,
    },
    {
      id: 'cycle-app',
      goalId: 'goal-app',
      profileId,
      status: 'active',
      goalContract: { goalId: 'goal-app', profileId, goalText: 'Launch Jericho app', endDayKey: launchAnchor },
      executionEvents: [],
      externalEvidenceEvents: [],
      planMutationEvents: [],
    }
  );

  addGoalWithCycle(
    state,
    {
      id: 'goal-podcast',
      profileId,
      cycleIds: ['cycle-podcast'],
      activeCycleId: 'cycle-podcast',
      status: 'active',
      title: 'Roll out podcast to support the October 17 drop',
      strategicClusterKey: 'oct17-launch',
      sharedAnchorDayKey: launchAnchor,
    },
    {
      id: 'cycle-podcast',
      goalId: 'goal-podcast',
      profileId,
      status: 'active',
      goalContract: { goalId: 'goal-podcast', profileId, goalText: 'Podcast rollout', endDayKey: launchAnchor },
      executionEvents: [],
      externalEvidenceEvents: [],
      planMutationEvents: [],
    }
  );

  addGoalWithCycle(
    state,
    {
      id: 'goal-job',
      profileId,
      cycleIds: ['cycle-job'],
      activeCycleId: 'cycle-job',
      status: 'active',
      title: 'Run project management job search and interviews',
    },
    {
      id: 'cycle-job',
      goalId: 'goal-job',
      profileId,
      status: 'active',
      goalContract: { goalId: 'goal-job', profileId, goalText: 'PM job search' },
      executionEvents: [],
      externalEvidenceEvents: [],
      planMutationEvents: [],
    }
  );

  addGoalWithCycle(
    state,
    {
      id: 'goal-pm-brand',
      profileId,
      cycleIds: ['cycle-pm-brand'],
      activeCycleId: 'cycle-pm-brand',
      status: 'active',
      title: 'Build PM brand and publish case-study proof artifacts',
    },
    {
      id: 'cycle-pm-brand',
      goalId: 'goal-pm-brand',
      profileId,
      status: 'active',
      goalContract: { goalId: 'goal-pm-brand', profileId, goalText: 'PM brand' },
      executionEvents: [],
      externalEvidenceEvents: [],
      planMutationEvents: [],
    }
  );

  addGoalWithCycle(
    state,
    {
      id: 'goal-income',
      profileId,
      cycleIds: ['cycle-income'],
      activeCycleId: 'cycle-income',
      status: 'active',
      title: 'Protect income and extend runway',
      globalConstraintRole: 'income_runway',
    },
    {
      id: 'cycle-income',
      goalId: 'goal-income',
      profileId,
      status: 'active',
      goalContract: { goalId: 'goal-income', profileId, goalText: 'Income and runway' },
      executionEvents: [],
      externalEvidenceEvents: [],
      planMutationEvents: [],
    }
  );

  state.frictionEvents = [
    {
      id: 'friction-job-interview',
      profileId,
      goalId: 'goal-job',
      cycleId: 'cycle-job',
      frictionType: 'calendar_burden',
      severity: 'moderate',
      source: 'simulated',
      burdenHours: 8,
      note: 'Three interview loops this week',
    },
    {
      id: 'friction-app-blocker',
      profileId,
      goalId: 'goal-app',
      cycleId: 'cycle-app',
      frictionType: 'dependency_blocker',
      severity: 'high',
      source: 'simulated',
      note: 'Critical app launch blocker',
    },
  ];

  return computeDerivedState(state, { type: 'NO_OP' });
}

describe('profile execution containment', () => {
  it('assigns one master calendar to all active goals in the profile while preserving independent strategies', () => {
    const state = buildMultiGoalState();

    expect(state.profilesById[profileId].masterCalendarId).toBe(calendarId);
    expect(state.masterCalendarsById[calendarId]).toBeDefined();
    expect(state.masterCalendarsById[calendarId].activeGoalIds).toEqual(
      expect.arrayContaining(['goal-album', 'goal-app', 'goal-podcast', 'goal-job', 'goal-pm-brand', 'goal-income'])
    );

    expect(state.cyclesById['cycle-job'].masterCalendarId).toBe(calendarId);
    expect(state.cyclesById['cycle-album'].masterCalendarId).toBe(calendarId);

    expect(state.goalRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromGoalId: 'goal-album',
          toGoalId: 'goal-job',
          relationType: 'independent_strategy',
        }),
        expect.objectContaining({
          fromGoalId: 'goal-album',
          toGoalId: 'goal-job',
          relationType: 'competes_for_time',
        }),
      ])
    );
  });

  it('forms a strategic cluster only for strategically integrated launch goals', () => {
    const state = buildMultiGoalState();
    const clusterIds = state.profilesById[profileId].strategicClusterIds;

    expect(clusterIds).toHaveLength(1);
    const cluster = state.strategicClustersById[clusterIds[0]];
    expect(cluster.goalIds).toEqual(expect.arrayContaining(['goal-album', 'goal-app', 'goal-podcast']));
    expect(cluster.goalIds).not.toContain('goal-job');
    expect(cluster.sharedAnchorDayKey).toBe(launchAnchor);

    expect(state.goalRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromGoalId: 'goal-album',
          toGoalId: 'goal-app',
          relationType: 'integrated_strategy',
        }),
        expect.objectContaining({
          fromGoalId: 'goal-album',
          toGoalId: 'goal-app',
          relationType: 'shares_anchor',
        }),
      ])
    );
  });

  it('treats income and runway as a global constraint rather than a false strategic merge', () => {
    const state = buildMultiGoalState();

    expect(state.constraintRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceGoalId: 'goal-income',
          targetGoalId: 'goal-album',
          relationType: 'capital_pressure',
          scope: 'global',
        }),
        expect.objectContaining({
          sourceGoalId: 'goal-income',
          targetGoalId: 'goal-job',
          relationType: 'capital_pressure',
          scope: 'global',
        }),
      ])
    );

    expect(state.goalRelations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromGoalId: 'goal-income',
          toGoalId: 'goal-album',
          relationType: 'integrated_strategy',
        }),
      ])
    );
  });

  it('propagates calendar burden globally and strategic blockers only through the related cluster', () => {
    const state = buildMultiGoalState();

    const jobInterview = state.frictionPropagationResults.find(
      (result: any) => result.frictionEventId === 'friction-job-interview'
    );
    expect(jobInterview).toBeDefined();
    expect(jobInterview.calendarImpactGoalIds).toEqual(
      expect.arrayContaining(['goal-album', 'goal-app', 'goal-podcast', 'goal-job', 'goal-pm-brand', 'goal-income'])
    );
    expect(jobInterview.strategicImpactGoalIds).toEqual([]);
    expect(jobInterview.capacityDeltaHours).toBe(-8);
    expect(state.masterCalendarsById[calendarId].availableCapacityHours).toBeLessThan(40);

    const appBlocker = state.frictionPropagationResults.find(
      (result: any) => result.frictionEventId === 'friction-app-blocker'
    );
    expect(appBlocker).toBeDefined();
    expect(appBlocker.strategicImpactGoalIds).toEqual(
      expect.arrayContaining(['goal-album', 'goal-app', 'goal-podcast'])
    );
    expect(appBlocker.strategicImpactGoalIds).not.toContain('goal-job');
    expect(appBlocker.requiresReallocation).toBe(true);
  });
});
