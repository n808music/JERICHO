import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { nextGroupLiveTraceInputs } from './archetypeLiveTrace.nextGroup.fixtures';

describe('archetypeLiveTrace next group anti-phase regression', () => {
  it('does not regress to phase labels as top-level outputs', () => {
    const { summaries } = runArchetypeLiveTraceSuite(nextGroupLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.issues.filter((issue) => issue.code === 'PHASE_LABEL_AS_DELIVERABLE')).toHaveLength(0);
    });
  });
});
