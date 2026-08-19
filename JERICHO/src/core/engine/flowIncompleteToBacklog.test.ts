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
      },
    };
  });

  describe('Current behavior (before Item 2 fix)', () => {
    it('REGRESSION: shouldRollover detects day boundary', () => {
      const result = shouldRollover({
        state: baseState,
        nowISO: dayNPlusOneISO,
        timezone: timeZone,
      });
      expect(result).toBe(true); // Day changed from N to N+1
    });

    it('REGRESSION: rolloverAtMidnight creates MISSED event for incomplete block', () => {
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

    it('REGRESSION: rolloverAtMidnight regenerates incomplete block as "overdue" on today', () => {
      const result = rolloverAtMidnight({
        state: baseState,
        nowISO: dayNPlusOneISO,
        timezone: timeZone,
      });

      const createEvents = result.eventsEmitted.filter((e: any) => e.kind === 'create');
      expect(createEvents.length).toBe(1);
      expect(createEvents[0].blockId).toContain('overdue');

      // Verify overdue block appears in today.blocks
      const overdueBlockInToday = result.nextState.today.blocks.find((b: any) =>
        b.id.includes('overdue')
      );
      expect(overdueBlockInToday).toBeDefined();
      expect(overdueBlockInToday.status).toBe('in_progress');
    });

    it('REGRESSION: Overdue block carries original properties', () => {
      const result = rolloverAtMidnight({
        state: baseState,
        nowISO: dayNPlusOneISO,
        timezone: timeZone,
      });

      const overdueBlockInToday = result.nextState.today.blocks.find((b: any) =>
        b.id.includes('overdue')
      );

      expect(overdueBlockInToday.goalId).toBe('goal-1');
      expect(overdueBlockInToday.cycleId).toBe('cycle-1');
      expect(overdueBlockInToday.practice).toBe('Focus');
      expect(overdueBlockInToday.label).toBe('Incomplete task');
    });
  });

  describe('Item 2 desired behavior (after fix)', () => {
    it.todo('DESIRED: MISSED event recorded (historical record for Fidelity Verdict)');
    // After Item 2 implementation, rolloverAtMidnight should:
    // - Emit a MISSED event for block-1 (event.kind === 'missed', event.blockId === 'block-1')
    // - This event records the execution failure but does NOT trigger auto-regeneration
    // - The MISSED event feeds into Fidelity Verdict logic for narrative/trust assessment

    it.todo('DESIRED: incomplete block flows to Backlog (not regenerated as overdue)');
    // After Item 2, rolloverAtMidnight should:
    // - NOT create any new blocks with id containing 'overdue-*' in today.blocks
    // - NOT emit any 'create' events for overdue regeneration
    // - Block flows to Backlog (derived state, not stored): most recent event is 'missed' +
    //   no later reschedule/complete/delete event
    // - Backlog membership is queried via resolveBacklogBlocks() selector, which computes
    //   from the event ledger at query time (never hand-written state field)

    it.todo('DESIRED: CONSTRAINT-tagged blocks also flow to Backlog (no bypass)');
    // After Item 2:
    // - CONSTRAINT blocks are subject to the same flow-out logic
    // - No special handling that keeps them committed on today
    // - They emit MISSED event + flow to Backlog like any other incomplete block
    // - Tier assignment (escalated vs. standard backlog) is deferred to Item 5
  });
});
