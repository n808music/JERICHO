import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

const noop = vi.fn();
let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore({ readOnly = false, proposedCount = 2, lastPlanError = null } = {}) {
  const cycleId = 'cycle-1';
  const status = readOnly ? 'ended' : 'active';
  const proposedBlocks = Array.from({ length: proposedCount }).map((_, idx) => ({
    id: `suggested-${idx + 1}`,
    cycleId,
    status: 'suggested',
    title: `Block ${idx + 1}`,
    dayKey: '2026-03-04',
    startISO: `2026-03-04T0${idx + 9}:00:00.000Z`,
    durationMinutes: 30,
  }));

  return {
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status,
        goalContract: {
          goalId: 'goal-1',
          startDateISO: '2026-03-01T00:00:00.000Z',
          deadlineISO: '2026-03-31T23:59:59.000Z',
        },
      },
    },
    aspirations: [],
    appTime: { activeDayKey: '2026-03-04', nowISO: '2026-03-04T12:00:00.000Z', timeZone: 'UTC' },
    constraints: {},
    availabilityPolicy: {},
    proposedBlocks,
    suggestedBlocks: [],
    lastPlanError,
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    debug: { lastGenerateResult: { proposedBlocksCount: proposedCount, lastPlanErrorCode: null } },
    updateWorkWindows: noop,
    attemptGoalAdmission: noop,
    startNewCycleWithDecision: noop,
    deleteCycle: noop,
    endCycle: noop,
  };
}

describe('Structure schedule status uses canonical proposedBlocks', () => {
  beforeEach(() => {
    mockStore = buildStore({ proposedCount: 2 });
  });

  it('shows ready status when suggested proposed blocks exist', () => {
    render(<StructurePageConsolidated />);

    expect(screen.getByText(/schedule status/i)).toBeInTheDocument();
    expect(screen.getByText(/schedule draft ready\./i)).toBeInTheDocument();
  });

  it('shows error status when lastPlanError exists', () => {
    mockStore = buildStore({ proposedCount: 0, lastPlanError: { code: 'NO_PROPOSED_BLOCKS' } });
    render(<StructurePageConsolidated />);

    expect(screen.getByText(/generation failed: NO_PROPOSED_BLOCKS/i)).toBeInTheDocument();
  });

  it('shows idle status with no proposals and no error', () => {
    mockStore = buildStore({ proposedCount: 0 });
    render(<StructurePageConsolidated />);

    expect(screen.getByText(/no schedule proposal yet\. go to today tab to generate\./i)).toBeInTheDocument();
  });
});
