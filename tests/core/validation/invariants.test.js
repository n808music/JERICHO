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

describe('INV-003: No orphaned references', () => {
  it('passes when task.goalLink references existing goal', () => {
    const state = {
      tasks: [{ id: 'task-1', status: 'pending', goalLink: 'Test goal' }],
      history: [],
      goals: ['Test goal'],
      integrity: { score: 0, completedCount: 0, pendingCount: 1 }
    };
    const result = checkInvariants(state);
    expect(result.violations.filter(v => v.invariant === 'INV-003')).toEqual([]);
  });

  it('fails when task.goalLink references non-existent goal', () => {
    const state = {
      tasks: [{ id: 'task-1', status: 'pending', goalLink: 'Non-existent goal' }],
      history: [],
      goals: ['Different goal'],
      integrity: { score: 0, completedCount: 0, pendingCount: 1 }
    };
    const result = checkInvariants(state);
    expect(result.violations.some(v => v.invariant === 'INV-003')).toBe(true);
  });
});

describe('INV-004: Identity level bounds', () => {
  it('passes when all levels are 1-5', () => {
    const state = {
      tasks: [],
      history: [],
      goals: [],
      identity: {
        focus: { 'deep-work': { level: 3 } },
        health: { 'movement': { level: 5 } }
      },
      integrity: { score: 0, completedCount: 0, pendingCount: 0 }
    };
    const result = checkInvariants(state);
    expect(result.violations.filter(v => v.invariant === 'INV-004')).toEqual([]);
  });

  it('fails when level is out of bounds', () => {
    const state = {
      tasks: [],
      history: [],
      goals: [],
      identity: {
        focus: { 'deep-work': { level: 10 } }
      },
      integrity: { score: 0, completedCount: 0, pendingCount: 0 }
    };
    const result = checkInvariants(state);
    expect(result.violations.some(v => v.invariant === 'INV-004')).toBe(true);
  });
});

describe('INV-006: No duplicate IDs', () => {
  it('passes when all task IDs are unique', () => {
    const state = {
      tasks: [
        { id: 'task-1', status: 'pending' },
        { id: 'task-2', status: 'pending' }
      ],
      history: [],
      goals: [],
      integrity: { score: 0, completedCount: 0, pendingCount: 2 }
    };
    const result = checkInvariants(state);
    expect(result.violations.filter(v => v.invariant === 'INV-006')).toEqual([]);
  });

  it('fails when duplicate task IDs exist', () => {
    const state = {
      tasks: [
        { id: 'task-1', status: 'pending' },
        { id: 'task-1', status: 'completed' }
      ],
      history: [{ taskId: 'task-1', status: 'completed', timestamp: '2026-01-17T00:00:00Z' }],
      goals: [],
      integrity: { score: 0, completedCount: 1, pendingCount: 1 }
    };
    const result = checkInvariants(state);
    expect(result.violations.some(v => v.invariant === 'INV-006')).toBe(true);
  });
});
