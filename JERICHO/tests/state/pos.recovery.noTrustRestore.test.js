import { describe, it, expect } from 'vitest';
import { scoreGoalSuccessProbability } from '../../src/state/engine/probabilityScore.ts';

const GOAL_ID = 'goal-recovery-trust';
const CYCLE_ID = 'cycle-recovery';

function governanceContract(goalId) {
  return {
    contractId: `gov-${goalId}`,
    version: 1,
    goalId,
    activeFromISO: '2026-03-01',
    activeUntilISO: '2026-12-31',
    scope: { domainsAllowed: ['Focus'], timeHorizon: 'week', timezone: 'UTC' },
    governance: { probabilityEnabled: true, minEvidenceEvents: 0 },
  };
}

function cycleWithDeadline(goalId, endDayKey) {
  return {
    id: CYCLE_ID,
    status: 'active',
    goalContract: {
      goalId,
      startDayKey: '2026-03-01',
      endDayKey,
      familyClass: 'internally_controlled',
      archetype: 'CreativeProduction',
    },
    goalGovernanceContract: governanceContract(goalId),
  };
}

function externallyMediatedCycleWithDeadline(goalId, endDayKey) {
  return {
    id: CYCLE_ID,
    status: 'active',
    goalContract: {
      goalId,
      startDayKey: '2026-03-01',
      endDayKey,
      familyClass: 'externally_mediated',
      archetype: 'JobSearchPipeline',
    },
    goalGovernanceContract: governanceContract(goalId),
  };
}

// Five distinct internal evidence days — below the 7-day trust threshold
function fiveInternalEvents() {
  return [
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-13' },
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-14' },
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-15' },
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-16' },
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-17' },
  ];
}

// Seven distinct internal evidence days — at or above the trust threshold
function sevenInternalEvents() {
  return [
    ...fiveInternalEvents(),
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-18' },
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-19' },
  ];
}

// Seven additional evidence events for use after recovery
function sevenPostRecoveryEvents() {
  return [
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-20' },
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-21' },
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-22' },
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-23' },
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-24' },
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-25' },
    { goalId: GOAL_ID, cycleId: CYCLE_ID, completed: true, kind: 'complete', dateISO: '2026-03-26' },
  ];
}

const CONSTRAINTS = { timezone: 'UTC', maxBlocksPerDay: 2, scoringWindowDays: 14 };
const NOW_ISO = '2026-03-20T12:00:00.000Z';

// ─── POS-W3-003: Deadline expiry → withheld (regression check) ───────────────

describe('POS-W3-003: deadline passage produces withheld regardless of prior trust state', () => {
  it('deadline passed with remaining work produces withheld regardless of evidence count', () => {
    const state = {
      activeCycleId: CYCLE_ID,
      cyclesById: {
        [CYCLE_ID]: cycleWithDeadline(GOAL_ID, '2026-01-01'), // deadline in past
      },
      goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 3 }] },
      executionEvents: sevenInternalEvents(), // would otherwise be ELIGIBLE
      externalEvidenceEvents: [],
    };
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('withheld');
    expect(result.status).toBe('INFEASIBLE');
    expect(result.value).toBe(0);
  });
});

// ─── POS-W3-004: Recovery does not restore trusted (POS-007) ─────────────────

describe('POS-W3-004 / POS-007: recovery does not restore trusted without new execution', () => {
  it('trust stays provisional after recovery (deadline extension) with no new execution', () => {
    // Before recovery: 5 evidence days → provisional
    const stateBeforeRecovery = {
      activeCycleId: CYCLE_ID,
      cyclesById: { [CYCLE_ID]: cycleWithDeadline(GOAL_ID, '2026-05-01') },
      goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 10 }] },
      executionEvents: fiveInternalEvents(),
      externalEvidenceEvents: [],
    };
    const beforeResult = scoreGoalSuccessProbability(GOAL_ID, stateBeforeRecovery, CONSTRAINTS, NOW_ISO);
    expect(beforeResult.trustState).toBe('provisional');

    // After recovery: deadline extended by 30 days — no new execution events
    const stateAfterRecovery = {
      ...stateBeforeRecovery,
      cyclesById: { [CYCLE_ID]: cycleWithDeadline(GOAL_ID, '2026-05-31') }, // extended deadline
    };
    const afterResult = scoreGoalSuccessProbability(GOAL_ID, stateAfterRecovery, CONSTRAINTS, NOW_ISO);

    // Trust must remain provisional — recovery alone cannot promote trust
    expect(afterResult.trustState).toBe('provisional');
    expect(afterResult.trustState).not.toBe('trusted');
  });

  it('trust is re-earned only after 7 new evidence days following recovery', () => {
    // Apply recovery first (deadline extended, no new execution)
    const stateAfterRecovery = {
      activeCycleId: CYCLE_ID,
      cyclesById: { [CYCLE_ID]: cycleWithDeadline(GOAL_ID, '2026-05-31') },
      goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 10 }] },
      executionEvents: fiveInternalEvents(), // still only 5 days — provisional
      externalEvidenceEvents: [],
    };
    const recoveryOnlyResult = scoreGoalSuccessProbability(GOAL_ID, stateAfterRecovery, CONSTRAINTS, NOW_ISO);
    expect(recoveryOnlyResult.trustState).toBe('provisional');

    // Now add 7 new evidence days (these will be in the scoring window for a later nowISO)
    const stateWithNewExecution = {
      ...stateAfterRecovery,
      executionEvents: [...fiveInternalEvents(), ...sevenPostRecoveryEvents()],
    };
    // Advance nowISO to cover the new events in the 14-day window
    const laterNowISO = '2026-03-27T12:00:00.000Z';
    const newExecutionResult = scoreGoalSuccessProbability(GOAL_ID, stateWithNewExecution, CONSTRAINTS, laterNowISO);
    // Trust should now be earned from the new execution evidence
    expect(newExecutionResult.trustState).toBe('trusted');
  });

  it('three successive deadline extensions with no new execution keep trust provisional', () => {
    const baseExecutionEvents = fiveInternalEvents();

    const deadlines = ['2026-05-01', '2026-06-01', '2026-07-01'];
    for (const deadline of deadlines) {
      const state = {
        activeCycleId: CYCLE_ID,
        cyclesById: { [CYCLE_ID]: cycleWithDeadline(GOAL_ID, deadline) },
        goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 10 }] },
        executionEvents: baseExecutionEvents,
        externalEvidenceEvents: [],
      };
      const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
      expect(result.trustState).toBe('provisional');
    }
  });

  it('score does not significantly increase from recovery alone', () => {
    const beforeState = {
      activeCycleId: CYCLE_ID,
      cyclesById: { [CYCLE_ID]: cycleWithDeadline(GOAL_ID, '2026-05-01') },
      goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 10 }] },
      executionEvents: fiveInternalEvents(),
      externalEvidenceEvents: [],
    };
    const afterState = {
      ...beforeState,
      cyclesById: { [CYCLE_ID]: cycleWithDeadline(GOAL_ID, '2026-07-01') },
    };

    const before = scoreGoalSuccessProbability(GOAL_ID, beforeState, CONSTRAINTS, NOW_ISO);
    const after = scoreGoalSuccessProbability(GOAL_ID, afterState, CONSTRAINTS, NOW_ISO);

    // Both must be provisional
    expect(before.trustState).toBe('provisional');
    expect(after.trustState).toBe('provisional');

    // Both values must be capped
    expect(before.value).toBeLessThanOrEqual(0.65);
    expect(after.value).toBeLessThanOrEqual(0.65);
  });
});

// ─── POS-W3-005: Externally-mediated stays provisional after recovery ─────────

describe('POS-W3-005: externally-mediated family stays provisional after recovery without external evidence', () => {
  it('externally-mediated family stays provisional after recovery with no external evidence', () => {
    // JobSearchPipeline — 7 internal evidence days, recovery (deadline extended), no external evidence
    const state = {
      activeCycleId: CYCLE_ID,
      cyclesById: { [CYCLE_ID]: externallyMediatedCycleWithDeadline(GOAL_ID, '2026-07-01') }, // extended
      goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 5 }] },
      executionEvents: sevenInternalEvents(),
      externalEvidenceEvents: [], // no external evidence → external gate closed
    };
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    // Despite 7 internal days + deadline extension, external gate blocks trusted
    expect(result.trustState).toBe('provisional');
    expect(result.value).toBeLessThanOrEqual(0.65);
  });

  it('externally-mediated family requires both new execution AND external evidence for trusted after recovery', () => {
    // 7 internal days + qualifying external evidence + extended deadline → trusted
    const state = {
      activeCycleId: CYCLE_ID,
      cyclesById: { [CYCLE_ID]: externallyMediatedCycleWithDeadline(GOAL_ID, '2026-07-01') },
      goalWorkById: { [GOAL_ID]: [{ workItemId: 'w1', blocksRemaining: 5 }] },
      executionEvents: sevenInternalEvents(),
      externalEvidenceEvents: [
        {
          type: 'external_evidence',
          goalId: GOAL_ID,
          cycleId: CYCLE_ID,
          dateISO: '2026-03-15',
          stage: 'recruiter_reply',
          confirmed: true,
        },
      ],
    };
    const result = scoreGoalSuccessProbability(GOAL_ID, state, CONSTRAINTS, NOW_ISO);
    expect(result.trustState).toBe('trusted');
  });
});
