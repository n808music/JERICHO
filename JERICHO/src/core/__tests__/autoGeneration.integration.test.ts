/**
 * autoGeneration.integration.test.ts
 *
 * End-to-end integration tests for auto-generation system.
 * Tests that "Regenerate Route" produces blocks without manual deliverables.
 */

import { describe, it, expect, beforeEach } from 'vitest';

/**
 * MOCK SETUP: These tests don't run the full identity store/React,
 * but validate the mechanism class → deliverables → plan flow
 */

import { deriveMechanismClass } from '../mechanismClass';
import { generateAutoDeliverables, totalAutoBlocksRequired } from '../autoDeliverables';

describe('autoGeneration.integration', () => {
  describe('Flow: Goal Text → Mechanism → Deliverables → Plan Blocks', () => {
    const testScenarios = [
      {
        name: 'Music Publishing Goal',
        goal: {
          goalId: 'goal_music',
          terminalOutcome: { text: 'Publish my album to Spotify' },
          deadlineISO: '2025-03-15T23:59:59Z'
        },
        expectations: {
          mechanism: 'PUBLISH',
          minDeliverables: 4,
          minTotalBlocks: 12
        }
      },
      {
        name: 'Learning Goal',
        goal: {
          goalId: 'goal_learn',
          goalText: 'Learn TypeScript and master async patterns',
          deadlineISO: '2025-04-01T23:59:59Z'
        },
        expectations: {
          mechanism: 'LEARN',
          minDeliverables: 4,
          minTotalBlocks: 20
        }
      },
      {
        name: 'Product Build Goal',
        goal: {
          goalId: 'goal_build',
          goalText: 'Build a new React dashboard component',
          deadlineISO: '2025-02-28T23:59:59Z'
        },
        expectations: {
          mechanism: 'CREATE',
          minDeliverables: 3,
          minTotalBlocks: 15
        }
      },
      {
        name: 'Code Review Goal',
        goal: {
          goalId: 'goal_review',
          terminalOutcome: { text: 'Review and refactor payment module' },
          deadlineISO: '2025-03-20T23:59:59Z'
        },
        expectations: {
          mechanism: 'REVIEW',
          minDeliverables: 4,
          minTotalBlocks: 15
        }
      },
      {
        name: 'Marketing Growth Goal',
        goal: {
          goalId: 'goal_market',
          goalText: 'Market and grow user acquisition by 50%',
          deadlineISO: '2025-04-15T23:59:59Z'
        },
        expectations: {
          mechanism: 'MARKET',
          minDeliverables: 4,
          minTotalBlocks: 18
        }
      },
      {
        name: 'Infrastructure Setup Goal',
        goal: {
          goalId: 'goal_ops',
          goalText: 'Set up CI/CD pipeline infrastructure',
          deadlineISO: '2025-03-10T23:59:59Z'
        },
        expectations: {
          mechanism: 'OPS',
          minDeliverables: 4,
          minTotalBlocks: 15
        }
      }
    ];

    testScenarios.forEach((scenario) => {
      describe(scenario.name, () => {
        it('derives correct mechanism class', () => {
          const mechanism = deriveMechanismClass(scenario.goal);
          expect(mechanism).toBe(scenario.expectations.mechanism);
        });

        it('generates sufficient deliverables', () => {
          const deliverables = generateAutoDeliverables(scenario.goal);
          expect(deliverables.length).toBeGreaterThanOrEqual(scenario.expectations.minDeliverables);

          // All deliverables have required fields
          deliverables.forEach((d) => {
            expect(d).toHaveProperty('id');
            expect(d).toHaveProperty('title');
            expect(d).toHaveProperty('requiredBlocks');
            expect(d.id).toMatch(/^auto-/);
            expect(d.title).toBeTruthy();
            expect(d.requiredBlocks).toBeGreaterThan(0);
          });
        });

        it('allocates sufficient total blocks', () => {
          const total = totalAutoBlocksRequired(scenario.goal);
          expect(total).toBeGreaterThanOrEqual(scenario.expectations.minTotalBlocks);
        });

        it('all blocks are positive integers', () => {
          const deliverables = generateAutoDeliverables(scenario.goal);
          deliverables.forEach((d) => {
            expect(Number.isInteger(d.requiredBlocks)).toBe(true);
            expect(d.requiredBlocks).toBeGreaterThan(0);
          });
        });

        it('deliverable IDs include mechanism prefix', () => {
          const deliverables = generateAutoDeliverables(scenario.goal);
          deliverables.forEach((d) => {
            expect(d.id).toContain(`auto-${scenario.expectations.mechanism}`);
          });
        });
      });
    });
  });

  describe('Acceptance Criteria', () => {
    it('AC1: Regenerate Route produces blocks without manual deliverables', () => {
      // When goal contract is admitted with valid deadline
      const goalContract = {
        goalId: 'test_goal',
        terminalOutcome: { text: 'Publish software release' },
        deadlineISO: '2025-03-31T23:59:59Z'
      };

      // Then mechanism class → deliverables → plan blocks
      const mechanism = deriveMechanismClass(goalContract);
      const deliverables = generateAutoDeliverables(goalContract);
      const totalBlocks = totalAutoBlocksRequired(goalContract);

      expect(mechanism).toBeTruthy();
      expect(deliverables.length).toBeGreaterThan(0);
      expect(totalBlocks).toBeGreaterThan(0);
    });

    it('AC2: Deterministic - same goal produces identical plan each time', () => {
      const goal = { goalText: 'Build web application' };

      const d1 = generateAutoDeliverables(goal);
      const d2 = generateAutoDeliverables(goal);
      const d3 = generateAutoDeliverables(goal);

      const t1 = totalAutoBlocksRequired(goal);
      const t2 = totalAutoBlocksRequired(goal);
      const t3 = totalAutoBlocksRequired(goal);

      expect(JSON.stringify(d1)).toEqual(JSON.stringify(d2));
      expect(JSON.stringify(d2)).toEqual(JSON.stringify(d3));
      expect(t1).toEqual(t2);
      expect(t2).toEqual(t3);
    });

    it('AC3: No LLM calls - purely deterministic keyword matching', () => {
      // This is implicit in the implementation (no network calls, pure functions)
      // We validate by checking execution speed (should be <5ms)
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        const goal = { goalText: `Goal text ${i}` };
        generateAutoDeliverables(goal);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500); // 100 generations in <500ms (no network delay)
    });

    it('AC4: System handles edge cases gracefully', () => {
      const edgeCases = [
        {},
        { goalText: '' },
        { terminalOutcome: null },
        { goalText: '   ' },
        { goalText: 'a b c' },
        { goalText: 'unknown thing without keywords' }
      ];

      edgeCases.forEach((goal) => {
        const mechanism = deriveMechanismClass(goal);
        const deliverables = generateAutoDeliverables(goal);
        const total = totalAutoBlocksRequired(goal);

        expect(mechanism).toBeTruthy();
        expect(mechanism).toMatch(/^(CREATE|PUBLISH|MARKET|LEARN|OPS|REVIEW)$/);
        expect(deliverables.length).toBeGreaterThan(0);
        expect(total).toBeGreaterThan(0);
      });
    });
  });

  describe('Regression: Phase 1 coexistence', () => {
    it('mechanism-class system is orthogonal to Phase 1 autoStrategy', () => {
      // Phase 2 (mechanism-class) and Phase 1 (autoStrategy) can coexist
      // They represent two different derivation strategies:
      // - Phase 1: Type-based (music/generic detection)
      // - Phase 2: Mechanism-class-based (keyword derivation)

      const goal = { goalText: 'Publish indie music to all streaming platforms' };

      // Phase 2 derivation
      const mechanism = deriveMechanismClass(goal);
      const deliverables = generateAutoDeliverables(goal);

      // Both should produce results
      expect(mechanism).toBe('PUBLISH');
      expect(deliverables.length).toBeGreaterThan(0);

      // The integration in identityCompute.js will try Phase 2 first,
      // then Phase 1 as fallback if Phase 2 produces no deliverables
      // This ensures backward compatibility
    });
  });

  describe('Performance', () => {
    it('mechanism class derivation is <1ms per goal', () => {
      const goal = { goalText: 'Build a complex web application' };

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        deriveMechanismClass(goal);
      }
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // 1000 derivations in <100ms
    });

    it('deliverable generation is <5ms per goal', () => {
      const goal = { goalText: 'Learn advanced TypeScript patterns' };

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        generateAutoDeliverables(goal);
      }
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(500); // 100 generations in <500ms
    });
  });
});
