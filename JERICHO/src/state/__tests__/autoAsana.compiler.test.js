import { describe, it, expect } from 'vitest';
import { compileAutoAsanaPlan } from '../engine/autoAsanaPlan.ts';

const NOW_ISO = '2026-01-08T12:00:00.000Z';

describe('autoAsana compiler', () => {
  it('compiles deterministically with horizon-only blocks', () => {
    const planProof = {
      workableDaysRemaining: 20,
      totalRequiredUnits: 10,
      requiredPacePerDay: 1,
      maxPerDay: 3,
      maxPerWeek: 15,
      slackUnits: 50,
      slackRatio: 0.5,
      intensityRatio: 0.2
    };
    const constraints = { timezone: 'UTC', maxBlocksPerDay: 3, maxBlocksPerWeek: 15 };
    const planA = compileAutoAsanaPlan({
      goalId: 'goal-1',
      cycleId: 'cycle-1',
      planProof,
      constraints,
      nowISO: NOW_ISO,
      horizonDays: 7
    });
    const planB = compileAutoAsanaPlan({
      goalId: 'goal-1',
      cycleId: 'cycle-1',
      planProof,
      constraints,
      nowISO: NOW_ISO,
      horizonDays: 7
    });
    expect(planA.horizonBlocks).toEqual(planB.horizonBlocks);
    expect(planA.horizon.daysCount).toBe(7);
    expect(planA.horizonBlocks.length).toBeGreaterThan(0);
  });
});
