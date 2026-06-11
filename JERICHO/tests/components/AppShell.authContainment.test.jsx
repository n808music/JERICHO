import React from 'react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

const ACCOUNT_RECORD = {
  username: 'james',
  passwordHash: 'hash',
  createdAt: 1,
};

describe('AppShell — Auth Containment Stabilization', () => {
  let localStorageStore = {};
  let AppShell;
  let localAuth;

  beforeEach(async () => {
    mockStore = {
      activeProfileId: 'profile-endgame',
      profileAccess: { status: 'profile_selected', selectedProfileId: 'profile-endgame' },
      profilesById: {
        'profile-endgame': {
          id: 'profile-endgame',
          displayName: 'James / Operation Endgame',
          masterCalendarId: 'cal-1',
          activeMasterPlanId: 'plan-1',
          goalIds: [],
        },
      },
      goalsById: {},
      cyclesById: {},
      masterCalendarsById: { 'cal-1': { id: 'cal-1' } },
      masterPlansById: { 'plan-1': { id: 'plan-1', profileId: 'profile-endgame' } },
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
    vi.resetModules();
    localAuth = await import('../../src/state/localAuthStore.js');
    ({ default: AppShell } = await import('../../src/components/AppShell.jsx'));
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete window.__jerichoRestoreOperationEndgame;
  });

  it('auto-resumes when account exists, session is missing, and there was no explicit sign-out', () => {
    localStorageStore['jericho-account'] = JSON.stringify(ACCOUNT_RECORD);
    // No session, no explicit signout marker — this is the crash/reload case
    render(<AppShell />);

    expect(screen.getByText(/Signed in as james/i)).toBeInTheDocument();
    expect(screen.queryByTestId('login-gate')).not.toBeInTheDocument();
    // Session should have been written back to localStorage by the resume
    expect(localStorageStore['jericho-session']).toBeDefined();
    expect(JSON.parse(localStorageStore['jericho-session']).username).toBe('james');
  });

  it('does NOT auto-resume after an explicit sign-out — sign-in is still required', () => {
    localStorageStore['jericho-account'] = JSON.stringify(ACCOUNT_RECORD);
    localStorageStore['jericho-session-clear-reason'] = JSON.stringify({
      reason: 'explicit_sign_out',
      at: Date.now(),
    });
    localStorageStore['jericho-last-explicit-signout-at'] = String(Date.now());

    render(<AppShell />);

    expect(screen.queryByText(/Signed in as james/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('login-gate')).toBeInTheDocument();
    expect(screen.getByTestId('account-signin-required-notice')).toBeInTheDocument();
    // Crucially, no session was silently restored
    expect(localStorageStore['jericho-session']).toBeUndefined();
  });

  it('explicit sign-out from authenticated state persists the explicit-signout marker and stays signed out on rerender', async () => {
    const user = userEvent.setup();
    localStorageStore['jericho-account'] = JSON.stringify(ACCOUNT_RECORD);
    localStorageStore['jericho-session'] = JSON.stringify({ username: 'james', issuedAt: 2 });

    const { rerender } = render(<AppShell />);
    expect(screen.getByText(/Signed in as james/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(localStorageStore['jericho-session']).toBeUndefined();
    expect(localStorageStore['jericho-last-explicit-signout-at']).toBeDefined();
    expect(JSON.parse(localStorageStore['jericho-session-clear-reason']).reason).toBe(
      'explicit_sign_out'
    );

    // Rerender simulating a reload — must NOT auto-resume
    rerender(<AppShell />);
    expect(screen.queryByText(/Signed in as james/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('login-gate')).toBeInTheDocument();
  });

  it('AppShell branches on the explicit auth state, not just account && session', () => {
    // Invalid session record (no username) + valid account => account_exists_session_invalid
    // This should NOT be treated identically to a clean recoverable case
    localStorageStore['jericho-account'] = JSON.stringify(ACCOUNT_RECORD);
    localStorageStore['jericho-session'] = JSON.stringify({ issuedAt: 99 });

    render(<AppShell />);
    // Either we resume to a clean session or show login — but we must NEVER render the
    // authenticated tree using an invalid session record.
    expect(screen.queryByText(/Signed in as james \(invalid\)/i)).not.toBeInTheDocument();
  });
});
