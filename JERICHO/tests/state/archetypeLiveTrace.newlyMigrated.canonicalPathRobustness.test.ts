import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { newlyMigratedLiveTraceInputs } from './archetypeLiveTrace.newlyMigrated.fixtures';

describe('archetypeLiveTrace newly migrated canonical path robustness', () => {
  it('stays on canonical path across live phrasing variants', () => {
    const { summaries } = runArchetypeLiveTraceSuite(newlyMigratedLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.usesCanonicalDeliverablePath).toBe(true);
      expect(summary.classificationMatchesIntended).toBe(true);
      expect(summary.proposedBlockCompatible).toBe(true);
    });
  });
});
