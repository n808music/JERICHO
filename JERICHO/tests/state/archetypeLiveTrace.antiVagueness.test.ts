import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { archetypeLiveTraceInputs } from './archetypeLiveTrace.fixtures';

describe('archetypeLiveTrace anti-vagueness', () => {
  it('does not collapse live inputs into vague deliverables', () => {
    const { summaries } = runArchetypeLiveTraceSuite(archetypeLiveTraceInputs);
    summaries.forEach((summary) => {
      const vagueIssues = summary.issues.filter((issue) => issue.code === 'VAGUE_TITLE');
      expect(vagueIssues).toHaveLength(0);
      expect(summary.coverage.hasConcreteOutputs).toBe(true);
    });
  });
});
