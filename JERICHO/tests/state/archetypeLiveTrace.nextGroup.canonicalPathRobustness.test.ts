import { describe, expect, it } from 'vitest';
import { runArchetypeLiveTraceSuite } from '../../src/state/engine/archetypeLiveTraceEvaluation';
import { nextGroupLiveTraceInputs } from './archetypeLiveTrace.nextGroup.fixtures';

describe('archetypeLiveTrace next group canonical path robustness', () => {
  it('stays on canonical path across live phrasing variants', () => {
    const { summaries } = runArchetypeLiveTraceSuite(nextGroupLiveTraceInputs);
    summaries.forEach((summary) => {
      expect(summary.usesCanonicalDeliverablePath).toBe(true);
      expect(summary.classificationMatchesIntended).toBe(true);
    });
  });
});
