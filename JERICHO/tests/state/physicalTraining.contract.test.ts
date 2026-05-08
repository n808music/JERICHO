import { describe, expect, it } from 'vitest';
import { compileGoalToDeliverables } from '../../src/state/engine/goalToDeliverables';
import { physicalTrainingActions } from './phaseC.archetype.fixtures';

describe('PhysicalTraining contract', () => {
  it('emits explicit deliverable/milestone typed outputs with completion semantics', () => {
    const result = compileGoalToDeliverables({
      executionType: 'PhysicalTraining',
      cycleId: 'cycle-pt',
      actions: physicalTrainingActions,
      contract: { goalText: 'Run a 5k in 8 weeks' },
    });

    expect(result.usesCanonicalDeliverablePath).toBe(true);
    expect(result.deliverables.length).toBeGreaterThan(0);
    expect(result.deliverables.some((entry) => entry.outputType === 'milestone')).toBe(true);

    result.deliverables.forEach((entry) => {
      expect(['deliverable', 'milestone']).toContain(entry.outputType);
      expect(entry.definitionOfDone.length).toBeGreaterThan(0);
      expect(entry.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(entry.title).not.toMatch(/planning\s*&\s*setup|core production|verification\s*&\s*finalization/i);
    });
  });
});
