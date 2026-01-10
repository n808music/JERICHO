import { describe, expect, it } from 'vitest';
import { generateColdPlan } from '../coldPlan.ts';
import { buildAssumptionsHash } from '../strategy.ts';

const baseStrategy = {
  strategyId: 'strategy-goal-1',
  generatorVersion: 'coldPlan_v1',
  routeOption: 'FLAT',
  deliverables: [{ id: 'd1', title: 'Primary', requiredBlocks: 12 }],
  deadlineISO: '2026-02-01T23:59:00.000Z',
  constraints: { tz: 'UTC' },
  assumptionsHash: ''
};

describe('cold plan determinism', () => {
  it('produces identical output for same inputs', () => {
    const strategy = { ...baseStrategy, assumptionsHash: buildAssumptionsHash(baseStrategy) };
    const input = {
      cycleStartISO: '2026-01-01T00:00:00.000Z',
      nowISO: '2026-01-01T12:00:00.000Z',
      strategy,
      completedCountToDate: 0,
      rebaseMode: 'NONE'
    };
    const a = generateColdPlan(input);
    const b = generateColdPlan(input);
    expect(a).toEqual(b);
  });
});
