import { describe, expect, it } from 'vitest';
import { compileAutoAsanaPlan } from '../../src/state/engine/autoAsanaPlan.ts';
import { evaluatePlanQualityGate } from '../../src/domain/planQuality/evaluatePlanQualityGate';

const ACTIONABLE_PREFIX = /^(Run|Draft|Create|Build|Produce|Package|Validate|Record|Submit|Review|Finalize|Prepare|Map|Test|Document|Define|Evaluate|Secure|Select|Configure|Outline|Write|Confirm|Assess|Stress-test|Verify)\b/i;

function runGate(blocks) {
  return evaluatePlanQualityGate({
    goalText: 'Launch caffeine gum MVP with a real buyer-ready offer and proof path',
    verificationText: 'Buyer-ready gum offer published with supplier and checkout readiness evidence',
    proposedBlocks: blocks,
    committedBlocks: [],
  });
}

describe('autoAsanaPlan action title fidelity', () => {
  it('uses action sequence titles instead of generic placeholders when actions are available', () => {
    const result = compileAutoAsanaPlan({
      goalId: 'goal-1',
      cycleId: 'cycle-1',
      nowISO: '2026-03-02T12:00:00.000Z',
      horizonDays: 2,
      planProof: {
        workableDaysRemaining: 2,
        totalRequiredUnits: 2,
        requiredPacePerDay: 1,
        maxPerDay: 1,
        maxPerWeek: 7,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
      },
      actionSequence: [
        { id: 'a-1', title: 'Conduct customer interview', estimateMin: 60, dependencies: [] },
        { id: 'a-2', title: 'Write hypothesis draft', estimateMin: 45, dependencies: ['a-1'] },
      ],
      acceptedBlocks: [],
    });

    expect(Array.isArray(result.horizonBlocks)).toBe(true);
    expect(result.horizonBlocks.length).toBeGreaterThan(0);
    expect(result.horizonBlocks[0].title).not.toBe('Auto Asana Execution');
    expect(result.horizonBlocks[0].title).toMatch(ACTIONABLE_PREFIX);
    expect(result.horizonBlocks[0].actionId).toBe('a-1');
  });

  it('preserves dependency order when sequencing action titles', () => {
    const result = compileAutoAsanaPlan({
      goalId: 'goal-2',
      cycleId: 'cycle-2',
      nowISO: '2026-03-02T12:00:00.000Z',
      horizonDays: 3,
      planProof: {
        workableDaysRemaining: 3,
        totalRequiredUnits: 3,
        requiredPacePerDay: 1,
        maxPerDay: 3,
        maxPerWeek: 7,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
      },
      actionSequence: [
        { id: 'a-1', title: 'Draft outline', estimateMin: 60, dependencies: [] },
        { id: 'a-2', title: 'Record episode 1', estimateMin: 60, dependencies: ['a-1'] },
        { id: 'a-3', title: 'Edit episode 1', estimateMin: 60, dependencies: ['a-2'] },
      ],
      acceptedBlocks: [],
    });

    expect(result.horizonBlocks.map((block) => block.title)).toEqual([
      'Draft outline',
      'Record episode 1',
      'Edit episode 1',
    ]);
  });

  it('repairs gum-path shell titles into actionable execution titles before placement', () => {
    const result = compileAutoAsanaPlan({
      goalId: 'goal-gum-1',
      cycleId: 'cycle-gum-1',
      nowISO: '2026-03-02T12:00:00.000Z',
      horizonDays: 3,
      planProof: {
        workableDaysRemaining: 3,
        totalRequiredUnits: 2,
        requiredPacePerDay: 1,
        maxPerDay: 2,
        maxPerWeek: 7,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
      },
      actionSequence: [
        {
          id: 'gum-a1',
          title: 'Gum formula packaging readiness',
          deliverable: 'Supplier outreach list for gum sample sourcing with contact order and sample ask',
          definitionOfDone: 'Supplier outreach list completed with contact order, sample ask, and qualification notes',
          estimateMin: 60,
          dependencies: [],
          deliverableId: 'gum-d1',
          deliverableTitle: 'Supplier outreach list for gum sample sourcing',
          sessionTitles: ['Gum formula packaging readiness'],
        },
      ],
      acceptedBlocks: [],
    });

    const firstExecutionBlock = result.horizonBlocks.find((block) => block.blockType !== 'waiting_period');
    expect(firstExecutionBlock).toBeTruthy();
    expect(firstExecutionBlock.title).toMatch(ACTIONABLE_PREFIX);
    expect(firstExecutionBlock.title.trim().split(/\s+/).length).toBeGreaterThanOrEqual(3);

    const gate = runGate(result.horizonBlocks);
    expect(gate.failureCodes).not.toContain('NON_ACTIONABLE_BLOCK_TITLE');
  });

  it('does not force waiting-period titles through execution title normalization', () => {
    const result = compileAutoAsanaPlan({
      goalId: 'goal-gum-2',
      cycleId: 'cycle-gum-2',
      nowISO: '2026-03-02T12:00:00.000Z',
      horizonDays: 2,
      planProof: {
        workableDaysRemaining: 2,
        totalRequiredUnits: 1,
        requiredPacePerDay: 1,
        maxPerDay: 1,
        maxPerWeek: 7,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
      },
      actionSequence: [
        {
          id: 'gum-wait-1',
          title: 'Manufacturer response wait',
          deliverable: 'Manufacturer response and quote packet',
          definitionOfDone: 'Manufacturer response received with quote and timing details',
          estimateMin: 60,
          dependencies: [],
          deliverableId: 'gum-wait-d1',
          deliverableTitle: 'Manufacturer response wait',
          blockType: 'waiting_period',
        },
      ],
      sessionPlan: [
        {
          date: '2026-03-03',
          startTime: '09:00',
          durationMinutes: 60,
          actionId: 'gum-wait-1',
          deliverableId: 'gum-wait-d1',
          title: 'Manufacturer response wait',
        },
      ],
      acceptedBlocks: [],
    });

    expect(result.horizonBlocks[0].blockType).toBe('waiting_period');
    expect(result.horizonBlocks[0].title).toBe('Manufacturer response wait');
  });

  it('rewrites live-parity commercial helper verbs into gate-approved execution titles', () => {
    const result = compileAutoAsanaPlan({
      goalId: 'goal-gum-3',
      cycleId: 'cycle-gum-3',
      nowISO: '2026-03-02T12:00:00.000Z',
      horizonDays: 6,
      planProof: {
        workableDaysRemaining: 6,
        totalRequiredUnits: 4,
        requiredPacePerDay: 1,
        maxPerDay: 4,
        maxPerWeek: 7,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          WED: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
      },
      actionSequence: [
        {
          id: 'gum-live-1',
          title: 'Request packaging quote and dieline requirements from supplier A',
          deliverable: 'Packaging quote comparison sheet for supplier A and B',
          definitionOfDone: 'Quote and dieline requirements captured for supplier comparison',
          estimateMin: 60,
          dependencies: [],
          deliverableId: 'gum-live-d1',
          deliverableTitle: 'Packaging quote comparison sheet',
          sessionTitles: ['Request packaging quote and dieline requirements from supplier A'],
        },
        {
          id: 'gum-live-2',
          title: 'List caffeine dosage, flavor, texture, and compliance assumptions for the gum formula',
          deliverable: 'Formula assumptions brief with dosage, flavor, texture, and compliance notes',
          definitionOfDone: 'Formula assumptions brief documented for supplier and compliance review',
          estimateMin: 60,
          dependencies: ['gum-live-1'],
          deliverableId: 'gum-live-d2',
          deliverableTitle: 'Formula assumptions brief',
          sessionTitles: ['List caffeine dosage, flavor, texture, and compliance assumptions for the gum formula'],
        },
        {
          id: 'gum-live-3',
          title: 'Check sample stability and handling assumptions before first paid-order claims',
          deliverable: 'Sample stability note with handling and claims-risk checks',
          definitionOfDone: 'Sample stability note reviewed for handling and claims risk before launch',
          estimateMin: 60,
          dependencies: ['gum-live-2'],
          deliverableId: 'gum-live-d3',
          deliverableTitle: 'Sample stability note',
          sessionTitles: ['Check sample stability and handling assumptions before first paid-order claims'],
        },
        {
          id: 'gum-live-4',
          title: 'Retest product page CTA from benefit claim through order-capture path',
          deliverable: 'CTA retest note for benefit claim and order capture path',
          definitionOfDone: 'CTA retest note recorded with buyer path issues and fixes',
          estimateMin: 60,
          dependencies: ['gum-live-3'],
          deliverableId: 'gum-live-d4',
          deliverableTitle: 'CTA retest note',
          sessionTitles: ['Retest product page CTA from benefit claim through order-capture path'],
        },
      ],
      acceptedBlocks: [],
    });

    const titles = result.horizonBlocks.filter((block) => block.blockType !== 'waiting_period').map((block) => block.title);

    expect(titles).toContain('Secure packaging quote and dieline requirements from supplier A');
    expect(titles).toContain('Document caffeine dosage, flavor, texture, and compliance assumptions for the gum formula');
    expect(titles).toContain('Validate sample stability and handling assumptions before first paid-order claims');
    expect(titles).toContain('Test product page CTA from benefit claim through order-capture path');

    const gate = runGate(result.horizonBlocks);
    expect(gate.failureCodes).not.toContain('NON_ACTIONABLE_BLOCK_TITLE');
  });

  it('rewrites commercial session-plan titles before placement', () => {
    const result = compileAutoAsanaPlan({
      goalId: 'goal-gum-4',
      cycleId: 'cycle-gum-4',
      nowISO: '2026-03-02T12:00:00.000Z',
      horizonDays: 4,
      planProof: {
        workableDaysRemaining: 4,
        totalRequiredUnits: 4,
        requiredPacePerDay: 1,
        maxPerDay: 4,
        maxPerWeek: 7,
        slackUnits: 0,
        slackRatio: 0,
        intensityRatio: 1,
      },
      constraints: {
        timezone: 'UTC',
        weeklyWindows: {
          MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          WED: [{ startHHMM: '09:00', endHHMM: '12:00' }],
          THU: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        },
      },
      actionSequence: [
        {
          id: 'gum-plan-1',
          title: 'Request packaging quote and dieline requirements from supplier A',
          deliverable: 'Packaging quote comparison sheet for supplier A and B',
          definitionOfDone: 'Quote and dieline requirements captured for supplier comparison',
          estimateMin: 60,
          dependencies: [],
          deliverableId: 'gum-plan-d1',
          deliverableTitle: 'Packaging quote comparison sheet',
        },
      ],
      sessionPlan: [
        {
          date: '2026-03-03',
          startTime: '09:00',
          durationMinutes: 60,
          actionId: 'gum-plan-1',
          deliverableId: 'gum-plan-d1',
          title: 'Request packaging quote and dieline requirements from supplier A',
        },
      ],
      acceptedBlocks: [],
    });

    expect(result.horizonBlocks[0].title).toBe('Secure packaging quote and dieline requirements from supplier A');

    const gate = runGate(result.horizonBlocks);
    expect(gate.failureCodes).not.toContain('NON_ACTIONABLE_BLOCK_TITLE');
  });
});
