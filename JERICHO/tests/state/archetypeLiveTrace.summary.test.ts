import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { archetypeLiveTraceInputs } from './archetypeLiveTrace.fixtures';

describe('archetypeLiveTrace summary', () => {
  it('returns stable summaries for all migrated archetypes and input styles', () => {
    const { summaries, aggregate } = runArchetypeLiveTraceSuite(archetypeLiveTraceInputs);

    expect(summaries.length).toBe(archetypeLiveTraceInputs.length);
    summaries.forEach((summary) => {
      expect(summary.archetype.length).toBeGreaterThan(0);
      expect(summary.inputLabel.length).toBeGreaterThan(0);
      expect(typeof summary.usesCanonicalDeliverablePath).toBe('boolean');
      expect(typeof summary.deliverableCount).toBe('number');
      expect(Array.isArray(summary.issues)).toBe(true);
      expect(['pass', 'warn', 'fail']).toContain(summary.recommendation);
    });

    expect(aggregate.totalRuns).toBe(archetypeLiveTraceInputs.length);
  });
});
