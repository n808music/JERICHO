import { describe, it, expect } from 'vitest';
import { classifyFromAnswers, buildPricingStrategyPayload } from '../pricingStrategySlot.js';

describe('classifyFromAnswers', () => {
  it('classifies as differentiation_risk when 2+ signals point that way', () => {
    const answers = {
      category_precedent: 'yes',
      audience_precedent: 'yes',
      competitive_density: 'competitive',
    };

    const result = classifyFromAnswers(answers);
    expect(result.riskClass).toBe('differentiation_risk');
    expect(result.confidence).toBe('high');
  });

  it('classifies as validation_risk when 2+ signals point that way', () => {
    const answers = {
      category_precedent: 'no',
      audience_precedent: 'no',
      competitive_density: 'underserved',
    };

    const result = classifyFromAnswers(answers);
    expect(result.riskClass).toBe('validation_risk');
    expect(result.confidence).toBe('high');
  });

  it('classifies as inconclusive when answers split', () => {
    const answers = {
      category_precedent: 'yes',
      audience_precedent: 'no',
      competitive_density: 'unknown',
    };

    const result = classifyFromAnswers(answers);
    expect(result.riskClass).toBe('inconclusive');
    expect(result.confidence).toBe('low');
  });

  it('handles mixed differentiation signals', () => {
    const answers = {
      category_precedent: 'yes',
      audience_precedent: 'yes',
      competitive_density: 'underserved',
    };

    const result = classifyFromAnswers(answers);
    expect(result.riskClass).toBe('differentiation_risk');
  });

  it('handles mixed validation signals', () => {
    const answers = {
      category_precedent: 'no',
      audience_precedent: 'no',
      competitive_density: 'competitive',
    };

    const result = classifyFromAnswers(answers);
    expect(result.riskClass).toBe('validation_risk');
  });

  it('handles empty answers', () => {
    const result = classifyFromAnswers({});
    expect(result.riskClass).toBe('inconclusive');
  });
});

describe('buildPricingStrategyPayload', () => {
  it('builds correct payload for differentiation_risk with premium strategy', () => {
    const payload = buildPricingStrategyPayload('init-1', 'differentiation_risk', 'premium', 'Test reasoning');

    expect(payload.type).toBe('DECLARE_PRICING_STRATEGY');
    expect(payload.payload.initiativeId).toBe('init-1');
    expect(payload.payload.riskClassification).toBe('differentiation_risk');
    expect(payload.payload.pricingStrategy).toBe('premium');
    expect(payload.payload.pricingReasoning).toBe('Test reasoning');
  });

  it('builds correct payload for validation_risk with penetration strategy', () => {
    const payload = buildPricingStrategyPayload('init-2', 'validation_risk', 'penetration', null);

    expect(payload.type).toBe('DECLARE_PRICING_STRATEGY');
    expect(payload.payload.initiativeId).toBe('init-2');
    expect(payload.payload.riskClassification).toBe('validation_risk');
    expect(payload.payload.pricingStrategy).toBe('penetration');
    expect(payload.payload.pricingReasoning).toBeNull();
  });

  it('trims whitespace from fields', () => {
    const payload = buildPricingStrategyPayload('  init-1  ', '  differentiation_risk  ', '  premium  ', '  reasoning  ');

    expect(payload.payload.initiativeId).toBe('init-1');
    expect(payload.payload.riskClassification).toBe('differentiation_risk');
    expect(payload.payload.pricingStrategy).toBe('premium');
    expect(payload.payload.pricingReasoning).toBe('reasoning');
  });
});
