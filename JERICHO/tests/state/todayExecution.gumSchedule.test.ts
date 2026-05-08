/**
 * todayExecution.gumSchedule.test.ts
 *
 * Acceptance tests for day-to-day execution wiring on an applied gum schedule.
 * Proves that Today block actions write canonical execution evidence and that
 * the rest of the system remains stable.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { identityReducer } from '../../src/state/identityStore.js';
import { computeDerivedState, getAllBlocks } from '../../src/state/identityCompute.js';
import { deriveExecutionTruthClassification } from '../../src/state/engine/todayAuthority.ts';

// ---------------------------------------------------------------------------
// Fixture — active_schedule lifecycle with gum-plan blocks already activated
// ---------------------------------------------------------------------------

const CYCLE_ID = 'cycle-gum-exec';
const GOAL_ID = 'goal-gum-exec';
const BLOCK_DATE = '2026-05-02';

const GUM_BLOCK = {
  id: 'blk-gum-day1',
  cycleId: CYCLE_ID,
  goalId: GOAL_ID,
  origin: 'schedule_active' as const,
  deliverableId: 'd-gum-1',
  actionId: 'brand:00:01:investigate-gum-category',
  title: 'Investigate functional gum category',
  label: 'Investigate functional gum category',
  practice: 'Focus',
  domain: 'Focus',
  start: `${BLOCK_DATE}T09:00:00.000Z`,
  end: `${BLOCK_DATE}T10:00:00.000Z`,
  status: 'planned' as const,
  requiredSystemBlock: true,
};

const GUM_BLOCK_2 = {
  id: 'blk-gum-day2',
  cycleId: CYCLE_ID,
  goalId: GOAL_ID,
  origin: 'schedule_active' as const,
  deliverableId: 'd-gum-1',
  actionId: 'brand:00:02:white-label-vendor-research',
  title: 'White-label vendor research',
  label: 'White-label vendor research',
  practice: 'Focus',
  domain: 'Focus',
  start: '2026-05-03T09:00:00.000Z',
  end: '2026-05-03T10:00:00.000Z',
  status: 'planned' as const,
  requiredSystemBlock: true,
};

const GUM_BLOCK_3 = {
  id: 'blk-gum-day3',
  cycleId: CYCLE_ID,
  goalId: GOAL_ID,
  origin: 'schedule_active' as const,
  deliverableId: 'd-gum-2',
  actionId: 'brand:00:03:compile-supplier-shortlist',
  title: 'Compile supplier shortlist',
  label: 'Compile supplier shortlist',
  practice: 'Focus',
  domain: 'Focus',
  start: '2026-05-04T09:00:00.000Z',
  end: '2026-05-04T10:00:00.000Z',
  status: 'planned' as const,
  requiredSystemBlock: true,
};

const GUM_BLOCK_4 = {
  id: 'blk-gum-day4',
  cycleId: CYCLE_ID,
  goalId: GOAL_ID,
  origin: 'schedule_active' as const,
  title: 'Finalize manufacturer selection',
  label: 'Finalize manufacturer selection',
  practice: 'Focus',
  domain: 'Focus',
  start: '2026-05-05T09:00:00.000Z',
  end: '2026-05-05T10:00:00.000Z',
  status: 'planned' as const,
  requiredSystemBlock: true,
};

const CANONICAL_ACTIONS = [
  {
    id: 'brand:00:01:investigate-gum-category',
    dependencies: [],
    dependencyDetails: [],
  },
  {
    id: 'brand:00:02:white-label-vendor-research',
    dependencies: ['brand:00:01:investigate-gum-category'],
    dependencyDetails: [
      { actionId: 'brand:00:01:investigate-gum-category', dependencyType: 'hard_gate' },
    ],
  },
  {
    id: 'brand:00:03:compile-supplier-shortlist',
    dependencies: [],
    dependencyDetails: [],
  },
];

function buildBaseState(overrides: any = {}) {
  const appTime = {
    nowISO: `${BLOCK_DATE}T10:30:00.000Z`,
    activeDayKey: BLOCK_DATE,
    timeZone: 'UTC',
    isFollowingNow: true,
    ...(overrides.appTime || {}),
  };
  return {
    appTime,
    today: { date: appTime.activeDayKey, blocks: [{ ...GUM_BLOCK }] },
    currentWeek: {
      weekStart: BLOCK_DATE,
      days: [
        { date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK }] },
        { date: '2026-05-03', blocks: [{ ...GUM_BLOCK_2 }] },
        { date: '2026-05-04', blocks: [{ ...GUM_BLOCK_3 }] },
        { date: '2026-05-05', blocks: [{ ...GUM_BLOCK_4 }] },
      ],
    },
    cycle: [
      { date: BLOCK_DATE, blocks: [{ ...GUM_BLOCK }] },
      { date: '2026-05-03', blocks: [{ ...GUM_BLOCK_2 }] },
      { date: '2026-05-04', blocks: [{ ...GUM_BLOCK_3 }] },
      { date: '2026-05-05', blocks: [{ ...GUM_BLOCK_4 }] },
    ],
    ledger: [],
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    blockStore: {
      blocks: {
        [GUM_BLOCK.id]: { ...GUM_BLOCK },
        [GUM_BLOCK_2.id]: { ...GUM_BLOCK_2 },
        [GUM_BLOCK_3.id]: { ...GUM_BLOCK_3 },
        [GUM_BLOCK_4.id]: { ...GUM_BLOCK_4 },
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
    ...(overrides || {}),
  };
}

// ---------------------------------------------------------------------------
// Box 1: Today renders executable blocks for the active day
// ---------------------------------------------------------------------------

describe('Box 1: Today renders executable blocks for the active day', () => {
  it('active-schedule state has blocks on the current day', () => {
    const state = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const todayBlocks: any[] = state.today?.blocks || [];
    const dayBlock = todayBlocks.find((b: any) => b.id === GUM_BLOCK.id);
    expect(dayBlock).toBeDefined();
    expect(dayBlock.status).toBe('planned');
    expect(dayBlock.goalId).toBe(GOAL_ID);
    expect(dayBlock.cycleId).toBe(CYCLE_ID);
  });

  it('getAllBlocks includes the activated schedule block', () => {
    const state = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const all = getAllBlocks(state as any);
    const found = all.find((b: any) => b.id === GUM_BLOCK.id);
    expect(found).toBeDefined();
    expect(found?.goalId).toBe(GOAL_ID);
    expect(found?.cycleId).toBe(CYCLE_ID);
  });
});

// ---------------------------------------------------------------------------
// Box 2: COMPLETE_BLOCK writes canonical execution evidence with full identity
// ---------------------------------------------------------------------------

describe('Box 2: Completing a Today block writes canonical execution evidence', () => {
  let afterComplete: any;

  beforeAll(() => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    afterComplete = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id });
  });

  it('execution event is written to state.executionEvents', () => {
    const events: any[] = afterComplete.executionEvents || [];
    const evt = events.find((e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'complete');
    expect(evt).toBeDefined();
  });

  it('execution event carries correct goalId', () => {
    const evt = (afterComplete.executionEvents || []).find(
      (e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'complete'
    );
    expect(evt?.goalId).toBe(GOAL_ID);
  });

  it('execution event carries correct cycleId', () => {
    const evt = (afterComplete.executionEvents || []).find(
      (e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'complete'
    );
    expect(evt?.cycleId).toBe(CYCLE_ID);
  });

  it('execution event carries blockId and scheduled date', () => {
    const evt = (afterComplete.executionEvents || []).find(
      (e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'complete'
    );
    expect(evt?.blockId).toBe(GUM_BLOCK.id);
    expect(evt?.dateISO).toBe(BLOCK_DATE);
    expect(evt?.scheduledDate).toBe(BLOCK_DATE);
  });

  it('execution event has completed: true and status completed', () => {
    const evt = (afterComplete.executionEvents || []).find(
      (e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'complete'
    );
    expect(evt?.completed).toBe(true);
  });

  it('on-time completion includes execution truth classification', () => {
    const evt = (afterComplete.executionEvents || []).find(
      (e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'complete'
    );
    expect(evt?.eventDate).toBe(BLOCK_DATE);
    expect(evt?.temporalRelation).toBe('on_time');
    expect(evt?.source).toBe('user_action');
    expect(evt?.requiresReview).toBe(false);
    expect(evt?.recordedAtISO).toBe(`${BLOCK_DATE}T10:30:00.000Z`);
  });

  it('block status is updated to completed in today.blocks', () => {
    const todayBlock = (afterComplete.today?.blocks || []).find((b: any) => b.id === GUM_BLOCK.id);
    expect(todayBlock?.status).toBe('completed');
  });
});

// ---------------------------------------------------------------------------
// Box 3: MISS_BLOCK and SKIP_BLOCK write canonical execution evidence
// ---------------------------------------------------------------------------

describe('Box 3: Missed and skipped block actions write canonical execution evidence', () => {
  it('MISS_BLOCK writes execution event with status missed and correct identity', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'MISS_BLOCK', id: GUM_BLOCK.id });
    const events: any[] = after.executionEvents || [];
    const evt = events.find((e: any) => e.blockId === GUM_BLOCK.id && e.status === 'missed');
    expect(evt).toBeDefined();
    expect(evt?.kind).toBe('missed');
    expect(evt?.goalId).toBe(GOAL_ID);
    expect(evt?.cycleId).toBe(CYCLE_ID);
    expect(evt?.blockId).toBe(GUM_BLOCK.id);
    expect(evt?.dateISO).toBe(BLOCK_DATE);
    expect(evt?.completed).toBe(false);
  });

  it('MISS_BLOCK updates block status in today.blocks', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'MISS_BLOCK', id: GUM_BLOCK.id });
    const todayBlock = (after.today?.blocks || []).find((b: any) => b.id === GUM_BLOCK.id);
    expect(todayBlock?.status).toBe('missed');
  });

  it('SKIP_BLOCK writes execution event with status skipped and correct identity', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'SKIP_BLOCK', id: GUM_BLOCK.id });
    const events: any[] = after.executionEvents || [];
    const evt = events.find((e: any) => e.blockId === GUM_BLOCK.id && e.status === 'skipped');
    expect(evt).toBeDefined();
    expect(evt?.kind).toBe('skipped');
    expect(evt?.goalId).toBe(GOAL_ID);
    expect(evt?.cycleId).toBe(CYCLE_ID);
    expect(evt?.completed).toBe(false);
    expect(evt?.blockId).toBe(GUM_BLOCK.id);
    expect(evt?.dateISO).toBe(BLOCK_DATE);
  });

  it('SKIP_BLOCK updates block status in today.blocks', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'SKIP_BLOCK', id: GUM_BLOCK.id });
    const todayBlock = (after.today?.blocks || []).find((b: any) => b.id === GUM_BLOCK.id);
    expect(todayBlock?.status).toBe('skipped');
  });

  it('MISS_BLOCK preserves structured reason evidence when provided', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, {
      type: 'MISS_BLOCK',
      id: GUM_BLOCK.id,
      reasonCode: 'dependency_blocked',
      note: 'Waiting on vendor response',
    });
    const evt = (after.executionEvents || []).find((e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'missed');
    expect(evt?.reasonCode).toBe('dependency_blocked');
    expect(evt?.note).toBe('Waiting on vendor response');
    expect(evt?.source).toBe('user_action');
  });

  it('SKIP_BLOCK preserves structured reason evidence when provided', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, {
      type: 'SKIP_BLOCK',
      id: GUM_BLOCK.id,
      reasonCode: 'not_needed',
    });
    const evt = (after.executionEvents || []).find((e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'skipped');
    expect(evt?.reasonCode).toBe('not_needed');
  });
});

// ---------------------------------------------------------------------------
// Box 3B: Temporal truth classification distinguishes early/late/future claims
// ---------------------------------------------------------------------------

describe('Box 3B: Temporal truth classification', () => {
  it('completing a future scheduled block from today is classified as early', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK_3.id });
    const evt = (after.executionEvents || []).find((e: any) => e.blockId === GUM_BLOCK_3.id && e.kind === 'complete');
    expect(evt?.scheduledDate).toBe('2026-05-04');
    expect(evt?.eventDate).toBe(BLOCK_DATE);
    expect(evt?.temporalRelation).toBe('early');
    expect(['dependency_clear', 'not_applicable']).toContain(evt?.dependencyRelation);
    expect(evt?.requiresReview).toBe(false);
  });

  it('early completion with completed prerequisites is classified as dependency_clear', () => {
    const prerequisiteEvent = {
      id: `evt:complete:${GUM_BLOCK.id}:${BLOCK_DATE}:60`,
      blockId: GUM_BLOCK.id,
      dateISO: BLOCK_DATE,
      scheduledDate: BLOCK_DATE,
      eventDate: BLOCK_DATE,
      minutes: 60,
      rawLabel: GUM_BLOCK.title,
      domain: 'Focus',
      cycleId: CYCLE_ID,
      goalId: GOAL_ID,
      actionId: GUM_BLOCK.actionId,
      requiredSystemBlock: true,
      completed: true,
      kind: 'complete',
      status: 'completed',
      temporalRelation: 'on_time',
      dependencyRelation: 'not_applicable',
      source: 'user_action',
      requiresReview: false,
      recordedAtISO: `${BLOCK_DATE}T10:30:00.000Z`,
    };
    const truth = deriveExecutionTruthClassification({
      block: GUM_BLOCK_2,
      nowISO: `${BLOCK_DATE}T10:30:00.000Z`,
      activeDayKey: BLOCK_DATE,
      timeZone: 'UTC',
      executionEvents: [prerequisiteEvent as any],
      canonicalActions: CANONICAL_ACTIONS,
      source: 'user_action',
    });
    expect(truth.temporalRelation).toBe('early');
    expect(truth.dependencyRelation).toBe('dependency_clear');
    expect(truth.requiresReview).toBe(false);
  });

  it('early completion with unmet prerequisites is classified as dependency_order_violation', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK_2.id });
    const evt = (after.executionEvents || []).find((e: any) => e.blockId === GUM_BLOCK_2.id && e.kind === 'complete');
    expect(evt?.temporalRelation).toBe('early');
    expect(evt?.dependencyRelation).toBe('dependency_order_violation');
    expect(evt?.requiresReview).toBe(true);
  });

  it('early finalize-style completion without dependency metadata is classified conservatively', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK_4.id });
    const evt = (after.executionEvents || []).find((e: any) => e.blockId === GUM_BLOCK_4.id && e.kind === 'complete');
    expect(evt?.temporalRelation).toBe('early');
    expect(['dependency_unknown', 'dependency_suspicious']).toContain(evt?.dependencyRelation);
    expect(evt?.requiresReview).toBe(true);
  });

  it('completing an overdue past block on the current day is classified as late', () => {
    const base = computeDerivedState(
      buildBaseState({
        appTime: {
          nowISO: '2026-05-03T10:30:00.000Z',
          activeDayKey: '2026-05-03',
        },
      }) as any,
      { type: 'NO_OP' }
    );
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id });
    const evt = (after.executionEvents || []).find((e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'complete');
    expect(evt?.scheduledDate).toBe(BLOCK_DATE);
    expect(evt?.eventDate).toBe('2026-05-03');
    expect(evt?.temporalRelation).toBe('late');
  });

  it('backdated completion is classified as past_log and marked for review', () => {
    const base = computeDerivedState(
      buildBaseState({
        appTime: {
          nowISO: '2026-05-03T10:30:00.000Z',
          activeDayKey: BLOCK_DATE,
        },
      }) as any,
      { type: 'NO_OP' }
    );
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id });
    const evt = (after.executionEvents || []).find((e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'complete');
    expect(evt?.temporalRelation).toBe('past_log');
    expect(evt?.requiresReview).toBe(true);
  });

  it('future-dated claim is classified as future_claim and marked for review', () => {
    const base = computeDerivedState(
      buildBaseState({
        appTime: {
          nowISO: `${BLOCK_DATE}T10:30:00.000Z`,
          activeDayKey: '2026-05-03',
        },
      }) as any,
      { type: 'NO_OP' }
    );
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK_2.id });
    const evt = (after.executionEvents || []).find((e: any) => e.blockId === GUM_BLOCK_2.id && e.kind === 'complete');
    expect(evt?.temporalRelation).toBe('future_claim');
    expect(evt?.requiresReview).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Box 4: Execution state persists through canonical selector path
// ---------------------------------------------------------------------------

describe('Box 4: Execution state persists through selector path', () => {
  it('execution events survive a subsequent computeDerivedState pass', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id });
    const rederived = computeDerivedState(after, { type: 'NO_OP' });
    const evt = (rederived.executionEvents || []).find(
      (e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'complete'
    );
    expect(evt).toBeDefined();
    expect(evt?.goalId).toBe(GOAL_ID);
  });

  it('completed block status is stable after rederivation', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id });
    const rederived = computeDerivedState(after, { type: 'NO_OP' });
    const block = getAllBlocks(rederived as any).find((b: any) => b.id === GUM_BLOCK.id);
    expect(block?.status).toBe('completed');
  });

  it('missed event survives a subsequent computeDerivedState pass', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'MISS_BLOCK', id: GUM_BLOCK.id });
    const rederived = computeDerivedState(after, { type: 'NO_OP' });
    const evt = (rederived.executionEvents || []).find(
      (e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'missed' && e.status === 'missed'
    );
    expect(evt).toBeDefined();
    expect(evt?.goalId).toBe(GOAL_ID);
    expect(evt?.cycleId).toBe(CYCLE_ID);
    expect(evt?.dateISO).toBe(BLOCK_DATE);
  });

  it('skipped event survives a subsequent computeDerivedState pass', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'SKIP_BLOCK', id: GUM_BLOCK.id });
    const rederived = computeDerivedState(after, { type: 'NO_OP' });
    const evt = (rederived.executionEvents || []).find(
      (e: any) => e.blockId === GUM_BLOCK.id && e.kind === 'skipped' && e.status === 'skipped'
    );
    expect(evt).toBeDefined();
    expect(evt?.goalId).toBe(GOAL_ID);
    expect(evt?.cycleId).toBe(CYCLE_ID);
    expect(evt?.dateISO).toBe(BLOCK_DATE);
  });
});

// ---------------------------------------------------------------------------
// Box 5: Structure/Month schedule blocks remain stable after execution event
// ---------------------------------------------------------------------------

describe('Box 5: Structure/Month schedule remains stable after Today execution event', () => {
  it('second day block is unaffected after completing first day block', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id });
    const allBlocks = getAllBlocks(after as any);
    const day2Block = allBlocks.find((b: any) => b.id === GUM_BLOCK_2.id);
    expect(day2Block).toBeDefined();
    expect(day2Block?.status).toBe('planned');
  });

  it('total block count is unchanged after execution', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const countBefore = getAllBlocks(base as any).length;
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id });
    const countAfter = getAllBlocks(after as any).length;
    expect(countAfter).toBe(countBefore);
  });

  it('cyclesById scheduleReviewBlocks are untouched by execution', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id });
    const cycle = after.cyclesById?.[CYCLE_ID];
    expect(Array.isArray(cycle?.scheduleReviewBlocks)).toBe(true);
    expect(cycle?.scheduleReviewBlocks?.length ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Box 6: Feasibility is not promoted to Live P.O.S. by execution events
// ---------------------------------------------------------------------------

describe('Box 6: Feasibility not recomputed into Live POS in this slice', () => {
  it('goalPolicyByGoalId feasibility.state is not live_pos after one completion', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id });
    const policy = after.goalPolicyByGoalId?.[GOAL_ID];
    // feasibility.state must not be a live P.O.S. state
    // (live_pos is only computed after evidence accumulation through probabilityScore)
    const feasState = policy?.feasibility?.state;
    expect(feasState).not.toBe('live_pos');
    expect(feasState).not.toBe('activating');
    expect(feasState).not.toBe('stable');
    expect(feasState).not.toBe('at_risk');
  });

  it('posTrust.state is not live after a single completion event', () => {
    const base = computeDerivedState(buildBaseState() as any, { type: 'NO_OP' });
    const after = identityReducer(base as any, { type: 'COMPLETE_BLOCK', id: GUM_BLOCK.id });
    const policy = after.goalPolicyByGoalId?.[GOAL_ID];
    // posTrust should remain pre-execution (trusted/provisional), not live
    const posTrust = policy?.posTrust?.state;
    expect(['trusted', 'provisional', 'withheld']).toContain(posTrust);
  });
});
