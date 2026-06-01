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

function buildStore() {
  const cycleId = 'abcd12ef-3456-7890-abcd-ef1234567890';
  return {
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
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
    proposedBlocks: [],
    suggestedBlocks: [],
    lastPlanError: { code: 'NO_PROPOSED_BLOCKS', reasonCodes: ['UNSCHEDULABLE'] },
    debug: {
      lastGenerateClickAtISO: '2026-03-04T12:00:00.000Z',
      lastGenerateClickCycleId: cycleId,
      lastGenerateResult: { proposedBlocksCount: 0, lastPlanErrorCode: 'NO_PROPOSED_BLOCKS' },
    },
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    rebaseColdPlan: noop,
    applyPlan: noop,
    setSchedulingConstraints: noop,
    attemptGoalAdmission: noop,
    archiveAndCloneCycle: noop,
    commitPreviewItems: noop,
    startNewCycleWithDecision: noop,
    deleteCycle: noop,
    endCycle: noop,
  };
}

describe('Structure removes debug panel from active surface', () => {
  beforeEach(() => {
    mockStore = buildStore();
  });

  it('does not render debug toggle/details and never exposes full cycle UUID', () => {
    render(<StructurePageConsolidated />);

    expect(screen.queryByText('abcd12ef-3456-7890-abcd-ef1234567890')).not.toBeInTheDocument();
    expect(screen.queryByText(/lastGenerate\.lastPlanErrorCode/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /debug/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/cycle:/i)).not.toBeInTheDocument();
  });
});
