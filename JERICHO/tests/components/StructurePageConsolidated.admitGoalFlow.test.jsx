import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore() {
  return {
    activeCycleId: null,
    cyclesById: {},
    deliverablesByCycleId: {},
    aspirations: [],
    appTime: { activeDayKey: '2026-04-25', nowISO: '2026-04-25T12:00:00.000Z', timeZone: 'UTC' },
    proposedBlocks: [],
    suggestedBlocks: [],
    lastPlanError: null,
    pendingOnboardingInputs: null,
    planRecovery: null,
    finishOnboardingGate: vi.fn(),
    updatePendingOnboardingInputs: vi.fn(),
    clearPlanRecovery: vi.fn(),
    updateWorkWindows: vi.fn(),
    attemptGoalAdmission: vi.fn(),
  };
}

describe('StructurePageConsolidated admit goal flow', () => {
  beforeEach(() => {
    mockStore = buildStore();
  });

  it('uses the structured intake as the only pre-admission entry path', () => {
    render(<StructurePageConsolidated />);

    expect(screen.getByText(/describe your goal in one or two sentences/i)).toBeInTheDocument();
    expect(screen.queryByText(/initial goal input/i)).not.toBeInTheDocument();
  });
});
