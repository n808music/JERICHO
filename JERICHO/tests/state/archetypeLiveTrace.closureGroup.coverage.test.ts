import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { closureGroupLiveTraceInputs } from './archetypeLiveTrace.closureGroup.fixtures';

describe('archetypeLiveTrace closure group coverage', () => {
  it('preserves essential output coverage for closure group', () => {
    const { summaries } = runArchetypeLiveTraceSuite(closureGroupLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.coverage.hasCoreOutputCoverage).toBe(true);
      expect(summary.issues.filter((issue) => issue.code === 'MISSING_CORE_OUTPUT')).toHaveLength(0);
    });
  });
});
