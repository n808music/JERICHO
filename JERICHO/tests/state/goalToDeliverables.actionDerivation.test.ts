import { describe, expect, it } from 'vitest';
import { compileGoalToDeliverables } from '../../src/state/engine/goalToDeliverables.ts';

describe('goalToDeliverables action derivation', () => {
  it('derives action seeds linked to compiled deliverables', () => {
    const result = compileGoalToDeliverables({
      executionType: 'VentureLaunch',
      cycleId: 'cycle-vl',
      actions: [
        {
          id: 'validate:001',
          title: 'Interview users',
          deliverable: 'Interview synthesis report completed',
          definitionOfDone: 'Synthesis report includes top three insights.',
          actionType: 'preparation',
          estimateMin: 75,
          dependencies: [],
          assumption: 'Recruitment list is available',
        },
        {
          id: 'build:001',
          title: 'Deploy landing page',
          deliverable: 'Landing page deployed with signup capture',
          definitionOfDone: 'Live URL available with working form submit.',
          actionType: 'execution',
          estimateMin: 120,
          dependencies: ['validate:001'],
          readinessCondition: 'Copy approved',
        },
      ],
      contract: {},
    });

    expect(result.actionSeeds.length).toBe(2);
    expect(result.actionSeeds.every((seed) => seed.deliverableId.length > 0)).toBe(true);
    expect(result.actionSeeds[1].dependencyIds).toContain('validate:001');
    expect(result.actionSeeds[0].actionType).toBe('preparation');
    expect(result.actionSeeds[0].assumptions).toEqual(['Recruitment list is available']);
    expect(result.actionSeeds[1].actionType).toBe('execution');
    expect(result.actionSeeds[1].readinessConditions).toEqual(['Copy approved']);
  });

  it('preserves concrete session titles on action seeds', () => {
    const result = compileGoalToDeliverables({
      executionType: 'BrandLaunch',
      cycleId: 'cycle-gum-sessions',
      actions: [
        {
          id: 'gum:001',
          title: 'Resolve gum product readiness',
          deliverable: 'Gum formula, sample approval, packaging, sourcing, and sellable unit readiness complete',
          definitionOfDone: 'Sellable gum unit readiness is complete.',
          actionType: 'execution',
          estimateMin: 180,
          sessionTitles: [
            'Shortlist viable stimulant dosage and gum base formulation options',
            'Compare manufacturer MOQ, lead time, certifications, and sample cost',
          ],
        },
      ],
      contract: {},
    });

    expect(result.actionSeeds[0].sessionTitles).toEqual([
      'Shortlist viable stimulant dosage and gum base formulation options',
      'Compare manufacturer MOQ, lead time, certifications, and sample cost',
    ]);
  });

  it('cleans execution-completed sentence pollution from compiled deliverable titles', () => {
    const result = compileGoalToDeliverables({
      executionType: 'BrandLaunch',
      cycleId: 'cycle-gum',
      actions: [
        {
          id: 'gum:001',
          title: 'Complete final gum readiness output',
          deliverable:
            'Finalize execution completed. Build a caffeinated gum formula, sample approval, packaging, sourcing, and sellable unit readiness',
          definitionOfDone: 'Formula, sample approval, packaging, sourcing, and sellable unit readiness are complete.',
          actionType: 'execution',
          estimateMin: 180,
          dependencies: [],
        },
        {
          id: 'gum:002',
          title: 'Complete commercial setup output',
          deliverable:
            'Set execution completed. Build a caffeinated gum offer, pricing, product page, checkout, ordering, and fulfillment path',
          definitionOfDone: 'Offer, pricing, checkout, ordering, and fulfillment path are complete.',
          actionType: 'execution',
          estimateMin: 180,
          dependencies: ['gum:001'],
        },
      ],
      contract: {},
    });

    expect(result.deliverables.map((deliverable) => deliverable.title)).toEqual([
      'Finalize caffeinated gum formula, sample approval, packaging, sourcing, and sellable unit readiness',
      'Set caffeinated gum offer, pricing, product page, checkout, ordering, and fulfillment path',
    ]);
  });
});
