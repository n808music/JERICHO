import { describe, expect, it } from 'vitest';
import { evaluateArchetypeRulesFromActions } from '../../src/state/engine/archetypeRuleQuality';
import { migratedArchetypeFixtures } from './archetypeRuleQuality.fixtures';

describe('archetypeRuleQuality session plausibility', () => {
  it('keeps estimated sessions/minutes plausible for migrated archetypes', () => {
    migratedArchetypeFixtures.forEach((fixture) => {
      const summary = evaluateArchetypeRulesFromActions({
        executionType: fixture.archetype,
        actions: fixture.actions,
        contract: fixture.contract,
        cycleId: fixture.cycleId,
      });
      expect(summary.issues.filter((issue) => issue.code === 'ESTIMATE_IMPLAUSIBILITY')).toHaveLength(0);
      expect(summary.coverage.hasSessionEstimates).toBe(true);
      expect(summary.schedulerReadiness.sessionEstimationCoherent).toBe(true);
    });
  });
});
