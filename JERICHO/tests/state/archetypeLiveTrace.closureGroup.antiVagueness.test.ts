import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { closureGroupLiveTraceInputs } from './archetypeLiveTrace.closureGroup.fixtures';

describe('archetypeLiveTrace closure group anti-vagueness', () => {
  it('does not degrade to vague outputs under live phrasing', () => {
    const { summaries } = runArchetypeLiveTraceSuite(closureGroupLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.issues.filter((issue) => issue.code === 'VAGUE_TITLE')).toHaveLength(0);
    });
  });
});
