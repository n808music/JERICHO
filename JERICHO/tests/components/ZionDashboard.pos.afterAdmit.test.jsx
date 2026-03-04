import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const noop = vi.fn();
let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore({ withFeasibility = true } = {}) {
  const dayKey = '2026-03-10';
  const cycleId = 'cycle-1';
  const goalId = 'goal-1';

  return {
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: dayKey, days: [], metrics: {} },
    cycle: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId },
        metrics: withFeasibility
          ? { posScore: 0.64, feasibilityScore: 0.8, integrityScore: 0.7 }
          : { posScore: null, feasibilityScore: null, integrityScore: 1 },
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-04-01' },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    constraints: {},
    profileLearning: {},
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    goalWorkById: {},
    actions: {},
    completeBlock: noop,
    cancelBlock: noop,
    splitBlock: noop,
    setDefiniteGoal: noop,
    setPatternTargets: noop,
    createBlock: noop,
    updateBlock: noop,
    deleteBlock: noop,
    rescheduleBlock: noop,
    setActiveDayKey: noop,
    jumpToToday: noop,
    tickNow: noop,
    setCalibrationDays: noop,
    acceptSuggestedBlock: noop,
    acceptSuggestedBlockWithPlacement: noop,
    rejectSuggestedBlock: noop,
    ignoreSuggestedBlock: noop,
    dismissSuggestedBlock: noop,
    setActiveCycle: noop,
    deleteCycle: noop,
    startNewCycle: noop,
    createDeliverable: noop,
    updateDeliverable: noop,
    deleteDeliverable: noop,
    createCriterion: noop,
    toggleCriterionDone: noop,
    deleteCriterion: noop,
    linkBlockToDeliverable: noop,
    assignSuggestionLink: noop,
    generatePlan: noop,
    generatePlanWithLLM: noop,
    commitPreviewItems: noop,
    applyPlan: noop,
  };
}

describe('ZionDashboard POS after admit', () => {
  it('renders numeric POS once feasibility-backed cycle metrics exist', () => {
    mockStore = buildStore({ withFeasibility: true });
    const { container } = render(<ZionDashboard initialView="stability" />);

    const posCard = within(container).getByText(/Probability of Success/i).closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    const headline = posCard.querySelector('p.text-3xl');
    expect(headline).toBeTruthy();
    expect(headline.textContent).toMatch(/\d+%/);
    expect(headline.textContent).not.toBe('—');
  });

  it('renders dash only when no plan feasibility exists', () => {
    mockStore = buildStore({ withFeasibility: false });
    const { container } = render(<ZionDashboard initialView="stability" />);

    const posCard = within(container).getByText(/Probability of Success/i).closest('.rounded-xl');
    expect(posCard).toBeTruthy();
    const headline = posCard.querySelector('p.text-3xl');
    expect(headline).toBeTruthy();
    expect(headline.textContent).toBe('—');
  });
});
