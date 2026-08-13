import { describe, it, expect } from 'vitest';
import { buildPricingStrategyAdvisory } from '../pricingStrategyAdvisory.js';

describe('buildPricingStrategyAdvisory', () => {
  it('returns null when riskClassification is null', () => {
    const state = {
      matrix: {
        initiativesById: {
          'init-1': {
            id: 'init-1',
            name: 'Test Initiative',
            riskClassification: null,
          },
        },
      },
    };

    const advisory = buildPricingStrategyAdvisory(state, 'init-1');
    expect(advisory).toBeNull();
  });

  it('returns premium recommendation for differentiation_risk', () => {
    const state = {
      matrix: {
        initiativesById: {
          'init-1': {
            id: 'init-1',
            name: 'Test Initiative',
            riskClassification: 'differentiation_risk',
            pricingStrategy: 'premium',
            pricingReasoning: null,
          },
        },
      },
    };

    const advisory = buildPricingStrategyAdvisory(state, 'init-1');
    expect(advisory).not.toBeNull();
    expect(advisory.riskClass).toBe('differentiation_risk');
    expect(advisory.title).toContain('Differentiation');
  });

  it('returns penetration recommendation for validation_risk', () => {
    const state = {
      matrix: {
        initiativesById: {
          'init-1': {
            id: 'init-1',
            name: 'Test Initiative',
            riskClassification: 'validation_risk',
            pricingStrategy: 'penetration',
            pricingReasoning: null,
          },
        },
      },
    };

    const advisory = buildPricingStrategyAdvisory(state, 'init-1');
    expect(advisory).not.toBeNull();
    expect(advisory.riskClass).toBe('validation_risk');
    expect(advisory.title).toContain('Validation');
  });

  it('handles inconclusive classification with explicit choice flag', () => {
    const state = {
      matrix: {
        initiativesById: {
          'init-1': {
            id: 'init-1',
            name: 'Test Initiative',
            riskClassification: 'inconclusive',
            pricingStrategy: null,
            pricingReasoning: null,
          },
        },
      },
    };

    const advisory = buildPricingStrategyAdvisory(state, 'init-1');
    expect(advisory).not.toBeNull();
    expect(advisory.riskClass).toBe('inconclusive');
    expect(advisory.requiresExplicitChoice).toBe(true);
  });

  it('returns null when initiative not found', () => {
    const state = {
      matrix: {
        initiativesById: {},
      },
    };

    const advisory = buildPricingStrategyAdvisory(state, 'init-nonexistent');
    expect(advisory).toBeNull();
  });

  it('returns null when matrix is missing', () => {
    const state = {};
    const advisory = buildPricingStrategyAdvisory(state, 'init-1');
    expect(advisory).toBeNull();
  });
});
