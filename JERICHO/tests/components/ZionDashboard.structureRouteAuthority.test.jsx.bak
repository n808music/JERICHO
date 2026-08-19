import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';

import ZionDashboard from '../../src/components/ZionDashboard.jsx';

let mockStore = {};

vi.mock('../../src/state/identityStore.js', () => ({
  useIdentityStore: () => mockStore,
}));

function buildStore() {
  const activeGoalId = 'goal-operation-endgame';
  const activeCycleId = 'cycle-operation-endgame';
  return {
    activeProfileId: 'profile-operation-endgame',
    activeGoalId,
    activeCycleId,
    profilesById: {
      'profile-operation-endgame': {
        id: 'profile-operation-endgame',
        displayName: 'James / Operation Endgame',
        label: 'James / Operation Endgame',
        goalIds: [activeGoalId],
        activeGoalId,
        activeMasterPlanId: 'masterplan-operation-endgame',
        masterPlanIds: ['masterplan-operation-endgame'],
        masterCalendarId: 'calendar-operation-endgame',
      },
    },
    goalsById: {
      [activeGoalId]: { id: activeGoalId, title: 'Operation Endgame', activeCycleId },
    },
    cyclesById: {
      [activeCycleId]: {
        id: activeCycleId,
        profileId: 'profile-operation-endgame',
        goalId: activeGoalId,
        masterPlanId: 'masterplan-operation-endgame',
        source: 'master_plan',
        status: 'active',
        startedAtDayKey: '2026-05-19',
        executionStartDayKey: '2026-06-08',
        reassessmentCompletedAtISO: '2026-06-07T12:00:00.000Z',
        scheduleGeneratedAtISO: '2026-06-07T12:30:00.000Z',
        goalContract: {
          goalId: activeGoalId,
          startDayKey: '2026-05-19',
          endDayKey: '2026-10-17',
        },
        metrics: {},
      },
    },
    masterPlansById: {
      'masterplan-operation-endgame': {
        id: 'masterplan-operation-endgame',
        title: 'Operation Endgame',
        horizonStart: '2026-05-19',
        horizonEnd: '2031-05-19',
        fullHorizonEndDayKey: '2031-05-19',
        laneIds: [],
        anchors: [],
      },
    },
    masterCalendarsById: {
      'calendar-operation-endgame': {
        id: 'calendar-operation-endgame',
        activeGoalIds: [activeGoalId],
        activeCycleIds: [activeCycleId],
      },
    },
    today: {
      date: '2026-06-08',
      blocks: [],
      completionRate: 0,
      driftSignal: 'contained',
      loadByPractice: {},
      practices: [],
    },
    currentWeek: { weekStart: '2026-06-08', days: [], metrics: {} },
    cycle: [],
    executionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    deliverablesByCycleId: {},
    goalAdmissionByGoal: { [activeGoalId]: { status: 'ADMITTED', reasonCodes: [] } },
    appTime: { nowISO: '2026-06-09T12:00:00.000Z', activeDayKey: '2026-06-09', timeZone: 'UTC' },
    goalWorkById: {},
    constraints: {},
    availabilityPolicy: {},
    debug: {},
    lastPlanError: null,
    cycleDynamicsByCycleId: {},
    blockStore: { blocks: {} },
    goalExecutionContract: { goalId: activeGoalId, startDayKey: '2026-05-19', endDayKey: '2026-10-17' },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    planQualityGateByGoal: {},
    executionCorrectionByGoal: {},
    systemShotClockByGoal: {},
    masterPlanLanesById: {},
    masterPlanMilestonesById: {},
    strategicClustersById: {},
    goalRelations: [],
    constraintRelations: [],
    frictionEvents: [],
    frictionPropagationResults: [],
    profileLearning: {},
    planRecovery: null,
    pendingPlanConfirmation: false,
    scheduleApplied: false,
    coreContinuity: {},
    coreMissionContractsById: {},
    scheduleLifecycleState: 'goal_admitted',
    selectedHorizonMode: 'current_cycle',
    actions: {},
  };
}

describe('ZionDashboard route authority on direct structure refresh', () => {
  beforeEach(() => {
    window.location.hash = '#/structure';
    mockStore = buildStore();
  });

  it('keeps the structure route sovereign over stale today/month inputs after mount', async () => {
    const { rerender } = render(
      <ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey="2026-05-19" />
    );

    await waitFor(() => {
      const snapshot = window.__jerichoUiDebug__?.getSnapshot?.();
      expect(snapshot?.hash).toBe('#/structure');
      expect(snapshot?.view).toBe('structure');
      expect(snapshot?.renderedSurface).toBe('structure');
      expect(snapshot?.zionView).toBe('day');
    });

    rerender(<ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey="2026-05-19" />);

    await waitFor(() => {
      const snapshot = window.__jerichoUiDebug__?.getSnapshot?.();
      expect(snapshot?.view).toBe('structure');
      expect(snapshot?.renderedSurface).toBe('structure');
      expect(snapshot?.zionView).toBe('day');
    });
  });

  it('reasserts structure route authority on browser restore when no hashchange fires', async () => {
    window.location.hash = '';
    render(<ZionDashboard initialView="today" initialZionView="month" initialAnchorDayKey="2026-05-19" />);

    await waitFor(() => {
      const snapshot = window.__jerichoUiDebug__?.getSnapshot?.();
      expect(snapshot?.view).toBe('today');
      expect(snapshot?.zionView).toBe('month');
    });

    window.location.hash = '#/structure';
    await act(async () => {
      window.dispatchEvent(new Event('pageshow'));
    });

    await waitFor(() => {
      const snapshot = window.__jerichoUiDebug__?.getSnapshot?.();
      expect(snapshot?.hash).toBe('#/structure');
      expect(snapshot?.view).toBe('structure');
      expect(snapshot?.renderedSurface).toBe('structure');
      expect(snapshot?.zionView).toBe('day');
    });
  });
});
