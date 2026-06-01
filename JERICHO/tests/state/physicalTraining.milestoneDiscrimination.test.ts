import { describe, expect, it } from 'vitest';
import {
  compileGoalToDeliverables,
  isCanonicalDeliverable,
  isScaffoldGroup,
} from '../../src/state/engine/goalToDeliverables';
import { physicalTrainingActions } from './phaseC.archetype.fixtures';

describe('PhysicalTraining milestone discrimination', () => {
  it('uses milestone typing for verifiable states and avoids vague milestone abuse', () => {
    const result = compileGoalToDeliverables({
      executionType: 'PhysicalTraining',
      cycleId: 'cycle-pt',
      actions: physicalTrainingActions,
      contract: { goalText: 'Get back to lifting after rehab' },
    });

    const milestones = result.deliverables.filter((entry) => entry.outputType === 'milestone');
    expect(milestones.length).toBeGreaterThan(0);
    milestones.forEach((entry) => {
      expect(entry.title).not.toMatch(/train more|keep training|workout more/i);
      expect(entry.definitionOfDone.length).toBeGreaterThan(0);
      expect(isCanonicalDeliverable(entry)).toBe(true);
    });

    result.scaffoldGroups.forEach((group) => {
      expect(isScaffoldGroup(group)).toBe(true);
      expect(group.type).toBe('phase');
    });
  });
});
