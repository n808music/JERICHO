import { describe, expect, it } from 'vitest';
import { compileAutoAsanaPlan } from '../../src/state/engine/autoAsanaPlan.ts';

describe('autoAsanaPlan action title fidelity', () => {
  it('uses action sequence titles instead of generic placeholders when actions are available', () => {
    const result = compileAutoAsanaPlan({
      goalId: 'goal-1',
      cycleId: 'cycle-1',
      nowISO: '2026-03-02T12:00:00.000Z',
      horizonDays: 2,
      planProof: {
        workableDaysRemaining: 2,
        totalRequiredUnits: 2,
        requiredPacePerDay: 1,
        maxPerDay: 1,
        maxPerWeek: 7,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
      },
      actionSequence: [
        { id: 'a-1', title: 'Conduct customer interview', estimateMin: 60, dependencies: [] },
        { id: 'a-2', title: 'Write hypothesis draft', estimateMin: 45, dependencies: ['a-1'] },
      ],
      acceptedBlocks: [],
    });

    expect(Array.isArray(result.horizonBlocks)).toBe(true);
    expect(result.horizonBlocks.length).toBeGreaterThan(0);
    expect(result.horizonBlocks[0].title).toBe('Conduct customer interview');
    expect(result.horizonBlocks[0].actionId).toBe('a-1');
  });

  it('preserves dependency order when sequencing action titles', () => {
    const result = compileAutoAsanaPlan({
      goalId: 'goal-2',
      cycleId: 'cycle-2',
      nowISO: '2026-03-02T12:00:00.000Z',
      horizonDays: 3,
      planProof: {
        workableDaysRemaining: 3,
        totalRequiredUnits: 3,
        requiredPacePerDay: 1,
        maxPerDay: 3,
        maxPerWeek: 7,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
      },
      actionSequence: [
        { id: 'a-1', title: 'Draft outline', estimateMin: 60, dependencies: [] },
        { id: 'a-2', title: 'Record episode 1', estimateMin: 60, dependencies: ['a-1'] },
        { id: 'a-3', title: 'Edit episode 1', estimateMin: 60, dependencies: ['a-2'] },
      ],
      acceptedBlocks: [],
    });

    expect(result.horizonBlocks.map((block) => block.title)).toEqual([
      'Draft outline',
      'Record episode 1',
      'Edit episode 1',
    ]);
  });
});
