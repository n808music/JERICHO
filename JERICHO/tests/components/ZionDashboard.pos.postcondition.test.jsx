import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const stubAction = vi.fn();
const actionsProxy = new Proxy({}, { get: () => stubAction });
let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore({ withPlan = true, explanationMode = 'none' } = {}) {
  const dayKey = '2026-03-10';
  const cycleId = 'cycle-1';
  const goalId = 'goal-1';

  return {
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: {
      weekStart: dayKey,
      days: [{ date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] }],
      metrics: {},
    },
    cycle: [{ date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] }],
    planDraft: null,
    planCalibration: null,
    correctionSignals: null,
    suggestionEvents: [],
    suggestedBlocks: [],
    overdueBlockIds: [],
    lastPlanError: null,
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    goalWorkById: {},
    constraints: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: {},
        metrics: withPlan
          ? {
              posScore: 0.62,
              feasibilityScore: 0.8,
              integrityScore: 0.7,
              posExplanation:
                explanationMode === 'delta'
                  ? {
                      delta: -0.1,
                      reasons: [
                        {
                          code: 'POS_DOWN_MISSED_WORK',
                          direction: 'DOWN',
                          magnitude: 0.2,
                          evidence: 'missed 60m',
                        },
                      ],
                      conflicts: [],
                      generatedAtISO: `${dayKey}T12:00:00.000Z`,
                    }
                  : explanationMode === 'unschedulable'
                  ? {
                      delta: -0.62,
                      reasons: [{ code: 'POS_UNSCHEDULABLE', direction: 'DOWN', magnitude: 0.62 }],
                      conflicts: ['UNSCHEDULABLE', 'NO_ALLOWED_WINDOWS'],
                      generatedAtISO: `${dayKey}T12:00:00.000Z`,
                    }
                  : null,
            }
          : {
              posScore: null,
              feasibilityScore: null,
              integrityScore: 1,
              posExplanation:
                explanationMode === 'no-plan'
                  ? {
                      delta: null,
                      reasons: [{ code: 'POS_NO_PLAN', direction: 'NEUTRAL', magnitude: 1 }],
                      conflicts: [],
                      generatedAtISO: `${dayKey}T12:00:00.000Z`,
                    }
                  : null,
            },
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-04-01' },
    probabilityByGoal: {
      [goalId]: {
        value: 0.4,
        status: 'ELIGIBLE',
        scoringSummary: { K: 14, mu: 1.2 },
      },
    },
    feasibilityByGoal: {
      [goalId]: {
        status: 'FEASIBLE',
        workableDaysRemaining: 12,
        requiredBlocksPerDay: 0.5,
      },
    },
    profileLearning: {},
    draftScheduleAppliedAtISO: null,
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
  };
}

describe('ZionDashboard POS postcondition', () => {
  beforeEach(() => {
    stubAction.mockClear();
  });

  it('renders numeric POS when active cycle has feasibility-backed plan metrics', () => {
    mockStore = buildStore({ withPlan: true });
    const { container } = render(<ZionDashboard initialView="stability" />);

    expect(screen.getByText(/Probability of Success/i)).toBeInTheDocument();
    const posCard = within(container).getByText(/Probability of Success/i).closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    const headline = posCard.querySelector('p.text-3xl');
    expect(headline).toBeTruthy();
    expect(headline.textContent).toBe('62%');
  });

  it('renders dash when no plan feasibility exists for active cycle metrics', () => {
    mockStore = buildStore({ withPlan: false });
    const { container } = render(<ZionDashboard initialView="stability" />);

    expect(screen.getByText(/Probability of Success/i)).toBeInTheDocument();
    const posCard = within(container).getByText(/Probability of Success/i).closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    const headline = posCard.querySelector('p.text-3xl');
    expect(headline).toBeTruthy();
    expect(headline.textContent).toBe('—');
  });

  it('renders deterministic explanation rows when delta reasons exist', () => {
    mockStore = buildStore({ withPlan: true, explanationMode: 'delta' });
    const { container } = render(<ZionDashboard initialView="stability" />);
    const posCard = within(container).getByText(/Probability of Success/i).closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/Why it changed/i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Missed work increased · DOWN · missed 60m/i)).toBeInTheDocument();
  });

  it('renders no-plan POS explanation when no plan exists', () => {
    mockStore = buildStore({ withPlan: false, explanationMode: 'no-plan' });
    const { container } = render(<ZionDashboard initialView="stability" />);
    const posCard = within(container).getByText(/Probability of Success/i).closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/Generate a plan to see P\.O\.S\./i)).toBeInTheDocument();
  });

  it('renders unschedulable POS explanation with conflict codes', () => {
    mockStore = buildStore({ withPlan: true, explanationMode: 'unschedulable' });
    const { container } = render(<ZionDashboard initialView="stability" />);
    const posCard = within(container).getByText(/Probability of Success/i).closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    expect(within(posCard).getByText(/Unschedulable under current windows\./i)).toBeInTheDocument();
    expect(within(posCard).getByText(/Conflicts: UNSCHEDULABLE, NO_ALLOWED_WINDOWS/i)).toBeInTheDocument();
  });
});
