import { describe, expect, it, vi, beforeEach } from 'vitest';

import { computeDerivedState } from '../../src/state/identityCompute.js';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

function buildState() {
  return {
    appTime: { timeZone: 'UTC', nowISO: '2026-03-10T12:00:00.000Z', activeDayKey: '2026-03-10', isFollowingNow: true },
    today: { date: '2026-03-10', blocks: [] },
    currentWeek: { weekStart: '2026-03-10', days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: {
      maxBlocksPerDay: 2,
      weeklyWindows: {
        MON: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        TUE: [{ startHHMM: '09:00', endHHMM: '11:00' }],
      },
    },
    activeProfileId: 'profile-1',
    profilesById: {
      'profile-1': { id: 'profile-1', activeGoalId: 'goal-1', goalIds: ['goal-1'], cycleIds: ['cycle-1'] },
    },
    goalsById: {
      'goal-1': { id: 'goal-1', profileId: 'profile-1', activeCycleId: 'cycle-1', cycleIds: ['cycle-1'] },
    },
    activeGoalId: 'goal-1',
    cyclesById: {
      'cycle-1': {
        id: 'cycle-1',
        status: 'active',
        goalContract: {
          goalId: 'goal-1',
          goalText: 'Launch a podcast',
          goalLabel: 'Launch a podcast',
          executionType: 'CreativeProduction',
          startDayKey: '2026-03-10',
          endDayKey: '2026-04-10',
          terminalOutcome: {
            text: 'Launch a podcast',
            verificationCriteria: 'Episode package published with proof',
          },
        },
        actions: [
          {
            id: 'a1',
            title: 'Draft episode outline',
            deliverableId: 'd1',
            estimateMin: 60,
          },
        ],
        llmActionGraph: null,
        planProof: { workableDaysRemaining: 20, totalRequiredUnits: 1, requiredPacePerDay: 1, maxPerDay: 2, maxPerWeek: 5 },
        metrics: {},
      },
    },
    deliverablesByCycleId: {
      'cycle-1': {
        cycleId: 'cycle-1',
        deliverables: [{ id: 'd1', title: 'Episode outline package', actionIds: ['a1'] }],
        suggestionLinks: {},
        lastUpdatedAtISO: '2026-03-10T12:00:00.000Z',
      },
    },
    goalExecutionContract: {
      goalId: 'goal-1',
      goalText: 'Launch a podcast',
      startDayKey: '2026-03-10',
      endDayKey: '2026-04-10',
    },
    goalAdmissionByGoal: { 'goal-1': { status: 'ADMITTED', reasonCodes: [] } },
    probabilityByGoal: {},
    feasibilityByGoal: {},
    goalWorkById: { 'goal-1': [{ workItemId: 'w1', blocksRemaining: 1 }] },
    lastPlanError: null,
  };
}

describe('generated plan quality materialization', () => {
  beforeEach(() => {
    compileAutoAsanaPlanMock.mockReset();
  });

  it('materializes planQualityGate on the generated cycle even when activeCycleId is absent', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-1',
          title: 'Draft episode outline',
          deliverableId: 'd1',
          actionId: 'a1',
          dayKey: '2026-03-11',
          startISO: '2026-03-11T09:00:00.000Z',
          endISO: '2026-03-11T10:00:00.000Z',
          durationMinutes: 60,
          blockType: 'execution',
          owner: 'executor',
          producesArtifact: 'Episode outline package with opening, segments, and CTA',
          consumedBy: ['terminalOutcome:goal-1'],
          passEvidence: 'Episode outline package reviewed for structure, opening, and CTA completeness',
          consumedByRef: { type: 'terminalOutcome', id: 'goal-1' },
        },
      ],
      conflicts: [],
      summary: { planStatus: 'VALID_AND_FULLY_SCHEDULED' },
    });

    const generated = computeDerivedState(buildState(), { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-1' } });
    const cycle = generated.cyclesById['cycle-1'];

    expect(cycle.planQualityGate).toBeTruthy();
    expect(cycle.planQualityGate.status).toBe('PLAN_QUALITY_PASSED');
  });
});
