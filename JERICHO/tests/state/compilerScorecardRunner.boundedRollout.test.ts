import { describe, expect, it } from 'vitest';
import {
  getBoundedRepresentativeGoals,
  runCompilerScorecardBoundedRollout,
  runCompilerScorecardForGoal,
} from '../../src/state/contracts/compilerScorecardRunner';

describe('compiler-to-scorecard runner (bounded rollout)', () => {
  it('runs representative goals and emits lane-level + aggregate summaries', () => {
    const rollout = runCompilerScorecardBoundedRollout();
    expect(rollout.goals).toHaveLength(9);
    expect(rollout.laneResults).toHaveLength(9);
    expect(rollout.aggregate.total).toBe(9);

    const archetypes = new Set(rollout.laneResults.map((result) => result.archetype));
    expect(archetypes.size).toBe(9);

    rollout.laneResults.forEach((result) => {
      expect(result.scorecard.outputQuality).toMatch(/pass|warn|fail/);
      expect(result.scorecard.actionQuality).toMatch(/pass|warn|fail/);
      expect(result.scorecard.scheduleQuality).toMatch(/pass|warn|fail/);
      expect(result.scorecard.correctionQuality).toMatch(/pass|warn|fail/);
      expect(result.scorecard.progressTrackingQuality).toMatch(/pass|warn|fail/);
      expect(result.overall).toMatch(/pass|warn|fail/);
      expect(typeof result.compiler.usesCanonicalDeliverablePath).toBe('boolean');
      if (result.compiler.usesCanonicalDeliverablePath) {
        expect(result.compiler.actionSeedCount).toBeGreaterThan(0);
      } else {
        expect(result.issues).toContain('COMPILER_NOT_ON_CANONICAL_PATH');
      }
    });
  });

  it('exposes per-lane runner for targeted lane diagnostics', () => {
    const [goal] = getBoundedRepresentativeGoals();
    const result = runCompilerScorecardForGoal(goal);
    expect(result.laneId).toBe(goal.laneId);
    expect(result.subtype).toBe(goal.subtype);
    expect(result.compiler.actionSeedCount).toBeGreaterThan(0);
  });
});
