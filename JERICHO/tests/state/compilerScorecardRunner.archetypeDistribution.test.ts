import { describe, expect, it } from 'vitest';
import { runCompilerScorecardFullMatrix } from '../../src/state/contracts/compilerScorecardRunner';

describe('compiler scorecard archetype distribution', () => {
  it('executes exactly 5 lanes per archetype and reconciles totals', () => {
    const result = runCompilerScorecardFullMatrix();
    const archetypes = Object.keys(result.aggregate.byArchetype);
    expect(archetypes).toHaveLength(9);

    let reconciledTotal = 0;
    archetypes.forEach((archetype) => {
      const counts = result.aggregate.byArchetype[archetype];
      const perArchetypeTotal = counts.pass + counts.warn + counts.fail;
      expect(perArchetypeTotal).toBe(5);
      reconciledTotal += perArchetypeTotal;
    });

    expect(reconciledTotal).toBe(result.aggregate.total);
  });
});
