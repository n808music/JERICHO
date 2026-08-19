import { describe, expect, it } from 'vitest';

import { buildMonthCycle } from '../../src/state/identityCompute.js';

describe('buildMonthCycle isolation', () => {
  it('carries forward existing blocked days for the viewed month', () => {
    const state = {
      cycle: [
        {
          date: '2026-03-02',
          blocks: [
            {
              id: 'blk-1',
              cycleId: 'cycle-fixture-1',
              goalId: 'goal-fixture-1',
              start: '2026-03-02T09:00:00.000Z',
              end: '2026-03-02T10:00:00.000Z',
              status: 'planned',
            },
          ],
          completionRate: 0,
          driftSignal: 'contained',
          loadByPractice: {},
          practices: [],
        },
        {
          date: '2026-03-20',
          blocks: [
            {
              id: 'blk-2',
              cycleId: 'cycle-fixture-1',
              goalId: 'goal-fixture-1',
              start: '2026-03-20T09:00:00.000Z',
              end: '2026-03-20T10:00:00.000Z',
              status: 'planned',
            },
          ],
          completionRate: 0,
          driftSignal: 'contained',
          loadByPractice: {},
          practices: [],
        },
      ],
    };

    const month = buildMonthCycle(state, '2026-03-01');

    expect(month).toHaveLength(30);
    const march2 = month.find((day) => day.date === '2026-03-02');
    const march20 = month.find((day) => day.date === '2026-03-20');
    expect(march2).toBeTruthy();
    expect(march20).toBeTruthy();
    expect(march2.blocks).toHaveLength(1);
    expect(march20.blocks).toHaveLength(1);
    expect(march2.blocks[0].id).toBe('blk-1');
    expect(march20.blocks[0].id).toBe('blk-2');
  });
});
