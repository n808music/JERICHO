import { describe, expect, it } from 'vitest';
import { generateColdPlan } from '../coldPlan.ts';
import { buildAssumptionsHash } from '../strategy.ts';

describe('cold plan sum and caps', () => {
  it('sums exactly to total required blocks', () => {
    const strategy = {
      strategyId: 'strategy-sum',
      generatorVersion: 'coldPlan_v1',
      routeOption: 'FLAT',
      deliverables: [{ id: 'd1', title: 'Primary', requiredBlocks: 10 }],
      deadlineISO: '2026-01-08T23:59:00.000Z',
      constraints: { tz: 'UTC' },
      assumptionsHash: ''
    };
    strategy.assumptionsHash = buildAssumptionsHash(strategy);

    const plan = generateColdPlan({
      cycleStartISO: '2026-01-01T00:00:00.000Z',
      nowISO: '2026-01-01T12:00:00.000Z',
      strategy,
      completedCountToDate: 0,
      rebaseMode: 'NONE'
    });

    const total = Object.values(plan.forecastByDayKey).reduce((sum, d) => sum + (d.totalBlocks || 0), 0);
    expect(total).toBe(10);
  });

  it('flags infeasible when caps are violated', () => {
    const strategy = {
      strategyId: 'strategy-cap',
      generatorVersion: 'coldPlan_v1',
      routeOption: 'FLAT',
      deliverables: [{ id: 'd1', title: 'Primary', requiredBlocks: 14 }],
      deadlineISO: '2026-01-08T23:59:00.000Z',
      constraints: { tz: 'UTC', maxBlocksPerDay: 1, maxBlocksPerWeek: 5 },
      assumptionsHash: ''
    };
    strategy.assumptionsHash = buildAssumptionsHash(strategy);

    const plan = generateColdPlan({
      cycleStartISO: '2026-01-01T00:00:00.000Z',
      nowISO: '2026-01-01T12:00:00.000Z',
      strategy,
      completedCountToDate: 0,
      rebaseMode: 'NONE'
    });

    expect(plan.infeasible).toBeTruthy();
    expect(plan.infeasible?.availableCapacityPerWeek).toBe(5);
  });
});
