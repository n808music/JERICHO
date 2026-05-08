import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { closureGroupLiveTraceInputs } from './archetypeLiveTrace.closureGroup.fixtures';

describe('archetypeLiveTrace closure group canonical path robustness', () => {
  it('stays on canonical path across live phrasing variants', () => {
    const { summaries } = runArchetypeLiveTraceSuite(closureGroupLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.usesCanonicalDeliverablePath).toBe(true);
      expect(summary.classificationMatchesIntended).toBe(true);
    });
  });
});
