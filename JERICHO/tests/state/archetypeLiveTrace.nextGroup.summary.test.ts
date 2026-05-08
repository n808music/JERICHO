import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { nextGroupLiveTraceInputs } from './archetypeLiveTrace.nextGroup.fixtures';

describe('archetypeLiveTrace next group summary', () => {
  it('returns stable summaries for JobSearchPipeline and PhysicalTraining live inputs', () => {
    const { summaries } = runArchetypeLiveTraceSuite(nextGroupLiveTraceInputs);
    expect(summaries.length).toBe(nextGroupLiveTraceInputs.length);
    summaries.forEach((summary) => {
      expect(['JobSearchPipeline', 'PhysicalTraining']).toContain(summary.archetype);
      expect(summary.deliverableCount).toBeGreaterThan(0);
      expect(['pass', 'warn', 'fail']).toContain(summary.recommendation);
    });
  });
});
