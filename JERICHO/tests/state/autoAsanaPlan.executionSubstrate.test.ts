import { describe, expect, it } from 'vitest';

import { compileAutoAsanaPlan } from '../../src/state/engine/autoAsanaPlan.ts';

function baseArgs(overrides: Record<string, unknown> = {}) {
  return {
    goalId: 'goal-substrate-1',
    cycleId: 'cycle-substrate-1',
    nowISO: '2026-03-09T12:00:00.000Z',
    horizonDays: 10,
    planProof: {
      workableDaysRemaining: 10,
      totalRequiredUnits: 3,
      requiredPacePerDay: 1,
      maxPerDay: 2,
      maxPerWeek: 10,
      slackUnits: 0,
      slackRatio: 0,
      intensityRatio: 1,
    },
    constraints: {
      timezone: 'UTC',
      maxBlocksPerDay: 2,
      maxBlocksPerWeek: 10,
      weeklyWindows: {
        MON: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        TUE: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        WED: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        THU: [{ startHHMM: '09:00', endHHMM: '12:00' }],
        FRI: [{ startHHMM: '09:00', endHHMM: '12:00' }],
      },
      cycleStartDayKey: '2026-03-09',
      cycleEndDayKey: '2026-03-31',
    },
    acceptedBlocks: [],
    actionSequence: [],
    sessionPlan: [],
    ...overrides,
  };
}

describe('autoAsanaPlan execution substrate', () => {
  it('emits execution-contract substrate for split sessions and terminal blocks', () => {
    const plan = compileAutoAsanaPlan(
      baseArgs({
        defaultOwner: 'James / Operation Endgame',
        actionSequence: [
          {
            id: 'a1',
            title: 'Draft offer positioning brief',
            deliverable: 'Offer positioning brief with ICP, promise, and pricing stance',
            definitionOfDone: 'Positioning brief reviewed with target customer, promise, and pricing stance validated',
            estimateMin: 120,
            dependencies: [],
            deliverableId: 'd1',
            deliverableTitle: 'Offer positioning brief',
          },
          {
            id: 'a2',
            title: 'Build checkout page and order path',
            deliverable: 'Checkout page live with CTA, product details, and test order path',
            definitionOfDone: 'Checkout page loads, CTA works, and a test order reaches confirmation successfully',
            estimateMin: 60,
            dependencies: ['a1'],
            deliverableId: 'd2',
            deliverableTitle: 'Checkout page and order path',
          },
        ],
      })
    );

    const executionBlocks = plan.horizonBlocks.filter((block) => block.blockType !== 'waiting_period');

    expect(executionBlocks.length).toBeGreaterThanOrEqual(3);

    const first = executionBlocks[0];
    const second = executionBlocks[1];
    const last = executionBlocks[executionBlocks.length - 1];

    expect(first.owner).toBe('James / Operation Endgame');
    expect(first.producesArtifact).toBe('Offer positioning brief with ICP, promise, and pricing stance');
    expect(first.passEvidence).toBe(
      'Positioning brief reviewed with target customer, promise, and pricing stance validated'
    );
    expect(first.consumedBy).toEqual([second.title]);
    expect(first.consumedByRef).toEqual({ type: 'block', id: second.id });

    expect(second.owner).toBe('James / Operation Endgame');
    expect(second.producesArtifact).toBe('Offer positioning brief with ICP, promise, and pricing stance');
    expect(second.passEvidence).toBe(
      'Positioning brief reviewed with target customer, promise, and pricing stance validated'
    );
    expect(second.consumedByRef).toEqual({ type: 'block', id: executionBlocks[2].id });

    expect(last.owner).toBe('James / Operation Endgame');
    expect(last.producesArtifact).toBe('Checkout page live with CTA, product details, and test order path');
    expect(last.passEvidence).toBe(
      'Checkout page loads, CTA works, and a test order reaches confirmation successfully'
    );
    expect(last.consumedBy).toEqual(['terminalOutcome:goal-substrate-1']);
    expect(last.consumedByRef).toEqual({ type: 'terminalOutcome', id: 'goal-substrate-1' });
  });

  it('does not fabricate execution substrate for waiting-period blocks', () => {
    const plan = compileAutoAsanaPlan(
      baseArgs({
        actionSequence: [
          {
            id: 'wait-1',
            title: 'Manufacturer response wait',
            deliverable: 'Manufacturer response and quote packet',
            definitionOfDone: 'Manufacturer response received with quote and timing details',
            estimateMin: 60,
            dependencies: [],
            deliverableId: 'd-wait',
            deliverableTitle: 'Manufacturer response wait',
            blockType: 'waiting_period',
          },
        ],
        sessionPlan: [
          {
            date: '2026-03-10',
            startTime: '09:00',
            durationMinutes: 60,
            deliverableId: 'd-wait',
            actionId: 'wait-1',
            title: 'Manufacturer response wait',
          },
        ],
      })
    );

    const waitingBlock = plan.horizonBlocks[0];

    expect(waitingBlock.blockType).toBe('waiting_period');
    expect(waitingBlock.owner ?? null).toBeNull();
    expect(waitingBlock.producesArtifact ?? null).toBeNull();
    expect(waitingBlock.passEvidence ?? null).toBeNull();
    expect(waitingBlock.consumedByRef ?? null).toBeNull();
  });

  it('preserves explicit owner overrides on generated execution blocks', () => {
    const plan = compileAutoAsanaPlan(
      baseArgs({
        defaultOwner: 'James / Operation Endgame',
        actionSequence: [
          {
            id: 'a1',
            title: 'Draft charter and timeline',
            deliverable: 'Charter and timeline package',
            definitionOfDone: 'Charter and timeline reviewed and approved',
            estimateMin: 60,
            dependencies: [],
            deliverableId: 'd1',
            deliverableTitle: 'Charter and timeline package',
            owner: 'Strategy Lead',
          },
        ],
      })
    );

    expect(plan.horizonBlocks[0].owner).toBe('Strategy Lead');
  });

  it('falls back to executor only when no profile owner is provided', () => {
    const plan = compileAutoAsanaPlan(
      baseArgs({
        actionSequence: [
          {
            id: 'a1',
            title: 'Draft offer positioning brief',
            deliverable: 'Offer positioning brief',
            definitionOfDone: 'Offer positioning brief reviewed',
            estimateMin: 60,
            dependencies: [],
            deliverableId: 'd1',
            deliverableTitle: 'Offer positioning brief',
          },
        ],
      })
    );

    expect(plan.horizonBlocks[0].owner).toBe('executor');
  });
});
