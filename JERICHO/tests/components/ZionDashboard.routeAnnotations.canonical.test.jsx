import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const stubAction = vi.fn();
const actionsProxy = new Proxy({}, { get: () => stubAction });
let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function baseStore(overrides = {}) {
  const dayKey = '2026-03-10';
  const cycleId = 'cycle-route-1';
  const goalId = 'goal-route-1';
  return {
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: {
      weekStart: dayKey,
      days: [
        { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
      ],
      metrics: {},
    },
    cycle: [
      { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    ],
    planDraft: null,
    planCalibration: null,
    correctionSignals: null,
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    overdueBlockIds: [],
    lastPlanError: null,
    deliverablesByCycleId: {},
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    goalWorkById: {},
    constraints: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-03-31' },
        metrics: {},
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-03-31' },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    profileLearning: {},
    draftScheduleAppliedAtISO: null,
    scheduleApplied: false,
    actions: actionsProxy,
    completeBlock: stubAction,
    cancelBlock: stubAction,
    splitBlock: stubAction,
    setDefiniteGoal: stubAction,
    setPatternTargets: stubAction,
    createBlock: stubAction,
    updateBlock: stubAction,
    deleteBlock: stubAction,
    rescheduleBlock: stubAction,
    setActiveDayKey: stubAction,
    jumpToToday: stubAction,
    tickNow: stubAction,
    setCalibrationDays: stubAction,
    acceptSuggestedBlock: stubAction,
    acceptSuggestedBlockWithPlacement: stubAction,
    rejectSuggestedBlock: stubAction,
    ignoreSuggestedBlock: stubAction,
    dismissSuggestedBlock: stubAction,
    setActiveCycle: stubAction,
    deleteCycle: stubAction,
    startNewCycle: stubAction,
    createDeliverable: stubAction,
    updateDeliverable: stubAction,
    deleteDeliverable: stubAction,
    createCriterion: stubAction,
    toggleCriterionDone: stubAction,
    deleteCriterion: stubAction,
    linkBlockToDeliverable: stubAction,
    assignSuggestionLink: stubAction,
    generatePlan: stubAction,
    generatePlanWithLLM: stubAction,
    commitPreviewItems: stubAction,
    applyPlan: stubAction,
    ...overrides,
  };
}

describe('ZionDashboard execution surface category deprecation', () => {
  beforeEach(() => {
    stubAction.mockClear();
  });

  it('never shows Route annotations in Month view, including empty state with stale forecast', () => {
    const dayKey = '2026-03-10';
    mockStore = baseStore({
      cyclesById: {
        'cycle-route-1': {
          id: 'cycle-route-1',
          status: 'active',
          goalContract: null,
          coldPlan: {
            forecastByDayKey: {
              '2026-03-09': { totalBlocks: 4 },
              '2026-03-10': { totalBlocks: 4 },
              '2026-03-11': { totalBlocks: 2 },
            },
          },
          metrics: {},
        },
      },
      goalAdmissionByGoal: {},
      goalExecutionContract: null,
      proposedBlocks: [],
      suggestedBlocks: [],
      today: {
        date: dayKey,
        blocks: [],
        completionRate: 0,
        driftSignal: 'contained',
        loadByPractice: {},
        practices: [],
      },
      currentWeek: { weekStart: dayKey, days: [], metrics: {} },
      cycle: [],
    });

    render(<ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey="2026-03-10" />);
    expect(screen.queryByText(/Route:/i)).not.toBeInTheDocument();
  });

  it('renders canonical task titles without category fallback labels in Month view', () => {
    mockStore = baseStore({
      scheduleApplied: true,
      today: {
        date: '2026-03-10',
        blocks: [
          {
            id: 'b1',
            cycleId: 'cycle-route-1',
            goalId: 'goal-route-1',
            start: '2026-03-10T09:00:00.000Z',
            end: '2026-03-10T10:00:00.000Z',
            status: 'planned',
            title: 'Write pilot outline',
            label: 'Focus',
            practice: 'Focus',
          },
        ],
      },
      cycle: [
        {
          date: '2026-03-10',
          blocks: [
            {
              id: 'b1',
              cycleId: 'cycle-route-1',
              goalId: 'goal-route-1',
              start: '2026-03-10T09:00:00.000Z',
              end: '2026-03-10T10:00:00.000Z',
              status: 'planned',
              title: 'Write pilot outline',
              label: 'Focus',
              practice: 'Focus',
            },
          ],
        },
      ],
      cyclesById: {
        'cycle-route-1': {
          id: 'cycle-route-1',
          status: 'active',
          scheduleLifecycle: 'active_schedule',
          goalContract: { goalId: 'goal-route-1', startDayKey: '2026-03-01', endDayKey: '2026-03-31' },
          metrics: {},
        },
      },
    });

    render(<ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey="2026-03-10" />);
    expect(screen.getByText('Write pilot outline')).toBeInTheDocument();
    expect(screen.queryByText(/^Focus$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Route:/i)).not.toBeInTheDocument();
  });

  it('does not render Month route annotations from mirror/stale sources when canonical schedule is empty', () => {
    mockStore = baseStore({
      proposedBlocks: [],
      suggestedBlocks: [
        {
          id: 's1',
          cycleId: 'cycle-route-1',
          status: 'suggested',
          dayKey: '2026-03-10',
          startISO: '2026-03-10T09:00:00.000Z',
          durationMinutes: 60,
          title: 'Mirror-only proposal',
        },
      ],
      cyclesById: {
        'cycle-route-1': {
          id: 'cycle-route-1',
          status: 'active',
          goalContract: { goalId: 'goal-route-1', startDayKey: '2026-03-01', endDayKey: '2026-03-31' },
          coldPlan: { forecastByDayKey: { '2026-03-10': { totalBlocks: 7 } } },
          metrics: {},
        },
      },
    });

    render(<ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey="2026-03-10" />);
    expect(screen.queryByText(/Route:/i)).not.toBeInTheDocument();
  });
});
