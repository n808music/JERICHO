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

const ACCOUNT_RECORD = {
  username: 'james',
  passwordHash: 'hash',
  createdAt: 1,
};

const REAL_PROFILE_ID = 'profile-endgame';
const PLACEHOLDER_PROFILE_ID = 'profile-local-default';

function makeCoherentStore({ selectProfile, restoreOperationEndgameProfile }) {
  return {
    activeProfileId: REAL_PROFILE_ID,
    profileAccess: { status: 'profile_selected', selectedProfileId: REAL_PROFILE_ID },
    profilesById: {
      [REAL_PROFILE_ID]: {
        id: REAL_PROFILE_ID,
        displayName: 'James / Operation Endgame',
        masterCalendarId: 'cal-1',
        activeMasterPlanId: 'plan-1',
        goalIds: [],
      },
    },
    goalsById: {},
    cyclesById: {},
    masterCalendarsById: { 'cal-1': { id: 'cal-1' } },
    masterPlansById: { 'plan-1': { id: 'plan-1', profileId: REAL_PROFILE_ID } },
    operationEndgameRestoreAvailable: true,
    selectProfile,
    restoreOperationEndgameProfile,
  };
}

function makeUnselectedProfileStore({ selectProfile, restoreOperationEndgameProfile }) {
  // Real profile exists and is the activeProfileId, BUT profileAccess.status
  // is not 'profile_selected' — i.e. ProfileAccessGate would render.
  return {
    activeProfileId: REAL_PROFILE_ID,
    profileAccess: { status: 'profile_required', selectedProfileId: null },
    profilesById: {
      [REAL_PROFILE_ID]: {
        id: REAL_PROFILE_ID,
        displayName: 'James / Operation Endgame',
        masterCalendarId: 'cal-1',
        activeMasterPlanId: 'plan-1',
        goalIds: [],
      },
    },
    goalsById: {},
    cyclesById: {},
    masterCalendarsById: { 'cal-1': { id: 'cal-1' } },
    masterPlansById: { 'plan-1': { id: 'plan-1', profileId: REAL_PROFILE_ID } },
    operationEndgameRestoreAvailable: true,
    selectProfile,
    restoreOperationEndgameProfile,
  };
}

function makeNoRealProfileStore({ selectProfile, restoreOperationEndgameProfile }) {
  // Only the placeholder profile exists; OE restore is available.
  return {
    activeProfileId: PLACEHOLDER_PROFILE_ID,
    profileAccess: { status: 'profile_required', selectedProfileId: null },
    profilesById: {
      [PLACEHOLDER_PROFILE_ID]: {
        id: PLACEHOLDER_PROFILE_ID,
        displayName: 'Local Profile',
      },
    },
    goalsById: {},
    cyclesById: {},
    masterCalendarsById: {},
    masterPlansById: {},
    operationEndgameRestoreAvailable: true,
    selectProfile,
    restoreOperationEndgameProfile,
  };
}

describe('AppShell — Browser Restart Auto-Restore', () => {
  let localStorageStore = {};
  let AppShell;

  beforeEach(async () => {
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
    ({ default: AppShell } = await import('../../src/components/AppShell.jsx'));
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete window.__jerichoRestoreOperationEndgame;
  });

  it('after session resume, auto-selects the persisted active profile when the gate is mismatched', () => {
    // Crash/reload scenario: account exists, no session, no explicit signout.
    localStorageStore['jericho-account'] = JSON.stringify(ACCOUNT_RECORD);

    const selectProfile = vi.fn();
    const restoreOperationEndgameProfile = vi.fn();
    mockStore = makeUnselectedProfileStore({ selectProfile, restoreOperationEndgameProfile });

    render(<AppShell />);

    expect(selectProfile).toHaveBeenCalledTimes(1);
    expect(selectProfile).toHaveBeenCalledWith(REAL_PROFILE_ID);
    expect(restoreOperationEndgameProfile).not.toHaveBeenCalled();
  });

  it('after session resume with no real profile, auto-triggers the Operation Endgame restore', () => {
    localStorageStore['jericho-account'] = JSON.stringify(ACCOUNT_RECORD);

    const selectProfile = vi.fn();
    const restoreOperationEndgameProfile = vi.fn();
    mockStore = makeNoRealProfileStore({ selectProfile, restoreOperationEndgameProfile });

    render(<AppShell />);

    expect(restoreOperationEndgameProfile).toHaveBeenCalledTimes(1);
    expect(selectProfile).not.toHaveBeenCalled();
  });

  it('after session resume but profile context is already coherent, performs no auto-restore', () => {
    localStorageStore['jericho-account'] = JSON.stringify(ACCOUNT_RECORD);

    const selectProfile = vi.fn();
    const restoreOperationEndgameProfile = vi.fn();
    mockStore = makeCoherentStore({ selectProfile, restoreOperationEndgameProfile });

    render(<AppShell />);

    expect(selectProfile).not.toHaveBeenCalled();
    expect(restoreOperationEndgameProfile).not.toHaveBeenCalled();
    // Dashboard should render directly.
    expect(screen.getByTestId('zion-dashboard')).toBeInTheDocument();
  });

  it('when the session was already active (no resume), does not auto-restore — respects manual gate', () => {
    // Already-signed-in scenario: account and session both present, no resume happens.
    localStorageStore['jericho-account'] = JSON.stringify(ACCOUNT_RECORD);
    localStorageStore['jericho-session'] = JSON.stringify({ username: 'james', issuedAt: 2 });

    const selectProfile = vi.fn();
    const restoreOperationEndgameProfile = vi.fn();
    mockStore = makeUnselectedProfileStore({ selectProfile, restoreOperationEndgameProfile });

    render(<AppShell />);

    expect(selectProfile).not.toHaveBeenCalled();
    expect(restoreOperationEndgameProfile).not.toHaveBeenCalled();
  });
});
