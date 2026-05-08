import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
});
