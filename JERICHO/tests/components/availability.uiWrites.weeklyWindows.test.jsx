import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

const setSchedulingConstraints = vi.fn();
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
    suggestedBlocks: [],
    lastPlanError: null,
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    generateColdPlan: noop,
    rebaseColdPlan: noop,
    applyPlan: noop,
    setSchedulingConstraints,
    attemptGoalAdmission: noop,
    archiveAndCloneCycle: noop,
  };
}

describe('availability work windows ui writes', () => {
  beforeEach(() => {
    setSchedulingConstraints.mockClear();
    mockStore = buildStore();
  });

  it('writes weekly windows into availabilityPolicy + constraints when window is added', async () => {
    render(<StructurePageConsolidated />);

    const user = userEvent.setup();
    const addButtons = screen.getAllByRole('button', { name: /add window/i });
    await user.click(addButtons[0]);

    expect(setSchedulingConstraints).toHaveBeenCalled();
    const payload = setSchedulingConstraints.mock.calls.at(-1)?.[0];
    expect(payload?.availabilityPolicy?.weeklyWindows?.MON?.length).toBe(1);
    expect(payload?.availabilityPolicy?.weeklyWindows?.MON?.[0]).toEqual({ startHHMM: '09:00', endHHMM: '10:00' });
    expect(payload?.constraints?.weeklyWindows?.MON?.length).toBe(1);
  });
});
