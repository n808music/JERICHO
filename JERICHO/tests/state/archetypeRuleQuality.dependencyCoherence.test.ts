import { describe, expect, it } from 'vitest';
import { evaluateArchetypeRulesFromActions } from '../../src/state/engine/archetypeRuleQuality';
import { migratedArchetypeFixtures } from './archetypeRuleQuality.fixtures';

describe('archetypeRuleQuality dependency coherence', () => {
  it('preserves non-trivial dependency structure for migrated archetypes', () => {
    migratedArchetypeFixtures.forEach((fixture) => {
      const summary = evaluateArchetypeRulesFromActions({
        executionType: fixture.archetype,
        actions: fixture.actions,
        contract: fixture.contract,
        cycleId: fixture.cycleId,
      });
      expect(summary.issues.filter((issue) => issue.code === 'DEPENDENCY_FLATTENING')).toHaveLength(0);
      expect(summary.coverage.hasNonTrivialDependencies).toBe(true);
    });
  });
});
