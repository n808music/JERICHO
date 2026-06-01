import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

const compileAutoAsanaPlanMock = vi.fn();

vi.mock('../../src/state/engine/autoAsanaPlan.ts', () => ({
  compileAutoAsanaPlan: (...args) => compileAutoAsanaPlanMock(...args),
}));

function governanceContract(goalId) {
  return {
    contractId: `gov-${goalId}`,
    version: 1,
    goalId,
    activeFromISO: '2026-01-01',
    activeUntilISO: '2026-12-31',
    scope: { timezone: 'UTC' },
    governance: { suggestionsEnabled: true, probabilityEnabled: true, minEvidenceEvents: 0 },
  };
}

function baseState(overrides = {}) {
  const dayKey = '2026-03-10';
  const cycleId = 'cycle-pos-1';
  const goalId = 'goal-canonical';
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
    constraints: { maxBlocksPerDay: 2, weeklyWindows: { MON: [{ startHHMM: '09:00', endHHMM: '11:00' }] } },
    goalWorkById: {},
    deliverablesByCycleId: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId, startDayKey: dayKey, endDayKey: '2026-03-31' },
        contract: { goalId: 'goal-adapter', endDayKey: '2026-03-01' },
        goalGovernanceContract: governanceContract(goalId),
        actions: [
          { id: 'act-canonical', title: 'Draft podcast episode outline', deliverableId: 'd1', estimateMin: 60 },
        ],
        llmActionGraph: {
          actions: [{ id: 'act-mirror', title: 'Draft stale mirror episode outline', estimateMin: 60 }],
        },
        planProof: {},
        metrics: {},
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId: 'goal-mirror', startDayKey: dayKey, endDayKey: '2026-03-01' },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    lastPlanError: null,
    ...overrides,
  };
}

describe('POS canonical chain scoring', () => {
  beforeEach(() => {
    compileAutoAsanaPlanMock.mockReset();
  });

  it('uses canonical contract and canonical actions for scoring inputs', () => {
    const state = baseState({
      goalWorkById: {
        'goal-canonical': [{ workItemId: 'w1', blocksRemaining: 2 }],
      },
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const metrics = next.cyclesById['cycle-pos-1']?.metrics || {};

    expect(metrics.posInputs?.goalIdUsed).toBe('goal-canonical');
    expect(metrics.posInputs?.actionCount).toBe(1);
    expect(metrics.posInputs?.hasThroughputModel).toBe(true);
  });

  it('emits deterministic reason code when throughput model is absent', () => {
    const state = baseState({
      cyclesById: {
        'cycle-pos-1': {
          id: 'cycle-pos-1',
          status: 'active',
          goalContract: { goalId: 'goal-canonical', startDayKey: '2026-03-10', endDayKey: '2026-03-31' },
          goalGovernanceContract: governanceContract('goal-canonical'),
          actions: [],
          llmActionGraph: null,
          proposedBlocks: [],
          suggestedBlocks: [],
          metrics: {},
        },
      },
      deliverablesByCycleId: {},
      goalWorkById: {},
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const reasons = next.cyclesById['cycle-pos-1']?.metrics?.posExplanation?.reasons || [];

    expect(next.cyclesById['cycle-pos-1']?.metrics?.posScore).toBeNull();
    expect(reasons[0]?.code).toBe('POS_THROUGHPUT_MODEL_MISSING');
  });

  it('produces non-placeholder POS after canonical generate path', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-1',
          title: 'Draft podcast episode outline',
          deliverableId: 'd1',
          actionId: 'act-canonical',
          dayKey: '2026-03-11',
          startISO: '2026-03-11T09:00:00.000Z',
          durationMinutes: 60,
          blockType: 'execution',
          owner: 'maker',
          producesArtifact: 'Podcast episode outline draft for episode 1',
          consumedBy: ['Episode drafting session'],
          passEvidence: 'Episode outline draft exists with opening, segment order, and closing CTA',
          consumedByRef: { type: 'terminalOutcome', id: 'goal-canonical' },
        },
      ],
      conflicts: [],
    });
    const state = baseState({
      goalWorkById: {
        'goal-canonical': [{ workItemId: 'w1', blocksRemaining: 2 }],
      },
      deliverablesByCycleId: {
        'cycle-pos-1': {
          cycleId: 'cycle-pos-1',
          deliverables: [{ id: 'd1', title: 'Draft podcast episode', estimateMin: 60, actionIds: ['act-canonical'] }],
          suggestionLinks: {},
          lastUpdatedAtISO: '2026-03-10T12:00:00.000Z',
        },
      },
    });

    const generated = computeDerivedState(state, { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-pos-1' } });
    const rescored = computeDerivedState(generated, { type: 'NO_OP' });
    const metrics = rescored.cyclesById['cycle-pos-1']?.metrics || {};

    expect((generated.proposedBlocks || []).length).toBeGreaterThan(0);
    expect(Number.isFinite(metrics.posScore)).toBe(true);
    expect(metrics.posExplanation?.reasons?.[0]?.code).not.toBe('POS_NO_PLAN');
  });

  it('reports explicit POS unavailability when generated plan quality is withheld', () => {
    compileAutoAsanaPlanMock.mockReturnValue({
      horizonBlocks: [
        {
          id: 'hb-thin-1',
          title: 'Draft stale outline',
          deliverableId: 'd1',
          actionId: 'act-canonical',
          dayKey: '2026-03-11',
          startISO: '2026-03-11T09:00:00.000Z',
          durationMinutes: 60,
          blockType: 'execution',
        },
      ],
      conflicts: [],
    });
    const state = baseState({
      goalWorkById: {
        'goal-canonical': [{ workItemId: 'w1', blocksRemaining: 2 }],
      },
      deliverablesByCycleId: {
        'cycle-pos-1': {
          cycleId: 'cycle-pos-1',
          deliverables: [{ id: 'd1', title: 'Draft podcast episode', estimateMin: 60, actionIds: ['act-canonical'] }],
          suggestionLinks: {},
          lastUpdatedAtISO: '2026-03-10T12:00:00.000Z',
        },
      },
    });

    const generated = computeDerivedState(state, { type: 'GENERATE_PLAN', payload: { cycleId: 'cycle-pos-1' } });
    const rescored = computeDerivedState(generated, { type: 'NO_OP' });
    const cycle = rescored.cyclesById['cycle-pos-1'];
    const metrics = cycle?.metrics || {};

    expect(cycle?.planQualityGate?.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(cycle?.planQualityGate?.failureCodes?.length).toBeGreaterThan(0);
    expect(metrics.posScore).toBeNull();
    expect(metrics.posUnavailableReasonCode).toBe('POS_NOT_ADMITTED_PLAN_QUALITY_WITHHELD');
  });

  it('falls back to canonical goal contract when governance contract is missing', () => {
    const state = baseState({
      cyclesById: {
        'cycle-pos-1': {
          ...baseState().cyclesById['cycle-pos-1'],
          goalGovernanceContract: null,
        },
      },
      goalWorkById: {
        'goal-canonical': [{ workItemId: 'w1', blocksRemaining: 2 }],
      },
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const metrics = next.cyclesById['cycle-pos-1']?.metrics || {};

    expect(next.probabilityByGoal?.['goal-canonical']).toBeTruthy();
    expect(next.feasibilityByGoal?.['goal-canonical']).toBeTruthy();
    expect(metrics.posInputs?.goalIdUsed).toBe('goal-canonical');
    expect(Number.isFinite(metrics.feasibilityScore)).toBe(true);
  });

  it('overrides stale governance goalId with canonical active goalId for scoring inputs', () => {
    const state = baseState({
      cyclesById: {
        'cycle-pos-1': {
          ...baseState().cyclesById['cycle-pos-1'],
          goalContract: { goalId: 'goal-canonical', startDayKey: '2026-03-10', endDayKey: '2026-04-15' },
          goalGovernanceContract: governanceContract('goal-stale-saas'),
        },
      },
      goalWorkById: {
        'goal-canonical': [{ workItemId: 'w1', blocksRemaining: 3 }],
      },
      goalAdmissionByGoal: { 'goal-canonical': { status: 'ADMITTED', reasonCodes: [] } },
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const feasibility = next.feasibilityByGoal?.['goal-canonical'] || null;
    const metrics = next.cyclesById['cycle-pos-1']?.metrics || {};

    expect(feasibility).toBeTruthy();
    expect(feasibility?.goalId).toBe('goal-canonical');
    expect(metrics.posInputs?.goalIdUsed).toBe('goal-canonical');
  });

  it('forces POS/feasibility to 0 when canonical feasibility reports INFEASIBLE', () => {
    const dayKey = '2026-03-10';
    const state = baseState({
      constraints: { maxBlocksPerDay: 0 },
      cyclesById: {
        'cycle-pos-1': {
          ...baseState().cyclesById['cycle-pos-1'],
          goalContract: { goalId: 'goal-canonical', startDayKey: dayKey, endDayKey: '2026-03-31' },
          metrics: { posScore: 1, feasibilityScore: 1, integrityScore: 1 },
        },
      },
      goalWorkById: {
        'goal-canonical': [{ workItemId: 'w1', blocksRemaining: 10 }],
      },
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const metrics = next.cyclesById['cycle-pos-1']?.metrics || {};
    const feasibility = next.feasibilityByGoal?.['goal-canonical'] || null;
    const probability = next.probabilityByGoal?.['goal-canonical'] || null;

    expect(feasibility?.status).toBe('INFEASIBLE');
    expect(probability?.status).toBe('INFEASIBLE');
    expect(metrics.feasibilityScore).toBe(0);
    expect(metrics.posScore).toBe(0);
  });

  it('derives initial non-dash scoring basis from canonical actions when explicit work items are absent', () => {
    const state = baseState({
      goalWorkById: {},
      cyclesById: {
        'cycle-pos-1': {
          ...baseState().cyclesById['cycle-pos-1'],
          actions: [{ id: 'act-canonical', title: 'Action 1', estimateMin: 60 }],
          metrics: {},
        },
      },
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const metrics = next.cyclesById['cycle-pos-1']?.metrics || {};
    const derivedWorkItems = next.goalWorkById?.['goal-canonical'] || [];

    expect(derivedWorkItems.length).toBeGreaterThan(0);
    expect(Number.isFinite(metrics.feasibilityScore)).toBe(true);
    expect(metrics.posExplanation?.reasons?.[0]?.code).not.toBe('POS_THROUGHPUT_MODEL_MISSING');
  });
});
