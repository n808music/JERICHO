import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { nextGroupLiveTraceInputs } from './archetypeLiveTrace.nextGroup.fixtures';

describe('archetypeLiveTrace next group issue aggregation', () => {
  it('returns stable aggregate distribution for next migration group', () => {
    const { aggregate } = runArchetypeLiveTraceSuite(nextGroupLiveTraceInputs);

    expect(aggregate.totalRuns).toBe(nextGroupLiveTraceInputs.length);
    expect(aggregate.passCount + aggregate.warnCount + aggregate.failCount).toBe(aggregate.totalRuns);
    expect(aggregate.byArchetype.JobSearchPipeline).toBeDefined();
    expect(aggregate.byArchetype.PhysicalTraining).toBeDefined();
    expect(aggregate.byInputStyle.clean_explicit).toBeDefined();
    expect(aggregate.byInputStyle.overloaded_multi_part).toBeDefined();
  });
});
