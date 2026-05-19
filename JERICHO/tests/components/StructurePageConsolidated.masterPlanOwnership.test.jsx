import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';

const noop = vi.fn();
let mockStore = {};

vi.mock('../../src/state/identityStore', async () => {
  const actual = await vi.importActual('../../src/state/identityStore.js');
  return {
    ...actual,
    useIdentityStore: () => mockStore,
  };
});

function buildPreAdmissionStore() {
  const state = buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: '2026-05-04T12:00:00.000Z',
    todayDate: '2026-05-04',
  });
  state.activeProfileId = DEFAULT_PROFILE_ID;

  return {
    ...state,
    updateWorkWindows: noop,
    attemptGoalAdmission: noop,
    updatePendingOnboardingInputs: noop,
    setPlanResolutionKind: noop,
    startNewCycleWithDecision: noop,
    deleteCycle: noop,
    endCycle: noop,
    resetIdentity: noop,
    finishOnboardingGate: noop,
    clearPlanRecovery: noop,
    masterPlanIntakeStart: noop,
    masterPlanIntakeAnswer: noop,
    masterPlanIntakeComplete: noop,
    masterPlanIntakeReset: noop,
    startNewCycleWithDecision: noop,
    resetActiveCycle: noop,
    completeCycleReassessment: noop,
  };
}

describe('StructurePageConsolidated unified intake ownership', () => {
  beforeEach(() => {
    mockStore = buildPreAdmissionStore();
  });

  it('renders one initial Structure goal textarea with the 1000-character contract', () => {
    render(<StructurePageConsolidated />);

    const textareas = screen.getAllByRole('textbox');
    expect(textareas).toHaveLength(1);
    expect(screen.getByLabelText(/describe your goal/i)).toBeInTheDocument();
    expect(screen.getByText('0/1000')).toBeInTheDocument();
    expect(screen.queryByText(/Structure establishes the master plan/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument();
  });

  it('does not render a stale intake contract card in blank state', () => {
    mockStore = {
      ...buildPreAdmissionStore(),
      pendingOnboardingInputs: {
        goalText: '',
        goalContract: {
          goalId: 'draft-podcast',
          goalLabel: 'Podcast intake',
          goalText: 'Podcast intake',
          goalIntakeContract: {
            domain: 'podcast',
            completionBoundary: 'launched',
            requiredContextQuestions: [{ prompt: 'Who is the listener?' }],
            readiness: { state: 'assumptions_required', assumptionReasons: ['missing_scope'] },
            scopePolicy: { required: ['listener'], recommended: ['cadence'] },
          },
        },
      },
    };

    render(<StructurePageConsolidated />);

    expect(screen.queryByText(/Intake Contract/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Podcast intake/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/describe your goal/i)).toBeInTheDocument();
  });

  it('switches to control mode after master-plan establishment without rendering intake', () => {
    mockStore = {
      ...buildPreAdmissionStore(),
      profilesById: {
        [DEFAULT_PROFILE_ID]: {
          id: DEFAULT_PROFILE_ID,
          activeMasterPlanId: 'mp-1',
          masterPlanIds: ['mp-1'],
        },
      },
      masterPlansById: {
        'mp-1': {
          id: 'mp-1',
          title: 'Operation Endgame',
          laneIds: ['lane-1', 'lane-2'],
        },
      },
    };

    render(<StructurePageConsolidated />);

    expect(screen.getByText(/Goal established\. Review lanes, anchors, and milestones in Plan\./i)).toBeInTheDocument();
    expect(screen.getByText(/^Core Mission$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Outcome Target$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Success Standard$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear Goal/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/^Execution Cycle$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Execution Cycle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reassess Current State/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Archive Cycle/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reset Cycle/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Delete Cycle/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Generate schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reset master plan/i })).not.toBeInTheDocument();
  });

  it('surfaces a persistence recovery notice instead of silently implying a clean blank state', () => {
    mockStore = {
      ...buildPreAdmissionStore(),
      planRecovery: {
        required: 'PERSISTED_PLAN_MISSING',
        route: 'STRUCTURE_INTAKE',
        persistenceFailure: {
          orphanedCycleId: 'cycle-2026-05-19-1',
          reasonCodes: ['ACTIVE_CYCLE_GOAL_MISSING', 'ACTIVE_MASTER_PLAN_MISSING'],
        },
      },
    };

    render(<StructurePageConsolidated />);

    expect(screen.getByText(/Profile found, but active plan is missing/i)).toBeInTheDocument();
    expect(screen.getByText(/Quarantined cycle: cycle-2026-05-19-1/i)).toBeInTheDocument();
  });

  it('starts a new cycle directly when a master plan exists without an active cycle', () => {
    const startNewCycleWithDecision = vi.fn();
    mockStore = {
      ...buildPreAdmissionStore(),
      profilesById: {
        [DEFAULT_PROFILE_ID]: {
          id: DEFAULT_PROFILE_ID,
          activeMasterPlanId: 'mp-1',
          masterPlanIds: ['mp-1'],
        },
      },
      masterPlansById: {
        'mp-1': {
          id: 'mp-1',
          title: 'Operation Endgame',
          laneIds: ['lane-1'],
        },
      },
      startNewCycleWithDecision,
    };

    render(<StructurePageConsolidated />);

    fireEvent.click(screen.getByRole('button', { name: /Start Execution Cycle/i }));

    expect(startNewCycleWithDecision).toHaveBeenCalledWith({ mode: 'archive' });
    expect(screen.queryByRole('dialog', { name: /Replace active execution cycle/i })).not.toBeInTheDocument();
  });

  it('starts a new cycle directly when the activeCycleId pointer is stale or invalid', () => {
    const startNewCycleWithDecision = vi.fn();
    mockStore = {
      ...buildPreAdmissionStore(),
      activeCycleId: 'cycle-stale',
      cyclesById: {},
      profilesById: {
        [DEFAULT_PROFILE_ID]: {
          id: DEFAULT_PROFILE_ID,
          activeMasterPlanId: 'mp-1',
          masterPlanIds: ['mp-1'],
        },
      },
      masterPlansById: {
        'mp-1': {
          id: 'mp-1',
          title: 'Operation Endgame',
          laneIds: ['lane-1'],
        },
      },
      startNewCycleWithDecision,
    };

    render(<StructurePageConsolidated />);

    fireEvent.click(screen.getByRole('button', { name: /Start Execution Cycle/i }));

    expect(startNewCycleWithDecision).toHaveBeenCalledWith({ mode: 'archive' });
    expect(screen.queryByRole('dialog', { name: /Replace active execution cycle/i })).not.toBeInTheDocument();
  });

  it('opens the replacement modal only when a valid active execution cycle exists', () => {
    mockStore = {
      ...buildPreAdmissionStore(),
      activeCycleId: 'cycle-1',
      cyclesById: {
        'cycle-1': {
          id: 'cycle-1',
          status: 'active',
          scheduleLifecycle: 'no_schedule',
          goalContract: { goalId: 'masterplan:mp-1' },
        },
      },
      profilesById: {
        [DEFAULT_PROFILE_ID]: {
          id: DEFAULT_PROFILE_ID,
          activeMasterPlanId: 'mp-1',
          masterPlanIds: ['mp-1'],
        },
      },
      masterPlansById: {
        'mp-1': {
          id: 'mp-1',
          title: 'Operation Endgame',
          laneIds: ['lane-1'],
        },
      },
    };

    render(<StructurePageConsolidated />);

    fireEvent.click(screen.getByRole('button', { name: /Replace Active Cycle/i }));

    expect(screen.getByRole('dialog', { name: /Replace active execution cycle/i })).toBeInTheDocument();
    expect(screen.getByText(/The goal will remain\./i)).toBeInTheDocument();
  });
});
