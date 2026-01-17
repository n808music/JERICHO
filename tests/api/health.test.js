import { aggregateHealthCheck } from '../../src/core/validation/health.js';

describe('GET /api/health endpoint logic', () => {
  it('returns healthy status for valid state', () => {
    const state = {
      goals: ['Test goal by 2024-12-31'],
      tasks: [{ id: 'task-1', status: 'pending', goalLink: 'Test goal by 2024-12-31' }],
      history: [],
      integrity: { score: 0, completedCount: 0, pendingCount: 1 }
    };
    const result = aggregateHealthCheck(state);

    expect(result).toHaveProperty('status');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
    expect(result.status).toBe('healthy');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('checks');
    expect(result.checks).toHaveProperty('stateSchema');
    expect(result.checks).toHaveProperty('invariants');
  });

  it('returns unhealthy status when invariants fail', () => {
    const state = {
      goals: ['Test goal'],
      tasks: [{ id: 'task-1', status: 'completed' }], // No history entry
      history: [],
      integrity: { score: 50, completedCount: 1, pendingCount: 0 }
    };
    const result = aggregateHealthCheck(state);

    expect(result.status).toBe('unhealthy');
    expect(result.checks.invariants.valid).toBe(false);
    expect(result.checks.invariants.violations.length).toBeGreaterThan(0);
  });

  it('returns timestamp in ISO format', () => {
    const state = {
      goals: [],
      tasks: [],
      history: [],
      integrity: { score: 0, completedCount: 0, pendingCount: 0 }
    };
    const result = aggregateHealthCheck(state);

    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('includes schema validation errors in checks', () => {
    const state = {
      goals: [],
      tasks: [{ id: 'task-1', status: 'pending', tier: 'INVALID_TIER' }], // Invalid tier
      history: [],
      integrity: { score: 0, completedCount: 0, pendingCount: 0 }
    };
    const result = aggregateHealthCheck(state);

    expect(result.status).toBe('unhealthy');
    expect(result.checks.stateSchema.valid).toBe(false);
    expect(result.checks.stateSchema.errors).toContain('task_invalid_tier');
  });
});
