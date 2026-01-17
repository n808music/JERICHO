import { validateState, validateTask, validateHistoryEntry } from '../../src/core/state-validator.js';

describe('state validator', () => {
  it('accepts a minimal valid state', () => {
    const result = validateState({ integrity: { score: 50 }, tasks: [], goals: ['Valid goal'] });
    expect(result.ok).toBe(true);
  });

  it('rejects out-of-bounds integrity', () => {
    const result = validateState({ integrity: { score: 150 }, tasks: [], goals: [] });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('integrity_out_of_bounds');
  });

  it('flags invalid tasks and goals', () => {
    const result = validateState({ integrity: { score: 10 }, tasks: [{}], goals: [' ', null] });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(['task_missing_id', 'goal_invalid']));
  });
});

describe('validateTask', () => {
  it('accepts a valid task', () => {
    const task = {
      id: 'task-1',
      title: 'Test task',
      domain: 'focus',
      capability: 'deep-work',
      status: 'pending',
      dueDate: '2026-01-20T00:00:00.000Z',
      createdAt: '2026-01-17T00:00:00.000Z'
    };
    const result = validateTask(task);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects task with missing required fields', () => {
    const task = { title: 'No ID' };
    const result = validateTask(task);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('task_missing_id');
    expect(result.errors).toContain('task_missing_domain');
    expect(result.errors).toContain('task_missing_status');
  });

  it('rejects task with invalid status enum', () => {
    const task = {
      id: 'task-1',
      title: 'Test',
      domain: 'focus',
      capability: 'deep-work',
      status: 'invalid_status'
    };
    const result = validateTask(task);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('task_invalid_status');
  });
});
