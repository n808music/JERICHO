import { validateState } from '../../src/core/state-validator.js';

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
