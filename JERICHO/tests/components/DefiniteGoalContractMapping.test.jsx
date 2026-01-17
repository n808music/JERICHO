import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore
}));

const buildStore = (override = {}) => ({
  activeCycleId: 'cycle-1',
  cyclesById: {
    'cycle-1': {
      id: 'cycle-1',
      status: 'active',
      goalContract: {
        goalLabel: 'Finish first draft of album',
        startDateISO: '2026-01-20T00:00:00.000Z',
        deadlineISO: '2026-04-01T00:00:00.000Z',
        target: {
          count: 6,
          unit: 'songs recorded (rough takes)',
          definitionOfDone: 'rough vocal take + bounce exported'
        },
        capacity: {
          daysPerWeek: 5,
          minutesPerDay: 90
        }
      }
    }
  },
  aspirations: [],
  appTime: new Date().toISOString(),
  suggestedBlocks: [],
  lastPlanError: null,
  generateColdPlan: vi.fn(),
  rebaseColdPlan: vi.fn(),
  applyPlan: vi.fn(),
  attemptGoalAdmission: vi.fn(),
  archiveAndCloneCycle: vi.fn(),
  deliverablesByCycleId: {},
  ...override
});

const formatTestDate = (iso) => {
  const result = new Date(iso);
  if (Number.isNaN(result.getTime())) return iso;
  return result.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

describe('Definite Goal contract UI mapping', () => {
  beforeEach(() => {
    mockStore = buildStore();
  });

  it('renders goalContract data when available', () => {
    render(<StructurePageConsolidated />);

    expect(screen.getByText(/Finish first draft of album/i)).toBeInTheDocument();
    const planWindow = screen.getByText(/Plan window:/i);
    const planWindowLine = planWindow.parentElement;
    expect(planWindowLine).toHaveTextContent(formatTestDate('2026-01-20T00:00:00.000Z'));
    expect(planWindowLine).toHaveTextContent(formatTestDate('2026-04-01T00:00:00.000Z'));
    const targetLine = screen.getByText(/Target:/i).parentElement;
    const capacityLine = screen.getByText(/Capacity:/i).parentElement;
    expect(targetLine).toHaveTextContent('6 songs recorded (rough takes)');
    expect(capacityLine).toHaveTextContent('5 days/week · 90 min/day');
  });

  it('falls back gracefully when target data is missing', () => {
    const fallbackStore = buildStore({
      cyclesById: {
        'cycle-1': {
          id: 'cycle-1',
          status: 'active',
          goalContract: {
            goalLabel: 'Launch pipeline',
            startDateISO: '2026-02-01T00:00:00.000Z',
            deadlineISO: '2026-03-01T00:00:00.000Z'
          }
        }
      }
    });
    mockStore = fallbackStore;
    render(<StructurePageConsolidated />);

    expect(screen.getByText(/Launch pipeline/i)).toBeInTheDocument();
    expect(screen.queryByText(/Target:/i)).toBeNull();
    expect(screen.queryByText(/Capacity:/i)).toBeNull();
    const outcomeLine = screen.getByText(/Outcome:/i).parentElement;
    const costLine = screen.getByText(/Cost:/i).parentElement;
    expect(outcomeLine).toHaveTextContent('Outcome: —');
    expect(costLine).toHaveTextContent('Cost: —');
  });
});
