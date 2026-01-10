import { describe, expect, it } from 'vitest';
import { generateColdPlan } from '../coldPlan.ts';
import { buildAssumptionsHash } from '../strategy.ts';

function buildStrategy(routeOption) {
  const strategy = {
    strategyId: `strategy-${routeOption}`,
    generatorVersion: 'coldPlan_v1',
    routeOption,
    deliverables: [{ id: 'd1', title: 'Primary', requiredBlocks: 28 }],
    deadlineISO: '2026-02-01T23:59:00.000Z',
    constraints: { tz: 'UTC' },
    assumptionsHash: ''
  };
  strategy.assumptionsHash = buildAssumptionsHash(strategy);
  return strategy;
}

describe('cold plan route options', () => {
  it('RAMP_UP allocates more work later than early window', () => {
    const plan = generateColdPlan({
      cycleStartISO: '2026-01-01T00:00:00.000Z',
      nowISO: '2026-01-01T12:00:00.000Z',
      strategy: buildStrategy('RAMP_UP'),
      completedCountToDate: 0,
      rebaseMode: 'NONE'
    });
    const keys = Object.keys(plan.forecastByDayKey);
    const mid = Math.floor(keys.length / 2);
    const early = keys.slice(0, mid).reduce((sum, k) => sum + plan.forecastByDayKey[k].totalBlocks, 0);
    const late = keys.slice(mid).reduce((sum, k) => sum + plan.forecastByDayKey[k].totalBlocks, 0);
    expect(late).toBeGreaterThanOrEqual(early);
  });

  it('MILESTONE_QUARTERS covers all blocks', () => {
    const plan = generateColdPlan({
      cycleStartISO: '2026-01-01T00:00:00.000Z',
      nowISO: '2026-01-01T12:00:00.000Z',
      strategy: buildStrategy('MILESTONE_QUARTERS'),
      completedCountToDate: 0,
      rebaseMode: 'NONE'
    });
    const total = Object.values(plan.forecastByDayKey).reduce((sum, d) => sum + d.totalBlocks, 0);
    expect(total).toBe(28);
  });
});
