import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { archetypeLiveTraceInputs } from './archetypeLiveTrace.fixtures';

describe('archetypeLiveTrace anti-phase regression', () => {
  it('does not regress to phase labels as top-level deliverables under live inputs', () => {
    const { summaries } = runArchetypeLiveTraceSuite(archetypeLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.issues.filter((issue) => issue.code === 'PHASE_LABEL_AS_DELIVERABLE')).toHaveLength(0);
    });
  });
});
