import { describe, expect, it } from 'vitest';

import {
  buildBlankIdentityState,
  DEFAULT_PROFILE_ID,
  rehydratePersistedState,
} from '../../src/state/identityStore.js';

describe('master-plan persistence contract hardening', () => {
  it('preserves an existing profile activeGoalId when rebuilding blank state around persisted profiles', () => {
    const state = buildBlankIdentityState({
      activeProfileId: DEFAULT_PROFILE_ID,
      profilesById: {
        [DEFAULT_PROFILE_ID]: {
          id: DEFAULT_PROFILE_ID,
          label: 'Local Profile',
          goalIds: ['goal-123'],
          activeGoalId: 'goal-123',
          masterPlanIds: ['mp-1'],
          activeMasterPlanId: 'mp-1',
          status: 'active',
        },
      },
    });

    expect(state.profilesById[DEFAULT_PROFILE_ID].activeGoalId).toBe('goal-123');
    expect(state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId).toBe('mp-1');
  });

  it('restores the active master plan pointer when one valid profile-owned plan exists', () => {
    const state = buildBlankIdentityState({
      timeZone: 'UTC',
      nowISO: '2026-05-19T12:00:00.000Z',
      todayDate: '2026-05-19',
    });
    state.profilesById[DEFAULT_PROFILE_ID].masterPlanIds = ['mp-1'];
    state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = null;
    state.masterPlansById = {
      'mp-1': {
        id: 'mp-1',
        profileId: DEFAULT_PROFILE_ID,
        title: 'Operation Endgame',
        laneIds: [],
        anchors: [],
      },
    };

    const rehydrated = rehydratePersistedState(JSON.parse(JSON.stringify(state)));

    expect(rehydrated.profilesById[DEFAULT_PROFILE_ID].masterPlanIds).toEqual(['mp-1']);
    expect(rehydrated.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId).toBe('mp-1');
  });

  it('quarantines orphaned active execution when the owning goal and master plan are missing', () => {
    const state = buildBlankIdentityState({
      timeZone: 'UTC',
      nowISO: '2026-05-19T12:00:00.000Z',
      todayDate: '2026-05-19',
    });
    state.activeCycleId = 'cycle-2026-05-19-1';
    state.cyclesById = {
      'cycle-2026-05-19-1': {
        id: 'cycle-2026-05-19-1',
        status: 'active',
        profileId: DEFAULT_PROFILE_ID,
        goalId: 'masterplan:mp-missing',
        masterPlanId: 'mp-missing',
        goalContract: {
          goalId: 'masterplan:mp-missing',
          profileId: DEFAULT_PROFILE_ID,
          goalText: 'Lost plan substrate',
        },
      },
    };
    state.profilesById[DEFAULT_PROFILE_ID].activeGoalId = 'masterplan:mp-missing';
    state.activeGoalId = 'masterplan:mp-missing';

    const rehydrated = rehydratePersistedState(JSON.parse(JSON.stringify(state)));

    expect(rehydrated.activeCycleId).toBeNull();
    expect(rehydrated.activeGoalId).toBeNull();
    expect(rehydrated.profilesById[DEFAULT_PROFILE_ID].activeGoalId).toBeNull();
    expect(rehydrated.cyclesById['cycle-2026-05-19-1'].status).toBe('orphaned');
    expect(rehydrated.cyclesById['cycle-2026-05-19-1'].orphanedReasonCodes).toContain('ACTIVE_MASTER_PLAN_MISSING');
    expect(rehydrated.planRecovery).toMatchObject({
      required: 'PERSISTED_PLAN_MISSING',
      route: 'STRUCTURE_INTAKE',
    });
  });

  it('preserves in-progress master-plan intake answers across rehydration', () => {
    const state = buildBlankIdentityState({
      timeZone: 'UTC',
      nowISO: '2026-05-19T12:00:00.000Z',
      todayDate: '2026-05-19',
    });
    state.masterPlanIntake = {
      status: 'in-progress',
      phase: 1,
      step: 2,
      profileId: DEFAULT_PROFILE_ID,
      answers: {
        step_1: 'Build a 5-year multi-venture platform reaching 10k users and coordinate Operation Endgame.',
      },
      extractedLanes: [{ title: 'App launch', domain: 'product', role: 'revenue-engine' }],
      anchors: [],
      currentLaneIdx: 0,
      clarifyingQuestionIdx: 0,
      questionPlan: null,
      draft: null,
      errorMessage: null,
    };

    const rehydrated = rehydratePersistedState(JSON.parse(JSON.stringify(state)));

    expect(rehydrated.masterPlanIntake.status).toBe('in-progress');
    expect(rehydrated.masterPlanIntake.step).toBe(2);
    expect(rehydrated.masterPlanIntake.answers.step_1).toMatch(/Operation Endgame/);
    expect(rehydrated.masterPlanIntake.profileId).toBe(DEFAULT_PROFILE_ID);
  });
});
