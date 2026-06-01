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

function makeState({
  nowISO = '2026-03-10T12:00:00.000Z',
  deadlineDayKey = '2026-04-30',
  goalWorkRemaining = 8,
  cycleEvents = [],
  maxBlocksPerDay = 2,
  maxMinutesPerDay,
} = {}) {
  const cycleId = 'cycle-recovery-1';
  const goalId = 'goal-recovery-1';
  const dayKey = nowISO.slice(0, 10);
  const constraints = {
    maxBlocksPerDay,
    weeklyWindows: {
      MON: [{ startHHMM: '09:00', endHHMM: '11:00' }],
      TUE: [{ startHHMM: '09:00', endHHMM: '11:00' }],
      WED: [{ startHHMM: '09:00', endHHMM: '11:00' }],
      THU: [{ startHHMM: '09:00', endHHMM: '11:00' }],
      FRI: [{ startHHMM: '09:00', endHHMM: '11:00' }],
    },
  };
  if (Number.isFinite(maxMinutesPerDay)) {
    constraints.maxMinutesPerDay = maxMinutesPerDay;
  }

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
    constraints,
    goalWorkById: {
      [goalId]: [{ workItemId: 'w1', blocksRemaining: goalWorkRemaining }],
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

function metricsFor(state) {
  const next = computeDerivedState(state, { type: 'NO_OP' });
  return next.cyclesById['cycle-recovery-1']?.metrics || {};
}

describe('recovery / renegotiation engine', () => {
  it('registers recovery within current contract when burden can be absorbed', () => {
    const metrics = metricsFor(
      makeState({
        goalWorkRemaining: 6,
        cycleEvents: [
          makeCreateEvent({
            id: 'missed-1',
            cycleId: 'cycle-recovery-1',
            goalId: 'goal-recovery-1',
            startISO: '2026-03-09T09:00:00.000Z',
            endISO: '2026-03-09T10:00:00.000Z',
            status: 'planned',
          }),
        ],
      })
    );

    expect(metrics.recoveryState).toBe('RECOVERY_WITHIN_CONTRACT');
    expect(metrics.renegotiationRequired).toBe(false);
    expect(metrics.recoveryReasons).toContain('RECOVERY_WITHIN_CONTRACT');
  });

  it('flags recovery consumes all slack when fit leaves zero slack', () => {
    const metrics = metricsFor(
      makeState({
        nowISO: '2026-03-10T12:00:00.000Z',
        deadlineDayKey: '2026-03-12',
        goalWorkRemaining: 6,
      })
    );

    expect(metrics.recoveryState).toBe('RECOVERY_WITHIN_CONTRACT');
    expect(metrics.recoveryReasons).toContain('RECOVERY_CONSUMES_ALL_SLACK');
    expect(metrics.recoveryMetrics?.projectedSlackAfterRecovery).toBe(0);
  });

  it('detects overload when recovery exceeds max blocks/day', () => {
    const metrics = metricsFor(
      makeState({
        deadlineDayKey: '2026-03-14',
        goalWorkRemaining: 18,
      })
    );

    expect(metrics.recoveryMetrics?.overloadDetected).toBe(true);
    expect(metrics.recoveryMetrics?.overloadReasonCodes).toContain('RECOVERY_OVER_MAX_BLOCKS_PER_DAY');
    expect(metrics.renegotiationRequired).toBe(true);
  });

  it('detects overload when recovery exceeds max minutes/day', () => {
    const metrics = metricsFor(
      makeState({
        deadlineDayKey: '2026-03-14',
        goalWorkRemaining: 4,
        maxMinutesPerDay: 30,
        cycleEvents: [
          makeCreateEvent({
            id: 'blk-1',
            cycleId: 'cycle-recovery-1',
            goalId: 'goal-recovery-1',
            startISO: '2026-03-10T09:00:00.000Z',
            endISO: '2026-03-10T10:00:00.000Z',
            status: 'planned',
          }),
        ],
      })
    );

    expect(metrics.recoveryMetrics?.overloadDetected).toBe(true);
    expect(metrics.recoveryMetrics?.overloadReasonCodes).toContain('RECOVERY_OVER_MINUTES_PER_DAY');
  });

  it('surfaces deadline extension option when current deadline cannot absorb recovery', () => {
    const metrics = metricsFor(
      makeState({
        nowISO: '2026-05-20T12:00:00.000Z',
        deadlineDayKey: '2026-04-30',
        goalWorkRemaining: 6,
      })
    );

    const types = (metrics.renegotiationOptions || []).map((option) => option.type);
    expect(types).toContain('EXTEND_DEADLINE');
  });

  it('surfaces throughput increase option when overload persists', () => {
    const metrics = metricsFor(
      makeState({
        deadlineDayKey: '2026-03-14',
        goalWorkRemaining: 18,
      })
    );

    const types = (metrics.renegotiationOptions || []).map((option) => option.type);
    expect(types).toContain('INCREASE_THROUGHPUT');
  });

  it('surfaces scope reduction option when overload persists', () => {
    const metrics = metricsFor(
      makeState({
        deadlineDayKey: '2026-03-14',
        goalWorkRemaining: 18,
      })
    );

    const types = (metrics.renegotiationOptions || []).map((option) => option.type);
    expect(types).toContain('REDUCE_SCOPE');
  });

  it('keeps recovery analysis identity-isolated to active cycle/goal', () => {
    const metrics = metricsFor(
      makeState({
        goalWorkRemaining: 6,
        cycleEvents: [
          makeCreateEvent({
            id: 'foreign-expired',
            cycleId: 'cycle-foreign',
            goalId: 'goal-foreign',
            startISO: '2026-03-01T09:00:00.000Z',
            endISO: '2026-03-01T10:00:00.000Z',
            status: 'expired',
          }),
        ],
      })
    );

    expect(metrics.recoveryMetrics?.missedExpiredBurden).toBe(0);
    expect(metrics.recoveryState).toBe('RECOVERY_WITHIN_CONTRACT');
  });
});
