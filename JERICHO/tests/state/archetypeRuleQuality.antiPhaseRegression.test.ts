import { describe, expect, it } from 'vitest';
import { evaluateArchetypeRulesFromActions } from '../../src/state/engine/archetypeRuleQuality';
import { migratedArchetypeFixtures } from './archetypeRuleQuality.fixtures';

describe('archetypeRuleQuality anti-phase regression', () => {
  it('does not classify phase/group labels as deliverables for migrated archetypes', () => {
    migratedArchetypeFixtures.forEach((fixture) => {
      const summary = evaluateArchetypeRulesFromActions({
        executionType: fixture.archetype,
        actions: fixture.actions,
        contract: fixture.contract,
        cycleId: fixture.cycleId,
      });
      expect(summary.issues.filter((issue) => issue.code === 'PHASE_LABEL_AS_DELIVERABLE')).toHaveLength(0);
    });
  });
});
