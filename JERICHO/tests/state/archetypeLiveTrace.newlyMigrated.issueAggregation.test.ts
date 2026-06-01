import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { newlyMigratedLiveTraceInputs } from './archetypeLiveTrace.newlyMigrated.fixtures';

describe('archetypeLiveTrace newly migrated issue aggregation', () => {
  it('reports deterministic aggregate counts by archetype and input style', () => {
    const { aggregate } = runArchetypeLiveTraceSuite(newlyMigratedLiveTraceInputs);

    expect(aggregate.totalRuns).toBe(newlyMigratedLiveTraceInputs.length);
    expect(aggregate.passCount + aggregate.warnCount + aggregate.failCount).toBe(aggregate.totalRuns);
    expect(Object.keys(aggregate.byArchetype).sort()).toEqual(['CreativeProduction', 'Fundraising']);
    expect(Object.keys(aggregate.byInputStyle)).toHaveLength(5);
  });
});
