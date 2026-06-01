import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider } from '../../src/state/identityStore.js';

const DAY_KEY = '2026-01-20';

function buildState() {
  const cycleId = 'cycle-active';
  const action = {
    id: 'goal-1:season-thesis',
    goalId: 'goal-1',
    title: 'Define season thesis',
    brief: 'Write the one-sentence argument and emotional promise for the full season.',
    definitionOfDone: 'Done',
    estimateMin: 45,
    category: 'Focus',
    deps: ['goal-1:blocked-dep'],
    status: 'todo',
    topoIndex: 0,
    priority: 1,
  };
  return {
    vector: {},
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [] }, flow: { streams: [] } },
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
    suggestedBlocks: [],
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
      [cycleId]: { cycleId, goalId: 'goal-1', actions: [action] },
    },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        actions: [action],
        goalContract: {
          goalId: 'goal-1',
          goalLabel: 'ship deterministic planner validation',
          startDateISO: `${DAY_KEY}T00:00:00.000Z`,
          deadline: { dayKey: '2026-02-20' },
        },
        coldPlan: {
          forecastByDayKey: {
            [DAY_KEY]: { totalBlocks: 2, byDeliverable: {} },
          },
          dailyProjection: { forecastByDayKey: {} },
        },
        summary: { completionCount: 0, completionRate: 0 },
      },
    },
    goalExecutionContract: {
      goalId: 'goal-1',
      goalLabel: 'ship deterministic planner validation',
      startDateISO: `${DAY_KEY}T00:00:00.000Z`,
      deadline: { dayKey: '2026-02-20' },
    },
    planDraft: { blocksPerWeek: 4, daysPerWeek: 4, primaryDomain: 'CREATION', minutesPerDay: 90 },
    planCalibration: null,
    correctionSignals: null,
    goalDirective: { goalId: 'goal-1', directiveId: 'dir-1' },
    directiveEligibilityByGoal: { 'goal-1': { eligible: true } },
  };
}

describe('forecast stale fix', () => {
  it('keeps apply schedule blocked when no draft items are available', async () => {
    render(
      <IdentityProvider initialState={buildState()}>
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    const applyButton = await screen.findByRole('button', { name: /apply schedule/i });
    expect(applyButton).toBeDisabled();
    expect(applyButton).toHaveAttribute('title', expect.stringMatching(/no draft items available/i));
    expect(screen.getByText(/Scheduled to Goal deadline:/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting: 1\./i)).toBeInTheDocument();
  });

  it('does not report missing deadline when goal deadline exists', async () => {
    render(
      <IdentityProvider initialState={buildState()}>
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );
    const applyButton = await screen.findByRole('button', { name: /apply schedule/i });
    expect(applyButton).not.toHaveAttribute('title', expect.stringMatching(/goal deadline missing/i));
  });

  it('uses full-apply path instead of preview payload audit logging', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const clean = buildState();
    clean.actionsByCycleId['cycle-active'].actions[0].status = 'todo';
    clean.cyclesById['cycle-active'].actions[0].status = 'todo';
    clean.actionsByCycleId['cycle-active'].actions[0].deps = [];
    clean.cyclesById['cycle-active'].actions[0].deps = [];
    render(
      <IdentityProvider initialState={clean}>
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    const applyButton = await screen.findByRole('button', { name: /apply schedule/i });
    expect(applyButton).not.toBeDisabled();
    const user = userEvent.setup();
    await act(async () => {
      await user.click(applyButton);
    });

    const applyAuditCall = logSpy.mock.calls.find((call) => call?.[0] === 'apply payload audit');
    expect(applyAuditCall).toBeFalsy();
    logSpy.mockRestore();
  });
});
