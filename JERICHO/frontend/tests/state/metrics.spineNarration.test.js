import { describe, expect, it } from 'vitest';
import { computeSpineNarrationMetrics } from '../../src/state/metrics.js';

describe('computeSpineNarrationMetrics', () => {
  it('computes scheduled and waiting dependency counts deterministically', () => {
    const actions = [
      { id: 'a-1', status: 'todo', deps: [], topoIndex: 0, priority: 1 },
      { id: 'a-2', status: 'todo', deps: ['a-1'], topoIndex: 1, priority: 2 },
      { id: 'a-3', status: 'todo', deps: ['missing'], topoIndex: 2, priority: 3 },
    ];
    const blocks = [
      { id: 'b-1', cycleId: 'cycle-1', actionId: 'a-1', status: 'scheduled' },
      { id: 'b-2', cycleId: 'cycle-1', actionId: 'a-2', status: 'completed' },
      { id: 'b-3', cycleId: 'cycle-2', actionId: 'a-3', status: 'scheduled' },
    ];
    const draftItems = [
      { id: 'd-1', dayKey: '2026-01-20' },
      { id: 'd-2', dayKey: '2026-01-22' },
    ];
    const metrics = computeSpineNarrationMetrics({
      actions,
      blocks,
      draftItems,
      diagnostics: { boundaryLabel: 'Next 7 days' },
      cycleId: 'cycle-1',
    });
    expect(metrics.plannedActionsCount).toBe(3);
    expect(metrics.scheduledActionsCount).toBe(1);
    expect(metrics.remainingActionsCount).toBe(3);
    expect(metrics.waitingOnDependenciesCount).toBe(2);
    expect(metrics.boundaryLabel).toBe('Next 7 days');
    expect(metrics.draftedBlocksCount).toBe(2);
    expect(metrics.draftedDaysForward).toBe(2);
  });
});
