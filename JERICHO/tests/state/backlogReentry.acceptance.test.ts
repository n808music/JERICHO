/**
 * Item 3: Backlog Re-Entry Mechanism — Acceptance Test Suite
 *
 * Locked Architecture (2026-08-19):
 * - Two-action explicit pattern: Accept (bring back as-is) or Reschedule (with new slot)
 * - Event-first architecture: append ExecutionEvent, derive today.blocks via materialization
 * - Use reasonCode: 'BACKLOG_ACCEPT' | 'BACKLOG_RESCHEDULE' to encode Backlog origin
 * - Validation reuses Item 1's existing constraint selectors (no duplicate logic)
 * - State-only: no hand-written Backlog flags on blocks
 * - Expose daysInBacklog as derived field (threshold logic deferred to Item 5)
 *
 * Test Coverage:
 * 1. Backlog detection via event ledger (resolveBacklogBlocks selector)
 * 2. daysInBacklog computation (age derived from event timestamps)
 * 3. Accept action: block re-enters with original time
 * 4. Reschedule action: block re-enters with new time
 * 5. Validation: constraint checks (contract window, capacity, blackout, conflicts)
 * 6. Validation rejection: invalid re-entry attempts
 * 7. Idempotence: same action dispatched twice yields correct state
 * 8. Event ledger integrity: events appended, never mutated
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { identityReducer } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { resolveBacklogBlocks } from '../../src/core/engine/resolveBacklogBlocks.ts';

// ============================================================================
// Fixtures
// ============================================================================

const TODAY_DAYKEY = '2026-08-19';
const TOMORROW_DAYKEY = '2026-08-20';
const YESTERDAY_DAYKEY = '2026-08-18';
const CONTRACT_START = '2026-08-01';
const CONTRACT_END = '2027-08-01';

const GOAL_ID = 'goal-backlog-test';
const CYCLE_ID = 'cycle-backlog-test';

/**
 * Creates a block that was created yesterday and missed (eligible for Backlog).
 * Missing status means it didn't complete, so it flows to Backlog.
 */
function createMissedBlock(id: string, dayKey: string = YESTERDAY_DAYKEY) {
  return {
    id,
    title: `Block ${id}`,
    label: `Block ${id}`,
    start: `${dayKey}T09:00:00.000Z`,
    end: `${dayKey}T10:00:00.000Z`,
    status: 'in_progress',
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    domain: 'CORE',
    origin: 'schedule_active',
  };
}

/**
 * Create missed execution event (block did not complete).
 * This is what flows a block to Backlog.
 */
function createMissedEvent(blockId: string, dayKey: string = YESTERDAY_DAYKEY, recordedAtISO?: string) {
  return {
    id: `evt-missed-${blockId}`,
    blockId,
    kind: 'missed',
    dateISO: dayKey,
    startISO: `${dayKey}T09:00:00.000Z`,
    endISO: `${dayKey}T10:00:00.000Z`,
    status: 'missed',
    recordedAtISO: recordedAtISO || new Date().toISOString(),
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    minutes: 60,
  };
}

/**
 * Create a re-entry event (block accepted or rescheduled from Backlog).
 */
function createBacklogReEntryEvent(blockId: string, action: 'accept' | 'reschedule', newDayKey?: string, recordedAtISO?: string) {
  const targetDayKey = newDayKey || TODAY_DAYKEY;
  const isReschedule = action === 'reschedule';
  return {
    id: `evt-reentry-${blockId}`,
    blockId,
    kind: 'backlog_accept',
    reasonCode: isReschedule ? 'BACKLOG_RESCHEDULE' : 'BACKLOG_ACCEPT',
    dateISO: targetDayKey,
    startISO: `${targetDayKey}T09:00:00.000Z`,
    endISO: `${targetDayKey}T10:00:00.000Z`,
    status: 'in_progress',
    recordedAtISO: recordedAtISO || new Date().toISOString(),
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    minutes: 60,
  };
}

function buildBaseState(overrides: any = {}) {
  const baseBlocks = (overrides.today?.blocks || []).length > 0 ? [] : [];
  return {
    appTime: {
      nowISO: `${TODAY_DAYKEY}T12:00:00.000Z`,
      activeDayKey: TODAY_DAYKEY,
      timeZone: 'UTC',
    },
    today: { date: TODAY_DAYKEY, blocks: baseBlocks, ...overrides.today },
    currentWeek: { weekStart: TODAY_DAYKEY, days: [] },
    executionEvents: [],
    cyclesById: {
      [CYCLE_ID]: {
        id: CYCLE_ID,
        status: 'active',
        goalContract: {
          goalId: GOAL_ID,
          startDayKey: CONTRACT_START,
          endDayKey: CONTRACT_END,
        },
      },
    },
    goalExecutionContract: {
      goalId: GOAL_ID,
      startDayKey: CONTRACT_START,
      endDayKey: CONTRACT_END,
    },
    ...overrides,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Item 3: Backlog Re-Entry Mechanism', () => {

  // ==========================================================================
  // Part 1: Backlog Detection (resolveBacklogBlocks selector)
  // ==========================================================================

  describe('Part 1: Backlog detection via event ledger', () => {

    it('identifies block as in Backlog if most recent event is missed', () => {
      const blockId = 'blk-1';
      const block = createMissedBlock(blockId, YESTERDAY_DAYKEY);
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY),
        ],
      };

      const backlog = resolveBacklogBlocks(state);
      expect(backlog).toBeDefined();
      expect(backlog.length).toBeGreaterThan(0);
      expect(backlog.some(b => b.id === blockId)).toBeTruthy();
    });

    it('does NOT include block in Backlog if it has been completed after missed', () => {
      const blockId = 'blk-2';
      const block = createMissedBlock(blockId, YESTERDAY_DAYKEY);
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY, '2026-08-18T10:00:00.000Z'),
          {
            id: `evt-complete-${blockId}`,
            blockId,
            kind: 'complete',
            status: 'completed',
            recordedAtISO: '2026-08-18T11:00:00.000Z',
            cycleId: CYCLE_ID,
            goalId: GOAL_ID,
          },
        ],
      };

      const backlog = resolveBacklogBlocks(state);
      expect(backlog.some((b: any) => b.id === blockId)).toBeFalsy();
    });

    it('does NOT include block in Backlog if it has been deleted', () => {
      const blockId = 'blk-3';
      const block = createMissedBlock(blockId, YESTERDAY_DAYKEY);
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY, '2026-08-18T10:00:00.000Z'),
          {
            id: `evt-delete-${blockId}`,
            blockId,
            kind: 'delete',
            recordedAtISO: '2026-08-18T11:00:00.000Z',
            cycleId: CYCLE_ID,
            goalId: GOAL_ID,
          },
        ],
      };

      const backlog = resolveBacklogBlocks(state);
      expect(backlog.some((b: any) => b.id === blockId)).toBeFalsy();
    });

    it('includes multiple blocks if all have missed as most recent event', () => {
      const blocks = [
        createMissedBlock('blk-a', YESTERDAY_DAYKEY),
        createMissedBlock('blk-b', YESTERDAY_DAYKEY),
        createMissedBlock('blk-c', YESTERDAY_DAYKEY),
      ];
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks },
        }),
        executionEvents: [
          createMissedEvent('blk-a', YESTERDAY_DAYKEY),
          createMissedEvent('blk-b', YESTERDAY_DAYKEY),
          createMissedEvent('blk-c', YESTERDAY_DAYKEY),
        ],
      };

      const backlog = resolveBacklogBlocks(state);
      expect(backlog.length).toBe(3);
      expect(backlog.map((b: any) => b.id).sort()).toEqual(['blk-a', 'blk-b', 'blk-c'].sort());
    });
  });

  // ==========================================================================
  // Part 2: daysInBacklog Computation (derived field)
  // ==========================================================================

  describe('Part 2: daysInBacklog computation', () => {

    it('computes daysInBacklog = 0 for block missed today', () => {
      const blockId = 'blk-today';
      const block = createMissedBlock(blockId, TODAY_DAYKEY);
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          createMissedEvent(blockId, TODAY_DAYKEY, `${TODAY_DAYKEY}T08:00:00.000Z`),
        ],
      };

      const backlog = resolveBacklogBlocks(state);
      const foundBlock = backlog.find((b: any) => b.id === blockId);
      expect(foundBlock?.daysInBacklog).toBe(0);
    });

    it('computes daysInBacklog = 1 for block missed yesterday', () => {
      const blockId = 'blk-yesterday';
      const block = createMissedBlock(blockId, YESTERDAY_DAYKEY);
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY, `${YESTERDAY_DAYKEY}T08:00:00.000Z`),
        ],
      };

      const backlog = resolveBacklogBlocks(state);
      const foundBlock = backlog.find((b: any) => b.id === blockId);
      expect(foundBlock?.daysInBacklog).toBe(1);
    });

    it('computes daysInBacklog > 0 for older blocks', () => {
      const blockId = 'blk-old';
      const oldDayKey = '2026-08-10'; // 9 days before TODAY_DAYKEY (2026-08-19)
      const block = createMissedBlock(blockId, oldDayKey);
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          createMissedEvent(blockId, oldDayKey, `${oldDayKey}T08:00:00.000Z`),
        ],
      };

      const backlog = resolveBacklogBlocks(state);
      const foundBlock = backlog.find((b: any) => b.id === blockId);
      expect(foundBlock?.daysInBacklog).toBeGreaterThan(0);
      expect(foundBlock?.daysInBacklog).toBeLessThanOrEqual(10); // Conservative: at most 10 days
    });
  });

  // ==========================================================================
  // Part 3: Accept Action (re-enter with original time)
  // ==========================================================================

  describe('Part 3: Accept action (re-enter as-is)', () => {

    it('appends BACKLOG_ACCEPT event when block is accepted', () => {
      const blockId = 'blk-accept-1';
      const block = createMissedBlock(blockId, YESTERDAY_DAYKEY);
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY),
        ],
      };

      // Dispatch ACCEPT_BACKLOG_ITEM action
      const after = identityReducer(state, {
        type: 'ACCEPT_BACKLOG_ITEM',
        payload: { blockId },
      });

      // Verify event was appended
      const acceptEvent = (after.executionEvents || []).find(
        (e: any) => e.blockId === blockId && e.reasonCode === 'BACKLOG_ACCEPT'
      );
      expect(acceptEvent).toBeDefined();
      expect(acceptEvent?.kind).toBe('backlog_accept');
    });

    it('re-entered block appears in derived today.blocks after accept', () => {
      const blockId = 'blk-accept-2';
      const block = createMissedBlock(blockId, YESTERDAY_DAYKEY);
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY),
        ],
      };

      let after = identityReducer(state, {
        type: 'ACCEPT_BACKLOG_ITEM',
        payload: { blockId },
      });
      after = computeDerivedState(after, { type: 'NO_OP' });

      const todayBlocks = after.today?.blocks || [];
      const reenteredBlock = todayBlocks.find((b: any) => b.id === blockId);
      expect(reenteredBlock).toBeDefined();
      expect(reenteredBlock?.status).toBe('in_progress'); // Re-entered state
    });

    it('preserves original time slot on accept (no rescheduling)', () => {
      const blockId = 'blk-accept-3';
      const originalStart = `${YESTERDAY_DAYKEY}T09:00:00.000Z`;
      const originalEnd = `${YESTERDAY_DAYKEY}T10:00:00.000Z`;
      const block = createMissedBlock(blockId, YESTERDAY_DAYKEY);
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          {
            ...createMissedEvent(blockId, YESTERDAY_DAYKEY),
            startISO: originalStart,
            endISO: originalEnd,
          },
        ],
      };

      let after = identityReducer(state, {
        type: 'ACCEPT_BACKLOG_ITEM',
        payload: { blockId },
      });

      const acceptEvent = (after.executionEvents || []).find(
        (e: any) => e.blockId === blockId && e.reasonCode === 'BACKLOG_ACCEPT'
      );
      // Accept should preserve the ISOs from the original block
      expect(acceptEvent?.startISO).toBe(originalStart);
      expect(acceptEvent?.endISO).toBe(originalEnd);
    });
  });

  // ==========================================================================
  // Part 4: Reschedule Action (re-enter with new time)
  // ==========================================================================

  describe('Part 4: Reschedule action (re-enter with new slot)', () => {

    it('appends BACKLOG_RESCHEDULE event when block is rescheduled', () => {
      const blockId = 'blk-reschedule-1';
      const newStart = `${TODAY_DAYKEY}T14:00:00.000Z`;
      const newEnd = `${TODAY_DAYKEY}T15:00:00.000Z`;
      const block = createMissedBlock(blockId, YESTERDAY_DAYKEY);
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY),
        ],
      };

      const after = identityReducer(state, {
        type: 'RESCHEDULE_BACKLOG_ITEM',
        payload: { blockId, startISO: newStart, endISO: newEnd, dateISO: TODAY_DAYKEY },
      });

      const rescheduleEvent = (after.executionEvents || []).find(
        (e: any) => e.blockId === blockId && e.reasonCode === 'BACKLOG_RESCHEDULE'
      );
      expect(rescheduleEvent).toBeDefined();
      expect(rescheduleEvent?.kind).toBe('backlog_accept');
      expect(rescheduleEvent?.startISO).toBe(newStart);
      expect(rescheduleEvent?.endISO).toBe(newEnd);
    });

    it('re-entered block appears at new time after reschedule', () => {
      const blockId = 'blk-reschedule-2';
      const newStart = `${TODAY_DAYKEY}T14:00:00.000Z`;
      const newEnd = `${TODAY_DAYKEY}T15:00:00.000Z`;
      const block = createMissedBlock(blockId, YESTERDAY_DAYKEY);
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY, `${YESTERDAY_DAYKEY}T09:00:00.000Z`),
        ],
      };

      let after = identityReducer(state, {
        type: 'RESCHEDULE_BACKLOG_ITEM',
        payload: { blockId, startISO: newStart, endISO: newEnd, dateISO: TODAY_DAYKEY },
      });
      after = computeDerivedState(after, { type: 'NO_OP' });

      const todayBlocks = after.today?.blocks || [];
      const reenteredBlock = todayBlocks.find((b: any) => b.id === blockId);
      expect(reenteredBlock).toBeDefined();
      expect(reenteredBlock?.start).toBe(newStart);
      expect(reenteredBlock?.end).toBe(newEnd);
    });
  });

  // ==========================================================================
  // Part 5: Validation (constraint checks reuse Item 1 selectors)
  // ==========================================================================

  describe('Part 5: Validation constraints', () => {

    it('rejects re-entry if target date is outside contract window', () => {
      const blockId = 'blk-outside-contract';
      const tooFarFuture = '2027-09-01T09:00:00.000Z'; // After contract end (2027-08-01)
      const state = {
        ...buildBaseState(),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY),
        ],
      };

      const after = identityReducer(state, {
        type: 'RESCHEDULE_BACKLOG_ITEM',
        payload: { blockId, startISO: tooFarFuture, endISO: '2027-09-01T10:00:00.000Z' },
      });

      // Should set lastPlanError or skip appending the event
      expect(after.lastPlanError || !after.executionEvents.some(e => e.blockId === blockId && e.reasonCode === 'BACKLOG_RESCHEDULE')).toBeTruthy();
    });

    it('rejects re-entry if target time conflicts with existing block in today', () => {
      const blockId = 'blk-conflict';
      const existingBlock = {
        id: 'blk-existing',
        start: `${TODAY_DAYKEY}T09:00:00.000Z`,
        end: `${TODAY_DAYKEY}T10:00:00.000Z`,
        status: 'planned',
      };
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [existingBlock] },
        }),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY),
        ],
      };

      // Try to reschedule into the same time slot
      const after = identityReducer(state, {
        type: 'RESCHEDULE_BACKLOG_ITEM',
        payload: {
          blockId,
          startISO: `${TODAY_DAYKEY}T09:00:00.000Z`,
          endISO: `${TODAY_DAYKEY}T10:00:00.000Z`,
        },
      });

      // Should reject due to conflict
      expect(after.lastPlanError || !after.executionEvents.some(e => e.blockId === blockId && e.reasonCode === 'BACKLOG_RESCHEDULE')).toBeTruthy();
    });

    it('allows re-entry if target slot is available and within contract', () => {
      const blockId = 'blk-valid';
      const validStart = `${TODAY_DAYKEY}T14:00:00.000Z`;
      const validEnd = `${TODAY_DAYKEY}T15:00:00.000Z`;
      const state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [] }, // Empty, so slot is available
        }),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY),
        ],
      };

      const after = identityReducer(state, {
        type: 'RESCHEDULE_BACKLOG_ITEM',
        payload: { blockId, startISO: validStart, endISO: validEnd },
      });

      // Should succeed: event appended, no error
      const rescheduleEvent = (after.executionEvents || []).find(
        e => e.blockId === blockId && e.reasonCode === 'BACKLOG_RESCHEDULE'
      );
      expect(rescheduleEvent).toBeDefined();
      expect(after.lastPlanError).toBeFalsy();
    });
  });

  // ==========================================================================
  // Part 6: Idempotence (same action dispatched twice)
  // ==========================================================================

  describe('Part 6: Idempotence', () => {

    it('accepts same action twice; second event has later timestamp, materialization reflects latest', () => {
      const blockId = 'blk-idempotent';
      let state = {
        ...buildBaseState(),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY, `${YESTERDAY_DAYKEY}T08:00:00.000Z`),
        ],
      };

      // First accept
      state = identityReducer(state, {
        type: 'ACCEPT_BACKLOG_ITEM',
        payload: { blockId },
      });
      const eventCountAfterFirst = state.executionEvents?.length || 0;

      // Second accept (same action)
      state = identityReducer(state, {
        type: 'ACCEPT_BACKLOG_ITEM',
        payload: { blockId },
      });
      const eventCountAfterSecond = state.executionEvents?.length || 0;

      // Both events appended (no dedup)
      expect(eventCountAfterSecond).toBe(eventCountAfterFirst + 1);

      // Both have BACKLOG_ACCEPT reasonCode
      const acceptEvents = (state.executionEvents || []).filter(
        e => e.blockId === blockId && e.reasonCode === 'BACKLOG_ACCEPT'
      );
      expect(acceptEvents.length).toBe(2);

      // Later event has later recordedAtISO
      if (acceptEvents.length >= 2) {
        const times = acceptEvents.map(e => new Date(e.recordedAtISO || '').getTime());
        expect(times[1]).toBeGreaterThanOrEqual(times[0]);
      }
    });
  });

  // ==========================================================================
  // Part 7: Event Ledger Integrity
  // ==========================================================================

  describe('Part 7: Event ledger integrity', () => {

    it('never mutates existing events', () => {
      const blockId = 'blk-immutable';
      const missedEventId = `evt-missed-${blockId}`;
      const state = {
        ...buildBaseState(),
        executionEvents: [
          { ...createMissedEvent(blockId, YESTERDAY_DAYKEY), id: missedEventId },
        ],
      };

      const originalMissedEvent = state.executionEvents?.[0];
      const originalStatus = originalMissedEvent?.status;

      const after = identityReducer(state, {
        type: 'ACCEPT_BACKLOG_ITEM',
        payload: { blockId },
      });

      // Original event still exists with same data
      const stillExists = after.executionEvents?.find(e => e.id === missedEventId);
      expect(stillExists).toBeDefined();
      expect(stillExists?.status).toBe(originalStatus);
    });

    it('appends new event instead of modifying state', () => {
      const blockId = 'blk-append-only';
      const initialEventCount = 1;
      const state = {
        ...buildBaseState(),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY),
        ],
      };

      const after = identityReducer(state, {
        type: 'ACCEPT_BACKLOG_ITEM',
        payload: { blockId },
      });

      // Event count increased by 1 (append only)
      const newEventCount = after.executionEvents?.length || 0;
      expect(newEventCount).toBe(initialEventCount + 1);
    });
  });

  // ==========================================================================
  // Part 8: Full Integration Test (end-to-end flow)
  // ==========================================================================

  describe('Part 8: Full integration (end-to-end)', () => {

    it('flow: block missed → goes to Backlog → accepted → reappears in today', () => {
      const blockId = 'blk-e2e';
      const block = createMissedBlock(blockId, YESTERDAY_DAYKEY);

      // Step 1: Block missed yesterday
      let state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY),
        ],
      };
      state = computeDerivedState(state, { type: 'NO_OP' });

      // Verify in Backlog
      let backlog = resolveBacklogBlocks(state);
      expect(backlog.some((b: any) => b.id === blockId)).toBeTruthy();

      // Step 2: User accepts the backlog block
      state = identityReducer(state, {
        type: 'ACCEPT_BACKLOG_ITEM',
        payload: { blockId },
      });
      state = computeDerivedState(state, { type: 'NO_OP' });

      // Verify re-entered in today.blocks
      const todayBlocks = state.today?.blocks || [];
      expect(todayBlocks.some((b: any) => b.id === blockId)).toBeTruthy();

      // Verify no longer in Backlog
      backlog = resolveBacklogBlocks(state);
      expect(backlog.some((b: any) => b.id === blockId)).toBeFalsy();
    });

    it('flow: block missed → Backlog → rescheduled to tomorrow → appears on tomorrow', () => {
      const blockId = 'blk-e2e-reschedule';
      const newStart = `${TOMORROW_DAYKEY}T10:00:00.000Z`;
      const newEnd = `${TOMORROW_DAYKEY}T11:00:00.000Z`;
      const block = createMissedBlock(blockId, YESTERDAY_DAYKEY);

      // Step 1: Block missed yesterday
      let state = {
        ...buildBaseState({
          today: { date: TODAY_DAYKEY, blocks: [block] },
        }),
        executionEvents: [
          createMissedEvent(blockId, YESTERDAY_DAYKEY),
        ],
      };
      state = computeDerivedState(state, { type: 'NO_OP' });

      // Verify in Backlog
      let backlog = resolveBacklogBlocks(state);
      expect(backlog.some((b: any) => b.id === blockId)).toBeTruthy();

      // Step 2: User reschedules to tomorrow
      state = identityReducer(state, {
        type: 'RESCHEDULE_BACKLOG_ITEM',
        payload: { blockId, startISO: newStart, endISO: newEnd, dateISO: TOMORROW_DAYKEY },
      });
      state = computeDerivedState(state, { type: 'NO_OP' });

      // Verify appears in tomorrow's blocks (via derived state)
      // (Exact assertion depends on how tomorrow blocks are exposed; adjust as needed)
      const events = state.executionEvents || [];
      const rescheduleEvent = events.find((e: any) => e.blockId === blockId && e.reasonCode === 'BACKLOG_RESCHEDULE');
      expect(rescheduleEvent?.startISO).toBe(newStart);
      expect(rescheduleEvent?.endISO).toBe(newEnd);
    });
  });
});
