/**
 * Regression Test: activeScheduledLoop fresh-on-read semantics
 *
 * This test encodes the exact staleness bug from recoverCanonicalContractForCycle
 * and verifies that the new selector module always derives fresh, never frozen.
 *
 * Two axes of freshness are tested:
 * 1. TIME-PASSING: startDayKey changes when appTime.nowISO advances (no dispatch needed)
 * 2. EVENT-LEDGER: completedToday reflects newly-appended execution events immediately
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveStartDayKey,
  resolveEndDayKey,
  resolveDeadlineISO,
  daysRemaining,
  resolveActiveScheduledContract,
  resolvePosInputs,
  type ResolvedCycleContract,
} from './activeScheduledLoop.ts';
import { APP_TIME_ZONE, dayKeyFromDate } from '../time/time.ts';

describe('activeScheduledLoop: fresh-on-read selector', () => {
  let baseState: any;
  let baseCycle: any;
  let baseContract: any;

  beforeEach(() => {
    // Seed state/cycle/contract at day N (2026-08-19)
    const dayN = '2026-08-19';
    const nextDayISO = '2026-08-20T00:00:00.000Z';

    baseContract = {
      goalId: 'goal-1',
      goalText: 'Test goal',
      startDayKey: undefined, // Intentionally missing — selector should use fallback
      endDayKey: '2026-09-19',
      timezone: APP_TIME_ZONE,
    };

    baseCycle = {
      id: 'cycle-1',
      goalContract: baseContract,
      startedAtDayKey: undefined, // Not yet explicitly activated
      schedule: {
        blocks: [
          { id: 'block-1', status: 'planned', title: 'Block 1' },
          { id: 'block-2', status: 'in_progress', title: 'Block 2' },
          { id: 'block-3', status: 'suggested', title: 'Block 3 (backlog)' }, // Should NOT appear in activeBlocks
        ],
      },
    };

    baseState = {
      appTime: {
        nowISO: dayN + 'T12:00:00Z', // Seeded at day N
      },
      goalExecutionContract: null,
      executionEvents: [],
    };
  });

  describe('resolveStartDayKey: time-passing axis (freshness on read)', () => {
    it('should use cycle.startedAtDayKey if present', () => {
      const result = resolveStartDayKey(
        { startedAtDayKey: '2026-08-10' },
        {},
        baseState,
        APP_TIME_ZONE
      );
      expect(result).toBe('2026-08-10');
    });

    it('should fall through to contract.startDayKey if cycle.startedAtDayKey absent', () => {
      const result = resolveStartDayKey(
        { startedAtDayKey: undefined },
        { startDayKey: '2026-08-15' },
        baseState,
        APP_TIME_ZONE
      );
      expect(result).toBe('2026-08-15');
    });

    it('should fall through to state.goalExecutionContract.startDayKey if cycle/contract both absent', () => {
      const result = resolveStartDayKey(
        { startedAtDayKey: undefined },
        { startDayKey: undefined },
        { goalExecutionContract: { startDayKey: '2026-08-12' } },
        APP_TIME_ZONE
      );
      expect(result).toBe('2026-08-12');
    });

    it('REGRESSION: should return nowDayKey on fallback, recomputed fresh on each call', () => {
      // Call 1: appTime is day N
      const call1 = resolveStartDayKey(
        { startedAtDayKey: undefined }, // Explicitly no stored startDayKey
        { startDayKey: undefined },
        baseState,
        baseState.appTime.nowISO, // Pass explicit nowISO (day N)
        APP_TIME_ZONE
      );
      expect(call1).toBe(dayKeyFromDate(new Date(baseState.appTime.nowISO), APP_TIME_ZONE));

      // Simulate day N+5 passing WITHOUT any dispatch (no state mutation)
      const dayNPlus5ISO = '2026-08-24T12:00:00Z';
      const stateDayNPlus5 = {
        ...baseState,
        appTime: { nowISO: dayNPlus5ISO }, // Only appTime changed, no dispatch
      };

      // Call 2: should reflect new "today" immediately
      const call2 = resolveStartDayKey(
        { startedAtDayKey: undefined },
        { startDayKey: undefined },
        stateDayNPlus5,
        dayNPlus5ISO, // Pass explicit nowISO (day N+5)
        APP_TIME_ZONE
      );
      expect(call2).toBe(dayKeyFromDate(new Date(dayNPlus5ISO), APP_TIME_ZONE));

      // Verify they differ (if they don't, the fresh-on-read promise is broken)
      expect(call2).not.toBe(call1);
      expect(call1).toBe('2026-08-19');
      expect(call2).toBe('2026-08-24');
    });

    it('REGRESSION: recoverCanonicalContractForCycle would freeze startDayKey on day N, returning it on day N+5', () => {
      // This is the BUG: once computed on day N, a cached/persisted startDayKey
      // would return '2026-08-19' even when called on day N+5.
      // Our selector should NOT do this — it should always recompute.

      const call1 = resolveStartDayKey(
        { startedAtDayKey: undefined },
        { startDayKey: undefined },
        baseState,
        baseState.appTime.nowISO, // Day N
        APP_TIME_ZONE
      );

      // Advance 5 days
      const dayNPlus5ISO = '2026-08-24T12:00:00Z';
      const stateDayNPlus5 = {
        ...baseState,
        appTime: { nowISO: dayNPlus5ISO },
      };

      const call2 = resolveStartDayKey(
        { startedAtDayKey: undefined },
        { startDayKey: undefined },
        stateDayNPlus5,
        dayNPlus5ISO, // Day N+5
        APP_TIME_ZONE
      );

      // Bug: call2 would return '2026-08-19' (the frozen value from day N)
      // Fix: call2 should return '2026-08-24' (today's date, recomputed fresh)
      expect(call2).not.toBe(call1); // If this fails, selector is caching
      expect(call2).toBe('2026-08-24');
    });
  });

  describe('resolveEndDayKey & resolveDeadlineISO', () => {
    it('should resolve endDayKey with priority order', () => {
      const result = resolveEndDayKey(
        { endedAtDayKey: '2026-09-20' },
        { endDayKey: '2026-09-15' },
        { goalExecutionContract: { endDayKey: '2026-09-10' } }
      );
      expect(result).toBe('2026-09-20'); // Highest priority
    });

    it('should return null if no endDayKey anywhere', () => {
      const result = resolveEndDayKey(
        { endedAtDayKey: undefined },
        { endDayKey: undefined },
        { goalExecutionContract: null }
      );
      expect(result).toBeNull();
    });

    it('should compute deadlineISO from endDayKey', () => {
      const result = resolveDeadlineISO('2026-08-31', APP_TIME_ZONE);
      expect(result).toContain('2026-08-31T'); // Should include the date
      expect(result).toContain('Z'); // ISO format
    });

    it('should return null if endDayKey is null', () => {
      const result = resolveDeadlineISO(null, APP_TIME_ZONE);
      expect(result).toBeNull();
    });
  });

  describe('daysRemaining', () => {
    it('should compute inclusive day count between start and end', () => {
      const result = daysRemaining('2026-08-19', '2026-08-21');
      expect(result).toBe(3); // 19, 20, 21 = 3 days inclusive
    });

    it('should return null if endDayKey is null', () => {
      const result = daysRemaining('2026-08-19', null);
      expect(result).toBeNull();
    });

    it('should return null if dates are invalid', () => {
      const result = daysRemaining('invalid', '2026-08-21');
      expect(result).toBeNull();
    });

    it('should return null if deadline is before start', () => {
      const result = daysRemaining('2026-08-25', '2026-08-21');
      expect(result).toBeNull();
    });
  });

  describe('resolveActiveScheduledContract: full contract resolution', () => {
    it('should resolve a full contract with all fields', () => {
      const result = resolveActiveScheduledContract(baseCycle, baseState, baseState.appTime.nowISO, APP_TIME_ZONE);

      expect(result).toBeDefined();
      expect(result.goalId).toBe('goal-1');
      expect(result.goalText).toBe('Test goal');
      expect(result.startDayKey).toBeDefined(); // Never null
      expect(result.endDayKey).toBe('2026-09-19');
      expect(result.timezone).toBe(APP_TIME_ZONE);
    });

    it('REGRESSION: should recompute startDayKey fresh on each call', () => {
      const call1 = resolveActiveScheduledContract(baseCycle, baseState, baseState.appTime.nowISO, APP_TIME_ZONE);

      // Advance time
      const dayNPlus5ISO = '2026-08-24T12:00:00Z';
      const stateDayNPlus5 = {
        ...baseState,
        appTime: { nowISO: dayNPlus5ISO },
      };

      const call2 = resolveActiveScheduledContract(baseCycle, stateDayNPlus5, dayNPlus5ISO, APP_TIME_ZONE);

      // If startDayKey is cached, call2 would return the same startDayKey as call1
      // With fresh-on-read, call2 should reflect the new "today"
      expect(call2.startDayKey).not.toBe(call1.startDayKey);
    });
  });

  describe('resolvePosInputs: execution ledger freshness (event axis)', () => {
    it('should include only active blocks (status: planned|in_progress)', () => {
      const result = resolvePosInputs(baseCycle, baseState, baseState.appTime.nowISO, APP_TIME_ZONE);

      expect(result.activeBlocks).toHaveLength(2); // block-1 and block-2
      expect(result.activeBlocks.map((b: any) => b.id)).toEqual(['block-1', 'block-2']);
      expect(result.activeBlocks.every((b: any) => b.status !== 'suggested')).toBe(true);
    });

    it('REGRESSION: should reflect newly-appended execution events without dispatch', () => {
      // Call 1: no execution events
      const call1 = resolvePosInputs(baseCycle, baseState, baseState.appTime.nowISO, APP_TIME_ZONE);
      expect(call1.completedToday).toBe(0);
      expect(call1.completedTotal).toBe(0);

      // Append an execution event (simulating user completing a block)
      const newEvent = {
        id: 'event-1',
        blockId: 'block-1',
        kind: 'complete' as const,
        completed: true,
        dateISO: baseState.appTime.nowISO,
        completedAtISO: baseState.appTime.nowISO,
        minutes: 30,
        rawLabel: 'Completed something',
        domain: 'Body' as const,
      };

      const stateWithEvent = {
        ...baseState,
        executionEvents: [newEvent],
      };

      // Call 2: same cycle, no other state change, just appended event
      // With fresh-on-read, selector should rebuild snapshot and see the new event
      const call2 = resolvePosInputs(baseCycle, stateWithEvent, baseState.appTime.nowISO, APP_TIME_ZONE);

      // Bug: if snapshot was cached, completedToday would still be 0
      // Fix: selector rebuilds snapshot fresh, so completedToday is now 1
      expect(call2.completedToday).toBe(1);
      expect(call2.completedTotal).toBe(1);
      expect(call2.completedToday).not.toBe(call1.completedToday);
    });

    it('should count completed blocks by day, excluding other days', () => {
      const todayISO = baseState.appTime.nowISO; // 2026-08-19
      const yesterdayISO = '2026-08-18T12:00:00Z';

      const stateWithMixedEvents = {
        ...baseState,
        executionEvents: [
          {
            id: 'event-today',
            blockId: 'block-1',
            kind: 'complete' as const,
            completed: true,
            dateISO: todayISO,
            completedAtISO: todayISO,
            minutes: 30,
            rawLabel: 'Today',
            domain: 'Body' as const,
          },
          {
            id: 'event-yesterday',
            blockId: 'block-2',
            kind: 'complete' as const,
            completed: true,
            dateISO: yesterdayISO,
            completedAtISO: yesterdayISO,
            minutes: 45,
            rawLabel: 'Yesterday',
            domain: 'Body' as const,
          },
        ],
      };

      const result = resolvePosInputs(baseCycle, stateWithMixedEvents, todayISO, APP_TIME_ZONE);

      expect(result.completedTotal).toBe(2); // Both events
      expect(result.completedToday).toBe(1); // Only today's event
    });

    it('should handle empty execution events array', () => {
      const result = resolvePosInputs(baseCycle, baseState, baseState.appTime.nowISO, APP_TIME_ZONE);

      expect(result.completedToday).toBe(0);
      expect(result.completedTotal).toBe(0);
      expect(Array.isArray(result.activeBlocks)).toBe(true);
    });
  });

  describe('Contract + execution integration', () => {
    it('should return complete POS input object with all required fields', () => {
      const result = resolvePosInputs(baseCycle, baseState, baseState.appTime.nowISO, APP_TIME_ZONE);

      expect(result).toHaveProperty('contract');
      expect(result).toHaveProperty('startDayKey');
      expect(result).toHaveProperty('activeBlocks');
      expect(result).toHaveProperty('completedToday');
      expect(result).toHaveProperty('completedTotal');

      const contract = result.contract as ResolvedCycleContract;
      expect(contract.startDayKey).toBeDefined();
      expect(contract.startDayKey).not.toBeNull();
    });
  });
});
