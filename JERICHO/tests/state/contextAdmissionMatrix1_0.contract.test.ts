import { describe, expect, it } from 'vitest';
import { ARCHETYPE_MATRIX_1_0 } from '../../src/state/contracts/archetypeMatrix1_0';
import {
  listAllLaneContextSpecs,
  listLaneAuthoredQuestionCoverage,
} from '../../src/state/contracts/contextAdmissionMatrix1_0';

describe('context admission matrix 1.0 contract', () => {
  it('covers all 45 canonical lanes with 3 required and up to 2 optional questions', () => {
    const specs = listAllLaneContextSpecs();
    expect(specs).toHaveLength(45);

    const keySet = new Set<string>();
    specs.forEach((spec) => {
      const key = `${spec.archetype}::${spec.subtype}`;
      expect(keySet.has(key)).toBe(false);
      keySet.add(key);

      expect(spec.requiredQuestions).toHaveLength(3);
      expect(spec.optionalQuestions.length).toBeLessThanOrEqual(2);
      expect(spec.defaultAssumptions.length).toBeGreaterThan(0);
      expect(spec.planImpactFields.length).toBeGreaterThan(0);
    });

    const canonicalKeys = new Set(
      ARCHETYPE_MATRIX_1_0.flatMap((archetype) =>
        archetype.lanes.map((lane) => `${archetype.archetype}::${lane.subtype}`)
      )
    );
    keySet.forEach((key) => {
      expect(canonicalKeys.has(key)).toBe(true);
    });
  });

  it('has fully lane-authored question text coverage for all 45 canonical lanes', () => {
    const coverage = listLaneAuthoredQuestionCoverage();
    expect(coverage.canonicalLaneCount).toBe(45);
    expect(coverage.authoredLaneCount).toBe(45);
    expect(coverage.missingAuthored).toEqual([]);
  });
});
