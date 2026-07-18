import { describe, it, expect } from 'vitest';
import { identityReducer, attemptGoalAdmissionPure, buildBlankIdentityState } from '../../src/state/identityStore.js';

// Minimal state scaffold sufficient for RESET_IDENTITY to read profile + plan data.
function makeContaminatedState(overrides = {}) {
  const base = buildBlankIdentityState({
    activeProfileId: 'p1',
    displayName: 'James / Operation Endgame',
    profileLabel: 'James / Operation Endgame',
    roleLabel: 'GSS founder',
    timeZone: 'UTC',
    nowISO: '2026-07-04T00:00:00.000Z',
  });
  // Write the contaminated displayName into the profile (simulates old MissionSetupFlow data)
  base.profilesById['p1'].displayName = 'James / Operation Endgame';
  base.profilesById['p1'].label = 'James / Operation Endgame';
  base.profilesById['p1'].roleLabel = 'GSS founder';
  base.profilesById['p1'].activeMasterPlanId = 'mp1';
  base.profilesById['p1'].masterPlanIds = ['mp1'];
  base.profilesById['p1'].goalIds = ['g1'];
  base.profilesById['p1'].activeGoalId = 'g1';
  base.masterPlansById = {
    mp1: { id: 'mp1', title: 'Operation Endgame', coreMission: 'Scale GSS' },
  };
  base.goalsById = {
    g1: { id: 'g1', profileId: 'p1' },
  };
  base.cyclesById = {
    c1: { id: 'c1', profileId: 'p1', status: 'Active', goalId: 'g1' },
  };
  base.activeCycleId = 'c1';
  base.activeGoalId = 'g1';
  return { ...base, ...overrides };
}

describe('profileIdentity — goal-clear reset strips embedded plan title', () => {
  it('RESET_IDENTITY strips plan title from displayName when suffix matches a known plan', () => {
    const state = makeContaminatedState();
    const next = identityReducer(state, { type: 'RESET_IDENTITY' });

    const profile = next.profilesById?.['p1'];
    expect(profile).toBeDefined();
    // Name must be just "James" — not "James / Operation Endgame"
    expect(profile.displayName).toBe('James');
    expect(profile.displayName).not.toContain('Operation Endgame');
  });

  it('RESET_IDENTITY preserves roleLabel unchanged', () => {
    const state = makeContaminatedState();
    const next = identityReducer(state, { type: 'RESET_IDENTITY' });

    const profile = next.profilesById?.['p1'];
    expect(profile?.roleLabel).toBe('GSS founder');
  });

  it('RESET_IDENTITY clears goalIds and cycleIds on the profile', () => {
    const state = makeContaminatedState();
    const next = identityReducer(state, { type: 'RESET_IDENTITY' });

    const profile = next.profilesById?.['p1'];
    expect(profile?.goalIds ?? []).toHaveLength(0);
    expect(profile?.activeGoalId).toBeNull();
    expect(next.activeCycleId).toBeNull();
    expect(Object.keys(next.cyclesById ?? {})).toHaveLength(0);
  });

  it('RESET_IDENTITY does NOT strip displayName when the suffix does not match any known plan title', () => {
    const state = makeContaminatedState();
    // Change the stored plan title so it no longer matches the displayName suffix
    state.masterPlansById['mp1'].title = 'Completely Different Title';
    const next = identityReducer(state, { type: 'RESET_IDENTITY' });

    const profile = next.profilesById?.['p1'];
    // "James / Operation Endgame" suffix "Operation Endgame" doesn't match "Completely Different Title"
    // so the displayName should be preserved as-is (no false strip)
    expect(profile?.displayName).toBe('James / Operation Endgame');
  });

  it('RESET_IDENTITY leaves clean displayName untouched (no false strip for names with slashes)', () => {
    const state = makeContaminatedState();
    state.profilesById['p1'].displayName = 'James';
    state.profilesById['p1'].label = 'James';
    const next = identityReducer(state, { type: 'RESET_IDENTITY' });

    expect(next.profilesById?.['p1']?.displayName).toBe('James');
  });

  it('plan title absent from profile container after goal is admitted then cleared', () => {
    // Start from a fresh blank state
    const blank = buildBlankIdentityState({
      activeProfileId: 'p1',
      displayName: 'James',
      roleLabel: 'GSS founder',
      timeZone: 'UTC',
      nowISO: '2026-07-04T00:00:00.000Z',
    });
    blank.profilesById['p1'].displayName = 'James';

    // Admit a goal (this creates a plan)
    const { nextState: afterAdmit } = attemptGoalAdmissionPure(blank, {
      contract: {
        goalId: 'g1',
        goalText: 'I will scale my company to $3.5B net worth by July 4th 2031.',
        terminalOutcome: { text: 'I will scale my company to $3.5B net worth by July 4th 2031.' },
        deadline: { dayKey: '2031-07-04' },
        endDayKey: '2031-07-04',
      },
    });

    // Profile displayName must still be just the name (not contaminated by new code)
    expect(afterAdmit.profilesById?.['p1']?.displayName).toBe('James');

    // Now clear the goal
    const afterClear = identityReducer(afterAdmit, { type: 'RESET_IDENTITY' });
    expect(afterClear.profilesById?.['p1']?.displayName).toBe('James');
    expect(afterClear.profilesById?.['p1']?.goalIds ?? []).toHaveLength(0);
  });
});
