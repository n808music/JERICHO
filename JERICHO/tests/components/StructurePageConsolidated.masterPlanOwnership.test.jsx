import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';

const noop = vi.fn();
let mockStore = {};
const originalLocation = window.location;

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
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        hash: '',
        reload: vi.fn(),
      },
    });
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

    expect(screen.getByText(/Goal established\. Review lanes, anchors, and milestones in Master Plan\./i)).toBeInTheDocument();
    expect(screen.getByText(/^Core Mission$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Outcome Target$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Success Standard$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear Goal/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/^Operating Cycle$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Operating Cycle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reassess Current State/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Archive Operating Cycle/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Reset Operating Cycle/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Delete Operating Cycle/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Generate schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apply schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Activate schedule/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reset master plan/i })).not.toBeInTheDocument();
  });

  it('resets identity, routes to structure, and requests reload when clearing the goal', () => {
    const hardResetIdentity = vi.fn().mockResolvedValue({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockStore = {
      ...buildPreAdmissionStore(),
      hardResetIdentity,
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

    fireEvent.click(screen.getByRole('button', { name: /clear goal/i }));

    return waitFor(() => {
      expect(hardResetIdentity).toHaveBeenCalledTimes(1);
      expect(window.location.reload).toHaveBeenCalledTimes(1);
    });
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

    fireEvent.click(screen.getByRole('button', { name: /Start Operating Cycle/i }));

    expect(startNewCycleWithDecision).toHaveBeenCalledWith({ mode: 'archive' });
    expect(screen.queryByRole('dialog', { name: /Replace active operating cycle/i })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /Start Operating Cycle/i }));

    expect(startNewCycleWithDecision).toHaveBeenCalledWith({ mode: 'archive' });
    expect(screen.queryByRole('dialog', { name: /Replace active operating cycle/i })).not.toBeInTheDocument();
  });

  it('shows distinct pending text for Success Standard when successStandard field is absent', () => {
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
          northStarOutcome: 'Grow revenue to $10k/month',
          masterPlanSummary: 'Grow revenue to $10k/month',
          outcomeTarget: null,
          successStandard: null,
        },
      },
    };

    render(<StructurePageConsolidated />);

    expect(screen.getByText('Grow revenue to $10k/month')).toBeInTheDocument();
    expect(screen.getByText(/Success standard pending/i)).toBeInTheDocument();
    expect(screen.queryAllByText('Grow revenue to $10k/month')).toHaveLength(1);
  });

  it('Archive Operating Cycle button has no amber styling when no active cycle', () => {
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
    };

    render(<StructurePageConsolidated />);

    const archiveBtn = screen.getByRole('button', { name: /Archive Operating Cycle/i });
    expect(archiveBtn).toBeDisabled();
    expect(archiveBtn.className).not.toMatch(/amber/);
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

    fireEvent.click(screen.getByRole('button', { name: /Replace Active Operating Cycle/i }));

    expect(screen.getByRole('dialog', { name: /Replace active operating cycle/i })).toBeInTheDocument();
    expect(screen.getByText(/The goal will remain\./i)).toBeInTheDocument();
  });
});
