import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function makeEvent({ id, cycleId, goalId, startISO, endISO, status = 'planned', completed = false, domain }) {
  const minutes = Math.max(1, Math.round((Date.parse(endISO) - Date.parse(startISO)) / 60000));
  return {
    id: `evt:${id}`,
    blockId: id,
    dateISO: startISO.slice(0, 10),
    minutes,
    rawLabel: `Task ${id}`,
    domain,
    cycleId,
    goalId,
    completed,
    kind: 'create',
    startISO,
    endISO,
    status,
  };
}

function buildState(domainValue) {
  const cycleId = 'cycle-category-independence';
  const goalId = 'goal-category-independence';
  return {
    appTime: { timeZone: 'UTC', nowISO: '2026-03-10T12:00:00.000Z', activeDayKey: '2026-03-10', isFollowingNow: true },
    today: { date: '2026-03-10', blocks: [] },
    currentWeek: { weekStart: '2026-03-10', days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [
      makeEvent({
        id: 'completed-1',
        cycleId,
        goalId,
        startISO: '2026-03-08T09:00:00.000Z',
        endISO: '2026-03-08T10:00:00.000Z',
        status: 'completed',
        completed: true,
        domain: domainValue,
      }),
      makeEvent({
        id: 'missed-1',
        cycleId,
        goalId,
        startISO: '2026-03-09T09:00:00.000Z',
        endISO: '2026-03-09T10:00:00.000Z',
        status: 'missed',
        completed: false,
        domain: domainValue,
      }),
    ],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    constraints: { maxBlocksPerDay: 2, maxBlocksPerWeek: 8, maxMinutesPerDay: 120 },
    goalWorkById: { [goalId]: [{ workItemId: 'w1', title: 'Work', blocksRemaining: 10 }] },
    deliverablesByCycleId: {
      [cycleId]: {
        cycleId,
        deliverables: [{ id: 'd1', title: 'Deliverable', estimateMin: 60 }],
        suggestionLinks: {},
        lastUpdatedAtISO: '2026-03-10T12:00:00.000Z',
      },
    },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-03-31' },
        goalGovernanceContract: {
          contractId: `gov-${goalId}`,
          version: 1,
          goalId,
          activeFromISO: '2026-03-01',
          activeUntilISO: '2026-03-31',
          scope: { timezone: 'UTC' },
          governance: { suggestionsEnabled: true, probabilityEnabled: true, minEvidenceEvents: 0 },
        },
        actions: [{ id: 'a-1', title: 'Action 1', estimateMin: 60 }],
        planProof: {},
        metrics: {},
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-03-31' },
    lastPlanError: null,
  };
}

function projection(metrics = {}) {
  return {
    posScore: metrics.posScore ?? null,
    feasibilityScore: metrics.feasibilityScore ?? null,
    requiredWeeklyThroughput: metrics.requiredWeeklyThroughput ?? null,
    contractFailureState: metrics.contractFailureState ?? null,
    recoveryState: metrics.recoveryState ?? null,
    renegotiationRequired: metrics.renegotiationRequired ?? null,
    dynamicOutcome: metrics.dynamicOutcome ?? null,
  };
}

describe('scoring/failure/recovery category independence', () => {
  it('produces the same canonical trajectory metrics regardless of legacy domain taxonomy values', () => {
    const focusState = computeDerivedState(buildState('Focus'), { type: 'NO_OP' });
    const bodyState = computeDerivedState(buildState('Body'), { type: 'NO_OP' });
    const nullDomainState = computeDerivedState(buildState(undefined), { type: 'NO_OP' });

    const cycleId = 'cycle-category-independence';
    const focusMetrics = projection(focusState.cyclesById?.[cycleId]?.metrics || {});
    const bodyMetrics = projection(bodyState.cyclesById?.[cycleId]?.metrics || {});
    const nullDomainMetrics = projection(nullDomainState.cyclesById?.[cycleId]?.metrics || {});

    expect(bodyMetrics).toEqual(focusMetrics);
    expect(nullDomainMetrics).toEqual(focusMetrics);
  });
});
