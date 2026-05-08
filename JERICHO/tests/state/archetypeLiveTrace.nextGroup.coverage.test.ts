import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { nextGroupLiveTraceInputs } from './archetypeLiveTrace.nextGroup.fixtures';

describe('archetypeLiveTrace next group coverage', () => {
  it('preserves essential output coverage for next migration group', () => {
    const { summaries } = runArchetypeLiveTraceSuite(nextGroupLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.coverage.hasCoreOutputCoverage).toBe(true);
      expect(summary.issues.filter((issue) => issue.code === 'MISSING_CORE_OUTPUT')).toHaveLength(0);
    });
  });
});
