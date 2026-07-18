import { describe, it, expect } from 'vitest';
import { hasDefiniteEndState } from './hasDefiniteEndState';
import { hasAuthoredSubstance } from './hasAuthoredSubstance';

describe('hasDefiniteEndState — goal clarity bar', () => {
  describe('ADMIT: definite end-states', () => {
    it('admits a quantified net-worth goal', () => {
      expect(hasDefiniteEndState('$3.5B net worth, operational and profitable ecosystem, by July 4 2031')).toBe(true);
    });

    it('admits a multi-part goal (scope-blind)', () => {
      expect(hasDefiniteEndState('Launch my podcast, grow my newsletter to 10k subscribers, and publish my book by Dec 2027')).toBe(true);
    });

    it('admits an enterprise connectivity goal with subsidiaries noun', () => {
      expect(hasDefiniteEndState(
        'Help Global State Holdings establish enterprise connectivity between all of its subsidiaries and partner organizations throughout North America'
      )).toBe(true);
    });

    it('admits a goal with a named software artifact', () => {
      expect(hasDefiniteEndState('Build and ship a SaaS app for fitness coaches')).toBe(true);
    });

    it('admits a goal with a named certification', () => {
      expect(hasDefiniteEndState('Earn my AWS certification and get a senior engineer role')).toBe(true);
    });

    it('admits a goal with revenue target', () => {
      expect(hasDefiniteEndState('Reach $1M annual revenue for my agency')).toBe(true);
    });

    it('admits a subscriber goal', () => {
      expect(hasDefiniteEndState('Grow to 50k email subscribers by end of year')).toBe(true);
    });

    it('admits a film production goal', () => {
      expect(hasDefiniteEndState('Complete and release my documentary film')).toBe(true);
    });

    it('admits a company goal', () => {
      expect(hasDefiniteEndState('Incorporate my LLC and sign the first client contract')).toBe(true);
    });
  });

  describe('REPROBE: direction-only shells', () => {
    it('rejects "do better at life"', () => {
      expect(hasDefiniteEndState('I want to do better at life')).toBe(false);
    });

    it('rejects "get my business more successful"', () => {
      expect(hasDefiniteEndState('Get my business more successful')).toBe(false);
    });

    it('rejects "be more productive"', () => {
      expect(hasDefiniteEndState('Be more productive')).toBe(false);
    });

    it('rejects "become a better person"', () => {
      expect(hasDefiniteEndState('I want to become a better person')).toBe(false);
    });

    it('rejects "level up as a person"', () => {
      expect(hasDefiniteEndState('Level up as a person')).toBe(false);
    });

    it('rejects "live my best life"', () => {
      expect(hasDefiniteEndState('Live my best life')).toBe(false);
    });

    it('rejects "improve my life" (no concrete target)', () => {
      expect(hasDefiniteEndState('Improve my life')).toBe(false);
    });

    it('rejects "make more money" (no amount)', () => {
      expect(hasDefiniteEndState('Make more money')).toBe(false);
    });

    it('rejects "be more organized and disciplined"', () => {
      expect(hasDefiniteEndState('Be more organized and disciplined')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(hasDefiniteEndState('')).toBe(false);
    });
  });

  describe('Conservative default — borderline admits', () => {
    it('admits "grow my business" (borderline — elicitation probes specifics)', () => {
      // Borderline but not an obvious shell; elicitation handles specifics downstream
      expect(hasDefiniteEndState('Grow my business')).toBe(true);
    });
  });
});

describe('FIREWALL: hasDefiniteEndState is separate from cell-state gating', () => {
  it('hasAuthoredSubstance passes "not started" (honest cell gap)', () => {
    expect(hasAuthoredSubstance('not started')).toBe(true);
  });

  it('hasAuthoredSubstance passes "unknown" (honest cell gap)', () => {
    expect(hasAuthoredSubstance('unknown')).toBe(true);
  });

  it('hasAuthoredSubstance passes "haven\'t decided" (honest cell gap)', () => {
    expect(hasAuthoredSubstance("haven't decided")).toBe(true);
  });

  it('hasDefiniteEndState rejects "not started" as a goal (no destination)', () => {
    // "not started" is an HONEST CELL ANSWER (passes hasAuthoredSubstance)
    // but is NOT a definite end-state as a goal. The two predicates are independent.
    expect(hasDefiniteEndState('not started')).toBe(false);
  });

  it('hasDefiniteEndState module does not re-export hasAuthoredSubstance', async () => {
    // Structural firewall: the two predicates are separate modules.
    // hasAuthoredSubstance is NOT accessible through hasDefiniteEndState's exports.
    const mod = await import('./hasDefiniteEndState');
    expect(typeof mod.hasDefiniteEndState).toBe('function');
    expect((mod as Record<string, unknown>).hasAuthoredSubstance).toBeUndefined();
  });

  it('hasAuthoredSubstance module does not re-export hasDefiniteEndState', async () => {
    // Reverse check: hasDefiniteEndState is not exposed through hasAuthoredSubstance.
    const mod = await import('./hasAuthoredSubstance');
    expect((mod as Record<string, unknown>).hasDefiniteEndState).toBeUndefined();
  });
});
