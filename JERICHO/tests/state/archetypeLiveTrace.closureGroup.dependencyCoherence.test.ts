import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { closureGroupLiveTraceInputs } from './archetypeLiveTrace.closureGroup.fixtures';

describe('archetypeLiveTrace closure group dependency coherence', () => {
  it('keeps dependency structure coherent under live phrasing', () => {
    const { summaries } = runArchetypeLiveTraceSuite(closureGroupLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.coverage.hasNonTrivialDependencies).toBe(true);
      expect(summary.issues.filter((issue) => issue.code === 'DEPENDENCY_FLATTENING')).toHaveLength(0);
    });
  });
});
