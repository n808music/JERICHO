import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { archetypeLiveTraceInputs } from './archetypeLiveTrace.fixtures';

describe('archetypeLiveTrace canonical path robustness', () => {
  it('keeps migrated archetypes on canonical deliverable path across live inputs', () => {
    const { summaries } = runArchetypeLiveTraceSuite(archetypeLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.usesCanonicalDeliverablePath).toBe(true);
      expect(summary.deliverableCount).toBeGreaterThan(0);
    });
  });
});
