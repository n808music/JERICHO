import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

// Save Progress must be reachable DURING intake (MODULE 1), not only on the
// post-admission Structure view — the operator saves mid-survey and resumes.

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
    saveProgress: vi.fn(async () => ({ ok: true })),
  };
}

describe('StructurePageConsolidated — Save Progress during intake', () => {
  beforeEach(() => {
    mockStore = buildStore();
  });

  it('renders the Save Progress button on the pre-admission intake view', () => {
    render(<StructurePageConsolidated />);
    // Intake (MODULE 1) is showing…
    expect(screen.getByText(/describe your goal/i)).toBeInTheDocument();
    // …and Save Progress is available alongside it.
    expect(screen.getByRole('button', { name: /save progress/i })).toBeInTheDocument();
  });
});
