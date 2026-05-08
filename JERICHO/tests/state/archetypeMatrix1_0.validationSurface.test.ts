import { describe, expect, it } from 'vitest';
import {
  buildExecutionSpecLaneRows,
  summarizeExecutionSpecSurface,
  validateExecutionSpecLaneRows,
} from '../../src/state/contracts/archetypeMatrixValidation';

describe('archetype matrix 1.0 validation surface', () => {
  it('builds a full lane-level validation surface for 9x5 matrix', () => {
    const rows = buildExecutionSpecLaneRows();
    expect(rows).toHaveLength(45);

    const summary = summarizeExecutionSpecSurface(rows);
    expect(summary.archetypeCount).toBe(9);
    expect(summary.laneCount).toBe(45);
    Object.values(summary.byArchetype).forEach((laneCount) => {
      expect(laneCount).toBe(5);
    });
  });

  it('passes baseline execution-spec rules for the canonical matrix', () => {
    const rows = buildExecutionSpecLaneRows();
    const issues = validateExecutionSpecLaneRows(rows);
    expect(issues).toEqual([]);
  });
});
