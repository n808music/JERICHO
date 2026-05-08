import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { closureGroupLiveTraceInputs } from './archetypeLiveTrace.closureGroup.fixtures';

describe('archetypeLiveTrace closure group anti-phase regression', () => {
  it('does not regress to phase labels as top-level outputs', () => {
    const { summaries } = runArchetypeLiveTraceSuite(closureGroupLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.issues.filter((issue) => issue.code === 'PHASE_LABEL_AS_DELIVERABLE')).toHaveLength(0);
    });
  });
});
