import { beforeEach, describe, expect, it, vi } from 'vitest';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const cycleId = 'cycle-vl-1';
  const dayKey = '2026-03-11';
  return {
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: {
      weeklyWindows: { MON: [{ startHHMM: '09:00', endHHMM: '11:00' }] },
      dayEndAtHHMM: '23:59',
    },
    deliverablesByCycleId: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: {
          goalId: 'goal-vl',
          executionType: 'VentureLaunch',
          startDayKey: dayKey,
          endDayKey: '2026-04-10',
        },
        planProof: {},
        actions: [],
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: {
      goalId: 'goal-vl',
      executionType: 'VentureLaunch',
      startDayKey: dayKey,
      endDayKey: '2026-04-10',
    },
    goalAdmissionByGoal: { 'goal-vl': { status: 'ADMITTED', reasonCodes: [] } },
    lastPlanError: null,
  };
}

describe('goalToDeliverables scheduler compatibility', () => {
  beforeEach(() => {
    compileAutoAsanaPlanMock.mockReset();
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-1',
          title: 'Launch page',
          dayKey: '2026-03-12',
          startISO: '2026-03-12T09:00:00.000Z',
          durationMinutes: 60,
        },
      ],
      conflicts: [],
    });
  });

  it('keeps scheduler action path working while writing canonical deliverables workspace', () => {
    const actionPayload = {
      cycleId: 'cycle-vl-1',
      executionType: 'VentureLaunch',
      source: 'LLM',
      actions: [
        {
          id: 'validate:001',
          title: 'Interview users',
          deliverable: 'Interview synthesis report completed',
          definitionOfDone: 'Top findings documented.',
          estimateMin: 75,
          dependencies: [],
        },
      ],
      templates: [],
      diagnostics: {},
    };

    const next = computeDerivedState(buildState(), {
      type: 'GENERATE_PLAN_WITH_ACTIONS',
      payload: actionPayload,
    });

    expect(compileAutoAsanaPlanMock).toHaveBeenCalledTimes(1);
    const input = compileAutoAsanaPlanMock.mock.calls[0][0];
    expect(input.actionSequence).toHaveLength(1);
    expect(input.actionSequence[0].id).toBe('validate:001');

    const workspace = next.deliverablesByCycleId?.['cycle-vl-1'];
    expect(workspace?.deliverables?.length).toBeGreaterThan(0);
    expect(workspace?.compilerSummary?.usesCanonicalDeliverablePath).toBe(true);
    expect((next.proposedBlocks || []).length).toBeGreaterThan(0);
  });
});
