import React from 'react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockStore = {};

vi.mock('../../src/state/identityStore.js', () => ({
  IdentityProvider: ({ children }) => children,
  useIdentityStore: () => mockStore,
}));

vi.mock('../../src/core/state.js', () => ({
  JerichoProvider: ({ children }) => children,
}));

vi.mock('../../src/components/ZionDashboard.jsx', () => ({
  default: () => <div data-testid="zion-dashboard">Zion Dashboard</div>,
}));

describe('AppShell auth/profile split-brain gating', () => {
  let localStorageStore = {};
  let AppShell;

  beforeEach(async () => {
    mockStore = {
      activeProfileId: '',
      profileAccess: { status: '', selectedProfileId: '' },
      profilesById: {},
      goalsById: {},
      cyclesById: {},
      masterCalendarsById: {},
      masterPlansById: {},
    };
    localStorageStore = {};
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key) => localStorageStore[key] ?? null,
        setItem: (key, value) => {
          localStorageStore[key] = String(value);
        },
        removeItem: (key) => {
          delete localStorageStore[key];
        },
        clear: () => {
          localStorageStore = {};
        },
      },
      writable: true,
      configurable: true,
    });
    delete window.__jerichoRestoreOperationEndgame;
    ({ default: AppShell } = await import('../../src/components/AppShell.jsx'));
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete window.__jerichoRestoreOperationEndgame;
  });

  it('treats local identity without account/session as unauthenticated local profile state', () => {
    localStorageStore['jericho-identity'] = JSON.stringify({
      activeProfileId: 'profile-endgame',
      profilesById: { 'profile-endgame': { id: 'profile-endgame', displayName: 'James / Operation Endgame' } },
    });

    render(<AppShell />);

    expect(screen.queryByText(/Signed in as james/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('local-profile-restore-notice')).toHaveTextContent(
      /not authenticated account access/i
    );
    expect(screen.queryByText(/Continue as James/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('login-gate')).toBeInTheDocument();
  });

  it('requires sign-in when session was explicitly signed out, without deleting the account', () => {
    localStorageStore['jericho-account'] = JSON.stringify({
      username: 'james',
      passwordHash: 'hash',
      createdAt: 1,
    });
    // Auth Containment Stabilization: only explicit sign-out blocks auto-resume.
    // Crash/reload paths recover silently; this test pins the explicit-signout branch.
    localStorageStore['jericho-session-clear-reason'] = JSON.stringify({
      reason: 'explicit_sign_out',
      at: Date.now(),
    });
    localStorageStore['jericho-last-explicit-signout-at'] = String(Date.now());

    render(<AppShell />);

    expect(screen.queryByText(/Signed in as james/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('account-signin-required-notice')).toHaveTextContent(/sign in again/i);
    expect(screen.getByTestId('login-gate')).toBeInTheDocument();
    expect(localStorageStore['jericho-account']).toBeDefined();
  });

  it('renders authenticated header from session/account truth instead of jericho-identity display name', () => {
    localStorageStore['jericho-account'] = JSON.stringify({
      username: 'james',
      passwordHash: 'hash',
      createdAt: 1,
    });
    localStorageStore['jericho-session'] = JSON.stringify({
      username: 'james',
      issuedAt: 2,
    });
    localStorageStore['jericho-identity'] = JSON.stringify({
      activeProfileId: 'profile-endgame',
      profilesById: { 'profile-endgame': { id: 'profile-endgame', displayName: 'James / Operation Endgame' } },
    });

    render(<AppShell />);

    expect(screen.getByText(/Signed in as james/i)).toBeInTheDocument();
    expect(screen.queryByTestId('login-gate')).not.toBeInTheDocument();
  });

  it('does not let missing backend sync token change authenticated UI state by itself', () => {
    localStorageStore['jericho-account'] = JSON.stringify({
      username: 'james',
      passwordHash: 'hash',
      createdAt: 1,
    });
    localStorageStore['jericho-session'] = JSON.stringify({
      username: 'james',
      issuedAt: 2,
    });
    localStorageStore['jericho-device-id'] = 'device-1';

    render(<AppShell />);

    expect(screen.getByText(/Signed in as james/i)).toBeInTheDocument();
    expect(localStorageStore['jericho-account']).toBeDefined();
    expect(localStorageStore['jericho-session']).toBeDefined();
  });
});
