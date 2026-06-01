import { describe, expect, it } from 'vitest';
import {
  compileGoalToDeliverables,
  isCanonicalDeliverable,
  isScaffoldGroup,
} from '../../src/state/engine/goalToDeliverables.ts';

describe('goalToDeliverables scaffold discrimination', () => {
  it('keeps scaffold groups typed as scaffold and not deliverables', () => {
    const result = compileGoalToDeliverables({
      executionType: 'VentureLaunch',
      cycleId: 'cycle-v',
      contract: {},
      actions: [
        {
          id: 'validate:001',
          title: 'Run discovery interviews',
          deliverable: 'Interview findings report completed',
          definitionOfDone: 'Top pain points documented and ranked.',
          estimateMin: 80,
          dependencies: [],
        },
      ],
    });

    expect(result.scaffoldGroups.length).toBeGreaterThan(0);
    result.scaffoldGroups.forEach((group) => {
      expect(isScaffoldGroup(group)).toBe(true);
      expect(isCanonicalDeliverable(group)).toBe(false);
    });
  });
});
