import { describe, it, expect } from 'vitest';
import { scoreGoalSuccessProbability } from '../../src/state/engine/probabilityScore.ts';

const GOAL_ID = 'goal-active-inactivity';
const FUTURE_DEADLINE = '2026-06-01';

// Rolling window mode: contract has no startDayKey — window is a rolling 14-day lookback.
function rollingWindowContract(goalId) {
  return {
    goalId,
    endDayKey: FUTURE_DEADLINE,
    // no startDayKey → forces rolling window mode
  };
}

function governanceContract(goalId) {
  return {
    contractId: `gov-${goalId}`,
    version: 1,
    goalId,
    activeFromISO: '2026-01-01',
    activeUntilISO: '2026-12-31',
    scope: { domainsAllowed: ['Focus'], timeHorizon: 'week', timezone: 'UTC' },
    governance: { probabilityEnabled: true, minEvidenceEvents: 0 },
  };
}

function activeState(goalId, executionEvents, nowISO) {
  return {
    activeCycleId: 'cycle-active',
    cyclesById: {
      'cycle-active': {
        id: 'cycle-active',
        status: 'active',
        goalContract: rollingWindowContract(goalId),
        goalGovernanceContract: governanceContract(goalId),
      },
    },
    goalWorkById: { [goalId]: [{ workItemId: 'w1', blocksRemaining: 5 }] },
    executionEvents,
    externalEvidenceEvents: [],
  };
}

const CONSTRAINTS = { timezone: 'UTC', maxBlocksPerDay: 2, scoringWindowDays: 14 };

// Seven evidence days anchored so that they are within 14 days of a given nowISO.
// nowISO = '2026-03-20' → window covers 2026-03-07 to 2026-03-20
const RECENT_EVENTS = [
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-03-13' },
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-03-14' },
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-03-15' },
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-03-16' },
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-03-17' },
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-03-18' },
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-03-19' },
];

// Same logical events but with dates from early February.
// With nowISO = 2026-03-20 these are 33–39 days old — outside any 14-day rolling window.
const OLD_EVENTS = [
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-02-09' },
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-02-10' },
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-02-11' },
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-02-12' },
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-02-13' },
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-02-14' },
  { goalId: GOAL_ID, cycleId: 'cycle-active', completed: true, kind: 'complete', dateISO: '2026-02-15' },
];

// ─── POS-W3-001: Evidence decay — trusted → provisional ───────────────────────

describe('POS-W3-001: evidence decay degrades trusted to provisional from rolling window', () => {
  it('trusted at 7 evidence days within rolling window', () => {
    const state = activeState(GOAL_ID, RECENT_EVENTS, '2026-03-20T12:00:00.000Z');
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, '2026-03-20T12:00:00.000Z');
    expect(result.trustState).toBe('trusted');
    expect(result.status).toBe('ELIGIBLE');
  });

  it('provisional when same events age out of 14-day rolling window', () => {
    // Events from 2026-02-09 to 2026-02-15 are outside the 14-day window from 2026-03-20
    const state = activeState(GOAL_ID, OLD_EVENTS, '2026-03-20T12:00:00.000Z');
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, '2026-03-20T12:00:00.000Z');
    expect(result.trustState).toBe('provisional');
    expect(result.value).toBeLessThanOrEqual(0.65);
  });

  it('trust state is computed from present facts only — no persisted state required', () => {
    // The SAME execution events produce different trust states depending solely on nowISO.
    // When nowISO is close to the events: trusted.
    // When nowISO is far from the events: provisional.
    // No persisted drift counter is needed.
    const stateEarly = activeState(GOAL_ID, RECENT_EVENTS, '2026-03-20T12:00:00.000Z');
    const stateLate = activeState(GOAL_ID, RECENT_EVENTS, '2026-04-10T12:00:00.000Z');

    const resultEarly = scoreGoalSuccessProbability(GOAL_ID, stateEarly, CONSTRAINTS, '2026-03-20T12:00:00.000Z');
    const resultLate = scoreGoalSuccessProbability(GOAL_ID, stateLate, CONSTRAINTS, '2026-04-10T12:00:00.000Z');

    // At 2026-03-20 the events (2026-03-13 to 2026-03-19) are within the 14-day window → trusted
    expect(resultEarly.trustState).toBe('trusted');
    // At 2026-04-10 those same events are 22–28 days old → outside window → provisional
    expect(resultLate.trustState).toBe('provisional');
  });
});

// ─── POS-W3-002: Active schedule inactivity → provisional from present facts ──

describe('POS-W3-002: active schedule with no recent completions produces provisional', () => {
  it('active goal with no recent completions produces provisional from present evidence alone', () => {
    // Goal is fully active (future deadline, active contract, active cycle).
    // It has 7 completed events — but they are 33–39 days old.
    // The current 14-day rolling window contains 0 evidence days.
    const state = activeState(GOAL_ID, OLD_EVENTS, '2026-03-20T12:00:00.000Z');
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, '2026-03-20T12:00:00.000Z');
    expect(result.trustState).toBe('provisional');
    // The goal is still active — not INFEASIBLE (deadline is in the future)
    expect(result.status).not.toBe('INFEASIBLE');
  });

  it('the same goal with recent completions produces trusted', () => {
    const state = activeState(GOAL_ID, RECENT_EVENTS, '2026-03-20T12:00:00.000Z');
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, '2026-03-20T12:00:00.000Z');
    expect(result.trustState).toBe('trusted');
  });

  it('provisional value does not exceed 0.65 despite active deadline', () => {
    const state = activeState(GOAL_ID, OLD_EVENTS, '2026-03-20T12:00:00.000Z');
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, '2026-03-20T12:00:00.000Z');
    expect(result.value).toBeLessThanOrEqual(0.65);
  });

  it('zero execution events on active goal produces provisional, not withheld', () => {
    // An active goal (has contract, has active cycle) with zero execution events → provisional (NO_EVIDENCE).
    // withheld requires INFEASIBLE, disabled eligibility, or insufficient_evidence.
    // With minEvidenceEvents: 0, the goal is eligible for scoring from day one.
    const state = activeState(GOAL_ID, [], '2026-03-20T12:00:00.000Z');
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, '2026-03-20T12:00:00.000Z');
    expect(result.trustState).toBe('provisional');
    expect(result.status).toBe('NO_EVIDENCE');
  });
});
