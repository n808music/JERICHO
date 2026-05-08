import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { IdentityProvider } from '../../src/state/identityStore.js';
import { StructurePageConsolidated } from '../../src/components/zion/StructurePageConsolidated.jsx';

function buildState() {
  const dayKey = '2026-01-20';
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
    today: { date: dayKey, blocks: [], completionRate: 0, practices: [], loadByPractice: {} },
    currentWeek: { weekStart: dayKey, days: [] },
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
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T08:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
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
          startDate: dayKey,
          deadline: { dayKey: '2026-02-20' },
        },
        coldPlan: {
          forecastByDayKey: {
            [dayKey]: { totalBlocks: 2, byDeliverable: {} },
          },
          dailyProjection: { forecastByDayKey: {} },
        },
        summary: { completionCount: 0, completionRate: 0 },
      },
    },
    goalExecutionContract: {
      goalId: 'goal-1',
      goalLabel: 'ship deterministic planner validation',
      startDate: dayKey,
      deadline: { dayKey: '2026-02-20' },
    },
    goalDirective: { goalId: 'goal-1', directiveId: 'dir-1' },
    directiveEligibilityByGoal: { 'goal-1': { eligible: true } },
    planDraft: { blocksPerWeek: 4, daysPerWeek: 4, primaryDomain: 'CREATION', minutesPerDay: 90 },
    planCalibration: null,
    correctionSignals: null,
  };
}

describe('Structure commit gating', () => {
  it('keeps apply schedule blocked when full-plan emits no draft rows and shows spine narration', async () => {
    render(
      <IdentityProvider initialState={buildState()}>
        <StructurePageConsolidated />
      </IdentityProvider>
    );

    const applyButton = await screen.findByRole('button', { name: /Apply Schedule to Calendar/i });
    expect(applyButton).toBeDisabled();
    expect(applyButton).toHaveAttribute('title', expect.stringMatching(/no draft items available/i));
    expect(screen.getByText(/Scheduled to Goal deadline:/i)).toBeInTheDocument();
    expect(screen.getByText(/Waiting: 1\./i)).toBeInTheDocument();
  });
});
