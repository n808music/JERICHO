import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { archetypeLiveTraceInputs } from './archetypeLiveTrace.fixtures';

describe('archetypeLiveTrace dependency coherence', () => {
  it('preserves dependency coherence under live phrasing variability', () => {
    const { summaries } = runArchetypeLiveTraceSuite(archetypeLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.coverage.hasNonTrivialDependencies).toBe(true);
      expect(summary.issues.filter((issue) => issue.code === 'DEPENDENCY_FLATTENING')).toHaveLength(0);
    });
  });
});
