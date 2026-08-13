import { describe, it, expect } from 'vitest';
import {
  SEQUENCING_STRATEGY_SLOT,
  classifyFromAnswers,
  buildSequencingAdvisory,
  buildSequencingStrategyPayload,
} from '../sequencingStrategySlot.js';

describe('sequencingStrategySlot', () => {
  describe('SEQUENCING_STRATEGY_SLOT', () => {
    it('exports slot with name and three probes', () => {
      expect(SEQUENCING_STRATEGY_SLOT.name).toBe('SEQUENCING_STRATEGY');
      expect(SEQUENCING_STRATEGY_SLOT.probes).toHaveLength(3);
      expect(SEQUENCING_STRATEGY_SLOT.probes[0].name).toBe('category_precedent');
      expect(SEQUENCING_STRATEGY_SLOT.probes[1].name).toBe('audience_precedent');
      expect(SEQUENCING_STRATEGY_SLOT.probes[2].name).toBe('competitive_density');
    });
  });

  describe('classifyFromAnswers', () => {
    it('classifies differentiation risk when 2+ signals point that way', () => {
      const answers = {
        category_precedent: 'yes',
        audience_precedent: 'yes',
        competitive_density: 'unknown',
      };
      const result = classifyFromAnswers(answers);
      expect(result.riskClass).toBe('differentiation_risk');
      expect(result.confidence).toBe('high');
      expect(result.signals).toContain('q1');
      expect(result.signals).toContain('q2');
    });

    it('classifies validation risk when 2+ signals point that way', () => {
      const answers = {
        category_precedent: 'no',
        audience_precedent: 'no',
        competitive_density: 'unknown',
      };
      const result = classifyFromAnswers(answers);
      expect(result.riskClass).toBe('validation_risk');
      expect(result.confidence).toBe('high');
    });

    it('uses competitive_density as differentiator', () => {
      const answers = {
        category_precedent: 'yes',
        audience_precedent: 'unknown',
        competitive_density: 'competitive',
      };
      const result = classifyFromAnswers(answers);
      expect(result.riskClass).toBe('differentiation_risk');
    });

    it('marks inconclusive when signals split', () => {
      const answers = {
        category_precedent: 'yes',
        audience_precedent: 'no',
        competitive_density: 'unknown',
      };
      const result = classifyFromAnswers(answers);
      expect(result.riskClass).toBe('inconclusive');
      expect(result.confidence).toBe('low');
    });

    it('handles whitespace in answers', () => {
      const answers = {
        category_precedent: '  yes  ',
        audience_precedent: '  yes  ',
        competitive_density: '  unknown  ',
      };
      const result = classifyFromAnswers(answers);
      expect(result.riskClass).toBe('differentiation_risk');
    });

    it('handles missing answers gracefully', () => {
      const result = classifyFromAnswers({});
      expect(result.riskClass).toBe('inconclusive');
    });
  });

  describe('buildSequencingAdvisory', () => {
    it('returns Foundation-First for differentiation risk', () => {
      const advisory = buildSequencingAdvisory('differentiation_risk');
      expect(advisory.recommendation).toBe('Foundation-First');
      expect(advisory.defaultEdge).toBe('Foundation→Output');
      expect(advisory.confidence).toBe('high');
      expect(advisory.reasoning).toContain('Foundation');
    });

    it('returns Output-First for validation risk', () => {
      const advisory = buildSequencingAdvisory('validation_risk');
      expect(advisory.recommendation).toBe('Output-First');
      expect(advisory.defaultEdge).toBe('Output→Foundation');
      expect(advisory.confidence).toBe('high');
      expect(advisory.reasoning).toContain('minimal');
    });

    it('returns null recommendation for inconclusive', () => {
      const advisory = buildSequencingAdvisory('inconclusive');
      expect(advisory.recommendation).toBeNull();
      expect(advisory.defaultEdge).toBeNull();
      expect(advisory.requiresOperatorChoice).toBe(true);
    });

    it('returns safe defaults for unknown classification', () => {
      const advisory = buildSequencingAdvisory('unknown_class');
      expect(advisory.recommendation).toBeNull();
      expect(advisory.confidence).toBe('low');
    });
  });

  describe('buildSequencingStrategyPayload', () => {
    it('builds valid payload with all fields', () => {
      const payload = buildSequencingStrategyPayload(
        'init-123',
        'differentiation_risk',
        'foundation_first',
        'Based on market research'
      );
      expect(payload.type).toBe('DECLARE_SEQUENCING_STRATEGY');
      expect(payload.payload.initiativeId).toBe('init-123');
      expect(payload.payload.riskClassification).toBe('differentiation_risk');
      expect(payload.payload.sequencingStrategy).toBe('foundation_first');
      expect(payload.payload.sequencingReasoning).toBe('Based on market research');
    });

    it('omits reasoning when not provided', () => {
      const payload = buildSequencingStrategyPayload(
        'init-123',
        'validation_risk',
        'output_first'
      );
      expect(payload.payload.sequencingReasoning).toBeNull();
    });

    it('trims whitespace from all string fields', () => {
      const payload = buildSequencingStrategyPayload(
        '  init-123  ',
        '  differentiation_risk  ',
        '  foundation_first  ',
        '  Some reasoning  '
      );
      expect(payload.payload.initiativeId).toBe('init-123');
      expect(payload.payload.riskClassification).toBe('differentiation_risk');
      expect(payload.payload.sequencingStrategy).toBe('foundation_first');
      expect(payload.payload.sequencingReasoning).toBe('Some reasoning');
    });
  });
});
