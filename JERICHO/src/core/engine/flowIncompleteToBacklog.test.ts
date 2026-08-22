/**
 * Regression Test: Item 2 — Flow Incomplete Blocks to Backlog on Day Boundary
 *
 * Current behavior (before fix): incomplete Active blocks become MISSED + regenerated as "overdue" on today
 * Desired behavior (after fix): incomplete Active blocks flow to Backlog, MISSED event still recorded
 *
 * This test currently documents the OLD behavior (should pass against current rollover.ts).
 * After Item 2 implementation, these tests will verify the NEW behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { rolloverAtMidnight, shouldRollover } from './rollover.ts';
import { dayKeyFromISO, addDays } from '../../state/time/time.ts';
import { resolveBacklogBlocks } from './resolveBacklogBlocks.ts';

describe('Item 2: Flow incomplete blocks to Backlog on day boundary', () => {
  let baseState: any;
  let dayNISO: string;
  let dayNPlusOneISO: string;
  const timeZone = 'America/Chicago';

  beforeEach(() => {
    dayNISO = '2026-08-19T12:00:00.000Z';
    dayNPlusOneISO = '2026-08-20T12:00:00.000Z';

    // Seed state with a committed but incomplete block on day N.
    // After rollover at N+1, block-1 should:
    // 1. Emit a MISSED event (historical record, used by Fidelity Verdict)
    // 2. Flow to Backlog (derived from: missed event + no later reschedule/complete/delete)
    // 3. NOT be regenerated as "overdue" in today.blocks (breaking change from current behavior)
    baseState = {
      appTime: {
        nowISO: dayNISO,
        timeZone,
      },
      lastRolloverDayISO: null,
      executionEvents: [],
      today: {
        blocks: [
          {
            id: 'block-1',
            label: 'Incomplete task',
            practice: 'Focus',
            domain: 'Focus',
            status: 'in_progress',
            plannedMinutes: 30,
            date: '2026-08-19',
            start: '2026-08-19T09:00:00.000Z',
            end: '2026-08-19T09:30:00.000Z',
            cycleId: 'cycle-1',
            goalId: 'goal-1',
            placementState: 'COMMITTED',
          },
        ],
      },
      cyclesById: {
        'cycle-1': {
          id: 'cycle-1',
          goalId: 'goal-1',
          blocks: [], // Empty: blocks from today are the source of truth for rollover
        },
      },
    };
  });

  describe('Current behavior (before Item 2 fix)', () => {
    // NOTE: Regression tests are skipped after Step 5 implementation
    // They documented the broken behavior (overdue regeneration) that Item 2 fixes.
    // After the fix is deployed, these can be removed entirely.
    it.skip('REGRESSION: shouldRollover detects day boundary', () => {
      const result = shouldRollover({
        state: baseState,
        nowISO: dayNPlusOneISO,
        timezone: timeZone,
      });
      expect(result).toBe(true); // Day changed from N to N+1
    });

    it.skip('REGRESSION: rolloverAtMidnight creates MISSED event for incomplete block', () => {
      const result = rolloverAtMidnight({
        state: baseState,
        nowISO: dayNPlusOneISO,
        timezone: timeZone,
      });

      const missedEvents = result.eventsEmitted.filter((e: any) => e.kind === 'missed');
      expect(missedEvents.length).toBe(1);
      expect(missedEvents[0].blockId).toBe('block-1');
      expect(missedEvents[0].status).toBe('missed');
    });

    it.skip('REGRESSION: rolloverAtMidnight regenerates incomplete block as "overdue" on today', () => {
      const result = rolloverAtMidnight({
        state: baseState,
        nowISO: dayNPlusOneISO,
        timezone: timeZone,
      });

      const createEvents = result.eventsEmitted.filter((e: any) => e.kind === 'create');
      expect(createEvents.length).toBe(1);
      // Exact pattern: overdue-{originalBlockId}-{dateKey}
      expect(createEvents[0].blockId).toMatch(/^overdue-block-1-2026-08-20$/);

      // Verify overdue block appears in today.blocks
      const overdueBlockInToday = result.nextState.today.blocks.find((b: any) =>
        b.id.match(/^overdue-block-1-2026-08-20$/)
      );
      expect(overdueBlockInToday).toBeDefined();
      expect(overdueBlockInToday.status).toBe('in_progress');
      expect(overdueBlockInToday.placementState).toBe('COMMITTED');
    });

    it.skip('REGRESSION: Overdue block carries original properties', () => {
      const result = rolloverAtMidnight({
        state: baseState,
        nowISO: dayNPlusOneISO,
        timezone: timeZone,
      });

      const overdueBlockInToday = result.nextState.today.blocks.find((b: any) =>
        b.id.match(/^overdue-block-1-2026-08-20$/)
      );

      expect(overdueBlockInToday.goalId).toBe('goal-1');
      expect(overdueBlockInToday.cycleId).toBe('cycle-1');
      expect(overdueBlockInToday.practice).toBe('Focus');
      expect(overdueBlockInToday.label).toBe('Incomplete task');
    });
  });

  describe('Item 2 desired behavior (after fix)', () => {
    it('DESIRED: MISSED event recorded (historical record for Fidelity Verdict)', () => {
      // After Item 2 implementation, rolloverAtMidnight should:
      // - Emit a MISSED event for block-1 (event.kind === 'missed', event.blockId === 'block-1')
      // - This event records the execution failure but does NOT trigger auto-regeneration
      // - The MISSED event feeds into Fidelity Verdict logic for narrative/trust assessment

      const result = rolloverAtMidnight({
        state: baseState,
        nowISO: dayNPlusOneISO,
        timezone: timeZone,
      });

      const missedEvents = result.eventsEmitted.filter((e: any) => e.kind === 'missed');
      expect(missedEvents.length).toBe(1);
      expect(missedEvents[0].kind).toBe('missed');
      expect(missedEvents[0].blockId).toBe('block-1');
      expect(missedEvents[0].status).toBe('missed');
      // Verify MISSED event exists for Fidelity Verdict to consume
      expect(missedEvents[0].dateISO).toBe('2026-08-19'); // Yesterday's date
      expect(missedEvents[0].goalId).toBe('goal-1');
    });

    it('DESIRED: incomplete block flows to Backlog (not regenerated as overdue)', () => {
      // After Item 2, rolloverAtMidnight should:
      // - NOT create any 'create' events (no overdue regeneration)
      // - NOT add any blocks with id matching /^overdue-/ to today.blocks
      // - Block flows to Backlog (derived state): most recent event is 'missed' +
      //   no later reschedule/complete/delete event

      const result = rolloverAtMidnight({
        state: baseState,
        nowISO: dayNPlusOneISO,
        timezone: timeZone,
      });

      // Assertion 1: No 'create' events (no overdue regeneration)
      const createEvents = result.eventsEmitted.filter((e: any) => e.kind === 'create');
      expect(createEvents).toHaveLength(0);

      // Assertion 2: No overdue blocks in today.blocks
      const overdueBlocksInToday = (result.nextState.today?.blocks || []).filter((b: any) =>
        b.id.match(/^overdue-/)
      );
      expect(overdueBlocksInToday).toHaveLength(0);

      // Assertion 3: block-1 is in Backlog (derived from missed event + no later action)
      // Backlog membership is computed via resolveBacklogBlocks() selector
      // which checks: most recent event for blockId is 'missed' + no reschedule/complete/delete after
      const backlogBlocks = resolveBacklogBlocks(result.nextState);
      const block1InBacklog = backlogBlocks.find((b: any) => b.id === 'block-1');
      expect(block1InBacklog).toBeDefined();
      expect(block1InBacklog?.id).toBe('block-1');
    });

    it('DESIRED: CONSTRAINT-tagged blocks also flow to Backlog (no bypass)', () => {
      // After Item 2:
      // - CONSTRAINT blocks are subject to the same flow-out logic
      // - No special handling that keeps them committed on today
      // - They emit MISSED event + flow to Backlog like any other incomplete block
      // - Tier assignment (escalated vs. standard backlog) is deferred to Item 5

      // Extend baseState to include a CONSTRAINT-tagged block
      const stateWithConstraint = {
        ...baseState,
        today: {
          blocks: [
            ...baseState.today.blocks,
            {
              id: 'constraint-block-1',
              label: 'Critical constraint task',
              practice: 'Focus',
              domain: 'Focus',
              status: 'in_progress',
              plannedMinutes: 60,
              date: '2026-08-19',
              start: '2026-08-19T14:00:00.000Z',
              end: '2026-08-19T15:00:00.000Z',
              cycleId: 'cycle-1',
              goalId: 'goal-1',
              placementState: 'CONSTRAINT', // Mark as CONSTRAINT
            },
          ],
        },
        cyclesById: {
          'cycle-1': {
            ...baseState.cyclesById['cycle-1'],
            blocks: [], // Empty: blocks from today are the source of truth for rollover
          },
        },
      };

      const result = rolloverAtMidnight({
        state: stateWithConstraint,
        nowISO: dayNPlusOneISO,
        timezone: timeZone,
      });

      // Both regular and CONSTRAINT blocks should emit MISSED events
      const missedEvents = result.eventsEmitted.filter((e: any) => e.kind === 'missed');
      expect(missedEvents.length).toBe(2);
      const constraintMissed = missedEvents.find((e: any) => e.blockId === 'constraint-block-1');
      expect(constraintMissed).toBeDefined();

      // No overdue regeneration for CONSTRAINT blocks either
      const createEvents = result.eventsEmitted.filter((e: any) => e.kind === 'create');
      expect(createEvents).toHaveLength(0);

      // CONSTRAINT block flows to Backlog (same as regular blocks, no bypass)
      const backlogBlocks = resolveBacklogBlocks(result.nextState);
      const constraintInBacklog = backlogBlocks.find((b: any) => b.id === 'constraint-block-1');
      expect(constraintInBacklog).toBeDefined();
      expect(constraintInBacklog?.id).toBe('constraint-block-1');
    });
  });

  describe('Item 2 Backlog selector edge cases', () => {
    it('SELECTOR: missed block with later reschedule is excluded from Backlog', () => {
      // Test the exclusion logic: a block that was missed but then rescheduled
      // should NOT be in Backlog (most recent action is reschedule, not missed)

      const stateWithReschedule = {
        ...baseState,
        executionEvents: [
          // Original block misses on day N
          {
            id: 'missed-block-2-2026-08-19',
            blockId: 'block-2',
            kind: 'missed',
            dateISO: '2026-08-19',
            status: 'missed',
          },
          // Then it gets rescheduled on day N+1
          {
            id: 'reschedule-block-2-2026-08-20',
            blockId: 'block-2',
            kind: 'reschedule',
            dateISO: '2026-08-20',
            status: 'rescheduled',
            newDate: '2026-08-21',
          },
        ],
      };

      const backlogBlocks = resolveBacklogBlocks(stateWithReschedule);
      const block2InBacklog = backlogBlocks.find((b: any) => b.id === 'block-2');

      // block-2 should NOT be in Backlog because its most recent event is reschedule
      expect(block2InBacklog).toBeUndefined();
    });

    it('SELECTOR: missed block with later complete is excluded from Backlog', () => {
      // Test exclusion: a block that was missed but then completed
      // should NOT be in Backlog (most recent action is complete, not missed)

      const stateWithComplete = {
        ...baseState,
        executionEvents: [
          {
            id: 'missed-block-3-2026-08-19',
            blockId: 'block-3',
            kind: 'missed',
            dateISO: '2026-08-19',
            status: 'missed',
          },
          {
            id: 'complete-block-3-2026-08-20',
            blockId: 'block-3',
            kind: 'complete',
            dateISO: '2026-08-20',
            status: 'completed',
          },
        ],
      };

      const backlogBlocks = resolveBacklogBlocks(stateWithComplete);
      const block3InBacklog = backlogBlocks.find((b: any) => b.id === 'block-3');

      // block-3 should NOT be in Backlog because its most recent event is complete
      expect(block3InBacklog).toBeUndefined();
    });
  });

  describe('Item 2: Scope filtering for resolveBacklogBlocks (2026-08-20)', () => {
    it('returns all backlog blocks when scope is not provided', () => {
      const state = {
        appTime: { nowISO: '2026-08-20T12:00:00.000Z' },
        executionEvents: [
          { blockId: 'block-1', kind: 'missed', dateISO: '2026-08-19' },
          { blockId: 'block-2', kind: 'missed', dateISO: '2026-08-19' },
        ],
        today: {
          blocks: [
            { id: 'block-1', cycleId: 'cycle-1', goalId: 'goal-1' },
            { id: 'block-2', cycleId: 'cycle-2', goalId: 'goal-2' },
          ],
        },
      };

      const backlog = resolveBacklogBlocks(state);
      expect(backlog).toHaveLength(2);
      expect(backlog.map((b: any) => b.id)).toEqual(['block-1', 'block-2']);
    });

    it('filters backlog blocks by cycleId when scope is provided', () => {
      const state = {
        appTime: { nowISO: '2026-08-20T12:00:00.000Z' },
        executionEvents: [
          { blockId: 'block-1', kind: 'missed', dateISO: '2026-08-19' },
          { blockId: 'block-2', kind: 'missed', dateISO: '2026-08-19' },
        ],
        today: {
          blocks: [
            { id: 'block-1', cycleId: 'cycle-1', goalId: 'goal-1' },
            { id: 'block-2', cycleId: 'cycle-2', goalId: 'goal-2' },
          ],
        },
      };

      const backlog = resolveBacklogBlocks(state, { cycleId: 'cycle-1' });
      expect(backlog).toHaveLength(1);
      expect(backlog[0]?.id).toBe('block-1');
    });

    it('filters backlog blocks by goalId when scope is provided', () => {
      const state = {
        appTime: { nowISO: '2026-08-20T12:00:00.000Z' },
        executionEvents: [
          { blockId: 'block-1', kind: 'missed', dateISO: '2026-08-19' },
          { blockId: 'block-2', kind: 'missed', dateISO: '2026-08-19' },
        ],
        today: {
          blocks: [
            { id: 'block-1', cycleId: 'cycle-1', goalId: 'goal-1' },
            { id: 'block-2', cycleId: 'cycle-1', goalId: 'goal-2' },
          ],
        },
      };

      const backlog = resolveBacklogBlocks(state, { goalId: 'goal-1' });
      expect(backlog).toHaveLength(1);
      expect(backlog[0]?.id).toBe('block-1');
    });

    it('applies multiple scope filters (AND logic)', () => {
      const state = {
        appTime: { nowISO: '2026-08-20T12:00:00.000Z' },
        executionEvents: [
          { blockId: 'block-1', kind: 'missed', dateISO: '2026-08-19' },
          { blockId: 'block-2', kind: 'missed', dateISO: '2026-08-19' },
          { blockId: 'block-3', kind: 'missed', dateISO: '2026-08-19' },
        ],
        today: {
          blocks: [
            { id: 'block-1', cycleId: 'cycle-1', goalId: 'goal-1' },
            { id: 'block-2', cycleId: 'cycle-1', goalId: 'goal-2' },
            { id: 'block-3', cycleId: 'cycle-2', goalId: 'goal-1' },
          ],
        },
      };

      const backlog = resolveBacklogBlocks(state, { cycleId: 'cycle-1', goalId: 'goal-1' });
      expect(backlog).toHaveLength(1);
      expect(backlog[0]?.id).toBe('block-1');
    });

    it('maintains daysInBacklog calculation when scope filtering', () => {
      // Freeze time to 2026-08-21 so the test doesn't depend on wall-clock date
      // (selector falls back to new Date() if appTime.activeDayKey not provided)
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));

      try {
        const state = {
          appTime: { nowISO: '2026-08-21T12:00:00.000Z' },
          executionEvents: [
            { blockId: 'block-1', kind: 'missed', dateISO: '2026-08-19' },
          ],
          today: {
            blocks: [{ id: 'block-1', cycleId: 'cycle-1', goalId: 'goal-1' }],
          },
        };

        const backlog = resolveBacklogBlocks(state, { cycleId: 'cycle-1' });
        expect(backlog).toHaveLength(1);
        expect(backlog[0]?.daysInBacklog).toBe(2); // 2026-08-19 to 2026-08-21
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
