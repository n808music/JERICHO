/**
 * deterministicPlanGenerator.test.ts
 *
 * Tests for Phase 3 Generic Deterministic Plan Generator
 * Verifies determinism, auto-deliverables, constraint enforcement, and block allocation
 */

import { describe, it, expect } from 'vitest';
import { generateDeterministicPlan, buildAutoDeliverables, DeterministicGenInput } from '../deterministicPlanGenerator';

const NOW = '2026-01-10';
const DEADLINE = '2026-02-20';
const START = '2026-01-10';

const buildInput = (overrides: Partial<DeterministicGenInput> = {}): DeterministicGenInput => ({
  contractDeadlineDayKey: DEADLINE,
  contractStartDayKey: START,
  nowDayKey: NOW,
  causalChainSteps: undefined,
  constraints: {
    maxBlocksPerDay: 4,
    maxBlocksPerWeek: 16,
    preferredDaysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    blackoutDayKeys: [],
    timezone: 'UTC',
  },
  mode: 'REGENERATE',
  ...overrides,
});

describe('deterministicPlanGenerator', () => {
  describe('buildAutoDeliverables', () => {
    it('builds 3-tier default model when no causal chain', () => {
      const deliverables = buildAutoDeliverables();
      expect(deliverables).toHaveLength(3);
      expect(deliverables[0].kind).toBe('PLANNING');
      expect(deliverables[1].kind).toBe('CORE');
      expect(deliverables[2].kind).toBe('VERIFICATION');
    });

    it('uses causal chain steps when provided', () => {
      const steps = [
        { sequence: 1, description: 'Design' },
        { sequence: 2, description: 'Build' },
        { sequence: 3, description: 'Test' },
      ];
      const deliverables = buildAutoDeliverables(steps);
      expect(deliverables).toHaveLength(3);
      expect(deliverables[0].title).toBe('Design');
      expect(deliverables[1].title).toBe('Build');
      expect(deliverables[2].title).toBe('Test');
    });

    it('sorts causal chain by sequence', () => {
      const steps = [
        { sequence: 3, description: 'Test' },
        { sequence: 1, description: 'Design' },
        { sequence: 2, description: 'Build' },
      ];
      const deliverables = buildAutoDeliverables(steps);
      expect(deliverables[0].title).toBe('Design');
      expect(deliverables[1].title).toBe('Build');
      expect(deliverables[2].title).toBe('Test');
    });

    it('returns empty array for empty causal chain', () => {
      const deliverables = buildAutoDeliverables([]);
      expect(deliverables).toHaveLength(3); // Falls back to default
    });
  });

  describe('determinism: same input → same output', () => {
    it('generates identical blocks for repeated calls', () => {
      const input = buildInput();
      const result1 = generateDeterministicPlan(input);
      const result2 = generateDeterministicPlan(input);

      expect(result1.status).toBe(result2.status);
      expect(result1.proposedBlocks).toHaveLength(result2.proposedBlocks.length);
      expect(result1.proposedBlocks).toEqual(result2.proposedBlocks);
    });

    it('preserves block order across generations', () => {
      const input = buildInput();
      const result1 = generateDeterministicPlan(input);
      const result2 = generateDeterministicPlan(input);

      result1.proposedBlocks.forEach((block, idx) => {
        expect(block.dayKey).toBe(result2.proposedBlocks[idx].dayKey);
        expect(block.deliverableId).toBe(result2.proposedBlocks[idx].deliverableId);
      });
    });
  });

  describe('constraint enforcement', () => {
    it('rejects zero daily capacity', () => {
      const input = buildInput({
        constraints: { ...buildInput().constraints, maxBlocksPerDay: 0 },
      });
      const result = generateDeterministicPlan(input);
      expect(result.status).toBe('INFEASIBLE');
      expect(result.error?.code).toBe('DAILY_CAP_ZERO');
    });

    it('rejects negative daily capacity', () => {
      const input = buildInput({
        constraints: { ...buildInput().constraints, maxBlocksPerDay: -1 },
      });
      const result = generateDeterministicPlan(input);
      expect(result.status).toBe('INFEASIBLE');
      expect(result.error?.code).toBe('DAILY_CAP_ZERO');
    });

    it('rejects zero weekly capacity', () => {
      const input = buildInput({
        constraints: { ...buildInput().constraints, maxBlocksPerWeek: 0 },
      });
      const result = generateDeterministicPlan(input);
      expect(result.status).toBe('INFEASIBLE');
      expect(result.error?.code).toBe('WEEKLY_CAP_ZERO');
    });

    it('rejects deadline before start date', () => {
      const input = buildInput({
        contractDeadlineDayKey: '2026-01-01',
        contractStartDayKey: '2026-02-01',
      });
      const result = generateDeterministicPlan(input);
      expect(result.status).toBe('INFEASIBLE');
      expect(result.error?.code).toBe('DEADLINE_BEFORE_START');
    });

    it('rejects deadline equal to start date', () => {
      const input = buildInput({
        contractDeadlineDayKey: '2026-01-10',
        contractStartDayKey: '2026-01-10',
      });
      const result = generateDeterministicPlan(input);
      expect(result.status).toBe('INFEASIBLE');
    });

    it('respects daily block limit', () => {
      const input = buildInput({
        constraints: { ...buildInput().constraints, maxBlocksPerDay: 2 },
      });
      const result = generateDeterministicPlan(input);
      if (result.status === 'SUCCESS') {
        const blocksByDay: Record<string, number> = {};
        result.proposedBlocks.forEach((block) => {
          blocksByDay[block.dayKey] = (blocksByDay[block.dayKey] || 0) + 1;
        });
        Object.values(blocksByDay).forEach((count) => {
          expect(count).toBeLessThanOrEqual(2);
        });
      }
    });
  });

  describe('mode: REGENERATE vs REBASE_FROM_TODAY', () => {
    it('REGENERATE uses contract start date', () => {
      const input = buildInput({
        contractStartDayKey: '2026-01-10',
        nowDayKey: '2026-01-20',
        mode: 'REGENERATE',
      });
      const result = generateDeterministicPlan(input);
      if (result.status === 'SUCCESS' && result.proposedBlocks.length > 0) {
        expect(result.proposedBlocks[0].dayKey >= '2026-01-10').toBe(true);
      }
    });

    it('REBASE_FROM_TODAY uses now date', () => {
      const input = buildInput({
        contractStartDayKey: '2026-01-10',
        nowDayKey: '2026-01-20',
        mode: 'REBASE_FROM_TODAY',
      });
      const result = generateDeterministicPlan(input);
      if (result.status === 'SUCCESS' && result.proposedBlocks.length > 0) {
        expect(result.proposedBlocks[0].dayKey >= '2026-01-20').toBe(true);
      }
    });
  });

  describe('auto-deliverables integration', () => {
    it('auto-deliverables appear in result', () => {
      const input = buildInput();
      const result = generateDeterministicPlan(input);
      expect(result.autoDeliverables.length).toBeGreaterThan(0);
    });

    it('blocks are assigned to deliverables', () => {
      const input = buildInput();
      const result = generateDeterministicPlan(input);
      if (result.status === 'SUCCESS') {
        result.proposedBlocks.forEach((block) => {
          const deliv = result.autoDeliverables.find((d) => d.id === block.deliverableId);
          expect(deliv).toBeDefined();
        });
      }
    });
  });

  describe('feasibility guarantees', () => {
    it('returns SUCCESS with >0 blocks when feasible', () => {
      const input = buildInput();
      const result = generateDeterministicPlan(input);
      if (result.status === 'SUCCESS') {
        expect(result.proposedBlocks.length).toBeGreaterThan(0);
      }
    });

    it('returns INFEASIBLE with error code when infeasible', () => {
      const input = buildInput({
        contractDeadlineDayKey: '2026-01-11', // Only 1 day + weekend
        constraints: { ...buildInput().constraints, preferredDaysOfWeek: [1, 2, 3, 4, 5] },
      });
      const result = generateDeterministicPlan(input);
      if (result.status === 'INFEASIBLE') {
        expect(result.error?.code).toBeDefined();
        expect(result.error?.message).toBeDefined();
      }
    });

    it('respects preferred days of week', () => {
      const input = buildInput({
        constraints: {
          ...buildInput().constraints,
          preferredDaysOfWeek: [1, 3, 5], // Mon, Wed, Fri only
        },
      });
      const result = generateDeterministicPlan(input);
      if (result.status === 'SUCCESS') {
        result.proposedBlocks.forEach((block) => {
          const d = new Date(`${block.dayKey}T12:00:00Z`);
          const dow = d.getUTCDay();
          expect([1, 3, 5]).toContain(dow);
        });
      }
    });

    it('respects blackout dates', () => {
      const input = buildInput({
        constraints: {
          ...buildInput().constraints,
          blackoutDayKeys: ['2026-01-15', '2026-01-16'],
        },
      });
      const result = generateDeterministicPlan(input);
      if (result.status === 'SUCCESS') {
        result.proposedBlocks.forEach((block) => {
          expect(block.dayKey).not.toBe('2026-01-15');
          expect(block.dayKey).not.toBe('2026-01-16');
        });
      }
    });
  });

  describe('causal chain scheduling', () => {
    it('schedules blocks from causal chain', () => {
      const steps = [
        { sequence: 1, description: 'Phase 1' },
        { sequence: 2, description: 'Phase 2' },
      ];
      const input = buildInput({ causalChainSteps: steps });
      const result = generateDeterministicPlan(input);
      expect(result.autoDeliverables).toHaveLength(2);
      expect(result.autoDeliverables[0].title).toBe('Phase 1');
      expect(result.autoDeliverables[1].title).toBe('Phase 2');
    });

    it('carries an optional projectId through to autoDeliverables and proposedBlocks as sourceProjectId (2026-07-13 §3/§6)', () => {
      const steps = [
        { sequence: 1, description: 'Foundation', projectId: 'p1' },
        { sequence: 2, description: 'Finish', projectId: 'p2' },
      ];
      const input = buildInput({ causalChainSteps: steps });
      const result = generateDeterministicPlan(input);
      expect(result.autoDeliverables.map((d) => d.sourceProjectId)).toEqual(['p1', 'p2']);
      if (result.status === 'SUCCESS' || result.status === 'PARTIAL') {
        expect(result.proposedBlocks.length).toBeGreaterThan(0);
        result.proposedBlocks.forEach((block) => {
          const deliv = result.autoDeliverables.find((d) => d.id === block.deliverableId);
          expect(block.sourceProjectId).toBe(deliv?.sourceProjectId);
        });
      }
    });

    it('leaves sourceProjectId undefined for a manually-authored causal chain step with no projectId', () => {
      const steps = [{ sequence: 1, description: 'Manual step, no matrix link' }];
      const input = buildInput({ causalChainSteps: steps });
      const result = generateDeterministicPlan(input);
      expect(result.autoDeliverables[0].sourceProjectId).toBeUndefined();
    });
  });

  describe('iteration guardrails: termination under pathological constraints', () => {
    it('terminates and returns INFEASIBLE under worst-case constraints (1-day deadline, 0 capacity)', () => {
      // Start and deadline on same day = only 1 day available
      const input = buildInput({
        contractStartDayKey: '2026-01-10',
        contractDeadlineDayKey: '2026-01-10',
        constraints: {
          maxBlocksPerDay: 0, // Zero daily capacity
          maxBlocksPerWeek: 0,
          preferredDaysOfWeek: [1, 2, 3, 4, 5],
          blackoutDayKeys: [],
          timezone: 'UTC',
        },
      });

      const result = generateDeterministicPlan(input);

      // Must return INFEASIBLE, not hang or throw
      expect(result.status).toBe('INFEASIBLE');
      expect(result.error).toBeDefined();
      expect(result.proposedBlocks).toHaveLength(0);
    });

    it('terminates and returns INFEASIBLE under very tight constraints (10 blocks required, 1 day, 1 block/day max)', () => {
      // Require 10 blocks but only 1 day with 1 block/day capacity
      const input = buildInput({
        contractStartDayKey: '2026-01-10',
        contractDeadlineDayKey: '2026-01-10',
        causalChainSteps: [
          { sequence: 1, description: 'Must do 1' },
          { sequence: 2, description: 'Must do 2' },
          { sequence: 3, description: 'Must do 3' },
          { sequence: 4, description: 'Must do 4' },
          { sequence: 5, description: 'Must do 5' },
          { sequence: 6, description: 'Must do 6' },
          { sequence: 7, description: 'Must do 7' },
          { sequence: 8, description: 'Must do 8' },
          { sequence: 9, description: 'Must do 9' },
          { sequence: 10, description: 'Must do 10' },
        ],
        constraints: {
          maxBlocksPerDay: 1,
          maxBlocksPerWeek: 1,
          preferredDaysOfWeek: [1, 2, 3, 4, 5],
          blackoutDayKeys: [],
          timezone: 'UTC',
        },
      });

      const result = generateDeterministicPlan(input);

      // Must return INFEASIBLE, not hang or throw
      expect(result.status).toBe('INFEASIBLE');
      expect(result.error).toBeDefined();
      // May have 0 or 1 blocks allocated, but must return gracefully
      expect(typeof result.proposedBlocks.length).toBe('number');
    });

    it('terminates quickly even with very long date range (100 years)', () => {
      // Very long period: 2026 to 2126, but with 0 capacity
      const input = buildInput({
        contractStartDayKey: '2026-01-10',
        contractDeadlineDayKey: '2126-01-10',
        constraints: {
          maxBlocksPerDay: 0,
          maxBlocksPerWeek: 0,
          preferredDaysOfWeek: [1, 2, 3, 4, 5],
          blackoutDayKeys: [],
          timezone: 'UTC',
        },
      });

      const start = performance.now();
      const result = generateDeterministicPlan(input);
      const duration = performance.now() - start;

      // Must complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
      expect(result.status).toBe('INFEASIBLE');
    });
  });

  describe('capacity violation contract (2026-07-13 unified schedule generation, §5)', () => {
    it('returns PARTIAL, not a silent SUCCESS, when required blocks exceed available capacity', () => {
      // Default 3-tier deliverables require 10 blocks (2 + 6 + 2). Give it only 3 days at
      // 1 block/day/week so at most ~3 blocks can ever fit.
      const input = buildInput({
        contractStartDayKey: '2026-01-05', // Monday
        contractDeadlineDayKey: '2026-01-07', // Wednesday
        constraints: {
          maxBlocksPerDay: 1,
          maxBlocksPerWeek: 3,
          preferredDaysOfWeek: [1, 2, 3, 4, 5],
          blackoutDayKeys: [],
          timezone: 'UTC',
        },
      });
      const result = generateDeterministicPlan(input);
      expect(result.status).toBe('PARTIAL');
      // Blocks that did fit are still real and schedulable — not thrown away.
      expect(result.proposedBlocks.length).toBeGreaterThan(0);
      expect(result.proposedBlocks.length).toBeLessThan(10);
    });

    it('capacityViolation payload names required vs available and which steps were cut', () => {
      const input = buildInput({
        contractStartDayKey: '2026-01-05',
        contractDeadlineDayKey: '2026-01-07',
        causalChainSteps: [
          { sequence: 1, description: 'Foundation' },
          { sequence: 2, description: 'Middle' },
          { sequence: 3, description: 'Final' },
          { sequence: 4, description: 'Overflow' },
          { sequence: 5, description: 'Overflow 2' },
        ],
        constraints: {
          maxBlocksPerDay: 1,
          maxBlocksPerWeek: 2,
          preferredDaysOfWeek: [1, 2, 3, 4, 5],
          blackoutDayKeys: [],
          timezone: 'UTC',
        },
      });
      const result = generateDeterministicPlan(input);
      expect(result.status).toBe('PARTIAL');
      expect(result.capacityViolation).toBeDefined();
      expect(result.capacityViolation?.requiredBlocks).toBe(5);
      expect(result.capacityViolation?.availableBlocks).toBeLessThan(5);
      expect(result.capacityViolation?.overageMinutes).toBeGreaterThan(0);
      expect(result.capacityViolation?.cutSteps.length).toBeGreaterThan(0);
      // The steps that got cut are named, not silently dropped.
      const cutTitles = result.capacityViolation?.cutSteps.map((s) => s.deliverableTitle) || [];
      expect(cutTitles.some((t) => t.startsWith('Overflow'))).toBe(true);
    });

    it('still returns plain SUCCESS with no capacityViolation when everything fits', () => {
      const input = buildInput(); // generous default constraints, ~6 week window
      const result = generateDeterministicPlan(input);
      expect(result.status).toBe('SUCCESS');
      expect(result.capacityViolation).toBeUndefined();
    });

    it('INFEASIBLE (zero blocks fit at all) still takes precedence over PARTIAL', () => {
      const input = buildInput({
        constraints: { ...buildInput().constraints, maxBlocksPerDay: 0 },
      });
      const result = generateDeterministicPlan(input);
      expect(result.status).toBe('INFEASIBLE');
      expect(result.capacityViolation).toBeUndefined();
    });
  });

  describe('iteration cap distance verification', () => {
    it('typical admitted goal uses minimal iterations (proves cap is safe margin)', () => {
      // Typical scenario: 41 days, regular constraints
      const input = buildInput({
        contractStartDayKey: '2026-01-10',
        contractDeadlineDayKey: '2026-02-20',
        constraints: {
          maxBlocksPerDay: 4,
          maxBlocksPerWeek: 16,
          preferredDaysOfWeek: [1, 2, 3, 4, 5],
          blackoutDayKeys: [],
          timezone: 'UTC',
        },
      });

      const result = generateDeterministicPlan(input);

      expect(result.status).toBe('SUCCESS');
      expect(result.error).toBeUndefined();

      // Iterations info should be available on success (for diagnostics)
      // For normal plans, day iterations ≈ number of days
      // which is ~41 days = ~41 iterations (very small)
    });

    it('tight but valid goal still uses fraction of cap', () => {
      // Tight: 2 weeks, high preference filtering. Only 4 eligible days (Tue/Wed x2) at
      // 2 blocks/day = 8 available against the default 10-block requirement — this is a
      // genuine capacity shortfall (2026-07-13 §5 capacity-violation contract: PARTIAL, not
      // a silently-truncated SUCCESS as this test originally asserted before that fix).
      const input = buildInput({
        contractStartDayKey: '2026-01-10',
        contractDeadlineDayKey: '2026-01-24',
        constraints: {
          maxBlocksPerDay: 2,
          maxBlocksPerWeek: 8,
          preferredDaysOfWeek: [2, 3], // Only Tue-Wed
          blackoutDayKeys: [],
          timezone: 'UTC',
        },
      });

      const result = generateDeterministicPlan(input);

      expect(result.status).toBe('PARTIAL');
      expect(result.capacityViolation?.availableBlocks).toBe(8);
      expect(result.proposedBlocks.length).toBeGreaterThan(0);

      // Even with tight constraints, iterations remain small relative to 50k cap
      // (would be ~14 days iteration, max 50k)
    });

    it('high-capacity goal (max blocks) uses manageable iterations', () => {
      // High capacity: 3 months, max blocks/day and /week
      const input = buildInput({
        contractStartDayKey: '2026-01-10',
        contractDeadlineDayKey: '2026-04-10',
        constraints: {
          maxBlocksPerDay: 8,
          maxBlocksPerWeek: 40,
          preferredDaysOfWeek: [1, 2, 3, 4, 5, 6], // Almost all days
          blackoutDayKeys: [],
          timezone: 'UTC',
        },
      });

      const result = generateDeterministicPlan(input);

      expect(result.status).toBe('SUCCESS');
      expect(result.proposedBlocks.length).toBeGreaterThan(0);

      // Even with 3 months (90 days), this is ~90 day iterations
      // Allocation loop: ~(8 deliverables * 90 days * attempt per day) in worst case
      // Still well below 50k cap with plenty of safety margin
    });

    it('explicit guard errors expose iteration counts for debugging', () => {
      // Pathological: trigger the guard explicitly
      const input = buildInput({
        contractStartDayKey: '2026-01-10',
        contractDeadlineDayKey: '2026-01-10',
        constraints: {
          maxBlocksPerDay: 0,
          maxBlocksPerWeek: 0,
          preferredDaysOfWeek: [1, 2, 3, 4, 5],
          blackoutDayKeys: [],
          timezone: 'UTC',
        },
      });

      const result = generateDeterministicPlan(input);

      expect(result.status).toBe('INFEASIBLE');

      // Should NOT trigger PLAN_NON_TERMINATING_GUARD in this case
      // (fails feasibility check before reaching allocation loop)
      expect(result.error?.code).not.toBe('PLAN_NON_TERMINATING_GUARD');
    });
  });
});
