import { describe, expect, it } from 'vitest';
import { runCompilerScorecardFullMatrix } from '../../src/state/contracts/compilerScorecardRunner';

describe('compiler scorecard dimension coverage', () => {
  it('includes all dimensions for each lane and exposes weakest-dimension summary', () => {
    const result = runCompilerScorecardFullMatrix();

    result.laneResults.forEach((laneResult) => {
      const dimensions = laneResult.scorecard;
      expect(dimensions.outputQuality).toMatch(/pass|warn|fail/);
      expect(dimensions.actionQuality).toMatch(/pass|warn|fail/);
      expect(dimensions.scheduleQuality).toMatch(/pass|warn|fail/);
      expect(dimensions.correctionQuality).toMatch(/pass|warn|fail/);
      expect(dimensions.progressTrackingQuality).toMatch(/pass|warn|fail/);
    });

    const weakest = result.aggregate.weakestDimensions;
    expect(weakest).toBeTruthy();
    expect(Array.isArray(weakest.outputQuality)).toBe(true);
    expect(Array.isArray(weakest.actionQuality)).toBe(true);
    expect(Array.isArray(weakest.scheduleQuality)).toBe(true);
    expect(Array.isArray(weakest.correctionQuality)).toBe(true);
    expect(Array.isArray(weakest.progressTrackingQuality)).toBe(true);
  });
});
