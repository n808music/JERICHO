import { describe, expect, it } from 'vitest';
import { compileGoalToDeliverables } from '../../src/state/engine/goalToDeliverables.ts';

describe('goalToDeliverables mixed migration safety', () => {
  it('uses canonical path for migrated archetypes and legacy fallback for remaining non-migrated archetypes', () => {
    const migrated = compileGoalToDeliverables({
      executionType: 'ProfessionalQualification',
      cycleId: 'cycle-a',
      contract: {},
      actions: [
        {
          id: 'study:1',
          title: 'Study',
          deliverable: 'Study packet completed',
          definitionOfDone: 'Packet complete and reviewed.',
          estimateMin: 60,
          dependencies: [],
        },
      ],
    });

    const legacy = compileGoalToDeliverables({
      executionType: 'GenericStructured',
      cycleId: 'cycle-b',
      contract: { goalText: 'Organize my workspace and routines this month' },
      actions: [
        {
          id: 'generic:1',
          title: 'Organize workspace',
          deliverable: 'Workspace organization completed',
          definitionOfDone: 'Workspace is organized and checklist is complete.',
          estimateMin: 60,
          dependencies: [],
        },
      ],
    });

    expect(migrated.usesCanonicalDeliverablePath).toBe(true);
    expect(migrated.legacyFallbackUsed).toBe(false);
    expect(legacy.usesCanonicalDeliverablePath).toBe(false);
    expect(legacy.legacyFallbackUsed).toBe(true);
  });
});
