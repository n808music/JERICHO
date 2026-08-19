/**
 * Sequencing Strategy Slot Definition
 *
 * Defines the three-question probe for sequencing strategy classification:
 * Shared with Pricing Strategy (riskClassification field, same probe logic).
 * Output differs: Sequencing maps to Foundation-First vs Output-First ordering.
 * 1. Category precedent — Has this category seen proven, non-commoditized winners?
 * 2. Audience precedent — Do your target customers have prior successful relationships with similar offerings?
 * 3. Competitive density — Is the category highly competitive or underserved?
 *
 * Classification logic (shared with Pricing Strategy, same 2+ direction rule):
 * - If 2+ answers point the same direction → classify that way
 * - Otherwise → mark as "inconclusive" (do NOT default)
 *
 * Output mapping (evidence-grounded, Phase 2 locked directive):
 * - Differentiation Risk (strong category + strong audience): Foundation-First
 *   → Foundation (business plan, brand, positioning) precedes or runs with first Output
 *   → Reasoning: Strong category + audience precedent = Foundation investment well-justified
 * - Validation Risk (weak category + weak audience): Output-First
 *   → Minimal, falsifiable Output test precedes heavy Foundation investment
 *   → Reasoning: Weak precedent = demand uncertainty primary risk; get signal before heavy spend
 * - Inconclusive: Require explicit operator choice (Foundation-First OR Output-First buttons, no silent default)
 *
 * Note: This classification field is shared with Pricing Strategy (riskClassification).
 * If operator configured pricing first, Sequencing reuses that classification and shows recommendation.
 */

export const SEQUENCING_STRATEGY_SLOT_ID = 'SEQUENCING_STRATEGY';

export const SEQUENCING_STRATEGY_SLOT = {
  name: 'SEQUENCING_STRATEGY',
  // Gate array: checks probe completion. Each gate ensures the three probe questions
  // have been answered before slot is considered complete.
  gate: [
    {
      code: 'SEQUENCING_CATEGORY_MISSING',
      fieldName: 'category_precedent',
      detect: (captured) => !captured?.category_precedent,
    },
    {
      code: 'SEQUENCING_AUDIENCE_MISSING',
      fieldName: 'audience_precedent',
      detect: (captured) => !captured?.audience_precedent,
    },
    {
      code: 'SEQUENCING_DENSITY_MISSING',
      fieldName: 'competitive_density',
      detect: (captured) => !captured?.competitive_density,
    },
  ],
  probes: [
    {
      name: 'category_precedent',
      question: 'Has this category seen proven, non-commoditized winners?',
      type: 'binary_or_unknown', // Yes/No/Unknown
      answers: ['yes', 'no', 'unknown'],
    },
    {
      name: 'audience_precedent',
      question: 'Do your target customers have prior successful relationships with similar offerings?',
      type: 'binary_or_unknown', // Yes/No/Unknown
      answers: ['yes', 'no', 'unknown'],
    },
    {
      name: 'competitive_density',
      question: 'Is the category highly competitive or underserved?',
      type: 'select', // Competitive / Underserved / Unknown
      answers: ['competitive', 'underserved', 'unknown'],
    },
  ],
};

/**
 * Classify initiative sequencing risk based on three-question answers.
 *
 * Logic: Count same-direction answers (identical to Pricing Strategy).
 * - 2+ answers pointing differentiation → differentiation_risk
 * - 2+ answers pointing validation → validation_risk
 * - Split answers → inconclusive (do NOT default)
 *
 * @param {object} answers - Map of probe names to answers
 * @returns {object} { riskClass, confidence, signals }
 */
export function classifyFromAnswers(answers = {}) {
  // Normalize answers
  const q1 = String(answers?.category_precedent || '').trim().toLowerCase();
  const q2 = String(answers?.audience_precedent || '').trim().toLowerCase();
  const q3 = String(answers?.competitive_density || '').trim().toLowerCase();

  const differentiationSignals = [];
  const validationSignals = [];

  // Q1: Category precedent
  if (q1 === 'yes') {differentiationSignals.push('q1');}
  if (q1 === 'no') {validationSignals.push('q1');}

  // Q2: Audience precedent
  if (q2 === 'yes') {differentiationSignals.push('q2');}
  if (q2 === 'no') {validationSignals.push('q2');}

  // Q3: Competitive density
  if (q3 === 'competitive') {differentiationSignals.push('q3');}
  if (q3 === 'underserved') {validationSignals.push('q3');}

  // Classification: 2+ same-direction signals
  if (differentiationSignals.length >= 2) {
    return {
      riskClass: 'differentiation_risk',
      confidence: 'high',
      signals: differentiationSignals,
    };
  }

  if (validationSignals.length >= 2) {
    return {
      riskClass: 'validation_risk',
      confidence: 'high',
      signals: validationSignals,
    };
  }

  // No clear consensus: inconclusive
  return {
    riskClass: 'inconclusive',
    confidence: 'low',
    signals: [],
  };
}

/**
 * Build advisory recommendation based on risk classification.
 *
 * Maps classification to Foundation-First vs Output-First sequencing:
 * - differentiation_risk → Foundation-First (build brand/positioning first)
 * - validation_risk → Output-First (test demand first)
 * - inconclusive → operator chooses explicitly
 *
 * @param {string} riskClass - Risk classification result
 * @returns {object} { recommendation, reasoning, defaultEdge }
 */
export function buildSequencingAdvisory(riskClass) {
  switch (riskClass) {
    case 'differentiation_risk':
      return {
        recommendation: 'Foundation-First',
        reasoning:
          'Strong category and audience precedent indicates Foundation investment (business plan, brand, positioning) is well-justified before or alongside first Output.',
        defaultEdge: 'Foundation→Output',
        confidence: 'high',
      };

    case 'validation_risk':
      return {
        recommendation: 'Output-First',
        reasoning:
          'Weak category or audience precedent indicates demand uncertainty is the primary risk. Build a minimal, falsifiable Output test first to validate market fit before heavy Foundation investment.',
        defaultEdge: 'Output→Foundation',
        confidence: 'high',
      };

    case 'inconclusive':
      return {
        recommendation: null,
        reasoning: null,
        defaultEdge: null,
        confidence: 'low',
        requiresOperatorChoice: true,
      };

    default:
      return {
        recommendation: null,
        reasoning: null,
        defaultEdge: null,
        confidence: 'low',
      };
  }
}

/**
 * Build payload for DECLARE_SEQUENCING_STRATEGY reducer action.
 *
 * @param {string} initiativeId - Initiative ID
 * @param {string} riskClass - Risk classification (differentiation_risk | validation_risk | inconclusive)
 * @param {string} sequencingStrategy - Chosen strategy (foundation_first | output_first)
 * @param {string} [sequencingReasoning] - Optional operator override explanation
 * @returns {object} Dispatch payload
 */
export function buildSequencingStrategyPayload(initiativeId, riskClass, sequencingStrategy, sequencingReasoning) {
  return {
    type: 'DECLARE_SEQUENCING_STRATEGY',
    payload: {
      initiativeId: String(initiativeId || '').trim(),
      riskClassification: String(riskClass || '').trim(),
      sequencingStrategy: String(sequencingStrategy || '').trim(),
      sequencingReasoning: sequencingReasoning ? String(sequencingReasoning).trim() : null,
    },
  };
}
