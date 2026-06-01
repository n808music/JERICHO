import { describe, expect, it } from 'vitest';
import { compileGoalToDeliverables, summarizeDeliverableSet } from '../../src/state/engine/goalToDeliverables.ts';

describe('goalToDeliverables summary helper', () => {
  it('returns deterministic diagnostic payload for migrated archetype', () => {
    const result = compileGoalToDeliverables({
      executionType: 'VentureLaunch',
      cycleId: 'cycle-summary',
      contract: {},
      actions: [
        {
          id: 'validate:001',
          title: 'Interview users',
          deliverable: 'Interview synthesis report completed',
          definitionOfDone: 'Top findings documented and ranked.',
          estimateMin: 75,
          dependencies: [],
        },
      ],
    });

    const summary = summarizeDeliverableSet(result);
    expect(summary.archetype).toBe('VentureLaunch');
    expect(summary.usesCanonicalDeliverablePath).toBe(true);
    expect(summary.deliverableCount).toBe(1);
    expect(summary.scaffoldGroupCount).toBeGreaterThanOrEqual(1);
    expect(summary.actionSeedCount).toBe(1);
    expect(summary.legacyFallbackUsed).toBe(false);
    expect(Array.isArray(summary.invalidDeliverables)).toBe(true);
  });
});
