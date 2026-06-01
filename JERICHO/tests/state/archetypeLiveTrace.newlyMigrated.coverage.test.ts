import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { newlyMigratedLiveTraceInputs } from './archetypeLiveTrace.newlyMigrated.fixtures';

describe('archetypeLiveTrace newly migrated coverage', () => {
  it('preserves essential output coverage without missing-core-output regressions', () => {
    const { summaries } = runArchetypeLiveTraceSuite(newlyMigratedLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.coverage.hasCoreOutputCoverage).toBe(true);
      expect(summary.issues.filter((issue) => issue.code === 'MISSING_CORE_OUTPUT')).toHaveLength(0);
    });
  });
});
