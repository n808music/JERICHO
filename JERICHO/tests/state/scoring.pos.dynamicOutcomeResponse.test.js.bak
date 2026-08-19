import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function makeCreateEvent({
  id,
  cycleId,
  goalId,
  startISO,
  endISO,
  status = 'planned',
  completed = false,
  title = 'Draft podcast episode outline',
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

function buildState({
  nowISO = '2026-03-10T12:00:00.000Z',
  cycleEvents = [],
  goalWorkRemaining = 8,
  deadlineDayKey = '2026-04-30',
} = {}) {
  const cycleId = 'cycle-pos-dynamic';
  const goalId = 'goal-tv';
  const dayKey = nowISO.slice(0, 10);
  return {
    appTime: { nowISO, activeDayKey: dayKey, timeZone: 'UTC', isFollowingNow: true },
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: cycleEvents.map((event) => ({ ...event })),
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: {
      maxBlocksPerDay: 2,
      weeklyWindows: {
        MON: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        TUE: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        WED: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        THU: [{ startHHMM: '09:00', endHHMM: '11:00' }],
        FRI: [{ startHHMM: '09:00', endHHMM: '11:00' }],
      },
    },
    goalWorkById: {
      [goalId]: [{ workItemId: 'w1', title: 'Episode work', blocksRemaining: goalWorkRemaining }],
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
        executionEvents: cycleEvents.map((event) => ({ ...event })),
        metrics: {},
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: deadlineDayKey },
    lastPlanError: null,
  };
}

function scoreOf(state) {
  const next = computeDerivedState(state, { type: 'NO_OP' });
  return next.cyclesById['cycle-pos-dynamic']?.metrics || {};
}

describe('POS dynamic outcome response', () => {
  it('completed evidence maintains or improves score vs equivalent missed evidence', () => {
    const completedMetrics = scoreOf(
      buildState({
        cycleEvents: [
          makeCreateEvent({
            id: 'blk-1',
            cycleId: 'cycle-pos-dynamic',
            goalId: 'goal-tv',
            startISO: '2026-03-09T09:00:00.000Z',
            endISO: '2026-03-09T10:00:00.000Z',
            status: 'completed',
            completed: true,
          }),
        ],
      })
    );

    const missedMetrics = scoreOf(
      buildState({
        cycleEvents: [
          makeCreateEvent({
            id: 'blk-1',
            cycleId: 'cycle-pos-dynamic',
            goalId: 'goal-tv',
            startISO: '2026-03-09T09:00:00.000Z',
            endISO: '2026-03-09T10:00:00.000Z',
            status: 'planned',
          }),
        ],
      })
    );

    expect(completedMetrics.posScore).toBeGreaterThanOrEqual(missedMetrics.posScore);
  });

  it('missed evidence lowers POS relative to all-future planned schedule', () => {
    const baseline = scoreOf(
      buildState({
        cycleEvents: [
          makeCreateEvent({
            id: 'blk-future',
            cycleId: 'cycle-pos-dynamic',
            goalId: 'goal-tv',
            startISO: '2026-03-20T09:00:00.000Z',
            endISO: '2026-03-20T10:00:00.000Z',
            status: 'planned',
          }),
        ],
      })
    );

    const withMiss = scoreOf(
      buildState({
        cycleEvents: [
          makeCreateEvent({
            id: 'blk-past',
            cycleId: 'cycle-pos-dynamic',
            goalId: 'goal-tv',
            startISO: '2026-03-09T09:00:00.000Z',
            endISO: '2026-03-09T10:00:00.000Z',
            status: 'planned',
          }),
        ],
      })
    );

    expect(withMiss.posScore).toBeLessThan(baseline.posScore);
    expect(withMiss.dynamicOutcome?.missedBlocks).toBeGreaterThan(0);
  });

  it('expired evidence lowers POS further and marks terminal reason code', () => {
    const withMiss = scoreOf(
      buildState({
        cycleEvents: [
          makeCreateEvent({
            id: 'blk-past',
            cycleId: 'cycle-pos-dynamic',
            goalId: 'goal-tv',
            startISO: '2026-03-08T09:00:00.000Z',
            endISO: '2026-03-08T10:00:00.000Z',
            status: 'planned',
          }),
        ],
      })
    );

    const withExpired = scoreOf(
      buildState({
        cycleEvents: [
          makeCreateEvent({
            id: 'blk-expired',
            cycleId: 'cycle-pos-dynamic',
            goalId: 'goal-tv',
            startISO: '2026-03-01T09:00:00.000Z',
            endISO: '2026-03-01T10:00:00.000Z',
            status: 'expired',
          }),
        ],
      })
    );

    expect(withExpired.posScore).toBeLessThanOrEqual(withMiss.posScore);
    const reasonCodes = (withExpired.posExplanation?.reasons || []).map((reason) => reason?.code);
    expect(reasonCodes).toContain('POS_TERMINAL_DRIFT_EXPIRED');
  });

  it('required weekly throughput rises as time shrinks for same burden', () => {
    const early = scoreOf(
      buildState({ nowISO: '2026-03-10T12:00:00.000Z', goalWorkRemaining: 28, deadlineDayKey: '2026-04-30' })
    );
    const late = scoreOf(
      buildState({ nowISO: '2026-04-20T12:00:00.000Z', goalWorkRemaining: 28, deadlineDayKey: '2026-04-30' })
    );

    expect(late.requiredWeeklyThroughput).toBeGreaterThan(early.requiredWeeklyThroughput);
  });

  it('classifies recoverable drift versus terminal drift', () => {
    const recoverable = scoreOf(
      buildState({
        cycleEvents: [
          makeCreateEvent({
            id: 'blk-rec',
            cycleId: 'cycle-pos-dynamic',
            goalId: 'goal-tv',
            startISO: '2026-03-09T09:00:00.000Z',
            endISO: '2026-03-09T10:00:00.000Z',
            status: 'planned',
          }),
        ],
      })
    );
    const terminal = scoreOf(
      buildState({
        cycleEvents: [
          makeCreateEvent({
            id: 'blk-term',
            cycleId: 'cycle-pos-dynamic',
            goalId: 'goal-tv',
            startISO: '2026-03-01T09:00:00.000Z',
            endISO: '2026-03-01T10:00:00.000Z',
            status: 'expired',
          }),
        ],
      })
    );

    expect(recoverable.dynamicOutcome?.trajectory).toBe('RECOVERABLE_DRIFT');
    expect(['AT_RISK', 'INFEASIBLE_TRAJECTORY']).toContain(terminal.dynamicOutcome?.trajectory);
  });

  it('keeps dynamic scoring identity-isolated to active cycle/goal', () => {
    const activeEvent = makeCreateEvent({
      id: 'blk-active',
      cycleId: 'cycle-pos-dynamic',
      goalId: 'goal-tv',
      startISO: '2026-03-20T09:00:00.000Z',
      endISO: '2026-03-20T10:00:00.000Z',
      status: 'planned',
    });
    const foreignEvent = makeCreateEvent({
      id: 'blk-foreign',
      cycleId: 'cycle-other',
      goalId: 'goal-other',
      startISO: '2026-03-01T09:00:00.000Z',
      endISO: '2026-03-01T10:00:00.000Z',
      status: 'expired',
    });

    const metrics = scoreOf(buildState({ cycleEvents: [activeEvent, foreignEvent] }));
    expect(metrics.dynamicOutcome?.expiredBlocks).toBe(0);
    expect(metrics.dynamicOutcome?.trajectory).toBe('ON_TRACK');
  });

  it('emits deterministic trajectory reason codes in explanation', () => {
    const metrics = scoreOf(
      buildState({
        cycleEvents: [
          makeCreateEvent({
            id: 'blk-past',
            cycleId: 'cycle-pos-dynamic',
            goalId: 'goal-tv',
            startISO: '2026-03-09T09:00:00.000Z',
            endISO: '2026-03-09T10:00:00.000Z',
            status: 'planned',
          }),
        ],
      })
    );

    const reasonCodes = (metrics.posExplanation?.reasons || []).map((reason) => reason?.code);
    expect(reasonCodes.some((code) => String(code || '').startsWith('POS_TRAJECTORY_'))).toBe(true);
  });
});
