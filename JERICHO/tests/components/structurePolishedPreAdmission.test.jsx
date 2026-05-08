import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => ({
    activeCycleId: null,
    cyclesById: {},
    goalExecutionContract: null,
    aspirations: [],
    appTime: { nowISO: '2026-04-25T12:00:00.000Z', activeDayKey: '2026-04-25', timeZone: 'UTC' },
    proposedBlocks: [],
    suggestedBlocks: [],
    lastPlanError: null,
    pendingOnboardingInputs: null,
    planRecovery: null,
    finishOnboardingGate: vi.fn(),
    clearPlanRecovery: vi.fn(),
    updateWorkWindows: vi.fn(),
    updatePendingOnboardingInputs: vi.fn(),
  }),
}));

describe('StructurePageConsolidated pre-admission UI', () => {
  it('routes directly into the structured intake instead of the legacy onboarding gate', () => {
    render(<StructurePageConsolidated />);

    expect(screen.getByText('Structure')).toBeInTheDocument();
    expect(screen.getByText('Contract Admission')).toBeInTheDocument();
    expect(screen.getByText(/what are you trying to do\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/initial goal input/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/create your first goal/i)).not.toBeInTheDocument();
  });
});
