import { describe, it, expect } from 'vitest';
import { computeDerivedState } from '../../state/identityCompute.js';
import { rolloverAtMidnight, getYesterdayCommittedBlocks, shouldRollover } from '../engine/rollover.ts';

describe('Midnight Rollover', () => {
  const timeZone = 'America/Chicago';
  const nowISO = '2026-01-14T06:00:00.000Z';
  const yesterdayISO = '2026-01-13T12:00:00.000Z';

  describe('rolloverAtMidnight function', () => {
    it('should detect when rollover is needed', () => {
      const state = {
        appTime: {
          timeZone,
          nowISO,
          activeDayKey: '2026-01-13',
          isFollowingNow: true,
        },
        lastRolloverDayISO: '2026-01-13', // yesterday
      };

      expect(shouldRollover({ state, nowISO, timeZone })).toBe(true);
    });

    it('should be idempotent when already processed today', () => {
      const state = {
        appTime: {
          timeZone,
          nowISO,
          activeDayKey: '2026-01-14', // today
          isFollowingNow: true,
        },
        lastRolloverDayISO: '2026-01-14', // already processed today
      };

      expect(shouldRollover({ state, nowISO, timeZone })).toBe(false);
    });

    it('should create MISSED events for incomplete blocks (Item 2 flow-out architecture)', () => {
      // Setup: yesterday had an incomplete block on 2026-01-12
      // Today is 2026-01-14, so we're rolling over from 2026-01-13 to 2026-01-14
      // The block from yesterday (2026-01-12) should still be in today's calendar but incomplete
      const state = {
        appTime: { timeZone, nowISO: '2026-01-14T06:00:00.000Z', activeDayKey: '2026-01-14' },
        lastRolloverDayISO: '2026-01-13', // Yesterday already rolled over
        today: {
          date: '2026-01-13', // This is "today" before rollover (2026-01-13)
          blocks: [
            {
              id: 'block-1',
              practice: 'Creation',
              label: 'Build feature',
              start: '2026-01-13T21:00:00.000Z',
              end: '2026-01-13T22:30:00.000Z',
              status: 'in_progress',
              placementState: 'COMMITTED',
            },
          ],
        },
        executionEvents: [],
      };

      // Call rollover with tomorrow's time (2026-01-14)
      const result = rolloverAtMidnight({ state, nowISO: '2026-01-14T06:00:00.000Z', timeZone });

      // Item 2 new architecture: Only MISSED events created (no CREATE/overdue regeneration)
      expect(result.eventsEmitted).toHaveLength(1);

      const missedEvent = result.eventsEmitted.find((e) => e.kind === 'missed');
      expect(missedEvent).toBeDefined();
      expect(missedEvent?.blockId).toBe('block-1');
      expect(missedEvent?.dateISO).toBe('2026-01-13');
      expect(missedEvent?.completed).toBe(false);

      // Item 2 new architecture: Blocks flow to Backlog (no CREATE events or overdue regeneration)
      const createEvent = result.eventsEmitted.find((e) => e.kind === 'create');
      expect(createEvent).toBeUndefined();
    });

    it('should not touch DONE blocks', () => {
      const state = {
        appTime: { timeZone, nowISO, activeDayKey: '2026-01-13' },
        today: {
          date: '2026-01-13',
          blocks: [
            {
              id: 'block-1',
              practice: 'Creation',
              label: 'Build feature',
              start: '2026-01-13T21:00:00.000Z',
              end: '2026-01-13T22:30:00.000Z',
              status: 'completed', // Already DONE
              placementState: 'COMPLETED',
            },
          ],
        },
      };

      const result = rolloverAtMidnight({ state, nowISO, timeZone });

      expect(result.eventsEmitted).toHaveLength(0);
      expect(result.nextState.today.blocks).toHaveLength(1);
    });
  });

  describe('getYesterdayCommittedBlocks', () => {
    it('should find committed blocks from yesterday', () => {
      const state = {
        appTime: { timeZone, nowISO, activeDayKey: '2026-01-14' },
        today: {
          date: '2026-01-13',
          blocks: [
            { id: 'block-1', placementState: 'COMMITTED', status: 'in_progress' },
            { id: 'block-2', placementState: 'COMPLETED', status: 'completed' },
          ],
        },
      };

      const committedBlocks = getYesterdayCommittedBlocks({ state, nowISO, timeZone });

      expect(committedBlocks).toHaveLength(1);
      expect(committedBlocks[0].id).toBe('block-1');
    });
  });

  describe('Integration with computeDerivedState', () => {
    it('should apply rollover correctly in TICK_NOW action', () => {
      const baseState = {
        appTime: { timeZone, nowISO: '2026-01-13T23:59:59.000Z', activeDayKey: '2026-01-13', isFollowingNow: true },
        lastRolloverDayISO: '2026-01-12',
        today: {
          date: '2026-01-13',
          blocks: [
            {
              id: 'block-1',
              practice: 'Creation',
              label: 'Build feature',
              start: '2026-01-13T21:00:00.000Z',
              end: '2026-01-13T22:30:00.000Z',
              status: 'in_progress',
              placementState: 'COMMITTED',
            },
          ],
        },
      };

      const result = computeDerivedState(baseState, {
        type: 'TICK_NOW',
        nowISO: '2026-01-14T06:00:00.000Z', // midnight rollover
      });

      // Item 2 new architecture: Incomplete blocks flow to Backlog (not re-injected as overdue)
      // block-1 is excluded from re-injection due to MISSED event
      expect(result.today.blocks).toHaveLength(0);

      // Verify block-1 is not in today's blocks (flows to Backlog instead)
      const block1InToday = result.today.blocks.find((b) => b.id === 'block-1');
      expect(block1InToday).toBeUndefined();

      // Verify MISSED event was created and block flows to Backlog
      const missedEvent = result.executionEvents.find((e) => e.kind === 'missed' && e.blockId === 'block-1');
      expect(missedEvent).toBeDefined();
    });
  });

  describe('Determinism', () => {
    it('should produce same result for identical inputs', () => {
      const state = {
        appTime: { timeZone, nowISO: '2026-01-13', activeDayKey: '2026-01-13', isFollowingNow: true },
        today: {
          date: '2026-01-13',
          blocks: [
            {
              id: 'block-1',
              practice: 'Creation',
              label: 'Build feature',
              start: '2026-01-13T21:00:00.000Z',
              end: '2026-01-13T22:30:00.000Z',
              status: 'in_progress',
              placementState: 'COMMITTED',
            },
          ],
        },
      };

      const action = { type: 'TICK_NOW', nowISO: '2026-01-14T06:00:00.000Z' };

      const result1 = computeDerivedState(state, action);
      const result2 = computeDerivedState(state, action);
      const result3 = computeDerivedState(state, action);

      expect(JSON.stringify(result1)).toEqual(JSON.stringify(result2));
      expect(JSON.stringify(result1)).toEqual(JSON.stringify(result3));
    });
  });
});
