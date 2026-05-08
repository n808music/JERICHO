import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import JerichoDebugPanel from '../../src/components/debug/JerichoDebugPanel.jsx';
import { IdentityProvider, useIdentityStore } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';

const DAY_KEY = '2026-03-12';
const CYCLE_ID = 'cycle-2026-03-12-3';
const GOAL_ID = 'goal-fundraising-1';
const BASE_PLANNING_ANSWERS = {
  executionContext: 'part_time',
  weeklyHoursAvailable: 12,
  capitalAvailable: 15000,
  hardDeadline: '2026-06-30',
  existingDomainRelationships: [],
};

function buildIntegrationState({ activeDayKey = DAY_KEY, deadlineDayKey = '2026-06-30' } = {}) {
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: {
      date: activeDayKey,
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: activeDayKey, days: [], metrics: {} },
    cycle: [],
    viewDate: activeDayKey,
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
      nowISO: `${activeDayKey}T12:00:00.000Z`,
      activeDayKey,
      isFollowingNow: true,
    },
    constraints: {
      maxBlocksPerDay: 6,
      maxBlocksPerWeek: 30,
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
          startDate: activeDayKey,
          answeredContext: BASE_PLANNING_ANSWERS,
        },
        goalContract: {
          goalId: GOAL_ID,
          goalText: 'Secure $25k sponsorship commitments',
          executionType: 'Fundraising',
          startDayKey: activeDayKey,
          deadline: { dayKey: deadlineDayKey },
          workWindows: {},
          target: {
            count: 25000,
            unit: 'fundraising dollars committed',
            definitionOfDone: '25000 committed by deadline',
          },
        },
      },
    },
    pendingOnboardingInputs: {
      goalDraftV2: {
        goalText: 'raise 25k',
        goalLabel: 'raise 25k',
        executionType: 'Fundraising',
        startDate: activeDayKey,
        answeredContext: BASE_PLANNING_ANSWERS,
      },
      goalText: 'raise 25k',
      executionType: 'Fundraising',
      startDate: activeDayKey,
      deadline: deadlineDayKey,
      targetCount: '25000',
      targetUnit: 'fundraising dollars committed',
      definitionOfDone: '25000 committed by deadline',
      daysPerWeek: '5',
      minutesPerDay: '90',
      answeredContext: BASE_PLANNING_ANSWERS,
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
        admittedAtISO: `${activeDayKey}T12:00:00.000Z`,
      },
    },
    goalExecutionContract: {
      goalId: GOAL_ID,
      goalText: 'Secure $25k sponsorship commitments',
      executionType: 'Fundraising',
      startDayKey: activeDayKey,
      deadline: { dayKey: deadlineDayKey },
    },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: {},
    planRecovery: null,
    lastPlanError: null,
    profileLearning: {},
    directiveEligibilityByGoal: { [GOAL_ID]: { eligible: true } },
    goalDirective: { goalId: GOAL_ID, directiveId: 'dir-1' },
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

  it('generatePlan requires explicit apply then activate before calendar becomes authoritative in April-June', async () => {
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
      expect(capturedStore.getState().scheduleLifecycle).toBe('applied_review');
      expect((capturedStore.getState().scheduleReviewBlocks || []).length).toBeGreaterThan(0);
      expect((capturedStore.getState().executionEvents || []).length).toBe(0);
    });

    const firstReviewBlock = (capturedStore.getState().scheduleReviewBlocks || [])[0];
    expect(firstReviewBlock).toBeTruthy();
    const firstReviewDayKey = String(firstReviewBlock.dayKey || firstReviewBlock.startISO || '').slice(0, 10);
    const firstReviewTitle = firstReviewBlock.title || firstReviewBlock.label;

    await waitFor(() => {
      const cell = container.querySelector('[data-day="2026-03-18"]');
      expect(cell).toBeTruthy();
      expect(cell.textContent).toMatch(/\d/);
    });

    await waitFor(() => {
      const cell = container.querySelector(`[data-day="${firstReviewDayKey}"]`);
      expect(cell).toBeTruthy();
      expect(cell.textContent).toContain(firstReviewTitle);
    });

    expect(screen.getByText(/Review canonical horizon/i)).toBeInTheDocument();
    expect(screen.getAllByText(/This visible slice reflects the canonical review schedule\./i).length).toBeGreaterThan(
      0
    );
    expect(screen.queryByText('Draft creative brief and narrative intent')).not.toBeInTheDocument();

    await act(async () => {
      capturedStore.activateSchedule({ cycleId: CYCLE_ID });
    });

    await waitFor(() => {
      expect(capturedStore.getState().scheduleLifecycle).toBe('active_schedule');
      expect((capturedStore.getState().executionEvents || []).length).toBeGreaterThan(0);
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /go to next month/i }));
    });

    await waitFor(() => {
      expect(container.querySelector('[data-window-label="true"]')?.textContent).toMatch(/April 2026/i);
      const cell = container.querySelector('[data-day="2026-04-07"]');
      expect(cell).toBeTruthy();
      expect(cell.textContent).toMatch(/\d/);
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /go to next month/i }));
    });

    await waitFor(() => {
      expect(container.querySelector('[data-window-label="true"]')?.textContent).toMatch(/May 2026/i);
      const cell = container.querySelector('[data-day="2026-05-03"]');
      expect(cell).toBeTruthy();
      expect(cell.textContent).toMatch(/\d/);
    });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /go to next month/i }));
    });

    await waitFor(() => {
      expect(container.querySelector('[data-window-label="true"]')?.textContent).toMatch(/June 2026/i);
      const cell = container.querySelector('[data-day="2026-06-04"]');
      expect(cell).toBeTruthy();
      expect(cell.textContent).toMatch(/\d/);
    });

    const persistedActiveState = JSON.parse(JSON.stringify(capturedStore.getState()));
    const hydratedRefreshState = computeDerivedState(persistedActiveState, {
      type: 'SET_VIEW_DATE',
      date: persistedActiveState.viewDate || persistedActiveState.today?.date || DAY_KEY,
    });

    cleanup();
    capturedStore = null;

    const remounted = render(
      <IdentityProvider initialState={hydratedRefreshState}>
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={DAY_KEY} />
      </IdentityProvider>
    );

    await waitFor(() => {
      const cell = remounted.container.querySelector(`[data-day="${firstReviewDayKey}"]`);
      expect(cell).toBeTruthy();
      expect(cell.textContent).toContain(firstReviewTitle);
    });
  }, 90000);

  it('generatePlan writes one canonical full-horizon proposal set and month views slice it without changing the total', async () => {
    const user = userEvent.setup();
    render(
      <IdentityProvider
        initialState={buildIntegrationState({ activeDayKey: '2026-04-01', deadlineDayKey: '2026-06-30' })}
      >
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey="2026-04-01" />
      </IdentityProvider>
    );

    expect(capturedStore).toBeTruthy();

    await act(async () => {
      await capturedStore.generatePlanWithLLM({ cycleId: CYCLE_ID, anchorDayKey: '2026-04-01' });
    });

    await waitFor(() => {
      expect(capturedStore.getState().pendingPlanConfirmation).toBe(true);
    });

    const proposedBlocks = capturedStore.getState().proposedBlocks || [];
    expect(proposedBlocks.length).toBeGreaterThan(0);
    const aprilBlocks = proposedBlocks.filter((block) => String(block.dayKey || '').startsWith('2026-04-'));
    expect(aprilBlocks.length).toBeGreaterThan(0);
    const horizonCount = proposedBlocks.length;
    expect(document.querySelector('[data-window-label="true"]')?.textContent).toMatch(/April 2026/i);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /go to next month/i }));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-window-label="true"]')?.textContent).toMatch(/May 2026/i);
      expect(capturedStore.getState().proposedBlocks.length).toBe(horizonCount);
    });
  }, 90000);

  it('regenerating from a later month recomputes the same full horizon instead of erasing earlier months', async () => {
    render(
      <IdentityProvider
        initialState={buildIntegrationState({ activeDayKey: '2026-04-01', deadlineDayKey: '2026-06-30' })}
      >
        <StoreProbe />
        <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey="2026-06-01" />
      </IdentityProvider>
    );

    expect(capturedStore).toBeTruthy();

    await act(async () => {
      await capturedStore.generatePlanWithLLM({ cycleId: CYCLE_ID, anchorDayKey: '2026-04-01' });
    });

    await waitFor(() => {
      expect(capturedStore.getState().pendingPlanConfirmation).toBe(true);
    });

    const firstProposals = capturedStore.getState().proposedBlocks || [];
    const firstCount = firstProposals.length;
    expect(firstProposals.some((block) => String(block.dayKey || '').startsWith('2026-04-'))).toBe(true);

    await act(async () => {
      await capturedStore.generatePlanWithLLM({ cycleId: CYCLE_ID, anchorDayKey: '2026-06-01' });
    });

    await waitFor(() => {
      expect(capturedStore.getState().pendingPlanConfirmation).toBe(true);
    });

    const regeneratedProposals = capturedStore.getState().proposedBlocks || [];
    const juneVisibleCount = regeneratedProposals.filter((block) =>
      String(block.dayKey || '').startsWith('2026-06-')
    ).length;
    expect(regeneratedProposals.length).toBe(firstCount);
    expect(regeneratedProposals.some((block) => String(block.dayKey || '').startsWith('2026-04-'))).toBe(true);
    expect(regeneratedProposals.every((block) => String(block.dayKey || '') <= '2026-06-30')).toBe(true);
    expect(regeneratedProposals.length).toBeGreaterThanOrEqual(juneVisibleCount);
  }, 90000);

  it('does not emit a render-time update warning while accepted goals materialize a review schedule', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <IdentityProvider initialState={buildIntegrationState()}>
          <StoreProbe />
          <JerichoDebugPanel />
          <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey={DAY_KEY} />
        </IdentityProvider>
      );

      expect(capturedStore).toBeTruthy();

      await act(async () => {
        await capturedStore.generatePlanWithLLM({ cycleId: CYCLE_ID });
      });

      await waitFor(() => {
        expect((capturedStore.getState().proposedBlocks || []).length).toBeGreaterThan(0);
        expect(capturedStore.getState().pendingPlanConfirmation).toBe(true);
      });

      await act(async () => {
        capturedStore.applyPlan({ cycleId: CYCLE_ID });
      });

      await waitFor(() => {
        expect(capturedStore.getState().scheduleLifecycle).toBe('applied_review');
        expect((capturedStore.getState().scheduleReviewBlocks || []).length).toBeGreaterThan(0);
      });

      expect(
        errorSpy.mock.calls.some((call) =>
          String(call?.[0] || '').includes(
            'Cannot update a component (`JerichoDebugPanel`) while rendering a different component (`IdentityProvider`)'
          )
        )
      ).toBe(false);
    } finally {
      errorSpy.mockRestore();
    }
  }, 90000);
});
