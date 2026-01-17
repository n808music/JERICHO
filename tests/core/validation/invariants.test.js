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

describe('INV-002: Integrity count coherence', () => {
  it('passes when counts match task statuses', () => {
    const state = {
      tasks: [
        { id: 'task-1', status: 'completed' },
        { id: 'task-2', status: 'pending' }
      ],
      history: [{ taskId: 'task-1', status: 'completed', timestamp: '2026-01-17T00:00:00Z' }],
      goals: ['Test goal'],
      integrity: { score: 50, completedCount: 1, pendingCount: 1 }
    };
    const result = checkInvariants(state);
    expect(result.violations.filter(v => v.invariant === 'INV-002')).toEqual([]);
  });

  it('fails when completedCount does not match', () => {
    const state = {
      tasks: [
        { id: 'task-1', status: 'completed' },
        { id: 'task-2', status: 'pending' }
      ],
      history: [{ taskId: 'task-1', status: 'completed', timestamp: '2026-01-17T00:00:00Z' }],
      goals: ['Test goal'],
      integrity: { score: 50, completedCount: 5, pendingCount: 1 }
    };
    const result = checkInvariants(state);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.invariant === 'INV-002')).toBe(true);
  });
});
