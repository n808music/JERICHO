import { describe, expect, it } from 'vitest';
import { evaluateArchetypeRulesFromActions } from '../../src/state/engine/archetypeRuleQuality';
import { migratedArchetypeFixtures } from './archetypeRuleQuality.fixtures';

describe('archetypeRuleQuality definitionOfDone quality', () => {
  it('keeps definition-of-done output-verifiable for migrated archetypes', () => {
    migratedArchetypeFixtures.forEach((fixture) => {
      const summary = evaluateArchetypeRulesFromActions({
        executionType: fixture.archetype,
        actions: fixture.actions,
        contract: fixture.contract,
        cycleId: fixture.cycleId,
      });
      expect(summary.issues.filter((issue) => issue.code === 'WEAK_DEFINITION_OF_DONE')).toHaveLength(0);
      expect(summary.coverage.hasDefinitionOfDoneForAll).toBe(true);
    });
  });
});
