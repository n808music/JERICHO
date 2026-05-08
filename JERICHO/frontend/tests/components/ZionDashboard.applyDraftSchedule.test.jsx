import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider } from '../../src/state/identityStore.js';

const DAY_KEY = '2026-01-20';

function buildDraftState() {
  const cycleId = 'cycle-active';
  const action = {
    id: 'goal-1:season-thesis',
    goalId: 'goal-1',
    title: 'Define season thesis',
    brief: 'Write the one-sentence argument and emotional promise for the full season.',
    definitionOfDone: 'One sentence thesis and one paragraph promise are written and approved.',
    estimateMin: 45,
    category: 'Focus',
    deps: [],
    status: 'todo',
    topoIndex: 0,
    priority: 1,
  };
  const action2 = {
    id: 'goal-1:episode-list',
    goalId: 'goal-1',
    title: 'Draft episode list',
    brief: 'Name each episode and assign one core dramatic function to each.',
    definitionOfDone: 'Episode list contains titles and one function line per episode.',
    estimateMin: 45,
    category: 'Creation',
    deps: ['goal-1:season-thesis'],
    status: 'todo',
    topoIndex: 1,
    priority: 1,
  };
  return {
    vector: {},
    lenses: {
      aim: { description: '', horizon: '90d' },
      pattern: { dailyTargets: [], flow: { streams: [] } },
      flow: { streams: [] },
    },
    today: { date: DAY_KEY, blocks: [], completionRate: 0, practices: [], loadByPractice: {} },
    currentWeek: { weekStart: DAY_KEY, days: [] },
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    lastAdaptedDate: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    suggestionEvents: [],
    suggestedBlocks: [
      {
        id: 's1',
        title: 'Write vocals',
        detail: 'Name each episode and assign one core dramatic function to each.',
        actionId: 'goal-1:episode-list',
        domain: 'CREATION',
        durationMinutes: 60,
        status: 'suggested',
        startISO: '2026-01-20T09:00:00.000Z',
      },
    ],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    constraints: {},
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    appTime: { timeZone: 'UTC', nowISO: `${DAY_KEY}T08:00:00.000Z`, activeDayKey: DAY_KEY, isFollowingNow: true },
    profileLearning: {},
    activeCycleId: cycleId,
    actionsByCycleId: {
      [cycleId]: { cycleId, goalId: 'goal-1', actions: [action, action2] },
    },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        actions: [action, action2],
        goalContract: { goalId: 'goal-1', startDateISO: `${DAY_KEY}T00:00:00.000Z` },
        coldPlan: {
          forecastByDayKey: {
            [DAY_KEY]: { totalBlocks: 1, summary: 'Forecast' },
          },
          dailyProjection: { forecastByDayKey: {} },
        },
        summary: { completionCount: 0, completionRate: 0 },
      },
    },
    goalExecutionContract: { goalId: 'goal-1', startDateISO: `${DAY_KEY}T00:00:00.000Z` },
    planDraft: { blocksPerWeek: 4, daysPerWeek: 4, primaryDomain: 'CREATION', minutesPerDay: 90 },
    planCalibration: null,
    correctionSignals: null,
    deliverables: [],
    goalDirective: { goalId: 'goal-1', directiveId: 'dir-1' },
    directiveEligibilityByGoal: { 'goal-1': { eligible: true } },
  };
}

describe('ZionDashboard apply draft schedule', () => {
  it('creates real blocks and clears ghosts when applied', async () => {
    render(
      <IdentityProvider initialState={buildDraftState()}>
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.queryByTestId('ghost-suggested:s1')).not.toBeInTheDocument();
    expect(await screen.findByText(/define season thesis/i)).toBeInTheDocument();

    const applyButton = screen.getByRole('button', { name: /Apply schedule/i });
    const user = userEvent.setup();
    await act(async () => {
      await user.click(applyButton);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('ghost-suggested:s1')).not.toBeInTheDocument();
    });

    const realBlockLabel = await screen.findByText(/define season thesis/i);
    expect(realBlockLabel).toBeInTheDocument();
  }, 20000);
});
