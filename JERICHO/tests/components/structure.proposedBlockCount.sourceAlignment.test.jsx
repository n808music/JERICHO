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

function buildStore() {
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
    proposedBlocks: [
      { id: 'p1', cycleId, goalId, status: 'suggested', title: 'A' },
      { id: 'p2', cycleId, goalId, status: 'suggested', title: 'B' },
    ],
    suggestedBlocks: [
      { id: 's1', cycleId, goalId, status: 'suggested', title: 'legacy-1' },
      { id: 's2', cycleId, goalId, status: 'suggested', title: 'legacy-2' },
      { id: 's3', cycleId, goalId, status: 'suggested', title: 'legacy-3' },
      { id: 's4', cycleId, goalId, status: 'suggested', title: 'legacy-4' },
      { id: 's5', cycleId, goalId, status: 'suggested', title: 'legacy-5' },
    ],
    lastPlanError: null,
    deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [], suggestionLinks: {} } },
    goalAdmissionByGoal: {},
    updateWorkWindows: noop,
    attemptGoalAdmission: noop,
  };
}

describe('Structure proposed calendar block count source alignment', () => {
  beforeEach(() => {
    mockStore = buildStore();
  });

  it('uses canonical proposedBlocks path, not legacy suggestedBlocks fallback count', () => {
    render(<StructurePageConsolidated />);
    expect(screen.getByText(/2 proposed calendar blocks/i)).toBeInTheDocument();
    expect(screen.queryByText(/5 proposed calendar blocks/i)).not.toBeInTheDocument();
  });
});
