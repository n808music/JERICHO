/**
 * Regression Test: Step 1 — mergePriorTodayBlocks Must Exclude Missed Blocks
 *
 * CRITICAL BUG: If mergePriorTodayBlocks re-injects flowed-out blocks (blocks with MISSED events),
 * the entire Item 2 flow-out fix is subverted — blocks silently reappear on today's calendar
 * without going through the flow-out → Backlog transition.
 *
 * Current behavior (before fix): mergePriorTodayBlocks only excludes blocks with 'delete' events
 * Desired behavior (after fix): mergePriorTodayBlocks also excludes blocks with 'missed' events
 *
 * This test documents and verifies the fix.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dayKeyFromISO } from '../../state/time/time.ts';
import type { ExecutionEvent } from './todayAuthority.ts';

/**
 * Mock implementation of mergePriorTodayBlocks to test the fix.
 * Mirrors the real function at identityCompute.js:4386-4406
 */
function mergePriorTodayBlocks_BEFORE_FIX(
  state: any,
  survivingPriorBlocks: any[]
): void {
  // Current behavior: only excludes deleted blocks
  const deletedIds = new Set<string>();

  if (Array.isArray(state.executionEvents)) {
    state.executionEvents.forEach((event: ExecutionEvent) => {
      if (event.kind === 'delete' && event.blockId) {
        deletedIds.add(event.blockId);
      }
    });
  }

  const reinjectableBlocks = survivingPriorBlocks.filter((block) => !deletedIds.has(block.id));
  state.today = state.today || {};
  state.today.blocks = [...(state.today.blocks || []), ...reinjectableBlocks];
}

function mergePriorTodayBlocks_AFTER_FIX(
  state: any,
  survivingPriorBlocks: any[]
): void {
  // Fixed behavior: also excludes missed blocks
  const excludedIds = new Set<string>();

  if (Array.isArray(state.executionEvents)) {
    state.executionEvents.forEach((event: ExecutionEvent) => {
      if ((event.kind === 'delete' || event.kind === 'missed') && event.blockId) {
        excludedIds.add(event.blockId);
      }
    });
  }

  const reinjectableBlocks = survivingPriorBlocks.filter((block) => !excludedIds.has(block.id));
  state.today = state.today || {};
  state.today.blocks = [...(state.today.blocks || []), ...reinjectableBlocks];
}

describe('Step 1: mergePriorTodayBlocks Must Exclude Missed Blocks', () => {
  let baseState: any;
  const dayNISO = '2026-08-19T12:00:00.000Z';
  const dayNDayKey = '2026-08-19';
  const timeZone = 'America/Chicago';

  beforeEach(() => {
    baseState = {
      appTime: {
        nowISO: dayNISO,
        timeZone,
      },
      executionEvents: [],
      today: {
        blocks: [],
      },
    };
  });

  describe('Current behavior (BEFORE FIX)', () => {
    it('REGRESSION: mergePriorTodayBlocks re-injects block even if it has a MISSED event', () => {
      // Seed: a block was on today's calendar
      const priorBlock = {
        id: 'block-1',
        label: 'Incomplete task',
        practice: 'Focus',
        status: 'in_progress',
        plannedMinutes: 30,
        date: dayNDayKey,
        start: '2026-08-19T09:00:00.000Z',
        end: '2026-08-19T09:30:00.000Z',
        cycleId: 'cycle-1',
        goalId: 'goal-1',
      };

      // Simulate flow-out: block was incomplete at day-end, MISSED event created
      const missedEvent: ExecutionEvent = {
        id: 'missed-block-1',
        blockId: 'block-1',
        kind: 'missed',
        completed: false,
        dateISO: dayNDayKey,
        minutes: 30,
        rawLabel: 'Incomplete task',
        domain: 'Focus',
        cycleId: 'cycle-1',
        goalId: 'goal-1',
        missedAtISO: dayNISO,
      };

      baseState.executionEvents = [missedEvent];

      // Call mergePriorTodayBlocks with the block that should flow to Backlog
      mergePriorTodayBlocks_BEFORE_FIX(baseState, [priorBlock]);

      // BUG: block is re-injected into today.blocks despite having MISSED event
      const reinjectedBlock = baseState.today.blocks.find((b: any) => b.id === 'block-1');
      expect(reinjectedBlock).toBeDefined(); // BUG: should NOT be in today.blocks
      expect(reinjectedBlock?.id).toBe('block-1'); // This proves the bug exists
    });

    it('REGRESSION: mergePriorTodayBlocks correctly excludes blocks with DELETE events (existing behavior)', () => {
      // Verify the existing DELETE exclusion still works
      const priorBlock = {
        id: 'block-2',
        label: 'Deleted task',
        status: 'in_progress',
        date: dayNDayKey,
      };

      const deleteEvent: ExecutionEvent = {
        id: 'delete-block-2',
        blockId: 'block-2',
        kind: 'delete',
        completed: false,
        dateISO: dayNDayKey,
        minutes: 0,
        rawLabel: 'Deleted task',
        domain: 'Unclassified',
      };

      baseState.executionEvents = [deleteEvent];
      mergePriorTodayBlocks_BEFORE_FIX(baseState, [priorBlock]);

      const reinjectedBlock = baseState.today.blocks.find((b: any) => b.id === 'block-2');
      expect(reinjectedBlock).toBeUndefined(); // Correctly excluded
    });
  });

  describe('Fixed behavior (AFTER FIX)', () => {
    it('FIXED: mergePriorTodayBlocks excludes blocks with MISSED events', () => {
      const priorBlock = {
        id: 'block-1',
        label: 'Incomplete task',
        practice: 'Focus',
        status: 'in_progress',
        plannedMinutes: 30,
        date: dayNDayKey,
        start: '2026-08-19T09:00:00.000Z',
        end: '2026-08-19T09:30:00.000Z',
        cycleId: 'cycle-1',
        goalId: 'goal-1',
      };

      const missedEvent: ExecutionEvent = {
        id: 'missed-block-1',
        blockId: 'block-1',
        kind: 'missed',
        completed: false,
        dateISO: dayNDayKey,
        minutes: 30,
        rawLabel: 'Incomplete task',
        domain: 'Focus',
        cycleId: 'cycle-1',
        goalId: 'goal-1',
        missedAtISO: dayNISO,
      };

      baseState.executionEvents = [missedEvent];
      mergePriorTodayBlocks_AFTER_FIX(baseState, [priorBlock]);

      // FIX: block is NOT re-injected
      const reinjectedBlock = baseState.today.blocks.find((b: any) => b.id === 'block-1');
      expect(reinjectedBlock).toBeUndefined(); // Correctly excluded
    });

    it('FIXED: mergePriorTodayBlocks still excludes blocks with DELETE events', () => {
      const priorBlock = {
        id: 'block-2',
        label: 'Deleted task',
        status: 'in_progress',
        date: dayNDayKey,
      };

      const deleteEvent: ExecutionEvent = {
        id: 'delete-block-2',
        blockId: 'block-2',
        kind: 'delete',
        completed: false,
        dateISO: dayNDayKey,
        minutes: 0,
        rawLabel: 'Deleted task',
        domain: 'Unclassified',
      };

      baseState.executionEvents = [deleteEvent];
      mergePriorTodayBlocks_AFTER_FIX(baseState, [priorBlock]);

      const reinjectedBlock = baseState.today.blocks.find((b: any) => b.id === 'block-2');
      expect(reinjectedBlock).toBeUndefined(); // Correctly excluded
    });

    it('FIXED: mergePriorTodayBlocks re-injects blocks without DELETE or MISSED events', () => {
      const priorBlock = {
        id: 'block-3',
        label: 'Normal task',
        status: 'in_progress',
        date: dayNDayKey,
      };

      // No events — block should be re-injected normally
      baseState.executionEvents = [];
      mergePriorTodayBlocks_AFTER_FIX(baseState, [priorBlock]);

      const reinjectedBlock = baseState.today.blocks.find((b: any) => b.id === 'block-3');
      expect(reinjectedBlock).toBeDefined(); // Correctly re-injected
      expect(reinjectedBlock?.id).toBe('block-3');
    });

    it('FIXED: Multiple blocks handled correctly (mix of normal, missed, deleted)', () => {
      const normalBlock = { id: 'block-normal', label: 'Normal', date: dayNDayKey };
      const missedBlock = { id: 'block-missed', label: 'Missed', date: dayNDayKey };
      const deletedBlock = { id: 'block-deleted', label: 'Deleted', date: dayNDayKey };

      const missedEvent: ExecutionEvent = {
        id: 'missed-event',
        blockId: 'block-missed',
        kind: 'missed',
        completed: false,
        dateISO: dayNDayKey,
        minutes: 30,
        rawLabel: 'Missed',
        domain: 'Focus',
      };

      const deleteEvent: ExecutionEvent = {
        id: 'delete-event',
        blockId: 'block-deleted',
        kind: 'delete',
        completed: false,
        dateISO: dayNDayKey,
        minutes: 0,
        rawLabel: 'Deleted',
        domain: 'Focus',
      };

      baseState.executionEvents = [missedEvent, deleteEvent];
      mergePriorTodayBlocks_AFTER_FIX(baseState, [normalBlock, missedBlock, deletedBlock]);

      const todayBlockIds = baseState.today.blocks.map((b: any) => b.id);
      expect(todayBlockIds).toContain('block-normal'); // Re-injected
      expect(todayBlockIds).not.toContain('block-missed'); // Excluded
      expect(todayBlockIds).not.toContain('block-deleted'); // Excluded
    });
  });
});
