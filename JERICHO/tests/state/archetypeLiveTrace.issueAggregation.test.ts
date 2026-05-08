import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { archetypeLiveTraceInputs } from './archetypeLiveTrace.fixtures';

describe('archetypeLiveTrace issue aggregation', () => {
  it('reports stable issue frequency and pass/warn/fail distribution', () => {
    const { aggregate } = runArchetypeLiveTraceSuite(archetypeLiveTraceInputs);

    expect(aggregate.totalRuns).toBe(archetypeLiveTraceInputs.length);
    expect(aggregate.passCount + aggregate.warnCount + aggregate.failCount).toBe(aggregate.totalRuns);
    expect(aggregate.byArchetype.ProfessionalQualification).toBeDefined();
    expect(aggregate.byArchetype.VentureLaunch).toBeDefined();
    expect(aggregate.byArchetype['GenericStructured.TVWriting']).toBeDefined();
    expect(aggregate.byInputStyle.clean_explicit).toBeDefined();
    expect(aggregate.byInputStyle.compressed_informal).toBeDefined();
    expect(aggregate.byInputStyle.overloaded_multi_part).toBeDefined();
  });
});
