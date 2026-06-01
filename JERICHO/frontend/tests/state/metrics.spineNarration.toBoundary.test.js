import { describe, expect, it } from 'vitest';
import { computeSpineNarrationMetrics } from '../../src/state/metrics.js';

describe('metrics spine narration to boundary', () => {
  it('computes schedule-to-boundary counts and boundary metadata', () => {
    const metrics = computeSpineNarrationMetrics({
      cycleId: 'cycle-1',
      actions: [
        { id: 'a-1', status: 'done', deps: [], topoIndex: 0, priority: 1 },
        { id: 'a-2', status: 'todo', deps: ['a-1'], topoIndex: 1, priority: 1 },
      ],
      blocks: [
        { id: 'b-1', actionId: 'a-2', cycleId: 'cycle-1', status: 'scheduled', start: '2026-01-21T09:00:00.000Z' },
      ],
      draftItems: [{ id: 'd-1', dayKey: '2026-01-21' }],
      diagnostics: {
        boundaryKind: 'DELIVERABLE',
        boundaryLabel: 'Season spine (due 2026-01-25)',
        boundaryDeadlineISO: '2026-01-25T23:59:59.000Z',
        routeSlotsCount: 5,
        reasonCode: 'INSUFFICIENT_READY_ACTIONS',
      },
    });

    expect(metrics.plannedActionsCount).toBe(2);
    expect(metrics.completedActionsCount).toBe(1);
    expect(metrics.scheduledToBoundaryCount).toBe(1);
    expect(metrics.routeSlotsToBoundaryCount).toBe(5);
    expect(metrics.boundaryLabel).toContain('Season spine');
    expect(metrics.reasonCode).toBe('INSUFFICIENT_READY_ACTIONS');
  });
});
