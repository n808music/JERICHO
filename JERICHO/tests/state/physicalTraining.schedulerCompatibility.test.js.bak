import { beforeEach, describe, expect, it, vi } from 'vitest';
import { physicalTrainingActions } from './phaseC.archetype.fixtures';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const cycleId = 'cycle-pt-compat';
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
    constraints: { weeklyWindows: { MON: [{ startHHMM: '09:00', endHHMM: '11:00' }] }, dayEndAtHHMM: '23:59' },
    deliverablesByCycleId: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: {
          goalId: 'goal-pt',
          executionType: 'PhysicalTraining',
          startDayKey: dayKey,
          endDayKey: '2026-04-10',
        },
        planProof: {},
        actions: [],
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: {
      goalId: 'goal-pt',
      executionType: 'PhysicalTraining',
      startDayKey: dayKey,
      endDayKey: '2026-04-10',
    },
    goalAdmissionByGoal: { 'goal-pt': { status: 'ADMITTED', reasonCodes: [] } },
    lastPlanError: null,
  };
}

describe('PhysicalTraining scheduler compatibility', () => {
  beforeEach(() => {
    compileAutoAsanaPlanMock.mockReset();
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-pt',
          title: 'Training session',
          dayKey: '2026-03-12',
          startISO: '2026-03-12T09:00:00.000Z',
          durationMinutes: 60,
        },
      ],
      conflicts: [],
    });
  });

  it('preserves scheduler compatibility with deliverable/milestone outputs', () => {
    const next = computeDerivedState(buildState(), {
      type: 'GENERATE_PLAN_WITH_ACTIONS',
      payload: {
        cycleId: 'cycle-pt-compat',
        executionType: 'PhysicalTraining',
        source: 'LLM',
        actions: physicalTrainingActions,
        templates: [],
        diagnostics: {},
      },
    });

    expect(compileAutoAsanaPlanMock).toHaveBeenCalledTimes(1);
    const workspace = next.deliverablesByCycleId?.['cycle-pt-compat'];
    expect(workspace?.compilerSummary?.usesCanonicalDeliverablePath).toBe(true);
    expect((workspace?.deliverables || []).some((entry) => entry.outputType === 'milestone')).toBe(true);
    expect((next.proposedBlocks || []).length).toBeGreaterThan(0);
  });
});
