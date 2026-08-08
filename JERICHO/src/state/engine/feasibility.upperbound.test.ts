import { describe, it, expect } from 'vitest';
import { computeFeasibility } from './feasibility';

describe('feasibility.ts - upper-bound Demand estimation', () => {
  it('should use upper-bound duration per execution type to make pessimistic feasibility judgments', () => {
    // Setup: BrandLaunch execution type with upper bound of 720 minutes per block
    // 5 remaining blocks * 720 min = 3600 minutes Demand
    // Constraint: maxBlocksPerDay: 1 (= 1 block per day)
    // Deadline: 3 days away
    // Available capacity: 3 days * 1 block * 720 min = 2160 min
    // Demand 3600 > Capacity 2160 → INSUFFICIENT_CAPACITY

    const now = '2026-02-01T00:00:00Z';
    const deadline = '2026-02-04T00:00:00Z'; // 3 days from now

    const state = {
      goalWorkById: {
        'goal-1': [
          { workItemId: 'w1', blocksRemaining: 5 },
        ],
      },
      appTime: { nowISO: now, timeZone: 'UTC' },
    };

    const constraints = {
      timezone: 'UTC',
      maxBlocksPerDay: 1, // 1 block per day (constraint is in block counts)
    };

    const result = computeFeasibility(
      {
        goalId: 'goal-1',
        deadlineISO: deadline,
        executionType: 'BrandLaunch', // Upper bound: 720 min/block
      },
      state,
      constraints,
      now
    );

    console.log('\n=== Upper-Bound Demand Estimation Test ===');
    console.log(`Execution Type: BrandLaunch (upper bound: 720 min/block)`);
    console.log(`Remaining Blocks: 5`);
    console.log(`Demand (5 blocks × 720 min): ${5 * 720} minutes`);
    console.log(`Daily Capacity: 1 block × 720 min = 720 minutes`);
    console.log(`Days Available: 3`);
    console.log(`Total Capacity: 3 × 720 = 2160 minutes`);
    console.log(`Demand > Capacity? 3600 > 2160? YES → INSUFFICIENT_CAPACITY`);
    console.log(`\nResult Status: ${result.status}`);
    console.log(`Reasons: ${result.reasons.join(', ')}`);

    // With upper-bound estimation, capacity check triggers INSUFFICIENT_CAPACITY
    expect(result.reasons).toContain('INSUFFICIENT_CAPACITY');
    console.log(`✓ INSUFFICIENT_CAPACITY detected via upper-bound Demand (3600 min > 2160 min)`);
  });

  it('should apply execution-type-specific upper bounds correctly', () => {
    // Setup: SkillAcquisition (upper bound: 120 min) with same scenario
    // 5 blocks * 120 min = 600 minutes = 10 hours
    // 10 days * 4 hours = 40 hours available
    // 10 < 40 → FEASIBLE

    const now = '2026-02-01T00:00:00Z';
    const deadline = '2026-02-11T00:00:00Z';

    const state = {
      goalWorkById: {
        'goal-2': [
          { workItemId: 'w1', blocksRemaining: 5 },
        ],
      },
      appTime: { nowISO: now, timeZone: 'UTC' },
    };

    const constraints = {
      timezone: 'UTC',
      maxBlocksPerDay: 4, // 4 hours per day
    };

    const result = computeFeasibility(
      {
        goalId: 'goal-2',
        deadlineISO: deadline,
        executionType: 'SkillAcquisition', // Upper bound: 120 min
      },
      state,
      constraints,
      now
    );

    console.log('\n=== Different Execution Type (SkillAcquisition) ===');
    console.log(`Execution Type: SkillAcquisition (upper bound: 120 min/block)`);
    console.log(`Demand (5 blocks × 120 min): ${5 * 120} minutes = 10 hours`);
    console.log(`Total Capacity: 40 hours`);
    console.log(`Demand > Capacity? 600 > 2400? NO → FEASIBLE`);
    console.log(`\nResult Status: ${result.status}`);

    // With SkillAcquisition's upper bound (120), capacity is sufficient
    expect(result.reasons).not.toContain('INSUFFICIENT_CAPACITY');
    console.log(`✓ SkillAcquisition upper-bound (120 min/block) allows feasible plan`);
  });

  it('should use GenericStructured (120 min) as default when execution type is missing', () => {
    const now = '2026-02-01T00:00:00Z';
    const deadline = '2026-02-11T00:00:00Z';

    const state = {
      goalWorkById: {
        'goal-3': [
          { workItemId: 'w1', blocksRemaining: 8 },
        ],
      },
      appTime: { nowISO: now, timeZone: 'UTC' },
    };

    const constraints = {
      timezone: 'UTC',
      maxBlocksPerDay: 4,
    };

    const result = computeFeasibility(
      {
        goalId: 'goal-3',
        deadlineISO: deadline,
        executionType: null, // Missing — should default to GenericStructured (120 min)
      },
      state,
      constraints,
      now
    );

    console.log('\n=== Default to GenericStructured ===');
    console.log(`Execution Type: null (defaults to GenericStructured, 120 min/block)`);
    console.log(`Demand: 8 × 120 = 960 minutes = 16 hours`);
    console.log(`Capacity: 40 hours`);
    console.log(`Result: ${result.status} - Reasons: ${result.reasons.join(', ')}`);

    // GenericStructured default (120 min/block) provides sufficient capacity
    expect(result.reasons).not.toContain('INSUFFICIENT_CAPACITY');
    console.log(`✓ GenericStructured default (120 min/block) allows plan`);
  });
});
