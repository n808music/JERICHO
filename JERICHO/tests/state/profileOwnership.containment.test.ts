import { describe, expect, it } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';
import {
  buildBlankIdentityState,
  DEFAULT_PROFILE_ID,
  identityReducer,
  rehydratePersistedState,
} from '../../src/state/identityStore.js';

const cycleId = 'cycle-profile-1';
const goalId = 'goal-profile-1';
const dayKey = '2026-05-12';

function buildProfileOwnedState() {
  const state = buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: `${dayKey}T12:00:00.000Z`,
    todayDate: dayKey,
  }) as any;
  state.activeGoalId = goalId;
  state.activeCycleId = cycleId;
  state.profilesById[DEFAULT_PROFILE_ID].goalIds = [goalId];
  state.profilesById[DEFAULT_PROFILE_ID].activeGoalId = goalId;
  state.goalsById[goalId] = {
    id: goalId,
    profileId: DEFAULT_PROFILE_ID,
    cycleIds: [cycleId],
    activeCycleId: cycleId,
    status: 'active',
    title: 'Create PM case study',
  };
  state.goalExecutionContract = {
    goalId,
    profileId: DEFAULT_PROFILE_ID,
    goalText: 'Create PM case study',
    startDayKey: dayKey,
    endDayKey: '2026-07-11',
  };
  state.cyclesById = {
    [cycleId]: {
      id: cycleId,
      status: 'active',
      goalId,
      profileId: DEFAULT_PROFILE_ID,
      startedAtDayKey: dayKey,
      goalContract: {
        goalId,
        profileId: DEFAULT_PROFILE_ID,
        goalText: 'Create PM case study',
        startDayKey: dayKey,
        endDayKey: '2026-07-11',
      },
      goalGovernanceContract: {
        contractId: `gov-${goalId}`,
        version: 1,
        goalId,
        profileId: DEFAULT_PROFILE_ID,
        activeFromISO: dayKey,
        activeUntilISO: '2026-07-11',
        scope: { domainsAllowed: ['Focus'], timeHorizon: 'week', timezone: 'UTC' },
        governance: {
          suggestionsEnabled: true,
          probabilityEnabled: true,
          minEvidenceEvents: 0,
          cooldowns: { resuggestMinutes: 30, maxSuggestionsPerDay: 6 },
        },
        constraints: { forbiddenDirectives: ['repair'], maxActiveBlocks: 6 },
      },
      scheduleLifecycle: 'applied_review',
      scheduleReviewBlocks: [],
      executionEvents: [],
      externalEvidenceEvents: [],
      planMutationEvents: [],
      truthEntries: [],
    },
  };
  return computeDerivedState(state, { type: 'NO_OP' });
}

describe('profile ownership containment', () => {
  it('creates a default profile root before goal admission', () => {
    const state = buildBlankIdentityState({
      timeZone: 'UTC',
      nowISO: `${dayKey}T12:00:00.000Z`,
      todayDate: dayKey,
    }) as any;

    expect(state.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(state.profilesById[DEFAULT_PROFILE_ID]).toBeDefined();
    expect(state.profilesById[DEFAULT_PROFILE_ID].displayName).toBe('Local Profile');
    expect(state.profilesById[DEFAULT_PROFILE_ID].goalIds).toEqual([]);
    expect(state.activeGoalId).toBeNull();
    expect(state.activeCycleId).toBeNull();
  });

  it('keeps goal and cycle lineage contained under the active profile', () => {
    const state = buildProfileOwnedState();

    expect(state.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(state.activeGoalId).toBe(goalId);
    expect(state.activeCycleId).toBe(cycleId);
    expect(state.goalsById[goalId].profileId).toBe(DEFAULT_PROFILE_ID);
    expect(state.goalsById[goalId].cycleIds).toContain(cycleId);
    expect(state.cyclesById[cycleId].goalId).toBe(goalId);
    expect(state.cyclesById[cycleId].profileId).toBe(DEFAULT_PROFILE_ID);
    expect(state.profilesById[DEFAULT_PROFILE_ID].goalIds).toContain(goalId);
    expect(state.profilesById[DEFAULT_PROFILE_ID].activeGoalId).toBe(goalId);
  });

  it('rehydrates active profile, goal, and cycle coherently', () => {
    const rehydrated = rehydratePersistedState(JSON.parse(JSON.stringify(buildProfileOwnedState()))) as any;

    expect(rehydrated.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(rehydrated.activeGoalId).toBe(goalId);
    expect(rehydrated.activeCycleId).toBe(cycleId);
    expect(rehydrated.profilesById[DEFAULT_PROFILE_ID].activeGoalId).toBe(goalId);
    expect(rehydrated.goalsById[goalId].activeCycleId).toBe(cycleId);
  });

  it('persists profile display-name edits without disturbing ownership pointers', () => {
    const edited = identityReducer(
      buildProfileOwnedState(),
      {
        type: 'UPSERT_PROFILE_DETAILS',
        profileId: DEFAULT_PROFILE_ID,
        displayName: 'James Dotson',
        roleLabel: 'Founder / Operator',
      } as any
    ) as any;

    expect(edited.profilesById[DEFAULT_PROFILE_ID].displayName).toBe('James Dotson');
    expect(edited.profilesById[DEFAULT_PROFILE_ID].roleLabel).toBe('Founder / Operator');
    expect(edited.profilesById[DEFAULT_PROFILE_ID].label).toBe('James Dotson');
    expect(edited.activeGoalId).toBe(goalId);
    expect(edited.activeCycleId).toBe(cycleId);
    expect(edited.profilesById[DEFAULT_PROFILE_ID].goalIds).toContain(goalId);

    const rehydrated = rehydratePersistedState(JSON.parse(JSON.stringify(edited))) as any;
    expect(rehydrated.profilesById[DEFAULT_PROFILE_ID].displayName).toBe('James Dotson');
    expect(rehydrated.profilesById[DEFAULT_PROFILE_ID].roleLabel).toBe('Founder / Operator');
    expect(rehydrated.activeGoalId).toBe(goalId);
    expect(rehydrated.activeCycleId).toBe(cycleId);
  });

  it('reset preserves the profile while clearing active goal state', () => {
    const reset = identityReducer(buildProfileOwnedState(), { type: 'RESET_IDENTITY' } as any);

    expect(reset.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(reset.profilesById[DEFAULT_PROFILE_ID]).toBeDefined();
    expect(reset.profilesById[DEFAULT_PROFILE_ID].displayName).toBe('Local Profile');
    expect(reset.activeGoalId).toBeNull();
    expect(reset.activeCycleId).toBeNull();
    expect(reset.profilesById[DEFAULT_PROFILE_ID].activeGoalId).toBeNull();
    expect(reset.executionEvents).toEqual([]);
  });

  it('clears foreign active goal and cycle pointers outside the active profile lineage', () => {
    const state = buildBlankIdentityState({
      timeZone: 'UTC',
      nowISO: `${dayKey}T12:00:00.000Z`,
      todayDate: dayKey,
    }) as any;
    state.activeProfileId = 'profile-a';
    state.profilesById = {
      'profile-a': { id: 'profile-a', label: 'Profile A', goalIds: [], activeGoalId: null, status: 'active' },
      'profile-b': { id: 'profile-b', label: 'Profile B', goalIds: ['goal-b'], activeGoalId: 'goal-b', status: 'active' },
    };
    state.goalsById = {
      'goal-b': {
        id: 'goal-b',
        profileId: 'profile-b',
        cycleIds: ['cycle-b'],
        activeCycleId: 'cycle-b',
        status: 'active',
      },
    };
    state.activeGoalId = 'goal-b';
    state.activeCycleId = 'cycle-b';
    state.cyclesById = {
      'cycle-b': {
        id: 'cycle-b',
        status: 'active',
        goalId: 'goal-b',
        profileId: 'profile-b',
        goalContract: { goalId: 'goal-b', profileId: 'profile-b', goalText: 'Foreign goal' },
        goalGovernanceContract: {
          contractId: 'gov-goal-b',
          version: 1,
          goalId: 'goal-b',
          profileId: 'profile-b',
          activeFromISO: dayKey,
          activeUntilISO: '2026-06-01',
          scope: { domainsAllowed: [], timeHorizon: 'week', timezone: 'UTC' },
          governance: { suggestionsEnabled: true, probabilityEnabled: true, minEvidenceEvents: 0 },
          constraints: { forbiddenDirectives: ['repair'], maxActiveBlocks: 6 },
        },
      },
    };

    const next = computeDerivedState(state, { type: 'NO_OP' });

    expect(next.activeProfileId).toBe('profile-a');
    expect(next.activeGoalId).toBeNull();
    expect(next.activeCycleId).toBeNull();
    expect(next.profilesById['profile-a'].activeGoalId).toBeNull();
  });
});
