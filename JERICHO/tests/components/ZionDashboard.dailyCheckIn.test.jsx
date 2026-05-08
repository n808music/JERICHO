import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';

let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore() {
  const dayKey = '2026-05-12';
  const cycleId = 'cycle-live-checkin-ui';
  const goalId = 'goal-live-checkin-ui';
  return {
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    executionEvents: [],
    planDraft: null,
    suggestionEvents: [],
    suggestedBlocks: [],
    proposedBlocks: [],
    proposedBlocksByCycleId: {},
    deliverablesByCycleId: { [cycleId]: { deliverables: [], suggestionLinks: {} } },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    goalWorkById: {},
    constraints: {},
    debug: {},
    lastPlanError: null,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        scheduleLifecycle: 'active_schedule',
        goalContract: {
          goalId,
          goalText: 'Launch a caffeinated functional energy gum brand',
          startDayKey: '2026-04-24',
          endDayKey: '2027-07-31',
          planningIntake: {
            goalClassification: 'regulated_physical_consumable',
            capitalAcquisitionRequired: true,
            capitalAvailable: 0,
          },
        },
        executionEvents: [],
      },
    },
    cycleDynamicsByCycleId: {},
    activeCycleId: cycleId,
    blockStore: {
      blocks: {
        'wait-1': {
          id: 'wait-1',
          cycleId,
          goalId,
          title: 'Manufacturer initial response and quote wait',
          label: 'Manufacturer initial response and quote wait',
          start: '2026-05-01T09:00:00.000Z',
          end: '2026-05-21T09:00:00.000Z',
          status: 'planned',
          origin: 'schedule_active',
          requiredSystemBlock: true,
        },
        'session-1': {
          id: 'session-1',
          cycleId,
          goalId,
          title: 'Request stock formula catalog from Manufacturer 3',
          label: 'Request stock formula catalog from Manufacturer 3',
          start: '2026-05-12T15:00:00.000Z',
          end: '2026-05-12T15:45:00.000Z',
          status: 'planned',
          origin: 'schedule_active',
          requiredSystemBlock: true,
        },
      },
    },
    goalExecutionContract: {
      goalId,
      startDayKey: '2026-04-24',
      endDayKey: '2027-07-31',
      planningIntake: {
        goalClassification: 'regulated_physical_consumable',
        capitalAcquisitionRequired: true,
        capitalAvailable: 0,
      },
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    planQualityGateByGoal: {},
    profileLearning: {},
    planRecovery: null,
    pendingPlanConfirmation: false,
    scheduleApplied: true,
    completeBlock: vi.fn(),
    setDefiniteGoal: vi.fn(),
    setPatternTargets: vi.fn(),
    createBlock: vi.fn(),
    updateBlock: vi.fn(),
    deleteBlock: vi.fn(),
    rescheduleBlock: vi.fn(),
    setActiveDayKey: vi.fn(),
    jumpToToday: vi.fn(),
    tickNow: vi.fn(),
    acceptSuggestedBlock: vi.fn(),
    acceptSuggestedBlockWithPlacement: vi.fn(),
    rejectSuggestedBlock: vi.fn(),
    ignoreSuggestedBlock: vi.fn(),
    dismissSuggestedBlock: vi.fn(),
    setActiveCycle: vi.fn(),
    deleteCycle: vi.fn(),
    startNewCycle: vi.fn(),
    startNewCycleWithDecision: vi.fn(),
    generateScheduleForActiveCycle: vi.fn(),
    generatePlanWithLLM: vi.fn(),
    createDeliverable: vi.fn(),
    updateDeliverable: vi.fn(),
    deleteDeliverable: vi.fn(),
    createCriterion: vi.fn(),
    toggleCriterionDone: vi.fn(),
    deleteCriterion: vi.fn(),
    linkBlockToDeliverable: vi.fn(),
    assignSuggestionLink: vi.fn(),
    generatePlan: vi.fn(),
    commitPreviewItems: vi.fn(),
    applyPlan: vi.fn(),
    setPlanResolutionKind: vi.fn(),
    activateSchedule: vi.fn(),
    applyRenegotiationOption: vi.fn(),
  };
}

describe('ZionDashboard daily check-in surface', () => {
  beforeEach(() => {
    mockStore = buildStore();
  });

  it('renders the daily check-in sections in the required order', () => {
    render(<ZionDashboard initialView="today" initialZionView="day" />);

    const headings = screen
      .getAllByText(/Where You Are|What The System Noticed|Today's Action|Check-In Prompt/i)
      .map((node) => node.textContent);
    expect(headings).toEqual(['Where You Are', 'What The System Noticed', "Today's Action", 'Check-In Prompt']);
  });
});

