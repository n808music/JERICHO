import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';

const applyPlan = vi.fn();
const commitPreviewItems = vi.fn();
const noop = vi.fn();
let mockStore = {};

vi.mock('../../src/state/identityStore', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore() {
  const dayKey = '2026-02-03';
  const cycleId = 'cycle-active';
  return {
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    planDraft: null,
    planCalibration: null,
    correctionSignals: null,
    suggestionEvents: [],
    proposedBlocks: [
      {
        id: 's1',
        cycleId,
        goalId: 'goal-1',
        status: 'suggested',
        title: 'Draft block',
        domain: 'FOCUS',
        durationMinutes: 45,
        dayKey,
        startISO: `${dayKey}T09:00:00.000Z`,
      },
      {
        id: 's2',
        cycleId,
        goalId: 'goal-1',
        status: 'suggested',
        title: 'Draft block day 2',
        domain: 'FOCUS',
        durationMinutes: 30,
        dayKey: '2026-02-04',
        startISO: '2026-02-04T10:00:00.000Z',
      },
    ],
    suggestedBlocks: [],
    deliverablesByCycleId: { [cycleId]: { deliverables: [], suggestionLinks: {} } },
    goalAdmissionByGoal: { 'goal-1': { status: 'ADMITTED', reasonCodes: [] } },
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    goalWorkById: {},
    constraints: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId: 'goal-1', startDayKey: '2026-02-01', endDayKey: '2026-03-01' },
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId: 'goal-1', startDayKey: '2026-02-01', endDayKey: '2026-03-01' },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    profileLearning: {},
    actions: {},
    pendingPlanConfirmation: true,
    generateScheduleForActiveCycle: noop,
    generatePlanWithLLM: noop,
    generatePlan: noop,
    commitPreviewItems,
    applyPlan,
    setActiveCycle: noop,
    deleteCycle: noop,
    startNewCycle: noop,
    startNewCycleWithDecision: noop,
    completeBlock: noop,
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
    createDeliverable: noop,
    updateDeliverable: noop,
    deleteDeliverable: noop,
    createCriterion: noop,
    toggleCriterionDone: noop,
    deleteCriterion: noop,
    linkBlockToDeliverable: noop,
    assignSuggestionLink: noop,
  };
}

describe('ZionDashboard apply schedule dispatch wiring', () => {
  beforeEach(() => {
    applyPlan.mockClear();
    commitPreviewItems.mockClear();
    mockStore = buildStore();
  });

  it('Apply schedule dispatches applyPlan for active cycle', async () => {
    render(<ZionDashboard initialView="today" initialZionView="day" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /apply schedule/i }));

    expect(applyPlan).toHaveBeenCalledTimes(1);
    expect(applyPlan).toHaveBeenCalledWith({ cycleId: 'cycle-active' });
    expect(commitPreviewItems).not.toHaveBeenCalled();
  });

  it('falls back to commitPreviewItems only when applyPlan is unavailable', async () => {
    mockStore = buildStore();
    mockStore.applyPlan = undefined;

    render(<ZionDashboard initialView="today" initialZionView="day" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /apply schedule/i }));

    expect(commitPreviewItems).toHaveBeenCalledTimes(1);
    expect(applyPlan).not.toHaveBeenCalled();
  });
});
