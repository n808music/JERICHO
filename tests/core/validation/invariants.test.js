import { checkInvariants } from '../../../src/core/validation/invariants.js';

describe('checkInvariants', () => {
  it('passes when completed tasks have history entries', () => {
    const state = {
      tasks: [{ id: 'task-1', status: 'completed' }],
      history: [{ taskId: 'task-1', status: 'completed', timestamp: '2026-01-17T00:00:00Z' }],
      goals: ['Test goal'],
      integrity: { score: 50, completedCount: 1, pendingCount: 0 }
    };
    const result = checkInvariants(state);
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('fails when completed task has no history entry', () => {
    const state = {
      tasks: [{ id: 'task-1', status: 'completed' }],
      history: [],
      goals: ['Test goal'],
      integrity: { score: 50, completedCount: 1, pendingCount: 0 }
    };
    const result = checkInvariants(state);
    expect(result.valid).toBe(false);
    expect(result.violations[0].invariant).toBe('INV-001');
  });
});
