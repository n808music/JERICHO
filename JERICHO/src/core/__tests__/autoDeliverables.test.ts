/**
 * autoDeliverables.test.ts
 *
 * Tests for template-based auto-deliverables generation.
 * Ensures each mechanism class generates appropriate deliverables.
 */

import { describe, it, expect } from 'vitest';
import { generateAutoDeliverables, totalAutoBlocksRequired, debugAutoDeliverablesGeneration } from '../autoDeliverables';

describe('autoDeliverables', () => {
  describe('generateAutoDeliverables', () => {
    it('generates deliverables for PUBLISH goals', () => {
      const goal = { terminalOutcome: { text: 'Publish music to Spotify' } };
      const deliverables = generateAutoDeliverables(goal);

      expect(deliverables).toHaveLength(4);
      expect(deliverables[0].title).toContain('Prepare');
      expect(deliverables[1].title).toContain('release');
      expect(deliverables[2].title).toContain('Deploy');
      expect(deliverables[3].title).toContain('Monitor');

      // All should be numbered/unique
      expect(new Set(deliverables.map((d) => d.id)).size).toBe(4);

      // All should have positive block counts
      deliverables.forEach((d) => {
        expect(d.requiredBlocks).toBeGreaterThan(0);
      });
    });

    it('generates deliverables for CREATE goals', () => {
      const goal = { goalText: 'Build a new dashboard' };
      const deliverables = generateAutoDeliverables(goal);

      expect(deliverables).toHaveLength(3);
      expect(deliverables[0].title).toContain('Design');
      expect(deliverables[1].title).toContain('Build');
      expect(deliverables[2].title).toContain('Test');

      const totalBlocks = deliverables.reduce((sum, d) => sum + d.requiredBlocks, 0);
      expect(totalBlocks).toBeGreaterThan(0);
    });

    it('generates deliverables for MARKET goals', () => {
      const goal = { goalText: 'Grow user acquisition by 50%' };
      const deliverables = generateAutoDeliverables(goal);

      expect(deliverables).toHaveLength(4);
      deliverables.forEach((d) => {
        expect(d.title.length).toBeGreaterThan(0);
        expect(d.requiredBlocks).toBeGreaterThan(0);
      });
    });

    it('generates deliverables for LEARN goals', () => {
      const goal = { terminalOutcome: { text: 'Learn TypeScript deeply' } };
      const deliverables = generateAutoDeliverables(goal);

      expect(deliverables).toHaveLength(4);
      expect(deliverables[0].title).toContain('Research');
      expect(deliverables[1].title).toContain('course');
      expect(deliverables[2].title).toContain('Practice');
      expect(deliverables[3].title).toContain('Document');
    });

    it('generates deliverables for OPS goals', () => {
      const goal = { goalText: 'Set up CI/CD pipeline' };
      const deliverables = generateAutoDeliverables(goal);

      expect(deliverables).toHaveLength(4);
      expect(deliverables[0].title).toContain('Plan');
      expect(deliverables[1].title).toContain('Implement');
      expect(deliverables[2].title).toContain('Test');
      expect(deliverables[3].title).toContain('monitoring');
    });

    it('generates deliverables for REVIEW goals', () => {
      const goal = { goalText: 'Review and refactor codebase' };
      const deliverables = generateAutoDeliverables(goal);

      expect(deliverables).toHaveLength(4);
      expect(deliverables[0].title).toContain('Audit');
      expect(deliverables[1].title).toContain('Plan');
      expect(deliverables[2].title).toContain('refactor');
      expect(deliverables[3].title).toContain('Verify');
    });

    // Deliverable structure tests
    describe('Deliverable structure', () => {
      it('all deliverables have required fields', () => {
        const goal = { goalText: 'Publish a book' };
        const deliverables = generateAutoDeliverables(goal);

        deliverables.forEach((d) => {
          expect(d).toHaveProperty('id');
          expect(d).toHaveProperty('title');
          expect(d).toHaveProperty('requiredBlocks');

          expect(typeof d.id).toBe('string');
          expect(typeof d.title).toBe('string');
          expect(typeof d.requiredBlocks).toBe('number');

          expect(d.id.length).toBeGreaterThan(0);
          expect(d.title.length).toBeGreaterThan(0);
          expect(d.requiredBlocks).toBeGreaterThan(0);
        });
      });

      it('IDs are unique within result set', () => {
        const goal = { goalText: 'Build something' };
        const deliverables = generateAutoDeliverables(goal);
        const ids = deliverables.map((d) => d.id);

        expect(new Set(ids).size).toBe(ids.length);
      });

      it('IDs include mechanism class prefix', () => {
        const goal1 = { goalText: 'Publish music' };
        const goal2 = { goalText: 'Learn Python' };

        const d1 = generateAutoDeliverables(goal1);
        const d2 = generateAutoDeliverables(goal2);

        expect(d1[0].id).toMatch(/auto-PUBLISH/);
        expect(d2[0].id).toMatch(/auto-LEARN/);
      });
    });

    // Outcome noun extraction tests
    describe('Outcome noun substitution', () => {
      it('substitutes {outcome} placeholder with extracted noun', () => {
        const goal = { goalText: 'Build a website application' };
        const deliverables = generateAutoDeliverables(goal);

        // At least one deliverable should have a meaningful substitution (noun extraction)
        expect(deliverables.length).toBeGreaterThan(0);
        deliverables.forEach((d) => {
          // Should not have unsubstituted placeholders
          expect(d.title).not.toContain('{outcome}');
          expect(d.title).not.toContain('{noun}');
        });
      });

      it('handles missing goal text gracefully', () => {
        const goal = {};
        const deliverables = generateAutoDeliverables(goal);

        expect(deliverables).toBeDefined();
        expect(deliverables.length).toBeGreaterThan(0);
        // Should still have proper titles
        deliverables.forEach((d) => {
          expect(d.title.length).toBeGreaterThan(0);
          expect(d.title).not.toContain('{outcome}');
        });
      });

      it('generates meaningful deliverable titles', () => {
        const goal1 = { goalText: 'Learn Python programming' };
        const goal2 = { goalText: 'Publish an electronic album' };

        const d1 = generateAutoDeliverables(goal1);
        const d2 = generateAutoDeliverables(goal2);

        // Should have concrete titles
        d1.forEach((d) => {
          expect(d.title.length).toBeGreaterThan(5);
          expect(d.title).not.toContain('{');
        });

        d2.forEach((d) => {
          expect(d.title.length).toBeGreaterThan(5);
          expect(d.title).not.toContain('{');
        });
      });
    });

    // Determinism tests (critical)
    describe('Determinism: same input = identical output', () => {
      it('same goal produces identical deliverables on repeat calls', () => {
        const goal = { goalText: 'Publish book to Amazon' };

        const d1 = generateAutoDeliverables(goal);
        const d2 = generateAutoDeliverables(goal);
        const d3 = generateAutoDeliverables(goal);

        expect(JSON.stringify(d1)).toEqual(JSON.stringify(d2));
        expect(JSON.stringify(d2)).toEqual(JSON.stringify(d3));
      });

      it('different goals produce different deliverables', () => {
        const goal1 = { goalText: 'Build web app' };
        const goal2 = { goalText: 'Learn programming' };

        const d1 = generateAutoDeliverables(goal1);
        const d2 = generateAutoDeliverables(goal2);

        // Different mechanisms should produce different delivery sets
        expect(d1[0].title).not.toEqual(d2[0].title);
      });
    });
  });

  describe('totalAutoBlocksRequired', () => {
    it('sums all deliverable blocks', () => {
      const goal = { goalText: 'Build a website' };
      const total = totalAutoBlocksRequired(goal);

      const manual = generateAutoDeliverables(goal);
      const expected = manual.reduce((sum, d) => sum + d.requiredBlocks, 0);

      expect(total).toBe(expected);
      expect(total).toBeGreaterThan(0);
    });

    it('returns reasonable totals per mechanism', () => {
      const testCases = [
        { goal: { goalText: 'Publish album' }, minBlocks: 10, maxBlocks: 30 },
        { goal: { goalText: 'Learn TypeScript' }, minBlocks: 20, maxBlocks: 40 },
        { goal: { goalText: 'Build dashboard' }, minBlocks: 15, maxBlocks: 35 },
        { goal: { goalText: 'Review code' }, minBlocks: 10, maxBlocks: 30 }
      ];

      testCases.forEach((tc) => {
        const total = totalAutoBlocksRequired(tc.goal);
        expect(total).toBeGreaterThanOrEqual(tc.minBlocks);
        expect(total).toBeLessThanOrEqual(tc.maxBlocks);
      });
    });
  });

  describe('debugAutoDeliverablesGeneration', () => {
    it('returns diagnostic output object', () => {
      const goal = { goalText: 'Publish music to Spotify' };
      const debug = debugAutoDeliverablesGeneration(goal);

      expect(debug).toHaveProperty('goalText');
      expect(debug).toHaveProperty('derivedMechanism');
      expect(debug).toHaveProperty('mechanismDescription');
      expect(debug).toHaveProperty('deliverables');
      expect(debug).toHaveProperty('totalBlocksRequired');

      expect(debug.goalText).toContain('Publish');
      expect(debug.derivedMechanism).toBe('PUBLISH');
      expect(Array.isArray(debug.deliverables)).toBe(true);
      expect(debug.totalBlocksRequired).toBeGreaterThan(0);
    });

    it('diagnostic deliverables match actual generation', () => {
      const goal = { goalText: 'Learn Python' };
      const debug = debugAutoDeliverablesGeneration(goal);
      const actual = generateAutoDeliverables(goal);

      expect(debug.deliverables.length).toBe(actual.length);
      debug.deliverables.forEach((d, i) => {
        expect(d.title).toBe(actual[i].title);
        expect(d.blocks).toBe(actual[i].requiredBlocks);
      });
    });
  });

    // Integration tests
    describe('Integration: mechanism class → templates → deliverables', () => {
      it('end-to-end: goal text → mechanism → deliverables', () => {
        const goals = [
          { text: 'Publish album to Spotify', expectedMechanism: 'PUBLISH', minCount: 4 },
          { text: 'Learn AWS certification', expectedMechanism: 'LEARN', minCount: 4 },
          { text: 'Build React component library', expectedMechanism: 'CREATE', minCount: 3 },
          { text: 'Review codebase quality', expectedMechanism: 'REVIEW', minCount: 4 },
          { text: 'Market new product', expectedMechanism: 'MARKET', minCount: 4 },
          { text: 'Set up deployment infrastructure', expectedMechanism: 'OPS', minCount: 4 }
        ];

        goals.forEach((goal) => {
          const deliverables = generateAutoDeliverables({ goalText: goal.text });

          expect(deliverables.length).toBe(goal.minCount);
          deliverables.forEach((d) => {
            expect(d.id).toContain(`auto-${goal.expectedMechanism}`);
          });
        });
      });    it('all deliverables are schedulable (positive block counts)', () => {
      const goals = [
        { goalText: 'Publish book' },
        { goalText: 'Learn Python' },
        { goalText: 'Build dashboard' }
      ];

      goals.forEach((goal) => {
        const deliverables = generateAutoDeliverables(goal);
        const totalBlocks = totalAutoBlocksRequired(goal);

        expect(totalBlocks).toBeGreaterThan(0);

        deliverables.forEach((d) => {
          expect(d.requiredBlocks).toBeGreaterThan(0);
          expect(Number.isInteger(d.requiredBlocks)).toBe(true);
        });
      });
    });
  });

  // Edge cases
  describe('Edge cases', () => {
    it('handles empty goal contract', () => {
      const goal = {};
      const deliverables = generateAutoDeliverables(goal);

      expect(Array.isArray(deliverables)).toBe(true);
      expect(deliverables.length).toBeGreaterThan(0);
    });

    it('handles null/undefined text fields', () => {
      const goal = {
        terminalOutcome: null,
        goalText: undefined,
        aim: { text: null }
      };
      const deliverables = generateAutoDeliverables(goal);

      expect(Array.isArray(deliverables)).toBe(true);
      // Should default to CREATE mechanism
      expect(deliverables[0].id).toMatch(/auto-CREATE/);
    });

    it('handles very long goal text', () => {
      const longText = 'Learn ' + 'programming '.repeat(100);
      const goal = { goalText: longText };
      const deliverables = generateAutoDeliverables(goal);

      expect(Array.isArray(deliverables)).toBe(true);
      expect(deliverables.length).toBeGreaterThan(0);
      deliverables.forEach((d) => {
        expect(d.title.length).toBeGreaterThan(0);
        expect(d.title.length).toBeLessThan(500); // Reasonable length
      });
    });

    it('handles special characters in goal text', () => {
      const goal = { goalText: 'Publish #music @spotify!!! 🎵' };
      const deliverables = generateAutoDeliverables(goal);

      expect(Array.isArray(deliverables)).toBe(true);
      expect(deliverables.length).toBeGreaterThan(0);
    });
  });
});
