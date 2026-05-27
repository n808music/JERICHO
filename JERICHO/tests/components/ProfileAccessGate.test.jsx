import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileAccessGate } from '../../src/components/AppShell.jsx';

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
      profileId: 'profile-local-default',
      displayName: 'Local Profile',
    });
    expect(selectProfile).toHaveBeenCalledWith('profile-local-default');
  });
});
