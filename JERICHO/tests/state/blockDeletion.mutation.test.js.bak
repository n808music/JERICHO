import { describe, expect, it } from 'vitest';

import { computeDerivedState, getAllBlocks } from '../../src/state/identityCompute.js';

const CYCLE_ID = 'cycle-delete-mutation';
const GOAL_ID = 'goal-delete-mutation';
const DAY = '2026-05-02';

const OPTIONAL_BLOCK = {
  id: 'blk-delete-optional',
  cycleId: CYCLE_ID,
  goalId: GOAL_ID,
  origin: 'manual',
  actionId: 'act-delete-optional',
  deliverableId: 'del-delete-optional',
  title: 'Optional research block',
  label: 'Optional research block',
  practice: 'Focus',
  domain: 'Focus',
  start: `${DAY}T09:00:00.000Z`,
  end: `${DAY}T10:00:00.000Z`,
  status: 'planned',
  requiredSystemBlock: false,
};

function buildBaseState(overrides = {}) {
  return {
    appTime: {
      nowISO: `${DAY}T10:30:00.000Z`,
      activeDayKey: DAY,
      timeZone: 'UTC',
      isFollowingNow: true,
    },
    today: { date: DAY, blocks: [{ ...OPTIONAL_BLOCK }] },
    currentWeek: { weekStart: DAY, days: [{ date: DAY, blocks: [{ ...OPTIONAL_BLOCK }] }] },
    cycle: [{ date: DAY, blocks: [{ ...OPTIONAL_BLOCK }] }],
    ledger: [],
    executionEvents: [],
    planMutationEvents: [],
    suggestionEvents: [],
    proposedBlocks: [],
    suggestedBlocks: [],
    blockStore: { blocks: { [OPTIONAL_BLOCK.id]: { ...OPTIONAL_BLOCK } } },
    scheduleApplied: true,
    scheduleLifecycle: 'applied_review',
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
        scheduleLifecycle: 'applied_review',
        scheduleReviewBlocks: [{ ...OPTIONAL_BLOCK }],
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
        actions: [{ id: 'act-delete-optional', dependencies: [], dependencyDetails: [] }],
        executionEvents: [],
        planMutationEvents: [],
        metrics: {},
      },
    },
    lastPlanError: null,
    ...overrides,
  };
}

describe('block deletion mutation semantics', () => {
  it('preserves a plan-mutation audit record when a block is removed', () => {
    const base = computeDerivedState(buildBaseState(), { type: 'NO_OP' });
    const after = computeDerivedState(base, {
      type: 'DELETE_BLOCK',
      id: OPTIONAL_BLOCK.id,
      reasonCode: 'bad_plan',
      note: 'Removed from review queue',
    });

    const mutation = (after.planMutationEvents || []).find((event) => event.blockId === OPTIONAL_BLOCK.id);
    expect(mutation).toBeDefined();
    expect(mutation.kind).toBe('remove_block');
    expect(mutation.mutationType).toBe('plan_block_removed');
    expect(mutation.goalId).toBe(GOAL_ID);
    expect(mutation.cycleId).toBe(CYCLE_ID);
    expect(mutation.scheduledDate).toBe(DAY);
    expect(mutation.removedAtISO).toBe(`${DAY}T10:30:00.000Z`);
    expect(mutation.reasonCode).toBe('bad_plan');
    expect(mutation.note).toBe('Removed from review queue');
    expect(after.cyclesById?.[CYCLE_ID]?.planMutationEvents?.length).toBe(1);
  });

  it('removal does not create a fake completion event and removes the block from projections', () => {
    const base = computeDerivedState(buildBaseState(), { type: 'NO_OP' });
    const after = computeDerivedState(base, {
      type: 'DELETE_BLOCK',
      id: OPTIONAL_BLOCK.id,
      reasonCode: 'duplicate',
    });

    const deleteEvent = (after.executionEvents || []).find((event) => event.blockId === OPTIONAL_BLOCK.id && event.kind === 'delete');
    const completeEvents = (after.executionEvents || []).filter(
      (event) => event.blockId === OPTIONAL_BLOCK.id && event.kind === 'complete'
    );

    expect(deleteEvent).toBeDefined();
    expect(completeEvents).toHaveLength(0);
    expect(getAllBlocks(after).find((block) => block.id === OPTIONAL_BLOCK.id)).toBeFalsy();
    expect(after.blockStore?.blocks?.[OPTIONAL_BLOCK.id]).toBeUndefined();
  });

  it('existing execution evidence for the block is not erased by later removal', () => {
    const priorComplete = {
      id: `evt:complete:${OPTIONAL_BLOCK.id}:${DAY}:60`,
      blockId: OPTIONAL_BLOCK.id,
      dateISO: DAY,
      minutes: 60,
      rawLabel: OPTIONAL_BLOCK.title,
      domain: 'Focus',
      cycleId: CYCLE_ID,
      goalId: GOAL_ID,
      actionId: OPTIONAL_BLOCK.actionId,
      requiredSystemBlock: false,
      completed: true,
      kind: 'complete',
      status: 'completed',
    };
    const base = computeDerivedState(
      buildBaseState({
        executionEvents: [priorComplete],
        cyclesById: {
          [CYCLE_ID]: {
            ...buildBaseState().cyclesById[CYCLE_ID],
            executionEvents: [priorComplete],
          },
        },
      }),
      { type: 'NO_OP' }
    );
    const after = computeDerivedState(base, {
      type: 'DELETE_BLOCK',
      id: OPTIONAL_BLOCK.id,
      reasonCode: 'completed_elsewhere',
    });

    expect((after.executionEvents || []).some((event) => event.blockId === OPTIONAL_BLOCK.id && event.kind === 'complete')).toBe(true);
    expect((after.executionEvents || []).some((event) => event.blockId === OPTIONAL_BLOCK.id && event.kind === 'delete')).toBe(true);
  });

  it('required block removal is visible as plan mutation risk to course correction', () => {
    const requiredBlock = { ...OPTIONAL_BLOCK, id: 'blk-delete-required', requiredSystemBlock: true };
    const base = computeDerivedState(
      buildBaseState({
        today: { date: DAY, blocks: [{ ...requiredBlock }] },
        currentWeek: { weekStart: DAY, days: [{ date: DAY, blocks: [{ ...requiredBlock }] }] },
        cycle: [{ date: DAY, blocks: [{ ...requiredBlock }] }],
        blockStore: { blocks: { [requiredBlock.id]: { ...requiredBlock } } },
        cyclesById: {
          [CYCLE_ID]: {
            ...buildBaseState().cyclesById[CYCLE_ID],
            scheduleLifecycle: 'applied_review',
            scheduleReviewBlocks: [{ ...requiredBlock }],
          },
        },
      }),
      { type: 'NO_OP' }
    );
    const after = computeDerivedState(base, {
      type: 'DELETE_BLOCK',
      id: requiredBlock.id,
      reasonCode: 'scope_change',
    });
    const correction = after.executionCorrectionByGoal?.[GOAL_ID];
    expect(correction.planMutationCount).toBe(1);
    expect(correction.requiredRemovedBlockCount).toBe(1);
    expect(correction.reasonCodes).toContain('required_block_removed');
    expect(correction.reasonCodes).toContain('plan_mutation_review_required');
    expect(correction.level).toBe('compression_warning');
  });
});
