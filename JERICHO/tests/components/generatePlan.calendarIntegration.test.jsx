import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider, useIdentityStore } from '../../src/state/identityStore.js';

const DAY_KEY = '2026-03-12';
const CYCLE_ID = 'cycle-2026-03-12-3';
const GOAL_ID = 'goal-fundraising-1';

function buildIntegrationState() {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] }
    },
    today: { date: DAY_KEY, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: '2026-03-09', days: [], metrics: {} },
    cycle: [],
    viewDate: DAY_KEY,
    templates: { objectives: {} },
    lastAdaptedDate: null,
    stability: { headline: '', actionLine: '' },
    meta: { version: '1.0.0', onboardingComplete: true },
    recurringPatterns: [],
    lastSessionChange: null,
    nextSuggestion: null,
    executionEvents: [],
    ledger: [],
    appTime: {
      timeZone: 'UTC',
      nowISO: '2026-03-12T12:00:00.000Z',
      activeDayKey: DAY_KEY,
      isFollowingNow: true
    },
    constraints: {
      maxBlocksPerDay: 6,
      maxBlocksPerWeek: 30
    },
    activeCycleId: CYCLE_ID,
    cyclesById: {
      [CYCLE_ID]: {
        id: CYCLE_ID,
        status: 'active',
        goalDraftV2: {
          goalText: 'raise 25k',
          goalLabel: 'raise 25k',
          executionType: 'Fundraising',
          startDate: DAY_KEY
        },
        goalContract: {
          goalId: GOAL_ID,
          goalText: 'Secure $25k sponsorship commitments',
          executionType: 'Fundraising',
          startDayKey: DAY_KEY,
          deadline: { dayKey: '2026-06-30' },
          workWindows: {},
          target: {
            count: 25000,
            unit: 'fundraising dollars committed',
            definitionOfDone: '25000 committed by deadline'
          }
        }
      }
    },
    pendingOnboardingInputs: {
      goalDraftV2: {
        goalText: 'raise 25k',
        goalLabel: 'raise 25k',
        executionType: 'Fundraising',
        startDate: DAY_KEY
      },
      goalText: 'raise 25k',
      executionType: 'Fundraising',
      startDate: DAY_KEY,
      deadline: '2026-06-30',
      targetCount: '25000',
      targetUnit: 'fundraising dollars committed',
      definitionOfDone: '25000 committed by deadline',
      daysPerWeek: '5',
      minutesPerDay: '90'
    },
    proposedBlocks: [],
    proposedBlocksByCycleId: {},
    suggestedBlocks: [],
    suggestionEvents: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: {
      [GOAL_ID]: {
        status: 'ADMITTED',
        reasonCodes: [],
        admittedAtISO: '2026-03-12T12:00:00.000Z'
      }
    },
    goalExecutionContract: {
      goalId: GOAL_ID,
      goalText: 'Secure $25k sponsorship commitments',
      executionType: 'Fundraising',
      startDayKey: DAY_KEY,
      deadline: { dayKey: '2026-06-30' }
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    planRecovery: null,
    lastPlanError: null,
    profileLearning: {},
    directiveEligibilityByGoal: { [GOAL_ID]: { eligible: true } },
    goalDirective: { goalId: GOAL_ID, directiveId: 'dir-1' }
  };
}

let capturedStore = null;

function StoreProbe() {
  capturedStore = useIdentityStore();
  return null;
}

describe('generatePlan -> calendar integration', () => {
  beforeEach(() => {
    capturedStore = null;
    if (typeof localStorage !== 'undefined') {
      if (typeof localStorage.clear === 'function') {
        localStorage.clear();
      } else if (typeof localStorage.removeItem === 'function') {
        localStorage.removeItem('jericho-identity');
      }
    }
  });

  it(
    'generatePlan requires explicit apply before calendar shows committed blocks in April-June',
    async () => {
      const user = userEvent.setup();
      const { container } = render(
        <IdentityProvider initialState={buildIntegrationState()}>
          <StoreProbe />
          <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={DAY_KEY} />
        </IdentityProvider>
      );

      expect(capturedStore).toBeTruthy();

      await act(async () => {
        await capturedStore.generatePlanWithLLM({ cycleId: CYCLE_ID });
      });

      await waitFor(() => {
        expect(capturedStore.getState().pendingPlanConfirmation).toBe(true);
        expect(capturedStore.getState().scheduleApplied).toBe(false);
      });

      await act(async () => {
        capturedStore.applyPlan({ cycleId: CYCLE_ID });
      });

      await waitFor(() => {
        expect(capturedStore.getState().scheduleApplied).toBe(true);
      });

      await waitFor(() => {
        const cell = container.querySelector('[data-day="2026-03-18"]');
        expect(cell).toBeTruthy();
        expect(cell.textContent).toMatch(/\d/);
      });

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /next/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(/April 2026/i)).toBeInTheDocument();
        const cell = container.querySelector('[data-day="2026-04-07"]');
        expect(cell).toBeTruthy();
        expect(cell.textContent).toMatch(/\d/);
      });

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /next/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(/May 2026/i)).toBeInTheDocument();
        const cell = container.querySelector('[data-day="2026-05-03"]');
        expect(cell).toBeTruthy();
        expect(cell.textContent).toMatch(/\d/);
      });

      await act(async () => {
        await user.click(screen.getByRole('button', { name: /next/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(/June 2026/i)).toBeInTheDocument();
        const cell = container.querySelector('[data-day="2026-06-04"]');
        expect(cell).toBeTruthy();
        expect(cell.textContent).toMatch(/\d/);
      });
    },
    90000
  );
});
