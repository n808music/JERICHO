import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

function makeCreateEvent({
  id,
  cycleId,
  goalId,
  startISO,
  endISO,
  status = 'planned',
  completed = false,
  title = 'Record podcast episode 1',
  deliverableId = 'd1',
  actionId = 'act-1',
}) {
  const minutes = Math.max(1, Math.round((Date.parse(endISO) - Date.parse(startISO)) / 60000));
  return {
    id: `evt:create:${id}`,
    blockId: id,
    dateISO: startISO.slice(0, 10),
    minutes,
    rawLabel: title,
    title,
    domain: 'Focus',
    cycleId,
    goalId,
    deliverableId,
    actionId,
    completed,
    kind: 'create',
    startISO,
    endISO,
    status,
  };
}

function baseState(overrides = {}) {
  const cycleId = 'cycle-reneg-1';
  const goalId = 'goal-reneg-1';
  return {
    appTime: { timeZone: 'UTC', nowISO: '2026-03-10T12:00:00.000Z', activeDayKey: '2026-03-10', isFollowingNow: true },
    today: { date: '2026-03-10', blocks: [] },
    currentWeek: { weekStart: '2026-03-10', days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [
      makeCreateEvent({
        id: 'done-1',
        cycleId,
        goalId,
        startISO: '2026-03-09T09:00:00.000Z',
        endISO: '2026-03-09T10:00:00.000Z',
        status: 'completed',
        completed: true,
      }),
      makeCreateEvent({
        id: 'missed-1',
        cycleId,
        goalId,
        startISO: '2026-03-09T10:00:00.000Z',
        endISO: '2026-03-09T11:00:00.000Z',
        status: 'missed',
      }),
    ],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: { maxBlocksPerDay: 1, maxBlocksPerWeek: 5, maxMinutesPerDay: 90 },
    goalWorkById: {
      [goalId]: [{ workItemId: 'w1', blocksRemaining: 18 }],
    },
    deliverablesByCycleId: {
      [cycleId]: {
        cycleId,
        deliverables: [{ id: 'd1', title: 'Podcast episode 1 production', estimateMin: 60, actionIds: ['act-1'] }],
        suggestionLinks: {},
        lastUpdatedAtISO: '2026-03-10T12:00:00.000Z',
      },
    },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: {
          goalId,
          startDayKey: '2026-03-01',
          endDayKey: '2026-03-14',
          workWindows: {
            mon: [{ start: '09:00', end: '10:00' }],
            tue: [{ start: '09:00', end: '10:00' }],
            wed: [{ start: '09:00', end: '10:00' }],
            thu: [{ start: '09:00', end: '10:00' }],
            fri: [{ start: '09:00', end: '10:00' }],
            sat: [],
            sun: [],
          },
        },
        goalGovernanceContract: {
          contractId: `gov-${goalId}`,
          version: 1,
          goalId,
          activeFromISO: '2026-03-01',
          activeUntilISO: '2026-03-14',
          scope: { timezone: 'UTC' },
          governance: { suggestionsEnabled: true, probabilityEnabled: true, minEvidenceEvents: 0 },
        },
        actions: [{ id: 'act-1', title: 'Record podcast episode 1', deliverableId: 'd1', estimateMin: 60 }],
        planProof: {},
        executionEvents: [],
        metrics: {},
        strategy: {
          constraints: {
            maxBlocksPerDay: 1,
            maxBlocksPerWeek: 5,
            maxMinutesPerDay: 90,
          },
        },
      },
      'cycle-foreign': {
        id: 'cycle-foreign',
        status: 'active',
        goalContract: { goalId: 'goal-foreign', startDayKey: '2026-03-01', endDayKey: '2026-04-30' },
        metrics: {},
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-03-14' },
    lastPlanError: null,
    ...overrides,
  };
}

describe('interactive renegotiation apply flow', () => {
  beforeEach(() => {
    compileAutoAsanaPlanMock.mockReset();
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-reneg-1',
          title: 'Record podcast episode 2',
          deliverableId: 'd1',
          actionId: 'act-1',
          dayKey: '2026-03-12',
          startISO: '2026-03-12T09:00:00.000Z',
          durationMinutes: 60,
        },
      ],
      conflicts: [],
    });
  });

  it('applies deadline extension on active cycle and preserves history', () => {
    const seeded = computeDerivedState(baseState(), { type: 'NO_OP' });
    const beforeEnd = seeded.cyclesById['cycle-reneg-1'].goalContract.endDayKey;
    const beforeEvents = JSON.stringify(seeded.executionEvents);

    const next = computeDerivedState(seeded, {
      type: 'APPLY_RENEGOTIATION_OPTION',
      payload: { optionType: 'EXTEND_DEADLINE' },
    });

    const cycle = next.cyclesById['cycle-reneg-1'];
    expect(next.activeCycleId).toBe('cycle-reneg-1');
    expect(cycle.goalContract.endDayKey).not.toBe(beforeEnd);
    expect(cycle.lastRenegotiationApplied?.status).toBe('APPLIED');
    expect(cycle.lastRenegotiationApplied?.optionType).toBe('EXTEND_DEADLINE');
    expect(JSON.stringify(next.executionEvents)).toBe(beforeEvents);
    expect((next.proposedBlocks || []).length).toBeGreaterThan(0);
  });

  it('applies throughput increase without changing cycle identity and recalculates forward contract pressure', () => {
    const seeded = computeDerivedState(baseState(), { type: 'NO_OP' });
    const beforeWeekly = seeded.cyclesById['cycle-reneg-1']?.strategy?.constraints?.maxBlocksPerWeek || 0;

    const next = computeDerivedState(seeded, {
      type: 'APPLY_RENEGOTIATION_OPTION',
      payload: { optionType: 'INCREASE_THROUGHPUT' },
    });

    const cycle = next.cyclesById['cycle-reneg-1'];
    expect(cycle.strategy?.constraints?.maxBlocksPerWeek).toBeGreaterThan(beforeWeekly);
    expect(cycle.lastRenegotiationApplied?.status).toBe('APPLIED');
    expect(['RECOVERY_WITHIN_CONTRACT', 'RECOVERY_RENEGOTIATION_REQUIRED']).toContain(cycle.metrics?.recoveryState);
  });

  it('keeps historical execution evidence intact while regenerating forward proposals', () => {
    const seeded = computeDerivedState(baseState(), { type: 'NO_OP' });
    const beforeCompletedCount = seeded.executionEvents.filter((event) => event.status === 'completed').length;
    const beforeMissedCount = seeded.executionEvents.filter((event) => event.status === 'missed').length;

    const next = computeDerivedState(seeded, {
      type: 'APPLY_RENEGOTIATION_OPTION',
      payload: { optionType: 'EXTEND_DEADLINE' },
    });

    const afterCompletedCount = next.executionEvents.filter((event) => event.status === 'completed').length;
    const afterMissedCount = next.executionEvents.filter((event) => event.status === 'missed').length;
    expect(afterCompletedCount).toBe(beforeCompletedCount);
    expect(afterMissedCount).toBe(beforeMissedCount);
    expect((next.proposedBlocks || []).every((block) => block.status === 'suggested')).toBe(true);
  });

  it('enforces identity lock and does not mutate foreign cycle when payload cycleId is not active', () => {
    const seeded = computeDerivedState(baseState(), { type: 'NO_OP' });
    const foreignBefore = seeded.cyclesById['cycle-foreign'].goalContract.endDayKey;

    const next = computeDerivedState(seeded, {
      type: 'APPLY_RENEGOTIATION_OPTION',
      payload: { cycleId: 'cycle-foreign', optionType: 'EXTEND_DEADLINE' },
    });

    expect(next.cyclesById['cycle-foreign'].goalContract.endDayKey).toBe(foreignBefore);
    expect(next.lastPlanError?.code).toBe('RENEGOTIATION_ACTIVE_CYCLE_MISMATCH');
  });

  it('reports unsupported option honestly without fake mutation', () => {
    const seeded = computeDerivedState(baseState(), { type: 'NO_OP' });
    const beforeEnd = seeded.cyclesById['cycle-reneg-1'].goalContract.endDayKey;

    const next = computeDerivedState(seeded, {
      type: 'APPLY_RENEGOTIATION_OPTION',
      payload: { optionType: 'REDUCE_SCOPE' },
    });

    const cycle = next.cyclesById['cycle-reneg-1'];
    expect(cycle.goalContract.endDayKey).toBe(beforeEnd);
    expect(cycle.lastRenegotiationApplied?.status).toBe('UNSUPPORTED');
    expect(next.lastPlanError?.code).toBe('RENEGOTIATION_OPTION_UNSUPPORTED');
  });

  it('moves failure trajectory toward recoverable after valid renegotiation when arithmetic allows', () => {
    const seeded = computeDerivedState(baseState(), { type: 'NO_OP' });
    const beforeFailureState = seeded.cyclesById['cycle-reneg-1']?.metrics?.contractFailureState;

    const next = computeDerivedState(seeded, {
      type: 'APPLY_RENEGOTIATION_OPTION',
      payload: { optionType: 'EXTEND_DEADLINE' },
    });
    const afterFailureState = next.cyclesById['cycle-reneg-1']?.metrics?.contractFailureState;

    expect([
      'OVERLOADED_CURRENT_CONTRACT',
      'INFEASIBLE_CURRENT_CONTRACT',
      'DEADLINE_FAILED_RENEGOTIATION_REQUIRED',
    ]).toContain(beforeFailureState);
    expect(afterFailureState).not.toBe('DEADLINE_FAILED_RENEGOTIATION_REQUIRED');
  });
});
