import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider } from '../../src/state/identityStore.js';

function buildState() {
  const cycleId = 'cycle-1';
  const dayKey = '2026-01-20';
  const actions = [
    {
      id: 'a-1',
      goalId: 'goal-1',
      title: 'Define season thesis',
      brief: 'Write thesis',
      definitionOfDone: 'Done',
      estimateMin: 30,
      category: 'Focus',
      deps: [],
      status: 'todo',
      topoIndex: 0,
      priority: 1,
    },
    {
      id: 'a-2',
      goalId: 'goal-1',
      title: 'Map season arc beats',
      brief: 'Map beats',
      definitionOfDone: 'Done',
      estimateMin: 30,
      category: 'Creation',
      deps: [],
      status: 'todo',
      topoIndex: 1,
      priority: 1,
    },
    {
      id: 'a-3',
      goalId: 'goal-1',
      title: 'Draft episode list',
      brief: 'List episodes',
      definitionOfDone: 'Done',
      estimateMin: 30,
      category: 'Creation',
      deps: [],
      status: 'todo',
      topoIndex: 2,
      priority: 1,
    },
  ];
  return {
    vector: {},
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [] }, flow: { streams: [] } },
    today: { date: dayKey, blocks: [], completionRate: 0, practices: [], loadByPractice: {} },
    currentWeek: { weekStart: dayKey, days: [] },
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    executionEvents: [],
    ledger: [],
    suggestionEvents: [],
    suggestedBlocks: [],
    deliverablesByCycleId: { [cycleId]: { cycleId, deliverables: [] } },
    goalAdmissionByGoal: {},
    constraints: {},
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T08:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    profileLearning: {},
    activeCycleId: cycleId,
    actionsByCycleId: { [cycleId]: { cycleId, goalId: 'goal-1', actions } },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        actions,
        goalContract: {
          goalId: 'goal-1',
          goalLabel: 'write season 1 of tv show',
          startDate: dayKey,
          deadline: { dayKey: '2026-01-22' },
        },
        coldPlan: {
          forecastByDayKey: {
            '2026-01-20': { totalBlocks: 1, byDeliverable: {} },
            '2026-01-21': { totalBlocks: 1, byDeliverable: {} },
            '2026-01-22': { totalBlocks: 1, byDeliverable: {} },
          },
          dailyProjection: { forecastByDayKey: {} },
        },
        summary: { completionCount: 0, completionRate: 0 },
      },
    },
    goalExecutionContract: { goalId: 'goal-1', startDate: dayKey, deadline: { dayKey: '2026-01-22' } },
    goalDirective: { goalId: 'goal-1', directiveId: 'dir-1' },
    directiveEligibilityByGoal: { 'goal-1': { eligible: true } },
    planDraft: { blocksPerWeek: 4, daysPerWeek: 4, primaryDomain: 'CREATION', minutesPerDay: 90 },
    planCalibration: null,
    correctionSignals: null,
  };
}

describe('spine scheduling renders future days', () => {
  it('applies multi-day schedule and renders next-day action block', async () => {
    render(
      <IdentityProvider initialState={buildState()}>
        <ZionDashboard initialView="today" initialZionView="day" initialAnchorDayKey="2026-01-20" />
      </IdentityProvider>
    );
    const user = userEvent.setup();
    const apply = await screen.findByRole('button', { name: /apply schedule/i });
    expect(apply).not.toBeDisabled();

    await act(async () => {
      await user.click(apply);
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^Next$/i }));
    });

    const matches = await screen.findAllByText(/Map season arc beats|Draft episode list|Define season thesis/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText(/Scheduled to Goal deadline:/i)).toBeInTheDocument();
  }, 20000);
});
