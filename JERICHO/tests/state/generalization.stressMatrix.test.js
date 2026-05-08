import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: () => ({
    horizonBlocks: [
      {
        id: 'hb-stress-1',
        title: 'Stress block',
        dayKey: '2026-03-11',
        startISO: '2026-03-11T09:00:00.000Z',
        durationMinutes: 60,
      },
    ],
    conflicts: [],
  }),
}));

function makeEvent({ id, cycleId, goalId, startISO, endISO, status = 'planned', completed = false }) {
  const minutes = Math.max(1, Math.round((Date.parse(endISO) - Date.parse(startISO)) / 60000));
  return {
    id: `evt:${id}`,
    blockId: id,
    dateISO: startISO.slice(0, 10),
    minutes,
    rawLabel: 'Draft podcast episode outline',
    title: 'Draft podcast episode outline',
    domain: 'Focus',
    cycleId,
    goalId,
    deliverableId: 'd1',
    actionId: 'act-1',
    completed,
    kind: 'create',
    startISO,
    endISO,
    status,
  };
}

function buildStressState({
  nowISO = '2026-03-10T12:00:00.000Z',
  deadlineDayKey = '2026-03-14',
  goalWorkRemaining = 12,
  maxBlocksPerDay = 1,
  maxMinutesPerDay = 60,
  executionEvents = [],
} = {}) {
  const cycleId = 'cycle-stress-1';
  const goalId = 'goal-stress-1';
  return {
    appTime: { timeZone: 'UTC', nowISO, activeDayKey: nowISO.slice(0, 10), isFollowingNow: true },
    today: { date: nowISO.slice(0, 10), blocks: [] },
    currentWeek: { weekStart: nowISO.slice(0, 10), days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: executionEvents.map((event) => ({ ...event })),
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: { maxBlocksPerDay, maxBlocksPerWeek: maxBlocksPerDay * 5, maxMinutesPerDay },
    goalWorkById: {
      [goalId]: [{ workItemId: 'w1', title: 'Work', blocksRemaining: goalWorkRemaining }],
    },
    deliverablesByCycleId: {
      [cycleId]: {
        cycleId,
        deliverables: [{ id: 'd1', title: 'Draft podcast episode', estimateMin: 60, actionIds: ['act-1'] }],
        suggestionLinks: {},
        lastUpdatedAtISO: nowISO,
      },
    },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId, startDayKey: '2026-03-01', endDayKey: deadlineDayKey },
        goalGovernanceContract: {
          contractId: `gov-${goalId}`,
          version: 1,
          goalId,
          activeFromISO: '2026-03-01',
          activeUntilISO: deadlineDayKey,
          scope: { timezone: 'UTC' },
          governance: { suggestionsEnabled: true, probabilityEnabled: true, minEvidenceEvents: 0 },
        },
        actions: [{ id: 'act-1', title: 'Draft podcast episode outline', deliverableId: 'd1', estimateMin: 60 }],
        planProof: {},
        metrics: {},
      },
      'cycle-foreign': {
        id: 'cycle-foreign',
        status: 'active',
        goalContract: { goalId: 'goal-foreign', startDayKey: '2026-03-01', endDayKey: '2026-04-30' },
        metrics: {},
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: deadlineDayKey },
    lastPlanError: null,
  };
}

describe('generalization stress matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers overload/infeasibility for too-tight deadlines and low capacity', () => {
    const next = computeDerivedState(buildStressState({}), { type: 'NO_OP' });
    const metrics = next.cyclesById['cycle-stress-1']?.metrics || {};

    expect(['OVERLOADED_CURRENT_CONTRACT', 'INFEASIBLE_CURRENT_CONTRACT']).toContain(metrics.contractFailureState);
    expect(metrics.renegotiationRequired).toBe(true);
  });

  it('degrades POS when repeated misses accumulate', () => {
    const cycleId = 'cycle-stress-1';
    const goalId = 'goal-stress-1';
    const clean = computeDerivedState(buildStressState({ executionEvents: [] }), { type: 'NO_OP' });
    const missed = computeDerivedState(
      buildStressState({
        executionEvents: [
          makeEvent({
            id: 'missed-1',
            cycleId,
            goalId,
            startISO: '2026-03-09T09:00:00.000Z',
            endISO: '2026-03-09T10:00:00.000Z',
            status: 'missed',
          }),
          makeEvent({
            id: 'missed-2',
            cycleId,
            goalId,
            startISO: '2026-03-08T09:00:00.000Z',
            endISO: '2026-03-08T10:00:00.000Z',
            status: 'missed',
          }),
        ],
      }),
      { type: 'NO_OP' }
    );

    const cleanScore =
      clean.cyclesById[cycleId]?.metrics?.posScore ?? clean.cyclesById[cycleId]?.metrics?.feasibilityScore ?? 0;
    const missedScore =
      missed.cyclesById[cycleId]?.metrics?.posScore ?? missed.cyclesById[cycleId]?.metrics?.feasibilityScore ?? 0;
    expect(missedScore).toBeLessThanOrEqual(cleanScore);
  });

  it('registers deadline-failed state when deadline passes with work remaining', () => {
    const next = computeDerivedState(
      buildStressState({
        nowISO: '2026-03-20T12:00:00.000Z',
        deadlineDayKey: '2026-03-14',
        goalWorkRemaining: 6,
      }),
      { type: 'NO_OP' }
    );
    expect(next.cyclesById['cycle-stress-1']?.metrics?.contractFailureState).toBe(
      'DEADLINE_FAILED_RENEGOTIATION_REQUIRED'
    );
  });

  it('can improve trajectory after renegotiation apply when deadline is extended', () => {
    const scored = computeDerivedState(buildStressState({}), { type: 'NO_OP' });
    const next = computeDerivedState(scored, {
      type: 'APPLY_RENEGOTIATION_OPTION',
      payload: { optionType: 'EXTEND_DEADLINE' },
    });

    const metrics = next.cyclesById['cycle-stress-1']?.metrics || {};
    expect(next.cyclesById['cycle-stress-1']?.lastRenegotiationApplied?.status).toBe('APPLIED');
    expect(metrics.contractFailureState).not.toBe('DEADLINE_FAILED_RENEGOTIATION_REQUIRED');
  });

  it('can clear overload after throughput renegotiation when the option expands capacity enough', () => {
    const scored = computeDerivedState(
      buildStressState({
        goalWorkRemaining: 240,
        deadlineDayKey: '2026-03-16',
        maxBlocksPerDay: 1,
        maxMinutesPerDay: 30,
      }),
      { type: 'NO_OP' }
    );
    const next = computeDerivedState(scored, {
      type: 'APPLY_RENEGOTIATION_OPTION',
      payload: { optionType: 'INCREASE_THROUGHPUT' },
    });
    const metrics = next.cyclesById['cycle-stress-1']?.metrics || {};
    expect(next.cyclesById['cycle-stress-1']?.lastRenegotiationApplied?.status).toBe('APPLIED');
    expect(metrics.renegotiationRequired).toBe(false);
  });

  it('blocks stale cross-cycle renegotiation mutation attempts', () => {
    const scored = computeDerivedState(buildStressState({}), { type: 'NO_OP' });
    const foreignBefore = scored.cyclesById['cycle-foreign']?.goalContract?.endDayKey;
    const next = computeDerivedState(scored, {
      type: 'APPLY_RENEGOTIATION_OPTION',
      payload: { cycleId: 'cycle-foreign', optionType: 'EXTEND_DEADLINE' },
    });
    expect(next.lastPlanError?.code).toBe('RENEGOTIATION_ACTIVE_CYCLE_MISMATCH');
    expect(next.cyclesById['cycle-foreign']?.goalContract?.endDayKey).toBe(foreignBefore);
  });
});
