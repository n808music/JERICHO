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

    it('should create MISSED and CREATE events for committed blocks', () => {
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
              status: 'in_progress',
              placementState: 'COMMITTED',
            },
          ],
        },
      };

      const result = rolloverAtMidnight({ state, nowISO, timeZone });

      expect(result.eventsEmitted).toHaveLength(2);

      const missedEvent = result.eventsEmitted.find((e) => e.kind === 'missed');
      expect(missedEvent).toBeDefined();
      expect(missedEvent.blockId).toBe('block-1');
      expect(missedEvent.dateISO).toBe('2026-01-13');
      expect(missedEvent.completed).toBe(false);

      const createEvent = result.eventsEmitted.find((e) => e.kind === 'create');
      expect(createEvent).toBeDefined();
      expect(createEvent.blockId).toMatch(/^overdue-/);
      expect(createEvent.dateISO).toBe('2026-01-14');
      expect(createEvent.completed).toBe(false);
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
      expect(result.today.blocks).toHaveLength(2);

      const originalBlock = result.today.blocks.find((b) => b.id === 'block-1');
      expect(originalBlock).toBeDefined();
      expect(originalBlock.placementState).toBe('in_progress');

      const overdueBlock = result.today.blocks.find((b) => b.id !== 'block-1' && b.status === 'in_progress');
      expect(overdueBlock).toBeDefined();
      expect(overdueBlock.id).toMatch(/^overdue-/);
      expect(overdueBlock.status).toBe('in_progress');
      expect(overdueBlock.placementState).toBe('COMMITTED');
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
