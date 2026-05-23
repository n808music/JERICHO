import React from 'react';
import '@testing-library/jest-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

import {
  buildOperationEndgameFixtureState,
  buildPersistableOperationEndgameFixtureState,
  installOperationEndgameRestore,
  restoreOperationEndgameFixture,
  summarizeOperationEndgameFixtureState,
} from '../../src/dev/operationEndgameRestore.js';
import MasterPlanTimeline from '../../src/ui/masterPlan/MasterPlanTimeline.jsx';
import { DEFAULT_PROFILE_ID, rehydratePersistedState } from '../../src/state/identityStore.js';

let mockStore = {};

function createStorageMock() {
  const data = new Map();
  return {
    get length() {
      return data.size;
    },
    key: (index) => [...data.keys()][index] || null,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(String(key), String(value));
    },
    removeItem: (key) => {
      data.delete(String(key));
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
    const agenda = summary.agendaVersionId ? state.masterPlanAgendaVersionsById?.[summary.agendaVersionId] || null : null;
    const constraintVersion = summary.constraintVersionId
      ? state.scheduleConstraintVersionsById?.[summary.constraintVersionId] || null
      : null;
    const p3Blocks = (state.fullHorizonScheduleBlocks || []).filter((block) => block.phaseLabel === 'P3');
    const p2Milestones = Object.values(state.masterPlanMilestonesById || {}).filter((milestone) => {
      const targetDate = String(milestone?.targetDate || '').trim();
      return targetDate >= '2027-01-01' && targetDate <= '2028-06-14';
    });

    expect(summary.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(summary.activeGoalId).toBeTruthy();
    expect(summary.activeMasterPlanId).toBeTruthy();
    expect(summary.activeCycleId).toBeNull();
    expect(summary.masterPlanCount).toBe(1);
    expect(summary.horizonEnd).toBe('2031-05-19');
    expect(summary.fullHorizonEndDayKey).toBe('2031-05-19');
    expect(summary.fullHorizonBlockCount).toBeGreaterThan(0);
    expect(summary.coverageState).toMatch(/covered|trusted/);
    expect(summary.planQualityState).toBe('provisional');
    expect(summary.agendaState).toBe('current');
    expect(summary.agendaBlockCount).toBe(summary.fullHorizonBlockCount);
    expect(summary.constraintHash).toBeTruthy();
    expect(profile.activeGoalId).toBe(summary.activeGoalId);
    expect(profile.activeMasterPlanId).toBe(summary.activeMasterPlanId);
    expect(profile.masterPlanIds).toContain(summary.activeMasterPlanId);
    expect(profile.goalIds).toContain(summary.activeGoalId);
    expect(profile.agendaVersionIds || []).toContain(summary.agendaVersionId);
    expect(profile.scheduleConstraintVersionIds || []).toContain(summary.constraintVersionId);
    expect(goal.profileId).toBe(DEFAULT_PROFILE_ID);
    expect(goal.activeCycleId || null).toBeNull();
    expect(plan.coreMission).toMatch(/Operation Endgame/i);
    expect(plan.declaredHorizonMonths).toBe(60);
    expect(plan.horizonEnd).toBe('2031-05-19');
    expect(plan.currentAgendaVersionId).toBe(summary.agendaVersionId);
    expect(plan.currentScheduleConstraintVersionId).toBe(summary.constraintVersionId);
    expect(state.fullHorizonCoverageAudit?.fullHorizonCovered).toBe(true);
    expect(state.fullHorizonPlanQuality?.state).toBe('provisional');
    expect(state.fullHorizonBlockQuality?.state).toBeTruthy();
    expect(state.fullHorizonBlockQuality?.summary?.totalBlocks).toBeGreaterThan(0);
    expect(agenda?.profileId).toBe(DEFAULT_PROFILE_ID);
    expect(agenda?.masterPlanId).toBe(summary.activeMasterPlanId);
    expect(agenda?.range?.endDayKey).toBe('2031-05-19');
    expect(agenda?.summary?.byPhase?.P1 || 0).toBeGreaterThan(0);
    expect(agenda?.summary?.byPhase?.P2 || 0).toBeGreaterThan(0);
    expect(agenda?.summary?.byPhase?.P3 || 0).toBeGreaterThan(0);
    expect(agenda?.quality?.strategicCoverageState).toBe('covered');
    expect(constraintVersion?.constraintHash).toBe(summary.constraintHash);
    expect(constraintVersion?.weeklyCapacityMinutes || 0).toBeGreaterThan(0);
    expect(state.fullHorizonPlanQuality?.reasonCodes || []).not.toContain('PHASE_NAMED_MILESTONES_MISSING');
    expect(state.fullHorizonPlanQuality?.reasonCodes || []).not.toContain('PHASE_NAMED_MILESTONES_MISSING_P2');
    expect(state.fullHorizonPlanQuality?.reasonCodes || []).toContain('PHASE_MILESTONE_DENSITY_THIN');
    expect(state.fullHorizonPlanQuality?.reasonCodes || []).toContain('PHASE_MILESTONE_DENSITY_THIN_P2');
    expect(state.fullHorizonPlanQuality?.reasonCodes || []).toContain('PHASE_MILESTONE_TIME_DISTRIBUTION_THIN');
    expect(state.fullHorizonPlanQuality?.reasonCodes || []).toContain('PHASE_MILESTONE_TIME_DISTRIBUTION_THIN_P2');
    expect(p2Milestones.map((milestone) => milestone.title)).toEqual(
      expect.arrayContaining([
        'Validate repeatable conversion path',
        'Establish operating cadence dashboard',
        'Prove revenue conversion architecture',
        'Widen channel distribution loop',
        'Stabilize cross-lane execution loop',
      ])
    );
    expect(state.fullHorizonCoverageAudit?.coverageByPhase?.P2?.blockCount || 0).toBeGreaterThan(0);
    expect(state.fullHorizonCoverageAudit?.coverageByPhase?.P3?.blockCount || 0).toBeGreaterThan(0);
    expect(state.fullHorizonCoverageAudit?.coverageByYear?.['2031']?.blockCount || 0).toBeGreaterThan(0);
    expect(p3Blocks.length).toBeGreaterThan(0);
    expect(p3Blocks.every((block) => String(block?.expectedOutput || '').trim())).toBe(true);
    expect(p3Blocks.every((block) => String(block?.laneId || '').trim())).toBe(true);
    expect(p3Blocks.every((block) => String(block?.laneLabel || '').trim())).toBe(true);
    expect(p3Blocks.every((block) => String(block?.phaseLabel || '').trim() === 'P3')).toBe(true);
    expect(state.planRecovery).toBeNull();
  });

  it('keeps canonical Operation Endgame mission text free of demo revenue and fixture user-target contamination', () => {
    const state = buildOperationEndgameFixtureState();
    const summary = summarizeOperationEndgameFixtureState(state);
    const plan = state.masterPlansById[summary.activeMasterPlanId];
    const goal = state.goalsById[summary.activeGoalId];
    const canonicalTexts = [
      plan?.coreMission,
      plan?.masterPlanSummary,
      plan?.northStarOutcome,
      plan?.successStandard,
      plan?.outcomeTarget,
      goal?.title,
      state?.masterPlanIntake?.answers?.step_1,
      state?.masterPlanIntake?.answers?.step_2,
    ]
      .filter((value) => typeof value === 'string')
      .join(' || ');

    expect(canonicalTexts).toContain('Coordinate Operation Endgame as a 5-year multi-lane master plan');
    expect(canonicalTexts).not.toMatch(/10k users|10,000 users/i);
    expect(canonicalTexts).not.toMatch(/grow revenue to \$10k\/month/i);
    expect(plan?.outcomeTarget || null).toBeNull();
  });

  it('writes the fixture to localStorage with a backup of the prior identity blob', () => {
    const storage = createStorageMock();
    storage.setItem('jericho-identity', JSON.stringify({ existing: true }));
    storage.setItem('jericho-identity-backup:old-1', JSON.stringify({ old: 1 }));
    storage.setItem('jericho-identity-backup:old-2', JSON.stringify({ old: 2 }));

    const summary = restoreOperationEndgameFixture({ reload: false, storage });
    const written = JSON.parse(storage.getItem('jericho-identity'));
    const backupRaw = summary.backupKey ? storage.getItem(summary.backupKey) : null;

    expect(summary.wroteKey).toBe('jericho-identity');
    expect(summary.backupStatus).toBe('full');
    expect(summary.backupKey).toMatch(/^jericho-identity-backup:/);
    expect(summary.prunedBackupKeys).toEqual(
      expect.arrayContaining(['jericho-identity-backup:old-1', 'jericho-identity-backup:old-2'])
    );
    expect(storage.getItem('jericho-identity-backup:old-1')).toBeNull();
    expect(storage.getItem('jericho-identity-backup:old-2')).toBeNull();
    expect(JSON.parse(backupRaw)).toEqual({ existing: true });
    expect(JSON.parse(storage.getItem('jericho-identity-backup-latest'))).toEqual({ existing: true });
    expect(written.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(written.activeGoalId).toBeTruthy();
    expect(written.activeCycleId).toBeNull();
    expect(Array.isArray(written.fullHorizonScheduleBlocks)).toBe(false);
    expect(Array.isArray(written.calendarDisplayBlocks)).toBe(false);
    expect(Object.keys(written.cyclesById || {})).toHaveLength(0);

    const rehydrated = rehydratePersistedState(written);
    expect((rehydrated.fullHorizonScheduleBlocks || []).length).toBeGreaterThan(0);
    expect(rehydrated.fullHorizonCoverageAudit?.fullHorizonCovered).toBe(true);
    expect(rehydrated.fullHorizonPlanQuality?.state).toBe('provisional');
    expect(rehydrated.fullHorizonBlockQuality?.state).toBeTruthy();
    const rehydratedPlan = rehydrated.masterPlansById?.[written.profilesById?.[DEFAULT_PROFILE_ID]?.activeMasterPlanId];
    const rehydratedAgenda =
      rehydratedPlan?.currentAgendaVersionId &&
      rehydrated.masterPlanAgendaVersionsById?.[rehydratedPlan.currentAgendaVersionId];
    expect(rehydratedAgenda?.state).toBe('current');
    expect(rehydratedAgenda?.blockCount).toBe((rehydrated.fullHorizonScheduleBlocks || []).length);
  });

  it('still writes the active identity when full backup storage hits QuotaExceededError', () => {
    const writes = new Map([['jericho-identity', JSON.stringify({ existing: true })]]);
    const storage = {
      get length() {
        return writes.size;
      },
      key(index) {
        return [...writes.keys()][index] || null;
      },
      getItem(key) {
        return writes.has(key) ? writes.get(key) : null;
      },
      setItem(key, value) {
        const normalizedKey = String(key);
        const normalizedValue = String(value);
        if (
          normalizedKey.startsWith('jericho-identity-backup:') ||
          (normalizedKey === 'jericho-identity-backup-latest' && normalizedValue.includes('"existing":true'))
        ) {
          const error = new Error('Quota exceeded');
          error.name = 'QuotaExceededError';
          throw error;
        }
        writes.set(normalizedKey, normalizedValue);
      },
      removeItem(key) {
        writes.delete(String(key));
      },
      clear() {
        writes.clear();
      },
    };

    const summary = restoreOperationEndgameFixture({ reload: false, storage, nowISO: '2026-05-20T00:00:00.000Z' });
    const written = JSON.parse(storage.getItem('jericho-identity'));
    const compactBackup = JSON.parse(storage.getItem('jericho-identity-backup-latest'));

    expect(summary.backupStatus).toBe('compact');
    expect(summary.backupError).toBe('quota-exceeded');
    expect(summary.backupKey).toBeNull();
    expect(summary.backupPointer).toMatch(/:compact$/);
    expect(written.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(written.activeGoalId).toBeTruthy();
    expect(written.activeCycleId).toBeNull();
    expect(Array.isArray(written.fullHorizonScheduleBlocks)).toBe(false);

    const rehydrated = rehydratePersistedState(written);
    expect((rehydrated.fullHorizonScheduleBlocks || []).length).toBeGreaterThan(0);
    expect(rehydrated.fullHorizonCoverageAudit?.fullHorizonCovered).toBe(true);
    expect(rehydrated.fullHorizonPlanQuality?.state).toBe('provisional');
    expect(rehydrated.fullHorizonBlockQuality?.state).toBeTruthy();
    expect(Object.keys(rehydrated.masterPlanAgendaVersionsById || {})).toHaveLength(1);
    expect(compactBackup.type).toBe('compact-backup-metadata');
    expect(compactBackup.activeProfileId).toBeNull();
  });

  it('preserves existing named profile metadata while restoring Operation Endgame', () => {
    const storage = createStorageMock();
    storage.setItem(
      'jericho-identity',
      JSON.stringify({
        meta: { version: 2 },
        activeProfileId: DEFAULT_PROFILE_ID,
        profilesById: {
          [DEFAULT_PROFILE_ID]: {
            id: DEFAULT_PROFILE_ID,
            displayName: 'James Dotson',
            label: 'James Dotson',
            roleLabel: 'founder',
            goalIds: [],
            masterPlanIds: [],
            activeGoalId: null,
            activeMasterPlanId: null,
          },
        },
        goalsById: {},
        masterPlansById: {},
        cyclesById: {},
      })
    );

    restoreOperationEndgameFixture({ reload: false, storage });
    const written = JSON.parse(storage.getItem('jericho-identity'));
    const rehydrated = rehydratePersistedState(written);
    const profile = rehydrated.profilesById[DEFAULT_PROFILE_ID];

    expect(profile.displayName).toBe('James Dotson');
    expect(profile.label).toBe('James Dotson');
    expect(profile.roleLabel).toBe('founder');
    expect(rehydrated.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(rehydrated.activeGoalId).toBeTruthy();
    expect(profile.activeMasterPlanId).toBeTruthy();
    expect(profile.masterPlanIds.length).toBeGreaterThan(0);
    expect(rehydrated.activeCycleId).toBeNull();
    expect(rehydrated.fullHorizonCoverageAudit?.fullHorizonCovered).toBe(true);
    expect(rehydrated.fullHorizonPlanQuality?.state).toBe('provisional');
    expect(rehydrated.fullHorizonBlockQuality?.state).toBeTruthy();
  });

  it('writes a compact persisted payload when the fully derived fixture would exceed the active identity quota', () => {
    const fullState = buildOperationEndgameFixtureState();
    const persistableState = buildPersistableOperationEndgameFixtureState(fullState);
    const fullRaw = JSON.stringify(fullState);
    const persistableRaw = JSON.stringify(persistableState);
    const quotaThreshold = Math.floor((fullRaw.length + persistableRaw.length) / 2);
    const writes = new Map();
    const storage = {
      get length() {
        return writes.size;
      },
      key(index) {
        return [...writes.keys()][index] || null;
      },
      getItem(key) {
        return writes.has(key) ? writes.get(key) : null;
      },
      setItem(key, value) {
        const normalizedKey = String(key);
        const normalizedValue = String(value);
        if (normalizedKey === 'jericho-identity' && normalizedValue.length > quotaThreshold) {
          const error = new Error('Quota exceeded');
          error.name = 'QuotaExceededError';
          throw error;
        }
        writes.set(normalizedKey, normalizedValue);
      },
      removeItem(key) {
        writes.delete(String(key));
      },
      clear() {
        writes.clear();
      },
    };

    expect(persistableRaw.length).toBeLessThan(fullRaw.length);

    const summary = restoreOperationEndgameFixture({ reload: false, storage });
    const writtenRaw = storage.getItem('jericho-identity');
    const written = JSON.parse(writtenRaw);
    const rehydrated = rehydratePersistedState(written);

    expect(summary.activeProfileId).toBe(DEFAULT_PROFILE_ID);
    expect(summary.activeGoalId).toBeTruthy();
    expect(summary.activeMasterPlanId).toBeTruthy();
    expect(summary.activeCycleId).toBeNull();
    expect(writtenRaw.length).toBeLessThanOrEqual(quotaThreshold);
    expect((written.fullHorizonScheduleBlocks || []).length).toBe(0);
    expect(Object.keys(written.cyclesById || {})).toHaveLength(0);
    expect(rehydrated.activeGoalId).toBeTruthy();
    expect(rehydrated.profilesById?.[DEFAULT_PROFILE_ID]?.activeMasterPlanId).toBeTruthy();
    expect(rehydrated.activeCycleId).toBeNull();
    expect((rehydrated.fullHorizonScheduleBlocks || []).length).toBeGreaterThan(0);
    expect(rehydrated.fullHorizonCoverageAudit?.fullHorizonCovered).toBe(true);
    expect(rehydrated.fullHorizonPlanQuality?.state).toBe('provisional');
    expect(rehydrated.fullHorizonBlockQuality?.state).toBeTruthy();
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
    expect(screen.getByTestId('masterplan-coverage-status')).toHaveTextContent(/Full horizon/i);
    expect(screen.getByTestId('masterplan-quality-status')).not.toHaveTextContent(/unavailable/i);
    expect(screen.getByTestId('phase-card-p2')).toHaveTextContent(/Forecast workload recognized:/i);
    expect(screen.getByTestId('phase-card-p3')).toHaveTextContent(/Forecast workload recognized:/i);
  });
});
