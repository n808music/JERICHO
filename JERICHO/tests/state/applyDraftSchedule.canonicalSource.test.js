import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

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
  it('applies canonical proposedBlocks even when suggestedBlocks mirror diverges', () => {
    const next = computeDerivedState(buildState(), { type: 'APPLY_DRAFT_SCHEDULE', payload: { cycleId: 'cycle-apply-1' } });

    const createEvents = (next.executionEvents || []).filter((event) => event?.kind === 'create');
    expect(createEvents.length).toBeGreaterThan(0);
    expect(createEvents.some((event) => event?.suggestionId === 'p1')).toBe(true);
    expect(createEvents.some((event) => event?.suggestionId === 's1')).toBe(false);
  });

  it('uses canonical cycle.goalContract over goalExecutionContract mirror when creating blocks', () => {
    const state = buildState();
    state.cyclesById['cycle-apply-1'].goalContract.goalId = 'goal-canonical';
    state.goalExecutionContract.goalId = 'goal-mirror';
    const next = computeDerivedState(state, { type: 'APPLY_DRAFT_SCHEDULE', payload: { cycleId: 'cycle-apply-1' } });

    const createEvents = (next.executionEvents || []).filter((event) => event?.kind === 'create');
    expect(createEvents.length).toBeGreaterThan(0);
    expect(createEvents.every((event) => event?.goalId === 'goal-canonical')).toBe(true);
  });

  it('returns NO_PROPOSED_BLOCKS and does not re-apply when all blocks are already accepted', () => {
    const generated = computeDerivedState(buildState(), { type: 'APPLY_DRAFT_SCHEDULE', payload: { cycleId: 'cycle-apply-1' } });
    const eventCountAfterGenerate = (generated.executionEvents || []).length;
    expect(eventCountAfterGenerate).toBeGreaterThan(0);
    expect((generated.proposedBlocks || []).every((block) => block?.status === 'accepted')).toBe(true);

    const reapplied = computeDerivedState(generated, { type: 'APPLY_DRAFT_SCHEDULE', payload: { cycleId: 'cycle-apply-1' } });

    expect((reapplied.executionEvents || []).length).toBe(eventCountAfterGenerate);
    expect(reapplied.lastPlanError?.code).toBe('NO_PROPOSED_BLOCKS');
    expect((reapplied.proposedBlocks || []).every((block) => block?.status === 'accepted')).toBe(true);
  });
});
