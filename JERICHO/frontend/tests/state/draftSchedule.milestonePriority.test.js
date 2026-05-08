import { describe, expect, it } from 'vitest';
import { buildMilestonePriorityContext } from '../../src/state/draftSchedule.js';

describe('draftSchedule milestone priority context', () => {
  it('ranks actions by earliest milestone window and checkpoint precedence', () => {
    const actions = [
      { id: 'a1', estimateMin: 30 },
      { id: 'a2', estimateMin: 30 },
      { id: 'a3', estimateMin: 30 },
      { id: 'a4', estimateMin: 30 },
    ];
    const milestones = [
      {
        id: 'late',
        windowStartDayKey: '2026-02-01',
        windowEndDayKey: '2026-02-10',
        actionIds: ['a1'],
        checkpointActionIds: ['a3'],
      },
      {
        id: 'early',
        windowStartDayKey: '2026-01-01',
        windowEndDayKey: '2026-01-05',
        actionIds: ['a2'],
        checkpointActionIds: ['a4'],
      },
    ];

    const context = buildMilestonePriorityContext(milestones, actions, 30);
    expect(context.hasMilestones).toBe(true);

    const a4 = context.actionPriority.get('a4');
    const a2 = context.actionPriority.get('a2');
    const a3 = context.actionPriority.get('a3');

    expect(a4.milestoneRank).toBe(0);
    expect(a4.isCheckpointAction).toBe(true);
    expect(a2.milestoneRank).toBe(0);
    expect(a2.isCheckpointAction).toBe(false);
    expect(a3.milestoneRank).toBe(1);
  });
});
