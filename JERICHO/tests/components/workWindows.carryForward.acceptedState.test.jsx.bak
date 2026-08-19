import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

const noop = vi.fn();
let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore({ admitted, workWindows }) {
  return {
    activeCycleId: 'cycle-1',
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        goalContract: admitted
          ? {
              goalId: 'goal-1',
              workWindows: workWindows || {
                mon: [{ start: '07:00', end: '09:00' }],
                tue: [],
                wed: [],
                thu: [],
                fri: [],
                sat: [],
                sun: [],
              },
            }
          : null,
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
    updateWorkWindows: noop,
    attemptGoalAdmission: noop,
    commitPreviewItems: noop,
    startNewCycleWithDecision: noop,
    deleteCycle: noop,
    endCycle: noop,
  };
}

describe('work windows carry-forward into accepted state', () => {
  it('refreshes accepted-state editor when canonical work windows change on same cycle id', async () => {
    mockStore = buildStore({
      admitted: true,
      workWindows: {
        mon: [{ start: '05:00', end: '06:00' }],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      },
    });
    const { rerender } = render(<StructurePageConsolidated />);

    mockStore = buildStore({
      admitted: true,
      workWindows: {
        mon: [{ start: '06:30', end: '08:30' }],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      },
    });
    rerender(<StructurePageConsolidated />);

    expect(screen.queryByDisplayValue('05:00')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('06:30')).toBeInTheDocument();
    expect(screen.getByDisplayValue('08:30')).toBeInTheDocument();
  });
});
