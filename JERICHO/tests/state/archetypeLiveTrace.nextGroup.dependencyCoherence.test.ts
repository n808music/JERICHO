import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { nextGroupLiveTraceInputs } from './archetypeLiveTrace.nextGroup.fixtures';

describe('archetypeLiveTrace next group dependency coherence', () => {
  it('keeps dependency structure coherent under live phrasing', () => {
    const { summaries } = runArchetypeLiveTraceSuite(nextGroupLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.coverage.hasNonTrivialDependencies).toBe(true);
      expect(summary.issues.filter((issue) => issue.code === 'DEPENDENCY_FLATTENING')).toHaveLength(0);
    });
  });
});
