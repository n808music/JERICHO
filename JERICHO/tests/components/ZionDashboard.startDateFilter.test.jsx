import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const stubAction = vi.fn();
const actionsProxy = new Proxy(
  {},
  {
    get: () => stubAction,
  }
);

let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

const buildStore = (suggestedBlocks = [], activeDayKey = '2026-01-20') => ({
  today: { date: activeDayKey, blocks: [] },
  currentWeek: { weekStart: '2026-01-20' },
  cycle: [],
  planDraft: null,
  planCalibration: null,
  correctionSignals: null,
  suggestionEvents: [],
  proposedBlocks: suggestedBlocks.map((block) => ({
    cycleId: 'cycle-1',
    goalId: 'goal-1',
    ...block,
  })),
  suggestedBlocks,
  deliverablesByCycleId: {},
  goalAdmissionByGoal: { 'goal-1': { status: 'ADMITTED', reasonCodes: [] } },
  appTime: { nowISO: '2026-01-20T00:00:00.000Z', activeDayKey, timeZone: 'UTC' },
  goalWorkById: {},
  constraints: {},
  cyclesById: {
    'cycle-1': {
      id: 'cycle-1',
      status: 'active',
      goalContract: { goalId: 'goal-1', startDateISO: '2026-01-20T00:00:00.000Z' },
    },
  },
  activeCycleId: 'cycle-1',
  goalExecutionContract: { goalId: 'goal-1', startDateISO: '2026-01-20T00:00:00.000Z' },
  probabilityByGoal: {},
  feasibilityByGoal: {},
  profileLearning: {},
  commitPreviewItems: stubAction,
  actions: actionsProxy,
  deliverables: [],
});

describe('ZionDashboard start date guard', () => {
  beforeEach(() => {
    stubAction.mockClear();
    mockStore = buildStore([
      {
        id: 's-before',
        title: 'Before start suggestion',
        domain: 'CREATION',
        durationMinutes: 30,
        status: 'suggested',
        startISO: '2026-01-19T09:00:00.000Z',
      },
      {
        id: 's-start',
        title: 'On start suggestion',
        domain: 'CREATION',
        durationMinutes: 30,
        status: 'suggested',
        startISO: '2026-01-20T09:00:00.000Z',
      },
    ]);
  });

  it('hides draft schedule items before the goal start date and shows them on start day', () => {
    mockStore = buildStore(
      [
        {
          id: 's-before',
          title: 'Before start suggestion',
          domain: 'CREATION',
          durationMinutes: 30,
          status: 'suggested',
          startISO: '2026-01-19T09:00:00.000Z',
        },
        {
          id: 's-start',
          title: 'On start suggestion',
          domain: 'CREATION',
          durationMinutes: 30,
          status: 'suggested',
          startISO: '2026-01-20T09:00:00.000Z',
        },
      ],
      '2026-01-19'
    );
    const { unmount } = render(
      <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey="2026-01-19" />
    );
    expect(screen.getAllByText(/Drafts begin on Jan 20/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/On start suggestion/i)).not.toBeInTheDocument();

    unmount();
    mockStore = buildStore(
      [
        {
          id: 's-before',
          title: 'Before start suggestion',
          domain: 'CREATION',
          durationMinutes: 30,
          status: 'suggested',
          startISO: '2026-01-19T09:00:00.000Z',
        },
        {
          id: 's-start',
          title: 'On start suggestion',
          domain: 'CREATION',
          durationMinutes: 30,
          status: 'suggested',
          startISO: '2026-01-20T09:00:00.000Z',
        },
      ],
      '2026-01-20'
    );
    render(<ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey="2026-01-20" />);
    expect(screen.getAllByText(/On start suggestion/i).length > 0).toBe(true);
    expect(screen.queryByText(/Drafts begin on Jan 20/i)).not.toBeInTheDocument();
  });

  it('renders draft schedule items when the draft is within the start window', () => {
    mockStore = buildStore(
      [
        {
          id: 's-start',
          title: 'On start suggestion',
          domain: 'CREATION',
          durationMinutes: 45,
          status: 'suggested',
          startISO: '2026-01-20T09:30:00.000Z',
        },
      ],
      '2026-01-20'
    );
    render(<ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey="2026-01-20" />);
    expect(screen.getAllByText(/On start suggestion/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Drafts begin on Jan 20/i)).not.toBeInTheDocument();
  });
});
