import { describe, it, expect } from 'vitest';
import { selectTodayTasks, selectTrajectory, selectDriftTrend } from '../../src/core/selectors.js';

const mockState = {
  tasks: [
    { id: 'a', due: 'today', status: 'pending' },
    { id: 'b', due: 'week', status: 'pending' }
  ],
  metrics: {
    cycleHistory: [40, 50, 60],
    driftIndex: 25
  }
};

describe('selectors', () => {
  it('selectTodayTasks returns only today tasks', () => {
    const result = selectTodayTasks(mockState);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('selectTrajectory projects simple values', () => {
    const result = selectTrajectory(mockState);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });

  it('selectDriftTrend categorizes drift', () => {
    expect(selectDriftTrend({ metrics: { driftIndex: 10 } })).toBe('low');
    expect(selectDriftTrend({ metrics: { driftIndex: 30 } })).toBe('moderate');
    expect(selectDriftTrend({ metrics: { driftIndex: 60 } })).toBe('high');
  });
});
