import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider } from '../../src/state/identityStore.js';

function buildState() {
  const cycleId = 'cycle-1';
  const startDay = '2026-03-01';
  const actions = Array.from({ length: 24 }).map((_, i) => ({
    id: `a-${i + 1}`,
    goalId: 'goal-1',
    title: i % 2 ? `Write episode ${Math.floor(i / 2) + 1} draft` : `Outline episode ${Math.floor(i / 2) + 1}`,
    brief: `Detail ${i + 1}`,
    definitionOfDone: 'Done',
    estimateMin: 30,
    category: 'Creation',
    deps: [],
    status: 'todo',
    topoIndex: i,
    priority: 1,
  }));
  const forecastByDayKey = {};
  for (let i = 0; i < 60; i += 1) {
    const day = new Date(`${startDay}T00:00:00.000Z`);
    day.setUTCDate(day.getUTCDate() + i);
    const dayKey = day.toISOString().slice(0, 10);
    forecastByDayKey[dayKey] = { totalBlocks: 3, byDeliverable: {} };
  }
  return {
    vector: {},
    lenses: { aim: { description: '', horizon: '90d' }, pattern: { dailyTargets: [] }, flow: { streams: [] } },
    today: { date: startDay, blocks: [], completionRate: 0, practices: [], loadByPractice: {} },
    currentWeek: { weekStart: startDay, days: [] },
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
    appTime: { timeZone: 'UTC', nowISO: `${startDay}T08:00:00.000Z`, activeDayKey: startDay, isFollowingNow: true },
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
          startDate: startDay,
          deadline: { dayKey: '2026-05-01' },
          temporalBinding: { daysPerWeek: 7, activationTime: '09:00', sessionDurationMinutes: 60 },
        },
        coldPlan: { forecastByDayKey, dailyProjection: { forecastByDayKey: {} } },
        summary: { completionCount: 0, completionRate: 0 },
      },
    },
    goalExecutionContract: { goalId: 'goal-1', startDate: startDay, deadline: { dayKey: '2026-05-01' } },
    goalDirective: { goalId: 'goal-1', directiveId: 'dir-1' },
    directiveEligibilityByGoal: { 'goal-1': { eligible: true } },
    planDraft: { blocksPerWeek: 5, daysPerWeek: 5, primaryDomain: 'CREATION', minutesPerDay: 90 },
    planCalibration: null,
    correctionSignals: null,
  };
}

describe('month view full plan across weeks', () => {
  it('shows scheduled counts and later-episode titles in future month after apply', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <IdentityProvider initialState={buildState()}>
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey="2026-03-01" />
      </IdentityProvider>
    );
    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Structure Contract/i }));
    });

    const apply = await screen.findByRole('button', { name: /apply schedule/i });
    expect(apply).not.toBeDisabled();
    await act(async () => {
      await user.click(apply);
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Today Execution/i }));
    });

    const marchDays = Array.from(document.querySelectorAll('button[data-day^="2026-03-"]'));
    expect(marchDays.length).toBeGreaterThan(0);

    const hasScheduledInMarch = marchDays.some((node) => {
      const raw = node.textContent || '';
      const match = raw.match(/(\d+)\s*\/\s*(\d+)/);
      return Boolean(match && Number(match[2]) > 0);
    });
    expect(hasScheduledInMarch).toBe(true);

    const hasEpisodeTitle = marchDays.some((node) =>
      /Outline episode \d+|Write episode \d+ draft/i.test(node.textContent || '')
    );
    expect(hasEpisodeTitle).toBe(true);
    expect(within(marchDays[0]).getByText(/Route:/i)).toBeInTheDocument();

    alertSpy.mockRestore();
  }, 20000);
});
