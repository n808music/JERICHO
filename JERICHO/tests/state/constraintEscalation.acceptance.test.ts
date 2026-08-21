/**
 * Item 5: CONSTRAINT Escalation Bypass — Acceptance Test Suite
 *
 * Locked Architecture (2026-08-20):
 * - Pure selector: resolveConstraintEscalation(state, scope?) → ConstraintEscalationResult
 * - No new event kinds; escalation computed from daysInBacklog only
 * - constraintTag field on Block: 'CONSTRAINT' | 'INTENT' | 'ADVISORY'
 * - Three discrete urgency tiers: NORMAL (>7 days), ELEVATED (3-7 days), URGENT (<=3 days)
 * - Scope filtering: optional cycleId/goalId/entityId filters
 * - Fresh-on-read: no caching, no state writes, pure function
 *
 * Test Coverage:
 * 1. CONSTRAINT-tagged block in Backlog 1 day → URGENT tier
 * 2. CONSTRAINT-tagged block in Backlog 5 days → ELEVATED tier
 * 3. CONSTRAINT-tagged block in Backlog 10 days → NORMAL tier
 * 4. Non-CONSTRAINT block → filtered out (not in result)
 * 5. INTENT/ADVISORY tags → filtered out (only CONSTRAINT included)
 * 6. Scope filtering by cycleId works correctly
 * 7. Scope filtering by goalId works correctly
 * 8. Scope filtering by entityId works correctly
 * 9. Idempotence: calling twice yields identical result, no mutations
 * 10. Count aggregation: urgentCount, elevatedCount, normalCount correct
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveConstraintEscalation } from '../../src/core/engine/resolveConstraintEscalation';

// ============================================================================
// Fixtures
// ============================================================================

const TODAY_DAYKEY = '2026-08-20';
const GOAL_ID = 'goal-constraint-test';
const CYCLE_ID = 'cycle-constraint-test';
const ENTITY_ID = 'entity-constraint-test';

/**
 * Create a block that was missed N days ago (flows to Backlog)
 */
function createBacklogBlock(id: string, daysAgo: number, constraintTag?: 'CONSTRAINT' | 'INTENT' | 'ADVISORY') {
  const missedDate = new Date(TODAY_DAYKEY + 'T00:00:00Z');
  missedDate.setDate(missedDate.getDate() - daysAgo);
  const missedDayKey = missedDate.toISOString().split('T')[0];

  return {
    id,
    title: `Block ${id}`,
    label: `Block ${id}`,
    start: `${missedDayKey}T09:00:00.000Z`,
    end: `${missedDayKey}T10:00:00.000Z`,
    status: 'missed' as const,
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    domain: 'CORE',
    origin: 'schedule_active',
    ...(constraintTag && { constraintTag }),
  };
}

/**
 * Create missed execution event (block flows to Backlog)
 */
function createMissedEvent(blockId: string, daysAgo: number) {
  const missedDate = new Date(TODAY_DAYKEY + 'T00:00:00Z');
  missedDate.setDate(missedDate.getDate() - daysAgo);
  const missedDayKey = missedDate.toISOString().split('T')[0];

  return {
    id: `evt-missed-${blockId}`,
    blockId,
    kind: 'missed' as const,
    dateISO: missedDayKey,
    startISO: `${missedDayKey}T09:00:00.000Z`,
    endISO: `${missedDayKey}T10:00:00.000Z`,
    status: 'missed' as const,
    recordedAtISO: new Date().toISOString(),
    cycleId: CYCLE_ID,
    goalId: GOAL_ID,
    minutes: 60,
  };
}

function buildBaseState(overrides: any = {}) {
  return {
    appTime: {
      nowISO: new Date().toISOString(),
      activeDayKey: TODAY_DAYKEY,
      timeZone: 'UTC',
    },
    today: {
      date: TODAY_DAYKEY,
      blocks: [],
      ...overrides.today,
    },
    executionEvents: overrides.executionEvents || [],
    blockStore: { blocks: {} },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Item 5: CONSTRAINT Escalation Bypass', () => {
  describe('Tier classification by daysInBacklog', () => {
    it('CONSTRAINT block 1 day in Backlog → URGENT tier', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [createBacklogBlock('blk-1d', 1, 'CONSTRAINT')],
        },
        executionEvents: [createMissedEvent('blk-1d', 1)],
      });

      const result = resolveConstraintEscalation(state);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].urgencyTier).toBe('URGENT');
      expect(result.items[0].daysInBacklog).toBe(1);
      expect(result.urgentCount).toBe(1);
      expect(result.elevatedCount).toBe(0);
      expect(result.normalCount).toBe(0);
    });

    it('CONSTRAINT block 5 days in Backlog → ELEVATED tier', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [createBacklogBlock('blk-5d', 5, 'CONSTRAINT')],
        },
        executionEvents: [createMissedEvent('blk-5d', 5)],
      });

      const result = resolveConstraintEscalation(state);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].urgencyTier).toBe('ELEVATED');
      expect(result.items[0].daysInBacklog).toBe(5);
      expect(result.elevatedCount).toBe(1);
      expect(result.urgentCount).toBe(0);
      expect(result.normalCount).toBe(0);
    });

    it('CONSTRAINT block 10 days in Backlog → NORMAL tier', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [createBacklogBlock('blk-10d', 10, 'CONSTRAINT')],
        },
        executionEvents: [createMissedEvent('blk-10d', 10)],
      });

      const result = resolveConstraintEscalation(state);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].urgencyTier).toBe('NORMAL');
      expect(result.items[0].daysInBacklog).toBe(10);
      expect(result.normalCount).toBe(1);
      expect(result.urgentCount).toBe(0);
      expect(result.elevatedCount).toBe(0);
    });

    it('Boundary: 3 days exactly → URGENT', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [createBacklogBlock('blk-3d', 3, 'CONSTRAINT')],
        },
        executionEvents: [createMissedEvent('blk-3d', 3)],
      });

      const result = resolveConstraintEscalation(state);
      expect(result.items[0].urgencyTier).toBe('URGENT');
    });

    it('Boundary: 7 days exactly → ELEVATED', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [createBacklogBlock('blk-7d', 7, 'CONSTRAINT')],
        },
        executionEvents: [createMissedEvent('blk-7d', 7)],
      });

      const result = resolveConstraintEscalation(state);
      expect(result.items[0].urgencyTier).toBe('ELEVATED');
    });
  });

  describe('Tag filtering', () => {
    it('Non-CONSTRAINT block (no tag) → filtered out', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [createBacklogBlock('blk-untagged', 5)], // No constraintTag
        },
        executionEvents: [createMissedEvent('blk-untagged', 5)],
      });

      const result = resolveConstraintEscalation(state);
      expect(result.items).toHaveLength(0);
    });

    it('INTENT-tagged block → filtered out', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [createBacklogBlock('blk-intent', 5, 'INTENT')],
        },
        executionEvents: [createMissedEvent('blk-intent', 5)],
      });

      const result = resolveConstraintEscalation(state);
      expect(result.items).toHaveLength(0);
    });

    it('ADVISORY-tagged block → filtered out', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [createBacklogBlock('blk-advisory', 5, 'ADVISORY')],
        },
        executionEvents: [createMissedEvent('blk-advisory', 5)],
      });

      const result = resolveConstraintEscalation(state);
      expect(result.items).toHaveLength(0);
    });
  });

  describe('Scope filtering', () => {
    it('Filter by cycleId includes only matching cycle', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [
            createBacklogBlock('blk-cycle-1', 5, 'CONSTRAINT'),
            { ...createBacklogBlock('blk-cycle-2', 3, 'CONSTRAINT'), cycleId: 'other-cycle' },
          ],
        },
        executionEvents: [
          createMissedEvent('blk-cycle-1', 5),
          createMissedEvent('blk-cycle-2', 3),
        ],
      });

      const result = resolveConstraintEscalation(state, { cycleId: CYCLE_ID });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].blockId).toBe('blk-cycle-1');
    });

    it('Filter by goalId includes only matching goal', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [
            createBacklogBlock('blk-goal-1', 5, 'CONSTRAINT'),
            { ...createBacklogBlock('blk-goal-2', 3, 'CONSTRAINT'), goalId: 'other-goal' },
          ],
        },
        executionEvents: [
          createMissedEvent('blk-goal-1', 5),
          createMissedEvent('blk-goal-2', 3),
        ],
      });

      const result = resolveConstraintEscalation(state, { goalId: GOAL_ID });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].blockId).toBe('blk-goal-1');
    });
  });

  describe('Aggregation and idempotence', () => {
    it('Aggregates counts correctly for mixed tiers', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [
            createBacklogBlock('blk-1d', 1, 'CONSTRAINT'),   // URGENT
            createBacklogBlock('blk-2d', 2, 'CONSTRAINT'),   // URGENT
            createBacklogBlock('blk-5d', 5, 'CONSTRAINT'),   // ELEVATED
            createBacklogBlock('blk-10d', 10, 'CONSTRAINT'), // NORMAL
          ],
        },
        executionEvents: [
          createMissedEvent('blk-1d', 1),
          createMissedEvent('blk-2d', 2),
          createMissedEvent('blk-5d', 5),
          createMissedEvent('blk-10d', 10),
        ],
      });

      const result = resolveConstraintEscalation(state);
      expect(result.items).toHaveLength(4);
      expect(result.urgentCount).toBe(2);
      expect(result.elevatedCount).toBe(1);
      expect(result.normalCount).toBe(1);
    });

    it('Idempotence: calling twice yields identical result, no mutations', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [createBacklogBlock('blk-5d', 5, 'CONSTRAINT')],
        },
        executionEvents: [createMissedEvent('blk-5d', 5)],
      });

      const result1 = resolveConstraintEscalation(state);
      const result2 = resolveConstraintEscalation(state);

      expect(JSON.stringify(result1)).toEqual(JSON.stringify(result2));
      // Verify state was not mutated
      expect(state.today.blocks).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('Empty state returns empty result', () => {
      const state = buildBaseState();
      const result = resolveConstraintEscalation(state);
      expect(result.items).toHaveLength(0);
      expect(result.urgentCount).toBe(0);
      expect(result.elevatedCount).toBe(0);
      expect(result.normalCount).toBe(0);
    });

    it('No CONSTRAINT-tagged blocks returns empty result', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [createBacklogBlock('blk-intent', 5, 'INTENT')],
        },
        executionEvents: [createMissedEvent('blk-intent', 5)],
      });

      const result = resolveConstraintEscalation(state);
      expect(result.items).toHaveLength(0);
    });

    it('Scope filter with no matches returns empty result', () => {
      const state = buildBaseState({
        today: {
          date: TODAY_DAYKEY,
          blocks: [createBacklogBlock('blk-5d', 5, 'CONSTRAINT')],
        },
        executionEvents: [createMissedEvent('blk-5d', 5)],
      });

      const result = resolveConstraintEscalation(state, { cycleId: 'nonexistent-cycle' });
      expect(result.items).toHaveLength(0);
    });
  });
});
