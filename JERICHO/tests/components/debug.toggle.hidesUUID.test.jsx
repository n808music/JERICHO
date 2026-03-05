import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('Structure debug toggle de-noises cycle id', () => {
  beforeEach(() => {
    mockStore = buildStore();
  });

  it('hides full cycle UUID by default and shows shortened token only when debug is opened', async () => {
    render(<StructurePageConsolidated />);

    expect(screen.queryByText('abcd12ef-3456-7890-abcd-ef1234567890')).not.toBeInTheDocument();
    expect(screen.queryByText(/lastGenerate\.lastPlanErrorCode/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /debug/i }));

    expect(screen.getByText(/cycle:/i)).toBeInTheDocument();
    expect(screen.getAllByText('abcd12').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('abcd12ef-3456-7890-abcd-ef1234567890')).not.toBeInTheDocument();
    expect(screen.getByText(/lastGenerate\.lastPlanErrorCode/i)).toBeInTheDocument();
  });
});
