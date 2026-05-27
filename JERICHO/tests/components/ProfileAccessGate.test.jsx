import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { evaluateProfileContextCoherence, ProfileAccessGate } from '../../src/components/AppShell.jsx';

describe('ProfileAccessGate', () => {
  it('offers saved profiles as continue actions', async () => {
    const selectProfile = vi.fn();
    render(
      <ProfileAccessGate
        store={{
          profilesById: {
            'profile-endgame': {
              id: 'profile-endgame',
              displayName: 'James / Operation Endgame',
              roleLabel: 'GSS founder',
            },
          },
          selectProfile,
        }}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Continue as James \/ Operation Endgame/i }));

    expect(selectProfile).toHaveBeenCalledWith('profile-endgame');
  });

  it('does not render execution navigation before profile selection', () => {
    render(
      <ProfileAccessGate
        store={{
          profilesById: {
            'profile-endgame': {
              id: 'profile-endgame',
              displayName: 'James / Operation Endgame',
            },
          },
          selectProfile: vi.fn(),
        }}
      />
    );

    expect(screen.queryByRole('button', { name: /Structure/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Today/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Stability/i })).not.toBeInTheDocument();
  });

  it('offers profile creation when no saved profiles exist', async () => {
    const upsertProfileDetails = vi.fn();
    const selectProfile = vi.fn();
    render(
      <ProfileAccessGate
        store={{
          activeProfileId: 'profile-local-default',
          profilesById: {},
          upsertProfileDetails,
          selectProfile,
        }}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Create profile/i }));

    expect(upsertProfileDetails).toHaveBeenCalledWith({
      profileId: expect.stringMatching(/^profile-local-/),
      displayName: 'New Profile',
    });
    expect(selectProfile).toHaveBeenCalledWith(expect.stringMatching(/^profile-local-/));
  });

  it('offers Operation Endgame restore as a product-facing recovery action', async () => {
    const restoreOperationEndgameProfile = vi.fn();
    render(
      <ProfileAccessGate
        store={{
          activeProfileId: 'profile-local-default',
          profilesById: {},
          operationEndgameRestoreAvailable: true,
          restoreOperationEndgameProfile,
          upsertProfileDetails: vi.fn(),
          selectProfile: vi.fn(),
        }}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Restore Operation Endgame/i }));

    expect(restoreOperationEndgameProfile).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Create profile/i })).toBeInTheDocument();
  });

  it('hides placeholder local profiles from saved-profile continuation', () => {
    render(
      <ProfileAccessGate
        store={{
          activeProfileId: 'profile-local-default',
          profilesById: {
            'profile-local-default': {
              id: 'profile-local-default',
              displayName: 'Local Profile',
              label: 'Local Profile',
            },
          },
          selectProfile: vi.fn(),
        }}
      />
    );

    expect(screen.queryByRole('button', { name: /Continue as Local Profile/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create profile/i })).toBeInTheDocument();
  });

  it('marks the default demo seed as incoherent profile context', () => {
    const coherence = evaluateProfileContextCoherence({
      activeProfileId: 'profile-local-default',
      profileAccess: { status: 'profile_selected', selectedProfileId: 'profile-local-default' },
      profilesById: {
        'profile-local-default': {
          id: 'profile-local-default',
          displayName: 'Local Profile',
          label: 'Local Profile',
          goalIds: ['goal-1'],
          activeGoalId: 'goal-1',
          activeCycleId: 'cycle-1',
          masterCalendarId: 'calendar-profile-local-default',
        },
      },
      goalsById: {
        'goal-1': { id: 'goal-1', profileId: 'profile-local-default', activeCycleId: 'cycle-1' },
      },
      cyclesById: {
        'cycle-1': { id: 'cycle-1', profileId: 'profile-local-default', goalContract: { goalId: 'goal-1' } },
      },
      masterCalendarsById: {},
      activeCycleId: 'cycle-1',
    });

    expect(coherence.coherent).toBe(false);
    expect(coherence.reasonCodes).toEqual(
      expect.arrayContaining(['PLACEHOLDER_PROFILE_CONTEXT', 'PLACEHOLDER_GOAL_CONTEXT', 'PLACEHOLDER_CYCLE_CONTEXT'])
    );
  });
});
