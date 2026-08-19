import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function makeCreateEvent({ id, cycleId, goalId, startISO, endISO, status = 'planned', completed = false }) {
  const minutes = Math.max(1, Math.round((Date.parse(endISO) - Date.parse(startISO)) / 60000));
  return {
    id: `evt:create:${id}`,
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

function makeState({
  nowISO = '2026-03-10T12:00:00.000Z',
  deadlineDayKey = '2026-04-30',
  goalWorkRemaining = 8,
  cycleEvents = [],
} = {}) {
  const cycleId = 'cycle-contract-1';
  const goalId = 'goal-contract-1';
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

function contractStateOf(state) {
  const next = computeDerivedState(state, { type: 'NO_OP' });
  return next.cyclesById['cycle-contract-1']?.metrics || {};
}

describe('contract failure registration', () => {
  it('registers ON_TRACK when burden fits current contract', () => {
    const metrics = contractStateOf(makeState({ goalWorkRemaining: 6 }));
    expect(metrics.contractFailureState).toBe('ON_TRACK');
    expect(metrics.contractRenegotiationRequired).toBe(false);
  });

  it('registers RECOVERABLE_DRIFT when missed work exists but still fits contract', () => {
    const metrics = contractStateOf(
      makeState({
        goalWorkRemaining: 6,
        cycleEvents: [
          makeCreateEvent({
            id: 'missed-1',
            cycleId: 'cycle-contract-1',
            goalId: 'goal-contract-1',
            startISO: '2026-03-09T09:00:00.000Z',
            endISO: '2026-03-09T10:00:00.000Z',
            status: 'planned',
          }),
        ],
      })
    );

    expect(metrics.contractFailureState).toBe('RECOVERABLE_DRIFT');
    expect(metrics.contractRenegotiationRequired).toBe(false);
  });

  it('registers OVERLOADED_CURRENT_CONTRACT when required weekly throughput exceeds active capacity', () => {
    const overloadedEvents = Array.from({ length: 20 }, (_, i) =>
      makeCreateEvent({
        id: `overdue-${i + 1}`,
        cycleId: 'cycle-contract-1',
        goalId: 'goal-contract-1',
        startISO: '2026-03-01T09:00:00.000Z',
        endISO: '2026-03-01T10:00:00.000Z',
        status: 'planned',
      })
    );
    const metrics = contractStateOf(
      makeState({
        goalWorkRemaining: 8,
        deadlineDayKey: '2026-03-15',
        cycleEvents: overloadedEvents,
      })
    );

    expect(metrics.contractFailureState).toBe('OVERLOADED_CURRENT_CONTRACT');
    expect(metrics.contractRenegotiationRequired).toBe(true);
    expect(metrics.contractFailureReasons).toContain('REQUIRED_THROUGHPUT_EXCEEDS_CONTRACT_CAPACITY');
  });

  it('registers INFEASIBLE_CURRENT_CONTRACT before deadline when burden cannot fit', () => {
    const metrics = contractStateOf(makeState({ goalWorkRemaining: 120, deadlineDayKey: '2026-03-31' }));
    expect(metrics.contractFailureState).toBe('INFEASIBLE_CURRENT_CONTRACT');
    expect(metrics.contractRenegotiationRequired).toBe(true);
  });

  it('registers DEADLINE_FAILED_RENEGOTIATION_REQUIRED when deadline passed with work remaining', () => {
    const metrics = contractStateOf(
      makeState({ nowISO: '2026-05-20T12:00:00.000Z', deadlineDayKey: '2026-04-30', goalWorkRemaining: 4 })
    );

    expect(metrics.contractFailureState).toBe('DEADLINE_FAILED_RENEGOTIATION_REQUIRED');
    expect(metrics.contractRenegotiationRequired).toBe(true);
    expect(metrics.contractFailureReasons).toContain('DEADLINE_PASSED_WITH_REMAINING_WORK');
  });

  it('keeps contract failure registration identity-isolated to active cycle/goal', () => {
    const metrics = contractStateOf(
      makeState({
        goalWorkRemaining: 6,
        cycleEvents: [
          makeCreateEvent({
            id: 'foreign-expired',
            cycleId: 'cycle-other',
            goalId: 'goal-other',
            startISO: '2026-03-01T09:00:00.000Z',
            endISO: '2026-03-01T10:00:00.000Z',
            status: 'expired',
          }),
        ],
      })
    );

    expect(metrics.contractFailureState).toBe('ON_TRACK');
  });
});
