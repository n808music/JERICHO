import { describe, expect, it } from 'vitest';
import { compileGoalToDeliverables } from '../../src/state/engine/goalToDeliverables.ts';

function sampleActions(archetype: 'ProfessionalQualification' | 'VentureLaunch' | 'GenericStructured') {
  if (archetype === 'ProfessionalQualification') {
    return [
      {
        id: 'study:001',
        title: 'Study domain one',
        deliverable: 'Domain 1 notes completed',
        definitionOfDone: 'Notes and flashcards completed for domain one.',
        estimateMin: 120,
        dependencies: [],
      },
      {
        id: 'practice:001',
        title: 'Complete first practice exam',
        deliverable: 'First full practice exam completed with score report',
        definitionOfDone: 'Practice exam done under timed conditions and score recorded.',
        estimateMin: 120,
        dependencies: ['study:001'],
      },
    ];
  }
  if (archetype === 'VentureLaunch') {
    return [
      {
        id: 'validate:001',
        title: 'Run customer interviews',
        deliverable: 'Interview synthesis doc with top pain points',
        definitionOfDone: 'Five interviews completed and synthesized into one doc.',
        estimateMin: 90,
        dependencies: [],
      },
      {
        id: 'launch:001',
        title: 'Publish launch page',
        deliverable: 'Launch landing page deployed with waitlist form',
        definitionOfDone: 'Page is live and waitlist form is validated.',
        estimateMin: 120,
        dependencies: ['validate:001'],
      },
    ];
  }
  return [
    {
      id: 'tv:001',
      title: 'Write season premise',
      deliverable: 'Season premise and story outline completed',
      definitionOfDone: 'One-page premise and story arc outline completed.',
      estimateMin: 60,
      dependencies: [],
    },
    {
      id: 'tv:002',
      title: 'Draft pilot episode',
      deliverable: 'Pilot episode first draft completed',
      definitionOfDone: 'Pilot script reaches complete first draft form.',
      estimateMin: 120,
      dependencies: ['tv:001'],
    },
  ];
}

describe('goalToDeliverables contract', () => {
  it.each([['ProfessionalQualification' as const], ['VentureLaunch' as const], ['GenericStructured' as const]])(
    'emits canonical deliverables for %s',
    (executionType) => {
      const result = compileGoalToDeliverables({
        executionType,
        actions: sampleActions(executionType),
        contract: { goalText: executionType === 'GenericStructured' ? 'Write first season of TV show' : '' },
        cycleId: `cycle-${executionType}`,
      });

      expect(result.usesCanonicalDeliverablePath).toBe(true);
      expect(result.deliverables.length).toBeGreaterThan(0);

      result.deliverables.forEach((deliverable) => {
        expect(deliverable.title.length).toBeGreaterThan(0);
        expect(deliverable.definitionOfDone.length).toBeGreaterThan(0);
        expect(deliverable.acceptanceCriteria.length).toBeGreaterThan(0);
        expect(deliverable.estimatedSessions).toBeGreaterThan(0);
        expect(deliverable.estimatedMinutes).toBeGreaterThan(0);
        expect(['not_started', 'in_progress', 'blocked', 'complete', 'at_risk']).toContain(deliverable.status);
      });
    }
  );
});
