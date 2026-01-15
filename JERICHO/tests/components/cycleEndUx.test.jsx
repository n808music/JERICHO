import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider } from '../../src/state/identityStore.js';

const TIME_ZONE = 'UTC';
const DAY_KEY = '2026-01-31';

function buildEndedCycleState({ includeSummary = true } = {}) {
  const cycleId = 'cycle-ended';
  const base = {
    vector: { day: 1, direction: 'Review', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [], flow: { streams: [] } }, flow: { streams: [] } },
    today: { date: DAY_KEY, blocks: [], completionRate: 0, driftSignal: 'forming', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: DAY_KEY, days: [] },
    cycle: [],
    templates: { objectives: {} },
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    lastAdaptedDate: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {},
    constraints: {},
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    appTime: { timeZone: TIME_ZONE, nowISO: `${DAY_KEY}T12:00:00.000Z`, activeDayKey: DAY_KEY, isFollowingNow: true },
    profileLearning: { cycleCount: 2, totalCompletionCount: 6, averageCompletionRate: 0.75 },
    activeCycleId: cycleId,
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'ended',
        startedAtDayKey: '2026-01-01',
        endedAtDayKey: '2026-01-31',
        goalContract: {
          goalId: 'goal-ended',
          goalText: 'Review Goal',
          deadlineDayKey: '2026-02-28'
        },
        coldPlan: {
          forecastByDayKey: {
            [DAY_KEY]: { totalBlocks: 1, byDeliverable: {} }
          },
          dailyProjection: { forecastByDayKey: {} }
        },
        summary: includeSummary
          ? { completionCount: 5, completionRate: 0.85 }
          : undefined,
        convergenceReport: includeSummary
          ? { verdict: 'CONVERGED', updatedAtISO: '2026-01-31T15:00:00.000Z' }
          : undefined,
        executionEvents: []
      }
    },
    goalExecutionContract: {
      goalId: 'goal-ended',
      goalText: 'Review Goal',
      startDayKey: '2026-01-01',
      endDayKey: '2026-02-28'
    },
    directives: {},
    directiveEligibilityByGoal: {},
    goalDirective: null,
    suggestionHistory: { dayKey: DAY_KEY, count: 0, lastSuggestedAtISO: null, lastSuggestedAtISOByGoal: {}, dailyCountByGoal: {}, denials: [] }
  };

  if (!includeSummary) {
    delete base.cyclesById[cycleId].summary;
    delete base.cyclesById[cycleId].convergenceReport;
  }

  return base;
}

describe('Cycle end UX polish', () => {
  it('shows read-only banner, summary, and disabled controls', () => {
    render(
      <IdentityProvider initialState={buildEndedCycleState()}>
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.getByText(/Cycle ended — Read only/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start new cycle/i })).toBeTruthy();
    const addBlockButton = screen.getByRole('button', { name: /Add block/i });
    expect(addBlockButton).toBeDisabled();
    expect(screen.getByText(/Completion rate/)).toBeTruthy();
    expect(screen.getByText(/Captured 0 update\(s\)/i)).toBeTruthy();
  });

  it('renders pending summary when data missing', () => {
    render(
      <IdentityProvider initialState={buildEndedCycleState({ includeSummary: false })}>
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    expect(screen.getAllByText(/Pending/).length).toBeGreaterThan(0);
  });
});
