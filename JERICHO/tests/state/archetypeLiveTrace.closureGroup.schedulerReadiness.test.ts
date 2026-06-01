import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { closureGroupLiveTraceInputs } from './archetypeLiveTrace.closureGroup.fixtures';

describe('archetypeLiveTrace closure group scheduler readiness', () => {
  it('remains scheduler compatible across closure group live traces', () => {
    const { summaries } = runArchetypeLiveTraceSuite(closureGroupLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.schedulerReadiness.schedulerCompatible).toBe(true);
      expect(summary.proposedBlockCompatible).toBe(true);
    });
  });
});
