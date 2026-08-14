import { describe, it, expect } from 'vitest';
import { generateDeterministicPlan } from '../deterministicPlanGenerator';

describe('deterministicPlanGenerator — per-project target dates (2026-08-13)', () => {
  it('respects phase ordering as hard constraint even when target dates prefer different order', () => {
    // Project A (phase 1): target 2026-04-15
    // Project B (phase 2): target 2026-04-01 (earlier, but comes after A due to phase)
    const result = generateDeterministicPlan({
      contractStartDayKey: '2026-04-01',
      contractDeadlineDayKey: '2026-04-30',
      nowDayKey: '2026-04-01',
      causalChainSteps: [
        { sequence: 1, description: 'Project A (Phase 1)', projectId: 'p1', targetDate: '2026-04-15' },
        { sequence: 2, description: 'Project B (Phase 2)', projectId: 'p2', targetDate: '2026-04-01' },
      ],
      constraints: {
        maxBlocksPerDay: 4,
        maxBlocksPerWeek: 16,
        timezone: 'UTC',
      },
      mode: 'REGENERATE',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.proposedBlocks.length).toBe(2);

    // Project A's block should come before Project B's block (phase ordering is hard)
    const blockA = result.proposedBlocks.find((b) => b.deliverableId.includes('causal-1'));
    const blockB = result.proposedBlocks.find((b) => b.deliverableId.includes('causal-2'));
    expect(blockA).toBeDefined();
    expect(blockB).toBeDefined();
    expect(blockA!.dayKey <= blockB!.dayKey).toBe(true);
  });

  it('places project blocks near their target dates when feasible', () => {
    const result = generateDeterministicPlan({
      contractStartDayKey: '2026-04-01',
      contractDeadlineDayKey: '2026-04-30',
      nowDayKey: '2026-04-01',
      causalChainSteps: [
        { sequence: 1, description: 'Project A', projectId: 'p1', targetDate: '2026-04-20' },
      ],
      constraints: {
        maxBlocksPerDay: 4,
        maxBlocksPerWeek: 16,
        timezone: 'UTC',
      },
      mode: 'REGENERATE',
    });

    expect(result.status).toBe('SUCCESS');
    const block = result.proposedBlocks[0];
    // Block should be placed on or near the target date
    expect(block.dayKey).toBe('2026-04-20');
  });

  it('flags target date conflicts when target date is outside contract window', () => {
    const result = generateDeterministicPlan({
      contractStartDayKey: '2026-04-01',
      contractDeadlineDayKey: '2026-04-30',
      nowDayKey: '2026-04-01',
      causalChainSteps: [
        { sequence: 1, description: 'Project A', projectId: 'p1', targetDate: '2026-05-15' }, // After deadline
      ],
      constraints: {
        maxBlocksPerDay: 4,
        maxBlocksPerWeek: 16,
        timezone: 'UTC',
      },
      mode: 'REGENERATE',
    });

    expect(result.status).toBe('SUCCESS'); // Still schedulable, just with conflict flag
    expect(result.targetDateConflicts).toBeDefined();
    expect(result.targetDateConflicts!.length).toBeGreaterThan(0);
    const conflict = result.targetDateConflicts![0];
    expect(conflict.reason).toBe('OUTSIDE_CONTRACT_WINDOW');
    expect(conflict.targetDate).toBe('2026-05-15');
    expect(conflict.placedOnDate).toBe(''); // Will be filled at allocation
  });

  it('flags capacity cluster conflicts when multiple projects compete for same dates', () => {
    // Three projects, all want to be placed on 2026-04-15
    // With maxBlocksPerDay=1, only one can fit on that date
    const result = generateDeterministicPlan({
      contractStartDayKey: '2026-04-01',
      contractDeadlineDayKey: '2026-04-30',
      nowDayKey: '2026-04-01',
      causalChainSteps: [
        { sequence: 1, description: 'Project A', projectId: 'p1', targetDate: '2026-04-15' },
        { sequence: 2, description: 'Project B', projectId: 'p2', targetDate: '2026-04-15' },
        { sequence: 3, description: 'Project C', projectId: 'p3', targetDate: '2026-04-15' },
      ],
      constraints: {
        maxBlocksPerDay: 1, // Tight constraint to force conflicts
        maxBlocksPerWeek: 16,
        timezone: 'UTC',
      },
      mode: 'REGENERATE',
    });

    expect(result.status).toBe('SUCCESS');
    // At least one project should be placed on the target date, others conflict
    expect(result.targetDateConflicts).toBeDefined();
    const placed = result.proposedBlocks.filter((b) => b.dayKey === '2026-04-15');
    expect(placed.length).toBeGreaterThanOrEqual(1);
  });

  it('handles null target dates (no target date set)', () => {
    const result = generateDeterministicPlan({
      contractStartDayKey: '2026-04-01',
      contractDeadlineDayKey: '2026-04-30',
      nowDayKey: '2026-04-01',
      causalChainSteps: [
        { sequence: 1, description: 'Project A', projectId: 'p1', targetDate: null },
        { sequence: 2, description: 'Project B', projectId: 'p2', targetDate: '2026-04-20' },
      ],
      constraints: {
        maxBlocksPerDay: 4,
        maxBlocksPerWeek: 16,
        timezone: 'UTC',
      },
      mode: 'REGENERATE',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.proposedBlocks.length).toBe(2);
    // Project A (no target) should be placed earliest-first
    const blockA = result.proposedBlocks.find((b) => b.deliverableId.includes('causal-1'));
    const blockB = result.proposedBlocks.find((b) => b.deliverableId.includes('causal-2'));
    expect(blockA!.dayKey <= blockB!.dayKey).toBe(true);
  });

  it('preserves SUCCESS status when target dates are all met', () => {
    const result = generateDeterministicPlan({
      contractStartDayKey: '2026-04-01',
      contractDeadlineDayKey: '2026-04-30',
      nowDayKey: '2026-04-01',
      causalChainSteps: [
        { sequence: 1, description: 'Project A', projectId: 'p1', targetDate: '2026-04-10' },
        { sequence: 2, description: 'Project B', projectId: 'p2', targetDate: '2026-04-20' },
      ],
      constraints: {
        maxBlocksPerDay: 4,
        maxBlocksPerWeek: 16,
        timezone: 'UTC',
      },
      mode: 'REGENERATE',
    });

    expect(result.status).toBe('SUCCESS');
    // No conflicts should be flagged
    expect(result.targetDateConflicts).toBeUndefined();
  });

  it('carries targetDate through AutoDeliverable objects', () => {
    const result = generateDeterministicPlan({
      contractStartDayKey: '2026-04-01',
      contractDeadlineDayKey: '2026-04-30',
      nowDayKey: '2026-04-01',
      causalChainSteps: [
        { sequence: 1, description: 'Project A', projectId: 'p1', targetDate: '2026-04-15' },
      ],
      constraints: {
        maxBlocksPerDay: 4,
        maxBlocksPerWeek: 16,
        timezone: 'UTC',
      },
      mode: 'REGENERATE',
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.autoDeliverables.length).toBe(1);
    const deliv = result.autoDeliverables[0];
    expect(deliv.targetDate).toBe('2026-04-15');
  });
});
