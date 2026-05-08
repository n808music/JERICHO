import { describe, expect, it } from 'vitest';
import { ARCHETYPE_MATRIX_1_0, getArchetypeLaneCount } from '../../src/state/contracts/archetypeMatrix1_0';

describe('archetype matrix 1.0 contract', () => {
  it('locks Divine 9 archetypes and 45 subtype lanes', () => {
    expect(ARCHETYPE_MATRIX_1_0).toHaveLength(9);
    expect(getArchetypeLaneCount()).toBe(45);
    ARCHETYPE_MATRIX_1_0.forEach((archetype) => {
      expect(archetype.lanes).toHaveLength(5);
    });
  });

  it('ensures each lane has execution grammar fields', () => {
    ARCHETYPE_MATRIX_1_0.forEach((archetype) => {
      archetype.lanes.forEach((lane) => {
        expect(lane.grammar.typicalDeliverables.length).toBeGreaterThan(0);
        expect(lane.grammar.dependencyPattern.length).toBeGreaterThan(0);
        expect(lane.grammar.actionClasses.length).toBeGreaterThan(0);
        expect(lane.grammar.schedulePattern.length).toBeGreaterThan(0);
        expect(lane.grammar.correctionPattern.length).toBeGreaterThan(0);
      });
    });
  });
});
