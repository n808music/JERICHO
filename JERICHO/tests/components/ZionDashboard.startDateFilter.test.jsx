import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const stubAction = vi.fn();
const actionsProxy = new Proxy(
  {},
  {
    get: () => stubAction
  }
);

let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore
}));

const buildStore = (suggestedBlocks = [], activeDayKey = '2026-01-20') => ({
  today: { date: activeDayKey, blocks: [] },
  currentWeek: { weekStart: '2026-01-20' },
  cycle: [],
  planDraft: null,
  planCalibration: null,
  correctionSignals: null,
  suggestionEvents: [],
  suggestedBlocks,
  deliverablesByCycleId: {},
  goalAdmissionByGoal: {},
  appTime: { nowISO: '2026-01-20T00:00:00.000Z', activeDayKey, timeZone: 'UTC' },
  goalWorkById: {},
  constraints: {},
  cyclesById: {
    'cycle-1': {
      id: 'cycle-1',
      status: 'active',
      goalContract: { startDateISO: '2026-01-20T00:00:00.000Z' }
    }
  },
  activeCycleId: 'cycle-1',
  goalExecutionContract: { startDateISO: '2026-01-20T00:00:00.000Z' },
  probabilityByGoal: {},
  feasibilityByGoal: {},
  profileLearning: {},
  actions: actionsProxy,
  deliverables: [],
  suggestionEvents: [],
  planDraft: null,
  planCalibration: null,
  correctionSignals: null
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
        startISO: '2026-01-19T09:00:00.000Z'
      },
      {
        id: 's-start',
        title: 'On start suggestion',
        domain: 'CREATION',
        durationMinutes: 30,
        status: 'suggested',
        startISO: '2026-01-20T09:00:00.000Z'
      }
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
          startISO: '2026-01-19T09:00:00.000Z'
        },
        {
          id: 's-start',
          title: 'On start suggestion',
          domain: 'CREATION',
          durationMinutes: 30,
          status: 'suggested',
          startISO: '2026-01-20T09:00:00.000Z'
        }
      ],
      '2026-01-19'
    );
    const { unmount } = render(
      <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey="2026-01-19" />
    );
    expect(screen.getByText(/Drafts begin on Jan 20/i)).toBeInTheDocument();
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
          startISO: '2026-01-19T09:00:00.000Z'
        },
        {
          id: 's-start',
          title: 'On start suggestion',
          domain: 'CREATION',
          durationMinutes: 30,
          status: 'suggested',
          startISO: '2026-01-20T09:00:00.000Z'
        }
      ],
      '2026-01-20'
    );
    render(
      <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey="2026-01-20" />
    );
    expect(screen.getAllByText(/On start suggestion/i).length > 0).toBe(true);
    expect(screen.queryByText(/Drafts begin on Jan 20/i)).not.toBeInTheDocument();
  });

  it('renders ghost blocks when the draft is within the start window', () => {
    mockStore = buildStore(
      [
        {
          id: 's-start',
          title: 'On start suggestion',
          domain: 'CREATION',
          durationMinutes: 45,
          status: 'suggested',
          startISO: '2026-01-20T09:30:00.000Z'
        }
      ],
      '2026-01-20'
    );
    render(
      <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey="2026-01-20" />
    );
    expect(screen.getByTestId('ghost-suggested:s-start')).toBeInTheDocument();
  });
});
