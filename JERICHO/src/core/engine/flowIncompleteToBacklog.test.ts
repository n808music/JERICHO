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

    // Seed state with a committed but incomplete block on day N
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
    it('DESIRED: incomplete block flows to Backlog, not regenerated as overdue', () => {
      // After Item 2 implementation:
      // - block-1 should NOT appear in today.blocks as "overdue-*"
      // - block-1 should appear in proposedBlocks (Backlog) with status 'suggested'
      // - MISSED event should still exist (historical record)

      // PLACEHOLDER: This test will be updated to verify flow-out behavior
      // Currently this is just documenting the desired outcome
      expect(true).toBe(true); // Placeholder
    });

    it('DESIRED: MISSED event still recorded for narrative/Fidelity Verdict', () => {
      // After Item 2:
      // - MISSED event still created (not removed, just consequence changes)
      // - event.kind === 'missed'
      // - can be queried by Fidelity Verdict logic

      expect(true).toBe(true); // Placeholder
    });

    it('DESIRED: CONSTRAINT-tagged blocks also flow to Backlog (no bypass)', () => {
      // After Item 2:
      // - CONSTRAINT blocks don't stay committed on today
      // - CONSTRAINT blocks don't auto-reschedule
      // - CONSTRAINT blocks flow to Backlog with escalated urgency flag

      expect(true).toBe(true); // Placeholder
    });
  });
});
