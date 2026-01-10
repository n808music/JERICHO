import { buildDefiniteGoalFromCapability } from '../../src/ui/goal-utils.js';

describe('buildDefiniteGoalFromCapability', () => {
  it('builds a definite goal string that includes domain, capability, level, and timeframe', () => {
    const goalText = buildDefiniteGoalFromCapability({ domain: 'execution', capability: 'sales', targetLevel: 4 });
    expect(goalText).toMatch(/execution\.sales/i);
    expect(goalText).toMatch(/level\s+4/);
    expect(goalText).toMatch(/within\s+90\s+days/i);
    expect(goalText.length).toBeGreaterThan(20);
  });

  it('falls back to defaults when fields are missing but still produces a valid definite goal', () => {
    const goalText = buildDefiniteGoalFromCapability({ domain: '', capability: '', targetLevel: null });
    expect(goalText).toMatch(/execution\.capability/i);
    expect(goalText).toMatch(/within\s+90\s+days/i);
    expect(/\d/.test(goalText)).toBe(true);
  });
});
