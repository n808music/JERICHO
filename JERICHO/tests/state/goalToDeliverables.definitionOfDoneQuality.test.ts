import { describe, expect, it } from 'vitest';
import { compileGoalToDeliverables } from '../../src/state/engine/goalToDeliverables.ts';

describe('goalToDeliverables definition of done quality', () => {
  it('keeps definitionOfDone output-verifiable and non-empty', () => {
    const result = compileGoalToDeliverables({
      executionType: 'GenericStructured',
      cycleId: 'cycle-tv',
      contract: { goalText: 'Write first season of my TV show' },
      actions: [
        {
          id: 'tv:001',
          title: 'Write season outline',
          deliverable: 'Season outline completed',
          definitionOfDone: 'Season outline includes pilot-to-finale beats and turning points.',
          estimateMin: 90,
          dependencies: [],
        },
      ],
    });

    expect(result.deliverables.length).toBeGreaterThan(0);
    result.deliverables.forEach((deliverable) => {
      expect(deliverable.definitionOfDone.trim().length).toBeGreaterThan(10);
      expect(deliverable.definitionOfDone.toLowerCase()).not.toMatch(/work on|continue/);
    });
  });
});
