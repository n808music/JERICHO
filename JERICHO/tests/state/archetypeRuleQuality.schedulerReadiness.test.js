import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateArchetypeRulesFromActions } from '../../src/state/engine/archetypeRuleQuality';
import { migratedArchetypeFixtures } from './archetypeRuleQuality.fixtures';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

import { computeDerivedState } from '../../src/state/identityCompute.js';

function buildState() {
  const cycleId = 'cycle-pq-readiness';
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
          goalId: 'goal-pq',
          executionType: 'ProfessionalQualification',
          startDayKey: dayKey,
          endDayKey: '2026-04-10',
        },
        planProof: {},
        actions: [],
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: {
      goalId: 'goal-pq',
      executionType: 'ProfessionalQualification',
      startDayKey: dayKey,
      endDayKey: '2026-04-10',
    },
    goalAdmissionByGoal: { 'goal-pq': { status: 'ADMITTED', reasonCodes: [] } },
    lastPlanError: null,
  };
}

describe('archetypeRuleQuality scheduler readiness regression', () => {
  beforeEach(() => {
    compileAutoAsanaPlanMock.mockReset();
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-1',
          title: 'Practice exam',
          dayKey: '2026-03-12',
          startISO: '2026-03-12T09:00:00.000Z',
          durationMinutes: 60,
        },
      ],
      conflicts: [],
    });
  });

  it('quality-evaluated migrated archetype remains scheduler-compatible downstream', () => {
    const fixture = migratedArchetypeFixtures.find((entry) => entry.archetype === 'ProfessionalQualification');
    const summary = evaluateArchetypeRulesFromActions({
      executionType: fixture.archetype,
      actions: fixture.actions,
      contract: fixture.contract,
      cycleId: fixture.cycleId,
    });
    expect(summary.schedulerReadiness.schedulerCompatible).toBe(true);

    const next = computeDerivedState(buildState(), {
      type: 'GENERATE_PLAN_WITH_ACTIONS',
      payload: {
        cycleId: 'cycle-pq-readiness',
        executionType: 'ProfessionalQualification',
        source: 'LLM',
        actions: fixture.actions,
        templates: [],
        diagnostics: {},
      },
    });

    expect(compileAutoAsanaPlanMock).toHaveBeenCalledTimes(1);
    expect((next.proposedBlocks || []).length).toBeGreaterThan(0);
    expect(next.deliverablesByCycleId?.['cycle-pq-readiness']?.compilerSummary?.usesCanonicalDeliverablePath).toBe(
      true
    );
  });
});
