import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

let mockStore = {};
const noop = vi.fn();

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore(proposedBlocks) {
  const cycleId = 'cycle-active';
  const goalId = 'goal-active';
  return {
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-04-01' },
        executionEvents: [],
      },
    },
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-04-01' },
    aspirations: [],
    appTime: { activeDayKey: '2026-03-10', nowISO: '2026-03-10T12:00:00.000Z', timeZone: 'UTC' },
    proposedBlocks,
    suggestedBlocks: [],
    lastPlanError: null,
    deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [], suggestionLinks: {} } },
    goalAdmissionByGoal: {},
    updateWorkWindows: noop,
    attemptGoalAdmission: noop,
  };
}

describe('Structure Today consistency for proposal source', () => {
  beforeEach(() => {
    mockStore = buildStore([]);
  });

  it('does not advertise View in Today for foreign-cycle proposals', () => {
    mockStore = buildStore([
      { id: 'foreign-1', cycleId: 'cycle-foreign', goalId: 'goal-foreign', status: 'suggested' },
    ]);
    render(<StructurePageConsolidated />);
    expect(screen.queryByRole('button', { name: /view in today/i })).not.toBeInTheDocument();
  });

  it('shows View in Today only for active cycle/goal canonical proposals', () => {
    mockStore = buildStore([{ id: 'active-1', cycleId: 'cycle-active', goalId: 'goal-active', status: 'suggested' }]);
    render(<StructurePageConsolidated />);
    expect(screen.getByRole('button', { name: /view in today/i })).toBeInTheDocument();
  });
});
