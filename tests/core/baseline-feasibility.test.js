import { computeBaselineFeasibility } from '../../src/core/baseline-feasibility.js';

describe('baseline feasibility scoring', () => {
  it('returns 0 and reason when requirements or gaps missing', () => {
    const result = computeBaselineFeasibility({ requirements: null, gaps: null, integrity: {} });
    expect(result.feasibilityScore).toBe(0);
    expect(result.reasonCodes).toContain('BASELINE_FEASIBILITY_INPUT_MISSING');
  });

  it('computes a score between 0 and 1 for valid inputs', () => {
    const requirements = [{ id: 'r1' }];
    const gaps = [{ weightedGap: 2 }, { weightedGap: 4 }];
    const integrity = { score: 50 };
    const result = computeBaselineFeasibility({ requirements, gaps, integrity });
    expect(result.feasibilityScore).toBeGreaterThan(0);
    expect(result.feasibilityScore).toBeLessThanOrEqual(1);
    expect(result.reasonCodes).toEqual([]);
  });
});
