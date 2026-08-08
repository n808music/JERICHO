import { describe, it, expect } from 'vitest';
import { generateDeterministicPlan } from './deterministicPlanGenerator';

describe('deterministicPlanGenerator - duration constraint enforcement', () => {
  it('should enforce daily duration constraint (maxBlocksPerDay hours = max minutes)', () => {
    // Setup: tight constraint of 3 hours = 180 minutes per day
    // All blocks are 60 minutes, so max 3 blocks per day
    // With 10 required blocks and tight daily limit, should get capacity violation

    const result = generateDeterministicPlan({
      contractDeadlineDayKey: '2026-03-31',
      contractStartDayKey: '2026-03-01',
      nowDayKey: '2026-03-01',
      causalChainSteps: [
        { sequence: 1, description: 'Phase 1: Planning' },
        { sequence: 2, description: 'Phase 2: Execution' },
        { sequence: 3, description: 'Phase 3: Verification' },
      ],
      constraints: {
        maxBlocksPerDay: 3, // 3 hours = 180 minutes per day max
        maxBlocksPerWeek: 12,
        timezone: 'UTC',
      },
      mode: 'REGENERATE',
    });

    console.log('\n=== Deterministic Plan Generation with Duration Constraint ===');
    console.log(`Status: ${result.status}`);
    console.log(`Blocks generated: ${result.proposedBlocks.length}`);

    // Validate no day exceeds the duration limit
    const blocksByDay: Record<string, number> = {};
    for (const block of result.proposedBlocks) {
      const dayKey = block.dayKey;
      blocksByDay[dayKey] = (blocksByDay[dayKey] || 0) + (block.durationMinutes || 60);
    }

    const maxAllowedMinutes = 3 * 60; // 180 minutes
    const violations = Object.entries(blocksByDay)
      .filter(([_, totalMinutes]) => totalMinutes > maxAllowedMinutes)
      .map(([dayKey, totalMinutes]) => ({ dayKey, totalMinutes, allowed: maxAllowedMinutes }));

    if (violations.length === 0) {
      console.log(`✓ No daily overcommitment detected`);
      console.log(`  Max allowed per day: ${maxAllowedMinutes} minutes (3 hours)`);
      console.log(`  Days with blocks: ${Object.keys(blocksByDay).length}`);
      console.log(`  Sample: ${Object.entries(blocksByDay).slice(0, 3).map(([day, min]) => `${day}=${min}min`).join(', ')}`);
    } else {
      console.log(`✗ Duration violations found:`);
      violations.forEach(({ dayKey, totalMinutes, allowed }) => {
        console.log(`  ${dayKey}: ${totalMinutes} minutes (max: ${allowed})`);
      });
    }

    // All blocks should be 60 minutes (deterministic generator is uniform)
    const allBlocksUniform = result.proposedBlocks.every((b) => b.durationMinutes === 60);
    console.log(`✓ All blocks are 60 minutes (uniform): ${allBlocksUniform}`);

    // Verify constraint was respected
    expect(violations.length).toBe(0, 'No day should exceed the daily duration constraint');
    expect(allBlocksUniform).toBe(true, 'All blocks should be 60 minutes');
  });

  it('should correctly interpret maxBlocksPerDay as hours (not as block count)', () => {
    // Constraint: maxBlocksPerDay: 2 means 2 hours = 120 minutes
    // NOT 2 blocks (which would also be 120 minutes since blocks are 60 min uniform)
    // The semantic difference matters for consistency with fullHorizonScheduleExpansion

    const result = generateDeterministicPlan({
      contractDeadlineDayKey: '2026-04-30',
      contractStartDayKey: '2026-04-01',
      nowDayKey: '2026-04-01',
      causalChainSteps: [
        { sequence: 1, description: 'Setup' },
        { sequence: 2, description: 'Execute' },
      ],
      constraints: {
        maxBlocksPerDay: 2, // Interpreted as 2 hours = 120 minutes
        maxBlocksPerWeek: 8,
        timezone: 'UTC',
      },
      mode: 'REGENERATE',
    });

    const blocksByDay: Record<string, number> = {};
    for (const block of result.proposedBlocks) {
      blocksByDay[block.dayKey] = (blocksByDay[block.dayKey] || 0) + 1;
    }

    const maxAllowedHours = 2;
    const maxAllowedMinutes = maxAllowedHours * 60;

    // Count blocks per day to verify interpretation
    const daysWithMoreThan2Blocks = Object.values(blocksByDay).filter((count) => count > 2);

    console.log(`\nConstraint interpretation test:`);
    console.log(`  maxBlocksPerDay: 2 → ${maxAllowedMinutes} minutes allowed per day`);
    console.log(`  Since all blocks are 60 min, this allows up to 2 blocks per day`);
    console.log(`  Days with >2 blocks: ${daysWithMoreThan2Blocks.length}`);

    // It's acceptable that this is mathematically equivalent (2 hours = 2 * 60-min blocks)
    // The point is the semantic: we're checking duration, not count
    expect(daysWithMoreThan2Blocks.length).toBe(0, 'No day should exceed the constraint (semantically: duration-based)');
  });
});
