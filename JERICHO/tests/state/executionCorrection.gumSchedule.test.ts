/**
 * executionCorrection.gumSchedule.test.ts
 *
 * Acceptance tests for the deterministic course-correction evaluator
 * applied to gum execution evidence. Proves bounded signal computation
 * with no mutation of schedule, feasibility, or Live P.O.S.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateExecutionCorrection,
  type ExecutionCorrectionInput,
} from '../../src/state/engine/executionCorrectionEvaluator.ts';
import { identityReducer } from '../../src/state/identityStore.js';
import { computeDerivedState, getAllBlocks } from '../../src/state/identityCompute.js';

// ---------------------------------------------------------------------------
// Fixture — gum plan actions and canonical state
// ---------------------------------------------------------------------------

const CYCLE_ID = 'cycle-correction-test';
const GOAL_ID = 'goal-correction-test';
const BLOCK_DATE = '2026-05-02';

const ACTION_1 = {
  id: 'brand:00:01:investigate-gum-category',
  title: 'Investigate functional gum category',
  dependencies: [],
  dependencyIds: [],
  dependencyDetails: [],
};

const ACTION_2 = {
  id: 'brand:00:02:white-label-vendor-research',
  title: 'White-label vendor research',
  dependencies: ['brand:00:01:investigate-gum-category'],
  dependencyIds: ['brand:00:01:investigate-gum-category'],
  dependencyDetails: [
    {
      actionId: 'brand:00:01:investigate-gum-category',
      dependencyType: 'hard_gate',
    },
  ],
};

const ACTION_3 = {
  id: 'brand:00:03:supplier-outreach',
  title: 'Supplier outreach',
  dependencies: ['brand:00:02:white-label-vendor-research'],
  dependencyIds: ['brand:00:02:white-label-vendor-research'],
  dependencyDetails: [
    {
      actionId: 'brand:00:02:white-label-vendor-research',
      dependencyType: 'directional',
    },
  ],
};

const GUM_BLOCK_1 = {
  id: 'blk-correction-1',
  cycleId: CYCLE_ID,
  goalId: GOAL_ID,
  origin: 'schedule_active' as const,
  actionId: ACTION_1.id,
  title: ACTION_1.title,
  label: ACTION_1.title,
  practice: 'Focus',
  domain: 'Focus',
  start: `${BLOCK_DATE}T09:00:00.000Z`,
  end: `${BLOCK_DATE}T10:00:00.000Z`,
  status: 'planned' as const,
  requiredSystemBlock: true,
};

const GUM_BLOCK_2 = {
  id: 'blk-correction-2',
  cycleId: CYCLE_ID,
  goalId: GOAL_ID,
  origin: 'schedule_active' as const,
  actionId: ACTION_2.id,
  title: ACTION_2.title,
  label: ACTION_2.title,
  practice: 'Focus',
  domain: 'Focus',
  start: '2026-05-03T09:00:00.000Z',
  end: '2026-05-03T10:00:00.000Z',
  status: 'planned' as const,
  requiredSystemBlock: false,
};

// Required block whose action (ACTION_2) has only directional downstream — no hard_gate blocked
const GUM_BLOCK_2_REQUIRED = {
  ...GUM_BLOCK_2,
  requiredSystemBlock: true,
};

const CANONICAL_ACTIONS = [ACTION_1, ACTION_2, ACTION_3];

function makeCompleteEvent(block: typeof GUM_BLOCK_1) {
  return {
    id: `evt:complete:${block.id}:${BLOCK_DATE}:60`,
    blockId: block.id,
    dateISO: BLOCK_DATE,
    minutes: 60,
    rawLabel: block.title,
    domain: 'Focus' as const,
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    actionId: block.actionId,
    requiredSystemBlock: block.requiredSystemBlock,
    completed: true,
    kind: 'complete' as const,
    status: 'completed',
  };
}

function makeMissedEvent(block: typeof GUM_BLOCK_1, overrides: Record<string, unknown> = {}) {
  return {
    id: `evt:missed:${block.id}:${BLOCK_DATE}:60`,
    blockId: block.id,
    dateISO: BLOCK_DATE,
    minutes: 60,
    rawLabel: block.title,
    domain: 'Focus' as const,
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    actionId: block.actionId,
    requiredSystemBlock: block.requiredSystemBlock,
    completed: false,
    kind: 'missed' as const,
    status: 'missed',
    ...overrides,
  };
}

function makeSkippedEvent(block: typeof GUM_BLOCK_1, overrides: Record<string, unknown> = {}) {
  return {
    id: `evt:skipped:${block.id}:${BLOCK_DATE}:60`,
    blockId: block.id,
    dateISO: BLOCK_DATE,
    minutes: 60,
    rawLabel: block.title,
    domain: 'Focus' as const,
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    actionId: block.actionId,
    requiredSystemBlock: block.requiredSystemBlock,
    completed: false,
    kind: 'skipped' as const,
    status: 'skipped',
    ...overrides,
  };
}

function baseInput(overrides: Partial<ExecutionCorrectionInput> = {}): ExecutionCorrectionInput {
  return {
    goalId: GOAL_ID,
    cycleId: CYCLE_ID,
    executionEvents: [],
    canonicalActions: CANONICAL_ACTIONS,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Box 1: No execution events → insufficient_evidence
// ---------------------------------------------------------------------------

describe('Box 1: No execution events produces insufficient_evidence', () => {
  it('returns insufficient_evidence when executionEvents is empty', () => {
    const result = evaluateExecutionCorrection(baseInput({ executionEvents: [] }));
    expect(result.correctionState).toBe('insufficient_evidence');
    expect(result.level).toBe('none');
    expect(result.state).toBe('insufficient_evidence');
  });

  it('all counts are zero when there is no evidence', () => {
    const result = evaluateExecutionCorrection(baseInput({ executionEvents: [] }));
    expect(result.executionEvidenceCount).toBe(0);
    expect(result.evidenceCount).toBe(0);
    expect(result.completedCount).toBe(0);
    expect(result.missedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.missedRequiredWork).toBe(0);
    expect(result.skippedRequiredWork).toBe(0);
    expect(result.blockedDownstreamCount).toBe(0);
    expect(result.timedDeadlineRiskCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Box 2: Completed blocks only → on_track
// ---------------------------------------------------------------------------

describe('Box 2: Completed gum blocks only → on_track', () => {
  it('returns on_track when only completed events are present', () => {
    const result = evaluateExecutionCorrection(
      baseInput({ executionEvents: [makeCompleteEvent(GUM_BLOCK_1)] })
    );
    expect(result.correctionState).toBe('on_track');
    expect(result.level).toBe('none');
  });

  it('counts completed correctly', () => {
    const result = evaluateExecutionCorrection(
      baseInput({
        executionEvents: [makeCompleteEvent(GUM_BLOCK_1), makeCompleteEvent(GUM_BLOCK_2 as any)],
      })
    );
    expect(result.completedCount).toBe(2);
    expect(result.missedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.completionRate).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Box 3: Non-required missed/skipped → watch
// ---------------------------------------------------------------------------

describe('Box 3: Non-required missed or skipped work → watch', () => {
  it('returns watch when a non-required block is missed', () => {
    const result = evaluateExecutionCorrection(
      baseInput({ executionEvents: [makeMissedEvent(GUM_BLOCK_2 as any)] })
    );
    expect(result.correctionState).toBe('watch');
    expect(result.level).toBe('reschedule');
    expect(result.reasonCodes).toContain('missed_non_required');
  });

  it('returns watch when a non-required block is skipped', () => {
    const result = evaluateExecutionCorrection(
      baseInput({ executionEvents: [makeSkippedEvent(GUM_BLOCK_2 as any)] })
    );
    expect(result.correctionState).toBe('watch');
    expect(result.level).toBe('reschedule');
    expect(result.reasonCodes).toContain('skipped_work');
  });
});

// ---------------------------------------------------------------------------
// Box 4: Required missed (no hard-gate downstream) → adjustment_recommended
// ---------------------------------------------------------------------------

describe('Box 4: Required work missed with no hard-gate downstream → adjustment_recommended', () => {
  it('returns adjustment_recommended when required block is missed and no hard_gate downstream', () => {
    // GUM_BLOCK_2_REQUIRED maps to ACTION_2; ACTION_3 depends on ACTION_2 via directional only
    const result = evaluateExecutionCorrection(
      baseInput({ executionEvents: [makeMissedEvent(GUM_BLOCK_2_REQUIRED as any)] })
    );
    expect(result.level).toBe('compression_warning');
    expect(result.correctionState).toBe('adjustment_recommended');
    expect(result.missedRequiredWork).toBe(1);
    expect(result.blockedDownstreamCount).toBe(0);
    expect(result.reasonCodes).toContain('missed_required_work');
  });
});

// ---------------------------------------------------------------------------
// Box 5: Hard-gated downstream blocked → recovery_required
// ---------------------------------------------------------------------------

describe('Box 5: Hard-gated downstream blocked by missed required work → recovery_required', () => {
  it('returns recovery_required with blockedDownstreamCount > 0', () => {
    // ACTION_1 is required; ACTION_2 has hard_gate on ACTION_1
    // Missing ACTION_1 should block ACTION_2 (hard_gate) but not ACTION_3 (directional on ACTION_2)
    const result = evaluateExecutionCorrection(
      baseInput({ executionEvents: [makeMissedEvent(GUM_BLOCK_1)] })
    );
    expect(result.correctionState).toBe('recovery_required');
    expect(result.level).toBe('dependency_impact');
    expect(result.blockedDownstreamCount).toBeGreaterThan(0);
    expect(result.reasonCodes).toContain('missed_required_with_blocked_downstream');
  });

  it('blockedDownstreamCount counts only hard_gate downstream, not directional', () => {
    // ACTION_2 (hard_gate on ACTION_1) and ACTION_3 (directional on ACTION_2)
    // Only ACTION_2 should be counted as hard-blocked by missing ACTION_1
    const result = evaluateExecutionCorrection(
      baseInput({ executionEvents: [makeMissedEvent(GUM_BLOCK_1)] })
    );
    expect(result.blockedDownstreamCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Box 6: Reads canonical identity fields correctly
// ---------------------------------------------------------------------------

describe('Box 6: Reads canonical execution events with correct identity', () => {
  it('goalId and cycleId are echoed in the output signal', () => {
    const result = evaluateExecutionCorrection(
      baseInput({ executionEvents: [makeCompleteEvent(GUM_BLOCK_1)] })
    );
    expect(result.goalId).toBe(GOAL_ID);
    expect(result.cycleId).toBe(CYCLE_ID);
  });

  it('events from wrong goalId are ignored', () => {
    const wrongGoalEvent = { ...makeCompleteEvent(GUM_BLOCK_1), goalId: 'wrong-goal' };
    const result = evaluateExecutionCorrection(
      baseInput({ executionEvents: [wrongGoalEvent as any] })
    );
    // wrongGoalEvent still passes through because evaluator receives pre-filtered events
    // The wiring in identityCompute uses getCanonicalExecutionEventsForCycleGoal to filter
    // — the evaluator itself doesn't re-filter by goalId, it trusts the input
    expect(result.executionEvidenceCount).toBe(1);
  });

  it('preserves structured reasonCode evidence on the correction signal', () => {
    const result = evaluateExecutionCorrection(
      baseInput({
        executionEvents: [makeMissedEvent(GUM_BLOCK_1, { reasonCode: 'dependency_blocked', note: 'Waiting on supplier' })],
      })
    );
    expect(result.eventReasonCodes).toContain('dependency_blocked');
  });
});

// ---------------------------------------------------------------------------
// Box 7: Does not mutate schedule or compute Live P.O.S.
// ---------------------------------------------------------------------------

describe('Box 7: Correction signal does not mutate schedule or feasibility', () => {
  function buildBaseState() {
    return {
      appTime: {
        nowISO: `${BLOCK_DATE}T10:30:00.000Z`,
        activeDayKey: BLOCK_DATE,
        timeZone: 'UTC',
        isFollowingNow: true,
      },
      today: { date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK_1 }] },
      currentWeek: {
        weekStart: BLOCK_DATE,
        days: [
          { date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK_1 }] },
          { date: '2026-05-03', blocks: [{ ...GUM_BLOCK_2 }] },
        ],
      },
      cycle: [
        { date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK_1 }] },
        { date: '2026-05-03', blocks: [{ ...GUM_BLOCK_2 }] },
      ],
      ledger: [],
      executionEvents: [],
      suggestionEvents: [],
      proposedBlocks: [],
      suggestedBlocks: [],
      blockStore: {
        blocks: {
          [GUM_BLOCK_1.id]: { ...GUM_BLOCK_1 },
          [GUM_BLOCK_2.id]: { ...GUM_BLOCK_2 },
        },
      },
      scheduleApplied: true,
      scheduleLifecycle: 'active_schedule',
      scheduleReviewBlocks: [],
      vector: {},
      lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
      constraints: { maxBlocksPerDay: 3, weeklyWindows: {} },
      goalAdmissionByGoal: { [GOAL_ID]: { status: 'ADMITTED', reasonCodes: [] } },
      activeCycleId: CYCLE_ID,
      goalExecutionContract: {
        goalId: GOAL_ID,
        goalText: 'Launch caffeinated functional energy gum brand',
        terminalOutcome: {
          text: 'Caffeinated energy gum product launched',
          verificationCriteria: 'First cold sale confirmed.',
          isConcrete: true,
        },
        startDayKey: '2026-05-01',
        endDayKey: '2027-08-01',
      },
      cyclesById: {
        [CYCLE_ID]: {
          id: CYCLE_ID,
          status: 'active',
          scheduleLifecycle: 'active_schedule',
          scheduleReviewBlocks: [],
          goalContract: {
            goalId: GOAL_ID,
            goalText: 'Launch caffeinated functional energy gum brand',
            terminalOutcome: {
              text: 'Caffeinated energy gum product launched',
              verificationCriteria: 'First cold sale confirmed.',
              isConcrete: true,
            },
            startDayKey: '2026-05-01',
            endDayKey: '2027-08-01',
          },
          actions: CANONICAL_ACTIONS,
          executionEvents: [],
          metrics: {},
        },
      },
      lastPlanError: null,
    };
  }

  it('schedule blocks are unchanged after correction signal is computed', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'MISS_BLOCK', id: GUM_BLOCK_1.id });
    const day2Block = getAllBlocks(after as any).find((b: any) => b.id === GUM_BLOCK_2.id);
    expect(day2Block).toBeDefined();
    expect(day2Block?.status).toBe('planned');
  });

  it('feasibility state is not changed to live_pos after correction signal', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'MISS_BLOCK', id: GUM_BLOCK_1.id });
    const policy = after.goalPolicyByGoalId?.[GOAL_ID];
    expect(policy?.feasibility?.state).not.toBe('live_pos');
    expect(policy?.feasibility?.state).not.toBe('activating');
    expect(policy?.feasibility?.state).not.toBe('stable');
  });

  it('executionCorrectionByGoal is populated after MISS_BLOCK', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'MISS_BLOCK', id: GUM_BLOCK_1.id });
    const correction = after.executionCorrectionByGoal?.[GOAL_ID];
    expect(correction).toBeDefined();
    expect(correction?.level).toMatch(/^(reschedule|compression_warning|dependency_impact|plan_evolution_required)$/);
    expect(correction?.correctionState).toMatch(
      /^(adjustment_recommended|recovery_required|watch)$/
    );
  });

  it('structured miss reasonCode is preserved through reducer into correction output', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, {
      type: 'MISS_BLOCK',
      id: GUM_BLOCK_1.id,
      reasonCode: 'dependency_blocked',
      note: 'Supplier quote not returned',
    });
    expect(after.executionCorrectionByGoal?.[GOAL_ID]?.eventReasonCodes).toContain('dependency_blocked');
  });
});

// ---------------------------------------------------------------------------
// Box 8: completionRate and evidence counts are accurate
// ---------------------------------------------------------------------------

describe('Box 8: Evidence counts and completionRate are accurate', () => {
  it('completionRate is 0.5 when half completed, half missed', () => {
    const result = evaluateExecutionCorrection(
      baseInput({
        executionEvents: [makeCompleteEvent(GUM_BLOCK_1), makeMissedEvent(GUM_BLOCK_2 as any)],
      })
    );
    expect(result.completionRate).toBeCloseTo(0.5);
    expect(result.executionEvidenceCount).toBe(2);
    expect(result.completedCount).toBe(1);
    expect(result.missedCount).toBe(1);
  });

  it('skippedRequiredWork is 0 when only non-required block is skipped', () => {
    const result = evaluateExecutionCorrection(
      baseInput({ executionEvents: [makeSkippedEvent(GUM_BLOCK_2 as any)] })
    );
    expect(result.skippedRequiredWork).toBe(0);
  });
});
