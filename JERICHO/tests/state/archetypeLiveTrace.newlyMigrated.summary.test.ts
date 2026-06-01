import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { newlyMigratedLiveTraceInputs } from './archetypeLiveTrace.newlyMigrated.fixtures';

describe('archetypeLiveTrace newly migrated summary', () => {
  it('returns stable summaries for Fundraising and non-TV CreativeProduction inputs', () => {
    const { summaries, aggregate } = runArchetypeLiveTraceSuite(newlyMigratedLiveTraceInputs);

    expect(summaries.length).toBe(newlyMigratedLiveTraceInputs.length);
    summaries.forEach((summary) => {
      expect(['Fundraising', 'CreativeProduction']).toContain(summary.archetype);
      expect(summary.deliverableCount).toBeGreaterThan(0);
      expect(summary.actionSeedCount).toBeGreaterThan(0);
      expect(['pass', 'warn', 'fail']).toContain(summary.recommendation);
    });

    expect(aggregate.totalRuns).toBe(newlyMigratedLiveTraceInputs.length);
  });
});
