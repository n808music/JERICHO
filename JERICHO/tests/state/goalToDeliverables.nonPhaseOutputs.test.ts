import { describe, expect, it } from 'vitest';
import { compileGoalToDeliverables } from '../../src/state/engine/goalToDeliverables.ts';

const FORBIDDEN_PHASE_LABELS = ['Planning & setup', 'Core production', 'Verification & finalization'];

describe('goalToDeliverables non-phase outputs', () => {
  it('does not emit phase labels as deliverables for migrated archetypes', () => {
    const result = compileGoalToDeliverables({
      executionType: 'ProfessionalQualification',
      cycleId: 'cycle-exam',
      contract: {},
      actions: [
        {
          id: 'study:001',
          title: 'Study domain one',
          deliverable: 'Domain 1 notes packet completed',
          definitionOfDone: 'Notes packet is complete and self-quiz passed.',
          estimateMin: 90,
          dependencies: [],
        },
      ],
    });

    const deliverableTitles = result.deliverables.map((entry) => entry.title);
    FORBIDDEN_PHASE_LABELS.forEach((phaseLabel) => {
      expect(deliverableTitles).not.toContain(phaseLabel);
    });
  });
});
