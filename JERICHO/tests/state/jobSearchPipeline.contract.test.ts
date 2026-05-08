import { describe, expect, it } from 'vitest';
import { compileGoalToDeliverables } from '../../src/state/engine/goalToDeliverables';
import { jobSearchPipelineActions } from './phaseC.archetype.fixtures';

describe('JobSearchPipeline contract', () => {
  it('emits canonical output-based deliverables with completion semantics', () => {
    const result = compileGoalToDeliverables({
      executionType: 'JobSearchPipeline',
      cycleId: 'cycle-job',
      actions: jobSearchPipelineActions,
      contract: { goalText: 'Land a PM role in 60 days' },
    });

    expect(result.usesCanonicalDeliverablePath).toBe(true);
    expect(result.deliverables.length).toBeGreaterThan(0);

    result.deliverables.forEach((output) => {
      expect(output.outputType).toBe('deliverable');
      expect(output.definitionOfDone.length).toBeGreaterThan(0);
      expect(output.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(output.title).not.toMatch(/planning\s*&\s*setup|core production|verification\s*&\s*finalization/i);
    });
  });
});
