import { describe, expect, it } from 'vitest';
import { runCompilerScorecardFullMatrix } from '../../src/state/contracts/compilerScorecardRunner';

describe('compiler scorecard full matrix runner', () => {
  it('executes all 45 lanes and emits lane-level + aggregate summaries', () => {
    const result = runCompilerScorecardFullMatrix();

    expect(result.goals).toHaveLength(45);
    expect(result.laneResults).toHaveLength(45);
    expect(result.aggregate.total).toBe(45);
    expect(Object.keys(result.aggregate.byLane)).toHaveLength(45);

    const aggregateSum = result.aggregate.pass + result.aggregate.warn + result.aggregate.fail;
    expect(aggregateSum).toBe(result.aggregate.total);

    result.laneResults.forEach((laneResult) => {
      expect(laneResult.laneId.length).toBeGreaterThan(0);
      expect(laneResult.archetype.length).toBeGreaterThan(0);
      expect(laneResult.subtype.length).toBeGreaterThan(0);
      expect(laneResult.goalText.length).toBeGreaterThan(0);
      expect(laneResult.overall).toMatch(/pass|warn|fail/);
    });
  });
});
