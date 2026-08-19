import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

const DAY = '2026-03-09';

function buildState() {
  const cycleId = 'cycle-legacy-1';
  return {
    vector: { day: 1, direction: '', stability: 'steady', drift: 'contained', momentum: 'active' },
    lenses: {
      aim: { description: '', horizon: '90d', narrative: '' },
      pattern: { routines: { Body: [], Resources: [], Creation: [], Focus: [] }, dailyTargets: [], defaultMinutes: 30 },
      flow: { streams: [] },
    },
    today: { date: DAY, blocks: [] },
    currentWeek: { weekStart: DAY, days: [] },
    cycle: [],
    viewDate: DAY,
    templates: { objectives: {} },
    stability: {},
    recurringPatterns: [],
    executionEvents: [],
    ledger: [],
    appTime: { timeZone: 'UTC', nowISO: `${DAY}T12:00:00.000Z`, activeDayKey: DAY, isFollowingNow: true },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'Active',
        goalContract: { goalId: 'goal-legacy-1' },
        goalGovernanceContract: {
          goalId: 'goal-legacy-1',
          activeFromISO: `${DAY}T00:00:00.000Z`,
          activeUntilISO: '2026-04-01T00:00:00.000Z',
          governance: {
            suggestionsEnabled: true,
            probabilityEnabled: true,
            minEvidenceEvents: 0,
            cooldowns: { resuggestMinutes: 30, maxSuggestionsPerDay: 6 },
          },
          constraints: {
            forbiddenDirectives: [],
            maxActiveBlocks: 6,
          },
          scope: {
            domainsAllowed: ['Body', 'Focus', 'Creation', 'Resources'],
            timeHorizon: 'week',
            timezone: 'UTC',
          },
        },
        actions: [],
        llmActionGraph: null,
      },
    },
    activeCycleId: cycleId,
    deliverablesByCycleId: {
      [cycleId]: {
        cycleId,
        deliverables: [
          { id: 'd1', title: 'Landing page', estimateMin: 60 },
          { id: 'd2', title: 'Email sequence', estimateMin: 90 },
        ],
        suggestionLinks: {},
        lastUpdatedAtISO: `${DAY}T12:00:00.000Z`,
      },
    },
    goalAdmissionByGoal: { 'goal-legacy-1': { status: 'ADMITTED', reasonCodes: [] } },
    lastPlanError: null,
  };
}

describe('execution graph readiness normalization', () => {
  it('self-heals legacy cycle with deliverables but missing actions', () => {
    const next = computeDerivedState(buildState(), { type: 'NO_OP' });
    const cycle = next.cyclesById?.[next.activeCycleId];
    expect(cycle).toBeTruthy();
    expect(cycle.executionGraphReady).toBe(true);
    expect(Array.isArray(cycle.actions)).toBe(true);
    expect(cycle.actions.length).toBeGreaterThan(0);
    expect(cycle.actions[0].actionType).toBe('execution');
    expect(Array.isArray(cycle.actions[0].dependencies)).toBe(true);
    expect(next.lastPlanError?.code).not.toBe('ACTION_GRAPH_MISSING');
  });
});
