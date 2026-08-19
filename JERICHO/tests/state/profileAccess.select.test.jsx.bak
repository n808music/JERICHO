import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdentityProvider, useIdentityStore } from '../../src/state/identityStore.js';

function buildState() {
  return {
    meta: { version: '1.0.0', onboardingComplete: true },
    appTime: { nowISO: '2026-05-27T12:00:00.000Z', activeDayKey: '2026-05-27', timeZone: 'UTC' },
    today: { date: '2026-05-27', blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: '2026-05-25', days: [] },
    cycle: [],
    activeProfileId: null,
    profileAccess: { status: 'profile_restore_available', selectedProfileId: null },
    profilesById: {
      'profile-endgame': {
        id: 'profile-endgame',
        displayName: 'James / Operation Endgame',
        goalIds: ['goal-endgame'],
        activeGoalId: 'goal-endgame',
        activeMasterPlanId: 'plan-endgame',
        masterCalendarId: 'calendar-endgame',
        strategicClusterIds: [],
        status: 'active',
      },
    },
    goalsById: {
      'goal-endgame': {
        id: 'goal-endgame',
        profileId: 'profile-endgame',
        activeCycleId: 'cycle-endgame',
        status: 'active',
      },
    },
    cyclesById: {
      'cycle-endgame': {
        id: 'cycle-endgame',
        profileId: 'profile-endgame',
        status: 'active',
        goalContract: { goalId: 'goal-endgame', profileId: 'profile-endgame', startDayKey: '2026-05-19', endDayKey: '2031-05-19' },
      },
    },
    masterPlansById: {
      'plan-endgame': {
        id: 'plan-endgame',
        profileId: 'profile-endgame',
        title: 'Operation Endgame',
      },
    },
    masterCalendarsById: {
      'calendar-endgame': { id: 'calendar-endgame', profileId: 'profile-endgame' },
    },
    activeGoalId: null,
    activeCycleId: null,
    goalExecutionContract: null,
    blockStore: { blocks: {} },
    proposedBlocks: [],
    suggestedBlocks: [],
    executionEvents: [],
    scheduleReviewBlocks: [],
    scheduleApplied: false,
    scheduleLifecycle: 'no_schedule',
    pendingPlanConfirmation: false,
    goalAdmissionByGoal: {},
    deliverablesByCycleId: {},
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    constraints: {},
    goalDirective: null,
    directiveEligibilityByGoal: {},
  };
}

function Probe() {
  const store = useIdentityStore();
  return (
    <div>
      <button type="button" onClick={() => store.selectProfile('profile-endgame')}>
        Continue
      </button>
      <p>Profile: {store.activeProfileId || 'none'}</p>
      <p>Goal: {store.activeGoalId || 'none'}</p>
      <p>Cycle: {store.activeCycleId || 'none'}</p>
      <p>Access: {store.profileAccess?.status || 'none'}</p>
    </div>
  );
}

describe('profile access selection', () => {
  it('selects a saved profile and restores active goal and cycle context', async () => {
    render(
      <IdentityProvider initialState={buildState()}>
        <Probe />
      </IdentityProvider>
    );

    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Continue/i }));
    });

    expect(screen.getByText('Profile: profile-endgame')).toBeInTheDocument();
    expect(screen.getByText('Goal: goal-endgame')).toBeInTheDocument();
    expect(screen.getByText('Cycle: cycle-endgame')).toBeInTheDocument();
    expect(screen.getByText('Access: profile_selected')).toBeInTheDocument();
  });
});
