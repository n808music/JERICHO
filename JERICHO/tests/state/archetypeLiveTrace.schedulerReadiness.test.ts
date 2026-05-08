import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { archetypeLiveTraceInputs } from './archetypeLiveTrace.fixtures';

describe('archetypeLiveTrace scheduler readiness', () => {
  it('remains scheduler-compatible across live traces', () => {
    const { summaries } = runArchetypeLiveTraceSuite(archetypeLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.proposedBlockCompatible).toBe(true);
      expect(summary.schedulerReadiness.schedulerCompatible).toBe(true);
    });
  });
});
