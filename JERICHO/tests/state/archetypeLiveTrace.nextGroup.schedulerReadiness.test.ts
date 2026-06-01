import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { nextGroupLiveTraceInputs } from './archetypeLiveTrace.nextGroup.fixtures';

describe('archetypeLiveTrace next group scheduler readiness', () => {
  it('remains scheduler compatible across next-group live traces', () => {
    const { summaries } = runArchetypeLiveTraceSuite(nextGroupLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.schedulerReadiness.schedulerCompatible).toBe(true);
      expect(summary.proposedBlockCompatible).toBe(true);
    });
  });
});
