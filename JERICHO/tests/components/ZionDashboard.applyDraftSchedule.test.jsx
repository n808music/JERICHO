import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider } from '../../src/state/identityStore.js';

const DAY_KEY = '2026-01-20';

function buildDraftState() {
  const cycleId = 'cycle-active';
  return {
    vector: {},
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [], flow: { streams: [] } }, flow: { streams: [] } },
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
        domain: 'CREATION',
        durationMinutes: 60,
        status: 'suggested',
        startISO: '2026-01-20T09:00:00.000Z'
      }
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
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId: 'goal-1', startDateISO: `${DAY_KEY}T00:00:00.000Z` },
        coldPlan: {
          forecastByDayKey: {
            [DAY_KEY]: { totalBlocks: 1, summary: 'Forecast' }
          },
          dailyProjection: { forecastByDayKey: {} }
        },
        summary: { completionCount: 0, completionRate: 0 }
      }
    },
    goalExecutionContract: { goalId: 'goal-1', startDateISO: `${DAY_KEY}T00:00:00.000Z` },
    planDraft: { blocksPerWeek: 4, daysPerWeek: 4, primaryDomain: 'CREATION', minutesPerDay: 90 },
    planCalibration: null,
    correctionSignals: null,
    deliverables: [],
    goalDirective: { goalId: 'goal-1', directiveId: 'dir-1' },
    directiveEligibilityByGoal: { 'goal-1': { eligible: true } }
  };
}

describe('ZionDashboard apply draft schedule', () => {
  it('creates real blocks and clears ghosts when applied', async () => {
    render(
      <IdentityProvider initialState={buildDraftState()}>
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    const ghost = await screen.findByTestId('ghost-suggested:s1');
    expect(ghost).toBeInTheDocument();

    const applyButton = screen.getByRole('button', { name: /Apply schedule/i });
    const user = userEvent.setup();
    await user.click(applyButton);

    await waitFor(() => {
      expect(screen.queryByTestId('ghost-suggested:s1')).not.toBeInTheDocument();
    });

    const realBlock = await screen.findByTestId('block-draft:cycle-active:1');
    expect(realBlock).toBeInTheDocument();
  });
});
