import { describe, expect, it } from 'vitest';
import { evaluateArchetypeRulesFromActions } from '../../src/state/engine/archetypeRuleQuality';
import { migratedArchetypeFixtures } from './archetypeRuleQuality.fixtures';

describe('archetypeRuleQuality acceptance criteria quality', () => {
  it('keeps acceptance criteria non-empty and materially checkable', () => {
    migratedArchetypeFixtures.forEach((fixture) => {
      const summary = evaluateArchetypeRulesFromActions({
        executionType: fixture.archetype,
        actions: fixture.actions,
        contract: fixture.contract,
        cycleId: fixture.cycleId,
      });
      expect(summary.issues.filter((issue) => issue.code === 'EMPTY_OR_WEAK_ACCEPTANCE_CRITERIA')).toHaveLength(0);
      expect(summary.coverage.hasAcceptanceCriteriaForAll).toBe(true);
    });
  });
});
