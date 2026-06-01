import { describe, expect, it } from 'vitest';
import { compileGoalToDeliverables } from '../../src/state/engine/goalToDeliverables';
import { jobSearchPipelineActions } from './phaseC.archetype.fixtures';

const VAGUE_PATTERNS = [/search for jobs/i, /apply to jobs/i, /update resume$/i];

describe('JobSearchPipeline non-vague outputs', () => {
  it('keeps top-level outputs verifiable rather than vague effort labels', () => {
    const result = compileGoalToDeliverables({
      executionType: 'JobSearchPipeline',
      cycleId: 'cycle-job',
      actions: jobSearchPipelineActions,
      contract: { goalText: 'Need resume applications and interviews moving' },
    });

    const titles = result.deliverables.map((d) => d.title);
    VAGUE_PATTERNS.forEach((pattern) => {
      expect(titles.some((title) => pattern.test(title))).toBe(false);
    });
  });
});
