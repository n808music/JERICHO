import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { closureGroupLiveTraceInputs } from './archetypeLiveTrace.closureGroup.fixtures';

describe('archetypeLiveTrace closure group summary', () => {
  it('returns stable summaries for SalesPipeline and BrandLaunch live inputs', () => {
    const { summaries } = runArchetypeLiveTraceSuite(closureGroupLiveTraceInputs);
    expect(summaries.length).toBe(closureGroupLiveTraceInputs.length);
    summaries.forEach((summary) => {
      expect(['SalesPipeline', 'BrandLaunch']).toContain(summary.archetype);
      expect(summary.deliverableCount).toBeGreaterThan(0);
      expect(['pass', 'warn', 'fail']).toContain(summary.recommendation);
    });
  });
});
