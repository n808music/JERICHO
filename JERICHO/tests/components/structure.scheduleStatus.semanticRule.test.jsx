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

function buildStore({ proposedBlocks = [], executionEvents = [], lastPlanError = null } = {}) {
  const cycleId = 'cycle-1';
  const goalId = 'goal-1';
  return {
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-04-01' },
        executionEvents,
      },
    },
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-04-01' },
    aspirations: [],
    appTime: { activeDayKey: '2026-03-10', nowISO: '2026-03-10T12:00:00.000Z', timeZone: 'UTC' },
    proposedBlocks,
    suggestedBlocks: [],
    lastPlanError,
    deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [], suggestionLinks: {} } },
    goalAdmissionByGoal: {},
    updateWorkWindows: noop,
    attemptGoalAdmission: noop,
  };
}

describe('Structure schedule status semantic rule', () => {
  beforeEach(() => {
    mockStore = buildStore();
  });

  it('none: no proposed calendar blocks and no committed execution evidence', () => {
    render(<StructurePageConsolidated />);
    expect(screen.getByText(/no schedule proposal yet\. go to today tab to generate\./i)).toBeInTheDocument();
  });

  it('proposal_generated: canonical suggested proposals exist', () => {
    mockStore = buildStore({
      proposedBlocks: [{ id: 'p1', cycleId: 'cycle-1', goalId: 'goal-1', status: 'suggested' }],
    });
    render(<StructurePageConsolidated />);
    expect(screen.getByText(/schedule draft ready\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view in today/i })).toBeInTheDocument();
  });

  it('committed: no proposals but committed execution create events exist', () => {
    mockStore = buildStore({
      proposedBlocks: [],
      executionEvents: [{ id: 'evt-1', kind: 'create', cycleId: 'cycle-1', goalId: 'goal-1' }],
    });
    render(<StructurePageConsolidated />);
    expect(screen.getByText(/schedule active\./i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view in today/i })).not.toBeInTheDocument();
  });
});
