import { describe, expect, it } from 'vitest';
import { ARCHETYPE_MATRIX_1_0 } from '../../src/state/contracts/archetypeMatrix1_0';
import {
  REPRESENTATIVE_GOALS_1_0,
  normalizeLaneKey,
  validateRepresentativeGoalMatrix,
} from '../../src/state/contracts/archetypeRepresentativeGoals1_0';

describe('archetype representative goals 1.0 contract', () => {
  it('covers all 45 canonical lanes exactly once', () => {
    const validation = validateRepresentativeGoalMatrix(REPRESENTATIVE_GOALS_1_0);
    expect(validation.totalFixtures).toBe(45);
    expect(validation.duplicates).toEqual([]);
    expect(validation.unknown).toEqual([]);
    expect(validation.missing).toEqual([]);
  });

  it('keeps 9 archetypes with 5 lanes each and non-empty representative goals', () => {
    const byArchetype: Record<string, number> = {};
    const seen = new Set<string>();

    REPRESENTATIVE_GOALS_1_0.forEach((fixture) => {
      const key = normalizeLaneKey(fixture.archetype, fixture.subtype);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      byArchetype[fixture.archetype] = (byArchetype[fixture.archetype] ?? 0) + 1;
      expect(fixture.representativeGoal.trim().length).toBeGreaterThan(0);
    });

    expect(Object.keys(byArchetype)).toHaveLength(9);
    Object.values(byArchetype).forEach((count) => {
      expect(count).toBe(5);
    });

    const matrixKeys = new Set(
      ARCHETYPE_MATRIX_1_0.flatMap((archetype) =>
        archetype.lanes.map((lane) => normalizeLaneKey(archetype.archetype, lane.subtype))
      )
    );
    seen.forEach((key) => {
      expect(matrixKeys.has(key)).toBe(true);
    });
  });
});
