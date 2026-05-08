import { describe, expect, it } from 'vitest';
import { compileAutoAsanaPlan } from '../../src/state/engine/autoAsanaPlan.ts';

describe('autoAsana cycle window clamp', () => {
  it('never emits blocks before cycle start or after cycle end', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-window',
      cycleId: 'cycle-window',
      nowISO: '2026-03-01T10:00:00.000Z',
      horizonDays: 5,
      planProof: {
        workableDaysRemaining: 5,
        totalRequiredUnits: 5,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 14,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        maxBlocksPerDay: 2,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 11 * 60 }],
        cycleStartDayKey: '2026-03-03',
        cycleEndDayKey: '2026-03-04',
        dayEndAtHHMM: '23:59',
      },
    });

    expect(plan.horizonBlocks.every((block) => block.dayKey >= '2026-03-03' && block.dayKey <= '2026-03-04')).toBe(
      true
    );
    expect(plan.conflicts.some((conflict: any) => conflict.code === 'FILTERED_OUT_OF_RANGE')).toBe(true);
  });

  it('emits deterministic unschedulable signal when clamp filters all placements', () => {
    const plan = compileAutoAsanaPlan({
      goalId: 'goal-window-2',
      cycleId: 'cycle-window-2',
      nowISO: '2026-03-01T10:00:00.000Z',
      horizonDays: 2,
      planProof: {
        workableDaysRemaining: 2,
        totalRequiredUnits: 2,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 14,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        maxBlocksPerDay: 2,
        workingHoursWindows: [{ startMin: 9 * 60, endMin: 10 * 60 }],
        cycleStartDayKey: '2026-03-01',
        cycleEndDayKey: '2026-03-01',
        dayEndAtHHMM: '09:30',
      },
    });

    expect(plan.horizonBlocks.length).toBe(0);
    expect(plan.conflicts.some((conflict: any) => conflict.code === 'FILTERED_OUT_OF_RANGE')).toBe(true);
    expect(plan.conflicts.some((conflict: any) => conflict.code === 'UNSCHEDULABLE')).toBe(true);
  });
});
