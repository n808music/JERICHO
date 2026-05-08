import { describe, expect, it } from 'vitest';
import { evaluateArchetypeRulesFromActions } from '../../src/state/engine/archetypeRuleQuality';
import { migratedArchetypeFixtures } from './archetypeRuleQuality.fixtures';

describe('archetypeRuleQuality summary', () => {
  it('returns stable summary shape for all migrated archetypes', () => {
    migratedArchetypeFixtures.forEach((fixture) => {
      const summary = evaluateArchetypeRulesFromActions({
        executionType: fixture.archetype,
        actions: fixture.actions,
        contract: fixture.contract,
        cycleId: fixture.cycleId,
      });

      expect(summary.archetype.length).toBeGreaterThan(0);
      expect(summary.usesCanonicalDeliverablePath).toBe(true);
      expect(typeof summary.deliverableCount).toBe('number');
      expect(Array.isArray(summary.issues)).toBe(true);
      expect(summary.coverage).toBeDefined();
      expect(summary.schedulerReadiness).toBeDefined();
    });
  });
});
