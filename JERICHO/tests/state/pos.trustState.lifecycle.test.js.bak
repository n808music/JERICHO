import { describe, it, expect } from 'vitest';
import { scoreGoalSuccessProbability } from '../../src/state/engine/probabilityScore.ts';
import { deriveTrustState } from '../../src/state/engine/probabilityScore.ts';

const GOAL_ID = 'goal-pos-lifecycle';
const NOW_ISO = '2026-03-20T12:00:00.000Z';
const FUTURE_DEADLINE = '2026-06-01';

function activeContract(goalId = GOAL_ID) {
  return {
    contractId: `gov-${goalId}`,
    version: 1,
    goalId,
    activeFromISO: '2026-03-01',
    activeUntilISO: '2026-12-31',
    scope: { domainsAllowed: ['Focus'], timeHorizon: 'week', timezone: 'UTC' },
    // minEvidenceEvents: 0 — scoring permitted from day one of activation.
    // This is the contract shape for POS-003: an activated goal that can show
    // a provisional pre-execution estimate before any blocks are completed.
    governance: { probabilityEnabled: true, minEvidenceEvents: 0 },
  };
}

function activeCycle(goalId = GOAL_ID, overrides = {}) {
  return {
    id: 'cycle-lifecycle',
    status: 'active',
    goalContract: { goalId, startDayKey: '2026-03-01', endDayKey: FUTURE_DEADLINE },
    goalGovernanceContract: activeContract(goalId),
    ...overrides,
  };
}

function baseState(overrides = {}) {
  return {
    activeCycleId: 'cycle-lifecycle',
    cyclesById: {
      'cycle-lifecycle': activeCycle(),
    },
    goalWorkById: {
      [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 5 }],
    },
    executionEvents: [],
    ...overrides,
  };
}

const CONSTRAINTS = { timezone: 'UTC', maxBlocksPerDay: 2, scoringWindowDays: 14 };

// ─── deriveTrustState unit ─────────────────────────────────────────────────

describe('deriveTrustState', () => {
  it('returns withheld for INFEASIBLE regardless of eligibility', () => {
    expect(deriveTrustState('INFEASIBLE', 'computed')).toBe('withheld');
    expect(deriveTrustState('INFEASIBLE', 'disabled')).toBe('withheld');
    expect(deriveTrustState('INFEASIBLE', 'insufficient_evidence')).toBe('withheld');
  });

  it('returns withheld when eligibility is disabled', () => {
    expect(deriveTrustState('NO_EVIDENCE', 'disabled')).toBe('withheld');
    expect(deriveTrustState('INELIGIBLE', 'disabled')).toBe('withheld');
    expect(deriveTrustState('ELIGIBLE', 'disabled')).toBe('withheld');
  });

  it('returns withheld when eligibility is insufficient_evidence', () => {
    expect(deriveTrustState('NO_EVIDENCE', 'insufficient_evidence')).toBe('withheld');
    expect(deriveTrustState('INELIGIBLE', 'insufficient_evidence')).toBe('withheld');
    expect(deriveTrustState('ELIGIBLE', 'insufficient_evidence')).toBe('withheld');
  });

  it('returns provisional for NO_EVIDENCE with computed eligibility', () => {
    expect(deriveTrustState('NO_EVIDENCE', 'computed')).toBe('provisional');
  });

  it('returns provisional for INELIGIBLE', () => {
    expect(deriveTrustState('INELIGIBLE', 'computed')).toBe('provisional');
  });

  it('returns provisional for UNSCHEDULABLE', () => {
    expect(deriveTrustState('UNSCHEDULABLE', 'computed')).toBe('provisional');
  });

  it('returns trusted for ELIGIBLE with computed eligibility', () => {
    expect(deriveTrustState('ELIGIBLE', 'computed')).toBe('trusted');
  });
});

// ─── POS-001: trustState field present on all results ─────────────────────

describe('POS-001: trustState field exists on every result', () => {
  it('result has trustState field with valid value', () => {
    const result = scoreGoalSuccessProbability(GOAL_ID, baseState(), CONSTRAINTS, NOW_ISO);
    expect(['withheld', 'provisional', 'trusted']).toContain(result.trustState);
  });

  it('result has eligibilityStatus field with valid value', () => {
    const result = scoreGoalSuccessProbability(GOAL_ID, baseState(), CONSTRAINTS, NOW_ISO);
    expect(['disabled', 'insufficient_evidence', 'computed']).toContain(result.eligibilityStatus);
  });
});

// ─── POS-002: withheld at admission (no active cycle) ─────────────────────

describe('POS-002: withheld when goal has no active cycle', () => {
  it('returns withheld when cyclesById is empty', () => {
    const state = baseState({ activeCycleId: null, cyclesById: {} });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('withheld');
  });

  it('returns withheld when no cycle matches the goal id', () => {
    const state = baseState({
      activeCycleId: null,
      cyclesById: {
        'cycle-other': activeCycle('goal-different'),
      },
    });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('withheld');
  });
});

// ─── POS-003: provisional at activation, NO_EVIDENCE, score ≤ 0.65 ────────

describe('POS-003: provisional at activation with no execution evidence', () => {
  it('trustState is provisional when executionEvents is empty', () => {
    const result = scoreGoalSuccessProbability(GOAL_ID, baseState(), CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('provisional');
    expect(result.status).toBe('NO_EVIDENCE');
  });

  it('score never exceeds 0.65 with zero execution events', () => {
    const result = scoreGoalSuccessProbability(GOAL_ID, baseState(), CONSTRAINTS, NOW_ISO);
    expect(result.value).not.toBeNull();
    expect(result.value).toBeLessThanOrEqual(0.65);
  });

  it('trustState is never trusted with zero execution events', () => {
    const result = scoreGoalSuccessProbability(GOAL_ID, baseState(), CONSTRAINTS, NOW_ISO);
    expect(result.trustState).not.toBe('trusted');
  });
});

// ─── POS-004: trusted at exactly 7 distinct evidence days ─────────────────

describe('POS-004: trusted at 7 distinct internal evidence days', () => {
  function sevenDayEvents() {
    return [
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-03-13' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-03-14' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-03-15' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-03-16' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-03-17' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-03-18' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-03-19' },
    ];
  }

  it('trustState is trusted with exactly 7 distinct evidence days', () => {
    const state = baseState({ executionEvents: sevenDayEvents() });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('trusted');
    expect(result.status).toBe('ELIGIBLE');
  });

  it('trustState is provisional at 6 distinct evidence days (below threshold)', () => {
    const sixDays = sevenDayEvents().slice(0, 6);
    const state = baseState({ executionEvents: sixDays });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('provisional');
    expect(result.status).toBe('INELIGIBLE');
    expect(result.value).toBeLessThanOrEqual(0.65);
  });

  // POS-004b: the anti-cheat test — 7 blocks on 1 day is not 7 evidence days
  it('POS-004b: 7 completed blocks on 1 day does NOT produce trusted state', () => {
    const sevenBlocksOneDay = Array.from({ length: 7 }, (_, i) => ({
      goalId: GOAL_ID,
      cycleId: 'cycle-lifecycle',
      completed: true,
      kind: 'complete',
      dateISO: '2026-03-19', // all same date
      minutes: 60,
    }));
    const state = baseState({ executionEvents: sevenBlocksOneDay });
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    // Only 1 evidence day — must remain provisional
    expect(result.trustState).toBe('provisional');
    expect(result.value).toBeLessThanOrEqual(0.65);
  });
});

// ─── POS-008: withheld when deadline passed with remaining work ────────────

describe('POS-008: withheld when deadline is past with remaining work', () => {
  it('returns withheld and INFEASIBLE when deadline passed', () => {
    const state = baseState({
      cyclesById: {
        'cycle-lifecycle': activeCycle(GOAL_ID, {
          goalContract: { goalId: GOAL_ID, startDayKey: '2026-01-01', endDayKey: '2026-01-15' },
        }),
      },
    });
    const result = scoreGoalSuccessProbability(
      GOAL_ID,
      state,
      CONSTRAINTS,
      '2026-03-20T12:00:00.000Z' // well past deadline
    );
    expect(result.trustState).toBe('withheld');
    expect(result.status).toBe('INFEASIBLE');
    expect(result.value).toBe(0);
  });

  // Note: a goal with zero remaining work and a past deadline returns withheld
  // because workableDaysRemaining = 0 triggers the INFEASIBLE path. Completed
  // goals past deadline are handled as a separate concern outside Wave 1 scope.
});

// ─── Trust downgrade: rolling window evidence decay ───────────────────────

describe('Trust downgrade: rolling window evidence decay', () => {
  it('degrades from trusted to provisional when rolling window evidence drops below 7 days', () => {
    // Events from 30+ days ago — will fall outside a 14-day rolling window when nowISO is recent
    const oldEvents = [
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-02-01' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-02-02' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-02-03' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-02-04' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-02-05' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-02-06' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-02-07' },
    ];

    // Use rolling window mode (no startDayKey on contract) + nowISO far after the events
    const state = baseState({
      activeCycleId: 'cycle-lifecycle',
      cyclesById: {
        'cycle-lifecycle': {
          id: 'cycle-lifecycle',
          status: 'active',
          // no startDayKey on goalContract → forces rolling window
          goalContract: { goalId: GOAL_ID, endDayKey: FUTURE_DEADLINE },
          goalGovernanceContract: activeContract(),
        },
      },
      executionEvents: oldEvents,
    });

    // nowISO is 2026-03-20 — all events are 40+ days ago, outside the 14-day window
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    // Evidence days in the 14-day rolling window = 0 (all events are outside the window)
    expect(result.trustState).toBe('provisional');
  });

  it('contract expiry produces withheld regardless of evidence history', () => {
    const sevenDayEvents = [
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-01-10' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-01-11' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-01-12' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-01-13' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-01-14' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-01-15' },
      { goalId: GOAL_ID, cycleId: 'cycle-lifecycle', completed: true, kind: 'complete', dateISO: '2026-01-16' },
    ];

    const expiredContract = {
      contractId: `gov-${GOAL_ID}`,
      version: 1,
      goalId: GOAL_ID,
      activeFromISO: '2026-01-01',
      activeUntilISO: '2026-01-31', // expired before NOW_ISO
      scope: { domainsAllowed: ['Focus'], timeHorizon: 'week', timezone: 'UTC' },
      governance: { probabilityEnabled: true, minEvidenceEvents: 1 },
    };

    const state = baseState({
      cyclesById: {
        'cycle-lifecycle': activeCycle(GOAL_ID, { goalGovernanceContract: expiredContract }),
      },
      executionEvents: sevenDayEvents,
    });

    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('withheld');
  });
});
