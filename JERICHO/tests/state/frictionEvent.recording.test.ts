import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';

const profileId = DEFAULT_PROFILE_ID;
const calendarId = `calendar-${profileId}`;

function buildState() {
  const state = buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: '2026-05-04T12:00:00.000Z',
    todayDate: '2026-05-04',
  }) as any;
  state.profilesById[profileId].executionCapacityHoursPerWeek = 40;
  state.profilesById[profileId].goalIds = ['goal-app', 'goal-album', 'goal-job'];
  state.profilesById[profileId].activeGoalId = 'goal-app';
  state.activeGoalId = 'goal-app';
  state.activeCycleId = 'cycle-app';
  state.goalsById['goal-app'] = {
    id: 'goal-app',
    profileId,
    title: 'Launch Jericho app for October 17 convergence',
    strategicClusterKey: 'oct17-launch',
    sharedAnchorDayKey: '2026-10-17',
    cycleIds: ['cycle-app'],
    activeCycleId: 'cycle-app',
    status: 'active',
  };
  state.goalsById['goal-album'] = {
    id: 'goal-album',
    profileId,
    title: 'Release album on October 17',
    strategicClusterKey: 'oct17-launch',
    sharedAnchorDayKey: '2026-10-17',
    cycleIds: ['cycle-album'],
    activeCycleId: 'cycle-album',
    status: 'active',
  };
  state.goalsById['goal-job'] = {
    id: 'goal-job',
    profileId,
    title: 'Run project management job search and interviews',
    cycleIds: ['cycle-job'],
    activeCycleId: 'cycle-job',
    status: 'active',
  };
  state.cyclesById['cycle-app'] = {
    id: 'cycle-app',
    goalId: 'goal-app',
    profileId,
    status: 'active',
    goalContract: { goalId: 'goal-app', profileId, goalText: 'Launch Jericho app', endDayKey: '2026-10-17' },
    executionEvents: [],
    externalEvidenceEvents: [],
    planMutationEvents: [],
  };
  state.cyclesById['cycle-album'] = {
    id: 'cycle-album',
    goalId: 'goal-album',
    profileId,
    status: 'active',
    goalContract: { goalId: 'goal-album', profileId, goalText: 'Release album', endDayKey: '2026-10-17' },
    executionEvents: [],
    externalEvidenceEvents: [],
    planMutationEvents: [],
  };
  state.cyclesById['cycle-job'] = {
    id: 'cycle-job',
    goalId: 'goal-job',
    profileId,
    status: 'active',
    goalContract: { goalId: 'goal-job', profileId, goalText: 'PM job search' },
    executionEvents: [],
    externalEvidenceEvents: [],
    planMutationEvents: [],
  };
  return computeDerivedState(state, { type: 'NO_OP' });
}

describe('friction event recording', () => {
  it('records user friction events canonically and recomputes propagation without mutating schedule', () => {
    const state = buildState();

    const next = computeDerivedState(state, {
      type: 'ADD_FRICTION_EVENT',
      payload: {
        profileId,
        goalId: 'goal-job',
        cycleId: 'cycle-job',
        eventType: 'capacity_loss',
        severity: 'moderate',
        calendarImpactHours: 6,
        startDateISO: '2026-05-05',
        endDateISO: '2026-05-09',
        note: 'Three interview loops this week',
      },
    });

    expect(next.frictionEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profileId,
          goalId: 'goal-job',
          cycleId: 'cycle-job',
          eventType: 'capacity_loss',
          frictionType: 'calendar_burden',
          severity: 'moderate',
          burdenHours: 6,
          startDateISO: '2026-05-05',
          endDateISO: '2026-05-09',
          source: 'user_reported',
        }),
      ])
    );

    const propagation = next.frictionPropagationResults[0];
    expect(propagation).toEqual(
      expect.objectContaining({
        profileId,
        calendarImpactGoalIds: expect.arrayContaining(['goal-app', 'goal-album', 'goal-job']),
        strategicImpactGoalIds: [],
        capacityDeltaHours: -6,
        requiresReallocation: true,
      })
    );
    expect(next.masterCalendarsById[calendarId].availableCapacityHours).toBe(34);
    expect(next.masterCalendarsById[calendarId].capacityLoadHours).toBe(6);
  });

  it('records strategic blockers without falsely merging independent goals', () => {
    const state = buildState();

    const next = computeDerivedState(state, {
      type: 'ADD_FRICTION_EVENT',
      payload: {
        profileId,
        goalId: 'goal-app',
        cycleId: 'cycle-app',
        eventType: 'dependency_delay',
        severity: 'high',
        startDateISO: '2026-05-05',
      },
    });

    const propagation = next.frictionPropagationResults[0];
    expect(propagation).toEqual(
      expect.objectContaining({
        strategicImpactGoalIds: expect.arrayContaining(['goal-app', 'goal-album']),
        calendarImpactGoalIds: expect.arrayContaining(['goal-app', 'goal-album', 'goal-job']),
        requiresReallocation: true,
      })
    );
  });
});
