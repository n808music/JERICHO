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
  return {
    activeCycleId: 'cycle-1',
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        goalContract: {
          goalId: 'goal-1',
          workWindows: {
            mon: [{ start: '06:00', end: '09:00' }],
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
    updateWorkWindows: noop,
    attemptGoalAdmission: noop,
    archiveAndCloneCycle: noop,
    commitPreviewItems: noop,
    startNewCycleWithDecision: noop,
    deleteCycle: noop,
    endCycle: noop,
  };
}

describe('work windows advisory constraints initialization', () => {
  beforeEach(() => {
    mockStore = buildStore();
  });

  it('initializes editor values from activeCycle.goalContract.workWindows', () => {
    render(<StructurePageConsolidated />);

    expect(screen.getByDisplayValue('06:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
  });
});
