import { describe, expect, it } from 'vitest';
import { generateColdPlan } from '../coldPlan.ts';
import { buildAssumptionsHash } from '../strategy.ts';

describe('cold plan rebase strict', () => {
  it('rebase from today allocates remaining blocks only', () => {
    const strategy = {
      strategyId: 'strategy-rebase',
      generatorVersion: 'coldPlan_v1',
      routeOption: 'FLAT',
      deliverables: [{ id: 'd1', title: 'Primary', requiredBlocks: 20 }],
      deadlineISO: '2026-01-20T23:59:00.000Z',
      constraints: { tz: 'UTC' },
      assumptionsHash: ''
    };
    strategy.assumptionsHash = buildAssumptionsHash(strategy);

    const plan = generateColdPlan({
      cycleStartISO: '2026-01-01T00:00:00.000Z',
      nowISO: '2026-01-10T12:00:00.000Z',
      strategy,
      completedCountToDate: 7,
      rebaseMode: 'REMAINING_FROM_TODAY'
    });

    const total = Object.values(plan.forecastByDayKey).reduce((sum, d) => sum + d.totalBlocks, 0);
    expect(total).toBe(13);
  });
});
