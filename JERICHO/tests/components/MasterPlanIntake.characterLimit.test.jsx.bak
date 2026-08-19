import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import MasterPlanIntake from '../../src/ui/masterPlan/MasterPlanIntake.jsx';
import { buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { applyMasterPlanAction } from '../../src/state/masterPlanStore.js';

let mockStore = {};

vi.mock('../../src/state/identityStore.js', async () => {
  const actual = await vi.importActual('../../src/state/identityStore.js');
  return {
    ...actual,
    useIdentityStore: () => mockStore,
  };
});

function buildInProgressIntakeStore() {
  const state = buildBlankIdentityState({
    timeZone: 'UTC',
    nowISO: '2026-05-04T12:00:00.000Z',
    todayDate: '2026-05-04',
  });

  applyMasterPlanAction(state, {
    type: 'MASTER_PLAN_INTAKE_START',
    profileId: DEFAULT_PROFILE_ID,
  });

  return {
    ...state,
    masterPlanIntakeStart: vi.fn(),
    masterPlanIntakeAnswer: vi.fn(),
    masterPlanIntakeComplete: vi.fn(),
    masterPlanIntakeReset: vi.fn(),
  };
}

describe('MasterPlanIntake character limit', () => {
  beforeEach(() => {
    mockStore = buildInProgressIntakeStore();
  });

  it('accepts up to 1000 characters and blocks over-limit answers', () => {
    render(<MasterPlanIntake />);

    const textbox = screen.getByPlaceholderText(/type your answer/i);
    const continueButton = screen.getByRole('button', { name: /continue/i });

    fireEvent.change(textbox, { target: { value: 'a'.repeat(1000) } });

    expect(screen.getByText('1000/1000 characters')).toBeInTheDocument();
    expect(
      screen.queryByText(/keep this answer under 1000 characters to continue/i)
    ).not.toBeInTheDocument();
    expect(continueButton).not.toBeDisabled();

    fireEvent.change(textbox, { target: { value: 'a'.repeat(1001) } });

    expect(screen.getByText('1001/1000 characters')).toBeInTheDocument();
    expect(
      screen.getByText(/keep this answer under 1000 characters to continue/i)
    ).toBeInTheDocument();
    expect(continueButton).toBeDisabled();
  });
});
