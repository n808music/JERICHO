import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { closureGroupLiveTraceInputs } from './archetypeLiveTrace.closureGroup.fixtures';

describe('archetypeLiveTrace closure group issue aggregation', () => {
  it('returns stable aggregate distribution for closure group', () => {
    const { aggregate } = runArchetypeLiveTraceSuite(closureGroupLiveTraceInputs);

    expect(aggregate.totalRuns).toBe(closureGroupLiveTraceInputs.length);
    expect(aggregate.passCount + aggregate.warnCount + aggregate.failCount).toBe(aggregate.totalRuns);
    expect(aggregate.byArchetype.SalesPipeline).toBeDefined();
    expect(aggregate.byArchetype.BrandLaunch).toBeDefined();
    expect(aggregate.byInputStyle.clean_explicit).toBeDefined();
    expect(aggregate.byInputStyle.overloaded_multi_part).toBeDefined();
  });
});
