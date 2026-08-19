import { describe, it, expect } from 'vitest';
import { expandFullHorizonSchedule } from './fullHorizonScheduleExpansion.js';

describe('fullHorizonScheduleExpansion - Constraint enforcement', () => {
  it('should enforce daily Constraint by duration sum and prevent time-based over-commit', () => {
    // Setup: 2 lanes, tight time-based Constraint (max 3 hours = 180 minutes per day)
    // Constraint is specified as maxBlocksPerDay, which is converted to minutes (* 60)
    // Block types vary in duration: 60/75/90 minutes depending on blockType

    const constraints = {
      maxBlocksPerDay: 3,    // CONSTRAINT: 3 hours = 180 minutes per day max
      maxBlocksPerWeek: 12,
    };

    const phaseModel = {
      phases: [
        {
          label: 'P1',
          startBoundary: '2026-01-01',
          endBoundary: '2026-01-31',
        },
      ],
    };

    const lanes = [
      {
        id: 'lane-1',
        domain: 'product',
        label: 'Product Development',
      },
      {
        id: 'lane-2',
        domain: 'operations',
        label: 'Operations',
      },
    ];

    const result = expandFullHorizonSchedule({
      plan: { id: 'test-plan' },
      phaseModel,
      horizonStartDayKey: '2026-01-01',
      horizonEndDayKey: '2026-01-31',
      lanes,
      existingForecastBlocks: [],
      committedBlocks: [],
      workDays: ['mon', 'wed', 'fri'], // 3 days per week
      workWindows: null,
      timeZone: 'UTC',
      constraints,
    });

    // Group blocks by day and sum their actual durations
    const blocksByDay = {};
    let totalMinutes = 0;
    for (const block of result) {
      const dayKey = String(block?.dayKey || block?.date || '').slice(0, 10);
      if (dayKey) {
        if (!blocksByDay[dayKey]) blocksByDay[dayKey] = { blocks: [], totalMinutes: 0 };
        blocksByDay[dayKey].blocks.push(block);
        blocksByDay[dayKey].totalMinutes += block?.durationMinutes || 60;
        totalMinutes += block?.durationMinutes || 60;
      }
    }

    // Detect violations: any day exceeding max duration (constraint * 60 minutes)
    const maxDailyMinutes = constraints.maxBlocksPerDay * 60;
    const overcommittedDays = Object.entries(blocksByDay)
      .filter(([_, day]) => day.totalMinutes > maxDailyMinutes)
      .map(([dayKey, day]) => ({
        dayKey,
        totalMinutes: day.totalMinutes,
        blockCount: day.blocks.length,
        maxMinutes: maxDailyMinutes,
      }));

    if (overcommittedDays.length === 0) {
      console.log('\n✓ VERIFIED: No daily duration overcommitment');
      console.log(`  Total blocks: ${result.length}`);
      console.log(`  Total scheduled minutes: ${totalMinutes}`);
      console.log(`  Max allowed per day: ${maxDailyMinutes} minutes (${constraints.maxBlocksPerDay} hours)`);
      console.log(`  Days with blocks: ${Object.keys(blocksByDay).length}`);
    } else {
      console.log('\n✗ FAILED: Days exceeding time constraint:');
      overcommittedDays.forEach(({ dayKey, totalMinutes, blockCount, maxMinutes }) => {
        console.log(`  ${dayKey}: ${totalMinutes}min across ${blockCount} blocks (max: ${maxMinutes}min)`);
      });
    }

    expect(overcommittedDays.length).toBe(0,
      'Daily duration constraint must be enforced: total minutes on any day must not exceed maxBlocksPerDay * 60');
  });

  it('should handle varying block durations correctly within daily time constraint', () => {
    // Verify that blocks with different durations (60/75/90 minutes) are correctly
    // summed against the constraint, not just counted

    const constraints = {
      maxBlocksPerDay: 4,    // 4 hours = 240 minutes per day max
      maxBlocksPerWeek: 16,
    };

    const phaseModel = {
      phases: [
        {
          label: 'P1',
          startBoundary: '2026-02-01',
          endBoundary: '2026-02-28',
        },
      ],
    };

    const lanes = [
      { id: 'lane-a', domain: 'product', label: 'Product' },
      { id: 'lane-b', domain: 'operations', label: 'Operations' },
    ];

    const result = expandFullHorizonSchedule({
      plan: { id: 'test-plan' },
      phaseModel,
      horizonStartDayKey: '2026-02-01',
      horizonEndDayKey: '2026-02-28',
      lanes,
      existingForecastBlocks: [],
      committedBlocks: [],
      workDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      workWindows: null,
      timeZone: 'UTC',
      constraints,
    });

    // Sum actual durations per day
    const blocksByDay = {};
    for (const block of result) {
      const dayKey = String(block?.dayKey || block?.date || '').slice(0, 10);
      if (dayKey) {
        if (!blocksByDay[dayKey]) blocksByDay[dayKey] = { blocks: [], totalMinutes: 0 };
        blocksByDay[dayKey].blocks.push(block);
        blocksByDay[dayKey].totalMinutes += block?.durationMinutes || 60;
      }
    }

    // Check for time-based violations
    const maxDailyMinutes = constraints.maxBlocksPerDay * 60;
    const violations = Object.entries(blocksByDay)
      .filter(([_, day]) => day.totalMinutes > maxDailyMinutes);

    if (violations.length === 0) {
      console.log('\n✓ PASS: No duration-based overcommitment detected');
      console.log(`  Total blocks: ${result.length}`);
      console.log(`  Max allowed: ${maxDailyMinutes}min/day (${constraints.maxBlocksPerDay}h)`);
    } else {
      console.log(`\n✗ FAIL: Found ${violations.length} days exceeding time constraint`);
      violations.slice(0, 3).forEach(([dayKey, day]) => {
        console.log(`  ${dayKey}: ${day.totalMinutes}min in ${day.blocks.length} blocks (max: ${maxDailyMinutes}min)`);
      });
    }

    expect(violations.length).toBe(0,
      'Daily time constraint must be enforced by duration sum, not block count');
  });
});
