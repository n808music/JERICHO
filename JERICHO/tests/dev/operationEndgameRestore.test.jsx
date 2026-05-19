import React from 'react';
import '@testing-library/jest-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

import {
  buildOperationEndgameFixtureState,
  installOperationEndgameRestore,
  restoreOperationEndgameFixture,
  summarizeOperationEndgameFixtureState,
} from '../../src/dev/operationEndgameRestore.js';
import MasterPlanTimeline from '../../src/ui/masterPlan/MasterPlanTimeline.jsx';
import { DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';

let mockStore = {};

function createStorageMock() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(String(key), String(value));
    },
    clear: () => data.clear(),
  };
}

vi.mock('../../src/state/identityStore.js', async () => {
  const actual = await vi.importActual('../../src/state/identityStore.js');
  return {
    ...actual,
    useIdentityStore: () => mockStore,
  };
});

describe('Operation Endgame dev restore fixture', () => {
  afterEach(() => {
    cleanup();
    mockStore = {};
    delete window.__jerichoPreviewOperationEndgame;
    delete window.__jerichoRestoreOperationEndgame;
    window.localStorage?.clear?.();
  });

  it('builds a coherent profile-owned master plan with valid active pointers and no orphan cycle', () => {
    const state = buildOperationEndgameFixtureState();
    const summary = summarizeOperationEndgameFixtureState(state);
    const profile = state.profilesById[DEFAULT_PROFILE_ID];
    const plan = state.masterPlansById[summary.activeMasterPlanId];
    const goal = state.goalsById[summary.activeGoalId];
    const cycle = state.cyclesById[summary.activeCycleId];

    expect(summary.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(summary.activeGoalId).toBeTruthy();
    expect(summary.activeMasterPlanId).toBeTruthy();
    expect(summary.activeCycleId).toBeTruthy();
    expect(summary.masterPlanCount).toBe(1);
    expect(summary.horizonEnd).toBe('2031-05-19');
    expect(summary.fullHorizonEndDayKey).toBe('2031-05-19');
    expect(profile.activeGoalId).toBe(summary.activeGoalId);
    expect(profile.activeMasterPlanId).toBe(summary.activeMasterPlanId);
    expect(profile.masterPlanIds).toContain(summary.activeMasterPlanId);
    expect(profile.goalIds).toContain(summary.activeGoalId);
    expect(goal.profileId).toBe(DEFAULT_PROFILE_ID);
    expect(goal.activeCycleId).toBe(summary.activeCycleId);
    expect(cycle.masterPlanId).toBe(summary.activeMasterPlanId);
    expect(cycle.goalId).toBe(summary.activeGoalId);
    expect(cycle.status).toBe('active');
    expect(plan.coreMission).toMatch(/Operation Endgame/i);
    expect(plan.declaredHorizonMonths).toBe(60);
    expect(plan.horizonEnd).toBe('2031-05-19');
    expect(state.planRecovery).toBeNull();
  });

  it('writes the fixture to localStorage with a backup of the prior identity blob', () => {
    const storage = createStorageMock();
    storage.setItem('jericho-identity', JSON.stringify({ existing: true }));

    const summary = restoreOperationEndgameFixture({ reload: false, storage });
    const written = JSON.parse(storage.getItem('jericho-identity'));
    const backupRaw = summary.backupKey ? storage.getItem(summary.backupKey) : null;

    expect(summary.wroteKey).toBe('jericho-identity');
    expect(summary.backupKey).toMatch(/^jericho-identity-backup:/);
    expect(JSON.parse(backupRaw)).toEqual({ existing: true });
    expect(JSON.parse(storage.getItem('jericho-identity-backup-latest'))).toEqual({ existing: true });
    expect(written.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(written.activeGoalId).toBeTruthy();
    expect(written.activeCycleId).toBeTruthy();
  });

  it('is unavailable when explicitly installed in production mode', () => {
    const fakeWindow = {
      localStorage: createStorageMock(),
      location: { reload: vi.fn() },
    };

    const installed = installOperationEndgameRestore(fakeWindow, { isProduction: true });

    expect(installed).toBe(false);
    expect(fakeWindow.__jerichoRestoreOperationEndgame).toBeUndefined();
    expect(fakeWindow.__jerichoPreviewOperationEndgame).toBeUndefined();
  });

  it('renders Plan from the seeded fixture state', async () => {
    mockStore = buildOperationEndgameFixtureState();

    await act(async () => {
      render(<MasterPlanTimeline />);
    });

    expect(screen.queryByText(/No master plan established yet/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Full Phase Plan$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Full horizon/i })).toBeInTheDocument();
    expect(screen.getByText(/Full horizon view: complete strategic architecture through 2031\./i)).toBeInTheDocument();
  });
});
