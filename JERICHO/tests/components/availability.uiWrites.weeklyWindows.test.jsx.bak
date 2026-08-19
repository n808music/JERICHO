import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

const updateWorkWindows = vi.fn();
const noop = vi.fn();
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
          startDateISO: '2026-01-01T00:00:00.000Z',
          deadlineISO: '2026-03-01T00:00:00.000Z',
        },
        coldPlan: { forecastByDayKey: {}, dailyProjection: { forecastByDayKey: {} } },
      },
    },
    aspirations: [],
    appTime: { activeDayKey: '2026-01-10', timeZone: 'UTC' },
    constraints: {},
    availabilityPolicy: {},
    debug: { lastGenerateResult: { proposedBlocksCount: 0, lastPlanErrorCode: null } },
    proposedBlocks: [],
    suggestedBlocks: [],
    lastPlanError: null,
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    generateColdPlan: noop,
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

describe('availability work windows ui writes', () => {
  beforeEach(() => {
    updateWorkWindows.mockClear();
    mockStore = buildStore();
  });

  it('dispatches work windows update when constraints are saved', async () => {
    render(<StructurePageConsolidated />);

    const user = userEvent.setup();
    await user.click(screen.getByText(/advisory constraints/i));
    const addButtons = screen.getAllByRole('button', { name: /add window/i });
    await user.click(addButtons[0]);
    await user.click(screen.getByRole('button', { name: /save constraints/i }));

    expect(updateWorkWindows).toHaveBeenCalled();
    const payload = updateWorkWindows.mock.calls.at(-1)?.[0];
    expect(payload?.cycleId).toBe('cycle-1');
    expect(payload?.workWindows?.mon?.length).toBe(1);
    expect(payload?.workWindows?.mon?.[0]).toEqual({ start: '09:00', end: '10:00' });
  });
});
