import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { archetypeLiveTraceInputs } from './archetypeLiveTrace.fixtures';

describe('archetypeLiveTrace coverage', () => {
  it('keeps core output coverage across phrasing variants', () => {
    const { summaries } = runArchetypeLiveTraceSuite(archetypeLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.coverage.hasCoreOutputCoverage).toBe(true);
      expect(summary.issues.filter((issue) => issue.code === 'MISSING_CORE_OUTPUT')).toHaveLength(0);
    });
  });
});
