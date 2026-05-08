import { describe, expect, it } from 'vitest';
import { compileGoalToDeliverables } from '../../src/state/engine/goalToDeliverables.ts';

describe('goalToDeliverables session estimate', () => {
  it('computes deterministic estimated sessions from action minutes', () => {
    const result = compileGoalToDeliverables({
      executionType: 'ProfessionalQualification',
      cycleId: 'cycle-exam',
      actions: [
        {
          id: 'study:001',
          title: 'Study domain one',
          deliverable: 'Domain one notes completed',
          definitionOfDone: 'Domain one notes complete and reviewed.',
          estimateMin: 130,
          dependencies: [],
        },
      ],
      contract: {},
    });

    expect(result.deliverables).toHaveLength(1);
    expect(result.deliverables[0].estimatedMinutes).toBe(130);
    expect(result.deliverables[0].estimatedSessions).toBe(3);
    expect(result.estimatedSessionCount).toBe(3);
  });
});
