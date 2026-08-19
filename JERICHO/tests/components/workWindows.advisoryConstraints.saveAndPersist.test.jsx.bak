import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

const noop = vi.fn();
const updateWorkWindows = vi.fn();
let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore() {
  return {
    activeCycleId: 'cycle-1',
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        goalContract: {
          goalId: 'goal-1',
          workWindows: {
            mon: [],
            tue: [],
            wed: [],
            thu: [],
            fri: [],
            sat: [],
            sun: [],
          },
        },
      },
    },
    aspirations: [],
    appTime: { activeDayKey: '2026-01-10', nowISO: '2026-01-10T12:00:00.000Z', timeZone: 'UTC' },
    constraints: {},
    availabilityPolicy: {},
    debug: { lastGenerateResult: { proposedBlocksCount: 0, lastPlanErrorCode: null } },
    proposedBlocks: [],
    suggestedBlocks: [],
    lastPlanError: null,
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    rebaseColdPlan: noop,
    applyPlan: noop,
    updateWorkWindows,
    attemptGoalAdmission: noop,
    archiveAndCloneCycle: noop,
    commitPreviewItems: noop,
    startNewCycleWithDecision: noop,
    deleteCycle: noop,
    endCycle: noop,
  };
}

describe('work windows advisory constraints save', () => {
  beforeEach(() => {
    updateWorkWindows.mockClear();
    mockStore = buildStore();
  });

  it('saves edited windows to cycle state through UPDATE_WORK_WINDOWS dispatch', async () => {
    render(<StructurePageConsolidated />);

    const user = userEvent.setup();
    await user.click(screen.getByText(/advisory constraints/i));
    await user.click(screen.getAllByRole('button', { name: /add window/i })[0]);
    await user.click(screen.getByRole('button', { name: /save constraints/i }));

    expect(updateWorkWindows).toHaveBeenCalledTimes(1);
    expect(updateWorkWindows).toHaveBeenCalledWith({
      cycleId: 'cycle-1',
      workWindows: expect.objectContaining({
        mon: [{ start: '09:00', end: '10:00' }],
      }),
    });
  });
});
