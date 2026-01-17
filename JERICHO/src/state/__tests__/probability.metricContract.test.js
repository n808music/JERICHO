import { describe, it, expect } from 'vitest';
import { computeCompletedThroughput } from '../engine/probabilityScore.ts';

describe('probability metric contract', () => {
  const goalId = 'goal-1';
  const dayKeys = ['2026-01-08', '2026-01-07'];

  it('counts only completed execution as evidence', () => {
    const events = [
      { goalId, dateISO: '2026-01-08', completed: true, kind: 'complete', minutes: 30 },
      { goalId, dateISO: '2026-01-08', completed: true, minutes: 15 },
      { goalId, dateISO: '2026-01-08', completed: false, kind: 'create', minutes: 30 },
      { goalId, dateISO: '2026-01-08', completed: false, kind: 'reschedule', minutes: 15 },
      { goalId, dateISO: '2026-01-07', completed: true, kind: 'complete', minutes: 45 },
      { goalId: 'goal-2', dateISO: '2026-01-08', completed: true, kind: 'complete', minutes: 60 }
    ];

    const result = computeCompletedThroughput({ events, goalId, dayKeys });
    expect(result.completedBlocksByDay).toEqual({ '2026-01-08': 2, '2026-01-07': 1 });
    expect(result.completedMinutesByDay).toEqual({ '2026-01-08': 45, '2026-01-07': 45 });
    expect(result.completedBlocksTotal).toBe(3);
    expect(result.completedMinutesTotal).toBe(90);
  });

  it('ignores planning churn (reschedule/delete) entirely', () => {
    const events = [
      { goalId, dateISO: '2026-01-08', completed: false, kind: 'reschedule', minutes: 30 },
      { goalId, dateISO: '2026-01-08', completed: false, kind: 'delete', minutes: 0 },
      { goalId, dateISO: '2026-01-07', completed: false, kind: 'update', minutes: 15 }
    ];

    const result = computeCompletedThroughput({ events, goalId, dayKeys });
    expect(result.completedBlocksTotal).toBe(0);
    expect(result.completedMinutesTotal).toBe(0);
    expect(result.completedBlocksByDay).toEqual({});
  });

  it('does not count missed plans in the past', () => {
    const events = [
      { goalId, dateISO: '2026-01-07', completed: false, kind: 'create', minutes: 30 },
      { goalId, dateISO: '2026-01-07', completed: false, kind: 'update', minutes: 30 }
    ];

    const result = computeCompletedThroughput({ events, goalId, dayKeys });
    expect(result.completedBlocksTotal).toBe(0);
    expect(result.completedMinutesTotal).toBe(0);
  });

  it('counts completion after reschedule once on the completion day', () => {
    const events = [
      { goalId, dateISO: '2026-01-07', completed: false, kind: 'create', minutes: 30 },
      { goalId, dateISO: '2026-01-07', completed: false, kind: 'reschedule', minutes: 30 },
      { goalId, dateISO: '2026-01-08', completed: true, kind: 'complete', minutes: 30 }
    ];

    const result = computeCompletedThroughput({ events, goalId, dayKeys });
    expect(result.completedBlocksByDay).toEqual({ '2026-01-08': 1 });
    expect(result.completedMinutesByDay).toEqual({ '2026-01-08': 30 });
    expect(result.completedBlocksTotal).toBe(1);
    expect(result.completedMinutesTotal).toBe(30);
  });
});
