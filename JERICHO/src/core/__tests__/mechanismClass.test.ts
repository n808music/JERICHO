/**
 * mechanismClass.test.ts
 *
 * Tests for deterministic mechanism class derivation.
 * Ensures same goal text always produces same mechanism class.
 */

import { describe, it, expect } from 'vitest';
import { deriveMechanismClass, MechanismClass, describeMechanismClass } from '../mechanismClass';

describe('mechanismClass', () => {
  describe('deriveMechanismClass', () => {
    // PUBLISH tests
    describe('PUBLISH mechanism', () => {
      it('detects publish keywords', () => {
        expect(deriveMechanismClass({ terminalOutcome: { text: 'Publish my music to Spotify' } })).toBe('PUBLISH');
        expect(deriveMechanismClass({ goalText: 'Release album on all platforms' })).toBe('PUBLISH');
        expect(deriveMechanismClass({ mechanism: 'publish', goalText: 'some goal' })).toBe('PUBLISH');
      });

      it('detects launch keywords', () => {
        expect(deriveMechanismClass({ terminalOutcome: { text: 'Launch new product' } })).toBe('PUBLISH');
        expect(deriveMechanismClass({ goalText: 'Go live with service' })).toBe('PUBLISH');
      });

      it('detects deploy keywords', () => {
        expect(deriveMechanismClass({ terminalOutcome: { text: 'Deploy app to app store' } })).toBe('PUBLISH');
      });

      it('is case-insensitive', () => {
        expect(deriveMechanismClass({ goalText: 'PUBLISH MY WORK' })).toBe('PUBLISH');
        expect(deriveMechanismClass({ goalText: 'PuBlIsH sOnGS' })).toBe('PUBLISH');
      });
    });

    // MARKET tests
    describe('MARKET mechanism', () => {
      it('detects market keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Market new product to fitness enthusiasts' })).toBe('MARKET');
        expect(deriveMechanismClass({ terminalOutcome: { text: 'Grow user acquisition by 50%' } })).toBe('MARKET');
      });

      it('detects promotion keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Promote blog posts on social media' })).toBe('MARKET');
        expect(deriveMechanismClass({ goalText: 'Run acquisition campaign' })).toBe('MARKET');
      });

      it('detects sales keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Increase sales by 30%' })).toBe('MARKET');
        expect(deriveMechanismClass({ goalText: 'Pitch product to investors' })).toBe('MARKET');
      });
    });

    // LEARN tests
    describe('LEARN mechanism', () => {
      it('detects learn keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Learn TypeScript deeply' })).toBe('LEARN');
        expect(deriveMechanismClass({ terminalOutcome: { text: 'Master Python' } })).toBe('LEARN');
      });

      it('detects study keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Study machine learning fundamentals' })).toBe('LEARN');
        expect(deriveMechanismClass({ goalText: 'Research cloud architecture patterns' })).toBe('LEARN');
      });

      it('detects certification keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Get AWS certification' })).toBe('LEARN');
        expect(deriveMechanismClass({ goalText: 'Complete online course' })).toBe('LEARN');
      });
    });

    // REVIEW tests
    describe('REVIEW mechanism', () => {
      it('detects review keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Review codebase for quality issues' })).toBe('REVIEW');
        expect(deriveMechanismClass({ terminalOutcome: { text: 'Audit security vulnerabilities' } })).toBe('REVIEW');
      });

      it('detects refactor keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Refactor payment module' })).toBe('REVIEW');
        expect(deriveMechanismClass({ goalText: 'Improve test coverage' })).toBe('REVIEW');
      });

      it('detects optimization keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Optimize database queries' })).toBe('REVIEW');
        expect(deriveMechanismClass({ goalText: 'Fix deprecated warnings' })).toBe('REVIEW');
      });
    });

    // OPS tests
    describe('OPS mechanism', () => {
      it('detects ops keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Set up CI/CD pipeline' })).toBe('OPS');
        expect(deriveMechanismClass({ terminalOutcome: { text: 'Configure monitoring infrastructure' } })).toBe('OPS');
      });

      it('detects infrastructure keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Deploy infrastructure as code' })).toBe('OPS');
        expect(deriveMechanismClass({ goalText: 'Set up Kubernetes cluster' })).toBe('OPS');
      });

      it('detects workflow keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Automate deployment workflow' })).toBe('OPS');
        expect(deriveMechanismClass({ goalText: 'Configure monitoring and alerting' })).toBe('OPS');
      });
    });

    // CREATE tests
    describe('CREATE mechanism (default/fallback)', () => {
      it('detects create keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Create new dashboard' })).toBe('CREATE');
        expect(deriveMechanismClass({ terminalOutcome: { text: 'Build API service' } })).toBe('CREATE');
      });

      it('detects design keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Design database schema' })).toBe('CREATE');
      });

      it('detects code keywords', () => {
        expect(deriveMechanismClass({ goalText: 'Write unit tests' })).toBe('CREATE');
        expect(deriveMechanismClass({ goalText: 'Implement feature request' })).toBe('CREATE');
      });

      it('defaults to CREATE when no pattern matches', () => {
        expect(deriveMechanismClass({ goalText: 'Do something' })).toBe('CREATE');
        expect(deriveMechanismClass({})).toBe('CREATE');
        expect(deriveMechanismClass({ goalText: '' })).toBe('CREATE');
      });
    });

    // Priority/Specificity tests
    describe('Priority: more specific patterns match first', () => {
      it('PUBLISH takes priority over generic CREATE', () => {
        expect(deriveMechanismClass({ goalText: 'Publish and deploy new version' })).toBe('PUBLISH');
      });

      it('MARKET takes priority over generic CREATE', () => {
        expect(deriveMechanismClass({ goalText: 'Market and promote new service' })).toBe('MARKET');
      });

      it('LEARN takes priority over generic CREATE', () => {
        expect(deriveMechanismClass({ goalText: 'Learn about infrastructure design' })).toBe('LEARN');
      });
    });

    // Fallback chain tests
    describe('Text source fallback chain', () => {
      it('uses terminalOutcome.text as primary', () => {
        expect(
          deriveMechanismClass({
            terminalOutcome: { text: 'Publish music' },
            goalText: 'Create something'
          })
        ).toBe('PUBLISH');
      });

      it('uses goalText if terminalOutcome empty', () => {
        expect(
          deriveMechanismClass({
            terminalOutcome: { text: '' },
            goalText: 'Learn Python'
          })
        ).toBe('LEARN');
      });

      it('uses aim.text as last resort', () => {
        expect(deriveMechanismClass({ aim: { text: 'Review code' } })).toBe('REVIEW');
      });

      it('skips undefined/null values', () => {
        expect(deriveMechanismClass({ terminalOutcome: null, goalText: 'Market product' })).toBe('MARKET');
      });
    });

    // Determinism tests (critical for acceptance)
    describe('Determinism: same input = same output', () => {
      const testCases = [
        { input: { goalText: 'Publish album to Spotify' }, expected: 'PUBLISH' },
        { input: { goalText: 'Learn TypeScript' }, expected: 'LEARN' },
        { input: { goalText: 'Build web application' }, expected: 'CREATE' },
        { input: { goalText: 'Review code quality' }, expected: 'REVIEW' },
        { input: { goalText: 'Set up CI/CD pipeline infrastructure' }, expected: 'OPS' },
        { input: { goalText: 'Market and grow user base' }, expected: 'MARKET' }
      ];

      testCases.forEach((tc) => {
        it(`${JSON.stringify(tc.input)} → ${tc.expected} (deterministic)`, () => {
          const result1 = deriveMechanismClass(tc.input);
          const result2 = deriveMechanismClass(tc.input);
          const result3 = deriveMechanismClass(tc.input);

          expect(result1).toBe(tc.expected);
          expect(result2).toBe(tc.expected);
          expect(result3).toBe(tc.expected);
          expect(result1).toEqual(result2);
          expect(result2).toEqual(result3);
        });
      });
    });

    // Type safety
    describe('Type safety', () => {
      it('returns valid MechanismClass type', () => {
        const result = deriveMechanismClass({ goalText: 'anything' });
        const validTypes: MechanismClass[] = ['CREATE', 'PUBLISH', 'MARKET', 'LEARN', 'OPS', 'REVIEW'];
        expect(validTypes).toContain(result);
      });
    });
  });

  describe('describeMechanismClass', () => {
    it('returns human-readable descriptions', () => {
      expect(describeMechanismClass('CREATE')).toMatch(/creating|building/i);
      expect(describeMechanismClass('PUBLISH')).toMatch(/publish|launch/i);
      expect(describeMechanismClass('MARKET')).toMatch(/market|growth/i);
      expect(describeMechanismClass('LEARN')).toMatch(/learning|skill/i);
      expect(describeMechanismClass('OPS')).toMatch(/operations|infrastructure/i);
      expect(describeMechanismClass('REVIEW')).toMatch(/review|refinement/i);
    });
  });
});
