import { aggregateHealthCheck } from '../../../src/core/validation/health.js';

describe('aggregateHealthCheck', () => {
  it('returns healthy when all checks pass', () => {
    const state = {
      goals: ['Test goal'],
      tasks: [{ id: 'task-1', status: 'pending', goalLink: 'Test goal' }],
      history: [],
      integrity: { score: 0, completedCount: 0, pendingCount: 1 }
    };
    const result = aggregateHealthCheck(state);
    expect(result.status).toBe('healthy');
    expect(result.checks.stateSchema.valid).toBe(true);
    expect(result.checks.invariants.valid).toBe(true);
  });

  it('returns unhealthy when invariants fail', () => {
    const state = {
      goals: ['Test goal'],
      tasks: [{ id: 'task-1', status: 'completed' }], // No history entry
      history: [],
      integrity: { score: 50, completedCount: 1, pendingCount: 0 }
    };
    const result = aggregateHealthCheck(state);
    expect(result.status).toBe('unhealthy');
    expect(result.checks.invariants.valid).toBe(false);
  });
});
