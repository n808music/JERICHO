import { describe, expect, it } from 'vitest';
import { computeDerivedState } from '../../src/state/identityCompute.js';

function makeCreateEvent({ blockId, cycleId, goalId, startISO, endISO, status = 'planned', completed = false }) {
  const minutes = Math.max(1, Math.round((Date.parse(endISO) - Date.parse(startISO)) / 60000));
  return {
    id: `evt:create:${blockId}`,
    blockId,
    dateISO: startISO.slice(0, 10),
    minutes,
    rawLabel: `Block ${blockId}`,
    domain: 'Focus',
    cycleId,
    goalId,
    origin: 'manual',
    completed,
    kind: 'create',
    startISO,
    endISO,
    status,
  };
}

function makeState({ nowISO = '2026-03-10T12:00:00.000Z', executionEvents = [], proposedBlocks = [] } = {}) {
  const dayKey = nowISO.slice(0, 10);
  const cycleId = 'cycle-tv';
  const goalId = 'goal-tv';
  return {
    appTime: { nowISO, activeDayKey: dayKey, timeZone: 'UTC' },
    today: { date: dayKey, blocks: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        goalContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-05-09' },
        executionEvents: executionEvents.map((event) => ({ ...event })),
        proposedBlocks: proposedBlocks.map((block) => ({ ...block })),
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-05-09' },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    executionEvents: executionEvents.map((event) => ({ ...event })),
    suggestionEvents: [],
    proposedBlocks: proposedBlocks.map((block) => ({ ...block })),
    suggestedBlocks: proposedBlocks.map((block) => ({ ...block })),
    constraints: {},
    cycleDynamicsByCycleId: {},
  };
}

function latestEventForBlock(events, blockId) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event?.blockId === blockId) {
      return event;
    }
  }
  return null;
}

describe('cycle dynamics deterministic enforcement', () => {
  it('transitions a past-due planned committed block to missed', () => {
    const state = makeState({
      executionEvents: [
        makeCreateEvent({
          blockId: 'blk-past',
          cycleId: 'cycle-tv',
          goalId: 'goal-tv',
          startISO: '2026-03-09T09:00:00.000Z',
          endISO: '2026-03-09T10:00:00.000Z',
          status: 'planned',
        }),
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const latest = latestEventForBlock(next.executionEvents, 'blk-past');

    expect(latest?.kind).toBe('update');
    expect(latest?.status).toBe('missed');
    expect(latest?.missedAtISO).toBe('2026-03-10T12:00:00.000Z');
    expect(next.cycleDynamicsByCycleId['cycle-tv'].recommendedTransitions.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps future committed block planned', () => {
    const state = makeState({
      executionEvents: [
        makeCreateEvent({
          blockId: 'blk-future',
          cycleId: 'cycle-tv',
          goalId: 'goal-tv',
          startISO: '2026-03-11T09:00:00.000Z',
          endISO: '2026-03-11T10:00:00.000Z',
          status: 'planned',
        }),
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const updates = next.executionEvents.filter((event) => event?.blockId === 'blk-future' && event?.kind === 'update');

    expect(updates.length).toBe(0);
    const latest = latestEventForBlock(next.executionEvents, 'blk-future');
    expect(latest?.status).toBe('planned');
  });

  it('keeps completed past block completed', () => {
    const state = makeState({
      executionEvents: [
        makeCreateEvent({
          blockId: 'blk-completed',
          cycleId: 'cycle-tv',
          goalId: 'goal-tv',
          startISO: '2026-03-09T09:00:00.000Z',
          endISO: '2026-03-09T10:00:00.000Z',
          status: 'completed',
          completed: true,
        }),
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const updates = next.executionEvents.filter(
      (event) => event?.blockId === 'blk-completed' && event?.kind === 'update'
    );

    expect(updates.length).toBe(0);
    const latest = latestEventForBlock(next.executionEvents, 'blk-completed');
    expect(latest?.status).toBe('completed');
  });

  it('does not mutate committed blocks from another cycle/goal', () => {
    const state = makeState({
      executionEvents: [
        makeCreateEvent({
          blockId: 'blk-active',
          cycleId: 'cycle-tv',
          goalId: 'goal-tv',
          startISO: '2026-03-09T09:00:00.000Z',
          endISO: '2026-03-09T10:00:00.000Z',
          status: 'planned',
        }),
        makeCreateEvent({
          blockId: 'blk-foreign',
          cycleId: 'cycle-saas',
          goalId: 'goal-saas',
          startISO: '2026-03-09T11:00:00.000Z',
          endISO: '2026-03-09T12:00:00.000Z',
          status: 'planned',
        }),
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const foreignUpdates = next.executionEvents.filter(
      (event) => event?.blockId === 'blk-foreign' && event?.kind === 'update'
    );
    const activeUpdates = next.executionEvents.filter(
      (event) => event?.blockId === 'blk-active' && event?.kind === 'update'
    );

    expect(activeUpdates.length).toBe(1);
    expect(foreignUpdates.length).toBe(0);
    expect(latestEventForBlock(next.executionEvents, 'blk-foreign')?.status).toBe('planned');
  });

  it('is idempotent across repeated recompute passes', () => {
    const state = makeState({
      executionEvents: [
        makeCreateEvent({
          blockId: 'blk-idempotent',
          cycleId: 'cycle-tv',
          goalId: 'goal-tv',
          startISO: '2026-03-09T09:00:00.000Z',
          endISO: '2026-03-09T10:00:00.000Z',
          status: 'planned',
        }),
      ],
    });

    const pass1 = computeDerivedState(state, { type: 'NO_OP' });
    const pass2 = computeDerivedState(pass1, { type: 'NO_OP' });

    const updateEvents = pass2.executionEvents.filter(
      (event) => event?.blockId === 'blk-idempotent' && event?.kind === 'update'
    );
    expect(updateEvents.length).toBe(1);
    expect(latestEventForBlock(pass2.executionEvents, 'blk-idempotent')?.status).toBe('missed');
  });

  it('keeps scoring/POS pipeline executable after transitions', () => {
    const state = makeState({
      executionEvents: [
        makeCreateEvent({
          blockId: 'blk-score',
          cycleId: 'cycle-tv',
          goalId: 'goal-tv',
          startISO: '2026-03-09T09:00:00.000Z',
          endISO: '2026-03-09T10:00:00.000Z',
          status: 'planned',
        }),
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    const metrics = next?.cyclesById?.['cycle-tv']?.metrics;

    expect(metrics).toBeTruthy();
    expect('integrityScore' in metrics).toBe(true);
    expect('posScore' in metrics).toBe(true);
  });

  it('does not mutate draft/proposed schedule items', () => {
    const state = makeState({
      executionEvents: [
        makeCreateEvent({
          blockId: 'blk-safe',
          cycleId: 'cycle-tv',
          goalId: 'goal-tv',
          startISO: '2026-03-09T09:00:00.000Z',
          endISO: '2026-03-09T10:00:00.000Z',
          status: 'planned',
        }),
      ],
      proposedBlocks: [
        {
          id: 'proposal-1',
          cycleId: 'cycle-tv',
          goalId: 'goal-tv',
          status: 'suggested',
          startISO: '2026-03-15T09:00:00.000Z',
          durationMinutes: 60,
          title: 'Draft block',
        },
      ],
    });

    const next = computeDerivedState(state, { type: 'NO_OP' });
    expect(next.proposedBlocks[0].status).toBe('suggested');
    expect(next.suggestedBlocks[0].status).toBe('suggested');
  });
});
