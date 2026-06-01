import { describe, expect, it } from 'vitest';
import { computeDerivedState, getAllBlocks, getCanonicalBlocks } from '../../src/state/identityCompute.js';

function buildState() {
  const cycleId = 'cycle-apply-1';
  const dayKey = '2026-03-10';
  return {
    appTime: { timeZone: 'UTC', nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, isFollowingNow: true },
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    vector: {},
    lenses: { aim: {}, pattern: { dailyTargets: [] }, flow: {} },
    executionEvents: [],
    suggestionEvents: [],
    proposedBlocks: [
      {
        id: 'p1',
        goalId: 'goal-1',
        cycleId,
        status: 'suggested',
        title: 'Canonical Proposed Title',
        startISO: '2026-03-11T09:00:00.000Z',
        dayKey: '2026-03-11',
        durationMinutes: 60,
        domain: 'FOCUS',
      },
    ],
    suggestedBlocks: [
      {
        id: 's1',
        goalId: 'goal-1',
        cycleId,
        status: 'suggested',
        title: 'Mirror Suggested Title',
        startISO: '2026-03-12T09:00:00.000Z',
        dayKey: '2026-03-12',
        durationMinutes: 60,
        domain: 'FOCUS',
      },
    ],
    constraints: {},
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId: 'goal-1', startDayKey: dayKey, endDayKey: '2026-03-30' },
        proposedBlocks: [
          {
            id: 'p1',
            goalId: 'goal-1',
            cycleId,
            status: 'suggested',
            title: 'Canonical Proposed Title',
            startISO: '2026-03-11T09:00:00.000Z',
            dayKey: '2026-03-11',
            durationMinutes: 60,
            domain: 'FOCUS',
          },
        ],
        suggestedBlocks: [
          {
            id: 's1',
            goalId: 'goal-1',
            cycleId,
            status: 'suggested',
            title: 'Mirror Suggested Title',
            startISO: '2026-03-12T09:00:00.000Z',
            dayKey: '2026-03-12',
            durationMinutes: 60,
            domain: 'FOCUS',
          },
        ],
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId: 'goal-1', startDayKey: dayKey, endDayKey: '2026-03-30' },
    lastPlanError: null,
  };
}

describe('APPLY_DRAFT_SCHEDULE canonical proposal source', () => {
  it('applies canonical proposedBlocks into review blocks even when suggestedBlocks mirror diverges', () => {
    const next = computeDerivedState(buildState(), {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });

    expect(next.scheduleLifecycle).toBe('applied_review');
    expect((next.executionEvents || []).filter((event) => event?.kind === 'create')).toHaveLength(0);
    expect((next.scheduleReviewBlocks || []).some((block) => block?.suggestionId === 'p1')).toBe(true);
    expect((next.scheduleReviewBlocks || []).some((block) => block?.suggestionId === 's1')).toBe(false);
    const transitionTraceLog = (next.debug?.traceLog || []).filter((entry) => entry?.transition);
    expect(transitionTraceLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transition: 'apply',
          blockId: 'p1',
          label: 'Canonical Proposed Title',
        }),
      ])
    );
  });

  it('uses canonical cycle.goalContract over goalExecutionContract mirror when activating blocks', () => {
    const state = buildState();
    state.cyclesById['cycle-apply-1'].goalContract.goalId = 'goal-canonical';
    state.goalExecutionContract.goalId = 'goal-mirror';
    const reviewed = computeDerivedState(state, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });
    const next = computeDerivedState(reviewed, { type: 'ACTIVATE_SCHEDULE', payload: { cycleId: 'cycle-apply-1' } });

    const createEvents = (next.executionEvents || []).filter((event) => event?.kind === 'create');
    expect(createEvents.length).toBeGreaterThan(0);
    expect(createEvents.every((event) => event?.goalId === 'goal-canonical')).toBe(true);
  });

  it('rematerializes today and cycle views after activating reviewed blocks', () => {
    const reviewed = computeDerivedState(buildState(), {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });
    const next = computeDerivedState(reviewed, {
      type: 'ACTIVATE_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });

    expect((reviewed.executionEvents || []).some((event) => event?.kind === 'create')).toBe(false);
    expect((reviewed.cycle || []).some((day) => Array.isArray(day?.blocks) && day.blocks.length > 0)).toBe(true);
    expect((next.executionEvents || []).some((event) => event?.kind === 'create')).toBe(true);
    expect((next.cycle || []).some((day) => Array.isArray(day?.blocks) && day.blocks.length > 0)).toBe(true);
  });

  it('returns NO_PROPOSED_BLOCKS and does not re-apply when all blocks are already accepted', () => {
    const generated = computeDerivedState(buildState(), {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });
    const eventCountAfterGenerate = (generated.executionEvents || []).length;
    expect(eventCountAfterGenerate).toBe(0);
    expect((generated.proposedBlocks || []).every((block) => block?.status === 'accepted')).toBe(true);

    const reapplied = computeDerivedState(generated, {
      type: 'APPLY_DRAFT_SCHEDULE',
      payload: { cycleId: 'cycle-apply-1' },
    });

    expect((reapplied.executionEvents || []).length).toBe(eventCountAfterGenerate);
    expect(reapplied.lastPlanError?.code).toBe('NO_PROPOSED_BLOCKS');
    expect((reapplied.proposedBlocks || []).every((block) => block?.status === 'accepted')).toBe(true);
  });
});
