import { describe, expect, it } from 'vitest';
import { computeDerivedState, getCanonicalBlocks } from '../../src/state/identityCompute.js';

function makeState() {
  const dayKey = '2026-03-10';
  const cycleId = 'cycle-lifecycle';
  const goalId = 'goal-lifecycle';
  return {
    appTime: { nowISO: `${dayKey}T12:00:00.000Z`, activeDayKey: dayKey, timeZone: 'UTC' },
    today: { date: dayKey, blocks: [], completionRate: 0, driftSignal: 'contained', loadByPractice: {}, practices: [] },
    currentWeek: { weekStart: dayKey, days: [] },
    cycle: [],
    executionEvents: [
      {
        id: 'evt-early',
        blockId: 'blk-early',
        dateISO: '2026-03-12',
        minutes: 60,
        rawLabel: 'Earlier block',
        canonicalTitle: 'Earlier block',
        domain: 'Focus',
        cycleId,
        goalId,
        origin: 'schedule_active',
        requiredSystemBlock: true,
        completed: false,
        kind: 'create',
        startISO: '2026-03-12T09:00:00.000Z',
        endISO: '2026-03-12T10:00:00.000Z',
        status: 'planned',
      },
      {
        id: 'evt-late',
        blockId: 'blk-late',
        dateISO: '2026-03-13',
        minutes: 60,
        rawLabel: 'Later block',
        canonicalTitle: 'Later block',
        domain: 'Focus',
        cycleId,
        goalId,
        origin: 'schedule_active',
        requiredSystemBlock: true,
        completed: false,
        kind: 'create',
        startISO: '2026-03-13T09:00:00.000Z',
        endISO: '2026-03-13T10:00:00.000Z',
        status: 'planned',
      },
      {
        id: 'evt-required',
        blockId: 'blk-required',
        dateISO: '2026-03-11',
        minutes: 60,
        rawLabel: 'Required block',
        canonicalTitle: 'Required block',
        domain: 'Focus',
        cycleId,
        goalId,
        origin: 'schedule_active',
        requiredSystemBlock: true,
        completed: false,
        kind: 'create',
        startISO: '2026-03-11T09:00:00.000Z',
        endISO: '2026-03-11T10:00:00.000Z',
        status: 'planned',
        deliverableId: 'deliv-1',
        criterionId: 'crit-1',
      },
    ],
    proposedBlocks: [],
    suggestedBlocks: [],
    blockStore: {
      blocks: {
        'blk-early': {
          id: 'blk-early',
          cycleId,
          goalId,
          origin: 'schedule_active',
          requiredSystemBlock: true,
          practice: 'Focus',
          domain: 'Focus',
          title: 'Earlier block',
          label: 'Earlier block',
          start: '2026-03-12T09:00:00.000Z',
          end: '2026-03-12T10:00:00.000Z',
          status: 'planned',
        },
        'blk-late': {
          id: 'blk-late',
          cycleId,
          goalId,
          origin: 'schedule_active',
          requiredSystemBlock: true,
          practice: 'Focus',
          domain: 'Focus',
          title: 'Later block',
          label: 'Later block',
          start: '2026-03-13T09:00:00.000Z',
          end: '2026-03-13T10:00:00.000Z',
          status: 'planned',
        },
        'blk-required': {
          id: 'blk-required',
          cycleId,
          goalId,
          origin: 'schedule_active',
          requiredSystemBlock: true,
          practice: 'Focus',
          domain: 'Focus',
          title: 'Required block',
          label: 'Required block',
          start: '2026-03-11T09:00:00.000Z',
          end: '2026-03-11T10:00:00.000Z',
          status: 'planned',
          deliverableId: 'deliv-1',
          criterionId: 'crit-1',
        },
      },
    },
    cyclesById: {
      [cycleId]: {
        id: cycleId,
        status: 'active',
        scheduleLifecycle: 'active_schedule',
        scheduleReviewBlocks: [],
        executionEvents: [
          {
            id: 'evt-early',
            blockId: 'blk-early',
            dateISO: '2026-03-12',
            minutes: 60,
            rawLabel: 'Earlier block',
            canonicalTitle: 'Earlier block',
            domain: 'Focus',
            cycleId,
            goalId,
            origin: 'schedule_active',
            requiredSystemBlock: true,
            completed: false,
            kind: 'create',
            startISO: '2026-03-12T09:00:00.000Z',
            endISO: '2026-03-12T10:00:00.000Z',
            status: 'planned',
          },
          {
            id: 'evt-late',
            blockId: 'blk-late',
            dateISO: '2026-03-13',
            minutes: 60,
            rawLabel: 'Later block',
            canonicalTitle: 'Later block',
            domain: 'Focus',
            cycleId,
            goalId,
            origin: 'schedule_active',
            requiredSystemBlock: true,
            completed: false,
            kind: 'create',
            startISO: '2026-03-13T09:00:00.000Z',
            endISO: '2026-03-13T10:00:00.000Z',
            status: 'planned',
          },
          {
            id: 'evt-required',
            blockId: 'blk-required',
            dateISO: '2026-03-11',
            minutes: 60,
            rawLabel: 'Required block',
            canonicalTitle: 'Required block',
            domain: 'Focus',
            cycleId,
            goalId,
            origin: 'schedule_active',
            requiredSystemBlock: true,
            completed: false,
            kind: 'create',
            startISO: '2026-03-11T09:00:00.000Z',
            endISO: '2026-03-11T10:00:00.000Z',
            status: 'planned',
            deliverableId: 'deliv-1',
            criterionId: 'crit-1',
          },
        ],
        goalContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-04-01' },
      },
    },
    activeCycleId: cycleId,
    goalExecutionContract: { goalId, startDayKey: '2026-03-01', endDayKey: '2026-04-01' },
    goalAdmissionByGoal: { [goalId]: { status: 'ADMITTED', reasonCodes: [] } },
    constraints: {},
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

describe('block lifecycle contract', () => {
  it('blocks delete on active required system blocks but allows reschedule', () => {
    const deleteAttempt = computeDerivedState(makeState(), {
      type: 'DELETE_BLOCK',
      id: 'blk-required',
    });

    expect(deleteAttempt.lastPlanError?.code).toBe('REQUIRED_BLOCK_DELETE_DISALLOWED');
    expect(getCanonicalBlocks(deleteAttempt).some((block) => block.id === 'blk-required')).toBe(true);

    const rescheduled = computeDerivedState(deleteAttempt, {
      type: 'RESCHEDULE_BLOCK',
      id: 'blk-required',
      start: '2026-03-11T12:00:00.000Z',
      end: '2026-03-11T13:00:00.000Z',
    });

    const rescheduleEvent = latestEventForBlock(rescheduled.executionEvents || [], 'blk-required');
    expect(rescheduleEvent?.kind).toBe('reschedule');
    expect(rescheduleEvent?.startISO).toBe('2026-03-11T12:00:00.000Z');
    expect(rescheduleEvent?.endISO).toBe('2026-03-11T13:00:00.000Z');
  });

  it('allows completing an active required block and records completion evidence', () => {
    const completed = computeDerivedState(makeState(), {
      type: 'COMPLETE_BLOCK',
      id: 'blk-required',
    });

    const completedEvent = latestEventForBlock(completed.executionEvents || [], 'blk-required');
    expect(completedEvent?.kind).toBe('complete');
    expect(completedEvent?.status).toBe('completed');
    expect(getCanonicalBlocks(completed).find((block) => block.id === 'blk-required')?.status).toBe('completed');
  });

  it('allows bounded edit of an active required block while preserving deliverable lineage', () => {
    const edited = computeDerivedState(makeState(), {
      type: 'UPDATE_BLOCK',
      payload: {
        id: 'blk-required',
        surface: 'today',
        title: 'Required block updated',
      },
    });

    const updatedBlock =
      (edited.currentWeek?.days || [])
        .flatMap((day) => day?.blocks || [])
        .find((block) => block.id === 'blk-required') ||
      (edited.cycle || []).flatMap((day) => day?.blocks || []).find((block) => block.id === 'blk-required');
    expect(updatedBlock?.title).toBe('Required block updated');
    expect(updatedBlock?.deliverableId).toBe('deliv-1');
    expect(updatedBlock?.criterionId).toBe('crit-1');
  });

  it('allows later completion before earlier completion without corrupting predecessor state', () => {
    const next = computeDerivedState(makeState(), {
      type: 'COMPLETE_BLOCK',
      id: 'blk-late',
    });

    expect(latestEventForBlock(next.executionEvents || [], 'blk-late')?.status).toBe('completed');
    expect(latestEventForBlock(next.executionEvents || [], 'blk-early')?.status).toBe('planned');
    expect(next.lastPlanError?.code || null).toBeNull();
  });
});
